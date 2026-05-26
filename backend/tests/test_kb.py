"""Tests for Knowledge Base endpoints."""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestKB:
    """Test KB articles CRUD and search."""

    async def test_create_article(self, client: AsyncClient, admin_token, test_category):
        resp = await client.post("/api/v1/kb/articles", json={
            "title": "Test Article",
            "body": "This is a test article body",
            "category_id": test_category.id,
            "is_published": True,
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Test Article"
        assert data["is_published"] is True
        assert "id" in data

    async def test_create_article_unauthorized(self, client: AsyncClient, user_token, test_category):
        resp = await client.post("/api/v1/kb/articles", json={
            "title": "Not allowed",
            "body": "This should fail due to authorization",
            "category_id": test_category.id,
        }, headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 403

    async def test_list_articles(self, client: AsyncClient, admin_token, test_category):
        for i in range(3):
            resp = await client.post("/api/v1/kb/articles", json={
                "title": f"Article {i}", "body": f"This is body for article {i}",
                "category_id": test_category.id, "is_published": True,
            }, headers={"Authorization": f"Bearer {admin_token}"})
            assert resp.status_code == 201, f"POST {i} failed: {resp.status_code} {resp.text[:200]}"
        resp = await client.get("/api/v1/kb/articles", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 3

    async def test_search_articles(self, client: AsyncClient, admin_token, test_category):
        await client.post("/api/v1/kb/articles", json={
            "title": "Password Reset Guide",
            "body": "How to reset your password step by step guide here",
            "category_id": test_category.id, "is_published": True,
        }, headers={"Authorization": f"Bearer {admin_token}"})
        resp = await client.get("/api/v1/kb/articles?search=password", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1

    async def test_get_article(self, client: AsyncClient, admin_token, test_category):
        create = await client.post("/api/v1/kb/articles", json={
            "title": "Get test", "body": "This is the get article body text",
            "category_id": test_category.id, "is_published": True,
        }, headers={"Authorization": f"Bearer {admin_token}"})
        aid = create.json()["id"]
        resp = await client.get(f"/api/v1/kb/articles/{aid}")
        assert resp.status_code == 200
        assert resp.json()["title"] == "Get test"

    async def test_update_article(self, client: AsyncClient, admin_token, test_category):
        create = await client.post("/api/v1/kb/articles", json={
            "title": "Update test", "body": "This is the update article body text",
            "category_id": test_category.id, "is_published": True,
        }, headers={"Authorization": f"Bearer {admin_token}"})
        aid = create.json()["id"]
        resp = await client.put(f"/api/v1/kb/articles/{aid}", json={
            "title": "Updated Title",
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated Title"

    async def test_delete_article(self, client: AsyncClient, admin_token, test_category):
        create = await client.post("/api/v1/kb/articles", json={
            "title": "Delete test", "body": "This is the delete article body text",
            "category_id": test_category.id, "is_published": True,
        }, headers={"Authorization": f"Bearer {admin_token}"})
        aid = create.json()["id"]
        resp = await client.delete(f"/api/v1/kb/articles/{aid}", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 204

    async def test_categories_list(self, client: AsyncClient):
        resp = await client.get("/api/v1/kb/categories")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_create_category(self, client: AsyncClient, admin_token):
        resp = await client.post("/api/v1/kb/categories", json={
            "name": "New Category",
            "description": "Test category",
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 201
        assert resp.json()["name"] == "New Category"

    async def test_update_category(self, client: AsyncClient, admin_token):
        create = await client.post("/api/v1/kb/categories", json={
            "name": "Cat to Update", "description": "Original description text for update",
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert create.status_code == 201
        cid = create.json()["id"]
        resp = await client.put(f"/api/v1/kb/categories/{cid}", json={
            "name": "Updated Category",
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Category"

    async def test_delete_category(self, client: AsyncClient, admin_token):
        create = await client.post("/api/v1/kb/categories", json={
            "name": "Cat to Delete", "description": "To be deleted category item",
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert create.status_code == 201
        cid = create.json()["id"]
        resp = await client.delete(f"/api/v1/kb/categories/{cid}", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 204
