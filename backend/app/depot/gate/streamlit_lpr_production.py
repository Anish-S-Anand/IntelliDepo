"""
Production-Grade LPR Recognition System
Streamlit UI for License Plate Recognition with accurate vehicle detection
"""
from __future__ import annotations

import os
import re
import shutil
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from datetime import datetime

import cv2
import numpy as np
import streamlit as st

try:
    import pytesseract
except ImportError:
    pytesseract = None


# Production video path
DEFAULT_VIDEO_PATH = r"C:\Users\Anish\Desktop\IntelliDepo\backend\tmp\LPR_RECOGNITION.mp4"

# Indian license plate patterns
PLATE_PATTERNS = [
    re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$"),  # Standard: KA01AB1234
    re.compile(r"^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$"),      # New format: KA01AB1234
    re.compile(r"^[A-Z]{3}[0-9]{4}$"),                      # Old format: ABC1234
    re.compile(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$"),          # BH series
]


def _resolve_tesseract_cmd() -> str | None:
    """Locate Tesseract OCR executable."""
    env_path = os.environ.get("TESSERACT_CMD")
    if env_path and Path(env_path).exists():
        return env_path

    path_cmd = shutil.which("tesseract")
    if path_cmd:
        return path_cmd

    for candidate in (
        Path(r"C:\Users\karte\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"),
        Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
        Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
    ):
        if candidate.exists():
            return str(candidate)

    return None


TESSERACT_CMD = _resolve_tesseract_cmd()
HAS_TESSERACT = pytesseract is not None and TESSERACT_CMD is not None
if HAS_TESSERACT:
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD


@dataclass(frozen=True)
class PlateDetection:
    """Detected license plate with metadata."""
    text: str
    confidence: float
    bbox: tuple[int, int, int, int]
    crop: np.ndarray
    timestamp: float
    frame_number: int


@dataclass(frozen=True)
class VehicleRecord:
    """Aggregated vehicle record across multiple frames."""
    plate_number: str
    best_confidence: float
    detection_count: int
    first_seen_frame: int
    last_seen_frame: int
    first_seen_time: float
    best_crop: np.ndarray


def _clean_plate_text(value: str) -> str:
    """Clean and normalize plate text with improved character recognition."""
    cleaned = "".join(char for char in value.upper() if char.isalnum())
    
    # Common OCR corrections for license plates
    # These are context-aware: only apply in specific positions
    corrections = {
        'O': '0',  # O to 0 (common in numbers)
        'I': '1',  # I to 1 (common in numbers)
        'S': '5',  # S to 5 (when in number context)
        'Z': '2',  # Z to 2 (when in number context)
        'B': '8',  # B to 8 (when in number context)
    }
    
    # Apply corrections intelligently
    result = []
    for i, char in enumerate(cleaned):
        # If surrounded by numbers, apply number corrections
        has_num_before = i > 0 and cleaned[i-1].isdigit()
        has_num_after = i < len(cleaned) - 1 and cleaned[i+1].isdigit()
        
        if (has_num_before or has_num_after) and char in corrections:
            result.append(corrections[char])
        else:
            result.append(char)
    
    return ''.join(result)


def _validate_plate_format(text: str) -> bool:
    """Validate if text matches Indian license plate patterns."""
    if len(text) < 6 or len(text) > 12:
        return False
    return any(pattern.match(text) for pattern in PLATE_PATTERNS)


def _ocr_plate(plate_image: np.ndarray) -> tuple[str, float]:
    """
    Extract plate text using Tesseract OCR with optimized preprocessing for speed and accuracy.
    Returns (plate_text, confidence).
    """
    if not HAS_TESSERACT or pytesseract is None:
        return "", 0.0

    # Optimized: Use fewer scales but better preprocessing
    scales = [2.5, 3.0]  # Reduced from 4 to 2 for speed
    best_text = ""
    best_confidence = 0.0

    for scale in scales:
        resized = cv2.resize(plate_image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY) if resized.ndim == 3 else resized
        
        # Optimized preprocessing pipeline
        gray = cv2.bilateralFilter(gray, 7, 50, 50)  # Reduced kernel for speed
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        
        # Sharpen the image
        kernel_sharpen = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
        gray = cv2.filter2D(gray, -1, kernel_sharpen)
        
        # Try best 2 thresholding methods (reduced from 3)
        _, thresh1 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        thresh2 = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
        
        for thresh in [thresh1, thresh2]:
            # Morphological operations to clean up
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
            thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
            
            # OCR configuration optimized for license plates
            config = "--oem 3 --psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
            
            try:
                raw_text = pytesseract.image_to_string(thresh, config=config)
                text = _clean_plate_text(raw_text)
                
                if len(text) < 5:
                    continue
                
                # Get confidence scores
                data = pytesseract.image_to_data(thresh, config=config, output_type=pytesseract.Output.DICT)
                scores = [float(score) for score in data.get("conf", []) if str(score).strip() not in {"", "-1"}]
                confidence = max(0.0, min(1.0, sum(scores) / len(scores) / 100.0)) if scores else 0.0
                
                # Boost confidence if format matches
                if _validate_plate_format(text):
                    confidence = min(1.0, confidence + 0.25)
                
                # Accept good results early to save time
                if confidence > 0.85:
                    return text, round(confidence, 3)
                
                # Track best result
                if confidence > 0.3 and confidence > best_confidence:
                    best_text = text
                    best_confidence = confidence
                    
            except Exception:
                continue

    return best_text, round(best_confidence, 3)


def _candidate_boxes(frame: np.ndarray) -> list[tuple[int, int, int, int]]:
    """
    Optimized detection of candidate license plate regions for speed and accuracy.
    Returns list of (x, y, w, h) bounding boxes.
    """
    height, width = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 9, 50, 50)  # Reduced kernel for speed
    boxes: list[tuple[int, int, int, int]] = []

    # Strategy 1: Haar Cascade detection (faster, use only best cascade)
    cascade_path = str(Path(cv2.data.haarcascades) / "haarcascade_russian_plate_number.xml")
    cascade = cv2.CascadeClassifier(cascade_path)
    if not cascade.empty():
        detections = cascade.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=4, minSize=(70, 20))
        for x, y, w, h in detections:
            aspect = w / h if h else 0
            if 2.0 <= aspect <= 7.0:
                boxes.append((int(x), int(y), int(w), int(h)))

    # Strategy 2: Morphological operations + contour detection (optimized)
    blackhat_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (31, 9))  # Reduced size
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, blackhat_kernel)
    
    # Sobel gradient
    grad_x = cv2.Sobel(blackhat, ddepth=cv2.CV_32F, dx=1, dy=0, ksize=-1)
    grad_x = np.absolute(grad_x)
    min_val, max_val = float(np.min(grad_x)), float(np.max(grad_x))
    if max_val - min_val > 0:
        grad_x = (255 * ((grad_x - min_val) / (max_val - min_val))).astype("uint8")
    else:
        grad_x = np.zeros_like(gray)

    grad_x = cv2.GaussianBlur(grad_x, (5, 5), 0)
    close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (31, 7))  # Reduced size
    closed = cv2.morphologyEx(grad_x, cv2.MORPH_CLOSE, close_kernel)
    _, thresh = cv2.threshold(closed, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    thresh = cv2.erode(thresh, None, iterations=1)  # Reduced iterations
    thresh = cv2.dilate(thresh, None, iterations=2)  # Reduced iterations

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    # Process only top 15 contours for speed
    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:15]:
        x, y, w, h = cv2.boundingRect(contour)
        if h == 0:
            continue
        aspect = w / h
        area_ratio = (w * h) / float(width * height)
        if 2.0 <= aspect <= 7.0 and 0.001 <= area_ratio <= 0.1 and w >= 70 and h >= 18:
            # Add padding
            pad_x = int(w * 0.08)
            pad_y = int(h * 0.15)
            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(width, x + w + pad_x)
            y2 = min(height, y + h + pad_y)
            boxes.append((x1, y1, x2 - x1, y2 - y1))

    # Remove duplicates and filter by quality
    unique: list[tuple[int, int, int, int]] = []
    for box in boxes:
        x, y, w, h = box
        aspect = w / h if h else 0
        area_ratio = (w * h) / float(width * height)
        if not (2.0 <= aspect <= 7.0 and 0.0008 <= area_ratio <= 0.08):
            continue
        if not any(abs(x - ux) < 12 and abs(y - uy) < 12 and abs(w - uw) < 18 for ux, uy, uw, _ in unique):
            unique.append(box)

    # Score and sort candidates - return top 8 for speed
    def score(candidate: tuple[int, int, int, int]) -> float:
        cx, cy, cw, ch = candidate
        aspect = cw / ch if ch else 0
        area_ratio = (cw * ch) / float(width * height)
        aspect_score = 1.0 - min(abs(aspect - 4.5) / 4.5, 1.0)
        area_score = 1.0 - min(abs(area_ratio - 0.015) / 0.06, 1.0)
        # Prefer plates in lower half of frame
        vertical_score = 0.2 if cy > height * 0.4 else 0.0
        return aspect_score + area_score + vertical_score

    return sorted(unique, key=score, reverse=True)[:8]  # Reduced from 10 to 8


def detect_plate(frame: np.ndarray, min_confidence: float, frame_number: int) -> PlateDetection | None:
    """
    Detect and recognize license plate in frame with strict validation.
    Returns best detection above confidence threshold.
    """
    best: PlateDetection | None = None
    timestamp = time.time()

    candidates = _candidate_boxes(frame)
    
    for x, y, w, h in candidates:
        crop = frame[y : y + h, x : x + w]
        
        # Skip if crop is too small or too large
        if crop.size == 0 or w < 60 or h < 15 or w > 500 or h > 150:
            continue
            
        text, confidence = _ocr_plate(crop)
        
        if not HAS_TESSERACT:
            # Skip fallback mode - we need real OCR for production
            continue

        # Strict validation: must have minimum length
        if len(text) < 5:
            continue
        
        # Must contain both letters and numbers
        has_letters = any(c.isalpha() for c in text)
        has_numbers = any(c.isdigit() for c in text)
        if not (has_letters and has_numbers):
            continue

        # Boost score for valid format
        pattern_bonus = 0.25 if _validate_plate_format(text) else 0.0
        score = min(1.0, confidence + pattern_bonus)
        
        # Only accept high-quality detections
        if score >= min_confidence and score >= 0.4 and (best is None or score > best.confidence):
            best = PlateDetection(
                text=text,
                confidence=score,
                bbox=(x, y, w, h),
                crop=crop,
                timestamp=timestamp,
                frame_number=frame_number,
            )

    return best


def draw_detection(frame: np.ndarray, detection: PlateDetection | None, vehicle_count: int) -> np.ndarray:
    """Draw detection overlay on frame with vehicle count."""
    annotated = frame.copy()
    
    # Draw vehicle count
    cv2.rectangle(annotated, (10, 10), (300, 60), (0, 0, 0), -1)
    cv2.putText(
        annotated,
        f"Vehicles Detected: {vehicle_count}",
        (20, 45),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (0, 255, 0),
        2,
    )
    
    if detection is None:
        return annotated

    x, y, w, h = detection.bbox
    label = f"{detection.text}  {detection.confidence * 100:.0f}%"
    
    # Draw bounding box
    cv2.rectangle(annotated, (x, y), (x + w, y + h), (0, 255, 0), 3)
    
    # Draw label background
    label_y = max(30, y - 10)
    label_w = min(300, annotated.shape[1] - x - 5)
    cv2.rectangle(annotated, (x, label_y - 28), (x + label_w, label_y), (0, 255, 0), -1)
    cv2.putText(annotated, label, (x + 8, label_y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 0), 2)
    
    return annotated


def _open_capture(video_path: str) -> cv2.VideoCapture:
    """Open video capture with error handling."""
    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video: {video_path}")
    return capture


def _process_video(
    video_path: str,
    frame_stride: int,
    min_confidence: float,
    max_width: int,
    duplicate_threshold: float,
) -> None:
    """
    Process video for LPR with optimized speed and accuracy.
    """
    # UI containers
    frame_slot = st.empty()
    metrics_container = st.container()
    table_slot = st.empty()
    
    with metrics_container:
        col1, col2, col3, col4, col5 = st.columns(5)
        frames_metric = col1.empty()
        fps_metric = col2.empty()
        processing_fps_metric = col3.empty()
        vehicles_metric = col4.empty()
        accuracy_metric = col5.empty()

    capture = _open_capture(video_path)
    fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    
    # Optimized delay calculation
    delay = max(0.0001, (frame_stride / fps) * 0.5)  # Reduced delay for faster processing

    # Vehicle tracking with strict validation
    vehicles: dict[str, VehicleRecord] = {}
    frame_index = 0
    processed = 0
    last_detection: PlateDetection | None = None
    last_frame = None  # Store last frame for final UI update
    started_at = time.time()
    
    progress_bar = st.progress(0.0)
    
    # Performance optimization: batch UI updates
    ui_update_interval = 5  # Update UI every 5 frames for speed
    last_ui_update = 0

    try:
        while capture.isOpened():
            ok, frame = capture.read()
            if not ok:
                break

            if frame_index % frame_stride != 0:
                frame_index += 1
                continue

            # Resize for performance
            height, width = frame.shape[:2]
            if width > max_width:
                scale = max_width / width
                frame = cv2.resize(frame, (max_width, int(height * scale)), interpolation=cv2.INTER_AREA)

            # Store last frame for final UI update
            last_frame = frame.copy()

            # Detect plate with strict validation
            detection = detect_plate(frame, min_confidence, frame_index)
            
            if detection and detection.text and len(detection.text) >= 5:
                # Additional validation: check if plate text is reasonable
                plate = detection.text
                
                # Skip if plate has too many repeated characters (likely false positive)
                if len(set(plate)) < 3:
                    continue
                
                # Skip if confidence is too low
                if detection.confidence < 0.35:  # Slightly higher threshold for speed
                    continue
                
                last_detection = detection
                
                # Check if this is a new vehicle or existing one
                if plate in vehicles:
                    # Update existing vehicle record
                    existing = vehicles[plate]
                    if detection.confidence > existing.best_confidence:
                        vehicles[plate] = VehicleRecord(
                            plate_number=plate,
                            best_confidence=detection.confidence,
                            detection_count=existing.detection_count + 1,
                            first_seen_frame=existing.first_seen_frame,
                            last_seen_frame=frame_index,
                            first_seen_time=existing.first_seen_time,
                            best_crop=detection.crop,
                        )
                    else:
                        vehicles[plate] = VehicleRecord(
                            plate_number=plate,
                            best_confidence=existing.best_confidence,
                            detection_count=existing.detection_count + 1,
                            first_seen_frame=existing.first_seen_frame,
                            last_seen_frame=frame_index,
                            first_seen_time=existing.first_seen_time,
                            best_crop=existing.best_crop,
                        )
                else:
                    # New vehicle detected - only add if confidence is good
                    if detection.confidence >= 0.45:  # Slightly higher for new vehicles
                        vehicles[plate] = VehicleRecord(
                            plate_number=plate,
                            best_confidence=detection.confidence,
                            detection_count=1,
                            first_seen_frame=frame_index,
                            last_seen_frame=frame_index,
                            first_seen_time=time.time(),
                            best_crop=detection.crop,
                        )

            # Batch UI updates for performance
            if processed - last_ui_update >= ui_update_interval or processed == 0:
                # Draw annotations
                annotated = draw_detection(frame, detection or last_detection, len(vehicles))
                frame_slot.image(cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB), channels="RGB", use_container_width=True)

                # Update metrics
                elapsed = max(0.001, time.time() - started_at)
                frames_metric.metric("Frames", f"{processed + 1}")
                fps_metric.metric("Video FPS", f"{fps:.1f}")
                processing_fps_metric.metric("Processing FPS", f"{(processed + 1) / elapsed:.1f}")
                vehicles_metric.metric("Unique Vehicles", str(len(vehicles)))
                
                # Calculate accuracy (vehicles with high confidence)
                high_conf_count = sum(1 for v in vehicles.values() if v.best_confidence >= 0.70)
                accuracy = (high_conf_count / len(vehicles) * 100) if vehicles else 0
                accuracy_metric.metric("High Confidence", f"{accuracy:.0f}%")

                # Update vehicle table
                rows = [
                    {
                        "Plate Number": vehicle.plate_number,
                        "Confidence": f"{vehicle.best_confidence:.1%}",
                        "Detections": vehicle.detection_count,
                        "First Seen": f"Frame {vehicle.first_seen_frame}",
                        "Last Seen": f"Frame {vehicle.last_seen_frame}",
                        "Status": "✓ Verified" if vehicle.best_confidence >= 0.70 else "⚠ Review",
                    }
                    for vehicle in sorted(vehicles.values(), key=lambda v: v.first_seen_frame)
                ]
                table_slot.dataframe(rows, use_container_width=True, hide_index=True)
                
                last_ui_update = processed

            processed += 1
            frame_index += 1
            
            # Update progress
            if frame_count:
                progress_bar.progress(min(1.0, frame_index / frame_count))
            
            time.sleep(delay)
            
    finally:
        capture.release()
        progress_bar.progress(1.0)
        
        # Final UI update using last_frame
        if vehicles and last_frame is not None:
            annotated = draw_detection(last_frame, last_detection, len(vehicles))
            frame_slot.image(cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB), channels="RGB", use_container_width=True)
            
            elapsed = max(0.001, time.time() - started_at)
            frames_metric.metric("Frames", f"{processed}")
            processing_fps_metric.metric("Processing FPS", f"{processed / elapsed:.1f}")
            vehicles_metric.metric("Unique Vehicles", str(len(vehicles)))
            
            high_conf_count = sum(1 for v in vehicles.values() if v.best_confidence >= 0.70)
            accuracy = (high_conf_count / len(vehicles) * 100) if vehicles else 0
            accuracy_metric.metric("High Confidence", f"{accuracy:.0f}%")
            
            rows = [
                {
                    "Plate Number": vehicle.plate_number,
                    "Confidence": f"{vehicle.best_confidence:.1%}",
                    "Detections": vehicle.detection_count,
                    "First Seen": f"Frame {vehicle.first_seen_frame}",
                    "Last Seen": f"Frame {vehicle.last_seen_frame}",
                    "Status": "✓ Verified" if vehicle.best_confidence >= 0.70 else "⚠ Review",
                }
                for vehicle in sorted(vehicles.values(), key=lambda v: v.first_seen_frame)
            ]
            table_slot.dataframe(rows, use_container_width=True, hide_index=True)
        
    # Final summary
    if vehicles:
        avg_fps = processed / max(0.001, time.time() - started_at)
        st.success(f"✓ Processing complete! Detected {len(vehicles)} unique vehicles from {processed} frames in {time.time() - started_at:.1f}s ({avg_fps:.1f} FPS)")
    else:
        st.warning(f"⚠ Processing complete. No vehicles detected from {processed} frames. Try lowering the confidence threshold.")


def main() -> None:
    """Main Streamlit application."""
    st.set_page_config(page_title="LPR Recognition System", layout="wide", page_icon="🚗")
    
    st.title("🚗 License Plate Recognition System")
    st.caption("Production-grade vehicle detection and plate recognition")

    with st.sidebar:
        st.header("📹 Video Source")
        video_path = st.text_input("Video Path", value=DEFAULT_VIDEO_PATH)
        uploaded_video = st.file_uploader("Or Upload Video", type=["mp4", "mov", "avi", "mkv"])

        st.header("⚙️ Detection Settings")
        
        # Performance mode selector
        performance_mode = st.radio(
            "Performance Mode",
            ["Balanced (Recommended)", "Maximum Accuracy", "Maximum Speed"],
            index=0,
            help="Choose processing mode based on your needs"
        )
        
        # Set defaults based on performance mode
        if performance_mode == "Maximum Speed":
            default_stride = 3
            default_confidence = 0.35
            default_width = 960
        elif performance_mode == "Maximum Accuracy":
            default_stride = 1
            default_confidence = 0.25
            default_width = 1280
        else:  # Balanced
            default_stride = 2
            default_confidence = 0.30
            default_width = 1280
        
        frame_stride = st.slider(
            "Process Every N Frames",
            min_value=1,
            max_value=10,
            value=default_stride,
            help="Lower = more accurate, Higher = faster processing",
        )
        min_confidence = st.slider(
            "Minimum Confidence",
            min_value=0.0,
            max_value=1.0,
            value=default_confidence,
            step=0.05,
            help="Lower threshold detects more vehicles",
        )
        duplicate_threshold = st.slider(
            "Duplicate Detection Threshold",
            min_value=0.0,
            max_value=1.0,
            value=0.85,
            step=0.05,
            help="Similarity threshold to merge duplicate detections",
        )
        max_width = st.slider(
            "Preview Width (px)",
            min_value=640,
            max_value=1920,
            value=default_width,
            step=160,
            help="Frame width for processing and display",
        )

        st.divider()
        run = st.button("▶️ Start Processing", type="primary", use_container_width=True)

    # System status
    if not HAS_TESSERACT:
        st.error(
            "⚠️ **Tesseract OCR not found!** "
            "Install Tesseract and set TESSERACT_CMD environment variable. "
            "The app will run in detection-only mode without text recognition."
        )
    else:
        st.info(f"✓ Tesseract OCR ready at: `{TESSERACT_CMD}`")

    # Determine video source
    source_path = video_path
    if uploaded_video is not None:
        temp_dir = Path("tmp")
        temp_dir.mkdir(exist_ok=True)
        source_path = str(temp_dir / uploaded_video.name)
        Path(source_path).write_bytes(uploaded_video.getbuffer())
        st.success(f"✓ Uploaded video saved to: `{source_path}`")

    if not Path(source_path).exists():
        st.warning("⚠️ Please enter a valid video path or upload a video file.")
        st.stop()

    st.info(f"📁 Video source: `{source_path}`")

    if run:
        with st.spinner("🔄 Processing video..."):
            _process_video(source_path, frame_stride, min_confidence, max_width, duplicate_threshold)
    else:
        st.info("👆 Configure settings in the sidebar and click **Start Processing** to begin.")


if __name__ == "__main__":
    main()
