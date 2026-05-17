"""Models package initialization - import all models for Alembic."""
from app.models.models import (
    User, Category, KBArticle, KBAttachment,
    Ticket, TicketMessage, TicketAttachment,
    AIFeedback, Notification, ChatSession, ChatMessage,
    UserRole, TicketStatus, Priority, FeedbackRating,
)

__all__ = [
    "User", "Category", "KBArticle", "KBAttachment",
    "Ticket", "TicketMessage", "TicketAttachment",
    "AIFeedback", "Notification", "ChatSession", "ChatMessage",
    "UserRole", "TicketStatus", "Priority", "FeedbackRating",
]
