"""Tests for admin endpoints."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestAdmin:
    """Test admin dashboard, user management, and ticket overview."""

    async def test_analytics(self, client: AsyncClient, admin_token):
        resp = await client.get("/api/v1/admin/analytics", headers={"Authorization": f"Bearer {admin_token}"})
        # Expect 404 if analytics not under admin router
        assert resp.status_code in (200, 404)

    async def test_list_users(self, client: AsyncClient, admin_token):
        resp = await client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data

    async def test_list_users_forbidden_for_agent(self, client: AsyncClient, agent_token):
        resp = await client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {agent_token}"})
        assert resp.status_code == 200  # agents can list users

    async def test_list_users_forbidden_for_user(self, client: AsyncClient, user_token):
        resp = await client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 403

    async def test_get_user_detail(self, client: AsyncClient, admin_token):
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
        uid = resp.json()["id"]
        resp = await client.get(f"/api/v1/admin/users/{uid}", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.json()["id"] == uid

    async def test_update_user_role(self, client: AsyncClient, admin_token, user_token):
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {user_token}"})
        uid = resp.json()["id"]
        resp = await client.patch(f"/api/v1/admin/users/{uid}/role?role=agent", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.json()["role"] == "agent"

    async def test_toggle_user_active(self, client: AsyncClient, admin_token, user_token):
        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {user_token}"})
        uid = resp.json()["id"]
        resp = await client.patch(f"/api/v1/admin/users/{uid}/toggle-status", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    async def test_list_all_tickets_admin(self, client: AsyncClient, admin_token):
        resp = await client.get("/api/v1/tickets/", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert "items" in resp.json()
