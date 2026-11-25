from typing import List, Dict, Any
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
        all_deps: List[ViewDependency]
    ):
        self.tables = all_tables
        self.servers = all_servers
        self.deps = all_deps

    def _resolve_remote_db(self, local_db: str, foreign_server_name: str) -> str:
        """Find the matching database name for a given foreign server"""
        for s in self.servers:
            if s.database == local_db and s.server_name == foreign_server_name:
                # Match host or dbname
                host = s.host or ""
                dbname = s.dbname or ""
                
                # Check known naming conventions
                if "core" in host or "core" in dbname:
                    return "postgres-core"
                elif "logistics" in host or "logistics" in dbname:
                    return "postgres-logistics"
                elif "analytics" in host or "analytics" in dbname:
                    return "postgres-analytics"
                
                # Default fallback if host matches a db name
                return host
        return "unknown_server"

    def build_lineage_graph(self) -> LineageGraphResponse:
        nodes: List[GraphNode] = []
        edges: List[GraphEdge] = []
        
        # Group tables by database
        db_tables: Dict[str, List[TableInfo]] = {}
        for t in self.tables:
            if t.database not in db_tables:
                db_tables[t.database] = []
            db_tables[t.database].append(t)

        # Positioning: Assign columns (X) to databases
        # Order databases: core (left: 50), logistics (middle: 480), analytics (right: 920)
        db_order = ["postgres-core", "postgres-logistics", "postgres-analytics"]
        sorted_dbs = sorted(
            db_tables.keys(), 
            key=lambda d: db_order.index(d) if d in db_order else 99
        )

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
                pos_x = x_offset + (col_idx * 420.0)
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
        for target_table in self.tables:
            if target_table.table_type == "FOREIGN TABLE" and target_table.foreign_server:
                source_db = self._resolve_remote_db(target_table.database, target_table.foreign_server)
                source_schema = target_table.remote_schema or "public"
                source_table_name = target_table.remote_table or target_table.table_name
                
                source_id = f"{source_db}.{source_schema}.{source_table_name}"
                
                # Check if source table node exists
                source_exists = source_id in table_id_lookup
                
                edge_id = f"edge_fdw_{source_id}__to__{target_table.id}"
                edges.append(GraphEdge(
                    id=edge_id,
                    source=source_id,
                    target=target_table.id,
                    type="smoothstep",
                    animated=True,
                    label=f"postgres_fdw ({target_table.foreign_server})",
                    data={
                        "relationship": "FDW_READS_FROM",
                        "server": target_table.foreign_server,
                        "sourceDb": source_db,
                        "targetDb": target_table.database,
                        "sourceResolved": source_exists
                    },
                    style={
                        "stroke": "#06b6d4", # cyan-500
                        "strokeWidth": 2.5
                    }
                ))
                fdw_edge_count += 1

        # 2. Build View Dependency Edges (Dep Table -> View)
        view_edge_count = 0
        for dep in self.deps:
            source_id = f"{dep.database}.{dep.dep_schema}.{dep.dep_table}"
            target_id = f"{dep.database}.{dep.view_schema}.{dep.view_name}"
            
            if source_id in table_id_lookup and target_id in table_id_lookup:
                edge_id = f"edge_view_{source_id}__to__{target_id}"
                # avoid duplicates
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
                            "stroke": "#8b5cf6", # violet-500
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
