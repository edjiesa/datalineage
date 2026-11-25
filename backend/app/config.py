import os
import json
import logging
from pydantic import BaseModel
from typing import List, Optional

logger = logging.getLogger(__name__)

class DBConfig(BaseModel):
    name: str
    host: str
    port: int = 5432
    dbname: str
    user: str
    password: str

CONFIG_FILE_PATH = os.getenv("CONFIG_FILE", "config/databases.json")

def _get_config_path() -> str:
    # If running inside docker container or local dev
    if os.path.exists(CONFIG_FILE_PATH):
        return CONFIG_FILE_PATH
    # Check parent directory fallback for local execution
    alt_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "config", "databases.json")
    if os.path.exists(alt_path):
        return alt_path
    return CONFIG_FILE_PATH

def load_databases() -> List[DBConfig]:
    """Load user's configured databases from config/databases.json or environment"""
    path = _get_config_path()
    databases = []
    
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    for item in data:
                        databases.append(DBConfig(**item))
            logger.info(f"Loaded {len(databases)} database configurations from {path}")
        except Exception as e:
            logger.error(f"Failed to read database configuration from {path}: {e}")

    # Fallback to single database from ENV if config is empty
    env_host = os.getenv("PG_HOST")
    if not databases and env_host:
        databases.append(DBConfig(
            name=os.getenv("PG_NAME", "my-postgres"),
            host=env_host,
            port=int(os.getenv("PG_PORT", "5432")),
            dbname=os.getenv("PG_DBNAME", "postgres"),
            user=os.getenv("PG_USER", "postgres"),
            password=os.getenv("PG_PASSWORD", ""),
        ))

    return databases

def save_databases(databases: List[DBConfig]) -> bool:
    """Save database configurations to JSON file"""
    path = _get_config_path()
    try:
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump([db.model_dump() for db in databases], f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Failed to write database configurations to {path}: {e}")
        return False
