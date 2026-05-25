"""
Authentication service layer for handling user auth operations.
Uses local PostgreSQL for all user management.
"""

import re
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import User, UserRole
from app.schemas.schemas import UserRegister, UserResponse, Token
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token


def validate_password_strength(password: str) -> None:
    """
    Validate password strength requirements.
    Raises HTTPException if password is too weak.
    """
    errors = []
    if len(password) < 8:
        errors.append("at least 8 characters")
    if not re.search(r"[A-Z]", password):
        errors.append("one uppercase letter")
    if not re.search(r"[a-z]", password):
        errors.append("one lowercase letter")
    if not re.search(r"\d", password):
        errors.append("one number")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=~`\[\];'\\/]", password):
        errors.append("one special character")
    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Password must contain: {', '.join(errors)}",
        )


class AuthService:
    """Service layer for authentication operations."""

    @staticmethod
    async def register_user(
        user_data: UserRegister,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        validate_password_strength(user_data.password)
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
        await db.commit()
        await db.refresh(user)

        return {
            "message": "User registered successfully",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": user.role.value,
            }
        }

    @staticmethod
    async def login_user(
        email: str,
        password: str,
        db: AsyncSession,
    ) -> Token:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated",
            )

        access_token = create_access_token(
            data={"sub": user.id, "email": user.email, "role": user.role.value}
        )

        return Token(access_token=access_token, token_type="bearer")

    @staticmethod
    async def request_password_reset(
        email: str,
        db: AsyncSession,
    ) -> Dict[str, str]:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            return {"message": "If an account exists, password reset email has been sent"}

        from app.core.config import settings
        from app.core.email import send_password_reset_email
        from app.core.logging import get_logger

        token = create_access_token(
            data={"sub": user.id, "email": user.email, "purpose": "password_reset"},
            expires_delta=timedelta(minutes=30),
        )

        frontend_url = settings.FRONTEND_URL.rstrip("/")
        reset_link = f"{frontend_url}/auth/reset-password?token={token}"
        logger = get_logger(__name__)
        logger.info(f"Password reset link: {reset_link}")

        sent = send_password_reset_email(email, reset_link)

        if settings.DEBUG:
            return {
                "message": "Password reset email sent" if sent else "SMTP not configured (dev mode)",
                "reset_token": token,
            }

        if not sent:
            return {"message": "Failed to send reset email. Please try again later."}

        return {"message": "Password reset email sent. Please check your inbox."}

    @staticmethod
    async def reset_password(
        token: str,
        new_password: str,
        db: AsyncSession,
    ) -> Dict[str, str]:
        validate_password_strength(new_password)
        payload = decode_access_token(token)
        if not payload or payload.get("purpose") != "password_reset":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired reset token",
            )

        result = await db.execute(select(User).where(User.id == payload["sub"]))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        user.password_hash = hash_password(new_password)
        user.updated_at = datetime.now(timezone.utc)
        await db.commit()

        return {"message": "Password reset successfully"}

    @staticmethod
    async def get_user_profile(
        user_id: str,
        db: AsyncSession,
    ) -> Optional[UserResponse]:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def update_user_profile(
        user_id: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        db: AsyncSession = None,
    ) -> UserResponse:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if name is not None:
            user.name = name
        if email is not None:
            existing = await db.execute(select(User).where(User.email == email, User.id != user_id))
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already in use",
                )
            user.email = email

        user.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(user)

        return user

    @staticmethod
    async def change_password(
        user_id: str,
        old_password: str,
        new_password: str,
        db: AsyncSession,
    ) -> Dict[str, str]:
        validate_password_strength(new_password)
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if not verify_password(old_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect",
            )

        user.password_hash = hash_password(new_password)
        user.updated_at = datetime.now(timezone.utc)
        await db.commit()

        return {"message": "Password changed successfully"}
