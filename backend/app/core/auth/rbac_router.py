"""
Intelli Platform — RBAC API Router
Feature: AUTH-6.2

Endpoints for managing roles, permissions, and user-role assignments.
Admin-only endpoints require the 'admin' role or superuser status.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel as PydanticBaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.auth.dependencies import get_current_user, require_permission, require_role
from app.core.auth.rbac import (
    add_permission_to_role,
    assign_role_to_user,
    create_permission,
    create_role,
    delete_permission,
    delete_role,
    get_permission_by_code,
    get_role_by_id,
    get_user_permissions,
    get_user_roles,
    list_permissions,
    list_roles,
    remove_permission_from_role,
    remove_role_from_user,
    update_role,
)
from app.shared.models.user import User
from app.shared.schemas.rbac import (
    MyPermissionsResponse,
    OperationResponse,
    PermissionCreate,
    PermissionResponse,
    RoleAssignment,
    RoleCreate,
    RoleOperationResponse,
    RoleResponse,
    RoleUpdate,
    UserPermissionsResponse,
)

router = APIRouter(prefix="/api/v1/rbac", tags=["RBAC"])


# ── Permissions ───────────────────────────────────────────


@router.get("/permissions", response_model=list[PermissionResponse])
async def api_list_permissions(
    resource: str | None = None,
    current_user: User = Depends(require_permission("roles:read")),
    db: AsyncSession = Depends(get_db),
):
    """List all permissions, optionally filtered by resource."""
    return await list_permissions(db, resource)


@router.post("/permissions", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
async def api_create_permission(
    body: PermissionCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new permission (admin only)."""
    existing = await get_permission_by_code(db, body.code)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Permission code already exists")
    return await create_permission(db, body.code, body.name, body.resource, body.action, body.description)


@router.delete("/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def api_delete_permission(
    permission_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a permission (admin only)."""
    if not await delete_permission(db, permission_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")


# ── Roles ─────────────────────────────────────────────────


@router.get("/roles", response_model=list[RoleResponse])
async def api_list_roles(
    current_user: User = Depends(require_permission("roles:read")),
    db: AsyncSession = Depends(get_db),
):
    """List all roles with their permissions (scoped to current user's tenant)."""
    return await list_roles(db, tenant_id=current_user.tenant_id)


@router.get("/roles/{role_id}", response_model=RoleResponse)
async def api_get_role(
    role_id: uuid.UUID,
    current_user: User = Depends(require_permission("roles:read")),
    db: AsyncSession = Depends(get_db),
):
    """Get a single role by ID."""
    role = await get_role_by_id(db, role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return role


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def api_create_role(
    body: RoleCreate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new role (admin only)."""
    return await create_role(
        db, body.name, body.description,
        permission_codes=body.permission_codes, tenant_id=body.tenant_id,
    )


@router.patch("/roles/{role_id}", response_model=RoleResponse)
async def api_update_role(
    role_id: uuid.UUID,
    body: RoleUpdate,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Update a role's name, description, or permissions (admin only)."""
    try:
        role = await update_role(db, role_id, body.name, body.description, body.permission_codes)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return role


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def api_delete_role(
    role_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a role (admin only, cannot delete system roles)."""
    try:
        if not await delete_role(db, role_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ── Role-Permission Management ────────────────────────────


class AddPermissionBody(PydanticBaseModel):
    permission_code: str


@router.post("/roles/{role_id}/permissions", response_model=OperationResponse, status_code=status.HTTP_201_CREATED)
async def api_add_permission_to_role(
    role_id: uuid.UUID,
    body: AddPermissionBody,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Add a permission to a role."""
    role = await add_permission_to_role(db, role_id, body.permission_code)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role or permission not found")
    return OperationResponse(status="added")


@router.delete("/roles/{role_id}/permissions/{permission_code}", response_model=OperationResponse, status_code=status.HTTP_200_OK)
async def api_remove_permission_from_role(
    role_id: uuid.UUID,
    permission_code: str,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Remove a permission from a role."""
    role = await remove_permission_from_role(db, role_id, permission_code)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role or permission not found")
    return OperationResponse(status="removed")


# ── User-Role Assignment ──────────────────────────────────


@router.post("/users/assign-role", response_model=RoleOperationResponse, status_code=status.HTTP_200_OK)
async def api_assign_role(
    body: RoleAssignment,
    current_user: User = Depends(require_permission("roles:write")),
    db: AsyncSession = Depends(get_db),
):
    """Assign a role to a user."""
    if not await assign_role_to_user(db, body.user_id, body.role_name):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User or role not found")
    return RoleOperationResponse(status="assigned", user_id=body.user_id, role=body.role_name)


@router.post("/users/remove-role", response_model=RoleOperationResponse, status_code=status.HTTP_200_OK)
async def api_remove_role(
    body: RoleAssignment,
    current_user: User = Depends(require_permission("roles:write")),
    db: AsyncSession = Depends(get_db),
):
    """Remove a role from a user."""
    if not await remove_role_from_user(db, body.user_id, body.role_name):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User or role not found")
    return RoleOperationResponse(status="removed", user_id=body.user_id, role=body.role_name)


@router.get("/users/{user_id}/permissions", response_model=UserPermissionsResponse)
async def api_user_permissions(
    user_id: uuid.UUID,
    current_user: User = Depends(require_permission("users:read")),
    db: AsyncSession = Depends(get_db),
):
    """Get all roles and permissions for a user."""
    roles = await get_user_roles(db, user_id)
    perms = await get_user_permissions(db, user_id)
    return UserPermissionsResponse(
        user_id=user_id,
        roles=roles,
        permissions=sorted(perms),
    )


@router.get("/me/permissions", response_model=MyPermissionsResponse)
async def api_my_permissions(
    current_user: User = Depends(get_current_user),
):
    """Get the current user's roles and permissions."""
    return MyPermissionsResponse(
        roles=[r.name for r in current_user.roles],
        permissions=sorted(current_user.get_permissions()),
    )
