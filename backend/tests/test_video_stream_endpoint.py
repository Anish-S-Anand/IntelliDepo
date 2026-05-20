"""
Tests for GET /depot/vision/cameras/video-library/{filename}/stream endpoint

Validates Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
"""
import os
import tempfile
import pytest
from unittest.mock import patch
from pathlib import Path

# Dummy video content — 1 KB of fake MP4 bytes (enough to test range slicing)
DUMMY_VIDEO_BYTES = b"\x00\x00\x00\x18ftypisom" + b"\x00" * (1024 - 16)
DUMMY_VIDEO_SIZE = len(DUMMY_VIDEO_BYTES)

VIDEO_ENDPOINT_BASE = "/depot/vision/cameras/video-library"


@pytest.fixture
def tmp_video_file(tmp_path):
    """Create a real temporary video file so FileResponse can stat it."""
    video_file = tmp_path / "Perimeter_Detection.mp4"
    video_file.write_bytes(DUMMY_VIDEO_BYTES)
    return str(video_file)


@pytest.fixture
def tmp_video_file_with_spaces(tmp_path):
    """Create a temporary video file with spaces in the name."""
    video_file = tmp_path / "Theft Camera .mp4"
    video_file.write_bytes(DUMMY_VIDEO_BYTES)
    return str(video_file)


@pytest.mark.asyncio
async def test_video_stream_returns_accept_ranges_header(client, tmp_video_file):
    """
    **Validates: Requirement 4.4**
    
    WHEN the HTML5 video player sends a non-range request
    THEN the Backend_API SHALL set the `Accept-Ranges: bytes` header in all video stream responses
    """
    with patch(
        "app.depot.vision.video_library.get_local_video_path",
        return_value=tmp_video_file,
    ):
        response = await client.get(
            f"{VIDEO_ENDPOINT_BASE}/Perimeter_Detection.mp4/stream"
        )

    assert response.status_code == 200
    assert response.headers.get("Accept-Ranges") == "bytes", (
        f"Expected Accept-Ranges: bytes header, got {response.headers.get('Accept-Ranges')!r}"
    )


@pytest.mark.asyncio
async def test_video_stream_range_request_returns_206(client, tmp_video_file):
    """
    **Validates: Requirement 4.2**
    
    WHEN the HTML5 video player sends an HTTP Range request
    THEN the Backend_API SHALL respond with status code 206 (Partial Content) 
    and include the `Content-Range` header
    """
    with patch(
        "app.depot.vision.video_library.get_local_video_path",
        return_value=tmp_video_file,
    ):
        response = await client.get(
            f"{VIDEO_ENDPOINT_BASE}/Perimeter_Detection.mp4/stream",
            headers={"Range": "bytes=0-511"},
        )

    assert response.status_code == 206, (
        f"Expected 206 Partial Content for a Range request, got {response.status_code}"
    )
    assert "Content-Range" in response.headers, (
        "Expected Content-Range header in 206 response"
    )
    assert response.headers.get("Accept-Ranges") == "bytes"


@pytest.mark.asyncio
async def test_video_stream_non_range_request_returns_200(client, tmp_video_file):
    """
    **Validates: Requirement 4.3**
    
    WHEN the HTML5 video player sends a non-range request
    THEN the Backend_API SHALL respond with status code 200 and the complete video file
    """
    with patch(
        "app.depot.vision.video_library.get_local_video_path",
        return_value=tmp_video_file,
    ):
        response = await client.get(
            f"{VIDEO_ENDPOINT_BASE}/Perimeter_Detection.mp4/stream"
        )

    assert response.status_code == 200, (
        f"Expected 200 OK for a non-range request, got {response.status_code}"
    )
    assert len(response.content) == DUMMY_VIDEO_SIZE, (
        f"Expected full video content ({DUMMY_VIDEO_SIZE} bytes), got {len(response.content)} bytes"
    )


@pytest.mark.asyncio
async def test_video_stream_returns_404_when_file_not_found(client):
    """
    **Validates: Requirement 4.5**
    
    WHEN the video file does not exist on the backend filesystem
    THEN the Backend_API SHALL return status code 404
    """
    with patch(
        "app.depot.vision.video_library.get_local_video_path",
        return_value=None,  # Simulate file not found
    ):
        response = await client.get(
            f"{VIDEO_ENDPOINT_BASE}/NonExistent.mp4/stream"
        )

    assert response.status_code == 404, (
        f"Expected 404 Not Found when video doesn't exist, got {response.status_code}"
    )
    assert "Video not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_video_stream_handles_url_encoded_filenames(client, tmp_video_file_with_spaces):
    """
    **Validates: Requirement 4.4**
    
    WHEN the video filename contains special characters (e.g., spaces)
    THEN the Backend_API SHALL properly handle URL-encoded filenames
    """
    # URL-encoded filename: "Theft%20Camera%20.mp4"
    encoded_filename = "Theft%20Camera%20.mp4"
    
    with patch(
        "app.depot.vision.video_library.get_local_video_path",
        return_value=tmp_video_file_with_spaces,
    ):
        response = await client.get(
            f"{VIDEO_ENDPOINT_BASE}/{encoded_filename}/stream"
        )

    assert response.status_code == 200, (
        f"Expected 200 OK for URL-encoded filename, got {response.status_code}"
    )
    assert response.headers.get("Accept-Ranges") == "bytes"


@pytest.mark.asyncio
async def test_video_stream_range_request_with_encoded_filename(client, tmp_video_file_with_spaces):
    """
    **Validates: Requirements 4.2, 4.4**
    
    WHEN the HTML5 video player sends a Range request with URL-encoded filename
    THEN the Backend_API SHALL respond with 206 Partial Content
    """
    encoded_filename = "Theft%20Camera%20.mp4"
    
    with patch(
        "app.depot.vision.video_library.get_local_video_path",
        return_value=tmp_video_file_with_spaces,
    ):
        response = await client.get(
            f"{VIDEO_ENDPOINT_BASE}/{encoded_filename}/stream",
            headers={"Range": "bytes=0-255"},
        )

    assert response.status_code == 206, (
        f"Expected 206 Partial Content for Range request with encoded filename, got {response.status_code}"
    )
    assert "Content-Range" in response.headers


@pytest.mark.asyncio
async def test_video_stream_returns_correct_content_type(client, tmp_video_file):
    """
    **Validates: Requirement 4.1**
    
    WHEN the Analysis_Modal requests a video stream
    THEN the Backend_API SHALL return FileResponse with video/mp4 content type
    """
    with patch(
        "app.depot.vision.video_library.get_local_video_path",
        return_value=tmp_video_file,
    ):
        response = await client.get(
            f"{VIDEO_ENDPOINT_BASE}/Perimeter_Detection.mp4/stream"
        )

    assert response.status_code == 200
    assert response.headers.get("Content-Type") == "video/mp4", (
        f"Expected Content-Type: video/mp4, got {response.headers.get('Content-Type')!r}"
    )


@pytest.mark.asyncio
async def test_video_stream_cache_control_header(client, tmp_video_file):
    """
    **Validates: Requirement 4.1**
    
    WHEN the Backend_API returns a video stream
    THEN it SHALL include Cache-Control: no-cache header
    """
    with patch(
        "app.depot.vision.video_library.get_local_video_path",
        return_value=tmp_video_file,
    ):
        response = await client.get(
            f"{VIDEO_ENDPOINT_BASE}/Perimeter_Detection.mp4/stream"
        )

    assert response.status_code == 200
    assert response.headers.get("Cache-Control") == "no-cache", (
        f"Expected Cache-Control: no-cache, got {response.headers.get('Cache-Control')!r}"
    )


@pytest.mark.asyncio
async def test_video_stream_multiple_range_requests(client, tmp_video_file):
    """
    **Validates: Requirement 4.2**
    
    WHEN the HTML5 video player sends multiple Range requests (seeking)
    THEN the Backend_API SHALL respond with correct partial content for each request
    """
    with patch(
        "app.depot.vision.video_library.get_local_video_path",
        return_value=tmp_video_file,
    ):
        # First range request
        response1 = await client.get(
            f"{VIDEO_ENDPOINT_BASE}/Perimeter_Detection.mp4/stream",
            headers={"Range": "bytes=0-255"},
        )
        
        # Second range request (seeking forward)
        response2 = await client.get(
            f"{VIDEO_ENDPOINT_BASE}/Perimeter_Detection.mp4/stream",
            headers={"Range": "bytes=512-767"},
        )

    assert response1.status_code == 206
    assert response2.status_code == 206
    assert "Content-Range" in response1.headers
    assert "Content-Range" in response2.headers
    # Verify different content ranges
    assert response1.headers["Content-Range"] != response2.headers["Content-Range"]
