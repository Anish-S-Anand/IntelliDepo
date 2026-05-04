$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")
& .\.venv\Scripts\streamlit.exe run backend\app\depot\vision\streamlit_yolo_demo.py
