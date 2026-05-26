"""Tests for ticket endpoints."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestTickets:
    """Test ticket CRUD, status transitions, assignment, messages."""

    async def test_create_ticket(self, client: AsyncClient, user_token, test_category):
        resp = await client.post("/api/v1/tickets/", json={
            "subject": "Test ticket",
            "description": "This is a test ticket",
            "priority": "medium",
            "category_id": test_category.id,
        }, headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["subject"] == "Test ticket"
        assert data["status"] == "open"
        assert data["priority"] == "medium"
        assert "id" in data

    async def test_list_tickets_user(self, client: AsyncClient, user_token, test_category):
        for i in range(3):
            await client.post("/api/v1/tickets/", json={
                "subject": f"Ticket {i}", "description": f"This is ticket description {i}",
                "category_id": test_category.id,
            }, headers={"Authorization": f"Bearer {user_token}"})
        resp = await client.get("/api/v1/tickets/", headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 3
        assert len(data["items"]) == 3

    async def test_list_tickets_admin_sees_all(self, client: AsyncClient, admin_token, user_token, test_category):
        await client.post("/api/v1/tickets/", json={
            "subject": "User ticket", "description": "This is a user ticket description",
            "category_id": test_category.id,
        }, headers={"Authorization": f"Bearer {user_token}"})
        resp = await client.get("/api/v1/tickets/", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    async def test_get_ticket(self, client: AsyncClient, user_token, test_category):
        create = await client.post("/api/v1/tickets/", json={
            "subject": "Get test", "description": "This is a get ticket description",
            "category_id": test_category.id,
        }, headers={"Authorization": f"Bearer {user_token}"})
        tid = create.json()["id"]
        resp = await client.get(f"/api/v1/tickets/{tid}", headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 200
        assert resp.json()["id"] == tid

    async def test_get_ticket_unauthorized(self, client: AsyncClient, user_token, admin_token, test_category):
        create = await client.post("/api/v1/tickets/", json={
            "subject": "Private", "description": "This is a private ticket description",
            "category_id": test_category.id,
        }, headers={"Authorization": f"Bearer {user_token}"})
        tid = create.json()["id"]
        # other user should not see this ticket
        resp = await client.get(f"/api/v1/tickets/{tid}", headers={"Authorization": f"Bearer {admin_token}"})
        # Admin can see all tickets, so it should succeed
        assert resp.status_code == 200

    async def test_update_ticket_status(self, client: AsyncClient, admin_token, test_category):
        create = await client.post("/api/v1/tickets/", json={
            "subject": "Status test", "description": "This is a status ticket description",
            "category_id": test_category.id,
        }, headers={"Authorization": f"Bearer {admin_token}"})
        tid = create.json()["id"]
        resp = await client.patch(f"/api/v1/tickets/{tid}", json={
            "status": "in_progress",
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    async def test_invalid_status_transition(self, client: AsyncClient, admin_token, test_category):
        create = await client.post("/api/v1/tickets/", json={
            "subject": "FSM test", "description": "This is a FSM transition test description",
            "category_id": test_category.id,
        }, headers={"Authorization": f"Bearer {admin_token}"})
        tid = create.json()["id"]
        # open -> resolved (not allowed directly, must go through in_progress)
        resp = await client.patch(f"/api/v1/tickets/{tid}", json={
            "status": "resolved",
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 400

    async def test_assign_ticket(self, client: AsyncClient, admin_token, user_token, test_category):
        create = await client.post("/api/v1/tickets/", json={
            "subject": "Assign test", "description": "This is an assign ticket description",
            "category_id": test_category.id,
        }, headers={"Authorization": f"Bearer {user_token}"})
        tid = create.json()["id"]

        # Get the admin user ID
        me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
        admin_id = me.json()["id"]

        resp = await client.post(f"/api/v1/tickets/{tid}/assign", json={
            "assigned_to_id": admin_id,
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.json()["assigned_to_id"] == admin_id

    async def test_add_message(self, client: AsyncClient, user_token, test_category):
        create = await client.post("/api/v1/tickets/", json={
            "subject": "Message test", "description": "This is a message test description",
            "category_id": test_category.id,
        }, headers={"Authorization": f"Bearer {user_token}"})
        tid = create.json()["id"]
        resp = await client.post(f"/api/v1/tickets/{tid}/messages", json={
            "message": "This is a reply",
        }, headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 201
        assert resp.json()["message"] == "This is a reply"

    async def test_add_internal_message_denied_for_user(self, client: AsyncClient, user_token, test_category):
        create = await client.post("/api/v1/tickets/", json={
            "subject": "Internal test", "description": "This is an internal ticket description",
            "category_id": test_category.id,
        }, headers={"Authorization": f"Bearer {user_token}"})
        tid = create.json()["id"]
        resp = await client.post(f"/api/v1/tickets/{tid}/messages", json={
            "message": "Internal note",
            "is_internal": True,
        }, headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 403

    async def test_close_ticket(self, client: AsyncClient, user_token, test_category):
        create = await client.post("/api/v1/tickets/", json={
            "subject": "Close test", "description": "This is a close ticket description",
            "category_id": test_category.id,
        }, headers={"Authorization": f"Bearer {user_token}"})
        tid = create.json()["id"]
        resp = await client.post(f"/api/v1/tickets/{tid}/close", headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "closed"

    async def test_reopen_ticket(self, client: AsyncClient, user_token, test_category):
        create = await client.post("/api/v1/tickets/", json={
            "subject": "Reopen test", "description": "This is a reopen ticket description",
            "category_id": test_category.id,
        }, headers={"Authorization": f"Bearer {user_token}"})
        tid = create.json()["id"]
        await client.post(f"/api/v1/tickets/{tid}/close", headers={"Authorization": f"Bearer {user_token}"})
        resp = await client.post(f"/api/v1/tickets/{tid}/reopen", headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "open"

    async def test_ticket_events(self, client: AsyncClient, user_token, test_category):
        create = await client.post("/api/v1/tickets/", json={
            "subject": "Events test", "description": "This is an events ticket description",
            "category_id": test_category.id,
        }, headers={"Authorization": f"Bearer {user_token}"})
        tid = create.json()["id"]
        resp = await client.get(f"/api/v1/tickets/{tid}/events", headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 200
        events = resp.json()
        assert len(events) >= 1
        assert events[0]["event_type"] == "created"
