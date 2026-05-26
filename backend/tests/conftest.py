"""Pytest fixtures for API tests."""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select

from app.db.base import Base
from app.db.session import get_db
from app.core.security import hash_password
from app.core.rate_limiter import rate_limiter
from app.models.models import User, UserRole, Category
from main import app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestAsyncSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_db():
    async with TestAsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    rate_limiter._store.clear()
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session(setup_db):
    async with TestAsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(setup_db):
    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_token(client, setup_db):
    async with TestAsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == "admin@test.com"))
        user = existing.scalar_one_or_none()
        if not user:
            user = User(
                name="Test Admin",
                email="admin@test.com",
                password_hash=hash_password("admin123"),
                role=UserRole.ADMIN,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
    resp = await client.post("/api/v1/auth/login", data={"username": "admin@test.com", "password": "admin123"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest_asyncio.fixture
async def agent_token(client, setup_db):
    async with TestAsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == "agent@test.com"))
        user = existing.scalar_one_or_none()
        if not user:
            user = User(
                name="Test Agent",
                email="agent@test.com",
                password_hash=hash_password("agent123"),
                role=UserRole.AGENT,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
    resp = await client.post("/api/v1/auth/login", data={"username": "agent@test.com", "password": "agent123"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest_asyncio.fixture
async def user_token(client, setup_db):
    async with TestAsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == "user@test.com"))
        user = existing.scalar_one_or_none()
        if not user:
            user = User(
                name="Test User",
                email="user@test.com",
                password_hash=hash_password("user123"),
                role=UserRole.USER,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
    resp = await client.post("/api/v1/auth/login", data={"username": "user@test.com", "password": "user123"})
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest_asyncio.fixture
async def test_category(db_session):
    cat = Category(name="Test Category", description="For testing")
    db_session.add(cat)
    await db_session.commit()
    await db_session.refresh(cat)
    return cat
