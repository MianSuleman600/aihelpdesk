# AI-Powered Helpdesk & Knowledge Base Portal - Backend

## Quick Start

```bash
# 1. Create virtual environment
python -m venv venv
.venv\Scripts\Activate.ps1  

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy environment file
copy .env.example .env
# Edit .env with your actual credentials

# 4. Setup database
# Make sure PostgreSQL is running
# Create database: CREATE DATABASE aihelpdesk;

# 5. Run migrations
alembic upgrade head

# 6. Start server
uvicorn main:app --reload --port 8000
```

## API Docs
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Tech Stack
- **FastAPI** - Async Python web framework
- **SQLAlchemy** - ORM with async support
- **Alembic** - Database migrations
- **PostgreSQL** - Relational database
- **Pinecone** - Vector database for RAG
- **LangChain + OpenAI** - AI/RAG pipeline
- **JWT + bcrypt** - Authentication
