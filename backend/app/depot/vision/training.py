"""
Intelli Depot — YOLO Training Pipeline
Feature: DEPOT-TRAIN

Extract frames from depot videos, train/fine-tune YOLOv8 on annotated
depot data for bag/box counting, and deploy trained weights.

Workflow:
  1. Extract frames:  POST /depot/vision/training/extract-frames
  2. Annotate:        Use CVAT/LabelImg/Roboflow on extracted frames
  3. Train:           POST /depot/vision/training/train
  4. Deploy:          POST /depot/vision/training/deploy
"""
import asyncio
import logging
import os
import shutil
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger("intelli.depot.training")

router = APIRouter(prefix="/depot/vision/training", tags=["Depot - YOLO Training"])

_train_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="yolo-train")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_THIS_DIR = Path(__file__).resolve().parent
_VIDEOS_DIR = _THIS_DIR / "videos"
_TRAINING_DIR = _THIS_DIR / "training_data"
_FRAMES_DIR = _TRAINING_DIR / "frames"
_DATASET_DIR = _TRAINING_DIR / "dataset"
_WEIGHTS_DIR = _TRAINING_DIR / "weights"
_CUSTOM_WEIGHTS = _WEIGHTS_DIR / "depot_best.pt"

# Classes for depot detection
DEPOT_CLASSES = ["bag", "box", "pallet", "carton", "person", "vehicle"]


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ExtractFramesRequest(BaseModel):
    video_filenames: list[str] = Field(
        default=[],
        description="List of video filenames to extract from. Empty = all videos."
    )
    frame_interval: int = Field(
        default=30,
        ge=1, le=300,
        description="Extract 1 frame every N frames (30 = ~1 per second at 30fps)"
    )
    max_frames_per_video: int = Field(
        default=200,
        ge=10, le=2000,
        description="Max frames to extract per video"
    )


class TrainRequest(BaseModel):
    epochs: int = Field(default=50, ge=5, le=300, description="Training epochs")
    batch_size: int = Field(default=8, ge=1, le=64, description="Batch size")
    img_size: int = Field(default=640, description="Image size for training")
    base_model: str = Field(default="yolov8n.pt", description="Base model to fine-tune")
    resume: bool = Field(default=False, description="Resume from last checkpoint")


# ---------------------------------------------------------------------------
# Step 1: Frame Extraction
# ---------------------------------------------------------------------------

def _extract_frames_from_video(
    video_path: Path,
    output_dir: Path,
    frame_interval: int = 30,
    max_frames: int = 200,
) -> int:
    """Extract frames from a video file at regular intervals."""
    try:
        import cv2
    except ImportError:
        raise RuntimeError("OpenCV required for frame extraction")

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        logger.warning(f"Cannot open video: {video_path}")
        return 0

    output_dir.mkdir(parents=True, exist_ok=True)
    video_stem = video_path.stem.replace(" ", "_")
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30

    count = 0
    frame_no = 0

    while count < max_frames:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_no % frame_interval == 0:
            # Resize to training size
            frame = cv2.resize(frame, (640, 640))
            filename = f"{video_stem}_f{frame_no:06d}.jpg"
            cv2.imwrite(str(output_dir / filename), frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
            count += 1

        frame_no += 1

    cap.release()
    logger.info(f"Extracted {count} frames from {video_path.name}")
    return count


@router.post("/extract-frames")
async def extract_frames(req: ExtractFramesRequest):
    """
    Step 1: Extract training frames from depot videos.
    Frames are saved to backend/app/depot/vision/training_data/frames/
    """
    from app.depot.vision.video_library import ALL_DEPOT_VIDEOS

    # Determine which videos to process
    if req.video_filenames:
        filenames = req.video_filenames
    else:
        filenames = ALL_DEPOT_VIDEOS

    _FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    loop = asyncio.get_running_loop()
    total_extracted = 0
    results = []

    for fname in filenames:
        video_path = _VIDEOS_DIR / fname
        if not video_path.exists():
            results.append({"video": fname, "status": "not_found", "frames": 0})
            continue

        count = await loop.run_in_executor(
            _train_pool,
            _extract_frames_from_video,
            video_path,
            _FRAMES_DIR,
            req.frame_interval,
            req.max_frames_per_video,
        )
        total_extracted += count
        results.append({"video": fname, "status": "ok", "frames": count})

    return {
        "total_frames": total_extracted,
        "output_dir": str(_FRAMES_DIR),
        "videos_processed": len(results),
        "results": results,
        "next_step": (
            "Annotate these frames using one of:\n"
            "  - CVAT (cvat.ai) — free, open-source, web-based\n"
            "  - Roboflow (roboflow.com) — easy, cloud-based, auto-augmentation\n"
            "  - LabelImg — lightweight desktop tool\n\n"
            f"Classes to label: {DEPOT_CLASSES}\n"
            "Export annotations in YOLO format (txt files with class_id x_center y_center width height)\n"
            f"Place images in {_DATASET_DIR}/images/train/ and labels in {_DATASET_DIR}/labels/train/"
        ),
    }


# ---------------------------------------------------------------------------
# Step 2: Dataset Setup (after manual annotation)
# ---------------------------------------------------------------------------

@router.post("/setup-dataset")
async def setup_dataset():
    """
    Step 2: Prepare the YOLO dataset structure after annotation.
    Creates the dataset.yaml config and validates the directory structure.

    Expected structure (create manually or via annotation tool export):
      training_data/dataset/
        images/
          train/    ← annotated training images (.jpg)
          val/      ← validation images (.jpg) — ~20% of data
        labels/
          train/    ← YOLO format .txt files (one per image)
          val/      ← validation labels
    """
    # Create directory structure
    for split in ["train", "val"]:
        (_DATASET_DIR / "images" / split).mkdir(parents=True, exist_ok=True)
        (_DATASET_DIR / "labels" / split).mkdir(parents=True, exist_ok=True)

    # Count existing files
    train_images = list((_DATASET_DIR / "images" / "train").glob("*.jpg"))
    val_images = list((_DATASET_DIR / "images" / "val").glob("*.jpg"))
    train_labels = list((_DATASET_DIR / "labels" / "train").glob("*.txt"))
    val_labels = list((_DATASET_DIR / "labels" / "val").glob("*.txt"))

    # Auto-split: if there are frames but no val set, split 80/20
    if len(train_images) > 0 and len(val_images) == 0:
        import random
        random.shuffle(train_images)
        split_idx = max(1, int(len(train_images) * 0.2))
        val_set = train_images[:split_idx]
        for img_path in val_set:
            # Move image
            shutil.move(str(img_path), str(_DATASET_DIR / "images" / "val" / img_path.name))
            # Move corresponding label if exists
            label_path = _DATASET_DIR / "labels" / "train" / (img_path.stem + ".txt")
            if label_path.exists():
                shutil.move(str(label_path), str(_DATASET_DIR / "labels" / "val" / label_path.name))

        train_images = list((_DATASET_DIR / "images" / "train").glob("*.jpg"))
        val_images = list((_DATASET_DIR / "images" / "val").glob("*.jpg"))
        train_labels = list((_DATASET_DIR / "labels" / "train").glob("*.txt"))
        val_labels = list((_DATASET_DIR / "labels" / "val").glob("*.txt"))

    # Write dataset.yaml
    yaml_content = f"""# IntelliDepot Custom Dataset
path: {_DATASET_DIR}
train: images/train
val: images/val

nc: {len(DEPOT_CLASSES)}
names: {DEPOT_CLASSES}
"""
    yaml_path = _DATASET_DIR / "dataset.yaml"
    yaml_path.write_text(yaml_content)

    return {
        "dataset_yaml": str(yaml_path),
        "classes": DEPOT_CLASSES,
        "train_images": len(train_images),
        "val_images": len(val_images),
        "train_labels": len(train_labels),
        "val_labels": len(val_labels),
        "ready": len(train_images) > 0 and len(train_labels) > 0,
        "directory_structure": {
            "images/train": str(_DATASET_DIR / "images" / "train"),
            "images/val": str(_DATASET_DIR / "images" / "val"),
            "labels/train": str(_DATASET_DIR / "labels" / "train"),
            "labels/val": str(_DATASET_DIR / "labels" / "val"),
        },
    }


# ---------------------------------------------------------------------------
# Step 3: Training
# ---------------------------------------------------------------------------

_training_status = {
    "running": False,
    "epoch": 0,
    "total_epochs": 0,
    "best_map": 0.0,
    "started_at": None,
    "completed_at": None,
    "error": None,
}


def _run_training(
    dataset_yaml: str,
    epochs: int,
    batch_size: int,
    img_size: int,
    base_model: str,
    resume: bool,
) -> dict:
    """Run YOLO training (blocking — call in thread pool)."""
    global _training_status
    try:
        from ultralytics import YOLO

        _training_status.update({
            "running": True,
            "epoch": 0,
            "total_epochs": epochs,
            "error": None,
            "started_at": datetime.now(timezone.utc).isoformat(),
        })

        model = YOLO(base_model)

        _WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

        results = model.train(
            data=dataset_yaml,
            epochs=epochs,
            batch=batch_size,
            imgsz=img_size,
            project=str(_WEIGHTS_DIR),
            name="depot_train",
            exist_ok=True,
            patience=10,
            save=True,
            plots=True,
            resume=resume,
        )

        # Copy best weights
        best_path = _WEIGHTS_DIR / "depot_train" / "weights" / "best.pt"
        if best_path.exists():
            shutil.copy2(str(best_path), str(_CUSTOM_WEIGHTS))
            logger.info(f"Best weights saved to {_CUSTOM_WEIGHTS}")

        _training_status.update({
            "running": False,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "best_map": float(getattr(results, "maps", [0])[-1]) if hasattr(results, "maps") else 0,
        })

        return {
            "status": "completed",
            "weights_path": str(_CUSTOM_WEIGHTS),
            "exists": _CUSTOM_WEIGHTS.exists(),
        }

    except Exception as e:
        _training_status.update({
            "running": False,
            "error": str(e),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.error(f"Training failed: {e}", exc_info=True)
        return {"status": "failed", "error": str(e)}


@router.post("/train")
async def start_training(req: TrainRequest):
    """
    Step 3: Train/fine-tune YOLOv8 on annotated depot data.
    Requires annotated dataset in training_data/dataset/.
    """
    if _training_status["running"]:
        raise HTTPException(status_code=409, detail="Training already in progress")

    dataset_yaml = _DATASET_DIR / "dataset.yaml"
    if not dataset_yaml.exists():
        raise HTTPException(
            status_code=400,
            detail="Dataset not set up. Run /setup-dataset first, then annotate frames."
        )

    # Verify we have training data
    train_images = list((_DATASET_DIR / "images" / "train").glob("*.jpg"))
    train_labels = list((_DATASET_DIR / "labels" / "train").glob("*.txt"))
    if len(train_images) == 0 or len(train_labels) == 0:
        raise HTTPException(
            status_code=400,
            detail=f"No training data found. Place annotated images in {_DATASET_DIR}/images/train/ "
                   f"and YOLO labels in {_DATASET_DIR}/labels/train/"
        )

    loop = asyncio.get_running_loop()
    # Run training in background thread
    asyncio.ensure_future(
        loop.run_in_executor(
            _train_pool,
            _run_training,
            str(dataset_yaml),
            req.epochs,
            req.batch_size,
            req.img_size,
            req.base_model,
            req.resume,
        )
    )

    return {
        "status": "started",
        "epochs": req.epochs,
        "batch_size": req.batch_size,
        "train_images": len(train_images),
        "train_labels": len(train_labels),
        "check_progress": "GET /depot/vision/training/status",
    }


@router.get("/status")
async def get_training_status():
    """Get current training status."""
    return {
        **_training_status,
        "custom_weights_available": _CUSTOM_WEIGHTS.exists(),
        "custom_weights_path": str(_CUSTOM_WEIGHTS) if _CUSTOM_WEIGHTS.exists() else None,
    }


# ---------------------------------------------------------------------------
# Step 4: Deploy trained weights
# ---------------------------------------------------------------------------

@router.post("/deploy")
async def deploy_weights():
    """
    Step 4: Deploy the trained custom weights to the real-time counting pipeline.
    Replaces the default yolov8n.pt with the fine-tuned depot model.
    """
    if not _CUSTOM_WEIGHTS.exists():
        raise HTTPException(
            status_code=404,
            detail="No custom weights found. Train a model first."
        )

    # Update the realtime counter to use custom weights
    from app.depot.vision.realtime_counter import _load_model, stop_realtime_counting, start_realtime_counting
    import app.depot.vision.realtime_counter as rt

    # Stop the current pipeline
    await stop_realtime_counting()

    # Clear cached model so it reloads with new weights
    rt._yolo_model = None

    # Point to custom weights
    os.environ["YOLO_WEIGHTS"] = str(_CUSTOM_WEIGHTS)

    # Restart
    await start_realtime_counting()

    return {
        "status": "deployed",
        "weights": str(_CUSTOM_WEIGHTS),
        "size_mb": round(_CUSTOM_WEIGHTS.stat().st_size / (1024 * 1024), 1),
        "pipeline_restarted": True,
    }


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

@router.get("/frames")
async def list_extracted_frames():
    """List all extracted training frames."""
    if not _FRAMES_DIR.exists():
        return {"frames": [], "total": 0, "dir": str(_FRAMES_DIR)}

    frames = sorted(_FRAMES_DIR.glob("*.jpg"))
    return {
        "total": len(frames),
        "dir": str(_FRAMES_DIR),
        "frames": [f.name for f in frames[:100]],  # first 100
        "truncated": len(frames) > 100,
    }


@router.get("/dataset-info")
async def dataset_info():
    """Get info about the current training dataset."""
    result = {
        "dataset_dir": str(_DATASET_DIR),
        "frames_dir": str(_FRAMES_DIR),
        "weights_dir": str(_WEIGHTS_DIR),
        "classes": DEPOT_CLASSES,
    }

    for split in ["train", "val"]:
        img_dir = _DATASET_DIR / "images" / split
        lbl_dir = _DATASET_DIR / "labels" / split
        result[f"{split}_images"] = len(list(img_dir.glob("*.jpg"))) if img_dir.exists() else 0
        result[f"{split}_labels"] = len(list(lbl_dir.glob("*.txt"))) if lbl_dir.exists() else 0

    result["custom_weights"] = _CUSTOM_WEIGHTS.exists()
    result["dataset_yaml"] = (_DATASET_DIR / "dataset.yaml").exists()

    return result
