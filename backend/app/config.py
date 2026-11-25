import os
from pydantic import BaseModel
from typing import List

class DBConfig(BaseModel):
    name: str
    host: str
    port: int
    dbname: str
    user: str
    password: str

def get_default_databases() -> List[DBConfig]:
    """Default demo databases in the docker network"""
    return [
        DBConfig(
            name="postgres-core",
            host=os.getenv("CORE_DB_HOST", "postgres-core"),
            port=int(os.getenv("CORE_DB_PORT", "5432")),
            dbname=os.getenv("CORE_DB_NAME", "core_db"),
            user=os.getenv("CORE_DB_USER", "postgres"),
            password=os.getenv("CORE_DB_PASSWORD", "postgres123"),
        ),
        DBConfig(
            name="postgres-logistics",
            host=os.getenv("LOGISTICS_DB_HOST", "postgres-logistics"),
            port=int(os.getenv("LOGISTICS_DB_PORT", "5432")),
            dbname=os.getenv("LOGISTICS_DB_NAME", "logistics_db"),
            user=os.getenv("LOGISTICS_DB_USER", "postgres"),
            password=os.getenv("LOGISTICS_DB_PASSWORD", "postgres123"),
        ),
        DBConfig(
            name="postgres-analytics",
            host=os.getenv("ANALYTICS_DB_HOST", "postgres-analytics"),
            port=int(os.getenv("ANALYTICS_DB_PORT", "5432")),
            dbname=os.getenv("ANALYTICS_DB_NAME", "analytics_db"),
            user=os.getenv("ANALYTICS_DB_USER", "postgres"),
            password=os.getenv("ANALYTICS_DB_PASSWORD", "postgres123"),
        ),
    ]
