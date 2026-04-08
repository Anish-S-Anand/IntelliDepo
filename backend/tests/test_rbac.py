"""
Tests for AUTH-6.2: RBAC (Role-Based Access Control)

Tests role/permission CRUD, user-role assignment, permission checking,
and the require_permission/require_role FastAPI dependencies.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.shared.models.rbac import Permission, Role
from app.shared.models.user import User
from app.core.auth.dependencies import require_permission, require_role, require_any_permission
from fastapi import HTTPException


# ── Fixtures ──────────────────────────────────────────────


def make_permission(code: str, resource: str = "test", action: str = "read") -> Permission:
    return Permission(
        id=uuid.uuid4(),
        code=code,
        name=code,
        resource=resource,
        action=action,
        description=None,
    )


def make_role(name: str, permissions: list[Permission] | None = None) -> Role:
    role = Role(
        id=uuid.uuid4(),
        name=name,
        description=f"Test role {name}",
        is_system=False,
        is_default=False,
    )
    role.permissions = permissions or []
    return role


def make_user(
    is_superuser: bool = False,
    roles: list[Role] | None = None,
) -> User:
    user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        full_name="Test User",
        is_active=True,
        is_superuser=is_superuser,
        hashed_password="fakehash",
    )
    user.roles = roles or []
    return user


# ── User Model Permission Tests ───────────────────────────


class TestUserPermissions:
    def test_superuser_has_all_permissions(self):
        user = make_user(is_superuser=True)
        assert user.has_permission("anything:at_all") is True
        assert user.has_role("any_role") is True
        assert user.get_permissions() == {"*"}

    def test_user_has_permission_through_role(self):
        perm = make_permission("depot:read")
        role = make_role("operator", [perm])
        user = make_user(roles=[role])

        assert user.has_permission("depot:read") is True
        assert user.has_permission("depot:write") is False

    def test_user_has_role(self):
        role = make_role("admin")
        user = make_user(roles=[role])

        assert user.has_role("admin") is True
        assert user.has_role("operator") is False

    def test_user_get_permissions_aggregates_across_roles(self):
        perm1 = make_permission("depot:read")
        perm2 = make_permission("depot:write")
        perm3 = make_permission("stream:read")

        role1 = make_role("operator", [perm1, perm2])
        role2 = make_role("analyst", [perm1, perm3])
        user = make_user(roles=[role1, role2])

        perms = user.get_permissions()
        assert perms == {"depot:read", "depot:write", "stream:read"}

    def test_user_no_roles_no_permissions(self):
        user = make_user(roles=[])
        assert user.has_permission("anything") is False
        assert user.has_role("anything") is False
        assert user.get_permissions() == set()


# ── Dependency Tests ──────────────────────────────────────


class TestRequirePermission:
    @pytest.mark.asyncio
    async def test_allows_user_with_permission(self):
        perm = make_permission("depot:read")
        role = make_role("operator", [perm])
        user = make_user(roles=[role])

        dep = require_permission("depot:read")
        result = await dep(current_user=user)
        assert result == user

    @pytest.mark.asyncio
    async def test_denies_user_without_permission(self):
        user = make_user(roles=[])

        dep = require_permission("depot:read")
        with pytest.raises(HTTPException) as exc_info:
            await dep(current_user=user)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_allows_superuser(self):
        user = make_user(is_superuser=True)

        dep = require_permission("anything:at_all")
        result = await dep(current_user=user)
        assert result == user


class TestRequireRole:
    @pytest.mark.asyncio
    async def test_allows_user_with_role(self):
        role = make_role("admin")
        user = make_user(roles=[role])

        dep = require_role("admin")
        result = await dep(current_user=user)
        assert result == user

    @pytest.mark.asyncio
    async def test_denies_user_without_role(self):
        role = make_role("viewer")
        user = make_user(roles=[role])

        dep = require_role("admin")
        with pytest.raises(HTTPException) as exc_info:
            await dep(current_user=user)
        assert exc_info.value.status_code == 403


class TestRequireAnyPermission:
    @pytest.mark.asyncio
    async def test_allows_with_one_matching(self):
        perm = make_permission("stream:read")
        role = make_role("analyst", [perm])
        user = make_user(roles=[role])

        dep = require_any_permission("depot:read", "stream:read")
        result = await dep(current_user=user)
        assert result == user

    @pytest.mark.asyncio
    async def test_denies_with_none_matching(self):
        perm = make_permission("ai:read")
        role = make_role("ai-user", [perm])
        user = make_user(roles=[role])

        dep = require_any_permission("depot:read", "stream:read")
        with pytest.raises(HTTPException) as exc_info:
            await dep(current_user=user)
        assert exc_info.value.status_code == 403


# ── Role & Permission Model Tests ─────────────────────────


class TestRoleModel:
    def test_role_has_permissions(self):
        p1 = make_permission("depot:read")
        p2 = make_permission("depot:write")
        role = make_role("operator", [p1, p2])

        assert len(role.permissions) == 2
        assert role.permissions[0].code == "depot:read"

    def test_permission_fields(self):
        perm = make_permission("depot:read", resource="depot", action="read")
        assert perm.code == "depot:read"
        assert perm.resource == "depot"
        assert perm.action == "read"
