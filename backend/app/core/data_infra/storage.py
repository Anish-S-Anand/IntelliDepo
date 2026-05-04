"""
Intelli Platform — File Storage Service
Feature: DATA-5.6

S3-compatible file storage abstraction (works with MinIO for local dev, AWS S3 in prod).
Provides upload, download, delete, presigned URLs, and metadata operations.
"""
from __future__ import annotations

import io
import logging
import mimetypes
import uuid
from datetime import datetime, timezone

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)


class StorageError(Exception):
    """Raised when a storage operation fails."""


class FileMetadata:
    """Metadata about a stored file."""

    def __init__(
        self,
        key: str,
        bucket: str,
        size: int = 0,
        content_type: str = "application/octet-stream",
        last_modified: datetime | None = None,
        etag: str = "",
        metadata: dict | None = None,
    ):
        self.key = key
        self.bucket = bucket
        self.size = size
        self.content_type = content_type
        self.last_modified = last_modified or datetime.now(timezone.utc)
        self.etag = etag
        self.metadata = metadata or {}

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "bucket": self.bucket,
            "size": self.size,
            "content_type": self.content_type,
            "last_modified": self.last_modified.isoformat(),
            "etag": self.etag,
            "metadata": self.metadata,
        }


class FileStorageService:
    """
    S3-compatible file storage service.

    Works with AWS S3, MinIO, or any S3-compatible storage.
    Uses boto3 under the hood.
    """

    def __init__(
        self,
        endpoint_url: str | None = None,
        access_key: str | None = None,
        secret_key: str | None = None,
        bucket: str | None = None,
        region: str = "us-east-1",
    ):
        self._endpoint_url = endpoint_url or settings.S3_ENDPOINT
        self._access_key = access_key or settings.S3_ACCESS_KEY
        self._secret_key = secret_key or settings.S3_SECRET_KEY
        self._bucket = bucket or settings.S3_BUCKET
        self._region = region

        self._client = boto3.client(
            "s3",
            endpoint_url=self._endpoint_url,
            aws_access_key_id=self._access_key,
            aws_secret_access_key=self._secret_key,
            region_name=self._region,
            config=BotoConfig(signature_version="s3v4"),
        )

        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        """Create the default bucket if it doesn't exist."""
        try:
            self._client.head_bucket(Bucket=self._bucket)
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in ("404", "NoSuchBucket"):
                try:
                    self._client.create_bucket(Bucket=self._bucket)
                    logger.info("Created bucket: %s", self._bucket)
                except ClientError as create_err:
                    raise StorageError(
                        f"Failed to create bucket {self._bucket}: {create_err}"
                    ) from create_err
            else:
                logger.warning("Could not check bucket %s: %s", self._bucket, e)

    # ── Upload ─────────────────────────────────────────────

    def upload_file(
        self,
        file_data: bytes | io.IOBase,
        key: str | None = None,
        filename: str | None = None,
        content_type: str | None = None,
        bucket: str | None = None,
        metadata: dict | None = None,
    ) -> FileMetadata:
        """
        Upload a file to storage.

        Args:
            file_data: File content as bytes or file-like object.
            key: Storage key (path). Auto-generated if not provided.
            filename: Original filename (used to derive key and content type).
            content_type: MIME type. Auto-detected from filename if not provided.
            bucket: Target bucket. Uses default if not provided.
            metadata: Custom metadata dict to store with the file.

        Returns:
            FileMetadata with the stored file's details.
        """
        bucket = bucket or self._bucket

        if key is None:
            ext = ""
            if filename:
                ext = "." + filename.rsplit(".", 1)[-1] if "." in filename else ""
            key = f"uploads/{uuid.uuid4().hex}{ext}"

        if content_type is None:
            if filename:
                content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
            else:
                content_type = "application/octet-stream"

        extra_args: dict = {"ContentType": content_type}
        if metadata:
            extra_args["Metadata"] = {k: str(v) for k, v in metadata.items()}

        try:
            if isinstance(file_data, bytes):
                body = io.BytesIO(file_data)
                size = len(file_data)
            else:
                body = file_data
                body.seek(0, 2)
                size = body.tell()
                body.seek(0)

            self._client.upload_fileobj(body, bucket, key, ExtraArgs=extra_args)

            return FileMetadata(
                key=key,
                bucket=bucket,
                size=size,
                content_type=content_type,
                metadata=metadata or {},
            )
        except ClientError as e:
            raise StorageError(f"Upload failed for {key}: {e}") from e

    # ── Download ───────────────────────────────────────────

    def download_file(self, key: str, bucket: str | None = None) -> bytes:
        """Download a file and return its content as bytes."""
        bucket = bucket or self._bucket
        try:
            response = self._client.get_object(Bucket=bucket, Key=key)
            return response["Body"].read()
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code == "NoSuchKey":
                raise StorageError(f"File not found: {key}") from e
            raise StorageError(f"Download failed for {key}: {e}") from e

    def download_file_stream(self, key: str, bucket: str | None = None) -> io.IOBase:
        """Download a file and return a streaming body."""
        bucket = bucket or self._bucket
        try:
            response = self._client.get_object(Bucket=bucket, Key=key)
            return response["Body"]
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code == "NoSuchKey":
                raise StorageError(f"File not found: {key}") from e
            raise StorageError(f"Download failed for {key}: {e}") from e

    # ── Delete ─────────────────────────────────────────────

    def delete_file(self, key: str, bucket: str | None = None) -> bool:
        """Delete a file from storage. Returns True if successful."""
        bucket = bucket or self._bucket
        try:
            self._client.delete_object(Bucket=bucket, Key=key)
            return True
        except ClientError as e:
            raise StorageError(f"Delete failed for {key}: {e}") from e

    def delete_files(self, keys: list[str], bucket: str | None = None) -> int:
        """Batch delete multiple files. Returns count of deleted files."""
        bucket = bucket or self._bucket
        if not keys:
            return 0
        try:
            response = self._client.delete_objects(
                Bucket=bucket,
                Delete={"Objects": [{"Key": k} for k in keys], "Quiet": True},
            )
            errors = response.get("Errors", [])
            if errors:
                logger.warning("Batch delete had %d errors: %s", len(errors), errors)
            return len(keys) - len(errors)
        except ClientError as e:
            raise StorageError(f"Batch delete failed: {e}") from e

    # ── Presigned URLs ─────────────────────────────────────

    def get_presigned_url(
        self, key: str, expires_in: int = 3600, bucket: str | None = None
    ) -> str:
        """
        Generate a presigned download URL.

        Args:
            key: File key in storage.
            expires_in: URL expiry in seconds (default: 1 hour).
            bucket: Target bucket.

        Returns:
            Presigned URL string.
        """
        bucket = bucket or self._bucket
        try:
            return self._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": bucket, "Key": key},
                ExpiresIn=expires_in,
            )
        except ClientError as e:
            raise StorageError(f"Presigned URL generation failed for {key}: {e}") from e

    def get_presigned_upload_url(
        self,
        key: str,
        content_type: str = "application/octet-stream",
        expires_in: int = 3600,
        bucket: str | None = None,
    ) -> str:
        """Generate a presigned upload URL for direct browser uploads."""
        bucket = bucket or self._bucket
        try:
            return self._client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": bucket,
                    "Key": key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )
        except ClientError as e:
            raise StorageError(
                f"Presigned upload URL generation failed for {key}: {e}"
            ) from e

    # ── Metadata & Listing ─────────────────────────────────

    def get_file_metadata(self, key: str, bucket: str | None = None) -> FileMetadata:
        """Get metadata for a stored file."""
        bucket = bucket or self._bucket
        try:
            response = self._client.head_object(Bucket=bucket, Key=key)
            return FileMetadata(
                key=key,
                bucket=bucket,
                size=response.get("ContentLength", 0),
                content_type=response.get("ContentType", "application/octet-stream"),
                last_modified=response.get("LastModified"),
                etag=response.get("ETag", "").strip('"'),
                metadata=response.get("Metadata", {}),
            )
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code == "404":
                raise StorageError(f"File not found: {key}") from e
            raise StorageError(f"Metadata fetch failed for {key}: {e}") from e

    def file_exists(self, key: str, bucket: str | None = None) -> bool:
        """Check if a file exists in storage."""
        try:
            self.get_file_metadata(key, bucket)
            return True
        except StorageError:
            return False

    def list_files(
        self,
        prefix: str = "",
        bucket: str | None = None,
        max_keys: int = 1000,
    ) -> list[FileMetadata]:
        """List files with an optional prefix filter."""
        bucket = bucket or self._bucket
        try:
            response = self._client.list_objects_v2(
                Bucket=bucket, Prefix=prefix, MaxKeys=max_keys
            )
            files = []
            for obj in response.get("Contents", []):
                files.append(
                    FileMetadata(
                        key=obj["Key"],
                        bucket=bucket,
                        size=obj.get("Size", 0),
                        last_modified=obj.get("LastModified"),
                        etag=obj.get("ETag", "").strip('"'),
                    )
                )
            return files
        except ClientError as e:
            raise StorageError(f"List failed for prefix '{prefix}': {e}") from e


# ── Singleton ──────────────────────────────────────────────

_storage_instance: FileStorageService | None = None


def get_storage_service() -> FileStorageService:
    """Get or create the singleton storage service."""
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = FileStorageService()
    return _storage_instance
