from typing import List, Dict, Any, Optional, Set
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
                
                matched_label = host if host else foreign_server_name
                return {"db": matched_label, "host": host, "dbname": dbname}
        return {"db": foreign_server_name, "host": "", "dbname": ""}

    def build_lineage_graph(
        self, 
        mode: str = "fdw",  # "fdw" (default), "views", "all"
        schema_filter: Optional[str] = None,
        search_query: Optional[str] = None
    ) -> LineageGraphResponse:
        table_id_lookup = {t.id: t for t in self.tables}
        
        # 1. Build FDW Edges & identify FDW nodes
        fdw_edges: List[GraphEdge] = []
        fdw_table_ids: Set[str] = set()
        remote_stub_nodes: Dict[str, Dict[str, Any]] = {}

        for target_table in self.tables:
            if target_table.table_type == "FOREIGN TABLE" and target_table.foreign_server:
                remote_info = self._resolve_remote_info(target_table.database, target_table.foreign_server)
                source_db = remote_info["db"]
                source_schema = target_table.remote_schema or "public"
                source_table_name = target_table.remote_table or target_table.table_name
                
                source_id = f"{source_db}.{source_schema}.{source_table_name}"
                
                fdw_table_ids.add(target_table.id)
                fdw_table_ids.add(source_id)

                if source_id not in table_id_lookup and source_id not in remote_stub_nodes:
                    remote_stub_nodes[source_id] = {
                        "id": source_id,
                        "database": f"External ({source_db})",
                        "schema": source_schema,
                        "name": source_table_name,
                        "type": "REMOTE SOURCE TABLE",
                        "columnCount": 0,
                        "foreignServer": target_table.foreign_server,
                        "remoteSchema": None,
                        "remoteTable": None,
                        "foreignOptions": {},
                    }
                
                edge_id = f"edge_fdw_{source_id}__to__{target_table.id}"
                fdw_edges.append(GraphEdge(
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
                    },
                    style={
                        "stroke": "#06b6d4",
                        "strokeWidth": 2.5
                    }
                ))

        # 2. Build View Edges
        view_edges: List[GraphEdge] = []
        view_related_ids: Set[str] = set()
        for dep in self.deps:
            source_id = f"{dep.database}.{dep.dep_schema}.{dep.dep_table}"
            target_id = f"{dep.database}.{dep.view_schema}.{dep.view_name}"
            
            # If in FDW mode, only include views that connect directly to FDW tables!
            if mode == "fdw":
                if source_id in fdw_table_ids or target_id in fdw_table_ids:
                    view_related_ids.add(source_id)
                    view_related_ids.add(target_id)
                    if source_id in table_id_lookup and target_id in table_id_lookup:
                        view_edges.append(GraphEdge(
                            id=f"edge_view_{source_id}__to__{target_id}",
                            source=source_id,
                            target=target_id,
                            type="smoothstep",
                            animated=False,
                            label="view dependency",
                            data={"relationship": "VIEW_DEPENDS_ON"},
                            style={"stroke": "#8b5cf6", "strokeWidth": 2, "strokeDasharray": "5,5"}
                        ))
            elif mode == "views":
                view_related_ids.add(source_id)
                view_related_ids.add(target_id)
                if source_id in table_id_lookup and target_id in table_id_lookup:
                    view_edges.append(GraphEdge(
                        id=f"edge_view_{source_id}__to__{target_id}",
                        source=source_id,
                        target=target_id,
                        type="smoothstep",
                        animated=False,
                        label="view dependency",
                        data={"relationship": "VIEW_DEPENDS_ON"},
                        style={"stroke": "#8b5cf6", "strokeWidth": 2, "strokeDasharray": "5,5"}
                    ))

        # 3. Determine tables to render based on MODE
        tables_to_render: List[TableInfo] = []
        
        if mode == "fdw":
            # ONLY tables participating in FDW (e.g. 1-10 tables)
            target_ids = fdw_table_ids.union(view_related_ids)
            for t in self.tables:
                if t.id in target_ids:
                    tables_to_render.append(t)
        elif mode == "views":
            # Views and their direct dependencies (capped to prevent 1500 partition flood)
            cap = 60
            for t in self.tables:
                if t.id in view_related_ids:
                    tables_to_render.append(t)
                    if len(tables_to_render) >= cap:
                        break
        else: # mode == "all"
            # Filter by search or schema, capped to max 60 tables
            cap = 60
            for t in self.tables:
                if schema_filter and schema_filter != "ALL" and t.schema_name != schema_filter:
                    continue
                if search_query and search_query.strip():
                    q = search_query.lower()
                    if q not in t.table_name.lower() and q not in t.schema_name.lower():
                        continue
                tables_to_render.append(t)
                if len(tables_to_render) >= cap:
                    break

        # 4. Smart Grid / Multi-Column Layout (NEVER a single 200,000px vertical line!)
        nodes: List[GraphNode] = []
        
        # Position Remote External Stubs on Left (X = 60)
        ext_y_spacing = 135.0
        for idx, (ext_id, ext_data) in enumerate(remote_stub_nodes.items()):
            nodes.append(GraphNode(
                id=ext_id,
                type="tableNode",
                position={"x": 60.0, "y": 100.0 + (idx * ext_y_spacing)},
                data={**ext_data, "hasLineage": True}
            ))

        # Position Local Tables
        # In FDW mode: Foreign Tables on Middle (X = 520), Views on Right (X = 980)
        if mode == "fdw":
            foreign_tables = [t for t in tables_to_render if t.table_type == "FOREIGN TABLE"]
            other_tables = [t for t in tables_to_render if t.table_type != "FOREIGN TABLE"]
            
            for idx, tbl in enumerate(foreign_tables):
                nodes.append(GraphNode(
                    id=tbl.id,
                    type="tableNode",
                    position={"x": 520.0, "y": 100.0 + (idx * 135.0)},
                    data={
                        "id": tbl.id,
                        "database": tbl.database,
                        "schema": tbl.schema_name,
                        "name": tbl.table_name,
                        "type": tbl.table_type,
                        "columnCount": tbl.column_count,
                        "foreignServer": tbl.foreign_server,
                        "remoteSchema": tbl.remote_schema,
                        "remoteTable": tbl.remote_table,
                        "foreignOptions": tbl.foreign_options,
                        "hasLineage": True,
                    }
                ))
            
            for idx, tbl in enumerate(other_tables):
                nodes.append(GraphNode(
                    id=tbl.id,
                    type="tableNode",
                    position={"x": 980.0, "y": 100.0 + (idx * 135.0)},
                    data={
                        "id": tbl.id,
                        "database": tbl.database,
                        "schema": tbl.schema_name,
                        "name": tbl.table_name,
                        "type": tbl.table_type,
                        "columnCount": tbl.column_count,
                        "foreignServer": tbl.foreign_server,
                        "remoteSchema": tbl.remote_schema,
                        "remoteTable": tbl.remote_table,
                        "foreignOptions": tbl.foreign_options,
                        "hasLineage": True,
                    }
                ))
        else:
            # Grid Layout (3 columns of 12 items max per column)
            for idx, tbl in enumerate(tables_to_render):
                grid_col = idx // 10
                grid_row = idx % 10
                
                pos_x = 100.0 + (grid_col * 380.0)
                pos_y = 100.0 + (grid_row * 135.0)
                
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
                        "columnCount": tbl.column_count,
                        "foreignServer": tbl.foreign_server,
                        "remoteSchema": tbl.remote_schema,
                        "remoteTable": tbl.remote_table,
                        "foreignOptions": tbl.foreign_options,
                        "hasLineage": tbl.id in fdw_table_ids,
                    }
                ))

        # Active edges
        active_node_ids = {n.id for n in nodes}
        all_edges = fdw_edges + view_edges
        filtered_edges = [
            e for e in all_edges 
            if e.source in active_node_ids and e.target in active_node_ids
        ]

        # Collect schemas
        schema_counts: Dict[str, int] = {}
        for t in self.tables:
            schema_counts[t.schema_name] = schema_counts.get(t.schema_name, 0) + 1

        schemas_list = [
            {"name": s, "count": count} 
            for s, count in sorted(schema_counts.items(), key=lambda x: -x[1])
        ]

        stats = {
            "totalDatabases": len(self.configured_dbs or [t.database for t in self.tables]),
            "databases": self.configured_dbs or list({t.database for t in self.tables}),
            "totalTables": len(self.tables),
            "renderedNodes": len(nodes),
            "foreignTables": sum(1 for t in self.tables if t.table_type == "FOREIGN TABLE"),
            "views": sum(1 for t in self.tables if "VIEW" in t.table_type),
            "fdwConnections": len(fdw_edges),
            "schemas": schemas_list,
            "mode": mode,
        }

        return LineageGraphResponse(nodes=nodes, edges=filtered_edges, stats=stats)
