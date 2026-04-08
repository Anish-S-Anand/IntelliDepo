"""
Intelli Platform — RBAC Schemas
Feature: AUTH-6.2

Pydantic schemas for roles, permissions, and assignment requests.
"""
from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


# ── Permission Schemas ────────────────────────────────────

class PermissionCreate(BaseModel):
    code: str = Field(..., pattern=r"^[a-z_]+:[a-z_]+$", examples=["depot:read"])
    name: str
    resource: str
    action: str
    description: str | None = None


class PermissionResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    resource: str
    action: str
    description: str | None = None

    model_config = {"from_attributes": True}


# ── Role Schemas ──────────────────────────────────────────

class RoleCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = None
    permission_codes: list[str] = []
    tenant_id: uuid.UUID | None = None


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    permission_codes: list[str] | None = None


class RoleResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    is_system: bool
    is_default: bool
    tenant_id: uuid.UUID | None = None
    permissions: list[PermissionResponse] = []

    model_config = {"from_attributes": True}


# ── Assignment Schemas ────────────────────────────────────

class RoleAssignment(BaseModel):
    user_id: uuid.UUID
    role_name: str


class PermissionAssignment(BaseModel):
    role_id: uuid.UUID
    permission_code: str


class UserPermissionsResponse(BaseModel):
    user_id: uuid.UUID
    roles: list[RoleResponse]
    permissions: list[str]


# ── Operation Response Schemas ───────────────────────────

class OperationResponse(BaseModel):
    status: str


class RoleOperationResponse(BaseModel):
    status: str
    user_id: uuid.UUID
    role: str


class MyPermissionsResponse(BaseModel):
    roles: list[str]
    permissions: list[str]
