import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, DocumentRecord, QueryLog
from models import ChatInput, ChatResponse, Source
from agents import run_pipeline

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatInput, db: Session = Depends(get_db)):
    if body.document_ids:
        doc_ids = body.document_ids
    else:
        docs = db.query(DocumentRecord).filter(DocumentRecord.status == "ready").all()
        doc_ids = [d.id for d in docs]

    if not doc_ids:
        raise HTTPException(
            status_code=400,
            detail="No documents available. Please upload clinical documents first.",
        )

    docs = db.query(DocumentRecord).filter(DocumentRecord.id.in_(doc_ids)).all()
    doc_names = {d.id: d.name for d in docs}

    try:
        result = run_pipeline(body.question, doc_ids, doc_names)
    except Exception as e:
        logger.error(f"Pipeline error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI pipeline error: {str(e)}")

    sources = [
        Source(
            document_id=s["document_id"],
            document_name=s["document_name"],
            page=s.get("page"),
            chunk_text=s["chunk_text"],
            relevance_score=s.get("relevance_score", 0.8),
        )
        for s in result.get("sources", [])
    ]

    query_log = QueryLog(
        question=body.question,
        intent=result.get("intent", "search"),
        answer=result.get("answer", ""),
        confidence=result.get("confidence", 0.0),
        latency_ms=result.get("latency_ms", 0.0),
        sources_json=[s.model_dump() for s in sources],
        success="true",
    )
    db.add(query_log)
    db.commit()

    return ChatResponse(
        answer=result.get("answer", ""),
        sources=sources,
        confidence=result.get("confidence", 0.0),
        intent=result.get("intent", "search"),
        latency_ms=result.get("latency_ms", 0.0),
    )
