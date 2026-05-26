"""
Document upload and management endpoints for RAG indexing.
Admins/agents upload PDF/DOCX/TXT files → processed, chunked, embedded, stored in Pinecone.
"""

import os
import uuid
from typing import Optional
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.models.models import User, UserRole, UploadedDocument, UploadedDocumentStatus
from app.schemas.schemas import (
    DocumentResponse, DocumentListResponse, DocumentUploadResponse, ReindexResponse,
)
from app.api.deps import get_current_user, require_agent_or_admin
from app.core.config import settings
from app.services.document_processor import DocumentProcessor

router = APIRouter()


@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """
    Upload a document for RAG indexing.
    Supported formats: PDF, DOCX, TXT. Max 10MB. Max 50 docs per admin.

    Pipeline:
      1. Validate file type & size
      2. Check admin quota
      3. Save file to disk
      4. Create DB record (status=processing)
      5. Extract text → chunk → embed → upsert to Pinecone
      6. Update DB record (status=ready/failed)
    """
    # --- 1. Validate file ---
    DocumentProcessor.validate_file(file.filename or "unknown", file.size or 0)

    # --- 2. Check admin quota ---
    count_result = await db.execute(
        select(func.count()).select_from(UploadedDocument)
        .where(UploadedDocument.uploaded_by_id == current_user.id)
    )
    doc_count = count_result.scalar()
    if doc_count >= settings.MAX_DOCUMENTS_PER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document limit reached ({settings.MAX_DOCUMENTS_PER_ADMIN}). Delete old documents to upload more.",
        )

    # --- 3. Save file ---
    upload_dir = settings.UPLOAD_DIR
    os.makedirs(upload_dir, exist_ok=True)

    file_ext = os.path.splitext(file.filename or "unknown")[1].lower()
    saved_name = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(upload_dir, saved_name)

    content = await file.read()
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    title = os.path.splitext(file.filename or "Untitled")[0]

    # --- 4. Create DB record ---
    doc = UploadedDocument(
        title=title,
        filename=file.filename or "unknown",
        file_path=file_path,
        file_type=file_ext,
        file_size=file.size or 0,
        status=UploadedDocumentStatus.PROCESSING,
        uploaded_by_id=current_user.id,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)

    # --- 5. Index into Pinecone (async, non-blocking) ---
    result = await DocumentProcessor.index_document(
        doc_id=doc.id,
        title=title,
        file_path=file_path,
        filename=file.filename or "unknown",
    )

    # --- 6. Update status ---
    doc.status = UploadedDocumentStatus(result["status"])
    doc.chunk_count = result["chunk_count"]
    if result.get("error"):
        doc.error_message = result["error"]
    await db.flush()
    await db.refresh(doc)

    return DocumentUploadResponse(
        message="Document uploaded successfully",
        document=doc,
    )


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List uploaded documents with search and pagination."""
    query = select(UploadedDocument)
    count_q = select(func.count(UploadedDocument.id))

    if current_user.role not in (UserRole.ADMIN, UserRole.AGENT):
        query = query.where(UploadedDocument.uploaded_by_id == current_user.id)
        count_q = count_q.where(UploadedDocument.uploaded_by_id == current_user.id)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            UploadedDocument.title.ilike(pattern) | UploadedDocument.filename.ilike(pattern)
        )
        count_q = count_q.where(
            UploadedDocument.title.ilike(pattern) | UploadedDocument.filename.ilike(pattern)
        )

    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    query = query.order_by(UploadedDocument.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    documents = result.scalars().all()

    return DocumentListResponse(
        documents=documents,
        total=total,
        limit=limit,
        max_documents=settings.MAX_DOCUMENTS_PER_ADMIN,
    )


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single document's details."""
    result = await db.execute(select(UploadedDocument).where(UploadedDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """
    Delete a document and its Pinecone vectors.
    """
    result = await db.execute(select(UploadedDocument).where(UploadedDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete from Pinecone
    await DocumentProcessor.delete_document_vectors(doc_id)

    # Delete file from disk
    try:
        if os.path.exists(doc.file_path):
            os.remove(doc.file_path)
    except OSError as e:
        print(f"Warning: could not delete file {doc.file_path}: {e}")

    await db.delete(doc)
    await db.flush()


@router.post("/{doc_id}/reindex", response_model=ReindexResponse)
async def reindex_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """
    Re-index a document: delete old Pinecone vectors, re-process and re-upload.
    Useful if embedding model changed or indexing failed.
    """
    result = await db.execute(select(UploadedDocument).where(UploadedDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=400, detail="Document file not found on disk")

    doc.status = UploadedDocumentStatus.PROCESSING
    doc.error_message = None
    await db.flush()

    index_result = await DocumentProcessor.reindex_document(
        doc_id=doc.id,
        title=doc.title,
        file_path=doc.file_path,
        filename=doc.filename,
    )

    doc.status = UploadedDocumentStatus(index_result["status"])
    doc.chunk_count = index_result["chunk_count"]
    if index_result.get("error"):
        doc.error_message = index_result["error"]
    await db.flush()

    return ReindexResponse(
        message="Document re-indexed successfully" if doc.status.value == "ready" else "Re-indexing failed",
        status=doc.status.value,
        chunk_count=doc.chunk_count,
    )
