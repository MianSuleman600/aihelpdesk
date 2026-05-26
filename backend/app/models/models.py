"""
SQLAlchemy Models for the AI Helpdesk Portal.
All database tables are defined here.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, DateTime,
    ForeignKey, Enum as SQLEnum, JSON
)
from sqlalchemy.orm import relationship
import enum

from app.db.base import Base


# ============================================================
# Enums
# ============================================================

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    AGENT = "agent"
    USER = "user"


class TicketStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING = "waiting"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Priority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class FeedbackRating(str, enum.Enum):
    HELPFUL = "helpful"
    UNHELPFUL = "unhelpful"


# ============================================================
# Helper
# ============================================================

def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ============================================================
# Models
# ============================================================

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.USER, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    articles = relationship("KBArticle", back_populates="created_by_user", lazy="selectin")
    created_tickets = relationship("Ticket", foreign_keys="Ticket.created_by_id", back_populates="created_by_user", lazy="selectin")
    assigned_tickets = relationship("Ticket", foreign_keys="Ticket.assigned_to_id", back_populates="assigned_to_user", lazy="selectin")
    messages = relationship("TicketMessage", back_populates="sender", lazy="selectin")
    feedbacks = relationship("AIFeedback", back_populates="user", lazy="selectin")
    notifications = relationship("Notification", back_populates="user", lazy="selectin")
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    notification_email = Column(Boolean, default=True, nullable=False)
    notification_browser = Column(Boolean, default=True, nullable=False)
    notification_ticket_updates = Column(Boolean, default=False, nullable=False)
    theme = Column(String(20), default="system", nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="settings")


class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    articles = relationship("KBArticle", back_populates="category", lazy="selectin")
    tickets = relationship("Ticket", back_populates="category", lazy="selectin")


class KBArticle(Base):
    __tablename__ = "kb_articles"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String(300), nullable=False, index=True)
    body = Column(Text, nullable=False)
    category_id = Column(String, ForeignKey("categories.id"), nullable=True)
    tags = Column(JSON, default=list)
    created_by_id = Column(String, ForeignKey("users.id"), nullable=False)
    is_published = Column(Boolean, default=False)
    view_count = Column(Integer, default=0)
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    category = relationship("Category", back_populates="articles")
    created_by_user = relationship("User", back_populates="articles")
    attachments = relationship("KBAttachment", back_populates="article", cascade="all, delete-orphan", lazy="selectin")


class KBAttachment(Base):
    __tablename__ = "kb_attachments"

    id = Column(String, primary_key=True, default=generate_uuid)
    article_id = Column(String, ForeignKey("kb_articles.id", ondelete="CASCADE"), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer, nullable=False)  # bytes
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    article = relationship("KBArticle", back_populates="attachments")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(String, primary_key=True, default=generate_uuid)
    subject = Column(String(300), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(SQLEnum(TicketStatus), default=TicketStatus.OPEN, nullable=False, index=True)
    priority = Column(SQLEnum(Priority), default=Priority.MEDIUM, nullable=False)
    category_id = Column(String, ForeignKey("categories.id"), nullable=True)
    created_by_id = Column(String, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    category = relationship("Category", back_populates="tickets")
    created_by_user = relationship("User", foreign_keys=[created_by_id], back_populates="created_tickets")
    assigned_to_user = relationship("User", foreign_keys=[assigned_to_id], back_populates="assigned_tickets")
    messages = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan", lazy="selectin", order_by="TicketMessage.created_at")
    attachments = relationship("TicketAttachment", back_populates="ticket", cascade="all, delete-orphan", lazy="selectin")
    events = relationship("TicketEvent", back_populates="ticket", cascade="all, delete-orphan", lazy="selectin", order_by="TicketEvent.created_at")

    @property
    def created_by(self):
        return self.created_by_user

    @property
    def assigned_to(self):
        return self.assigned_to_user


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    ticket_id = Column(String, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)  # Internal notes visible only to agents
    is_ai_draft = Column(Boolean, default=False)  # AI-generated draft
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    ticket = relationship("Ticket", back_populates="messages")
    sender = relationship("User", back_populates="messages")


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"

    id = Column(String, primary_key=True, default=generate_uuid)
    ticket_id = Column(String, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    ticket = relationship("Ticket", back_populates="attachments")


class AIFeedback(Base):
    __tablename__ = "ai_feedback"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    context_type = Column(String(20), nullable=False)  # "chat" or "ticket"
    context_id = Column(String, nullable=True)
    query = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    rating = Column(SQLEnum(FeedbackRating), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    user = relationship("User", back_populates="feedbacks")


class UploadedDocumentStatus(str, enum.Enum):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class UploadedDocument(Base):
    """
    Tracks uploaded documents for RAG indexing.
    Admin/agents upload files → they get processed, chunked, indexed into Pinecone.
    """
    __tablename__ = "uploaded_documents"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String(300), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer, nullable=False)
    status = Column(SQLEnum(UploadedDocumentStatus), default=UploadedDocumentStatus.PROCESSING, nullable=False)
    error_message = Column(Text, nullable=True)
    chunk_count = Column(Integer, default=0)
    uploaded_by_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    uploaded_by = relationship("User", lazy="selectin")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(500), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    user = relationship("User", back_populates="notifications")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", lazy="selectin", order_by="ChatMessage.created_at")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)  # List of cited KB article IDs
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")


class AuditLog(Base):
    """
    Audit trail for sensitive operations.
    Tracks who did what, when, and from where.
    """
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class TicketEventType(str, enum.Enum):
    CREATED = "created"
    STATUS_CHANGED = "status_changed"
    ASSIGNED = "assigned"
    UNASSIGNED = "unassigned"
    PRIORITY_CHANGED = "priority_changed"
    CATEGORY_CHANGED = "category_changed"
    REOPENED = "reopened"
    RESOLVED = "resolved"
    CLOSED = "closed"
    NOTE_ADDED = "note_added"


class TicketEvent(Base):
    """
    Tracks status/assignment/priority changes on tickets for timeline view.
    """
    __tablename__ = "ticket_events"

    id = Column(String, primary_key=True, default=generate_uuid)
    ticket_id = Column(String, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    event_type = Column(SQLEnum(TicketEventType), nullable=False)
    old_value = Column(String(100), nullable=True)
    new_value = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    # Relationships
    ticket = relationship("Ticket", lazy="selectin")
    user = relationship("User", lazy="selectin")
