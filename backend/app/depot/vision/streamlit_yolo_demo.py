from __future__ import annotations

from collections import Counter
from io import BytesIO

import httpx
import streamlit as st
from PIL import Image, ImageDraw


DEFAULT_BACKEND_URL = "http://127.0.0.1:8000"

CLASS_COLOURS: dict[str, str] = {
    "bag": "#3b82f6",
    "box": "#f59e0b",
    "pallet": "#22d3a1",
    "carton": "#a78bfa",
    "vehicle": "#06b6d4",
    "person": "#ec4899",
    "unknown": "#94a3b8",
}


def _normalise_base_url(value: str) -> str:
    return value.rstrip("/")


def _api_url(base_url: str, path: str) -> str:
    return f"{_normalise_base_url(base_url)}{path}"


def _headers(token: str | None = None) -> dict[str, str]:
    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _login(base_url: str, email: str, password: str) -> tuple[str | None, str | None]:
    try:
        response = httpx.post(
            _api_url(base_url, "/api/v1/auth/login"),
            json={"email": email, "password": password},
            timeout=20,
        )
    except httpx.HTTPError as exc:
        return None, str(exc)

    if not response.ok:
        return None, f"Login failed: {response.status_code} {response.text}"

    payload = response.json()
    token = payload.get("access_token")
    if not token:
        return None, "Login did not return an access token."
    return token, None


@st.cache_data(show_spinner=False)
def _fetch_models(base_url: str) -> tuple[list[dict], str | None]:
    try:
        response = httpx.get(
            _api_url(base_url, "/depot/vision/detection/models"),
            timeout=20,
        )
        response.raise_for_status()
        return response.json(), None
    except httpx.HTTPError as exc:
        return [], str(exc)


def _detect_frame(base_url: str, token: str, model_id: str, uploaded_file) -> tuple[list[dict], str | None]:
    files = {
        "file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type or "application/octet-stream"),
    }
    data = {"model_id": model_id}

    try:
        response = httpx.post(
            _api_url(base_url, "/depot/vision/detection/detect-frame"),
            headers=_headers(token),
            data=data,
            files=files,
            timeout=60,
        )
    except httpx.HTTPError as exc:
        return [], str(exc)

    if not response.ok:
        return [], f"Detection failed: {response.status_code} {response.text}"

    return response.json(), None


def _annotate_image(image: Image.Image, detections: list[dict]) -> Image.Image:
    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)
    width, height = annotated.size

    for det in detections:
        label = det.get("class_label", "unknown")
        confidence = float(det.get("confidence", 0.0))
        x1 = float(det.get("bbox_x", 0.0)) * width
        y1 = float(det.get("bbox_y", 0.0)) * height
        x2 = x1 + float(det.get("bbox_w", 0.0)) * width
        y2 = y1 + float(det.get("bbox_h", 0.0)) * height
        colour = CLASS_COLOURS.get(label, CLASS_COLOURS["unknown"])
        caption = f"{label} {confidence * 100:.1f}%"

        draw.rectangle((x1, y1, x2, y2), outline=colour, width=3)
        text_top = max(y1 - 18, 0)
        draw.rectangle((x1, text_top, min(x1 + 150, width), text_top + 18), fill=colour)
        draw.text((x1 + 4, text_top + 3), caption, fill="white")

    return annotated


def _detection_rows(detections: list[dict]) -> list[dict]:
    rows: list[dict] = []
    for det in detections:
        rows.append(
            {
                "class": det.get("class_label", "unknown"),
                "confidence": round(float(det.get("confidence", 0.0)), 4),
                "x": round(float(det.get("bbox_x", 0.0)), 4),
                "y": round(float(det.get("bbox_y", 0.0)), 4),
                "w": round(float(det.get("bbox_w", 0.0)), 4),
                "h": round(float(det.get("bbox_h", 0.0)), 4),
                "size_cm2": det.get("size_estimate_cm2"),
            }
        )
    return rows


def main() -> None:
    st.set_page_config(page_title="Cement Bag Detector", layout="wide")
    st.title("Cement Bag Detection")
    st.caption("Streamlit demo UI backed by the FastAPI detection endpoint.")

    if "access_token" not in st.session_state:
        st.session_state.access_token = ""

    with st.sidebar:
        st.header("Backend")
        backend_url = st.text_input("Backend URL", value=DEFAULT_BACKEND_URL)
        manual_token = st.text_area(
            "Bearer token",
            value=st.session_state.access_token,
            help="Paste an access token here, or log in below to populate it automatically.",
        )

        st.header("Login")
        email = st.text_input("Email")
        password = st.text_input("Password", type="password")
        if st.button("Login to Backend", use_container_width=True):
            token, error = _login(backend_url, email, password)
            if error:
                st.error(error)
            else:
                st.session_state.access_token = token
                st.success("Backend login successful.")
                st.rerun()

        if st.button("Clear Token", use_container_width=True):
            st.session_state.access_token = ""
            st.rerun()

    token = st.session_state.access_token or manual_token.strip()
    models, model_error = _fetch_models(backend_url)

    if model_error:
        st.error(f"Could not load detection models: {model_error}")
        st.stop()

    if not models:
        st.warning("No active detection models were returned by the backend.")
        st.stop()

    active_index = next((index for index, model in enumerate(models) if model.get("is_active")), 0)
    model_labels = [
        f"{model.get('model_name', 'model')} {model.get('model_version', '')}".strip()
        for model in models
    ]
    selected_label = st.selectbox("Backend detection model", model_labels, index=active_index)
    selected_model = models[model_labels.index(selected_label)]

    st.success(
        "Backend model ready: "
        f"{selected_model.get('model_name')} {selected_model.get('model_version')} | "
        f"classes {selected_model.get('target_classes')}"
    )

    uploaded_image = st.file_uploader(
        "Upload an image for detection",
        type=["jpg", "jpeg", "png", "bmp", "webp"],
    )

    if uploaded_image is None:
        st.info("Upload an image to run inference through the backend.")
        return

    if not token:
        st.warning("Add a bearer token or log in from the sidebar to call the backend detection endpoint.")
        return

    image = Image.open(BytesIO(uploaded_image.getvalue())).convert("RGB")

    if st.button("Run Backend Detection", type="primary"):
        with st.spinner("Calling backend detection..."):
            detections, detect_error = _detect_frame(
                backend_url,
                token,
                str(selected_model["id"]),
                uploaded_image,
            )

        if detect_error:
            st.error(detect_error)
            return

        rows = _detection_rows(detections)
        counts = Counter(row["class"] for row in rows)
        annotated = _annotate_image(image, detections)

        col1, col2 = st.columns(2)
        with col1:
            st.subheader("Original Image")
            st.image(image, use_container_width=True)
        with col2:
            st.subheader("Backend Detection Output")
            st.image(annotated, use_container_width=True)

        metric_columns = st.columns(max(len(counts), 1))
        if counts:
            for index, (label, count) in enumerate(counts.items()):
                metric_columns[index].metric(label, count)
        else:
            metric_columns[0].metric("Detections", 0)

        st.subheader("Detection Details")
        if rows:
            st.dataframe(rows, use_container_width=True)
        else:
            st.write("No detections returned by the backend for this image.")


if __name__ == "__main__":
    main()
