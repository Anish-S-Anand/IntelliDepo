from __future__ import annotations

import os
import re
import shutil
import time
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
import streamlit as st

try:
    import pytesseract
except ImportError:
    pytesseract = None


DEFAULT_VIDEO_PATH = (
    r"C:\Users\karte\AppData\Local\Microsoft\Windows\INetCache\Content.Outlook"
    r"\3JFV9D7S\Screen Recording 2025-07-14 145429 (002).mp4"
)
PLATE_TEXT_RE = re.compile(r"^[A-Z]{1,3}[0-9]{1,2}[A-Z]{0,3}[0-9]{3,5}$")


def _resolve_tesseract_cmd() -> str | None:
    env_path = os.environ.get("TESSERACT_CMD")
    if env_path and Path(env_path).exists():
        return env_path

    path_cmd = shutil.which("tesseract")
    if path_cmd:
        return path_cmd

    for candidate in (
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
    text: str
    confidence: float
    bbox: tuple[int, int, int, int]
    crop: np.ndarray


def _clean_plate_text(value: str) -> str:
    return "".join(char for char in value.upper() if char.isalnum())


def _ocr_plate(plate_image: np.ndarray) -> tuple[str, float]:
    if not HAS_TESSERACT or pytesseract is None:
        return "", 0.0

    resized = cv2.resize(plate_image, None, fx=2.2, fy=2.2, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY) if resized.ndim == 3 else resized
    gray = cv2.bilateralFilter(gray, 7, 45, 45)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    config = "--oem 3 --psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    raw_text = pytesseract.image_to_string(thresh, config=config)
    text = _clean_plate_text(raw_text)

    try:
        data = pytesseract.image_to_data(thresh, config=config, output_type=pytesseract.Output.DICT)
        scores = [float(score) for score in data.get("conf", []) if str(score).strip() not in {"", "-1"}]
        confidence = max(0.0, min(1.0, sum(scores) / len(scores) / 100.0)) if scores else 0.0
    except Exception:
        confidence = 0.0

    return text, round(confidence, 3)


def _candidate_boxes(frame: np.ndarray) -> list[tuple[int, int, int, int]]:
    height, width = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 11, 75, 75)
    boxes: list[tuple[int, int, int, int]] = []

    for cascade_name in ("haarcascade_russian_plate_number.xml", "haarcascade_license_plate_rus_16stages.xml"):
        cascade_path = str(Path(cv2.data.haarcascades) / cascade_name)
        cascade = cv2.CascadeClassifier(cascade_path)
        if cascade.empty():
            continue
        for x, y, w, h in cascade.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=4, minSize=(70, 20)):
            aspect = w / h if h else 0
            if 2.0 <= aspect <= 6.8:
                boxes.append((int(x), int(y), int(w), int(h)))

    blackhat_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (31, 9))
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, blackhat_kernel)
    grad_x = cv2.Sobel(blackhat, ddepth=cv2.CV_32F, dx=1, dy=0, ksize=-1)
    grad_x = np.absolute(grad_x)
    min_val, max_val = float(np.min(grad_x)), float(np.max(grad_x))
    if max_val - min_val > 0:
        grad_x = (255 * ((grad_x - min_val) / (max_val - min_val))).astype("uint8")
    else:
        grad_x = np.zeros_like(gray)

    grad_x = cv2.GaussianBlur(grad_x, (5, 5), 0)
    close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (31, 7))
    closed = cv2.morphologyEx(grad_x, cv2.MORPH_CLOSE, close_kernel)
    _, thresh = cv2.threshold(closed, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    thresh = cv2.erode(thresh, None, iterations=1)
    thresh = cv2.dilate(thresh, None, iterations=2)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:18]:
        x, y, w, h = cv2.boundingRect(contour)
        if h == 0:
            continue
        aspect = w / h
        area_ratio = (w * h) / float(width * height)
        if 2.0 <= aspect <= 6.8 and 0.002 <= area_ratio <= 0.08 and w >= 70 and h >= 18:
            pad_x = int(w * 0.08)
            pad_y = int(h * 0.18)
            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(width, x + w + pad_x)
            y2 = min(height, y + h + pad_y)
            boxes.append((x1, y1, x2 - x1, y2 - y1))

    unique: list[tuple[int, int, int, int]] = []
    for box in boxes:
        x, y, w, h = box
        aspect = w / h if h else 0
        area_ratio = (w * h) / float(width * height)
        if not (2.0 <= aspect <= 6.8 and 0.0015 <= area_ratio <= 0.06):
            continue
        if not any(abs(x - ux) < 12 and abs(y - uy) < 12 and abs(w - uw) < 18 for ux, uy, uw, _ in unique):
            unique.append(box)

    def score(candidate: tuple[int, int, int, int]) -> float:
        _, cy, cw, ch = candidate
        aspect = cw / ch if ch else 0
        area_ratio = (cw * ch) / float(width * height)
        aspect_score = 1.0 - min(abs(aspect - 4.2) / 4.2, 1.0)
        area_score = 1.0 - min(abs(area_ratio - 0.012) / 0.048, 1.0)
        lower_frame_bonus = 0.15 if cy > height * 0.35 else 0.0
        return aspect_score + area_score + lower_frame_bonus

    return sorted(unique, key=score, reverse=True)


def detect_plate(frame: np.ndarray, min_confidence: float) -> PlateDetection | None:
    best: PlateDetection | None = None

    for x, y, w, h in _candidate_boxes(frame):
        crop = frame[y : y + h, x : x + w]
        text, confidence = _ocr_plate(crop)
        if not HAS_TESSERACT:
            score = 0.5
            if score >= min_confidence and (best is None or score > best.confidence):
                best = PlateDetection(text="PLATE", confidence=score, bbox=(x, y, w, h), crop=crop)
            continue

        if len(text) < 5:
            continue

        pattern_bonus = 0.18 if PLATE_TEXT_RE.match(text) else 0.0
        score = min(1.0, confidence + pattern_bonus)
        if score >= min_confidence and (best is None or score > best.confidence):
            best = PlateDetection(text=text, confidence=score, bbox=(x, y, w, h), crop=crop)

    return best


def draw_detection(frame: np.ndarray, detection: PlateDetection | None) -> np.ndarray:
    annotated = frame.copy()
    if detection is None:
        return annotated

    x, y, w, h = detection.bbox
    label = f"{detection.text}  {detection.confidence * 100:.0f}%"
    cv2.rectangle(annotated, (x, y), (x + w, y + h), (20, 220, 90), 3)
    label_y = max(26, y - 10)
    cv2.rectangle(annotated, (x, label_y - 24), (min(x + 250, annotated.shape[1] - 1), label_y), (20, 220, 90), -1)
    cv2.putText(annotated, label, (x + 6, label_y - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.58, (0, 0, 0), 2)
    return annotated


def _open_capture(video_path: str) -> cv2.VideoCapture:
    capture = cv2.VideoCapture(video_path)
    if not capture.isOpened():
        raise RuntimeError(f"Could not open video: {video_path}")
    return capture


def _process_video(video_path: str, frame_stride: int, min_confidence: float, max_width: int) -> None:
    frame_slot = st.empty()
    plate_slot = st.empty()
    metrics = st.columns(4)
    table_slot = st.empty()

    capture = _open_capture(video_path)
    fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    delay = max(0.001, frame_stride / fps)

    seen: dict[str, tuple[float, int]] = {}
    frame_index = 0
    processed = 0
    last_detection: PlateDetection | None = None
    started_at = time.time()

    try:
        while capture.isOpened():
            ok, frame = capture.read()
            if not ok:
                break

            if frame_index % frame_stride != 0:
                frame_index += 1
                continue

            height, width = frame.shape[:2]
            if width > max_width:
                scale = max_width / width
                frame = cv2.resize(frame, (max_width, int(height * scale)), interpolation=cv2.INTER_AREA)

            detection = detect_plate(frame, min_confidence)
            if detection:
                last_detection = detection
                best_confidence, count = seen.get(detection.text, (0.0, 0))
                seen[detection.text] = (max(best_confidence, detection.confidence), count + 1)

            annotated = draw_detection(frame, detection or last_detection)
            frame_slot.image(cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB), channels="RGB", use_container_width=True)

            if detection:
                plate_slot.image(cv2.cvtColor(detection.crop, cv2.COLOR_BGR2RGB), channels="RGB", caption=detection.text)

            elapsed = max(0.001, time.time() - started_at)
            metrics[0].metric("Frames", f"{processed + 1}")
            metrics[1].metric("Video FPS", f"{fps:.1f}")
            metrics[2].metric("Processing FPS", f"{(processed + 1) / elapsed:.1f}")
            metrics[3].metric("Plates", str(len(seen)))

            rows = [
                {"plate": plate, "best_confidence": round(conf, 3), "hits": hits}
                for plate, (conf, hits) in sorted(seen.items(), key=lambda item: item[1][0], reverse=True)
            ]
            table_slot.dataframe(rows, use_container_width=True, hide_index=True)

            processed += 1
            frame_index += 1
            if frame_count:
                st.progress(min(1.0, frame_index / frame_count))
            time.sleep(delay)
    finally:
        capture.release()


def main() -> None:
    st.set_page_config(page_title="Realtime LPR", layout="wide")
    st.title("Realtime Number Plate Recognition")

    with st.sidebar:
        st.header("Video Source")
        video_path = st.text_input("MP4 path", value=DEFAULT_VIDEO_PATH)
        uploaded_video = st.file_uploader("Or upload a video", type=["mp4", "mov", "avi", "mkv"])

        st.header("Recognition")
        frame_stride = st.slider("Process every N frames", min_value=1, max_value=10, value=2)
        min_confidence = st.slider("Minimum OCR confidence", min_value=0.0, max_value=1.0, value=0.35, step=0.05)
        max_width = st.slider("Preview width", min_value=640, max_value=1600, value=960, step=80)

        run = st.button("Start LPR", type="primary", use_container_width=True)

    if not HAS_TESSERACT:
        st.warning(
            "Tesseract OCR is not installed or not on PATH. The app will draw plate bounding boxes; "
            "set TESSERACT_CMD to enable plate text recognition."
        )

    source_path = video_path
    if uploaded_video is not None:
        temp_dir = Path("tmp")
        temp_dir.mkdir(exist_ok=True)
        source_path = str(temp_dir / uploaded_video.name)
        Path(source_path).write_bytes(uploaded_video.getbuffer())

    if not Path(source_path).exists():
        st.warning("Enter a valid video path or upload a video.")
        return

    st.caption(source_path)
    if run:
        _process_video(source_path, frame_stride, min_confidence, max_width)
    else:
        st.info("Press Start LPR to process the video feed and draw plate bounding boxes.")


if __name__ == "__main__":
    main()
