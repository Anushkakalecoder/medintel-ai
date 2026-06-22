import logging
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db, DocumentRecord, QueryLog
from models import Analytics, DailyStats, TrendPoint, IntentCount, QueryRecord

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/analytics", response_model=Analytics)
def get_analytics(db: Session = Depends(get_db)):
    total_docs = db.query(func.count(DocumentRecord.id)).scalar() or 0
    total_queries = db.query(func.count(QueryLog.id)).scalar() or 0

    avg_latency = db.query(func.avg(QueryLog.latency_ms)).scalar() or 0.0
    avg_confidence = db.query(func.avg(QueryLog.confidence)).scalar() or 0.0
    success_count = db.query(func.count(QueryLog.id)).filter(QueryLog.success == "true").scalar() or 0
    success_rate = (success_count / total_queries * 100) if total_queries > 0 else 0.0

    # Queries per day for last 14 days
    cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    recent_queries = db.query(QueryLog).filter(QueryLog.created_at >= cutoff).all()

    daily_map: dict[str, list] = defaultdict(list)
    for q in recent_queries:
        day = q.created_at.date().isoformat()
        daily_map[day].append(q)

    queries_per_day = []
    for i in range(13, -1, -1):
        day = (datetime.now(timezone.utc) - timedelta(days=i)).date().isoformat()
        qs = daily_map.get(day, [])
        avg_lat = sum(q.latency_ms for q in qs) / len(qs) if qs else 0.0
        queries_per_day.append(DailyStats(date=day, count=len(qs), avg_latency_ms=round(avg_lat, 1)))

    # Confidence + latency trend
    confidence_trend = []
    for stat in queries_per_day:
        day_qs = daily_map.get(stat.date, [])
        avg_conf = sum(q.confidence for q in day_qs) / len(day_qs) if day_qs else 0.0
        confidence_trend.append(TrendPoint(
            date=stat.date,
            avg_confidence=round(avg_conf, 3),
            avg_latency_ms=round(stat.avg_latency_ms, 1),
        ))

    # Intent distribution
    intent_rows = db.query(QueryLog.intent, func.count(QueryLog.id)).group_by(QueryLog.intent).all()
    intent_distribution = [IntentCount(intent=row[0] or "search", count=row[1]) for row in intent_rows]

    return Analytics(
        total_documents=total_docs,
        total_queries=total_queries,
        avg_latency_ms=round(float(avg_latency), 1),
        avg_confidence=round(float(avg_confidence), 3),
        success_rate=round(success_rate, 1),
        queries_per_day=queries_per_day,
        confidence_trend=confidence_trend,
        intent_distribution=intent_distribution,
    )


@router.get("/queries", response_model=list[QueryRecord])
def list_queries(db: Session = Depends(get_db)):
    queries = db.query(QueryLog).order_by(QueryLog.created_at.desc()).limit(50).all()
    return [
        QueryRecord(
            id=q.id,
            question=q.question,
            intent=q.intent or "search",
            confidence=q.confidence,
            latency_ms=q.latency_ms,
            created_at=q.created_at.isoformat(),
            answer_preview=(q.answer or "")[:120],
        )
        for q in queries
    ]
