import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db, DocumentRecord
from vector_store import delete_index
from models import DocumentModel, DeleteResult

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/documents", response_model=list[DocumentModel])
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(DocumentRecord).order_by(DocumentRecord.uploaded_at.desc()).all()
    return [
        DocumentModel(
            id=d.id,
            name=d.name,
            file_type=d.file_type,
            file_size=d.file_size,
            pages=d.pages,
            chunk_count=d.chunk_count,
            uploaded_at=d.uploaded_at.isoformat(),
            status=d.status,
        )
        for d in docs
    ]


@router.get("/documents/{doc_id}", response_model=DocumentModel)
def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentRecord).filter(DocumentRecord.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentModel(
        id=doc.id,
        name=doc.name,
        file_type=doc.file_type,
        file_size=doc.file_size,
        pages=doc.pages,
        chunk_count=doc.chunk_count,
        uploaded_at=doc.uploaded_at.isoformat(),
        status=doc.status,
    )


@router.delete("/documents/{doc_id}", response_model=DeleteResult)
def delete_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentRecord).filter(DocumentRecord.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        delete_index(doc_id)
    except Exception as e:
        logger.warning(f"Failed to delete vector index for {doc_id}: {e}")
    db.delete(doc)
    db.commit()
    return DeleteResult(success=True, message=f"Document '{doc.name}' deleted successfully")
