$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")
& .\.venv\Scripts\streamlit.exe run backend\app\depot\gate\streamlit_lpr_demo.py
