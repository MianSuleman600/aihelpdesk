"""
API v1 Router - aggregates all endpoint routers.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, kb, tickets, ai, notifications, analytics, admin, documents, settings

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(kb.router, prefix="/kb", tags=["Knowledge Base"])
api_router.include_router(tickets.router, prefix="/tickets", tags=["Tickets"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Assistant"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
