from typing import List, Dict, Any, Optional
from app.extractor.db_client import PostgresClient
from app.models.schema import (
    TableInfo, ColumnInfo, ForeignServerInfo, ViewDependency,
    RoutineInfo, ColumnDependency
)
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
        """Fast scan all tables, foreign tables, and views with column counts"""
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

        # 2. Fast column count grouped by table
        count_query = """
        SELECT 
            table_schema,
            table_name,
            COUNT(*)::int AS col_count
        FROM information_schema.columns
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
        GROUP BY table_schema, table_name;
        """
        count_rows = self.client.execute_query(count_query)
        col_count_map = {f"{c['table_schema']}.{c['table_name']}": c["col_count"] for c in count_rows}

        # 3. Get all tables and views from information_schema
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

        # 4. Also scan materialized views from pg_matviews (which aren't in information_schema.tables)
        matview_query = """
        SELECT 
            schemaname AS schema_name,
            matviewname AS table_name,
            'MATERIALIZED VIEW' AS table_type
        FROM pg_matviews
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog');
        """
        matview_rows = self.client.execute_query(matview_query)
        all_table_rows = table_rows + matview_rows

        # 5. Fetch SQL definition for all views
        view_defs = self.scan_view_definitions()

        tables = []
        for t in all_table_rows:
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
                column_count=col_count_map.get(t_key, 0),
                columns=[],  # Populated on-demand or in column-level mode
                foreign_server=f_server,
                remote_schema=r_schema,
                remote_table=r_table,
                foreign_options=f_options,
                sql_definition=view_defs.get(t_key)
            ))
        return tables

    def get_table_columns(self, schema_name: str, table_name: str) -> List[ColumnInfo]:
        """Fetch columns on-demand for a single clicked table"""
        query = """
        SELECT 
            column_name,
            data_type,
            is_nullable,
            ordinal_position
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position;
        """
        rows = self.client.execute_query(query, (schema_name, table_name))
        return [
            ColumnInfo(
                name=r["column_name"],
                data_type=r["data_type"],
                is_nullable=r["is_nullable"],
                ordinal_position=r["ordinal_position"]
            )
            for r in rows
        ]

    def scan_view_dependencies(self) -> List[ViewDependency]:
        """Scan which tables/views feed into each view in this database using union of pg_depend & view_table_usage"""
        query = """
        SELECT DISTINCT
            nv.nspname AS view_schema,
            cv.relname AS view_name,
            nt.nspname AS dep_schema,
            ct.relname AS dep_table,
            ct.relkind::text AS dep_kind
        FROM pg_depend d
        JOIN pg_rewrite r ON d.objid = r.oid
        JOIN pg_class cv ON r.ev_class = cv.oid
        JOIN pg_namespace nv ON cv.relnamespace = nv.oid
        JOIN pg_class ct ON d.refobjid = ct.oid
        JOIN pg_namespace nt ON ct.relnamespace = nt.oid
        WHERE cv.relkind IN ('v', 'm')
          AND ct.relkind IN ('r', 'f', 'v', 'm', 'p')
          AND cv.oid != ct.oid
          AND nv.nspname NOT IN ('information_schema', 'pg_catalog')
          AND nt.nspname NOT IN ('information_schema', 'pg_catalog')
        UNION
        SELECT DISTINCT
            view_schema,
            view_name,
            table_schema AS dep_schema,
            table_name AS dep_table,
            'r' AS dep_kind
        FROM information_schema.view_table_usage
        WHERE view_schema NOT IN ('information_schema', 'pg_catalog')
          AND table_schema NOT IN ('information_schema', 'pg_catalog');
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
                dep_kind=r.get("dep_kind") or "r"
            ))
        return deps

    def scan_view_definitions(self) -> Dict[str, str]:
        """Fetch exact CREATE VIEW / MATVIEW SQL queries using pg_get_viewdef"""
        query = """
        SELECT 
            n.nspname AS schema_name,
            c.relname AS view_name,
            pg_get_viewdef(c.oid, true) AS view_def
        FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relkind IN ('v', 'm')
          AND n.nspname NOT IN ('information_schema', 'pg_catalog');
        """
        try:
            rows = self.client.execute_query(query)
            return {f"{r['schema_name']}.{r['view_name']}": r["view_def"] for r in rows if r.get("view_def")}
        except Exception as e:
            logger.warning(f"Failed to fetch view definitions on {self.db_name}: {e}")
            return {}

    def scan_column_dependencies(self) -> List[ColumnDependency]:
        """Scan column-level data lineage using information_schema.view_column_usage"""
        query = """
        SELECT DISTINCT
            view_schema,
            view_name,
            column_name AS view_column,
            table_schema AS source_schema,
            table_name AS source_table,
            column_name AS source_column
        FROM information_schema.view_column_usage
        WHERE view_schema NOT IN ('information_schema', 'pg_catalog')
          AND table_schema NOT IN ('information_schema', 'pg_catalog');
        """
        try:
            rows = self.client.execute_query(query)
            deps = []
            for r in rows:
                deps.append(ColumnDependency(
                    database=self.db_name,
                    view_schema=r["view_schema"],
                    view_name=r["view_name"],
                    view_column=r["view_column"],
                    source_schema=r["source_schema"],
                    source_table=r["source_table"],
                    source_column=r["source_column"],
                ))
            return deps
        except Exception as e:
            logger.warning(f"Failed to scan column dependencies on {self.db_name}: {e}")
            return []

    def scan_stored_procedures(self) -> List[RoutineInfo]:
        """Scan stored procedures and user-defined functions acting as processors in data lineage"""
        query = """
        SELECT 
            n.nspname AS routine_schema,
            p.proname AS routine_name,
            CASE WHEN p.prokind = 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END AS routine_type,
            pg_get_function_arguments(p.oid) AS arguments,
            t.typname AS return_type,
            pg_get_functiondef(p.oid) AS sql_definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        JOIN pg_type t ON p.prorettype = t.oid
        WHERE n.nspname NOT IN ('information_schema', 'pg_catalog')
          AND (p.prokind = 'p' OR (p.prokind = 'f' AND p.proretset = true))
        ORDER BY n.nspname, p.proname;
        """
        try:
            rows = self.client.execute_query(query)
            routines = []
            for r in rows:
                routines.append(RoutineInfo(
                    id=f"{self.db_name}.{r['routine_schema']}.{r['routine_name']}",
                    database=self.db_name,
                    schema_name=r["routine_schema"],
                    routine_name=r["routine_name"],
                    routine_type=r["routine_type"],
                    arguments=r.get("arguments") or "",
                    return_type=r.get("return_type") or "",
                    sql_definition=r.get("sql_definition")
                ))
            return routines
        except Exception as e:
            logger.warning(f"Failed to scan stored procedures on {self.db_name}: {e}")
            return []

    def get_columns_for_tables(self, table_keys: List[tuple]) -> Dict[str, List[ColumnInfo]]:
        """Fast batch fetch columns for a set of (schema_name, table_name) tuples"""
        if not table_keys:
            return {}
        
        # Build IN clauses
        schema_table_filters = " OR ".join(["(table_schema = %s AND table_name = %s)"] * len(table_keys))
        params = []
        for s, t in table_keys:
            params.extend([s, t])
            
        query = f"""
        SELECT 
            table_schema,
            table_name,
            column_name,
            data_type,
            is_nullable,
            ordinal_position
        FROM information_schema.columns
        WHERE {schema_table_filters}
        ORDER BY table_schema, table_name, ordinal_position;
        """
        try:
            rows = self.client.execute_query(query, tuple(params))
            col_map: Dict[str, List[ColumnInfo]] = {}
            for r in rows:
                key = f"{r['table_schema']}.{r['table_name']}"
                if key not in col_map:
                    col_map[key] = []
                col_map[key].append(ColumnInfo(
                    name=r["column_name"],
                    data_type=r["data_type"],
                    is_nullable=r["is_nullable"],
                    ordinal_position=r["ordinal_position"]
                ))
            return col_map
        except Exception as e:
            logger.warning(f"Failed to batch fetch columns on {self.db_name}: {e}")
            return {}
