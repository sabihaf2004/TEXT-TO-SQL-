"""
Clarification Engine for FastAPI
Detects semantic ambiguity, manages conversational follow-ups,
and prompts clarifying questions with structured options.
"""

import os
import re
from typing import Dict, Any, List, Optional

class ClarificationEngine:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")

    async def analyze(
        self,
        user_query: str,
        history: List[Dict[str, Any]] = None,
        selected_clarification: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        clean_query = user_query.strip().lower()

        # If user explicitly selected a clarification option
        if selected_clarification:
            return {
                "isAmbiguous": False,
                "ambiguityScore": 0.05,
                "ambiguityType": "none",
                "detectedAmbiguousTokens": [],
                "explanation": f"Clarification applied: {selected_clarification.get('optionLabel') or selected_clarification.get('optionId')}.",
                "resolvedIntent": f"Query '{user_query}' clarified with: {selected_clarification.get('optionLabel')}"
            }

        # Rule 1: 'Best customers' ambiguity
        if re.search(r'\b(best|top|valuable|vip)\s+(customers?|clients?|users?)\b', clean_query):
            return {
                "isAmbiguous": True,
                "ambiguityScore": 0.88,
                "ambiguityType": "metric_definition",
                "detectedAmbiguousTokens": ["best customers"],
                "explanation": "'Best customers' is subjective and could mean highest lifetime spend, highest order count, or highest average order value.",
                "clarifyingQuestion": "How would you like to define 'best customers'?",
                "options": [
                    {
                        "id": "total_spend",
                        "label": "Lifetime Spend (Total Revenue)",
                        "description": "Rank by total completed order amount (SUM of total_amount)",
                        "sqlHint": "SUM(orders.total_amount) DESC"
                    },
                    {
                        "id": "order_count",
                        "label": "Order Frequency (Loyalty)",
                        "description": "Rank by number of completed orders (COUNT of orders)",
                        "sqlHint": "COUNT(orders.id) DESC"
                    },
                    {
                        "id": "aov",
                        "label": "Average Order Value (AOV)",
                        "description": "Rank by average transaction amount (AVG of total_amount)",
                        "sqlHint": "AVG(orders.total_amount) DESC"
                    },
                    {
                        "id": "recent_high_spend",
                        "label": "Active 2024 High Spenders",
                        "description": "Customers with highest spend in calendar year 2024",
                        "sqlHint": "order_date >= '2024-01-01' ORDER BY SUM(total_amount) DESC"
                    }
                ]
            }

        # Rule 2: 'Top products' ambiguity
        if re.search(r'\b(top|popular|hottest|best)\s+products?\b', clean_query):
            return {
                "isAmbiguous": True,
                "ambiguityScore": 0.82,
                "ambiguityType": "metric_definition",
                "detectedAmbiguousTokens": ["top products"],
                "explanation": "'Top products' can be ranked by units sold, total gross revenue, or profit margins.",
                "clarifyingQuestion": "How should we rank 'top products'?",
                "options": [
                    {
                        "id": "product_revenue",
                        "label": "Gross Revenue Generated",
                        "description": "Rank by total revenue (quantity * unit_price)",
                        "sqlHint": "SUM(order_items.quantity * order_items.unit_price) DESC"
                    },
                    {
                        "id": "units_sold",
                        "label": "Sales Volume (Units Sold)",
                        "description": "Rank by total quantity of items sold",
                        "sqlHint": "SUM(order_items.quantity) DESC"
                    },
                    {
                        "id": "profit_margin",
                        "label": "Gross Profit Margin",
                        "description": "Rank by profit ((unit_price - cost) * quantity)",
                        "sqlHint": "SUM((oi.unit_price - p.cost) * oi.quantity) DESC"
                    }
                ]
            }

        # Rule 3: 'Low stock' ambiguity
        if re.search(r'\b(low\s*stock|reorder|out\s*of\s*stock)\b', clean_query):
            return {
                "isAmbiguous": True,
                "ambiguityScore": 0.78,
                "ambiguityType": "threshold",
                "detectedAmbiguousTokens": ["low stock"],
                "explanation": "Low stock can be defined against the product's defined reorder level or an absolute threshold.",
                "clarifyingQuestion": "How would you like to define low stock?",
                "options": [
                    {
                        "id": "below_reorder_level",
                        "label": "Below Catalog Reorder Level",
                        "description": "Products where stock_quantity <= reorder_level",
                        "sqlHint": "stock_quantity <= reorder_level"
                    },
                    {
                        "id": "critically_low_10",
                        "label": "Critical Inventory (< 10 units)",
                        "description": "Products with strictly fewer than 10 units in stock",
                        "sqlHint": "stock_quantity < 10"
                    }
                ]
            }

        # Clear intent
        return {
            "isAmbiguous": False,
            "ambiguityScore": 0.1,
            "ambiguityType": "none",
            "detectedAmbiguousTokens": [],
            "explanation": "Query intent is clear and directly executable.",
            "resolvedIntent": user_query
        }

    async def generate_sql(
        self,
        user_query: str,
        clarification_context: Optional[Dict[str, Any]] = None,
        history: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        opt_id = clarification_context.get("optionId", "") if clarification_context else ""
        query_lower = user_query.lower()

        if "best customer" in query_lower or "top customer" in query_lower:
            if opt_id == "order_count":
                sql = """
                SELECT 
                  c.id AS customer_id,
                  c.name AS customer_name,
                  c.segment,
                  c.country,
                  COUNT(o.id) AS completed_orders,
                  SUM(o.total_amount) AS total_spend
                FROM customers c
                JOIN orders o ON c.id = o.customer_id
                WHERE o.status = 'completed'
                GROUP BY c.id, c.name, c.segment, c.country
                ORDER BY completed_orders DESC, total_spend DESC
                LIMIT 10;
                """.strip()
                return {
                    "raw_sql": sql,
                    "explanation": "Identified top customers ranked by count of completed orders.",
                    "assumptions": ["Filtered for status = 'completed'", "Ranked by completed_orders DESC"]
                }
            elif opt_id == "aov":
                sql = """
                SELECT 
                  c.id AS customer_id,
                  c.name AS customer_name,
                  c.segment,
                  c.country,
                  COUNT(o.id) AS order_count,
                  ROUND(AVG(o.total_amount), 2) AS avg_order_value,
                  SUM(o.total_amount) AS total_spend
                FROM customers c
                JOIN orders o ON c.id = o.customer_id
                WHERE o.status = 'completed'
                GROUP BY c.id, c.name, c.segment, c.country
                ORDER BY avg_order_value DESC
                LIMIT 10;
                """.strip()
                return {
                    "raw_sql": sql,
                    "explanation": "Calculated Average Order Value (AOV) per customer across completed transactions.",
                    "assumptions": ["Filtered for completed orders", "Ranked by avg_order_value DESC"]
                }
            else:
                # Default: total_spend
                sql = """
                SELECT 
                  c.id AS customer_id,
                  c.name AS customer_name,
                  c.segment,
                  c.country,
                  COUNT(o.id) AS total_orders,
                  SUM(o.total_amount) AS total_lifetime_spend
                FROM customers c
                JOIN orders o ON c.id = o.customer_id
                WHERE o.status = 'completed'
                GROUP BY c.id, c.name, c.segment, c.country
                ORDER BY total_lifetime_spend DESC
                LIMIT 10;
                """.strip()
                return {
                    "raw_sql": sql,
                    "explanation": "Aggregated lifetime customer spend across completed orders.",
                    "assumptions": ["Filtered for completed orders", "Ranked by SUM(total_amount) DESC"]
                }

        # Fallback query
        sql = """
        SELECT 
          c.id, 
          c.name, 
          c.segment, 
          c.country, 
          SUM(o.total_amount) AS total_spend
        FROM customers c
        LEFT JOIN orders o ON c.id = o.customer_id
        GROUP BY c.id, c.name, c.segment, c.country
        ORDER BY total_spend DESC NULLS LAST
        LIMIT 10;
        """.strip()
        return {
            "raw_sql": sql,
            "explanation": "Generated general analytical query against customer orders.",
            "assumptions": ["Safety LIMIT 10 applied"]
        }

    async def synthesize_answer(
        self,
        user_query: str,
        sql: str,
        rows: List[Dict[str, Any]],
        execution_time_ms: float
    ) -> Dict[str, Any]:
        count = len(rows)
        if count == 0:
            return {
                "headline": "No records matched your search criteria.",
                "summary": f"The PostgreSQL query completed in {execution_time_ms}ms with 0 returned rows.",
                "keyMetrics": [{"label": "Total Rows", "value": "0"}],
                "suggestedFollowUps": ["Broaden date filter", "Include pending orders"]
            }

        first_row = rows[0]
        keys = list(first_row.keys())
        name_val = first_row.get(keys[1] if len(keys) > 1 else keys[0], "Leader")

        return {
            "headline": f"Found {count} records matching your query.",
            "summary": f"The query executed successfully in {execution_time_ms}ms against PostgreSQL. The top result is {name_val}.",
            "keyMetrics": [
                {"label": "Record Count", "value": str(count)},
                {"label": "Top Result", "value": str(name_val)},
                {"label": "Latency", "value": f"{execution_time_ms}ms"}
            ],
            "suggestedFollowUps": [
                "Filter by Enterprise tier only",
                "Group by geographic country",
                "Show monthly trend"
            ]
        }
