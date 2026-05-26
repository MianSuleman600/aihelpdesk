"""
Application configuration loaded from environment variables.
"""

import secrets
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # Application
    APP_NAME: str = "AI-HelpDesk-Portal"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/aihelpdesk"
    DATABASE_URL_SYNC: str = "postgresql://postgres:password@localhost:5432/aihelpdesk"

    # JWT Authentication
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        object.__setattr__(self, '_jwt_secret_cache', None)

    @property
    def jwt_secret(self) -> str:
        cached = object.__getattribute__(self, '_jwt_secret_cache')
        if cached is not None:
            return cached
        if not self.SECRET_KEY or self.SECRET_KEY == "your-super-secret-key-change-in-production":
            import warnings
            generated = secrets.token_urlsafe(32)
            warnings.warn(
                f"SECRET_KEY not set or using default. Generated random key: {generated}. "
                "Set SECRET_KEY in .env for production.",
                RuntimeWarning,
                stacklevel=1,
            )
            object.__setattr__(self, '_jwt_secret_cache', generated)
            return generated
        object.__setattr__(self, '_jwt_secret_cache', self.SECRET_KEY)
        return self.SECRET_KEY

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Pinecone Vector DB
    PINECONE_API_KEY: str = ""
    PINECONE_ENVIRONMENT: str = "us-east-1"
    PINECONE_INDEX_NAME: str = "helpdesk-kb"
    PINECONE_EMBEDDING_DIMENSION: int = 1536

    # OpenRouter (OpenAI-compatible, for free LLM models)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL: str = "deepseek/deepseek-chat"
    OPENROUTER_EMBEDDING_MODEL: str = "nvidia/llama-nemotron-embed-vl-1b-v2:free"
    # Fallback: if OpenRouter key is empty, use OpenAI directly
    LLM_PROVIDER: str = "openrouter"  # "openrouter" or "openai"

    # Document Upload Limits
    MAX_DOCUMENTS_PER_ADMIN: int = 50
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_EXTENSIONS: list = [".pdf", ".docx", ".txt"]
    UPLOAD_DIR: str = "uploads/documents"
    KB_UPLOAD_DIR: str = "uploads/kb"
    TICKET_UPLOAD_DIR: str = "uploads/tickets"

    # Supabase
    SUPABASE_URL: str = "https://your-project.supabase.co"
    SUPABASE_KEY: str = "your-supabase-anon-key"
    SUPABASE_SERVICE_KEY: str = "your-supabase-service-key"

    # SMTP (Email)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "HelpDesk AI"
    SMTP_USE_TLS: bool = True

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
