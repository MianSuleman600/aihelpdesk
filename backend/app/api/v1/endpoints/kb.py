"""
Knowledge Base endpoints: CRUD articles, search, categories.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional, List, Any
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.models import KBArticle, Category, User, UserRole
from app.schemas.schemas import (
    KBArticleCreate, KBArticleUpdate, KBArticleResponse,
    CategoryCreate, CategoryResponse, PaginatedResponse,
)
from app.api.deps import get_current_user, require_agent_or_admin

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


# --- Articles ---

@router.get("/articles")
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
