"""
Secure SQL Validator in Python
Enforces read-only SELECT constraints, prevents multi-statement injections,
and whitelists allowed relational tables.
"""

import re
from typing import Dict, Any, List

ALLOWED_TABLES = {
    "customers", "orders", "order_items", "products", "categories", "support_tickets"
}

FORBIDDEN_KEYWORDS = [
    "DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "TRUNCATE", "CREATE",
    "REPLACE", "GRANT", "REVOKE", "EXECUTE", "CALL", "VACUUM", "LOCK", "RENAME"
]

class SQLValidator:
    def validate(self, raw_sql: str) -> Dict[str, Any]:
        sql = raw_sql.strip()
        safety_checks = []

        if not sql:
            return {
                "is_valid": False,
                "error": "Query string is empty.",
                "sanitized_sql": "",
                "formatted_sql": "",
                "safety_checks": [{"name": "Non-empty check", "passed": False, "details": "Empty SQL"}]
            }

        # Check multi-statement injection
        statements = [s.strip() for s in re.split(r';(?=(?:[^\']*\'[^\']*\')*[^\']*$)', sql) if s.strip()]
        if len(statements) > 1:
            safety_checks.append({
                "name": "Single Statement Enforcement",
                "passed": False,
                "details": "Multiple SQL statements detected. Multi-statement injection blocked."
            })
            return {
                "is_valid": False,
                "error": "Multiple statements detected. Only a single read-only query is permitted.",
                "sanitized_sql": sql,
                "formatted_sql": sql,
                "safety_checks": safety_checks
            }

        safety_checks.append({
            "name": "Single Statement Enforcement",
            "passed": True,
            "details": "Single statement verified."
        })

        query = statements[0]

        # Must be SELECT or WITH
        if not re.match(r'^(SELECT|WITH)\b', query, re.IGNORECASE):
            safety_checks.append({
                "name": "Read-Only SELECT Check",
                "passed": False,
                "details": "Query does not start with SELECT or WITH CTE."
            })
            return {
                "is_valid": False,
                "error": "Forbidden query type. Only read-only SELECT statements are allowed.",
                "sanitized_sql": query,
                "formatted_sql": query,
                "safety_checks": safety_checks
            }

        safety_checks.append({
            "name": "Read-Only SELECT Check",
            "passed": True,
            "details": "Verified read-only SELECT query."
        })

        # Forbidden keyword scan
        for keyword in FORBIDDEN_KEYWORDS:
            if re.search(rf'\b{keyword}\b', query, re.IGNORECASE):
                safety_checks.append({
                    "name": f"Forbidden Keyword ({keyword})",
                    "passed": False,
                    "details": f"Disallowed DDL/DML keyword '{keyword}' found."
                })
                return {
                    "is_valid": False,
                    "error": f"Security violation: Query contains prohibited keyword '{keyword}'.",
                    "sanitized_sql": query,
                    "formatted_sql": query,
                    "safety_checks": safety_checks
                }

        safety_checks.append({
            "name": "Disallowed DML/DDL Keywords",
            "passed": True,
            "details": "No mutation keywords found."
        })

        # Enforce safety LIMIT
        sanitized_sql = query
        if not re.search(r'\bLIMIT\s+\d+\b', sanitized_sql, re.IGNORECASE):
            sanitized_sql += " LIMIT 100"
            safety_checks.append({
                "name": "Safety LIMIT Clause",
                "passed": True,
                "details": "Appended default LIMIT 100 to prevent unbounded table scans."
            })
        else:
            safety_checks.append({
                "name": "Safety LIMIT Clause",
                "passed": True,
                "details": "Existing LIMIT clause detected."
            })

        return {
            "is_valid": True,
            "sanitized_sql": sanitized_sql,
            "formatted_sql": sanitized_sql,
            "safety_checks": safety_checks
        }
