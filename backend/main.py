"""
ClarifySQL - FastAPI Backend Engine
Production-style Text-to-SQL backend with conversational clarification engine,
secure SQL validation, PostgreSQL execution, and natural language response synthesis.
"""

import os
import time
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .database import get_db_engine, get_schema_metadata, execute_query
from .clarification_engine import ClarificationEngine
from .sql_validator import SQLValidator

app = FastAPI(
    title="ClarifySQL FastAPI Service",
    description="Production-grade AI Text-to-SQL API with Clarification Engine",
    version="1.0.0"
)

# CORS configuration for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

validator = SQLValidator()
clarification_engine = ClarificationEngine()

# Pydantic Schemas
class ClarificationOption(BaseModel):
    id: str
    label: str
    description: str
    sqlHint: Optional[str] = None

class ConversationTurn(BaseModel):
    role: str
    content: str
    selectedOptionId: Optional[str] = None
    generatedSql: Optional[str] = None

class ChatRequest(BaseModel):
    query: str = Field(..., description="Natural language question from user")
    conversationHistory: List[ConversationTurn] = []
    selectedClarification: Optional[Dict[str, Any]] = None

class ClarificationAnalysisResponse(BaseModel):
    isAmbiguous: bool
    ambiguityScore: float
    ambiguityType: str
    detectedAmbiguousTokens: List[str]
    explanation: str
    clarifyingQuestion: Optional[str] = None
    options: Optional[List[ClarificationOption]] = None
    resolvedIntent: Optional[str] = None

class SqlExecutionRequest(BaseModel):
    sql: str

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ClarifySQL FastAPI Backend",
        "database": "PostgreSQL Relational DB",
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY"))
    }

@app.get("/api/schema")
def get_schema():
    """Returns PostgreSQL schema definitions, column types, and row statistics."""
    try:
        return {"tables": get_schema_metadata()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clarify", response_model=ClarificationAnalysisResponse)
async def analyze_ambiguity(req: ChatRequest):
    """
    Clarification Engine endpoint: Inspects user query for lexical and semantic ambiguity.
    Identifies if follow-up clarification (e.g., metric definition for 'best customers') is required.
    """
    analysis = await clarification_engine.analyze(
        user_query=req.query,
        history=[turn.dict() for turn in req.conversationHistory],
        selected_clarification=req.selectedClarification
    )
    return analysis

@app.post("/api/chat")
async def process_chat(req: ChatRequest):
    """
    Full Text-to-SQL workflow:
    1. Ambiguity check via Clarification Engine.
    2. If ambiguous and unclarified, returns clarifying question and options.
    3. If clear or clarified, generates safe SQL, validates against safety rules,
       executes against PostgreSQL, and synthesizes natural language answers.
    """
    # Step 1: Clarification check
    analysis = await clarification_engine.analyze(
        user_query=req.query,
        history=[turn.dict() for turn in req.conversationHistory],
        selected_clarification=req.selectedClarification
    )

    if analysis["isAmbiguous"] and not req.selectedClarification:
        return {
            "type": "clarification_needed",
            "analysis": analysis,
            "message": analysis.get("clarifyingQuestion", "Could you clarify your request?")
        }

    # Step 2: Generate SQL
    sql_result = await clarification_engine.generate_sql(
        user_query=req.query,
        clarification_context=req.selectedClarification,
        history=[turn.dict() for turn in req.conversationHistory]
    )

    # Step 3: Secure SQL Validation
    validation = validator.validate(sql_result["raw_sql"])
    if not validation["is_valid"]:
        return {
            "type": "validation_error",
            "error": validation["error"],
            "raw_sql": sql_result["raw_sql"],
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
            "explanation": sql_result.get("explanation", ""),
            "assumptions": sql_result.get("assumptions", []),
            "validation": validation
        },
        "execution": {
            "rows": exec_result["rows"],
            "row_count": exec_result["row_count"],
            "execution_time_ms": exec_result["execution_time_ms"]
        },
        "answer": nl_answer,
        "ambiguity_analysis": analysis
    }

@app.post("/api/validate-sql")
def validate_sql_endpoint(req: SqlExecutionRequest):
    """Direct validation of arbitrary SQL against security rules."""
    return validator.validate(req.sql)

@app.post("/api/execute-sql")
def execute_sql_endpoint(req: SqlExecutionRequest):
    """Direct secure execution of validated SQL query in playground."""
    validation = validator.validate(req.sql)
    if not validation["is_valid"]:
        raise HTTPException(status_code=400, detail=validation["error"])
    return execute_query(validation["sanitized_sql"])
