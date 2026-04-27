# Streamlit + FastAPI Setup

This project now follows the same high-level pattern as the reference repo:

- FastAPI remains the real backend
- the trained YOLO `.pt` model is used by backend detection endpoints
- Streamlit is a separate demo/operator UI
- the main frontend can call the same backend

## What runs where

- FastAPI backend:
  - serves auth, detection, and depot APIs
  - uses the trained YOLO model through backend detection logic
- Streamlit demo:
  - does not load the model directly
  - logs into backend and calls backend detection endpoints

## Current branch

Use the integration branch, not `main`:

```powershell
git checkout feature/streamlit-backend-client
```

## Start the backend

From repo root:

```powershell
& .\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

If your import path expects `backend` as the working directory, use:

```powershell
Set-Location backend
& ..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

## Start Streamlit

From repo root:

```powershell
& .\.venv\Scripts\streamlit.exe run backend\app\depot\vision\streamlit_yolo_demo.py
```

## How to use Streamlit

1. Open the Streamlit URL shown in the terminal, usually `http://127.0.0.1:8501`
2. Enter the backend URL, usually `http://127.0.0.1:8000`
3. Log in with a valid backend user
4. Select the backend detection model
5. Upload an image and run detection

## Expected behavior

- Streamlit sends the uploaded image to `/depot/vision/detection/detect-frame`
- backend performs inference using the trained model
- Streamlit shows the returned detections and draws the boxes locally

## Important notes

- Backend must be running before Streamlit can work
- The detection upload endpoint requires authentication
- The trained model path should eventually be moved to `YOLO_WEIGHTS` in environment config for deployment portability
- No changes in this setup require modifying `backend/app/main.py`

## Main risks

- Incorrect backend URL in Streamlit
- Missing or invalid login token
- Backend model config not available
- Hardcoded local model path not existing on another machine
