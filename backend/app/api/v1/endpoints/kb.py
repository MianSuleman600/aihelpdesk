"""
Knowledge Base endpoints: CRUD articles, search, categories.
"""

import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional, List, Any
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.models import KBArticle, Category, KBAttachment, User, UserRole
from app.schemas.schemas import (
    KBArticleCreate, KBArticleUpdate, KBArticleResponse,
    CategoryCreate, CategoryUpdate, CategoryResponse, PaginatedResponse,
    KBAttachmentResponse, KBAttachmentUploadResponse,
)
from app.api.deps import get_current_user, require_agent_or_admin
from app.core.config import settings

router = APIRouter()


# --- Categories ---

@router.get("/categories", response_model=List[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db)):
    """List all categories."""
    result = await db.execute(select(Category).order_by(Category.name))
    return result.scalars().all()


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """Create a new category (Agent/Admin only)."""
    category = Category(**data.model_dump())
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    data: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """Update a category (Agent/Admin only)."""
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    await db.flush()
    await db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """Delete a category (Agent/Admin only)."""
    result = await db.execute(select(Category).where(Category.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    # Check for related articles
    article_count = await db.scalar(select(func.count(KBArticle.id)).where(KBArticle.category_id == category_id))
    if article_count:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot delete category: {article_count} article(s) reference it")
    await db.delete(category)
    await db.flush()


# --- KB Attachments ---

KB_UPLOAD_DIR = settings.KB_UPLOAD_DIR or "uploads/kb"


@router.post("/articles/{article_id}/attachments", response_model=KBAttachmentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_kb_attachment(
    article_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """Upload a file attachment to a KB article (Agent/Admin only)."""
    # Validate article exists
    result = await db.execute(select(KBArticle).where(KBArticle.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")

    # Validate file
    ext = os.path.splitext(file.filename or "unknown")[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported file type: {ext}")
    if (file.size or 0) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"File too large (max {settings.MAX_UPLOAD_SIZE_MB}MB)")

    # Save file
    os.makedirs(KB_UPLOAD_DIR, exist_ok=True)
    file_id = str(uuid.uuid4())
    safe_name = f"{file_id}{ext}"
    file_path = os.path.join(KB_UPLOAD_DIR, safe_name)
    content = await file.read()
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # Create DB record
    attachment = KBAttachment(
        article_id=article_id,
        file_url=f"/uploads/kb/{safe_name}",
        file_name=file.filename or safe_name,
        file_type=ext,
        file_size=len(content),
    )
    db.add(attachment)
    await db.flush()
    await db.refresh(attachment)
    return attachment


@router.get("/articles/{article_id}/attachments", response_model=List[KBAttachmentResponse])
async def list_kb_attachments(
    article_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List all attachments for a KB article."""
    result = await db.execute(
        select(KBAttachment).where(KBAttachment.article_id == article_id).order_by(KBAttachment.created_at)
    )
    return result.scalars().all()


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kb_attachment(
    attachment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """Delete a KB article attachment (Agent/Admin only)."""
    result = await db.execute(select(KBAttachment).where(KBAttachment.id == attachment_id))
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    # Delete file from disk
    file_path = os.path.join(KB_UPLOAD_DIR, os.path.basename(attachment.file_url))
    if os.path.exists(file_path):
        os.remove(file_path)
    await db.delete(attachment)
    await db.flush()


# --- Articles ---

@router.get("/articles", response_model=PaginatedResponse[KBArticleResponse])
async def list_articles(
    search: Optional[str] = Query(None, description="Search keyword"),
    category_id: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """List and search KB articles. Agents/Admins see all; users see published only."""
    query = select(KBArticle)
    count_q = select(func.count(KBArticle.id))

    if current_user.role not in (UserRole.ADMIN, UserRole.AGENT):
        query = query.where(KBArticle.is_published == True)
        count_q = count_q.where(KBArticle.is_published == True)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(KBArticle.title.ilike(pattern), KBArticle.body.ilike(pattern))
        )
        count_q = count_q.where(
            or_(KBArticle.title.ilike(pattern), KBArticle.body.ilike(pattern))
        )
    if category_id:
        query = query.where(KBArticle.category_id == category_id)
        count_q = count_q.where(KBArticle.category_id == category_id)
    if tag:
        query = query.where(KBArticle.tags.any(tag))

    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    query = query.order_by(KBArticle.updated_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()

    return PaginatedResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/articles/{article_id}", response_model=KBArticleResponse)
async def get_article(article_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific KB article by ID."""
    result = await db.execute(select(KBArticle).where(KBArticle.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Increment view count
    article.view_count += 1
    await db.flush()
    return article


@router.post("/articles", response_model=KBArticleResponse, status_code=status.HTTP_201_CREATED)
async def create_article(
    data: KBArticleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """Create a new KB article (Agent/Admin only)."""
    article = KBArticle(
        **data.model_dump(),
        created_by_id=current_user.id,
        published_at=datetime.now(timezone.utc) if data.is_published else None,
    )
    db.add(article)
    await db.flush()
    await db.refresh(article)
    return article


@router.put("/articles/{article_id}", response_model=KBArticleResponse)
async def update_article(
    article_id: str,
    data: KBArticleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """Update a KB article (Agent/Admin only)."""
    result = await db.execute(select(KBArticle).where(KBArticle.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(article, field, value)

    if data.is_published and not article.published_at:
        article.published_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(article)
    return article


@router.delete("/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """Delete a KB article (Agent/Admin only)."""
    result = await db.execute(select(KBArticle).where(KBArticle.id == article_id))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    await db.delete(article)
    await db.flush()
