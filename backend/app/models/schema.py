from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ColumnInfo(BaseModel):
    name: str
    data_type: str
    is_nullable: str
    ordinal_position: int

class TableInfo(BaseModel):
    id: str  # e.g., "postgres-core.public.users"
    database: str
    schema_name: str
    table_name: str
    table_type: str  # 'BASE TABLE', 'FOREIGN TABLE', 'VIEW', 'MATERIALIZED VIEW'
    columns: List[ColumnInfo] = []
    foreign_server: Optional[str] = None
    remote_schema: Optional[str] = None
    remote_table: Optional[str] = None
    foreign_options: Dict[str, str] = {}

class ForeignServerInfo(BaseModel):
    database: str
    server_name: str
    fdw_name: str
    host: Optional[str] = None
    dbname: Optional[str] = None
    port: Optional[str] = None
    options: Dict[str, str] = {}

class ViewDependency(BaseModel):
    database: str
    view_schema: str
    view_name: str
    dep_schema: str
    dep_table: str
    dep_kind: str

class HbaRule(BaseModel):
    database: str
    line_number: int
    rule_type: str
    databases: List[str]
    user_names: List[str]
    address: Optional[str] = None
    netmask: Optional[str] = None
    auth_method: str
    options: Optional[List[str]] = None
    error: Optional[str] = None

class GraphNode(BaseModel):
    id: str
    type: str  # 'tableNode', 'databaseGroup'
    position: Dict[str, float]
    data: Dict[str, Any]
    parentNode: Optional[str] = None
    extent: Optional[str] = None

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: Optional[str] = "smoothstep"
    animated: Optional[bool] = False
    label: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    style: Optional[Dict[str, Any]] = None

class LineageGraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    stats: Dict[str, Any]
