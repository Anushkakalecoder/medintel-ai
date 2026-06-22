from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DocumentModel(BaseModel):
    id: str
    name: str
    file_type: str
    file_size: int
    pages: Optional[int] = None
    chunk_count: int
    uploaded_at: str
    status: str


class Source(BaseModel):
    document_id: str
    document_name: str
    page: Optional[int] = None
    chunk_text: str
    relevance_score: float


class ChatInput(BaseModel):
    question: str = Field(..., min_length=1)
    document_ids: Optional[list[str]] = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
    confidence: float
    intent: str
    latency_ms: float


class DailyStats(BaseModel):
    date: str
    count: int
    avg_latency_ms: float


class TrendPoint(BaseModel):
    date: str
    avg_confidence: float
    avg_latency_ms: float


class IntentCount(BaseModel):
    intent: str
    count: int


class Analytics(BaseModel):
    total_documents: int
    total_queries: int
    avg_latency_ms: float
    avg_confidence: float
    success_rate: float
    queries_per_day: list[DailyStats]
    confidence_trend: list[TrendPoint]
    intent_distribution: list[IntentCount]


class QueryRecord(BaseModel):
    id: str
    question: str
    intent: str
    confidence: float
    latency_ms: float
    created_at: str
    answer_preview: str


class DeleteResult(BaseModel):
    success: bool
    message: str


class ErrorResponse(BaseModel):
    error: str


class AgentState(BaseModel):
    question: str
    intent: str = ""
    documents: list[dict] = []
    confidence: float = 0.0
    sources: list[dict] = []
    answer: str = ""
    document_ids: Optional[list[str]] = None
