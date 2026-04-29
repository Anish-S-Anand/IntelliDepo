# Production LPR Recognition Streamlit Launcher
# This script starts the production-grade LPR recognition system

Write-Host "Starting Production LPR Recognition System..." -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

# Check if virtual environment exists
if (Test-Path ".venv\Scripts\Activate.ps1") {
    Write-Host "Activating virtual environment..." -ForegroundColor Yellow
    & .venv\Scripts\Activate.ps1
} elseif (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "Activating virtual environment..." -ForegroundColor Yellow
    & venv\Scripts\Activate.ps1
} elseif (Test-Path "venv311\Scripts\Activate.ps1") {
    Write-Host "Activating virtual environment..." -ForegroundColor Yellow
    & venv311\Scripts\Activate.ps1
} else {
    Write-Host "Warning: No virtual environment found. Using system Python." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Launching Streamlit LPR Application..." -ForegroundColor Cyan
Write-Host "Access the app at: http://localhost:8501" -ForegroundColor Cyan
Write-Host ""

# Run Streamlit
streamlit run app/depot/gate/streamlit_lpr_production.py --server.port 8501 --server.address localhost
