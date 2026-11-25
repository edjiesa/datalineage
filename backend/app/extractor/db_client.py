import psycopg2
from psycopg2.extras import RealDictCursor
import logging
import time
from typing import List, Dict, Any, Optional
from app.config import DBConfig

logger = logging.getLogger(__name__)

class PostgresClient:
    def __init__(self, config: DBConfig):
        self.config = config

    def get_connection(self):
        return psycopg2.connect(
            host=self.config.host,
            port=self.config.port,
            dbname=self.config.dbname,
            user=self.config.user,
            password=self.config.password,
            connect_timeout=5
        )

    def test_connection(self) -> bool:
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    return True
        except Exception as e:
            logger.warning(f"Connection test failed for {self.config.name} ({self.config.host}:{self.config.port}): {e}")
            return False

    def execute_query(self, query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        try:
            with self.get_connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(query, params or ())
                    return [dict(row) for row in cur.fetchall()]
        except Exception as e:
            logger.error(f"Error querying {self.config.name}: {e}")
            return []
