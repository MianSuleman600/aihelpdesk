"""
Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from app.models.models import UserRole, TicketStatus, Priority, FeedbackRating


# ============================================================
# Auth Schemas
# ============================================================

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Full name")
    email: EmailStr = Field(..., description="Email address")
    password: str = Field(..., min_length=8, max_length=128, description="Password (minimum 8 characters)")
    role: Optional[UserRole] = UserRole.USER


class UserLogin(BaseModel):
    email: EmailStr = Field(..., description="Email address")
    password: str = Field(..., description="Password")


class PasswordResetRequest(BaseModel):
    email: EmailStr = Field(..., description="Email address for password reset")


class PasswordReset(BaseModel):
    access_token: str = Field(..., description="Access token from reset email")
    new_password: str = Field(..., min_length=8, max_length=128, description="New password (minimum 8 characters)")


class PasswordChange(BaseModel):
    old_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, max_length=128, description="New password (minimum 8 characters)")


class Token(BaseModel):
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field("bearer", description="Token type")
    expires_in: Optional[int] = Field(None, description="Token expiration time in seconds")


class TokenData(BaseModel):
    user_id: str
    role: UserRole


class UserResponse(BaseModel):
    id: str = Field(..., description="User ID")
    name: str = Field(..., description="User name")
    email: str = Field(..., description="User email")
    role: UserRole = Field(..., description="User role")
    avatar_url: Optional[str] = Field(None, description="Avatar URL")
    is_active: bool = Field(True, description="Account active status")
    created_at: datetime = Field(..., description="Account creation date")

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100, description="Full name")
    avatar_url: Optional[str] = Field(None, description="Avatar URL")

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    message: str = Field(..., description="Response message")
    user: Optional[UserResponse] = Field(None, description="User details")


class MessageResponse(BaseModel):
    message: str = Field(..., description="Response message")


# ============================================================
# Category Schemas
# ============================================================

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = None


class CategoryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# KB Article Schemas
# ============================================================

class KBArticleCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    body: str = Field(..., min_length=10)
    category_id: Optional[str] = None
    tags: Optional[List[str]] = []
    is_published: Optional[bool] = False


class KBArticleUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    category_id: Optional[str] = None
    tags: Optional[List[str]] = None
    is_published: Optional[bool] = None


class KBArticleResponse(BaseModel):
    id: str
    title: str
    body: str
    category_id: Optional[str] = None
    tags: List[str] = []
    created_by_id: str
    is_published: bool
    view_count: int
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# Ticket Schemas
# ============================================================

class TicketCreate(BaseModel):
    subject: str = Field(..., min_length=3, max_length=300)
    description: str = Field(..., min_length=10)
    priority: Optional[Priority] = Priority.MEDIUM
    category_id: Optional[str] = None


class TicketUpdate(BaseModel):
    status: Optional[TicketStatus] = None
    priority: Optional[Priority] = None
    assigned_to_id: Optional[str] = None
    category_id: Optional[str] = None


class UserBrief(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole

    class Config:
        from_attributes = True


class TicketResponse(BaseModel):
    id: str
    subject: str
    description: str
    status: TicketStatus
    priority: Priority
    category_id: Optional[str] = None
    created_by_id: str
    assigned_to_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    created_by: Optional[UserBrief] = None
    assigned_to: Optional[UserBrief] = None

    class Config:
        from_attributes = True


class TicketMessageCreate(BaseModel):
    message: str = Field(..., min_length=1)
    is_internal: Optional[bool] = False


class TicketMessageResponse(BaseModel):
    id: str
    ticket_id: str
    sender_id: str
    message: str
    is_internal: bool
    is_ai_draft: bool
    created_at: datetime
    sender_name: Optional[str] = None

    class Config:
        from_attributes = True


class TicketAssign(BaseModel):
    assigned_to_id: str = Field(..., description="User ID to assign the ticket to")


# ============================================================
# Document Upload Schemas
# ============================================================

class DocumentResponse(BaseModel):
    id: str
    title: str
    filename: str
    file_type: str
    file_size: int
    status: str
    error_message: Optional[str] = None
    chunk_count: int = 0
    uploaded_by_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int
    limit: int = 50
    max_documents: int = 50


class DocumentUploadResponse(BaseModel):
    message: str
    document: DocumentResponse


class ReindexResponse(BaseModel):
    message: str
    status: str
    chunk_count: int


# ============================================================
# AI Chat Schemas
# ============================================================

class AIChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None


class AIChatSource(BaseModel):
    article_id: str
    title: str
    relevance_score: float
    snippet: str


class AIChatResponse(BaseModel):
    answer: str
    sources: List[AIChatSource] = []
    confidence: float = 0.0
    session_id: str
    suggest_ticket: bool = False


class AISummarizeRequest(BaseModel):
    ticket_id: str


class AIDraftReplyRequest(BaseModel):
    ticket_id: str


# ============================================================
# AI Feedback Schemas
# ============================================================

class AIFeedbackCreate(BaseModel):
    context_type: str = Field(..., pattern="^(chat|ticket)$")
    context_id: Optional[str] = None
    query: str
    response: str
    rating: FeedbackRating
    notes: Optional[str] = None


class AIFeedbackResponse(BaseModel):
    id: str
    user_id: str
    context_type: str
    rating: FeedbackRating
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# Notification Schemas
# ============================================================

class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# Analytics Schemas
# ============================================================

class AnalyticsOverview(BaseModel):
    total_tickets: int
    open_tickets: int
    resolved_tickets: int
    avg_resolution_hours: float
    total_articles: int
    ai_satisfaction_percent: float
    tickets_by_status: dict
    tickets_by_category: dict
    ai_feedback_summary: dict
