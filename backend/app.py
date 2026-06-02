# app.py
# Streamlit Object Detection for BOTH Images and Videos

import os
import cv2
import tempfile
import pandas as pd
import streamlit as st
from collections import Counter
from dotenv import load_dotenv
from ultralytics import YOLO

# =========================================
# LOAD ENV
# =========================================
load_dotenv()

VIDEO_API_KEY = os.getenv("VIDEO_API_KEY")

if not VIDEO_API_KEY:
    raise ValueError("VIDEO_API_KEY not found in .env")

# =========================================
# LOAD MODEL
# =========================================
MODEL_PATH = ""  # Change if needed

model = YOLO(MODEL_PATH)

# =========================================
# STREAMLIT CONFIG
# =========================================
st.set_page_config(
    page_title="Object Detection Dashboard",
    layout="wide"
)

st.title("🧠 Object Detection Dashboard")

st.markdown(
    "Supports both **Images** and **Videos** with detection reports."
)

# =========================================
# DETECTION TYPE
# =========================================
detection_type = st.radio(
    "Choose Input Type",
    ["Image", "Video"]
)

confidence = st.slider(
    "Confidence Threshold",
    min_value=0.1,
    max_value=1.0,
    value=0.5,
    step=0.05
)

# =========================================
# IMAGE DETECTION
# =========================================
if detection_type == "Image":

    uploaded_image = st.file_uploader(
        "Upload Image",
        type=["jpg", "jpeg", "png"]
    )

    image_path_input = st.text_input(
        "OR Enter Image Path",
        placeholder="C:/images/test.jpg"
    )

    run_image_detection = st.button("Run Image Detection")

    # =====================================
    # IMAGE PROCESS FUNCTION
    # =====================================
    def process_image(image_path):

        image = cv2.imread(image_path)

        if image is None:
            st.error("Unable to read image.")
            return

        results = model.predict(
            source=image,
            conf=confidence,
            verbose=False
        )

        result = results[0]

        annotated_image = result.plot()

        annotated_rgb = cv2.cvtColor(
            annotated_image,
            cv2.COLOR_BGR2RGB
        )

        # =====================================
        # DISPLAY IMAGE
        # =====================================
        st.subheader("🖼 Detected Image")

        st.image(
            annotated_rgb,
            use_container_width=True
        )

        # =====================================
        # DETECTION REPORT
        # =====================================
        detection_counter = Counter()
        detection_records = []

        boxes = result.boxes

        if boxes is not None:

            for box in boxes:

                cls_id = int(box.cls[0])

                class_name = model.names[cls_id]

                conf_score = float(box.conf[0])

                detection_counter[class_name] += 1

                detection_records.append({
                    "Object": class_name,
                    "Confidence": round(conf_score, 2)
                })

        st.subheader("📊 Detection Summary")

        if len(detection_counter) == 0:
            st.warning("No objects detected.")
            return

        summary_df = pd.DataFrame(
            detection_counter.items(),
            columns=["Object", "Count"]
        ).sort_values(by="Count", ascending=False)

        st.dataframe(
            summary_df,
            use_container_width=True
        )

        # =====================================
        # METRICS
        # =====================================
        col1, col2 = st.columns(2)

        with col1:
            st.metric(
                "Unique Objects",
                len(detection_counter)
            )

        with col2:
            st.metric(
                "Total Detections",
                sum(detection_counter.values())
            )

        # =====================================
        # DETAILED REPORT
        # =====================================
        st.subheader("📄 Detailed Report")

        detail_df = pd.DataFrame(detection_records)

        st.dataframe(
            detail_df,
            use_container_width=True
        )

        # =====================================
        # DOWNLOAD REPORT
        # =====================================
        csv = detail_df.to_csv(index=False).encode("utf-8")

        st.download_button(
            label="⬇ Download CSV Report",
            data=csv,
            file_name="image_detection_report.csv",
            mime="text/csv"
        )

    # =====================================
    # RUN IMAGE DETECTION
    # =====================================
    if run_image_detection:

        temp_image_path = None

        # Uploaded Image
        if uploaded_image is not None:

            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=".jpg"
            ) as tmp_file:

                tmp_file.write(uploaded_image.read())

                temp_image_path = tmp_file.name

            process_image(temp_image_path)

        # Path Image
        elif image_path_input:

            if os.path.exists(image_path_input):
                process_image(image_path_input)
            else:
                st.error("Image path does not exist.")

        else:
            st.warning("Please upload an image or enter image path.")

# =========================================
# VIDEO DETECTION
# =========================================
else:

    uploaded_video = st.file_uploader(
        "Upload Video",
        type=["mp4", "avi", "mov", "mkv"]
    )

    video_path_input = st.text_input(
        "OR Enter Video Path",
        placeholder="tmp/"
    )

    run_video_detection = st.button("Run Video Detection")

    # =====================================
    # VIDEO PROCESS FUNCTION
    # =====================================
    def process_video(video_path):

        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            st.error("Unable to open video.")
            return

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        output_path = tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".mp4"
        ).name

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")

        out = cv2.VideoWriter(
            output_path,
            fourcc,
            fps,
            (width, height)
        )

        detection_counter = Counter()
        detection_records = []

        progress_bar = st.progress(0)

        frame_number = 0

        while True:

            ret, frame = cap.read()

            if not ret:
                break

            frame_number += 1

            results = model.predict(
                source=frame,
                conf=confidence,
                verbose=False
            )

            result = results[0]

            boxes = result.boxes

            if boxes is not None:

                for box in boxes:

                    cls_id = int(box.cls[0])

                    class_name = model.names[cls_id]

                    conf_score = float(box.conf[0])

                    detection_counter[class_name] += 1

                    detection_records.append({
                        "Frame": frame_number,
                        "Object": class_name,
                        "Confidence": round(conf_score, 2)
                    })

            annotated_frame = result.plot()

            out.write(annotated_frame)

            progress = frame_number / total_frames

            progress_bar.progress(min(progress, 1.0))

        cap.release()
        out.release()

        st.success("Detection Completed!")

        # =====================================
        # DISPLAY VIDEO
        # =====================================
        st.subheader("🎬 Processed Video")

        st.video(output_path)

        # =====================================
        # SUMMARY
        # =====================================
        st.subheader("📊 Detection Summary")

        if len(detection_counter) == 0:
            st.warning("No objects detected.")
            return

        summary_df = pd.DataFrame(
            detection_counter.items(),
            columns=["Object", "Count"]
        ).sort_values(by="Count", ascending=False)

        st.dataframe(
            summary_df,
            use_container_width=True
        )

        # =====================================
        # METRICS
        # =====================================
        col1, col2 = st.columns(2)

        with col1:
            st.metric(
                "Unique Objects",
                len(detection_counter)
            )

        with col2:
            st.metric(
                "Total Detections",
                sum(detection_counter.values())
            )

        # =====================================
        # DETAILED REPORT
        # =====================================
        st.subheader("📄 Detailed Report")

        detail_df = pd.DataFrame(detection_records)

        st.dataframe(
            detail_df,
            use_container_width=True,
            height=400
        )

        # =====================================
        # DOWNLOAD REPORT
        # =====================================
        csv = detail_df.to_csv(index=False).encode("utf-8")

        st.download_button(
            label="⬇ Download CSV Report",
            data=csv,
            file_name="video_detection_report.csv",
            mime="text/csv"
        )

    # =====================================
    # RUN VIDEO DETECTION
    # =====================================
    if run_video_detection:

        temp_video_path = None

        # Uploaded Video
        if uploaded_video is not None:

            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=".mp4"
            ) as tmp_file:

                tmp_file.write(uploaded_video.read())

                temp_video_path = tmp_file.name

            process_video(temp_video_path)

        # Path Video
        elif video_path_input:

            if os.path.exists(video_path_input):
                process_video(video_path_input)
            else:
                st.error("Video path does not exist.")

        else:
            st.warning("Please upload a video or enter video path.")