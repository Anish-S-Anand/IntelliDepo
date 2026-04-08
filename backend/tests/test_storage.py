"""
Tests for DATA-5.6: File Storage Service

Tests the storage service using mocked S3 client (no real S3/MinIO needed).
"""
import io
from unittest.mock import MagicMock, patch

import pytest

from app.core.data_infra.storage import FileStorageService, FileMetadata, StorageError


@pytest.fixture
def mock_s3():
    """Create a storage service with a mocked boto3 client."""
    with patch("app.core.data_infra.storage.boto3") as mock_boto3:
        mock_client = MagicMock()
        mock_boto3.client.return_value = mock_client
        # head_bucket succeeds (bucket exists)
        mock_client.head_bucket.return_value = {}

        service = FileStorageService(
            endpoint_url="http://localhost:9000",
            access_key="test",
            secret_key="test",
            bucket="test-bucket",
        )
        yield service, mock_client


def test_upload_bytes(mock_s3):
    service, client = mock_s3
    data = b"hello world"

    meta = service.upload_file(
        file_data=data,
        filename="test.txt",
        content_type="text/plain",
    )

    assert meta.size == 11
    assert meta.content_type == "text/plain"
    assert meta.key.endswith(".txt")
    assert meta.bucket == "test-bucket"
    client.upload_fileobj.assert_called_once()


def test_upload_with_custom_key(mock_s3):
    service, client = mock_s3

    meta = service.upload_file(
        file_data=b"data",
        key="custom/path/file.pdf",
        content_type="application/pdf",
    )

    assert meta.key == "custom/path/file.pdf"


def test_upload_auto_content_type(mock_s3):
    service, _ = mock_s3

    meta = service.upload_file(file_data=b"data", filename="report.pdf")
    assert meta.content_type == "application/pdf"

    meta = service.upload_file(file_data=b"data", filename="image.png")
    assert meta.content_type == "image/png"


def test_upload_file_like_object(mock_s3):
    service, client = mock_s3
    file_obj = io.BytesIO(b"file content here")

    meta = service.upload_file(file_data=file_obj, filename="doc.txt")

    assert meta.size == 17
    client.upload_fileobj.assert_called()


def test_download_file(mock_s3):
    service, client = mock_s3
    mock_body = MagicMock()
    mock_body.read.return_value = b"downloaded content"
    client.get_object.return_value = {"Body": mock_body}

    content = service.download_file("some/key.txt")

    assert content == b"downloaded content"
    client.get_object.assert_called_once_with(Bucket="test-bucket", Key="some/key.txt")


def test_download_not_found(mock_s3):
    from botocore.exceptions import ClientError

    service, client = mock_s3
    client.get_object.side_effect = ClientError(
        {"Error": {"Code": "NoSuchKey"}}, "GetObject"
    )

    with pytest.raises(StorageError, match="File not found"):
        service.download_file("missing.txt")


def test_delete_file(mock_s3):
    service, client = mock_s3
    client.delete_object.return_value = {}

    result = service.delete_file("some/key.txt")

    assert result is True
    client.delete_object.assert_called_once()


def test_delete_files_batch(mock_s3):
    service, client = mock_s3
    client.delete_objects.return_value = {"Errors": []}

    count = service.delete_files(["a.txt", "b.txt", "c.txt"])

    assert count == 3


def test_presigned_url(mock_s3):
    service, client = mock_s3
    client.generate_presigned_url.return_value = "https://s3.example.com/signed"

    url = service.get_presigned_url("file.txt", expires_in=600)

    assert url == "https://s3.example.com/signed"
    client.generate_presigned_url.assert_called_once_with(
        "get_object",
        Params={"Bucket": "test-bucket", "Key": "file.txt"},
        ExpiresIn=600,
    )


def test_presigned_upload_url(mock_s3):
    service, client = mock_s3
    client.generate_presigned_url.return_value = "https://s3.example.com/upload"

    url = service.get_presigned_upload_url("upload/doc.pdf", content_type="application/pdf")

    assert url == "https://s3.example.com/upload"


def test_file_exists_true(mock_s3):
    service, client = mock_s3
    client.head_object.return_value = {
        "ContentLength": 100,
        "ContentType": "text/plain",
    }

    assert service.file_exists("exists.txt") is True


def test_file_exists_false(mock_s3):
    from botocore.exceptions import ClientError

    service, client = mock_s3
    client.head_object.side_effect = ClientError(
        {"Error": {"Code": "404"}}, "HeadObject"
    )

    assert service.file_exists("missing.txt") is False


def test_get_metadata(mock_s3):
    from datetime import datetime, timezone

    service, client = mock_s3
    now = datetime.now(timezone.utc)
    client.head_object.return_value = {
        "ContentLength": 2048,
        "ContentType": "application/pdf",
        "LastModified": now,
        "ETag": '"abc123"',
        "Metadata": {"uploaded_by": "user-1"},
    }

    meta = service.get_file_metadata("report.pdf")

    assert meta.size == 2048
    assert meta.content_type == "application/pdf"
    assert meta.etag == "abc123"
    assert meta.metadata == {"uploaded_by": "user-1"}


def test_list_files(mock_s3):
    service, client = mock_s3
    client.list_objects_v2.return_value = {
        "Contents": [
            {"Key": "uploads/a.txt", "Size": 100},
            {"Key": "uploads/b.pdf", "Size": 200},
        ]
    }

    files = service.list_files(prefix="uploads/")

    assert len(files) == 2
    assert files[0].key == "uploads/a.txt"
    assert files[1].size == 200


def test_list_files_empty(mock_s3):
    service, client = mock_s3
    client.list_objects_v2.return_value = {}

    files = service.list_files(prefix="empty/")
    assert files == []


def test_metadata_to_dict(mock_s3):
    meta = FileMetadata(
        key="test.txt",
        bucket="bucket",
        size=42,
        content_type="text/plain",
    )
    d = meta.to_dict()

    assert d["key"] == "test.txt"
    assert d["size"] == 42
    assert "last_modified" in d


def test_bucket_creation_on_init():
    """Test that bucket is created if it doesn't exist."""
    from botocore.exceptions import ClientError

    with patch("app.core.data_infra.storage.boto3") as mock_boto3:
        mock_client = MagicMock()
        mock_boto3.client.return_value = mock_client
        mock_client.head_bucket.side_effect = ClientError(
            {"Error": {"Code": "404"}}, "HeadBucket"
        )
        mock_client.create_bucket.return_value = {}

        FileStorageService(
            endpoint_url="http://localhost:9000",
            access_key="test",
            secret_key="test",
            bucket="new-bucket",
        )

        mock_client.create_bucket.assert_called_once_with(Bucket="new-bucket")
