"""
Installation Verification Script for LPR System
Checks all dependencies and system requirements
"""
import sys
from pathlib import Path


def check_python_version():
    """Check Python version."""
    version = sys.version_info
    if version.major >= 3 and version.minor >= 11:
        print(f"✓ Python {version.major}.{version.minor}.{version.micro} detected")
        return True
    else:
        print(f"✗ Python 3.11+ required, found {version.major}.{version.minor}.{version.micro}")
        return False


def check_module(module_name, display_name=None):
    """Check if a Python module is installed."""
    display_name = display_name or module_name
    try:
        module = __import__(module_name)
        version = getattr(module, "__version__", "unknown")
        print(f"✓ {display_name} installed (version {version})")
        return True
    except ImportError:
        print(f"✗ {display_name} not installed")
        return False


def check_tesseract():
    """Check if Tesseract OCR is available."""
    import shutil
    import os
    
    # Check environment variable
    env_path = os.environ.get("TESSERACT_CMD")
    if env_path and Path(env_path).exists():
        print(f"✓ Tesseract OCR found at: {env_path}")
        return True
    
    # Check PATH
    path_cmd = shutil.which("tesseract")
    if path_cmd:
        print(f"✓ Tesseract OCR found in PATH: {path_cmd}")
        return True
    
    # Check common Windows locations
    for candidate in [
        Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
        Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
    ]:
        if candidate.exists():
            print(f"✓ Tesseract OCR found at: {candidate}")
            return True
    
    print("✗ Tesseract OCR not found")
    print("  Install from: https://github.com/UB-Mannheim/tesseract/wiki")
    return False


def check_video_file():
    """Check if the default video file exists."""
    video_path = Path(r"C:\Users\karte\OneDrive - Fidelis Technology Services Pvt Ltd\Desktop\intelli-platform\LPR_RECOGNITION.mp4")
    if video_path.exists():
        size_mb = video_path.stat().st_size / (1024 * 1024)
        print(f"✓ Video file exists: LPR_RECOGNITION.mp4 ({size_mb:.1f} MB)")
        return True
    else:
        print(f"⚠ Default video file not found at: {video_path}")
        print("  You can upload a video through the Streamlit UI")
        return None  # Warning, not error


def main():
    """Run all verification checks."""
    print("=" * 60)
    print("LPR System Installation Verification")
    print("=" * 60)
    print()
    
    checks = []
    
    # Core checks
    checks.append(check_python_version())
    checks.append(check_module("streamlit", "Streamlit"))
    checks.append(check_module("cv2", "OpenCV"))
    checks.append(check_module("pytesseract", "Pytesseract"))
    checks.append(check_module("numpy", "NumPy"))
    checks.append(check_tesseract())
    
    # Optional checks
    video_check = check_video_file()
    if video_check is not None:
        checks.append(video_check)
    
    print()
    print("=" * 60)
    
    if all(checks):
        print("✓ All dependencies verified!")
        print("✓ System is ready to run the LPR application")
        print()
        print("To start the application, run:")
        print("  start_lpr_production.bat")
        print("  OR")
        print("  streamlit run streamlit_app.py")
        return 0
    else:
        print("✗ Some dependencies are missing")
        print()
        print("To install missing dependencies:")
        print("  pip install -r requirements.txt")
        print()
        print("For Tesseract OCR:")
        print("  Download from: https://github.com/UB-Mannheim/tesseract/wiki")
        return 1


if __name__ == "__main__":
    sys.exit(main())
