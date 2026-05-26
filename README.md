# AI-Powered Helpdesk & Knowledge Base Portal

Full-stack helpdesk system with AI-powered chat, knowledge base, ticket management, and analytics.

## Tech Stack

| Layer    | Technology                                              |
| -------- | ------------------------------------------------------- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS          |
| Backend  | Python 3.12+, FastAPI, SQLAlchemy (async), Alembic      |
| Database | PostgreSQL (async via asyncpg)                          |
| AI       | LangChain + OpenRouter (free models) / OpenAI fallback  |
| Vectors  | Pinecone (free tier, hybrid search)                     |
| Auth     | JWT (access + refresh tokens), bcrypt                   |

## Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 15+
- (Optional) Pinecone account — free tier works
- (Optional) OpenRouter API key (free) or OpenAI API key

## Quick Start

### 1. Clone & enter

```bash
git clone <repo-url>
cd AiHelpDesk
```

### 2. Backend setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Environment config
copy .env.example .env      # Windows
# cp .env.example .env       # Linux/Mac
```

Edit `.env` with your credentials — at minimum set:
- `DATABASE_URL` — your PostgreSQL connection string
- `SECRET_KEY` — a random 64-char string
- `OPENROUTER_API_KEY` — for AI chat (get free key at https://openrouter.ai/keys)
- `PINECONE_API_KEY` — for vector search (optional, free tier at https://pinecone.io)

### 3. Database

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE aihelpdesk;"

# Run migrations
alembic upgrade head

# (Optional) Seed sample KB articles
python upload_docs.py
```

### 4. Start backend

```bash
uvicorn main:app --reload --port 8000
```

API docs at http://localhost:8000/docs

### 5. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Environment config
copy .env.example .env.local  # Windows
# cp .env.example .env.local   # Linux/Mac

# Start dev server
npm run dev
```

Open http://localhost:3000

## Default Admin User

Register via the app at `/auth/register`, then set your role to `admin` directly in the database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

## Project Structure

```
AiHelpDesk/
├── backend/
│   ├── alembic/              # Database migrations
│   ├── app/
│   │   ├── api/v1/endpoints/ # Route handlers
│   │   ├── core/             # Config, security, model router
│   │   ├── db/               # Database session
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   └── services/         # Business logic (AI, embeddings, etc.)
│   ├── .env.example
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router pages
│   │   ├── components/       # Reusable UI components
│   │   ├── context/          # React contexts (auth)
│   │   ├── lib/              # API client, utilities
│   │   └── types/            # TypeScript types
│   ├── .env.example
│   └── package.json
└── README.md
```

## Database Migrations

```bash
cd backend
.venv\Scripts\activate

# Create a new migration after model changes
alembic revision --autogenerate -m "description"

# Apply all pending migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1

# View history
alembic history
```

## Available Scripts

### Backend

```bash
uvicorn main:app --reload --port 8000   # Dev server with hot reload
python upload_docs.py                    # Seed KB articles from .txt files
```

### Frontend

```bash
npm run dev     # Dev server on port 3000
npm run build   # Production build
npm run lint    # ESLint
```

## Key Features

- **Ticket Management** — Create, assign, update status, filter by priority/category/search
- **AI Chat Assistant** — RAG-grounded answers from knowledge base, session history, streaming
- **Knowledge Base** — Markdown articles with categories, tags, publish/draft workflow
- **Admin Panel** — User management, role control, document uploads for AI training
- **Notifications** — In-app + email, per-event opt-in
- **Analytics** — Ticket volume, resolution times, category breakdown
- **Audit Logging** — Role changes, user status toggles, deletions

## API Documentation

Once the backend is running:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
