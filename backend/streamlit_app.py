"""
Main Streamlit Application Entry Point
Redirects to the production LPR Recognition system
"""
import streamlit as st
from pathlib import Path
import sys

# Add app directory to path
app_dir = Path(__file__).parent / "app"
sys.path.insert(0, str(app_dir))

# Import and run the production LPR app
from depot.gate.streamlit_lpr_production import main

if __name__ == "__main__":
    main()
