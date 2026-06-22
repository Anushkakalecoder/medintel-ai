import os
import io
import logging
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)


def extract_text_from_pdf(content: bytes) -> tuple[str, Optional[int]]:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(content))
    pages = len(reader.pages)
    text_parts = []
    for page in reader.pages:
        text = page.extract_text() or ""
        text_parts.append(text)
    return "\n\n".join(text_parts), pages


def extract_text_from_docx(content: bytes) -> tuple[str, Optional[int]]:
    import docx
    doc = docx.Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs), None


def extract_text_from_txt(content: bytes) -> tuple[str, Optional[int]]:
    text = content.decode("utf-8", errors="replace")
    return text, None


def extract_text(content: bytes, filename: str) -> tuple[str, Optional[int]]:
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return extract_text_from_pdf(content)
    elif ext in (".docx", ".doc"):
        return extract_text_from_docx(content)
    elif ext == ".txt":
        return extract_text_from_txt(content)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def chunk_text(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> list[str]:
    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
    except ImportError:
        from langchain.text_splitter import RecursiveCharacterTextSplitter
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(text)
