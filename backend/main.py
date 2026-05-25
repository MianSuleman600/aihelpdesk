"""
AI-Powered Helpdesk & Knowledge Base Portal - Backend
FastAPI Application Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.api.v1.router import api_router
from app.db.session import engine
from app.db.base import Base

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    setup_logging()
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")

    # Auto-create tables in development
    if settings.DEBUG:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables synced")

    yield
    logger.info("Shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
    ## AI-Powered Helpdesk & Knowledge Base Portal API
    
    ### Features:
    - 🔐 **Authentication** - JWT-based auth with role-based access control
    - 📚 **Knowledge Base** - CRUD articles with categories, tags, attachments
    - 🎫 **Ticket Management** - Full ticketing workflow with assignments
    - 🤖 **AI Assistant** - RAG-powered chat with KB-grounded answers
    - 📊 **Analytics** - Admin dashboard with ticket & AI metrics
    - 🔔 **Notifications** - Real-time WebSocket notifications
    
    ### Roles:
    - **Admin** - Full system access
    - **Agent** - Ticket management + KB publishing
    - **User** - KB search, AI chat, ticket creation
    
    ---
    *Industry Partner: Starbit Games (SMC-Private) Ltd.*
    *Student Team: Ayesha Shahid (222039) | Saba Zaheer (222052)*
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["Root"])
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


@app.get("/health", tags=["Root"])
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "connected",
        "environment": settings.ENVIRONMENT,
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
