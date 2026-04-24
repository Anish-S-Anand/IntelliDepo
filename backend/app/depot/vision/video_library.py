"""
Depot Vision — Video Library
Serves local depot CCTV recordings as looping camera feeds.

Videos are stored in backend/app/depot/vision/videos/ and mapped to
camera scenes (gate entry, zone overhead, loading bay, etc.).
Each camera gets a unique video file that loops continuously.
"""
import logging
import os
import sys
from pathlib import Path
from typing import Optional
import numpy as np

logger = logging.getLogger("intelli.depot.video_library")

try:
    import cv2
    _HAS_CV2 = True
except ImportError:
    _HAS_CV2 = False

# ---------------------------------------------------------------------------
# Local video directory — bundled with the project
# ---------------------------------------------------------------------------
from pathlib import Path

_THIS_FILE = Path(__file__).resolve()
BACKEND_DIR = _THIS_FILE.parents[3]   # backend/
LOCAL_VIDEO_DIR = BACKEND_DIR / "videos"

# ---------------------------------------------------------------------------
# Depot video files mapped to camera scenes (0-5)
# These are real warehouse/depot recordings from the depot pendrive.
# Additional videos beyond the 6 primary scenes are available for
# detection training and analytics.
# ---------------------------------------------------------------------------
SCENE_VIDEOS = [
    {
        "scene": "gate_entry",
        "label": "GATE ENTRY NORTH",
        "filename": "dtranshipment 1 (2).mp4",
        "description": "Transhipment area — gate entry operations",
    },
    {
        "scene": "zone_overhead",
        "label": "ZONE-A OVERHEAD",
        "filename": "cluster 13 (1).mp4",
        "description": "Cluster 13 — overhead zone storage view",
    },
    {
        "scene": "loading_bay",
        "label": "LOADING BAY 1-4",
        "filename": "cluster 4-5 (1).mp4",
        "description": "Cluster 4-5 — loading bay operations",
    },
    {
        "scene": "perimeter",
        "label": "ZONE-C PERIMETER",
        "filename": "Recording 2025-07-30 115417.mp4",
        "description": "Depot recording — perimeter monitoring",
    },
    {
        "scene": "gate_exit",
        "label": "GATE EXIT SOUTH",
        "filename": "Recording 2025-08-11 171805.mp4",
        "description": "Depot recording — exit gate operations",
    },
    {
        "scene": "yard",
        "label": "YARD OVERVIEW",
        "filename": "Screen Recording 2025-08-11 174929.mp4",
        "description": "Depot screen recording — yard overview",
    },
]

# All available depot videos for training/detection beyond the 6 primary scenes
ALL_DEPOT_VIDEOS = [
    "cluster 13 (1).mp4",
    "cluster 4-5 (1).mp4",
    "dtranshipment 1 (2).mp4",
    "Recording 2025-07-30 115417.mp4",
    "Recording 2025-08-11 171805.mp4",
    "Screen Recording 2025-04-29 120722.mp4",
    "Screen Recording 2025-04-29 131812.mp4",
    "Screen Recording 2025-05-09 125537.mp4",
    "Screen Recording 2025-05-14 081914.mp4",
    "Screen Recording 2025-05-22 164244.mp4",
    "Screen Recording 2025-07-14 142945.mp4",
    "Screen Recording 2025-07-14 143106.mp4",
    "Screen Recording 2025-07-30 115414.mp4",
    "Screen Recording 2025-07-30 120512.mp4",
    "Screen Recording 2025-08-11 171757.mp4",
    "Screen Recording 2025-08-11 173926.mp4",
    "Screen Recording 2025-08-11 174012.mp4",
    "Screen Recording 2025-08-11 174233.mp4",
    "Screen Recording 2025-08-11 174929.mp4",
]

# In-memory video capture cache: key -> cv2.VideoCapture
_video_caps: dict[str, object] = {}


def get_local_video_path(filename: str) -> Optional[Path]:
    """Return path to a local depot video, or None if not found."""
    path = LOCAL_VIDEO_DIR / filename
    return path if path.exists() and path.stat().st_size > 10_000 else None


def get_video_path(scene_idx: int) -> Optional[Path]:
    """Return path to the video file for this scene index."""
    if scene_idx < 0 or scene_idx >= len(SCENE_VIDEOS):
        return None
    filename = SCENE_VIDEOS[scene_idx]["filename"]
    return get_local_video_path(filename)


def list_available_videos() -> list[dict]:
    """List all depot videos with their availability status."""
    results = []
    for filename in ALL_DEPOT_VIDEOS:
        path = LOCAL_VIDEO_DIR / filename
        exists = path.exists() and path.stat().st_size > 10_000
        info = {
            "filename": filename,
            "available": exists,
            "size_mb": round(path.stat().st_size / (1024 * 1024), 1) if exists else 0,
        }
        # Check if it's assigned to a scene
        for i, sv in enumerate(SCENE_VIDEOS):
            if sv["filename"] == filename:
                info["scene_idx"] = i
                info["scene_label"] = sv["label"]
                break
        results.append(info)
    return results


def _open_video_capture(video_path: Path, seek_seconds: float = 0.0) -> Optional[object]:
    """Open a cv2.VideoCapture for a local video file."""
    if not _HAS_CV2:
        return None
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None
    if seek_seconds > 0:
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(seek_seconds * fps))
    return cap


def get_video_frame(scene_idx: int, theme: str = "dark") -> Optional[np.ndarray]:
    """
    Read the next frame from the local depot video for this scene.
    Loops automatically when the video ends.
    Falls back to scene_renderer if video is unavailable.
    """
    video_path = get_video_path(scene_idx)

    if video_path is not None and _HAS_CV2:
        key = f"local_{scene_idx}"

        # Open capture if not cached
        if key not in _video_caps or _video_caps[key] is None:
            _video_caps[key] = _open_video_capture(video_path)

        cap = _video_caps.get(key)
        if cap is not None:
            ret, frame = cap.read()
            if not ret or frame is None:
                # End of video — loop back to start
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
            if ret and frame is not None:
                # Resize to consistent 854x480 for CCTV display
                frame = cv2.resize(frame, (854, 480))
                return frame

        # If capture failed, remove from cache so we retry next time
        _video_caps.pop(key, None)

    # Fallback to synthetic scene renderer
    try:
        from app.depot.vision.scene_renderer import render_scene
        key = f"frame_{scene_idx}"
        count = _video_caps.get(key, 0)
        _video_caps[key] = count + 1  # type: ignore[assignment]
        return render_scene(scene_idx, count, theme=theme)
    except Exception as e:
        logger.warning(f"Scene renderer failed for scene {scene_idx}: {e}")
        return None


def get_video_frame_by_filename(filename: str) -> Optional[np.ndarray]:
    """
    Read the next frame from a specific depot video file by name.
    Useful for running detection/training on any video, not just the 6 scenes.
    """
    if not _HAS_CV2:
        return None

    video_path = get_local_video_path(filename)
    if video_path is None:
        return None

    key = f"file_{filename}"
    if key not in _video_caps or _video_caps[key] is None:
        _video_caps[key] = _open_video_capture(video_path)

    cap = _video_caps.get(key)
    if cap is None:
        return None

    ret, frame = cap.read()
    if not ret or frame is None:
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        ret, frame = cap.read()
    if ret and frame is not None:
        return frame
    return None


def release_all():
    """Release all open video captures."""
    for key, cap in list(_video_caps.items()):
        if hasattr(cap, "release"):
            try:
                cap.release()
            except Exception:
                pass
    _video_caps.clear()
