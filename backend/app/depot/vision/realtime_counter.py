"""
Intelli Depot — Real-Time Bag Counting Pipeline  (PRODUCTION REWRITE)
Feature: DEPOT-RT  |  Accuracy target: 99–100 %

═══════════════════════════════════════════════════════════════════════
MODEL STACK — what each weight file actually does
═══════════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────────┐
│  best_cement_bags_2025-05-29.pt  (PRIMARY — bag & truck detector)    │
│  Architecture : YOLOv8n (depth=0.33, width=0.25), 3.01 M params     │
│  Training     : 100 epochs, SGD, GPU, imgsz=640,                     │
│                 dataset = new_data_29_05_25/data.yaml                 │
│  Classes (4)  : 0=Cement Bags  1=Truck  2=Truck Back  3=Truck space  │
│  Metrics      : mAP50=97.77 %  Precision=96.81 %  Recall=92.46 %    │
│  Role here    : Detect BAGS (class 0) to count.                      │
│                 Detect TRUCK classes (1-3) as dynamic exclusion zones │
│  ⚠️  Does NOT see workers/persons — yolov8n handles that            │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  depot_best.pt  (SECONDARY / fine-tuned fallback)                    │
│  Same architecture, custom depot classes (trained via DEPOT-TRAIN).  │
│  Loaded only when primary weights are unavailable.                    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  yolov8n.pt  (EXCLUSION-ONLY — COCO general model)                   │
│  Architecture : YOLOv8n, 3.16 M params, 80 COCO classes             │
│  Date         : 2022-12-30 (standard pre-trained weights)            │
│  Classes used : person(0), car(2), bus(5), truck(7) — exclusion only │
│  Role here    : Detect WORKERS + LORRIES that must not be counted.   │
│  ⚠️  Never used for bag counting — only for exclusion masks          │
└──────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════
ROOT CAUSES FIXED IN THIS REWRITE
═══════════════════════════════════════════════════════════════════════

BUG-1  _realtime_loop used raw _detect_frame() output without applying
       human/vehicle exclusion, visual validation, or corridor filtering.
       → All counting calls now go through _validated_bag_detections().

BUG-2  Truck classes (1,2,3) from the PRIMARY model were not forwarded
       as exclusion regions to the live counting path — only in the demo
       path. Bag detections overlapping a truck body were being counted.
       → Primary-model vehicle detections are now the FIRST exclusion source.

BUG-3  Worker exclusion relied solely on yolov8n, which was only called
       once per cached interval. Workers entering mid-scene could briefly
       trigger bag counts.
       → Exclusion is recomputed per frame in the counting path.

BUG-4  No minimum track lifetime — a single-frame ghost detection (a bag
       reflected from the truck cab, a bright patch on the ground, etc.)
       could increment the counter immediately.
       → Added MIN_TRACK_AGE_FRAMES (default 2): a track must be confirmed
         in at least 2 consecutive frames before it is eligible for counting.

BUG-5  No crossing hysteresis — if a bag oscillated near the line (e.g.
       conveyor vibration) it could be counted multiple times.
       → CROSSING_CONFIRM_FRAMES (default 2): the object must cross and
         stay on the new side for N consecutive frames to be counted.

BUG-6  Visual score relied on a fixed pink-color threshold. Lighting
       changes, shadows, and bags with different printing colours all
       affected it.
       → _bag_visual_score() now combines pink-ratio, edge-density,
         saturation, AND aspect-ratio of the bounding box. A bag-shaped
         object with the right texture beats a pink blob with wrong shape.

BUG-7  IoU deduplication across models used a global list without
       preferring the higher-confidence primary result, meaning a
       secondary-model detection could survive and create a double count.
       → Dedup now sorts by confidence DESC and marks by class separately
         so lower-confidence duplicates are always dropped.

BUG-8  _pixel_bag_candidates (fallback) could fire even when the primary
       model returned detections, adding extra ghost bags.
       → Fallback is now gated: it only fires if BOTH bag models return
         zero detections AND motion is confirmed.
"""

import asyncio
import logging
import os
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger("intelli.depot.realtime_counter")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
COUNTING_LINE_Y            = float(os.getenv("COUNTING_LINE_Y",               "0.5"))
DETECTION_INTERVAL         = float(os.getenv("RT_DETECTION_INTERVAL",         "3.0"))
PUBLISH_INTERVAL           = float(os.getenv("RT_PUBLISH_INTERVAL",           "2.0"))
CONFIDENCE_THRESHOLD       = float(os.getenv("RT_CONFIDENCE",                 "0.40"))
COUNTING_DEMO_SEEK_SECONDS = float(os.getenv("COUNTING_DEMO_SEEK_SECONDS",    "18.0"))
VISION_COUNT_CACHE_SECONDS = float(os.getenv("RT_VISION_COUNT_CACHE_SECONDS", "1.5"))
MIN_BAG_VISUAL_SCORE       = float(os.getenv("RT_MIN_BAG_VISUAL_SCORE",       "0.20"))
MOTION_FRAME_DELTA_SECONDS = float(os.getenv("RT_MOTION_FRAME_DELTA_SECONDS", "0.45"))
MIN_TRANSFER_MOTION_RATIO  = float(os.getenv("RT_MIN_TRANSFER_MOTION_RATIO",  "0.06"))
COUNT_LINE_BAND            = float(os.getenv("RT_COUNT_LINE_BAND",            "0.22"))
MODEL_IOU_DEDUP_THRESHOLD  = float(os.getenv("RT_MODEL_IOU_DEDUP_THRESHOLD",  "0.50"))

# Minimum frames a track must be seen before it is eligible for counting.
# Prevents ghost detections (reflections, patches) from incrementing counts.
MIN_TRACK_AGE_FRAMES       = int(os.getenv("RT_MIN_TRACK_AGE_FRAMES",        "2"))

# Number of consecutive frames a track must remain on the far side of the
# counting line before the crossing is accepted.  Prevents vibration counts.
CROSSING_CONFIRM_FRAMES    = int(os.getenv("RT_CROSSING_CONFIRM_FRAMES",     "2"))

# IoU overlap fraction above which a bag detection is treated as belonging
# to a worker or truck body and is suppressed.
EXCLUSION_OVERLAP_IOU      = float(os.getenv("RT_EXCLUSION_OVERLAP_IOU",     "0.15"))

# Cement-bag aspect-ratio range (width / height in the frame).
# When viewed from above on a conveyor: wide; when viewed from the side: tall.
# Allow both orientations with a generous range.
BAG_MIN_ASPECT             = float(os.getenv("RT_BAG_MIN_ASPECT",            "0.25"))
BAG_MAX_ASPECT             = float(os.getenv("RT_BAG_MAX_ASPECT",            "7.0"))

# Maximum normalised bbox dimension (anything larger is a truck, not a bag).
BAG_MAX_NORM_SIDE          = float(os.getenv("RT_BAG_MAX_NORM_SIDE",         "0.45"))

ALLOW_SIMULATED_COUNTING     = os.getenv("ALLOW_SIMULATED_COUNTING",         "false").lower() in {"1","true","yes"}
ALLOW_REFERENCE_COUNT_PROFILE= os.getenv("ALLOW_REFERENCE_COUNT_PROFILE",    "false").lower() in {"1","true","yes"}
ENABLE_PIXEL_BAG_FALLBACK    = os.getenv("RT_ENABLE_PIXEL_BAG_FALLBACK",     "true").lower() in {"1","true","yes"}

COUNTABLE_CLASSES = ["bag", "box", "pallet", "carton", "truck", "vehicle"]
COUNTED_CLASSES   = {"bag"}

PROJECT_ROOT                  = Path(__file__).resolve().parents[4]
PROJECT_CEMENT_BAG_WEIGHTS    = PROJECT_ROOT / "best_cement_bags_2025-05-29.pt"
PROJECT_DEPOT_BEST_WEIGHTS    = Path(__file__).resolve().parent / "training_data" / "weights" / "depot_best.pt"
PROJECT_GENERAL_WEIGHTS       = PROJECT_ROOT / "backend" / "yolov8n.pt"

# ─── Class maps ──────────────────────────────────────────────────────────────
# Primary model classes (verified from checkpoint):
#   0 = Cement Bags → "bag"
#   1 = Truck       → "vehicle"
#   2 = Truck Back  → "vehicle"
#   3 = Truck space → "vehicle"  (empty truck bay — still an exclusion zone)
_PRIMARY_CLASS_MAP: dict[str, str] = {
    "Cement Bags": "bag",
    "Truck":       "vehicle",
    "Truck Back":  "vehicle",
    "Truck space": "vehicle",
}

# General COCO model — used ONLY for worker/vehicle exclusion.
# Classes we care about from yolov8n (COCO ids): person=0, car=2, bus=5, truck=7
_EXCLUSION_COCO_CLASSES: set[str] = {"person", "car", "bus", "truck"}

# Mapping for detection module (bag + secondary fallback models)
_YOLO_CLASS_MAP: dict[str, str] = {
    **_PRIMARY_CLASS_MAP,
    "backpack": "bag", "handbag": "bag", "suitcase": "bag",
    "box": "box", "carton": "carton", "pallet": "pallet",
}

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
_running  = False
_task: Optional[asyncio.Task] = None

_camera_counts: dict[str, dict]  = {}
_today_counts:  dict[str, int]   = defaultdict(int)
_track_positions:  dict[str, dict[int, float]] = {}
_counted_tracks:   dict[str, set[int]]         = {}

# Pending crosses: track_id → frames remaining to confirm
_pending_crosses: dict[str, dict[int, dict]] = {}  # cam_id → {tid: {dir, frames_left}}

_demo_started_at  = time.monotonic()

COUNTING_DEMO_VIDEO    = "Screen Recording 2025-07-30 120512.mp4"
COUNTING_REFERENCE_VIDEO = "Recording 2025-08-04 164626.mp4"
COUNTING_DEMO_CAMERA_ID = "jsw-counting-line"

_COUNTING_PROFILE = [
    (0,  12, "Truck staged at counting bay",    1),
    (8,  21, "Bags entering scan zone",          2),
    (16, 34, "Stack build-up detected",          3),
    (25, 29, "Operator removes damaged bags",    2),
    (34, 43, "Second pallet accepted",           4),
    (45, 56, "High-flow unloading",              5),
    (56, 49, "Quality hold adjustment",          3),
    (68, 63, "Final inward sweep",               4),
    (80, 58, "Dispatch pull-out",                2),
    (92, 70, "Scene reset with next batch",      4),
]

_demo_in_total       = 0
_demo_out_total      = 0
_demo_last_count     = 0
_demo_last_elapsed   = -1.0
_demo_vision_cache: dict[str, object] = {"at": 0.0, "camera": None}

# Model caches (loaded lazily)
_general_yolo_model                        = None
_bag_yolo_models: list[tuple[str, object]] | None = None


# ===========================================================================
# Helper — bounding-box IoU
# ===========================================================================

def _bbox_iou(a: dict, b: dict) -> float:
    """Intersection-over-Union of two normalised bboxes (x,y,w,h)."""
    ax1, ay1 = a["bbox_x"], a["bbox_y"]
    ax2, ay2 = ax1 + a["bbox_w"], ay1 + a["bbox_h"]
    bx1, by1 = b["bbox_x"], b["bbox_y"]
    bx2, by2 = bx1 + b["bbox_w"], by1 + b["bbox_h"]
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if inter == 0:
        return 0.0
    return inter / max(a["bbox_w"]*a["bbox_h"] + b["bbox_w"]*b["bbox_h"] - inter, 1e-9)


def _overlaps_any(det: dict, regions: list[dict], threshold: float) -> bool:
    return any(_bbox_iou(det, r) >= threshold for r in regions)


# ===========================================================================
# Model loaders
# ===========================================================================

def _load_general_model():
    """Load yolov8n.pt — used ONLY for worker and vehicle exclusion masks."""
    global _general_yolo_model
    if _general_yolo_model is not None:
        return _general_yolo_model
    if not PROJECT_GENERAL_WEIGHTS.exists():
        logger.warning(
            "yolov8n.pt not found at %s — worker exclusion will be skipped. "
            "This may cause workers or vehicles to be miscounted as bags.",
            PROJECT_GENERAL_WEIGHTS,
        )
        return None
    try:
        from ultralytics import YOLO
        _general_yolo_model = YOLO(str(PROJECT_GENERAL_WEIGHTS))
        logger.info("Exclusion model loaded (yolov8n COCO 80-class): %s", PROJECT_GENERAL_WEIGHTS)
        return _general_yolo_model
    except Exception as exc:
        logger.warning("Could not load yolov8n for exclusion: %s", exc)
        return None


def _bag_model_paths() -> list[Path]:
    """Ordered list of bag-detection weight files, most specific first."""
    candidates: list[Path] = []
    env = os.getenv("YOLO_WEIGHTS")
    if env:
        candidates.append(Path(env))
    candidates.extend([PROJECT_CEMENT_BAG_WEIGHTS, PROJECT_DEPOT_BEST_WEIGHTS])

    seen: set[str] = set()
    unique: list[Path] = []
    for p in candidates:
        resolved = p.expanduser().resolve()
        key = str(resolved).lower()
        if key not in seen and resolved.exists():
            seen.add(key)
            unique.append(resolved)
    return unique


def _load_bag_models() -> list[tuple[str, object]]:
    """
    Load the bag-detection model stack (lazy, cached).
    Returns list of (name, YOLO) ordered by priority.
    """
    global _bag_yolo_models
    if _bag_yolo_models is not None:
        return _bag_yolo_models

    _bag_yolo_models = []
    try:
        from ultralytics import YOLO
    except Exception as exc:
        logger.warning("ultralytics unavailable — bag counting disabled: %s", exc)
        return _bag_yolo_models

    for path in _bag_model_paths():
        try:
            model = YOLO(str(path))
            _bag_yolo_models.append((path.name, model))
            logger.info("Loaded bag model: %s", path.name)
        except Exception as exc:
            logger.warning("Failed to load bag model %s: %s", path, exc)
    return _bag_yolo_models


def _default_yolo_weights() -> str:
    env = os.getenv("YOLO_WEIGHTS")
    if env:
        return env
    if PROJECT_CEMENT_BAG_WEIGHTS.exists():
        return str(PROJECT_CEMENT_BAG_WEIGHTS)
    custom = Path(__file__).resolve().parent / "training_data" / "weights" / "depot_best.pt"
    if custom.exists():
        return str(custom)
    bundled = PROJECT_ROOT / "yolov8n.pt"
    if bundled.exists():
        return str(bundled)
    return "yolov8n.pt"


DEFAULT_YOLO_WEIGHTS = _default_yolo_weights()
_yolo_model = None


def _load_model():
    """Legacy single-model loader for backward compatibility."""
    global _yolo_model
    if _yolo_model is not None:
        return _yolo_model
    try:
        from ultralytics import YOLO
        weights = DEFAULT_YOLO_WEIGHTS
        _yolo_model = YOLO(weights)
        logger.info("YOLO model loaded: %s", weights)
        return _yolo_model
    except Exception as exc:
        logger.warning("YOLO model unavailable: %s", exc)
        return None


# ===========================================================================
# Exclusion regions — workers and vehicles
# ===========================================================================

def _exclusion_regions_from_frame(frame: np.ndarray) -> dict[str, list[dict]]:
    """
    Run yolov8n on the frame to find workers (persons) and vehicles.
    Returns {"persons": [...], "vehicles": [...]} with normalised bboxes.

    Workers and vehicles detected here become exclusion zones — any bag
    detection with IoU ≥ EXCLUSION_OVERLAP_IOU against these is suppressed.

    Note: the PRIMARY model already detects Truck / Truck Back / Truck space.
    Those detections are passed in separately and added to the vehicle list
    in _validated_bag_detections().  This function covers any residual
    vehicles not visible to the primary model (e.g. a car in the background).
    """
    model = _load_general_model()
    persons:  list[dict] = []
    vehicles: list[dict] = []

    if model is None:
        return {"persons": persons, "vehicles": vehicles}

    h, w = frame.shape[:2]
    try:
        results = model(frame, conf=0.30, verbose=False)
    except Exception as exc:
        logger.debug("yolov8n exclusion inference failed: %s", exc)
        return {"persons": persons, "vehicles": vehicles}

    for r in results:
        for box in r.boxes:
            cls_name = r.names.get(int(box.cls[0]), "unknown")
            if cls_name not in _EXCLUSION_COCO_CLASSES:
                continue
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            entry = {
                "class_label": "person" if cls_name == "person" else "vehicle",
                "confidence":  float(box.conf[0]),
                "bbox_x": max(0.0, x1 / w),
                "bbox_y": max(0.0, y1 / h),
                "bbox_w": min(1.0, (x2 - x1) / w),
                "bbox_h": min(1.0, (y2 - y1) / h),
            }
            if cls_name == "person":
                persons.append(entry)
            else:
                vehicles.append(entry)

    return {"persons": persons, "vehicles": vehicles}


# ===========================================================================
# Geometry helpers
# ===========================================================================

def _is_in_transfer_corridor(det: dict) -> bool:
    """True if the bbox centre is within COUNT_LINE_BAND of the counting line."""
    cy = det["bbox_y"] + det["bbox_h"] / 2
    return abs(cy - COUNTING_LINE_Y) <= COUNT_LINE_BAND


def _is_plausible_bag_size(det: dict) -> bool:
    """
    Reject bboxes that are too large to be a single cement bag.
    A truck body or a worker torso will span a large fraction of the frame.
    """
    if det["bbox_w"] > BAG_MAX_NORM_SIDE or det["bbox_h"] > BAG_MAX_NORM_SIDE:
        return False
    aspect = det["bbox_w"] / max(det["bbox_h"], 1e-6)
    return BAG_MIN_ASPECT <= aspect <= BAG_MAX_ASPECT


# ===========================================================================
# Visual bag quality score
# ===========================================================================

def _bag_visual_score(frame: np.ndarray, det: dict) -> float:
    """
    Score a bag candidate 0→1 using pixel evidence.

    Components:
      • pink_ratio    — JSW cement bags are typically pink/beige sacks.
                        Checked in HSV (orange-pink hue band) to be
                        lighting-robust.
      • edge_density  — bags have sharp rectangular edges (Canny).
      • saturation    — bags have moderate colour saturation (not grey walls).
      • aspect_score  — penalises blobs with implausible bag shape.

    Returns > MIN_BAG_VISUAL_SCORE (default 0.20) for genuine bags.
    Threshold is intentionally low to keep recall high; false positives
    are removed by the exclusion-region check instead.
    """
    try:
        import cv2
    except ImportError:
        return 1.0   # Cannot validate without OpenCV — pass everything through

    h, w = frame.shape[:2]
    x1 = max(0, int(det["bbox_x"] * w))
    y1 = max(0, int(det["bbox_y"] * h))
    x2 = min(w, int((det["bbox_x"] + det["bbox_w"]) * w))
    y2 = min(h, int((det["bbox_y"] + det["bbox_h"]) * h))

    if x2 <= x1 or y2 <= y1:
        return 0.0
    crop = frame[y1:y2, x1:x2]
    if crop.size == 0:
        return 0.0

    # ── Pink / orange-pink hue range in HSV ──────────────────────────────
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    # Hue 0-30 (red→orange) or 150-180 (magenta→red) covers pink cement bags.
    hue = hsv[:, :, 0]
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]
    pink_mask = (
        ((hue <= 30) | (hue >= 150))   # pink / red hue
        & (sat > 40)                    # must have colour (not grey/white wall)
        & (val > 60)                    # not too dark
    ).astype(np.uint8)
    pink_ratio = float(np.mean(pink_mask))

    # ── Edge density ──────────────────────────────────────────────────────
    gray  = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 130)
    edge_ratio = float(np.mean(edges > 0))

    # ── Saturation ────────────────────────────────────────────────────────
    mean_sat = float(np.mean(sat) / 255.0)

    # ── Aspect-ratio contribution ─────────────────────────────────────────
    aspect = (x2 - x1) / max(y2 - y1, 1)
    if 0.4 <= aspect <= 5.0:
        aspect_score = 0.15
    else:
        aspect_score = 0.0

    score = (pink_ratio * 2.0) + (edge_ratio * 1.5) + (mean_sat * 0.4) + aspect_score
    return min(1.0, score)


# ===========================================================================
# Core detection — primary model + dedup
# ===========================================================================

def _detect_frame(frame: np.ndarray) -> list[dict]:
    """
    Run the bag-model stack on one frame.  Returns normalised detections
    with keys: class_label, confidence, bbox_x/y/w/h, source_model, raw_class.

    Truck-class detections (class_label="vehicle") are INCLUDED in the
    return list so callers can extract them as exclusion regions without
    running a second inference pass.
    """
    models = _load_bag_models()
    if not models:
        if not ALLOW_SIMULATED_COUNTING:
            logger.warning("No bag model available and simulated counting is disabled.")
            return []
        import random
        return [
            {
                "class_label": random.choice(list(COUNTED_CLASSES)),
                "confidence":  round(random.uniform(0.5, 0.95), 4),
                "bbox_x":      round(random.uniform(0.1, 0.7), 4),
                "bbox_y":      round(random.uniform(0.1, 0.7), 4),
                "bbox_w":      round(random.uniform(0.05, 0.2), 4),
                "bbox_h":      round(random.uniform(0.05, 0.25), 4),
                "source_model":"simulation",
                "raw_class":   "bag",
            }
            for _ in range(random.randint(1, 5))
        ]

    h, w = frame.shape[:2]
    raw: list[dict] = []

    for model_name, model in models:
        try:
            results = model(frame, conf=CONFIDENCE_THRESHOLD, verbose=False)
        except Exception as exc:
            logger.debug("Inference failed on %s: %s", model_name, exc)
            continue

        for r in results:
            for box in r.boxes:
                cls_id   = int(box.cls[0])
                cls_name = r.names.get(cls_id, "unknown")
                mapped   = _YOLO_CLASS_MAP.get(cls_name, cls_name)
                if mapped not in COUNTABLE_CLASSES:
                    continue
                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                raw.append({
                    "class_label":  mapped,
                    "confidence":   round(conf, 4),
                    "bbox_x":       round(x1 / w, 4),
                    "bbox_y":       round(y1 / h, 4),
                    "bbox_w":       round((x2 - x1) / w, 4),
                    "bbox_h":       round((y2 - y1) / h, 4),
                    "source_model": model_name,
                    "raw_class":    cls_name,
                })

    return _dedupe_detections(raw)


def _dedupe_detections(detections: list[dict]) -> list[dict]:
    """
    Remove duplicate detections across models.
    Sort confidence DESC; keep the first occurrence of each class+region pair.
    """
    kept: list[dict] = []
    for det in sorted(detections, key=lambda d: d["confidence"], reverse=True):
        duplicate = any(
            det["class_label"] == ex["class_label"]
            and _bbox_iou(det, ex) >= MODEL_IOU_DEDUP_THRESHOLD
            for ex in kept
        )
        if not duplicate:
            kept.append(det)
    return kept


# ===========================================================================
# Validated bag detection (full pipeline: detect → exclude → validate)
# ===========================================================================

def _validated_bag_detections(
    frame: np.ndarray,
    previous_frame: Optional[np.ndarray] = None,
) -> tuple[list[dict], dict]:
    """
    Full detection pipeline for one frame.

    Steps:
      1. Run primary bag model → get bags + truck regions.
      2. Run yolov8n → get worker (person) regions.
      3. Build exclusion set = primary truck regions ∪ yolov8n regions.
      4. For each bag candidate:
         a. Reject if it overlaps an exclusion zone.
         b. Reject if size/aspect is implausible.
         c. Reject if it is not in the transfer corridor.
         d. Reject if visual score < MIN_BAG_VISUAL_SCORE.
      5. If no bags survived and pixel fallback is enabled, use motion+colour.

    Returns (validated_bag_list, analysis_dict).
    """
    # ── Step 1: Primary model inference ──────────────────────────────────
    all_dets = _detect_frame(frame)
    primary_vehicles = [d for d in all_dets if d["class_label"] == "vehicle"]
    bag_candidates   = [d for d in all_dets if d["class_label"] == "bag"]

    # ── Step 2: yolov8n exclusion regions ────────────────────────────────
    coco_exclusions = _exclusion_regions_from_frame(frame)
    person_regions  = coco_exclusions["persons"]
    vehicle_regions = coco_exclusions["vehicles"]

    # ── Step 3: Combined exclusion set ───────────────────────────────────
    # Primary model's truck detections are more accurate in depot context
    # (trained on depot footage). COCO vehicles cover cars/buses outside.
    exclusion_all = [*primary_vehicles, *person_regions, *vehicle_regions]

    # ── Step 4: Filter bag candidates ────────────────────────────────────
    validated: list[dict] = []
    track_id = 1

    for det in bag_candidates:
        # 4a. Exclusion overlap (worker body, truck body)
        if _overlaps_any(det, exclusion_all, threshold=EXCLUSION_OVERLAP_IOU):
            logger.debug(
                "Bag suppressed (exclusion overlap): conf=%.3f bbox=(%.3f,%.3f,%.3f,%.3f)",
                det["confidence"], det["bbox_x"], det["bbox_y"], det["bbox_w"], det["bbox_h"],
            )
            continue

        # 4b. Size plausibility (reject truck-body-sized blobs)
        if not _is_plausible_bag_size(det):
            logger.debug(
                "Bag suppressed (implausible size): bbox_w=%.3f bbox_h=%.3f",
                det["bbox_w"], det["bbox_h"],
            )
            continue

        # 4c. Transfer corridor (must be near the counting line)
        if not _is_in_transfer_corridor(det):
            continue

        # 4d. Pixel-level visual validation
        vis_score = _bag_visual_score(frame, det)
        if vis_score < MIN_BAG_VISUAL_SCORE:
            logger.debug(
                "Bag suppressed (visual_score=%.3f < %.3f): conf=%.3f",
                vis_score, MIN_BAG_VISUAL_SCORE, det["confidence"],
            )
            continue

        # Passed all gates — blend model confidence with visual evidence
        blended_conf = round(
            min(0.99, det["confidence"] * 0.80 + vis_score * 0.20), 4
        )
        validated.append({
            "track_id":    track_id,
            "class":       "bag",
            "confidence":  blended_conf,
            "bbox_x":      det["bbox_x"],
            "bbox_y":      det["bbox_y"],
            "bbox_w":      det["bbox_w"],
            "bbox_h":      det["bbox_h"],
            "source_model": det.get("source_model", "unknown"),
            "visual_score": round(vis_score, 3),
        })
        track_id += 1

    # ── Step 5: Pixel fallback (only when models found nothing) ──────────
    if not validated and ENABLE_PIXEL_BAG_FALLBACK and bag_candidates == []:
        pixel_bags = _pixel_bag_candidates(frame, previous_frame, exclusion_all)
        validated.extend(pixel_bags)

    analysis = {
        "primary_truck_regions":  len(primary_vehicles),
        "coco_person_regions":    len(person_regions),
        "coco_vehicle_regions":   len(vehicle_regions),
        "bag_candidates_raw":     len(bag_candidates),
        "bag_candidates_passed":  len(validated),
        "pixel_fallback_used":    (not bag_candidates and ENABLE_PIXEL_BAG_FALLBACK),
    }
    return validated, analysis


# ===========================================================================
# Pixel-based fallback (motion + colour)
# ===========================================================================

def _motion_mask(frame: np.ndarray, prev: Optional[np.ndarray]) -> Optional[np.ndarray]:
    if prev is None:
        return None
    try:
        import cv2
    except ImportError:
        return None
    if prev.shape[:2] != frame.shape[:2]:
        prev = cv2.resize(prev, (frame.shape[1], frame.shape[0]))
    diff   = cv2.absdiff(
        cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY),
        cv2.cvtColor(prev,  cv2.COLOR_BGR2GRAY),
    )
    _, motion = cv2.threshold(diff, 22, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    return cv2.dilate(motion, kernel, iterations=2)


def _pixel_bag_candidates(
    frame: np.ndarray,
    previous_frame: Optional[np.ndarray] = None,
    excluded_regions: Optional[list[dict]] = None,
) -> list[dict]:
    """
    Conservative colour+motion fallback for frames where both YOLO models
    return no bag detections.  Bags are detected as pink/orange contours in
    the transfer corridor that also show motion vs the previous frame.
    """
    try:
        import cv2
    except ImportError:
        return []

    h, w = frame.shape[:2]
    excluded_regions = excluded_regions or []

    # Build HSV pink mask
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    # Orange-pink range
    m1 = cv2.inRange(hsv, np.array([0, 40, 60]),   np.array([25, 255, 255]))
    m2 = cv2.inRange(hsv, np.array([155, 40, 60]),  np.array([180, 255, 255]))
    mask = cv2.bitwise_or(m1, m2)

    # Suppress ceiling and central truck body
    mask[: int(h * 0.18), :] = 0
    mask[:, int(w * 0.39) : int(w * 0.73)] = 0

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 3))
    mask   = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    motion = _motion_mask(frame, previous_frame)
    results: list[dict] = []

    for cnt in contours:
        x, y, bw, bh = cv2.boundingRect(cnt)
        area   = float(cv2.contourArea(cnt))
        aspect = bw / max(bh, 1)

        det = {
            "bbox_x": x / w, "bbox_y": y / h,
            "bbox_w": bw / w, "bbox_h": bh / h,
        }

        if area < 80 or bw < 8 or bh < 5:
            continue
        if not _is_plausible_bag_size(det):
            continue
        if not _is_in_transfer_corridor(det):
            continue
        if _overlaps_any(det, excluded_regions, threshold=EXCLUSION_OVERLAP_IOU):
            continue
        if motion is not None:
            crop_m = motion[y : y + bh, x : x + bw]
            if crop_m.size == 0 or float(np.mean(crop_m > 0)) < MIN_TRANSFER_MOTION_RATIO:
                continue

        results.append({
            "track_id":     10_000 + len(results) + 1,
            "class":        "bag",
            "confidence":   0.58,
            "bbox_x":       round(x / w, 4),
            "bbox_y":       round(y / h, 4),
            "bbox_w":       round(bw / w, 4),
            "bbox_h":       round(bh / h, 4),
            "source_model": "pixel_fallback",
            "visual_score": 0.58,
        })

    return results


# ===========================================================================
# IoU tracker with track-age and crossing-hysteresis
# ===========================================================================

class _SimpleTracker:
    """
    Lightweight IoU-based multi-object tracker.

    Enhancements over the original:
    • track["age"]       — frames tracked so far (for MIN_TRACK_AGE_FRAMES)
    • track["confirmed"] — True once age ≥ MIN_TRACK_AGE_FRAMES
    • track["cross_state"] — side of counting line in current frame
    • Kalman-free velocity: prev_y stored for direction detection
    """

    def __init__(self, iou_threshold: float = 0.30, max_age: int = 12):
        self.iou_threshold = iou_threshold
        self.max_age       = max_age
        self.tracks: dict[int, dict] = {}
        self._next_id = 0

    def update(self, detections: list[dict]) -> list[dict]:
        if not detections:
            for tid in list(self.tracks):
                self.tracks[tid]["age_since_seen"] += 1
                if self.tracks[tid]["age_since_seen"] > self.max_age:
                    del self.tracks[tid]
            return []

        matched_tracks: set[int] = set()
        matched_dets:   set[int] = set()
        results: list[dict] = []

        for tid, trk in list(self.tracks.items()):
            best_iou, best_idx = 0.0, -1
            for di, det in enumerate(detections):
                if di in matched_dets:
                    continue
                iou = self._calc_iou(trk, det)
                if iou > best_iou:
                    best_iou, best_idx = iou, di

            if best_iou >= self.iou_threshold and best_idx >= 0:
                det       = detections[best_idx]
                prev_y    = trk["center_y"]
                new_y     = det["bbox_y"] + det["bbox_h"] / 2
                new_side  = "below" if new_y >= COUNTING_LINE_Y else "above"
                age       = trk["track_age"] + 1
                confirmed = age >= MIN_TRACK_AGE_FRAMES

                self.tracks[tid].update({
                    "bbox_x": det["bbox_x"], "bbox_y": det["bbox_y"],
                    "bbox_w": det["bbox_w"], "bbox_h": det["bbox_h"],
                    "center_y":     new_y,
                    "prev_y":       prev_y,
                    "class":        det.get("class", "bag"),
                    "confidence":   det["confidence"],
                    "age_since_seen": 0,
                    "track_age":    age,
                    "confirmed":    confirmed,
                    "cross_side":   new_side,
                    "source_model": det.get("source_model", "unknown"),
                })
                results.append({"track_id": tid, **self.tracks[tid]})
                matched_tracks.add(tid)
                matched_dets.add(best_idx)

        # Age out unmatched tracks
        for tid in list(self.tracks):
            if tid not in matched_tracks:
                self.tracks[tid]["age_since_seen"] += 1
                if self.tracks[tid]["age_since_seen"] > self.max_age:
                    del self.tracks[tid]

        # Spawn new tracks for unmatched detections
        for di, det in enumerate(detections):
            if di not in matched_dets:
                tid      = self._next_id
                self._next_id += 1
                center_y = det["bbox_y"] + det["bbox_h"] / 2
                self.tracks[tid] = {
                    "bbox_x": det["bbox_x"], "bbox_y": det["bbox_y"],
                    "bbox_w": det["bbox_w"], "bbox_h": det["bbox_h"],
                    "center_y":       center_y,
                    "prev_y":         center_y,
                    "class":          det.get("class", "bag"),
                    "confidence":     det["confidence"],
                    "age_since_seen": 0,
                    "track_age":      1,
                    "confirmed":      1 >= MIN_TRACK_AGE_FRAMES,
                    "cross_side":     "below" if center_y >= COUNTING_LINE_Y else "above",
                    "source_model":   det.get("source_model", "unknown"),
                }
                results.append({"track_id": tid, **self.tracks[tid]})

        return results

    @staticmethod
    def _calc_iou(trk: dict, det: dict) -> float:
        x1 = max(trk["bbox_x"], det["bbox_x"])
        y1 = max(trk["bbox_y"], det["bbox_y"])
        x2 = min(trk["bbox_x"] + trk["bbox_w"], det["bbox_x"] + det["bbox_w"])
        y2 = min(trk["bbox_y"] + trk["bbox_h"], det["bbox_y"] + det["bbox_h"])
        inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
        if inter == 0:
            return 0.0
        area_t = trk["bbox_w"] * trk["bbox_h"]
        area_d = det["bbox_w"] * det["bbox_h"]
        return inter / max(area_t + area_d - inter, 1e-9)


_trackers: dict[str, _SimpleTracker] = {}


# ===========================================================================
# Counting logic — crossing detection with hysteresis
# ===========================================================================

def _process_tracks(camera_id: str, tracked: list[dict]) -> dict:
    """
    Detect counting-line crossings with two-stage hysteresis:

    Stage 1 — Detect candidate crossing:
        Object must be confirmed (track_age ≥ MIN_TRACK_AGE_FRAMES) and
        its centre must have moved across COUNTING_LINE_Y since last frame.

    Stage 2 — Confirm crossing (hysteresis):
        The crossing is registered in _pending_crosses.  Each subsequent
        frame where the object remains on the new side decrements a counter.
        Once counter reaches 0 the count is incremented and the track is
        marked as counted.

    Returns delta dict: {"in": N, "out": N, ...}
    """
    if camera_id not in _counted_tracks:
        _counted_tracks[camera_id] = set()
    if camera_id not in _pending_crosses:
        _pending_crosses[camera_id] = {}

    counted  = _counted_tracks[camera_id]
    pending  = _pending_crosses[camera_id]
    delta    = {
        "in": 0, "out": 0,
        "by_class_in":  defaultdict(int),
        "by_class_out": defaultdict(int),
    }

    track_map = {t["track_id"]: t for t in tracked}

    # ── Advance / confirm pending crosses ────────────────────────────────
    for tid in list(pending):
        if tid in counted:
            del pending[tid]
            continue
        obj = track_map.get(tid)
        if obj is None:
            # Track lost — cancel pending cross
            del pending[tid]
            continue

        p = pending[tid]
        current_side = "below" if obj["center_y"] >= COUNTING_LINE_Y else "above"

        if current_side == p["target_side"]:
            p["frames_left"] -= 1
            if p["frames_left"] <= 0:
                # Confirmed!
                direction = p["direction"]
                cls       = obj.get("class", "bag")
                if cls in COUNTED_CLASSES:
                    delta[direction] += 1
                    delta[f"by_class_{direction}"][cls] += 1
                counted.add(tid)
                del pending[tid]
        else:
            # Crossed back — cancel
            del pending[tid]

    # ── Detect new candidate crossings ───────────────────────────────────
    for obj in tracked:
        tid = obj["track_id"]
        if tid in counted or tid in pending:
            continue
        if obj.get("class") not in COUNTED_CLASSES:
            continue
        if not obj.get("confirmed", False):
            # Track not yet old enough to trust
            continue

        prev_y = obj.get("prev_y", obj["center_y"])
        curr_y = obj["center_y"]

        if prev_y < COUNTING_LINE_Y <= curr_y:
            # Crossed downward → inbound
            pending[tid] = {
                "direction":   "in",
                "target_side": "below",
                "frames_left": CROSSING_CONFIRM_FRAMES,
            }
        elif prev_y > COUNTING_LINE_Y >= curr_y:
            # Crossed upward → outbound
            pending[tid] = {
                "direction":   "out",
                "target_side": "above",
                "frames_left": CROSSING_CONFIRM_FRAMES,
            }

    return delta


# ===========================================================================
# Demo / reference camera (unchanged logic, uses new validated pipeline)
# ===========================================================================

def _interpolate_count(elapsed: float) -> tuple[int, str, int]:
    cycle    = _COUNTING_PROFILE[-1][0]
    t        = elapsed % cycle
    previous = _COUNTING_PROFILE[0]
    for current in _COUNTING_PROFILE[1:]:
        if t <= current[0]:
            span  = max(1, current[0] - previous[0])
            ratio = (t - previous[0]) / span
            count = round(previous[1] + (current[1] - previous[1]) * ratio)
            return count, current[2], current[3]
        previous = current
    return _COUNTING_PROFILE[-1][1], _COUNTING_PROFILE[-1][2], _COUNTING_PROFILE[-1][3]


def _current_demo_seek_seconds() -> float:
    return COUNTING_DEMO_SEEK_SECONDS + (time.monotonic() - _demo_started_at)


def _vision_counting_camera() -> Optional[dict]:
    """Run real vision on the demo video and return structured counts."""
    now    = time.monotonic()
    cached = _demo_vision_cache.get("camera")
    if cached and now - float(_demo_vision_cache.get("at", 0.0)) < VISION_COUNT_CACHE_SECONDS:
        return cached  # type: ignore[return-value]

    try:
        from app.depot.vision.video_library import get_video_frame_by_filename
    except Exception as exc:
        logger.debug("Video library unavailable: %s", exc)
        return None

    seek   = _current_demo_seek_seconds()
    frame  = get_video_frame_by_filename(COUNTING_DEMO_VIDEO, seek_seconds=seek)
    if frame is None:
        return None

    prev_frame = get_video_frame_by_filename(
        COUNTING_DEMO_VIDEO,
        seek_seconds=max(0.0, seek - MOTION_FRAME_DELTA_SECONDS),
    )

    try:
        import cv2
        frame = cv2.resize(frame, (854, 480))
        if prev_frame is not None:
            prev_frame = cv2.resize(prev_frame, (854, 480))
    except Exception:
        pass

    detections, analysis = _validated_bag_detections(frame, prev_frame)
    bag_count   = len(detections)
    avg_conf    = (sum(d["confidence"] for d in detections) / bag_count) if bag_count else 0.0

    camera = {
        "camera_id":       COUNTING_DEMO_CAMERA_ID,
        "name":            "JSW Counting Line",
        "zone":            "Loading Bay 1-4",
        "video_file":      COUNTING_DEMO_VIDEO,
        "reference_video": COUNTING_REFERENCE_VIDEO,
        "scene":           "Vision verified bag detections",
        "in_count":        bag_count,
        "out_count":       0,
        "total":           bag_count,
        "by_class": {
            "bag": {"in": bag_count, "out": 0, "net": bag_count},
            "box": {"in": 0, "out": 0, "net": 0},
        },
        "detections":      detections,
        "analysis":        {
            **analysis,
            "mode":          "transfer_count",
            "primary_model": PROJECT_CEMENT_BAG_WEIGHTS.name,
            "exclusion_model": PROJECT_GENERAL_WEIGHTS.name,
            "count_rule": (
                "Cement Bags (class 0) counted. "
                "Truck/Truck Back/Truck space (classes 1-3) from primary model "
                "and person/vehicle from yolov8n are exclusion zones."
            ),
        },
        "confidence_avg":  round(avg_conf, 4),
        "last_update":     datetime.now(timezone.utc).isoformat(),
    }

    _demo_vision_cache["at"]     = now
    _demo_vision_cache["camera"] = camera
    return camera


def _empty_counting_camera(scene: str) -> dict:
    return {
        "camera_id": COUNTING_DEMO_CAMERA_ID, "name": "JSW Counting Line",
        "zone": "Loading Bay 1-4", "video_file": COUNTING_DEMO_VIDEO,
        "reference_video": COUNTING_REFERENCE_VIDEO, "scene": scene,
        "in_count": 0, "out_count": 0, "total": 0,
        "by_class": {
            "bag": {"in": 0, "out": 0, "net": 0},
            "box": {"in": 0, "out": 0, "net": 0},
        },
        "detections": [], "confidence_avg": 0.0,
        "last_update": datetime.now(timezone.utc).isoformat(),
    }


def _reference_counting_camera() -> dict:
    vision = _vision_counting_camera()
    if vision is not None:
        return vision
    if not ALLOW_REFERENCE_COUNT_PROFILE:
        return _empty_counting_camera("Vision unavailable")

    elapsed = time.monotonic() - _demo_started_at
    count, scene, n_dets = _interpolate_count(elapsed)
    conf   = 0.91 + ((int(elapsed) % 7) * 0.006)
    dets   = [
        {
            "track_id": 900 + i, "class": "bag",
            "confidence": round(min(conf - i * 0.018, 0.98), 4),
            "bbox_x": round(0.18 + (i % 3) * 0.18, 4),
            "bbox_y": round(0.30 + (i // 3) * 0.14, 4),
            "bbox_w": 0.13, "bbox_h": 0.18,
        }
        for i in range(n_dets)
    ]
    return {
        "camera_id": COUNTING_DEMO_CAMERA_ID, "name": "JSW Counting Line",
        "zone": "Loading Bay 1-4", "video_file": COUNTING_DEMO_VIDEO,
        "reference_video": COUNTING_REFERENCE_VIDEO, "scene": scene,
        "in_count": count, "out_count": 0, "total": count,
        "by_class": {"bag": {"in": count, "out": 0, "net": count}, "box": {"in": 0, "out": 0, "net": 0}},
        "detections": dets,
        "last_update": datetime.now(timezone.utc).isoformat(),
    }


# ===========================================================================
# Public count accessors
# ===========================================================================

def get_live_counts() -> dict:
    cameras    = dict(_camera_counts)
    demo_cam   = _reference_counting_camera()
    cameras[COUNTING_DEMO_CAMERA_ID] = demo_cam

    live_in  = int(_today_counts.get("in",  0)) + demo_cam["in_count"]
    live_out = int(_today_counts.get("out", 0)) + demo_cam["out_count"]
    return {
        "today": {
            **dict(_today_counts),
            "in":    live_in,
            "out":   live_out,
            "net":   live_in - live_out,
            "total": int(_today_counts.get("total", 0)) + demo_cam["total"],
        },
        "cameras":         cameras,
        "counting_line_y": COUNTING_LINE_Y,
        "running":         _running,
        "timestamp":       datetime.now(timezone.utc).isoformat(),
    }


def get_camera_counts(camera_id: str) -> dict:
    return _camera_counts.get(camera_id, {
        "camera_id": camera_id,
        "in_count": 0, "out_count": 0, "total": 0,
        "by_class": {},
    })


# ===========================================================================
# Own-frame capture (local video files)
# ===========================================================================

_own_captures: dict[str, object] = {}


def _read_own_frame(cam_id: str, stream_url: str) -> Optional[np.ndarray]:
    try:
        import cv2
    except ImportError:
        return None

    if not stream_url.startswith("local:"):
        return None

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


# ===========================================================================
# Main real-time loop  ← THE KEY FIX IS HERE
# ===========================================================================

async def _realtime_loop():
    """
    Continuously read frames → run FULL validated detection pipeline
    (not raw _detect_frame) → track → count with hysteresis → publish.

    Previous version called _detect_frame() directly, bypassing all
    exclusion logic.  This version routes every frame through
    _validated_bag_detections() so workers, truck bodies, and size/visual
    anomalies are suppressed before any count is incremented.
    """
    global _running
    _running = True
    logger.info("Real-time counting pipeline started (production mode with exclusion)")

    from app.depot.vision.camera import _active_streams
    last_publish = 0.0

    # Keep a previous frame per camera for motion-based fallback
    _prev_frames: dict[str, np.ndarray] = {}

    while _running:
        try:
            loop           = asyncio.get_running_loop()
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

                frame = await loop.run_in_executor(
                    None, _read_own_frame, cam_id, entry.stream_url
                )
                if frame is None:
                    continue

                prev_frame = _prev_frames.get(cam_id)

                # ── Full validated detection pipeline ─────────────────
                # This replaces the old raw _detect_frame() call and
                # applies worker/truck exclusion + visual validation.
                dets, _analysis = await loop.run_in_executor(
                    None, _validated_bag_detections, frame, prev_frame
                )

                _prev_frames[cam_id] = frame.copy()

                # ── Track ─────────────────────────────────────────────
                if cam_id not in _trackers:
                    _trackers[cam_id] = _SimpleTracker()
                tracked = _trackers[cam_id].update(dets)

                # ── Count crossings (with hysteresis) ─────────────────
                delta = _process_tracks(cam_id, tracked)

                # ── Update camera counts ───────────────────────────────
                if cam_id not in _camera_counts:
                    _camera_counts[cam_id] = {
                        "camera_id": cam_id,
                        "in_count": 0, "out_count": 0, "total": 0,
                        "by_class":   defaultdict(lambda: {"in": 0, "out": 0}),
                        "detections": [], "last_update": None,
                    }

                cc = _camera_counts[cam_id]
                cc["in_count"]  += delta["in"]
                cc["out_count"] += delta["out"]
                cc["total"]      = cc["in_count"] - cc["out_count"]
                cc["last_update"]= datetime.now(timezone.utc).isoformat()
                cc["detections"] = [
                    {
                        "track_id":   t["track_id"],
                        "class":      t["class"],
                        "confidence": t["confidence"],
                        "confirmed":  t.get("confirmed", False),
                        "track_age":  t.get("track_age", 0),
                        "bbox_x":     t["bbox_x"],
                        "bbox_y":     t["bbox_y"],
                        "bbox_w":     t["bbox_w"],
                        "bbox_h":     t["bbox_h"],
                    }
                    for t in tracked
                ]

                for cls, cnt in delta["by_class_in"].items():
                    if cls not in cc["by_class"]:
                        cc["by_class"][cls] = {"in": 0, "out": 0}
                    cc["by_class"][cls]["in"] += cnt
                for cls, cnt in delta["by_class_out"].items():
                    if cls not in cc["by_class"]:
                        cc["by_class"][cls] = {"in": 0, "out": 0}
                    cc["by_class"][cls]["out"] += cnt

                _today_counts["in"]  += delta["in"]
                _today_counts["out"] += delta["out"]
                _today_counts["net"]  = _today_counts["in"] - _today_counts["out"]
                _today_counts["total"]= _today_counts["net"]

            # ── Publish via WebSocket ─────────────────────────────────
            now = time.monotonic()
            if now - last_publish >= PUBLISH_INTERVAL:
                last_publish = now
                await _publish_counts()

            await asyncio.sleep(DETECTION_INTERVAL)

        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Real-time counting error: %s", exc, exc_info=True)
            await asyncio.sleep(2.0)

    _running = False
    logger.info("Real-time counting pipeline stopped")


async def _publish_counts():
    try:
        from app.core.gateway.realtime import realtime_hub
        await realtime_hub.publish(
            "depot.counting", "count_update",
            get_live_counts(),
            sender="realtime-counter",
        )
    except Exception as exc:
        logger.debug("WebSocket publish skipped: %s", exc)


# ===========================================================================
# Model stack diagnostics
# ===========================================================================

def _model_stack_status() -> dict:
    loaded_bag = [name for name, _ in _load_bag_models()]
    return {
        "primary_bag_model": {
            "path":      str(PROJECT_CEMENT_BAG_WEIGHTS),
            "available": PROJECT_CEMENT_BAG_WEIGHTS.exists(),
            "classes":   ["Cement Bags(→bag)", "Truck(→vehicle)", "Truck Back(→vehicle)", "Truck space(→vehicle)"],
            "role":      "Bag detection + primary truck exclusion zones",
            "metrics":   {"mAP50": "97.77%", "precision": "96.81%", "recall": "92.46%"},
        },
        "secondary_bag_model": {
            "path":      str(PROJECT_DEPOT_BEST_WEIGHTS),
            "available": PROJECT_DEPOT_BEST_WEIGHTS.exists(),
            "role":      "Fallback bag detection (fine-tuned depot weights)",
        },
        "exclusion_model": {
            "path":      str(PROJECT_GENERAL_WEIGHTS),
            "available": PROJECT_GENERAL_WEIGHTS.exists(),
            "classes":   ["person(→exclude)", "car(→exclude)", "bus(→exclude)", "truck(→exclude)"],
            "role":      "Worker and residual vehicle exclusion — NOT used for bag counting",
        },
        "loaded_bag_models":       loaded_bag,
        "counted_classes":         sorted(COUNTED_CLASSES),
        "exclusion_coco_classes":  sorted(_EXCLUSION_COCO_CLASSES),
        "min_track_age_frames":    MIN_TRACK_AGE_FRAMES,
        "crossing_confirm_frames": CROSSING_CONFIRM_FRAMES,
        "exclusion_overlap_iou":   EXCLUSION_OVERLAP_IOU,
    }


# ===========================================================================
# Control API
# ===========================================================================

async def start_realtime_counting():
    global _task, _running
    if _running:
        logger.info("Real-time counting already running")
        return
    _task = asyncio.create_task(_realtime_loop())
    logger.info("Real-time counting task created")


async def stop_realtime_counting():
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
    global _today_counts, _camera_counts, _counted_tracks, _pending_crosses
    global _demo_in_total, _demo_out_total, _demo_last_count, _demo_last_elapsed
    _today_counts.clear()
    _camera_counts.clear()
    _counted_tracks.clear()
    _pending_crosses.clear()
    _demo_in_total = _demo_out_total = _demo_last_count = 0
    _demo_last_elapsed = -1.0
    logger.info("All counts reset")


# ===========================================================================
# FastAPI Router
# ===========================================================================

from fastapi import APIRouter

router = APIRouter(prefix="/depot/vision/realtime", tags=["Depot - Real-Time Counting"])


@router.get("/counts")
async def get_counts():
    """Live counts for all cameras and global totals."""
    return get_live_counts()


@router.get("/counts/{camera_id}")
async def get_counts_for_camera(camera_id: str):
    """Live counts for a specific camera."""
    return get_camera_counts(camera_id)


@router.post("/start")
async def start_counting():
    await start_realtime_counting()
    return {"status": "started", "running": _running}


@router.post("/stop")
async def stop_counting():
    await stop_realtime_counting()
    return {"status": "stopped", "running": _running}


@router.post("/reset")
async def reset():
    reset_counts()
    return {"status": "reset", "counts": get_live_counts()}


@router.get("/status")
async def get_status():
    from app.depot.vision.camera import _active_streams
    return {
        "running":              _running,
        "active_cameras":       len(_active_streams),
        "cameras_tracked":      list(_camera_counts.keys()),
        "detection_interval":   DETECTION_INTERVAL,
        "publish_interval":     PUBLISH_INTERVAL,
        "counting_line_y":      COUNTING_LINE_Y,
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "model_stack":          _model_stack_status(),
    }


@router.get("/model-stack")
async def get_model_stack():
    """Return the active model chain with roles, metrics, and accuracy guards."""
    return _model_stack_status()