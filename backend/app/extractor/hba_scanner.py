from typing import List
from app.extractor.db_client import PostgresClient
from app.models.schema import HbaRule
import logging

logger = logging.getLogger(__name__)

class HbaScanner:
    def __init__(self, client: PostgresClient):
        self.client = client
        self.db_name = client.config.name

    def scan_rules(self) -> List[HbaRule]:
        """Scan pg_hba_file_rules view in PostgreSQL 10+"""
        query = """
        SELECT 
            line_number,
            type AS rule_type,
            database AS databases,
            user_name AS user_names,
            address,
            netmask,
            auth_method,
            options,
            error
        FROM pg_hba_file_rules
        ORDER BY line_number;
        """
        rows = self.client.execute_query(query)
        rules = []
        for r in rows:
            rules.append(HbaRule(
                database=self.db_name,
                line_number=r.get("line_number") or 0,
                rule_type=r.get("rule_type") or "host",
                databases=list(r.get("databases") or []),
                user_names=list(r.get("user_names") or []),
                address=r.get("address"),
                netmask=r.get("netmask"),
                auth_method=r.get("auth_method") or "trust",
                options=list(r.get("options") or []) if r.get("options") else None,
                error=r.get("error")
            ))
        return rules
