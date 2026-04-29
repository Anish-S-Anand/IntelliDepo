@echo off
REM Production LPR Recognition Streamlit Launcher (Batch version)

echo Starting Production LPR Recognition System...
echo =============================================
echo.

REM Check if virtual environment exists
if exist ".venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call .venv\Scripts\activate.bat
) else if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else if exist "venv311\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv311\Scripts\activate.bat
) else (
    echo Warning: No virtual environment found. Using system Python.
)

echo.
echo Launching Streamlit LPR Application...
echo Access the app at: http://localhost:8501
echo.

REM Run Streamlit
streamlit run app/depot/gate/streamlit_lpr_production.py --server.port 8501 --server.address localhost
