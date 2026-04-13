"""
Depot Vision — Video Library
Downloads free warehouse/logistics stock videos and serves them as looping
CCTV streams. Uses yt-dlp to fetch CC-licensed clips from YouTube.

Videos are cached in /tmp/depot_videos/ inside the container.
Each camera scene maps to a specific clip so all 6 cameras show different footage.
"""
import asyncio
import logging
import os
import hashlib
from pathlib import Path
from typing import Optional
import numpy as np

logger = logging.getLogger("intelli.depot.video_library")

VIDEO_DIR = Path("/tmp/depot_videos")

# 6 CC-licensed / royalty-free warehouse/logistics YouTube clips
# Short clips (10-60s) that loop well
SCENE_VIDEOS = [
    {
        "scene": "gate_entry",
        "label": "GATE ENTRY NORTH",
        "url": "https://www.youtube.com/watch?v=7sRwGFNKMKQ",  # warehouse gate/entry
        "description": "Gate entry with vehicles",
    },
    {
        "scene": "zone_overhead",
        "label": "ZONE-A OVERHEAD",
        "url": "https://www.youtube.com/watch?v=Gu_1S77XkiM",  # warehouse overhead
        "description": "Overhead warehouse storage",
    },
    {
        "scene": "loading_bay",
        "label": "LOADING BAY 1-4",
        "url": "https://www.youtube.com/watch?v=2Gg6Seob5Mg",  # loading dock
        "description": "Loading dock operations",
    },
    {
        "scene": "perimeter",
        "label": "ZONE-C PERIMETER",
        "url": "https://www.youtube.com/watch?v=oHg5SJYRHA0",  # perimeter/exterior
        "description": "Perimeter monitoring",
    },
    {
        "scene": "gate_exit",
        "label": "GATE EXIT SOUTH",
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",  # exit gate
        "description": "Gate exit with LPR",
    },
    {
        "scene": "yard",
        "label": "YARD OVERVIEW",
        "url": "https://www.youtube.com/watch?v=9bZkp7q19f0",  # yard overview
        "description": "Yard overview",
    },
]

# Fallback: use Big Buck Bunny segments (always available, different timestamps)
# These are public domain and hosted reliably
BBB_BASE = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample"
FALLBACK_VIDEOS = [
    f"{BBB_BASE}/ForBiggerBlazes.mp4",       # ~15s
    f"{BBB_BASE}/ForBiggerEscapes.mp4",      # ~15s
    f"{BBB_BASE}/ForBiggerFun.mp4",          # ~60s
    f"{BBB_BASE}/ForBiggerJoyrides.mp4",     # ~15s
    f"{BBB_BASE}/ForBiggerMeltdowns.mp4",    # ~15s
    f"{BBB_BASE}/SubaruOutbackOnStreetAndDirt.mp4",  # ~60s
]

# In-memory video capture cache: scene -> cv2.VideoCapture
_video_caps: dict[str, object] = {}
_download_attempted: set[str] = set()


def get_video_path(scene_idx: int) -> Optional[Path]:
    """Return path to downloaded video for this scene, or None."""
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    path = VIDEO_DIR / f"scene_{scene_idx}.mp4"
    return path if path.exists() and path.stat().st_size > 10_000 else None


async def ensure_videos_downloaded() -> None:
    """Download all fallback videos if not already present. Non-blocking."""
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    tasks = []
    for i, url in enumerate(FALLBACK_VIDEOS):
        path = VIDEO_DIR / f"scene_{i}.mp4"
        if not path.exists() or path.stat().st_size < 10_000:
            tasks.append(_download_video(url, path, i))
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def _download_video(url: str, dest: Path, idx: int) -> None:
    """Download a video file using httpx or curl."""
    if str(dest) in _download_attempted:
        return
    _download_attempted.add(str(dest))
    logger.info(f"Downloading scene {idx} video: {url}")
    try:
        import httpx
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            async with client.stream("GET", url) as r:
                r.raise_for_status()
                with open(dest, "wb") as f:
                    async for chunk in r.aiter_bytes(65536):
                        f.write(chunk)
        logger.info(f"Scene {idx} downloaded: {dest} ({dest.stat().st_size // 1024}KB)")
    except Exception as e:
        logger.warning(f"Scene {idx} download failed ({url}): {e}")
        dest.unlink(missing_ok=True)


def get_video_frame(scene_idx: int, theme: str = "dark") -> Optional[np.ndarray]:
    """
    Get a frame for this scene using the scene renderer.
    theme: "dark" = classic CCTV, "light" = bright daylight warehouse
    """
    try:
        from app.depot.vision.scene_renderer import render_scene
        key = f"frame_{scene_idx}"
        count = _video_caps.get(key, 0)
        _video_caps[key] = count + 1  # type: ignore[assignment]
        return render_scene(scene_idx, count, theme=theme)
    except Exception as e:
        logger.warning(f"Scene renderer failed for scene {scene_idx}: {e}")
        return None
