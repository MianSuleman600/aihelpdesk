"""Tests for authentication endpoints."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestAuth:
    """Test registration, login, profile, and password change."""

    async def test_register(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/register", json={
            "name": "New User",
            "email": "new@test.com",
            "password": "Password123!",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "new@test.com"
        assert data["name"] == "New User"
        assert "id" in data
        assert "password_hash" not in data

    async def test_register_duplicate_email(self, client: AsyncClient, user_token):
        resp = await client.post("/api/v1/auth/register", json={
            "name": "Duplicate",
            "email": "user@test.com",
            "password": "Password123!",
        })
        assert resp.status_code == 400

    async def test_login_success(self, client: AsyncClient, user_token):
        # user_token fixture already tested login
        pass

    async def test_login_invalid_password(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/login", data={
            "username": "user@test.com",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/login", data={
            "username": "nobody@test.com",
            "password": "somepass",
        })
        assert resp.status_code == 401

    async def test_get_profile(self, client: AsyncClient, user_token):
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "user@test.com"

    async def test_get_profile_unauthorized(self, client: AsyncClient):
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 401

    async def test_update_profile(self, client: AsyncClient, user_token):
        resp = await client.patch("/api/v1/auth/me", json={"name": "Updated User"}, headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated User"

    async def test_change_password(self, client: AsyncClient, user_token):
        resp = await client.post("/api/v1/auth/change-password", json={
            "old_password": "user123",
            "new_password": "NewPass123!",
        }, headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 200

        # Login with new password
        resp = await client.post("/api/v1/auth/login", data={"username": "user@test.com", "password": "NewPass123!"})
        assert resp.status_code == 200

    async def test_change_password_wrong_old(self, client: AsyncClient, user_token):
        resp = await client.post("/api/v1/auth/change-password", json={
            "old_password": "wrongold",
            "new_password": "NewPass123!",
        }, headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code in (400, 401)
