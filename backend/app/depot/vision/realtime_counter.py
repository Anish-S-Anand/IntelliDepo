"""
Intelli Depot — Real-Time Bag Counting Pipeline
Feature: DEPOT-RT

Continuous YOLO detection + object tracking on live camera feeds.
Counts bags/boxes crossing a counting line (in/out direction) and
publishes live count updates via the RealTimeHub (WebSocket/SSE).

Modelled after JSW Cement's real-time depot counting system.

Usage:
    from app.depot.vision.realtime_counter import start_realtime_counting, stop_realtime_counting
    # Start at app startup (after cameras are connected)
    asyncio.create_task(start_realtime_counting())
"""
import asyncio
import logging
import os
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

import numpy as np

logger = logging.getLogger("intelli.depot.realtime_counter")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
COUNTING_LINE_Y = float(os.getenv("COUNTING_LINE_Y", "0.5"))  # normalised Y position
DETECTION_INTERVAL = float(os.getenv("RT_DETECTION_INTERVAL", "3.0"))  # seconds between frames
PUBLISH_INTERVAL = float(os.getenv("RT_PUBLISH_INTERVAL", "2.0"))  # seconds between WS pushes
CONFIDENCE_THRESHOLD = float(os.getenv("RT_CONFIDENCE", "0.40"))
# Classes we count (after mapping)
COUNTABLE_CLASSES = ["bag", "box", "pallet", "carton", "truck"]

# YOLO class mapping — maps custom + COCO classes to counting labels
_YOLO_CLASS_MAP = {
    # JSW trained model classes
    "Cement Bags": "bag",
    "Truck": "truck",
    "Truck Back": "truck",
    "Truck space": "truck",
    # COCO fallback classes
    "backpack": "bag", "handbag": "bag", "suitcase": "bag",
    "box": "box", "carton": "carton", "pallet": "pallet",
}

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
_running = False
_task: Optional[asyncio.Task] = None

# Per-camera live counts
_camera_counts: dict[str, dict] = {}
# Global aggregated counts for today
_today_counts: dict[str, int] = defaultdict(int)
# Track previous positions for direction detection
_track_positions: dict[str, dict[int, float]] = {}  # camera_id -> {track_id: last_y}
_counted_tracks: dict[str, set[int]] = {}  # camera_id -> set of already-counted track_ids
# Track ID counter for simple IoU tracker
_next_track_id: int = 0


def get_live_counts() -> dict:
    """Return current live counts for all cameras + global totals."""
    return {
        "today": dict(_today_counts),
        "cameras": dict(_camera_counts),
        "counting_line_y": COUNTING_LINE_Y,
        "running": _running,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def get_camera_counts(camera_id: str) -> dict:
    """Return live counts for a specific camera."""
    return _camera_counts.get(camera_id, {
        "camera_id": camera_id,
        "in_count": 0, "out_count": 0, "total": 0,
        "by_class": {},
    })


# ---------------------------------------------------------------------------
# Simple IoU Tracker (no DeepSORT dependency needed)
# ---------------------------------------------------------------------------

class _SimpleTracker:
    """Lightweight IoU-based tracker for real-time counting.
    Assigns persistent IDs to detections across frames using IoU matching."""

    def __init__(self, iou_threshold: float = 0.3, max_age: int = 10):
        self.iou_threshold = iou_threshold
        self.max_age = max_age  # frames before track is dropped
        self.tracks: dict[int, dict] = {}  # track_id -> {bbox, class, age, last_y}
        self._next_id = 0

    def update(self, detections: list[dict]) -> list[dict]:
        """Match new detections to existing tracks, return tracked objects."""
        if not detections:
            # Age out all tracks
            for tid in list(self.tracks):
                self.tracks[tid]["age"] += 1
                if self.tracks[tid]["age"] > self.max_age:
                    del self.tracks[tid]
            return []

        # Calculate IoU between all tracks and new detections
        matched = set()
        matched_dets = set()
        results = []

        track_ids = list(self.tracks.keys())
        for tid in track_ids:
            best_iou = 0.0
            best_det_idx = -1
            for di, det in enumerate(detections):
                if di in matched_dets:
                    continue
                iou = self._calc_iou(self.tracks[tid], det)
                if iou > best_iou:
                    best_iou = iou
                    best_det_idx = di

            if best_iou >= self.iou_threshold and best_det_idx >= 0:
                det = detections[best_det_idx]
                prev_y = self.tracks[tid]["center_y"]
                new_y = det["bbox_y"] + det["bbox_h"] / 2
                self.tracks[tid].update({
                    "bbox_x": det["bbox_x"], "bbox_y": det["bbox_y"],
                    "bbox_w": det["bbox_w"], "bbox_h": det["bbox_h"],
                    "center_y": new_y,
                    "prev_y": prev_y,
                    "class": det["class_label"],
                    "confidence": det["confidence"],
                    "age": 0,
                })
                results.append({"track_id": tid, **self.tracks[tid]})
                matched.add(tid)
                matched_dets.add(best_det_idx)

        # Age out unmatched tracks
        for tid in track_ids:
            if tid not in matched:
                self.tracks[tid]["age"] += 1
                if self.tracks[tid]["age"] > self.max_age:
                    del self.tracks[tid]

        # Create new tracks for unmatched detections
        for di, det in enumerate(detections):
            if di not in matched_dets:
                tid = self._next_id
                self._next_id += 1
                center_y = det["bbox_y"] + det["bbox_h"] / 2
                self.tracks[tid] = {
                    "bbox_x": det["bbox_x"], "bbox_y": det["bbox_y"],
                    "bbox_w": det["bbox_w"], "bbox_h": det["bbox_h"],
                    "center_y": center_y,
                    "prev_y": center_y,
                    "class": det["class_label"],
                    "confidence": det["confidence"],
                    "age": 0,
                }
                results.append({"track_id": tid, **self.tracks[tid]})

        return results

    @staticmethod
    def _calc_iou(track: dict, det: dict) -> float:
        x1 = max(track["bbox_x"], det["bbox_x"])
        y1 = max(track["bbox_y"], det["bbox_y"])
        x2 = min(track["bbox_x"] + track["bbox_w"], det["bbox_x"] + det["bbox_w"])
        y2 = min(track["bbox_y"] + track["bbox_h"], det["bbox_y"] + det["bbox_h"])
        inter = max(0, x2 - x1) * max(0, y2 - y1)
        if inter == 0:
            return 0.0
        area_t = track["bbox_w"] * track["bbox_h"]
        area_d = det["bbox_w"] * det["bbox_h"]
        return inter / (area_t + area_d - inter)


# Per-camera trackers
_trackers: dict[str, _SimpleTracker] = {}


# ---------------------------------------------------------------------------
# YOLO model loader
# ---------------------------------------------------------------------------
_yolo_model = None
DEFAULT_YOLO_WEIGHTS = os.getenv(
    "YOLO_WEIGHTS",
    r"C:\Users\karte\OneDrive - Fidelis Technology Services Pvt Ltd\Desktop\intelli-platform\best_cement_bags_2025-05-29.pt",
)


def _load_model():
    global _yolo_model
    if _yolo_model is not None:
        return _yolo_model
    try:
        from ultralytics import YOLO
        from pathlib import Path

        # Priority: 1) custom trained weights, 2) env var, 3) project-local, 4) auto-download
        custom_weights = Path(__file__).resolve().parent / "training_data" / "weights" / "depot_best.pt"
        env_weights = DEFAULT_YOLO_WEIGHTS

        if custom_weights.exists():
            _yolo_model = YOLO(str(custom_weights))
            logger.info(f"YOLO model loaded: custom depot weights ({custom_weights.name})")
        elif env_weights and Path(env_weights).exists():
            _yolo_model = YOLO(env_weights)
            logger.info(f"YOLO model loaded: {env_weights}")
        else:
            _yolo_model = YOLO("yolov8n.pt")
            logger.info("YOLO model loaded: default yolov8n.pt")
        return _yolo_model
    except Exception as e:
        logger.warning(f"YOLO model not available: {e}")
        return None


def _detect_frame(frame: np.ndarray) -> list[dict]:
    """Run YOLO on a single frame, return normalised detections."""
    model = _load_model()
    if model is None:
        # Simulation fallback
        import random
        dets = []
        for _ in range(random.randint(1, 5)):
            dets.append({
                "class_label": random.choice(COUNTABLE_CLASSES),
                "confidence": round(random.uniform(0.5, 0.95), 4),
                "bbox_x": round(random.uniform(0.1, 0.7), 4),
                "bbox_y": round(random.uniform(0.1, 0.7), 4),
                "bbox_w": round(random.uniform(0.05, 0.2), 4),
                "bbox_h": round(random.uniform(0.05, 0.25), 4),
            })
        return dets

    h, w = frame.shape[:2]
    results = model(frame, conf=CONFIDENCE_THRESHOLD, verbose=False)
    dets = []
    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            cls_name = r.names.get(cls_id, "unknown")
            mapped = _YOLO_CLASS_MAP.get(cls_name, cls_name)
            if mapped not in COUNTABLE_CLASSES:
                continue
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            dets.append({
                "class_label": mapped,
                "confidence": round(conf, 4),
                "bbox_x": round(x1 / w, 4),
                "bbox_y": round(y1 / h, 4),
                "bbox_w": round((x2 - x1) / w, 4),
                "bbox_h": round((y2 - y1) / h, 4),
            })
    return dets


# ---------------------------------------------------------------------------
# Counting logic — objects crossing the counting line
# ---------------------------------------------------------------------------

def _process_tracks(camera_id: str, tracked: list[dict]) -> dict:
    """Check which tracked objects cross the counting line. Returns delta counts."""
    if camera_id not in _counted_tracks:
        _counted_tracks[camera_id] = set()

    counted = _counted_tracks[camera_id]
    delta = {"in": 0, "out": 0, "by_class_in": defaultdict(int), "by_class_out": defaultdict(int)}

    for obj in tracked:
        tid = obj["track_id"]
        if tid in counted:
            continue

        prev_y = obj.get("prev_y", obj["center_y"])
        curr_y = obj["center_y"]

        # Check if object crossed the counting line
        if prev_y < COUNTING_LINE_Y <= curr_y:
            # Moving downward = inbound
            delta["in"] += 1
            delta["by_class_in"][obj["class"]] += 1
            counted.add(tid)
        elif prev_y > COUNTING_LINE_Y >= curr_y:
            # Moving upward = outbound
            delta["out"] += 1
            delta["by_class_out"][obj["class"]] += 1
            counted.add(tid)

    return delta


# ---------------------------------------------------------------------------
# Main real-time loop
# ---------------------------------------------------------------------------

_own_captures: dict[str, object] = {}  # camera_id -> own cv2.VideoCapture


def _read_own_frame(cam_id: str, stream_url: str) -> Optional[np.ndarray]:
    """Read a frame using the counter's own capture (not shared with MJPEG streams)."""
    try:
        import cv2
    except ImportError:
        return None

    if stream_url.startswith("local:"):
        filename = stream_url[len("local:"):]
        from app.depot.vision.video_library import get_local_video_path
        vpath = get_local_video_path(filename)
        if vpath is None:
            return None

        cap = _own_captures.get(cam_id)
        if cap is None:
            cap = cv2.VideoCapture(str(vpath))
            if not cap.isOpened():
                return None
            _own_captures[cam_id] = cap

        ret, frame = cap.read()
        if not ret or frame is None:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = cap.read()
        if ret and frame is not None:
            return cv2.resize(frame, (854, 480))
        return None
    return None


async def _realtime_loop():
    """Continuously process camera frames, run detection + tracking, publish counts."""
    global _running
    _running = True
    logger.info("Real-time counting pipeline started")

    from app.depot.vision.camera import _active_streams

    last_publish = 0.0

    while _running:
        try:
            loop = asyncio.get_running_loop()
            active_cameras = list(_active_streams.keys())

            if not active_cameras:
                await asyncio.sleep(2.0)
                continue

            for cam_id in active_cameras:
                if not _running:
                    break

                entry = _active_streams.get(cam_id)
                if entry is None:
                    continue

                # Read frame using our own dedicated capture
                frame = await loop.run_in_executor(
                    None, _read_own_frame, cam_id, entry.stream_url
                )
                if frame is None:
                    continue

                # Run YOLO detection in thread pool to avoid blocking
                dets = await loop.run_in_executor(None, _detect_frame, frame)

                # Track objects
                if cam_id not in _trackers:
                    _trackers[cam_id] = _SimpleTracker()
                tracked = _trackers[cam_id].update(dets)

                # Count crossings
                delta = _process_tracks(cam_id, tracked)

                # Update camera counts
                if cam_id not in _camera_counts:
                    _camera_counts[cam_id] = {
                        "camera_id": cam_id,
                        "in_count": 0, "out_count": 0, "total": 0,
                        "by_class": defaultdict(lambda: {"in": 0, "out": 0}),
                        "detections": [],
                        "last_update": None,
                    }

                cc = _camera_counts[cam_id]
                cc["in_count"] += delta["in"]
                cc["out_count"] += delta["out"]
                cc["total"] = cc["in_count"] + cc["out_count"]
                cc["last_update"] = datetime.now(timezone.utc).isoformat()

                # Store current detections for overlay
                cc["detections"] = [
                    {
                        "track_id": t["track_id"],
                        "class": t["class"],
                        "confidence": t["confidence"],
                        "bbox_x": t["bbox_x"],
                        "bbox_y": t["bbox_y"],
                        "bbox_w": t["bbox_w"],
                        "bbox_h": t["bbox_h"],
                    }
                    for t in tracked
                ]

                for cls, count in delta["by_class_in"].items():
                    if cls not in cc["by_class"]:
                        cc["by_class"][cls] = {"in": 0, "out": 0}
                    cc["by_class"][cls]["in"] += count
                for cls, count in delta["by_class_out"].items():
                    if cls not in cc["by_class"]:
                        cc["by_class"][cls] = {"in": 0, "out": 0}
                    cc["by_class"][cls]["out"] += count

                # Update global totals
                _today_counts["in"] += delta["in"]
                _today_counts["out"] += delta["out"]
                _today_counts["net"] = _today_counts["in"] - _today_counts["out"]
                _today_counts["total"] = _today_counts["in"] + _today_counts["out"]

            # Publish via WebSocket at configured interval
            now = time.monotonic()
            if now - last_publish >= PUBLISH_INTERVAL:
                last_publish = now
                await _publish_counts()

            await asyncio.sleep(DETECTION_INTERVAL)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Real-time counting error: {e}", exc_info=True)
            await asyncio.sleep(2.0)

    _running = False
    logger.info("Real-time counting pipeline stopped")


async def _publish_counts():
    """Publish current counts to WebSocket topic."""
    try:
        from app.core.gateway.realtime import realtime_hub
        payload = get_live_counts()
        await realtime_hub.publish(
            "depot.counting",
            "count_update",
            payload,
            sender="realtime-counter",
        )
    except Exception as e:
        logger.debug(f"WebSocket publish skipped: {e}")


# ---------------------------------------------------------------------------
# Control API
# ---------------------------------------------------------------------------

async def start_realtime_counting():
    """Start the real-time counting background task."""
    global _task, _running
    if _running:
        logger.info("Real-time counting already running")
        return
    _task = asyncio.create_task(_realtime_loop())
    logger.info("Real-time counting task created")


async def stop_realtime_counting():
    """Stop the real-time counting background task."""
    global _running, _task
    _running = False
    if _task:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None
    logger.info("Real-time counting stopped")


def reset_counts():
    """Reset all counts (e.g. at start of new day)."""
    global _today_counts, _camera_counts, _counted_tracks
    _today_counts.clear()
    _camera_counts.clear()
    _counted_tracks.clear()
    logger.info("All counts reset")


# ---------------------------------------------------------------------------
# FastAPI Router — REST endpoints for live counts
# ---------------------------------------------------------------------------

from fastapi import APIRouter

router = APIRouter(prefix="/depot/vision/realtime", tags=["Depot - Real-Time Counting"])


@router.get("/counts")
async def get_counts():
    """Get current live counts for all cameras and global totals."""
    return get_live_counts()


@router.get("/counts/{camera_id}")
async def get_counts_for_camera(camera_id: str):
    """Get live counts for a specific camera."""
    return get_camera_counts(camera_id)


@router.post("/start")
async def start_counting():
    """Start the real-time counting pipeline."""
    await start_realtime_counting()
    return {"status": "started", "running": _running}


@router.post("/stop")
async def stop_counting():
    """Stop the real-time counting pipeline."""
    await stop_realtime_counting()
    return {"status": "stopped", "running": _running}


@router.post("/reset")
async def reset():
    """Reset all counts to zero."""
    reset_counts()
    return {"status": "reset", "counts": get_live_counts()}


@router.get("/status")
async def get_status():
    """Get pipeline status."""
    from app.depot.vision.camera import _active_streams
    return {
        "running": _running,
        "active_cameras": len(_active_streams),
        "cameras_tracked": list(_camera_counts.keys()),
        "detection_interval": DETECTION_INTERVAL,
        "publish_interval": PUBLISH_INTERVAL,
        "counting_line_y": COUNTING_LINE_Y,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
    }
