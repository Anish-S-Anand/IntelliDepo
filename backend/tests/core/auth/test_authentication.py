"""
Tests for AUTH-6.1: Authentication System
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# --- Registration ---

async def test_register_success(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "alice@example.com",
        "password": "strongpass123",
        "full_name": "Alice Smith",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "alice@example.com"
    assert data["full_name"] == "Alice Smith"
    assert data["is_active"] is True
    assert "id" in data


async def test_register_duplicate_email(client: AsyncClient):
    payload = {
        "email": "dup@example.com",
        "password": "strongpass123",
        "full_name": "Dup User",
    }
    await client.post("/api/v1/auth/register", json=payload)
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 409


async def test_register_weak_password(client: AsyncClient):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "weak@example.com",
        "password": "short",
        "full_name": "Weak Pass",
    })
    assert resp.status_code == 422


# --- Login ---

async def test_login_success(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "login@example.com",
        "password": "strongpass123",
        "full_name": "Login User",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "email": "login@example.com",
        "password": "strongpass123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


async def test_login_success_with_oauth_form(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "formlogin@example.com",
        "password": "strongpass123",
        "full_name": "Form Login User",
    })
    resp = await client.post(
        "/api/v1/auth/login",
        data={
            "username": "formlogin@example.com",
            "password": "strongpass123",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "wrong@example.com",
        "password": "strongpass123",
        "full_name": "Wrong Pass",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "email": "wrong@example.com",
        "password": "badpassword",
    })
    assert resp.status_code == 401


async def test_login_nonexistent_user(client: AsyncClient):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "nobody@example.com",
        "password": "strongpass123",
    })
    assert resp.status_code == 401


# --- Token Refresh ---

async def test_refresh_token(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "refresh@example.com",
        "password": "strongpass123",
        "full_name": "Refresh User",
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "refresh@example.com",
        "password": "strongpass123",
    })
    refresh = login_resp.json()["refresh_token"]
    resp = await client.post(f"/api/v1/auth/refresh?refresh_token={refresh}")
    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_refresh_with_access_token_fails(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "badrefresh@example.com",
        "password": "strongpass123",
        "full_name": "Bad Refresh",
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "badrefresh@example.com",
        "password": "strongpass123",
    })
    access = login_resp.json()["access_token"]
    resp = await client.post(f"/api/v1/auth/refresh?refresh_token={access}")
    assert resp.status_code == 401


# --- Get Current User ---

async def test_get_me(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "me@example.com",
        "password": "strongpass123",
        "full_name": "Me User",
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "me@example.com",
        "password": "strongpass123",
    })
    token = login_resp.json()["access_token"]
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "me@example.com"


async def test_get_me_unauthorized(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


# --- Change Password ---

async def test_change_password(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "change@example.com",
        "password": "strongpass123",
        "full_name": "Change User",
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "change@example.com",
        "password": "strongpass123",
    })
    token = login_resp.json()["access_token"]
    resp = await client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "strongpass123", "new_password": "newstrong456"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200

    # Verify new password works
    resp2 = await client.post("/api/v1/auth/login", json={
        "email": "change@example.com",
        "password": "newstrong456",
    })
    assert resp2.status_code == 200


async def test_change_password_wrong_current(client: AsyncClient):
    await client.post("/api/v1/auth/register", json={
        "email": "wrongcurr@example.com",
        "password": "strongpass123",
        "full_name": "Wrong Curr",
    })
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": "wrongcurr@example.com",
        "password": "strongpass123",
    })
    token = login_resp.json()["access_token"]
    resp = await client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "wrongone", "new_password": "newstrong456"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


# --- Password Reset ---

async def test_password_reset_request_always_200(client: AsyncClient):
    """Password reset request should always return 200 to prevent email enumeration."""
    resp = await client.post("/api/v1/auth/password-reset/request", json={
        "email": "nonexistent@example.com",
    })
    assert resp.status_code == 200


async def test_password_reset_invalid_token(client: AsyncClient):
    resp = await client.post("/api/v1/auth/password-reset/confirm", json={
        "token": "invalid-token",
        "new_password": "newstrong456",
    })
    assert resp.status_code == 400
