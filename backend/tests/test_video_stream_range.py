"""
Bug condition exploration test for the video stream Range request fix.

Validates: bugfix.md — Bug Condition 1.2
  WHEN the video modal is open and the browser requests the video stream
  via the <video> element THEN the system returns a response that does not
  support HTTP Range requests (no 206 Partial Content), causing the HTML5
  video player to fail to load the video.

Property: Fix Checking — Range request returns 206 Partial Content
  FOR ALL X WHERE isBugCondition(X) DO
    result ← streamVideoFile'(X)
    ASSERT result.status_code = 206
      AND result.headers["Content-Range"] IS NOT NULL
      AND result.headers["Accept-Ranges"] = "bytes"
  END FOR

Property: Preservation Checking — non-range requests still return 200
  FOR ALL X WHERE NOT isBugCondition(X) DO
    ASSERT streamVideoFile(X) = streamVideoFile'(X)
  END FOR
"""
import os
import tempfile
import pytest
from unittest.mock import patch

# Dummy video content — 1 KB of fake MP4 bytes (enough to test range slicing)
DUMMY_VIDEO_BYTES = b"\x00\x00\x00\x18ftypisom" + b"\x00" * (1024 - 16)
DUMMY_VIDEO_SIZE = len(DUMMY_VIDEO_BYTES)

VIDEO_ENDPOINT = "/depot/vision/cameras/video-library/Perimeter_Detection.mp4/stream"


@pytest.fixture
def tmp_video_file(tmp_path):
    """Create a real temporary video file so FileResponse can stat it."""
    video_file = tmp_path / "Perimeter_Detection.mp4"
    video_file.write_bytes(DUMMY_VIDEO_BYTES)
    return str(video_file)


@pytest.mark.asyncio
async def test_video_stream_range_returns_206(client, tmp_video_file):
    """
    **Validates: bugfix.md Bug Condition 1.2 — Fix Checking Property**

    Bug condition: browser sends GET with Range: bytes=0- to the stream endpoint.
    Expected (after fix): 206 Partial Content with Content-Range and Accept-Ranges headers.
    Current behaviour (before fix): 200 OK — this test SHOULD FAIL on unfixed code,
    confirming the bug exists.
    """
    with patch(
        "app.depot.vision.video_library.get_local_video_path",
        return_value=tmp_video_file,
    ):
        response = await client.get(
            VIDEO_ENDPOINT,
            headers={"Range": "bytes=0-"},
        )

    assert response.status_code == 206, (
        f"Expected 206 Partial Content for a Range request, got {response.status_code}. "
        "This confirms the bug: FileResponse does not handle Range headers."
    )
    assert "Content-Range" in response.headers, (
        "Expected Content-Range header in 206 response"
    )
    assert response.headers.get("Accept-Ranges") == "bytes", (
        f"Expected Accept-Ranges: bytes, got {response.headers.get('Accept-Ranges')!r}"
    )


@pytest.mark.asyncio
async def test_video_stream_no_range_returns_200(client, tmp_video_file):
    """
    **Validates: bugfix.md Preservation Checking Property**

    Non-range requests (no Range header) must continue to return 200 OK.
    This is the regression guard — the fix must not break full-file delivery.
    """
    with patch(
        "app.depot.vision.video_library.get_local_video_path",
        return_value=tmp_video_file,
    ):
        response = await client.get(VIDEO_ENDPOINT)

    assert response.status_code == 200, (
        f"Expected 200 OK for a non-range request, got {response.status_code}"
    )
