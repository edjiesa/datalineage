from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from app.config import DBConfig, load_databases, save_databases
from app.extractor.db_client import PostgresClient
from app.extractor.fdw_scanner import FDWScanner
from app.extractor.hba_scanner import HbaScanner
from app.graph.graph_builder import GraphBuilder
from app.models.schema import (
    LineageGraphResponse, ForeignServerInfo, HbaRule, TableInfo
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# In-memory dictionary of databases synced with config/databases.json
configured_databases: Dict[str, DBConfig] = {
    db.name: db for db in load_databases()
}

def sync_to_disk():
    save_databases(list(configured_databases.values()))

@router.get("/health")
def health_check():
    return {
        "status": "ok", 
        "service": "postgres-data-lineage-backend",
        "configured_databases": len(configured_databases)
    }

@router.get("/databases")
def list_databases():
    """List configured databases and their connectivity status"""
    results = []
    for name, db_cfg in configured_databases.items():
        client = PostgresClient(db_cfg)
        is_online = client.test_connection()
        results.append({
            "name": name,
            "host": db_cfg.host,
            "port": db_cfg.port,
            "dbname": db_cfg.dbname,
            "user": db_cfg.user,
            "is_online": is_online
        })
    return results

@router.post("/databases/test")
def test_db_connection(db: DBConfig):
    """Test connecting to a database without saving it"""
    client = PostgresClient(db)
    try:
        with client.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                ver = cur.fetchone()[0]
                return {"success": True, "version": ver}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/databases")
def add_database(db: DBConfig):
    """Add or update a database configuration and persist to disk"""
    configured_databases[db.name] = db
    sync_to_disk()
    
    client = PostgresClient(db)
    is_online = client.test_connection()
    return {
        "message": f"Database '{db.name}' saved successfully", 
        "is_online": is_online
    }

@router.delete("/databases/{name}")
def delete_database(name: str):
    """Delete a database configuration and persist to disk"""
    if name in configured_databases:
        del configured_databases[name]
        sync_to_disk()
        return {"message": f"Database '{name}' removed"}
    raise HTTPException(status_code=404, detail="Database not found")

@router.get("/lineage/graph", response_model=LineageGraphResponse)
def get_lineage_graph():
    """Scan all active databases and return React Flow nodes & edges"""
    all_tables: List[TableInfo] = []
    all_servers: List[ForeignServerInfo] = []
    all_deps = []

    for name, db_cfg in configured_databases.items():
        client = PostgresClient(db_cfg)
        if not client.test_connection():
            logger.warning(f"Database {name} is unreachable. Skipping scan.")
            continue
        
        scanner = FDWScanner(client)
        all_servers.extend(scanner.scan_foreign_servers())
        all_tables.extend(scanner.scan_tables_and_views())
        all_deps.extend(scanner.scan_view_dependencies())

    configured_db_list = list(configured_databases.keys())
    builder = GraphBuilder(all_tables, all_servers, all_deps, configured_db_list)
    return builder.build_lineage_graph()

@router.get("/lineage/servers", response_model=List[ForeignServerInfo])
def get_foreign_servers():
    """Get all foreign servers declared across databases"""
    servers: List[ForeignServerInfo] = []
    for name, db_cfg in configured_databases.items():
        client = PostgresClient(db_cfg)
        if client.test_connection():
            scanner = FDWScanner(client)
            servers.extend(scanner.scan_foreign_servers())
    return servers

@router.get("/lineage/hba", response_model=List[HbaRule])
def get_hba_rules():
    """Get pg_hba rules from all active databases"""
    rules: List[HbaRule] = []
    for name, db_cfg in configured_databases.items():
        client = PostgresClient(db_cfg)
        if client.test_connection():
            hba_scanner = HbaScanner(client)
            rules.extend(hba_scanner.scan_rules())
    return rules
