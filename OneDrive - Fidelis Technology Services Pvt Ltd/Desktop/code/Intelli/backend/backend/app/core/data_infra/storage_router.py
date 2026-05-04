"""
Intelli Platform — File Storage API Router
Feature: DATA-5.6

Endpoints for file upload, download, delete, listing, and presigned URL generation.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.auth.dependencies import get_current_user
from app.shared.models.user import User
from app.core.data_infra.storage import (
    FileStorageService,
    StorageError,
    get_storage_service,
)

router = APIRouter(prefix="/api/v1/storage", tags=["File Storage"])


def get_storage() -> FileStorageService:
    return get_storage_service()


# ── Schemas ────────────────────────────────────────────────


class FileResponse(BaseModel):
    key: str
    bucket: str
    size: int
    content_type: str
    last_modified: str
    etag: str
    metadata: dict


class PresignedUrlResponse(BaseModel):
    url: str
    key: str
    expires_in: int


class PresignedUploadRequest(BaseModel):
    key: str
    content_type: str = "application/octet-stream"
    expires_in: int = 3600


class DeleteResponse(BaseModel):
    deleted: bool
    key: str


# ── Endpoints ──────────────────────────────────────────────


@router.post("/upload", response_model=FileResponse)
async def upload_file(
    file: UploadFile = File(...),
    prefix: str = Query("uploads", description="Storage path prefix"),
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_storage),
):
    """Upload a file to storage."""
    try:
        content = await file.read()
        key = f"{prefix}/{file.filename}" if file.filename else None
        meta = storage.upload_file(
            file_data=content,
            key=key,
            filename=file.filename,
            content_type=file.content_type,
            metadata={"uploaded_by": str(current_user.id)},
        )
        return FileResponse(**meta.to_dict())
    except StorageError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/download")
async def download_file(
    key: str = Query(..., description="File key in storage"),
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_storage),
):
    """Download a file from storage."""
    try:
        meta = storage.get_file_metadata(key)
        stream = storage.download_file_stream(key)
        return StreamingResponse(
            stream,
            media_type=meta.content_type,
            headers={"Content-Disposition": f'attachment; filename="{key.split("/")[-1]}"'},
        )
    except StorageError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/delete", response_model=DeleteResponse)
async def delete_file(
    key: str = Query(..., description="File key to delete"),
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_storage),
):
    """Delete a file from storage."""
    try:
        storage.delete_file(key)
        return DeleteResponse(deleted=True, key=key)
    except StorageError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/presigned-url", response_model=PresignedUrlResponse)
async def get_presigned_download_url(
    key: str = Query(..., description="File key"),
    expires_in: int = Query(3600, description="URL expiry in seconds"),
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_storage),
):
    """Generate a presigned download URL."""
    try:
        url = storage.get_presigned_url(key, expires_in=expires_in)
        return PresignedUrlResponse(url=url, key=key, expires_in=expires_in)
    except StorageError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/presigned-upload", response_model=PresignedUrlResponse)
async def get_presigned_upload_url(
    body: PresignedUploadRequest,
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_storage),
):
    """Generate a presigned upload URL for direct browser uploads."""
    try:
        url = storage.get_presigned_upload_url(
            key=body.key,
            content_type=body.content_type,
            expires_in=body.expires_in,
        )
        return PresignedUrlResponse(url=url, key=body.key, expires_in=body.expires_in)
    except StorageError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/list", response_model=list[FileResponse])
async def list_files(
    prefix: str = Query("", description="Filter by key prefix"),
    max_keys: int = Query(100, description="Max files to return"),
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_storage),
):
    """List files in storage, optionally filtered by prefix."""
    try:
        files = storage.list_files(prefix=prefix, max_keys=max_keys)
        return [FileResponse(**f.to_dict()) for f in files]
    except StorageError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/metadata", response_model=FileResponse)
async def get_metadata(
    key: str = Query(..., description="File key"),
    current_user: User = Depends(get_current_user),
    storage: FileStorageService = Depends(get_storage),
):
    """Get metadata for a stored file."""
    try:
        meta = storage.get_file_metadata(key)
        return FileResponse(**meta.to_dict())
    except StorageError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
