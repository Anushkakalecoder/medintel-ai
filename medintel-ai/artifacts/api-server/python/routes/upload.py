import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, DocumentRecord
from document_processor import extract_text, chunk_text
from vector_store import build_index
from models import DocumentModel

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_TYPES = {".pdf", ".docx", ".doc", ".txt"}
MAX_SIZE_MB = 50


@router.post("/upload", response_model=DocumentModel)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    from pathlib import Path

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Allowed: PDF, DOCX, TXT")

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_SIZE_MB:
        raise HTTPException(status_code=400, detail=f"File too large ({size_mb:.1f} MB). Max {MAX_SIZE_MB} MB.")

    doc_id = str(uuid.uuid4())
    doc_record = DocumentRecord(
        id=doc_id,
        name=file.filename or "unnamed",
        file_type=ext.lstrip(".").upper(),
        file_size=len(content),
        status="processing",
        uploaded_at=datetime.now(timezone.utc),
    )
    db.add(doc_record)
    db.commit()

    try:
        text, pages = extract_text(content, file.filename or "doc.txt")
        chunks = chunk_text(text)

        build_index(doc_id, chunks)

        doc_record.pages = pages
        doc_record.chunk_count = len(chunks)
        doc_record.status = "ready"
        db.commit()
        db.refresh(doc_record)

        logger.info(f"Document {doc_id} processed: {len(chunks)} chunks")
    except Exception as e:
        logger.error(f"Processing failed for {doc_id}: {e}")
        doc_record.status = "error"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")

    return DocumentModel(
        id=doc_record.id,
        name=doc_record.name,
        file_type=doc_record.file_type,
        file_size=doc_record.file_size,
        pages=doc_record.pages,
        chunk_count=doc_record.chunk_count,
        uploaded_at=doc_record.uploaded_at.isoformat(),
        status=doc_record.status,
    )
