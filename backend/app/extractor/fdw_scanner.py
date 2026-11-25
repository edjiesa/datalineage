from typing import List, Dict, Any, Optional
from app.extractor.db_client import PostgresClient
from app.models.schema import TableInfo, ColumnInfo, ForeignServerInfo, ViewDependency
import logging

logger = logging.getLogger(__name__)

class FDWScanner:
    def __init__(self, client: PostgresClient):
        self.client = client
        self.db_name = client.config.name

    def scan_foreign_servers(self) -> List[ForeignServerInfo]:
        """Query foreign servers defined in this database"""
        query = """
        SELECT 
            fs.srvname AS server_name,
            fdw.fdwname AS fdw_name,
            fs.srvoptions AS server_options
        FROM pg_foreign_server fs
        JOIN pg_foreign_data_wrapper fdw ON fs.srvfdw = fdw.oid;
        """
        rows = self.client.execute_query(query)
        servers = []
        for r in rows:
            options_dict = {}
            if r.get("server_options"):
                for opt in r["server_options"]:
                    if "=" in opt:
                        k, v = opt.split("=", 1)
                        options_dict[k.strip()] = v.strip()
            
            servers.append(ForeignServerInfo(
                database=self.db_name,
                server_name=r["server_name"],
                fdw_name=r["fdw_name"],
                host=options_dict.get("host"),
                dbname=options_dict.get("dbname"),
                port=options_dict.get("port"),
                options=options_dict
            ))
        return servers

    def scan_tables_and_views(self) -> List[TableInfo]:
        """Scan all native tables, foreign tables, and views"""
        # 1. Get foreign tables metadata
        foreign_query = """
        SELECT 
            n.nspname AS schema_name,
            c.relname AS table_name,
            fs.srvname AS foreign_server_name,
            ft.ftoptions AS foreign_table_options
        FROM pg_foreign_table ft
        JOIN pg_class c ON ft.ftrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        JOIN pg_foreign_server fs ON ft.ftserver = fs.oid;
        """
        foreign_rows = self.client.execute_query(foreign_query)
        foreign_map = {}
        for fr in foreign_rows:
            key = f"{fr['schema_name']}.{fr['table_name']}"
            options_dict = {}
            if fr.get("foreign_table_options"):
                for opt in fr["foreign_table_options"]:
                    if "=" in opt:
                        k, v = opt.split("=", 1)
                        options_dict[k.strip()] = v.strip()
            foreign_map[key] = {
                "server": fr["foreign_server_name"],
                "options": options_dict,
                "remote_schema": options_dict.get("schema_name", "public"),
                "remote_table": options_dict.get("table_name", fr["table_name"])
            }

        # 2. Get all tables and views from information_schema
        table_query = """
        SELECT 
            table_schema AS schema_name,
            table_name,
            table_type
        FROM information_schema.tables
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
        ORDER BY table_schema, table_name;
        """
        table_rows = self.client.execute_query(table_query)

        # 3. Get all columns
        col_query = """
        SELECT 
            table_schema,
            table_name,
            column_name,
            data_type,
            is_nullable,
            ordinal_position
        FROM information_schema.columns
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
        ORDER BY table_schema, table_name, ordinal_position;
        """
        col_rows = self.client.execute_query(col_query)
        col_map = {}
        for c in col_rows:
            t_key = f"{c['table_schema']}.{c['table_name']}"
            if t_key not in col_map:
                col_map[t_key] = []
            col_map[t_key].append(ColumnInfo(
                name=c["column_name"],
                data_type=c["data_type"],
                is_nullable=c["is_nullable"],
                ordinal_position=c["ordinal_position"]
            ))

        tables = []
        for t in table_rows:
            s_name = t["schema_name"]
            t_name = t["table_name"]
            t_key = f"{s_name}.{t_name}"
            
            raw_type = t["table_type"]
            is_foreign = t_key in foreign_map
            
            if is_foreign:
                final_type = "FOREIGN TABLE"
                f_info = foreign_map[t_key]
                f_server = f_info["server"]
                r_schema = f_info["remote_schema"]
                r_table = f_info["remote_table"]
                f_options = f_info["options"]
            else:
                final_type = raw_type
                f_server = None
                r_schema = None
                r_table = None
                f_options = {}

            node_id = f"{self.db_name}.{s_name}.{t_name}"
            tables.append(TableInfo(
                id=node_id,
                database=self.db_name,
                schema_name=s_name,
                table_name=t_name,
                table_type=final_type,
                columns=col_map.get(t_key, []),
                foreign_server=f_server,
                remote_schema=r_schema,
                remote_table=r_table,
                foreign_options=f_options
            ))
        return tables

    def scan_view_dependencies(self) -> List[ViewDependency]:
        """Scan which tables/views feed into each view in this database"""
        query = """
        SELECT DISTINCT
            nv.nspname AS view_schema,
            cv.relname AS view_name,
            nt.nspname AS dep_schema,
            ct.relname AS dep_table,
            ct.relkind AS dep_kind
        FROM pg_depend d
        JOIN pg_rewrite r ON d.objid = r.oid
        JOIN pg_class cv ON r.ev_class = cv.oid
        JOIN pg_namespace nv ON cv.relnamespace = nv.oid
        JOIN pg_class ct ON d.refobjid = ct.oid
        JOIN pg_namespace nt ON ct.relnamespace = nt.oid
        WHERE cv.relkind IN ('v', 'm')
          AND ct.relkind IN ('r', 'f', 'v', 'm')
          AND cv.oid != ct.oid
          AND nv.nspname NOT IN ('information_schema', 'pg_catalog')
          AND nt.nspname NOT IN ('information_schema', 'pg_catalog');
        """
        rows = self.client.execute_query(query)
        deps = []
        for r in rows:
            deps.append(ViewDependency(
                database=self.db_name,
                view_schema=r["view_schema"],
                view_name=r["view_name"],
                dep_schema=r["dep_schema"],
                dep_table=r["dep_table"],
                dep_kind=r["dep_kind"]
            ))
        return deps
