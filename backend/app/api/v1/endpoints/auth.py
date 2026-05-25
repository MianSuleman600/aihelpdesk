"""
Authentication endpoints: register, login, profile, password management.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.db.session import get_db
from app.models.models import User, UserRole
from app.schemas.schemas import UserRegister, UserLogin, UserResponse, Token, UserUpdate, PasswordChange
from app.core.security import hash_password, verify_password, create_access_token
from app.core.rate_limiter import rate_limiter
from app.api.deps import get_current_user
from app.services.auth_service import AuthService
from app.services.audit_service import AuditService


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(request: Request, user_data: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new user."""
    client_ip = request.client.host if request.client else "unknown"
    allowed, retry = await rate_limiter.check(f"register:{client_ip}", max_requests=3, window_sec=3600)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many registration attempts. Try again in {retry}s")

    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=UserRole.USER,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    await AuditService.log(
        db=db,
        action="user.register",
        user_id=user.id,
        resource_type="user",
        resource_id=user.id,
        details={"email": user.email, "role": user.role.value},
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent", ""),
    )

    return user


@router.post("/login", response_model=Token)
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """Login and receive JWT token."""
    client_ip = request.client.host if request.client else "unknown"

    allowed, retry = await rate_limiter.check(f"login:{client_ip}", max_requests=10, window_sec=300)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many login attempts. Try again in {retry}s")

    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    access_token = create_access_token(data={"sub": user.id, "role": user.role.value})

    await AuditService.log(
        db=db,
        action="user.login",
        user_id=user.id,
        resource_type="user",
        resource_id=user.id,
        details={"email": user.email},
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent", ""),
    )

    return Token(access_token=access_token)


@router.post("/forgot-password")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Request a password reset token."""
    client_ip = request.client.host if request.client else "unknown"
    allowed, retry = await rate_limiter.check(f"forgot-password:{client_ip}", max_requests=5, window_sec=3600)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Too many requests. Try again in {retry}s")
    return await AuthService.request_password_reset(body.email, db)


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset password using a valid reset token."""
    return await AuthService.reset_password(body.token, body.password, db)


@router.post("/refresh")
async def refresh_token(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Refresh the JWT access token."""
    access_token = create_access_token(data={"sub": current_user.id, "role": current_user.role.value})
    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user profile (name, email)."""
    return await AuthService.update_user_profile(
        user_id=current_user.id,
        name=data.name,
        email=data.email,
        db=db,
    )


@router.delete("/me")
async def delete_account(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete the current user's account."""
    await AuditService.log(
        db=db,
        action="user.delete",
        user_id=current_user.id,
        resource_type="user",
        resource_id=current_user.id,
        details={"email": current_user.email},
        ip_address=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("user-agent", ""),
    )

    await db.delete(current_user)
    await db.flush()
    return {"message": "Account deleted permanently"}


@router.post("/change-password")
async def change_password(
    data: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change current user's password."""
    return await AuthService.change_password(
        user_id=current_user.id,
        old_password=data.old_password,
        new_password=data.new_password,
        db=db,
    )

