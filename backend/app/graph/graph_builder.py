from typing import List, Dict, Any, Optional, Set
from app.models.schema import (
    TableInfo, ForeignServerInfo, ViewDependency, 
    GraphNode, GraphEdge, LineageGraphResponse,
    RoutineInfo, ColumnDependency
)
import logging

logger = logging.getLogger(__name__)

class GraphBuilder:
    def __init__(
        self, 
        all_tables: List[TableInfo], 
        all_servers: List[ForeignServerInfo], 
        all_deps: List[ViewDependency],
        configured_dbs: Optional[List[str]] = None,
        all_routines: Optional[List[RoutineInfo]] = None,
        all_col_deps: Optional[List[ColumnDependency]] = None
    ):
        self.tables = all_tables
        self.servers = all_servers
        self.deps = all_deps
        self.configured_dbs = configured_dbs or []
        self.routines = all_routines or []
        self.col_deps = all_col_deps or []

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
        mode: str = "fdw",  # "fdw", "views", "all"
        schema_filter: Optional[str] = None,
        search_query: Optional[str] = None,
        selected_view: Optional[str] = None,
        granularity: str = "object"  # "object" or "column" (CLL)
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
                        "columns": [],
                        "foreignServer": target_table.foreign_server,
                        "remoteSchema": None,
                        "remoteTable": None,
                        "foreignOptions": {},
                        "sqlDefinition": None,
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

        # 3. Map column-level dependencies: (view_id) -> list of ColumnDependency
        view_to_col_deps: Dict[str, List[ColumnDependency]] = {}
        for cd in self.col_deps:
            v_id = f"{cd.database}.{cd.view_schema}.{cd.view_name}"
            if v_id not in view_to_col_deps:
                view_to_col_deps[v_id] = []
            view_to_col_deps[v_id].append(cd)

        # 4. Determine nodes & layout based on MODE
        nodes: List[GraphNode] = []
        edges: List[GraphEdge] = []

        # Card height spacing: column mode needs more vertical space
        y_step = 230.0 if granularity == "column" else 140.0

        if mode == "fdw":
            # ---------------------------------------------------------------
            # MODE FDW: Remote Sources (X=80) -> Foreign Tables (X=560)
            # ---------------------------------------------------------------
            foreign_tables = [t for t in self.tables if t.table_type == "FOREIGN TABLE"]

            # Filter if search query specified
            if search_query and search_query.strip():
                q = search_query.lower()
                foreign_tables = [t for t in foreign_tables if q in t.table_name.lower() or q in (t.foreign_server or "").lower()]

            for idx, (ext_id, ext_data) in enumerate(remote_stub_nodes.items()):
                nodes.append(GraphNode(
                    id=ext_id,
                    type="tableNode",
                    position={"x": 80.0, "y": 80.0 + (idx * y_step)},
                    data={
                        **ext_data, 
                        "hasLineage": True,
                        "granularity": granularity,
                        "inflows": [],
                        "outflows": [t.id for t in foreign_tables if t.foreign_server == ext_data.get("foreignServer")]
                    }
                ))

            for idx, tbl in enumerate(foreign_tables):
                cols_formatted = [
                    {"name": c.name, "dataType": c.data_type, "isNullable": c.is_nullable, "ordinalPosition": c.ordinal_position}
                    for c in tbl.columns
                ]
                nodes.append(GraphNode(
                    id=tbl.id,
                    type="tableNode",
                    position={"x": 560.0, "y": 80.0 + (idx * y_step)},
                    data={
                        "id": tbl.id,
                        "database": tbl.database,
                        "schema": tbl.schema_name,
                        "name": tbl.table_name,
                        "type": tbl.table_type,
                        "columnCount": tbl.column_count,
                        "columns": cols_formatted,
                        "foreignServer": tbl.foreign_server,
                        "remoteSchema": tbl.remote_schema,
                        "remoteTable": tbl.remote_table,
                        "foreignOptions": tbl.foreign_options,
                        "sqlDefinition": tbl.sql_definition,
                        "hasLineage": True,
                        "granularity": granularity,
                        "inflows": [e.source for e in fdw_edges if e.target == tbl.id],
                        "outflows": []
                    }
                ))
            edges = fdw_edges

        elif mode == "views":
            # ---------------------------------------------------------------
            # MODE VIEWS: Source Tables (X=80) -> [Procedures (X=540)] -> Views (X=980)
            # ---------------------------------------------------------------
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

            # Cap max views rendered at once to 35 for smooth DOM rendering
            views_to_show = views_to_show[:35]

            # Collect source tables needed by these views
            source_table_ids: Set[str] = set()
            for v in views_to_show:
                deps_for_v = view_to_deps.get(v.id, set())
                source_table_ids.update(deps_for_v)

            source_tables = [table_id_lookup[tid] for tid in source_table_ids if tid in table_id_lookup]

            # Collect routines/procedures that might be related
            related_routines: List[RoutineInfo] = []
            for r in self.routines:
                # If routine mentions any active view or source table in its definition
                if r.sql_definition:
                    r_def_lower = r.sql_definition.lower()
                    if any(v.table_name.lower() in r_def_lower for v in views_to_show) or any(st.table_name.lower() in r_def_lower for st in source_tables):
                        related_routines.append(r)
            related_routines = related_routines[:10]

            # Calculate horizontal positions:
            has_processors = len(related_routines) > 0
            x_source = 80.0
            x_proc = 540.0 if has_processors else 80.0
            x_view = 980.0 if has_processors else 640.0

            # 1. Render Source Tables (Left)
            for idx, tbl in enumerate(source_tables):
                cols_formatted = [
                    {"name": c.name, "dataType": c.data_type, "isNullable": c.is_nullable, "ordinalPosition": c.ordinal_position}
                    for c in tbl.columns
                ]
                # Downstream targets
                outflows = [v.id for v in views_to_show if tbl.id in view_to_deps.get(v.id, set())]
                nodes.append(GraphNode(
                    id=tbl.id,
                    type="tableNode",
                    position={"x": x_source, "y": 80.0 + (idx * y_step)},
                    data={
                        "id": tbl.id,
                        "database": tbl.database,
                        "schema": tbl.schema_name,
                        "name": tbl.table_name,
                        "type": tbl.table_type,
                        "columnCount": tbl.column_count,
                        "columns": cols_formatted,
                        "foreignServer": tbl.foreign_server,
                        "remoteSchema": tbl.remote_schema,
                        "remoteTable": tbl.remote_table,
                        "foreignOptions": tbl.foreign_options,
                        "sqlDefinition": tbl.sql_definition,
                        "hasLineage": True,
                        "granularity": granularity,
                        "inflows": [],
                        "outflows": outflows
                    }
                ))

            # 2. Render Stored Procedures / Functions as Processors (Middle)
            for idx, routine in enumerate(related_routines):
                nodes.append(GraphNode(
                    id=routine.id,
                    type="procedureNode",
                    position={"x": x_proc, "y": 80.0 + (idx * 160.0)},
                    data={
                        "id": routine.id,
                        "database": routine.database,
                        "schema": routine.schema_name,
                        "name": routine.routine_name,
                        "type": routine.routine_type,
                        "arguments": routine.arguments,
                        "returnType": routine.return_type,
                        "sqlDefinition": routine.sql_definition,
                        "hasLineage": True,
                        "granularity": granularity,
                        "inflows": [st.id for st in source_tables if st.table_name.lower() in (routine.sql_definition or "").lower()],
                        "outflows": [v.id for v in views_to_show if v.table_name.lower() in (routine.sql_definition or "").lower()]
                    }
                ))

            # 3. Render Views (Right)
            for idx, v in enumerate(views_to_show):
                cols_formatted = [
                    {"name": c.name, "dataType": c.data_type, "isNullable": c.is_nullable, "ordinalPosition": c.ordinal_position}
                    for c in v.columns
                ]
                inflows = [s_id for s_id in view_to_deps.get(v.id, set()) if s_id in table_id_lookup]
                nodes.append(GraphNode(
                    id=v.id,
                    type="tableNode",
                    position={"x": x_view, "y": 80.0 + (idx * y_step)},
                    data={
                        "id": v.id,
                        "database": v.database,
                        "schema": v.schema_name,
                        "name": v.table_name,
                        "type": v.table_type,
                        "columnCount": v.column_count,
                        "columns": cols_formatted,
                        "foreignServer": None,
                        "remoteSchema": None,
                        "remoteTable": None,
                        "foreignOptions": {},
                        "sqlDefinition": v.sql_definition,
                        "hasLineage": True,
                        "granularity": granularity,
                        "inflows": inflows,
                        "outflows": []
                    }
                ))

            # 4. Build Edges (Object-Level vs Column-Level CLL)
            active_node_ids = {n.id for n in nodes}

            if granularity == "column":
                # -----------------------------------------------------------
                # COLUMN-LEVEL LINEAGE (CLL) EDGES
                # Connects col-<source_column> to col-<view_column>
                # -----------------------------------------------------------
                for v in views_to_show:
                    c_deps = view_to_col_deps.get(v.id, [])
                    created_col_edges: Set[str] = set()

                    # A. Use explicit view_column_usage dependencies
                    for cd in c_deps:
                        s_id = f"{cd.database}.{cd.source_schema}.{cd.source_table}"
                        if s_id in active_node_ids:
                            target_col = cd.view_column or cd.source_column
                            edge_key = f"{s_id}:{cd.source_column}__to__{v.id}:{target_col}"
                            if edge_key not in created_col_edges:
                                created_col_edges.add(edge_key)
                                edges.append(GraphEdge(
                                    id=f"cll_{edge_key}",
                                    source=s_id,
                                    target=v.id,
                                    sourceHandle=f"col-{cd.source_column}",
                                    targetHandle=f"col-{target_col}",
                                    type="smoothstep",
                                    animated=True,
                                    label=f"{cd.source_column} ➔ {target_col}",
                                    data={
                                        "relationship": "COLUMN_FLOW",
                                        "sourceColumn": cd.source_column,
                                        "targetColumn": target_col,
                                    },
                                    style={"stroke": "#a855f7", "strokeWidth": 2}
                                ))

                    # B. Fallback / Complement: If no explicit column usage, auto-match by identical column names
                    if len(created_col_edges) == 0:
                        deps_for_v = view_to_deps.get(v.id, set())
                        for s_id in deps_for_v:
                            if s_id in active_node_ids and s_id in table_id_lookup:
                                src_tbl = table_id_lookup[s_id]
                                src_col_names = {c.name: c for c in src_tbl.columns}
                                for vc in v.columns:
                                    if vc.name in src_col_names:
                                        edge_key = f"{s_id}:{vc.name}__to__{v.id}:{vc.name}"
                                        if edge_key not in created_col_edges:
                                            created_col_edges.add(edge_key)
                                            edges.append(GraphEdge(
                                                id=f"cll_{edge_key}",
                                                source=s_id,
                                                target=v.id,
                                                sourceHandle=f"col-{vc.name}",
                                                targetHandle=f"col-{vc.name}",
                                                type="smoothstep",
                                                animated=True,
                                                label=f"{vc.name} ➔ {vc.name}",
                                                data={
                                                    "relationship": "COLUMN_FLOW",
                                                    "sourceColumn": vc.name,
                                                    "targetColumn": vc.name,
                                                },
                                                style={"stroke": "#a855f7", "strokeWidth": 2}
                                            ))

                    # C. If still no column connections, fallback gracefully to object-level edge
                    if len(created_col_edges) == 0:
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
            else:
                # -----------------------------------------------------------
                # OBJECT-LEVEL LINEAGE EDGES
                # Connects source node to target view node directly
                # -----------------------------------------------------------
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

            # Connect Processors/Routines edges
            for r in related_routines:
                r_inflows = [st.id for st in source_tables if st.table_name.lower() in (r.sql_definition or "").lower()]
                for s_id in r_inflows:
                    if s_id in active_node_ids:
                        edges.append(GraphEdge(
                            id=f"edge_proc_in_{s_id}__to__{r.id}",
                            source=s_id,
                            target=r.id,
                            type="smoothstep",
                            animated=True,
                            label="reads data",
                            data={"relationship": "PROCEDURE_READS"},
                            style={"stroke": "#f59e0b", "strokeWidth": 2, "strokeDasharray": "4,4"}
                        ))
                r_outflows = [v.id for v in views_to_show if v.table_name.lower() in (r.sql_definition or "").lower()]
                for v_id in r_outflows:
                    if v_id in active_node_ids:
                        edges.append(GraphEdge(
                            id=f"edge_proc_out_{r.id}__to__{v_id}",
                            source=r.id,
                            target=v_id,
                            type="smoothstep",
                            animated=True,
                            label="processes into",
                            data={"relationship": "PROCEDURE_POPULATES"},
                            style={"stroke": "#f59e0b", "strokeWidth": 2}
                        ))

        else: # mode == "all"
            # ---------------------------------------------------------------
            # MODE ALL / SEARCH: Grid layout (max 50 objects)
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
                cols_formatted = [
                    {"name": c.name, "dataType": c.data_type, "isNullable": c.is_nullable, "ordinalPosition": c.ordinal_position}
                    for c in tbl.columns
                ]
                nodes.append(GraphNode(
                    id=tbl.id,
                    type="tableNode",
                    position={"x": 100.0 + (grid_col * 380.0), "y": 80.0 + (grid_row * y_step)},
                    data={
                        "id": tbl.id,
                        "database": tbl.database,
                        "schema": tbl.schema_name,
                        "name": tbl.table_name,
                        "type": tbl.table_type,
                        "columnCount": tbl.column_count,
                        "columns": cols_formatted,
                        "foreignServer": tbl.foreign_server,
                        "remoteSchema": tbl.remote_schema,
                        "remoteTable": tbl.remote_table,
                        "foreignOptions": tbl.foreign_options,
                        "sqlDefinition": tbl.sql_definition,
                        "hasLineage": tbl.id in fdw_table_ids or tbl.id in view_to_deps,
                        "granularity": granularity,
                        "inflows": [],
                        "outflows": []
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
            "procedures": len(self.routines),
            "fdwConnections": len(fdw_edges),
            "schemas": schemas_list,
            "viewsList": views_list,
            "mode": mode,
            "granularity": granularity,
        }

        return LineageGraphResponse(nodes=nodes, edges=edges, stats=stats)
