$ErrorActionPreference = "Stop"

Write-Host "Starting LPR Recognition System..." -ForegroundColor Green
Write-Host "Video Path: C:\Users\Anish\Desktop\IntelliDepo\backend\tmp\LPR_RECOGNITION.mp4" -ForegroundColor Cyan

Set-Location (Join-Path $PSScriptRoot "..")
& .\.venv\Scripts\streamlit.exe run backend\app\depot\gate\streamlit_lpr_production.py --server.port 8501 --server.headless true
