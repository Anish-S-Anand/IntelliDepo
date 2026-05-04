"""
Intelli Platform — RBAC Service
Feature: AUTH-6.2

Role and permission management: CRUD for roles/permissions, assignment to users,
and permission checking.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.shared.models.rbac import Permission, Role, role_permissions, user_roles
from app.shared.models.user import User


# ── Permission CRUD ───────────────────────────────────────

async def create_permission(
    db: AsyncSession,
    code: str,
    name: str,
    resource: str,
    action: str,
    description: str | None = None,
) -> Permission:
    perm = Permission(
        code=code, name=name, resource=resource, action=action, description=description
    )
    db.add(perm)
    await db.commit()
    await db.refresh(perm)
    return perm


async def get_permission_by_code(db: AsyncSession, code: str) -> Permission | None:
    result = await db.execute(select(Permission).where(Permission.code == code))
    return result.scalar_one_or_none()


async def list_permissions(
    db: AsyncSession, resource: str | None = None
) -> list[Permission]:
    query = select(Permission).order_by(Permission.resource, Permission.action)
    if resource:
        query = query.where(Permission.resource == resource)
    result = await db.execute(query)
    return list(result.scalars().all())


async def delete_permission(db: AsyncSession, permission_id: uuid.UUID) -> bool:
    result = await db.execute(
        delete(Permission).where(Permission.id == permission_id)
    )
    await db.commit()
    return result.rowcount > 0


# ── Role CRUD ─────────────────────────────────────────────

async def create_role(
    db: AsyncSession,
    name: str,
    description: str | None = None,
    is_system: bool = False,
    is_default: bool = False,
    permission_codes: list[str] | None = None,
    tenant_id: uuid.UUID | None = None,
) -> Role:
    role = Role(
        name=name, description=description, is_system=is_system,
        is_default=is_default, tenant_id=tenant_id,
    )
    if permission_codes:
        result = await db.execute(
            select(Permission).where(Permission.code.in_(permission_codes))
        )
        role.permissions = list(result.scalars().all())
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return role


async def get_role_by_name(db: AsyncSession, name: str) -> Role | None:
    result = await db.execute(
        select(Role)
        .options(selectinload(Role.permissions))
        .where(Role.name == name)
    )
    return result.scalar_one_or_none()


async def get_role_by_id(db: AsyncSession, role_id: uuid.UUID) -> Role | None:
    result = await db.execute(
        select(Role)
        .options(selectinload(Role.permissions))
        .where(Role.id == role_id)
    )
    return result.scalar_one_or_none()


async def list_roles(db: AsyncSession, tenant_id: uuid.UUID | None = None) -> list[Role]:
    query = select(Role).options(selectinload(Role.permissions)).order_by(Role.name)
    if tenant_id is not None:
        # Return tenant-scoped roles + global (system) roles
        query = query.where((Role.tenant_id == tenant_id) | (Role.tenant_id.is_(None)))
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_role(
    db: AsyncSession,
    role_id: uuid.UUID,
    name: str | None = None,
    description: str | None = None,
    permission_codes: list[str] | None = None,
) -> Role | None:
    role = await get_role_by_id(db, role_id)
    if not role:
        return None
    if role.is_system:
        raise ValueError("Cannot modify system roles")
    if name is not None:
        role.name = name
    if description is not None:
        role.description = description
    if permission_codes is not None:
        result = await db.execute(
            select(Permission).where(Permission.code.in_(permission_codes))
        )
        role.permissions = list(result.scalars().all())
    await db.commit()
    await db.refresh(role)
    return role


async def delete_role(db: AsyncSession, role_id: uuid.UUID) -> bool:
    role = await get_role_by_id(db, role_id)
    if not role:
        return False
    if role.is_system:
        raise ValueError("Cannot delete system roles")
    await db.execute(delete(Role).where(Role.id == role_id))
    await db.commit()
    return True


# ── Role-Permission Management ────────────────────────────

async def add_permission_to_role(
    db: AsyncSession, role_id: uuid.UUID, permission_code: str
) -> Role | None:
    role = await get_role_by_id(db, role_id)
    perm = await get_permission_by_code(db, permission_code)
    if not role or not perm:
        return None
    if perm not in role.permissions:
        role.permissions.append(perm)
        await db.commit()
        await db.refresh(role)
    return role


async def remove_permission_from_role(
    db: AsyncSession, role_id: uuid.UUID, permission_code: str
) -> Role | None:
    role = await get_role_by_id(db, role_id)
    perm = await get_permission_by_code(db, permission_code)
    if not role or not perm:
        return None
    if perm in role.permissions:
        role.permissions.remove(perm)
        await db.commit()
        await db.refresh(role)
    return role


# ── User-Role Management ──────────────────────────────────

async def assign_role_to_user(
    db: AsyncSession, user_id: uuid.UUID, role_name: str
) -> bool:
    user = await _get_user_with_roles(db, user_id)
    role = await get_role_by_name(db, role_name)
    if not user or not role:
        return False
    if role not in user.roles:
        user.roles.append(role)
        await db.commit()
    return True


async def remove_role_from_user(
    db: AsyncSession, user_id: uuid.UUID, role_name: str
) -> bool:
    user = await _get_user_with_roles(db, user_id)
    role = await get_role_by_name(db, role_name)
    if not user or not role:
        return False
    if role in user.roles:
        user.roles.remove(role)
        await db.commit()
    return True


async def get_user_roles(db: AsyncSession, user_id: uuid.UUID) -> list[Role]:
    user = await _get_user_with_roles(db, user_id)
    if not user:
        return []
    return list(user.roles)


async def get_user_permissions(db: AsyncSession, user_id: uuid.UUID) -> set[str]:
    user = await _get_user_with_roles(db, user_id)
    if not user:
        return set()
    return user.get_permissions()


# ── Permission Checking ───────────────────────────────────

async def check_permission(
    db: AsyncSession, user_id: uuid.UUID, permission_code: str
) -> bool:
    user = await _get_user_with_roles(db, user_id)
    if not user:
        return False
    return user.has_permission(permission_code)


# ── Default Roles Seeding ─────────────────────────────────

async def seed_default_roles(db: AsyncSession) -> None:
    """Create default system roles and permissions if they don't exist."""
    # Default permissions
    default_perms = [
        ("users:read", "View Users", "users", "read"),
        ("users:write", "Manage Users", "users", "write"),
        ("users:delete", "Delete Users", "users", "delete"),
        ("roles:read", "View Roles", "roles", "read"),
        ("roles:write", "Manage Roles", "roles", "write"),
        ("depot:read", "View Depot", "depot", "read"),
        ("depot:write", "Manage Depot", "depot", "write"),
        ("depot:admin", "Admin Depot", "depot", "admin"),
        ("stream:read", "View Stream", "stream", "read"),
        ("stream:write", "Manage Stream", "stream", "write"),
        ("analytics:read", "View Analytics", "analytics", "read"),
        ("analytics:write", "Manage Analytics", "analytics", "write"),
        ("ai:read", "View AI Features", "ai", "read"),
        ("ai:write", "Use AI Features", "ai", "write"),
        ("settings:read", "View Settings", "settings", "read"),
        ("settings:write", "Manage Settings", "settings", "write"),
    ]

    for code, name, resource, action in default_perms:
        existing = await get_permission_by_code(db, code)
        if not existing:
            await create_permission(db, code, name, resource, action)

    # Default roles
    default_roles = [
        ("admin", "Full platform administrator", True, False, [
            "users:read", "users:write", "users:delete",
            "roles:read", "roles:write",
            "depot:read", "depot:write", "depot:admin",
            "stream:read", "stream:write",
            "analytics:read", "analytics:write",
            "ai:read", "ai:write",
            "settings:read", "settings:write",
        ]),
        ("manager", "Department manager with read/write access", True, False, [
            "users:read",
            "depot:read", "depot:write",
            "stream:read", "stream:write",
            "analytics:read", "analytics:write",
            "ai:read", "ai:write",
            "settings:read",
        ]),
        ("operator", "Warehouse operator with depot access", True, False, [
            "depot:read", "depot:write",
            "analytics:read",
            "ai:read",
        ]),
        ("viewer", "Read-only access across products", True, True, [
            "users:read",
            "depot:read",
            "stream:read",
            "analytics:read",
            "ai:read",
        ]),
    ]

    for name, desc, is_system, is_default, perm_codes in default_roles:
        existing = await get_role_by_name(db, name)
        if not existing:
            await create_role(db, name, desc, is_system, is_default, perm_codes)


# ── Private ───────────────────────────────────────────────

async def _get_user_with_roles(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles).selectinload(Role.permissions))
        .where(User.id == user_id)
    )
    return result.scalar_one_or_none()
