"""
Admin endpoints: user management, system administration.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from app.db.session import get_db
from app.models.models import User, UserRole, Ticket, KBArticle
from app.schemas.schemas import UserResponse, PaginatedResponse
from app.api.deps import require_admin, require_agent_or_admin
from app.services.audit_service import AuditService

router = APIRouter()


@router.get("/users")
async def list_users(
    role: Optional[UserRole] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """List all users with optional role filter, search, and pagination (Admin/Agent)."""
    query = select(User)
    count_q = select(func.count(User.id))

    if role:
        query = query.where(User.role == role)
        count_q = count_q.where(User.role == role)
    if search:
        q_filter = User.name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        query = query.where(q_filter)
        count_q = count_q.where(q_filter)

    total = await db.scalar(count_q) or 0
    query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    return PaginatedResponse(items=users, total=total)


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get a specific user's details (Admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}/role")
async def update_user_role(
    request: Request,
    user_id: str,
    role: UserRole,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update a user's role (Admin only)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = user.role
    user.role = role
    await db.flush()

    await AuditService.log(
        db=db,
        action="admin.update_role",
        user_id=current_user.id,
        resource_type="user",
        resource_id=user_id,
        details={"target_user": user.email, "old_role": old_role.value, "new_role": role.value},
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", ""),
    )

    return {"status": "ok", "user_id": user_id, "role": role.value}


@router.patch("/users/{user_id}/toggle-status")
async def toggle_user_status(
    request: Request,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Toggle a user's active status (Admin only)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = not user.is_active
    await db.flush()

    await AuditService.log(
        db=db,
        action="admin.toggle_status",
        user_id=current_user.id,
        resource_type="user",
        resource_id=user_id,
        details={"target_user": user.email, "is_active": user.is_active},
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", ""),
    )

    return {
        "status": "ok",
        "user_id": user_id,
        "is_active": user.is_active,
    }


@router.delete("/users/{user_id}")
async def delete_user(
    request: Request,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Delete a user account (Admin only)."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await AuditService.log(
        db=db,
        action="admin.delete_user",
        user_id=current_user.id,
        resource_type="user",
        resource_id=user_id,
        details={"target_user": user.email},
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", ""),
    )

    await db.delete(user)
    return {"status": "ok", "message": "User deleted successfully"}
