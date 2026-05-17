"""
Authentication service layer for handling user auth operations.
Integrates with Supabase for user management and local database for profiles.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import User, UserRole
from app.schemas.schemas import UserRegister, UserResponse, Token
from app.core.security import hash_password, verify_password, create_access_token
from app.core.supabase import supabase, supabase_admin


class AuthService:
    """Service layer for authentication operations."""

    @staticmethod
    async def register_user(
        user_data: UserRegister,
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """
        Register a new user with Supabase and local database.
        
        Args:
            user_data: Registration data with email, password, name
            db: Database session
            
        Returns:
            Dictionary with user info and message
            
        Raises:
            HTTPException: If email already exists or registration fails
        """
        # Check if user already exists in local DB
        result = await db.execute(select(User).where(User.email == user_data.email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        try:
            # Create user in Supabase Auth
            auth_response = supabase.auth.sign_up({
                "email": user_data.email,
                "password": user_data.password,
                "options": {
                    "data": {
                        "full_name": user_data.name,
                        "role": user_data.role.value
                    }
                }
            })

            supabase_user = auth_response.user
            if not supabase_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to create Supabase user",
                )

            # Create user in local database
            user = User(
                id=supabase_user.id,
                name=user_data.name,
                email=user_data.email,
                password_hash=hash_password(user_data.password),
                role=user_data.role,
                is_active=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

            return {
                "message": "User registered successfully. Please check your email to confirm.",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name,
                    "role": user.role.value,
                }
            }

        except Exception as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Registration failed: {str(e)}",
            )

    @staticmethod
    async def login_user(
        email: str,
        password: str,
        db: AsyncSession,
    ) -> Token:
        """
        Authenticate user with Supabase and return JWT token.
        
        Args:
            email: User email
            password: User password
            db: Database session
            
        Returns:
            Token with access_token and token_type
            
        Raises:
            HTTPException: If credentials are invalid
        """
        try:
            # Authenticate with Supabase
            auth_response = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password,
            })

            session = auth_response.session
            if not session or not session.access_token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials",
                )

            # Get user from local database
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found in database",
                )

            if not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User account is deactivated",
                )

            # Create JWT token with user info
            access_token = create_access_token(
                data={
                    "sub": user.id,
                    "email": user.email,
                    "role": user.role.value,
                    "supabase_token": session.access_token,
                }
            )

            return Token(
                access_token=access_token,
                token_type="bearer"
            )

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Login failed: {str(e)}",
            )

    @staticmethod
    async def request_password_reset(
        email: str,
        db: AsyncSession,
    ) -> Dict[str, str]:
        """
        Request password reset via Supabase email.
        
        Args:
            email: User email
            db: Database session
            
        Returns:
            Message confirming reset email sent
            
        Raises:
            HTTPException: If user not found
        """
        # Check if user exists
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            # For security, don't reveal if email exists
            return {"message": "If an account exists, password reset email has been sent"}

        try:
            # Send reset password email via Supabase
            supabase.auth.reset_password_for_email(email)

            return {
                "message": "Password reset email sent. Please check your inbox.",
            }

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to send reset email: {str(e)}",
            )

    @staticmethod
    async def reset_password(
        access_token: str,
        new_password: str,
        db: AsyncSession,
    ) -> Dict[str, str]:
        """
        Reset user password using access token from email reset link.
        
        Args:
            access_token: Access token from reset email
            new_password: New password
            db: Database session
            
        Returns:
            Message confirming password reset
            
        Raises:
            HTTPException: If password reset fails
        """
        try:
            # Update password in Supabase
            supabase.auth.update_user(
                {
                    "password": new_password,
                },
                access_token,
            )

            # Get user from Supabase JWT to find local user
            user_data = supabase.auth.get_user(access_token)
            if not user_data or not user_data.user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token",
                )

            # Update local password hash
            result = await db.execute(
                select(User).where(User.id == user_data.user.id)
            )
            user = result.scalar_one_or_none()

            if user:
                user.password_hash = hash_password(new_password)
                await db.commit()

            return {
                "message": "Password reset successfully",
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Password reset failed: {str(e)}",
            )

    @staticmethod
    async def get_user_profile(
        user_id: str,
        db: AsyncSession,
    ) -> Optional[UserResponse]:
        """
        Get user profile by ID.
        
        Args:
            user_id: User ID
            db: Database session
            
        Returns:
            UserResponse with user info, or None if not found
        """
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def update_user_profile(
        user_id: str,
        name: Optional[str] = None,
        avatar_url: Optional[str] = None,
        db: AsyncSession = None,
    ) -> UserResponse:
        """
        Update user profile information.
        
        Args:
            user_id: User ID
            name: New name (optional)
            avatar_url: New avatar URL (optional)
            db: Database session
            
        Returns:
            Updated UserResponse
            
        Raises:
            HTTPException: If user not found
        """
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if name:
            user.name = name
        if avatar_url:
            user.avatar_url = avatar_url

        user.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(user)

        return user

    @staticmethod
    async def verify_email(
        email_token: str,
        db: AsyncSession,
    ) -> Dict[str, str]:
        """
        Verify user email using token from confirmation email.
        
        Args:
            email_token: Email verification token
            db: Database session
            
        Returns:
            Message confirming email verification
            
        Raises:
            HTTPException: If verification fails
        """
        try:
            # Verify token with Supabase
            user = supabase.auth.verify_otp({
                "email": None,
                "token": email_token,
                "type": "email_change"
            })

            return {
                "message": "Email verified successfully",
            }

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email verification failed: {str(e)}",
            )

    @staticmethod
    async def change_password(
        user_id: str,
        old_password: str,
        new_password: str,
        db: AsyncSession,
    ) -> Dict[str, str]:
        """
        Change password for authenticated user.
        
        Args:
            user_id: User ID
            old_password: Current password
            new_password: New password
            db: Database session
            
        Returns:
            Message confirming password change
            
        Raises:
            HTTPException: If password change fails
        """
        # Get user
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Verify old password
        if not verify_password(old_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Current password is incorrect",
            )

        try:
            # Update password in Supabase via admin
            supabase_admin.auth.admin_update_user_by_id(
                user_id,
                {"password": new_password}
            )

            # Update local password hash
            user.password_hash = hash_password(new_password)
            user.updated_at = datetime.now(timezone.utc)
            await db.commit()

            return {
                "message": "Password changed successfully",
            }

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Password change failed: {str(e)}",
            )
