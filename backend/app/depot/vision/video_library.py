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
import sys
import hashlib
from pathlib import Path
from typing import Optional
import numpy as np

logger = logging.getLogger("intelli.depot.video_library")

if sys.platform == "win32":
    VIDEO_DIR = Path(os.environ.get("TEMP", "C:\\Temp")) / "depot_videos"
else:
    VIDEO_DIR = Path("/tmp/depot_videos")

# ---------------------------------------------------------------------------
# Live public camera feeds (real-time MJPEG or auto-refresh JPEG)
# ---------------------------------------------------------------------------
LIVE_FEEDS = [
    {
        "scene": "gate_entry",
        "label": "GATE ENTRY NORTH",
        "live_url": "https://weathercam.digitraffic.fi/C0450502.jpg",
        "type": "jpeg_refresh",
        "description": "Finland highway cam — gate entry view (JPEG, ~10s refresh)",
    },
    {
        "scene": "zone_overhead",
        "label": "ZONE-A OVERHEAD",
        "live_url": "https://weathercam.digitraffic.fi/C0450601.jpg",
        "type": "jpeg_refresh",
        "description": "Finland highway cam — overhead zone view (JPEG, ~10s refresh)",
    },
    {
        "scene": "loading_bay",
        "label": "LOADING BAY 1-4",
        "live_url": "https://weathercam.digitraffic.fi/C0450501.jpg",
        "type": "jpeg_refresh",
        "description": "Finland highway cam — loading/trucks (JPEG, ~10s refresh)",
    },
    {
        "scene": "perimeter",
        "label": "ZONE-C PERIMETER",
        "live_url": "https://weathercam.digitraffic.fi/C0450701.jpg",
        "type": "jpeg_refresh",
        "description": "Finland highway cam — perimeter view (JPEG, ~10s refresh)",
    },
    {
        "scene": "gate_exit",
        "label": "GATE EXIT SOUTH",
        "live_url": "https://weathercam.digitraffic.fi/C0150301.jpg",
        "type": "jpeg_refresh",
        "description": "Finland highway cam — exit view (JPEG, ~10s refresh)",
    },
    {
        "scene": "yard",
        "label": "YARD OVERVIEW",
        "live_url": "https://weathercam.digitraffic.fi/C0650101.jpg",
        "type": "jpeg_refresh",
        "description": "Finland highway cam — wide yard overview (JPEG, ~10s refresh)",
    },
]

# 6 royalty-free warehouse/logistics clips from Mixkit (offline fallback)
# Direct MP4 links — short clips (8-30s) that loop when live feeds are unavailable
SCENE_VIDEOS = [
    {
        "scene": "gate_entry",
        "label": "GATE ENTRY NORTH",
        "url": "https://assets.mixkit.co/videos/23011/23011-720.mp4",
        "description": "Truck arriving at warehouse gate — gate entry view",
    },
    {
        "scene": "zone_overhead",
        "label": "ZONE-A OVERHEAD",
        "url": "https://assets.mixkit.co/videos/23551/23551-720.mp4",
        "description": "Warehouse interior walkthrough — overhead zone monitoring",
    },
    {
        "scene": "loading_bay",
        "label": "LOADING BAY 1-4",
        "url": "https://assets.mixkit.co/videos/13067/13067-720.mp4",
        "description": "Workers loading boxes onto freight truck at loading bay",
    },
    {
        "scene": "perimeter",
        "label": "ZONE-C PERIMETER",
        "url": "https://assets.mixkit.co/videos/39453/39453-720.mp4",
        "description": "High-angle perimeter overview of warehouse complex",
    },
    {
        "scene": "gate_exit",
        "label": "GATE EXIT SOUTH",
        "url": "https://assets.mixkit.co/videos/23852/23852-720.mp4",
        "description": "Worker directing freight truck at exit gate",
    },
    {
        "scene": "yard",
        "label": "YARD OVERVIEW",
        "url": "https://assets.mixkit.co/videos/39462/39462-720.mp4",
        "description": "Aerial yard overview with trucks and cargo operations",
    },
]

# Fallback: direct Mixkit MP4 links (same scene videos, always reachable)
FALLBACK_VIDEOS = [
    "https://assets.mixkit.co/videos/23011/23011-720.mp4",   # gate entry — truck arriving
    "https://assets.mixkit.co/videos/23551/23551-720.mp4",   # zone overhead — warehouse walk
    "https://assets.mixkit.co/videos/13067/13067-720.mp4",   # loading bay — workers loading truck
    "https://assets.mixkit.co/videos/39453/39453-720.mp4",   # perimeter — high-angle overview
    "https://assets.mixkit.co/videos/23852/23852-720.mp4",   # gate exit — truck with worker
    "https://assets.mixkit.co/videos/39462/39462-720.mp4",   # yard — port/yard overview
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
