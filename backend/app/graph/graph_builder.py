from typing import List, Dict, Any, Optional
from app.models.schema import (
    TableInfo, ForeignServerInfo, ViewDependency, 
    GraphNode, GraphEdge, LineageGraphResponse
)
import logging

logger = logging.getLogger(__name__)

class GraphBuilder:
    def __init__(
        self, 
        all_tables: List[TableInfo], 
        all_servers: List[ForeignServerInfo], 
        all_deps: List[ViewDependency],
        configured_dbs: Optional[List[str]] = None
    ):
        self.tables = all_tables
        self.servers = all_servers
        self.deps = all_deps
        self.configured_dbs = configured_dbs or []

    def _resolve_remote_info(self, local_db: str, foreign_server_name: str) -> Dict[str, str]:
        """Find remote server connection details"""
        for s in self.servers:
            if s.database == local_db and s.server_name == foreign_server_name:
                host = s.host or ""
                dbname = s.dbname or ""
                
                # Check if host or dbname matches any of the user's configured databases
                for cfg_db in self.configured_dbs:
                    if cfg_db.lower() in host.lower() or cfg_db.lower() in dbname.lower():
                        return {"db": cfg_db, "host": host, "dbname": dbname}
                
                # Otherwise, identify by host or server_name
                matched_label = host if host else foreign_server_name
                return {"db": matched_label, "host": host, "dbname": dbname}
        return {"db": foreign_server_name, "host": "", "dbname": ""}

    def build_lineage_graph(self) -> LineageGraphResponse:
        nodes: List[GraphNode] = []
        edges: List[GraphEdge] = []
        
        # Group tables by database
        db_tables: Dict[str, List[TableInfo]] = {}
        for t in self.tables:
            if t.database not in db_tables:
                db_tables[t.database] = []
            db_tables[t.database].append(t)

        sorted_dbs = list(db_tables.keys())
        table_id_lookup = {t.id: t for t in self.tables}
        
        x_offset = 60.0
        y_spacing = 135.0

        for col_idx, db in enumerate(sorted_dbs):
            tables_in_db = db_tables[db]
            
            # Sort tables inside DB: native tables first, then foreign tables, then views
            def sort_priority(tbl: TableInfo):
                if tbl.table_type == "BASE TABLE":
                    return 0
                elif tbl.table_type == "FOREIGN TABLE":
                    return 1
                return 2

            tables_in_db.sort(key=sort_priority)

            for row_idx, tbl in enumerate(tables_in_db):
                pos_x = x_offset + (col_idx * 440.0)
                pos_y = 100.0 + (row_idx * y_spacing)
                
                nodes.append(GraphNode(
                    id=tbl.id,
                    type="tableNode",
                    position={"x": pos_x, "y": pos_y},
                    data={
                        "id": tbl.id,
                        "database": tbl.database,
                        "schema": tbl.schema_name,
                        "name": tbl.table_name,
                        "type": tbl.table_type,
                        "columnCount": len(tbl.columns),
                        "columns": [c.model_dump() for c in tbl.columns],
                        "foreignServer": tbl.foreign_server,
                        "remoteSchema": tbl.remote_schema,
                        "remoteTable": tbl.remote_table,
                        "foreignOptions": tbl.foreign_options,
                    }
                ))

        # 1. Build FDW Edges (Source Table -> Foreign Table)
        fdw_edge_count = 0
        extra_nodes_needed: Dict[str, Dict[str, Any]] = {}

        for target_table in self.tables:
            if target_table.table_type == "FOREIGN TABLE" and target_table.foreign_server:
                remote_info = self._resolve_remote_info(target_table.database, target_table.foreign_server)
                source_db = remote_info["db"]
                source_schema = target_table.remote_schema or "public"
                source_table_name = target_table.remote_table or target_table.table_name
                
                source_id = f"{source_db}.{source_schema}.{source_table_name}"
                
                # If source table is on an external server not yet scanned, generate a stub node
                if source_id not in table_id_lookup and source_id not in extra_nodes_needed:
                    extra_nodes_needed[source_id] = {
                        "id": source_id,
                        "database": f"External ({source_db})",
                        "schema": source_schema,
                        "name": source_table_name,
                        "type": "REMOTE SOURCE TABLE",
                        "columnCount": 0,
                        "columns": [],
                        "foreignServer": target_table.foreign_server,
                        "remoteSchema": None,
                        "remoteTable": None,
                        "foreignOptions": {},
                    }
                
                edge_id = f"edge_fdw_{source_id}__to__{target_table.id}"
                edges.append(GraphEdge(
                    id=edge_id,
                    source=source_id,
                    target=target_table.id,
                    type="smoothstep",
                    animated=True,
                    label=f"fdw ({target_table.foreign_server})",
                    data={
                        "relationship": "FDW_READS_FROM",
                        "server": target_table.foreign_server,
                        "sourceDb": source_db,
                        "targetDb": target_table.database,
                        "isRemoteUnscanned": source_id in extra_nodes_needed
                    },
                    style={
                        "stroke": "#06b6d4",
                        "strokeWidth": 2.5
                    }
                ))
                fdw_edge_count += 1

        # Position any external source nodes on a column to the left (-380px)
        for idx, (ext_id, ext_data) in enumerate(extra_nodes_needed.items()):
            nodes.append(GraphNode(
                id=ext_id,
                type="tableNode",
                position={"x": -380.0, "y": 100.0 + (idx * y_spacing)},
                data=ext_data
            ))

        # 2. Build View Dependency Edges (Dep Table -> View)
        view_edge_count = 0
        for dep in self.deps:
            source_id = f"{dep.database}.{dep.dep_schema}.{dep.dep_table}"
            target_id = f"{dep.database}.{dep.view_schema}.{dep.view_name}"
            
            if source_id in table_id_lookup and target_id in table_id_lookup:
                edge_id = f"edge_view_{source_id}__to__{target_id}"
                if not any(e.id == edge_id for e in edges):
                    edges.append(GraphEdge(
                        id=edge_id,
                        source=source_id,
                        target=target_id,
                        type="smoothstep",
                        animated=False,
                        label="view dependency",
                        data={
                            "relationship": "VIEW_DEPENDS_ON",
                            "view": f"{dep.view_schema}.{dep.view_name}",
                            "depKind": dep.dep_kind
                        },
                        style={
                            "stroke": "#8b5cf6",
                            "strokeWidth": 2,
                            "strokeDasharray": "5,5"
                        }
                    ))
                    view_edge_count += 1

        stats = {
            "totalDatabases": len(sorted_dbs),
            "databases": sorted_dbs,
            "totalTables": len(self.tables),
            "nativeTables": sum(1 for t in self.tables if t.table_type == "BASE TABLE"),
            "foreignTables": sum(1 for t in self.tables if t.table_type == "FOREIGN TABLE"),
            "views": sum(1 for t in self.tables if "VIEW" in t.table_type),
            "fdwConnections": fdw_edge_count,
            "viewDependencies": view_edge_count
        }

        return LineageGraphResponse(nodes=nodes, edges=edges, stats=stats)
