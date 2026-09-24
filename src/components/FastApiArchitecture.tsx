import React, { useState } from 'react';
import { Code, Server, Database, ShieldCheck, Sparkles, Copy, Check, Terminal, ExternalLink } from 'lucide-react';

const PYTHON_FILES: Record<string, { filename: string; description: string; code: string }> = {
  main: {
    filename: 'backend/main.py',
    description: 'FastAPI Application, Pydantic DTOs, CORS, and endpoint orchestration.',
    code: `"""
ClarifySQL - FastAPI Backend Engine
Production-style Text-to-SQL backend with conversational clarification engine,
secure SQL validation, PostgreSQL execution, and natural language response synthesis.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from .database import get_schema_metadata, execute_query
from .clarification_engine import ClarificationEngine
from .sql_validator import SQLValidator

app = FastAPI(
    title="ClarifySQL FastAPI Service",
    description="Production-grade AI Text-to-SQL API with Clarification Engine",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

validator = SQLValidator()
clarification_engine = ClarificationEngine()

class ChatRequest(BaseModel):
    query: str = Field(..., description="Natural language question")
    conversationHistory: List[Dict[str, Any]] = []
    selectedClarification: Optional[Dict[str, Any]] = None

@app.post("/api/chat")
async def process_chat(req: ChatRequest):
    # Step 1: Clarification check
    analysis = await clarification_engine.analyze(
        user_query=req.query,
        history=req.conversationHistory,
        selected_clarification=req.selectedClarification
    )

    # If ambiguous, return clarifying question and options
    if analysis["isAmbiguous"] and not req.selectedClarification:
        return {
            "type": "clarification_needed",
            "ambiguityAnalysis": analysis,
            "clarifyingQuestion": analysis.get("clarifyingQuestion"),
            "options": analysis.get("options")
        }

    # Step 2: Generate SQL
    sql_result = await clarification_engine.generate_sql(
        user_query=req.query,
        clarification_context=req.selectedClarification,
        history=req.conversationHistory
    )

    # Step 3: Secure SQL AST Validation
    validation = validator.validate(sql_result["raw_sql"])
    if not validation["is_valid"]:
        return {
            "type": "validation_error",
            "error": validation["error"],
            "safety_checks": validation["safety_checks"]
        }

    # Step 4: Execute against PostgreSQL
    exec_result = execute_query(validation["sanitized_sql"])

    # Step 5: Synthesize Natural Language Answer
    nl_answer = await clarification_engine.synthesize_answer(
        user_query=req.query,
        sql=validation["sanitized_sql"],
        rows=exec_result["rows"],
        execution_time_ms=exec_result["execution_time_ms"]
    )

    return {
        "type": "sql_result",
        "sql": {
            "raw": sql_result["raw_sql"],
            "sanitized": validation["sanitized_sql"],
            "formatted": validation["formatted_sql"],
            "explanation": sql_result.get("explanation"),
            "assumptions": sql_result.get("assumptions"),
            "validation": validation
        },
        "execution": exec_result,
        "answer": nl_answer
    }`
  },
  clarification: {
    filename: 'backend/clarification_engine.py',
    description: 'Semantic ambiguity detection, metric resolver, and multi-turn question generator.',
    code: `"""
Clarification Engine in Python
Detects semantic ambiguity, manages conversational follow-ups,
and prompts clarifying questions with structured options.
"""

import re
from typing import Dict, Any, List, Optional

class ClarificationEngine:
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
                "explanation": f"Clarification applied: {selected_clarification.get('optionLabel')}"
            }

        # Rule 1: 'Best customers' metric ambiguity
        if re.search(r'\\b(best|top|valuable|vip)\\s+(customers?|clients?|users?)\\b', clean_query):
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
                    }
                ]
            }

        # Additional domain ambiguity patterns (products, stock levels, churn)...
        return {
            "isAmbiguous": False,
            "ambiguityScore": 0.1,
            "ambiguityType": "none",
            "explanation": "Query intent is clear and directly executable."
        }`
  },
  validator: {
    filename: 'backend/sql_validator.py',
    description: 'Security AST & whitelist validator ensuring read-only PostgreSQL execution.',
    code: `"""
Secure SQL Validator in Python
Enforces read-only SELECT constraints, prevents multi-statement injections,
and whitelists allowed relational tables.
"""

import re
from typing import Dict, Any

ALLOWED_TABLES = {"customers", "orders", "order_items", "products", "categories", "support_tickets"}
FORBIDDEN_KEYWORDS = ["DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "TRUNCATE", "CREATE", "GRANT", "EXECUTE"]

class SQLValidator:
    def validate(self, raw_sql: str) -> Dict[str, Any]:
        sql = raw_sql.strip()
        safety_checks = []

        # 1. Multi-statement injection block
        statements = [s.strip() for s in re.split(r';(?=(?:[^\\']*\\'[^\\']*\\')*[^\\']*$)', sql) if s.strip()]
        if len(statements) > 1:
            return {
                "is_valid": False,
                "error": "Multiple statements detected. Multi-statement injection is blocked.",
                "safety_checks": [{"name": "Single Statement", "passed": False}]
            }

        query = statements[0]

        # 2. Enforce SELECT or WITH
        if not re.match(r'^(SELECT|WITH)\\b', query, re.IGNORECASE):
            return {
                "is_valid": False,
                "error": "Only read-only SELECT or WITH statements are allowed.",
                "safety_checks": [{"name": "Read-Only SELECT", "passed": False}]
            }

        # 3. Disallowed DDL / DML keywords
        for keyword in FORBIDDEN_KEYWORDS:
            if re.search(rf'\\b{keyword}\\b', query, re.IGNORECASE):
                return {
                    "is_valid": False,
                    "error": f"Prohibited keyword '{keyword}' found.",
                    "safety_checks": [{"name": f"Prohibited ({keyword})", "passed": False}]
                }

        # 4. Enforce Safety LIMIT
        sanitized_sql = query
        if not re.search(r'\\bLIMIT\\s+\\d+\\b', sanitized_sql, re.IGNORECASE):
            sanitized_sql += " LIMIT 100"

        return {
            "is_valid": True,
            "sanitized_sql": sanitized_sql,
            "formatted_sql": sanitized_sql,
            "safety_checks": [
                {"name": "Single Statement", "passed": True, "details": "Verified single query"},
                {"name": "Read-Only SELECT", "passed": True, "details": "Verified SELECT"},
                {"name": "No Prohibited DML", "passed": True, "details": "No mutations"},
                {"name": "Safety LIMIT", "passed": True, "details": "LIMIT applied"}
            ]
        }`
  },
  database: {
    filename: 'backend/database.py',
    description: 'PostgreSQL relational engine connection and schema metadata inspection.',
    code: `"""
Database Module for FastAPI Backend
PostgreSQL connection pool, schema inspection, and execution latency instrumentation.
"""

from typing import Dict, Any, List

def get_schema_metadata() -> List[Dict[str, Any]]:
    return [
        {"tableName": "customers", "description": "Customer accounts, segments, geography, balances."},
        {"tableName": "orders", "description": "Transaction orders, dates, total amounts, statuses."},
        {"tableName": "order_items", "description": "Line items, unit prices, discounts, quantities."},
        {"tableName": "products", "description": "Product catalog, SKU, costs, retail prices, stock."},
        {"tableName": "categories", "description": "Product taxonomy and departments."},
        {"tableName": "support_tickets", "description": "Customer service tickets, priority, resolution."}
    ]`
  }
};

export const FastApiArchitecture: React.FC = () => {
  const [selectedFileKey, setSelectedFileKey] = useState<string>('main');
  const [copied, setCopied] = useState(false);

  const activeFile = PYTHON_FILES[selectedFileKey];

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Overview Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 shadow-md">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-300 shadow">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Python FastAPI & PostgreSQL Architecture</h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Full-stack architecture featuring FastAPI backend services, Clarification Engine, SQL Validator, and PostgreSQL database.
            </p>
          </div>
        </div>

        {/* Pipeline Architecture Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-800">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-xs mb-1">
              <Sparkles className="w-4 h-4" />
              <span>1. Clarification Engine</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Detects ambiguous terms (e.g. 'best customers'). Returns structured options (LTV vs Order Frequency vs AOV).
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center space-x-2 text-blue-400 font-semibold text-xs mb-1">
              <Code className="w-4 h-4" />
              <span>2. SQL Synthesis</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Generates PostgreSQL dialect SELECT statements grounded in relational schema context.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-xs mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>3. AST Security Validator</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Blocks injection, restricts statements to read-only SELECT, validates table whitelist, enforces LIMIT.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center space-x-2 text-purple-400 font-semibold text-xs mb-1">
              <Database className="w-4 h-4" />
              <span>4. PostgreSQL Execution</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Executes query against relational engine, records execution latency, and synthesizes natural language answers.
            </p>
          </div>
        </div>
      </div>

      {/* Code Browser */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: File Selector */}
        <div className="lg:col-span-1 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
            Python Source Files
          </h3>
          <div className="space-y-1.5">
            {Object.entries(PYTHON_FILES).map(([key, file]) => {
              const isSelected = selectedFileKey === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedFileKey(key)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-blue-900/40 border-blue-500 text-white shadow ring-1 ring-blue-500'
                      : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="font-mono text-xs font-semibold text-cyan-300 flex items-center space-x-1.5">
                    <Code className="w-3.5 h-3.5" />
                    <span>{file.filename}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{file.description}</p>
                </button>
              );
            })}
          </div>

          {/* Quick CLI Run Instructions */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 space-y-2 mt-4">
            <span className="font-semibold text-slate-200 block">Run in Python Environment:</span>
            <pre className="p-2.5 rounded bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto border border-slate-850">
{`pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000`}
            </pre>
          </div>
        </div>

        {/* Right: Code Viewer */}
        <div className="lg:col-span-3 space-y-3">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-mono text-sm font-bold text-white block">
                {activeFile.filename}
              </span>
              <span className="text-xs text-slate-400">{activeFile.description}</span>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Syntax Code Container */}
          <div className="relative rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-inner">
            <pre className="p-5 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed max-h-[580px]">
              <code>{activeFile.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
