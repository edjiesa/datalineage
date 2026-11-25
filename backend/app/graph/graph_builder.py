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
        search_query: Optional[str] = None,
        selected_view: Optional[str] = None
    ) -> LineageGraphResponse:
        table_id_lookup = {t.id: t for t in self.tables}
        all_views = [t for t in self.tables if "VIEW" in t.table_type]
        
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

        # 2. Map view dependencies: view_id -> set of source table_ids
        view_to_deps: Dict[str, Set[str]] = {}
        for dep in self.deps:
            s_id = f"{dep.database}.{dep.dep_schema}.{dep.dep_table}"
            v_id = f"{dep.database}.{dep.view_schema}.{dep.view_name}"
            if v_id not in view_to_deps:
                view_to_deps[v_id] = set()
            view_to_deps[v_id].add(s_id)

        # 3. Determine nodes & layout based on MODE
        nodes: List[GraphNode] = []
        edges: List[GraphEdge] = []

        if mode == "fdw":
            # ---------------------------------------------------------------
            # MODE FDW: Remote Sources (X=60) -> Foreign Tables (X=520)
            # ---------------------------------------------------------------
            for idx, (ext_id, ext_data) in enumerate(remote_stub_nodes.items()):
                nodes.append(GraphNode(
                    id=ext_id,
                    type="tableNode",
                    position={"x": 60.0, "y": 100.0 + (idx * 135.0)},
                    data={**ext_data, "hasLineage": True}
                ))

            foreign_tables = [t for t in self.tables if t.table_type == "FOREIGN TABLE"]
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
            edges = fdw_edges

        elif mode == "views":
            # ---------------------------------------------------------------
            # MODE VIEWS: Source Tables (X=80) -> Views (X=620)
            # ---------------------------------------------------------------
            # Filter views if search query or selected_view specified
            views_to_show: List[TableInfo] = []
            for v in all_views:
                if selected_view and selected_view != "ALL":
                    if v.table_name == selected_view or v.id == selected_view:
                        views_to_show.append(v)
                elif search_query and search_query.strip():
                    if search_query.lower() in v.table_name.lower():
                        views_to_show.append(v)
                else:
                    views_to_show.append(v)

            # Cap max views rendered at once to 40 to avoid lag
            views_to_show = views_to_show[:40]

            # Collect source tables needed by these views
            source_table_ids: Set[str] = set()
            for v in views_to_show:
                deps_for_v = view_to_deps.get(v.id, set())
                source_table_ids.update(deps_for_v)

            source_tables = [table_id_lookup[tid] for tid in source_table_ids if tid in table_id_lookup]

            # Position Source Tables on Left (X = 80)
            for idx, tbl in enumerate(source_tables):
                nodes.append(GraphNode(
                    id=tbl.id,
                    type="tableNode",
                    position={"x": 80.0, "y": 100.0 + (idx * 135.0)},
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

            # Position Views on Right (X = 620)
            for idx, v in enumerate(views_to_show):
                nodes.append(GraphNode(
                    id=v.id,
                    type="tableNode",
                    position={"x": 620.0, "y": 100.0 + (idx * 135.0)},
                    data={
                        "id": v.id,
                        "database": v.database,
                        "schema": v.schema_name,
                        "name": v.table_name,
                        "type": v.table_type,
                        "columnCount": v.column_count,
                        "foreignServer": None,
                        "remoteSchema": None,
                        "remoteTable": None,
                        "foreignOptions": {},
                        "hasLineage": True,
                    }
                ))

            # Build View Edges
            active_node_ids = {n.id for n in nodes}
            for v in views_to_show:
                deps_for_v = view_to_deps.get(v.id, set())
                for s_id in deps_for_v:
                    if s_id in active_node_ids:
                        edges.append(GraphEdge(
                            id=f"edge_view_{s_id}__to__{v.id}",
                            source=s_id,
                            target=v.id,
                            type="smoothstep",
                            animated=False,
                            label="view dependency",
                            data={"relationship": "VIEW_DEPENDS_ON"},
                            style={"stroke": "#8b5cf6", "strokeWidth": 2, "strokeDasharray": "5,5"}
                        ))

        else: # mode == "all"
            # ---------------------------------------------------------------
            # MODE ALL / SEARCH: Grid layout (3 columns, max 50 tables)
            # ---------------------------------------------------------------
            matching_tables: List[TableInfo] = []
            for t in self.tables:
                if schema_filter and schema_filter != "ALL" and t.schema_name != schema_filter:
                    continue
                if search_query and search_query.strip():
                    q = search_query.lower()
                    if q not in t.table_name.lower() and q not in t.schema_name.lower():
                        continue
                matching_tables.append(t)
                if len(matching_tables) >= 50:
                    break

            for idx, tbl in enumerate(matching_tables):
                grid_col = idx // 10
                grid_row = idx % 10
                nodes.append(GraphNode(
                    id=tbl.id,
                    type="tableNode",
                    position={"x": 100.0 + (grid_col * 380.0), "y": 100.0 + (grid_row * 135.0)},
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

        # Collect schemas
        schema_counts: Dict[str, int] = {}
        for t in self.tables:
            schema_counts[t.schema_name] = schema_counts.get(t.schema_name, 0) + 1

        schemas_list = [
            {"name": s, "count": count} 
            for s, count in sorted(schema_counts.items(), key=lambda x: -x[1])
        ]

        # Collect views list for dropdown in frontend
        views_list = [
            {"id": v.id, "schema": v.schema_name, "name": v.table_name}
            for v in all_views
        ]

        stats = {
            "totalDatabases": len(self.configured_dbs or [t.database for t in self.tables]),
            "databases": self.configured_dbs or list({t.database for t in self.tables}),
            "totalTables": len(self.tables),
            "renderedNodes": len(nodes),
            "foreignTables": sum(1 for t in self.tables if t.table_type == "FOREIGN TABLE"),
            "views": len(all_views),
            "fdwConnections": len(fdw_edges),
            "schemas": schemas_list,
            "viewsList": views_list,
            "mode": mode,
        }

        return LineageGraphResponse(nodes=nodes, edges=edges, stats=stats)
