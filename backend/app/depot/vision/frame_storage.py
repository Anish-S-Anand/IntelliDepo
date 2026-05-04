"""
Depot frame/snapshot storage helper.
Saves detection frames and LPR snapshots to MinIO via FileStorageService.
Gracefully degrades if MinIO is unavailable.
"""
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger("intelli.depot.storage")

_storage = None


def _get_storage():
    global _storage
    if _storage is not None:
        return _storage
    try:
        from app.core.data_infra.storage import FileStorageService
        _storage = FileStorageService()
        logger.info("Depot frame storage connected to MinIO")
        return _storage
    except Exception as e:
        logger.warning(f"MinIO storage unavailable — frames will not be archived: {e}")
        return None


def save_detection_frame(frame_bytes: bytes, run_id: str, frame_number: int) -> str | None:
    """Save a detection frame to MinIO. Returns the storage key or None."""
    storage = _get_storage()
    if not storage:
        return None
    try:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        key = f"depot/detections/{run_id}/{ts}_frame{frame_number}.jpg"
        storage.upload_file(
            file_data=frame_bytes,
            key=key,
            filename=f"frame_{frame_number}.jpg",
            content_type="image/jpeg",
        )
        logger.debug(f"Saved detection frame: {key}")
        return key
    except Exception as e:
        logger.warning(f"Failed to save detection frame: {e}")
        return None


def save_lpr_snapshot(frame_bytes: bytes, gate_code: str, plate_number: str) -> str | None:
    """Save an LPR gate snapshot to MinIO. Returns the storage key or None."""
    storage = _get_storage()
    if not storage:
        return None
    try:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safe_plate = plate_number.replace(" ", "_").replace("/", "-")
        key = f"depot/lpr/{gate_code}/{ts}_{safe_plate}.jpg"
        storage.upload_file(
            file_data=frame_bytes,
            key=key,
            filename=f"{safe_plate}.jpg",
            content_type="image/jpeg",
        )
        logger.debug(f"Saved LPR snapshot: {key}")
        return key
    except Exception as e:
        logger.warning(f"Failed to save LPR snapshot: {e}")
        return None
