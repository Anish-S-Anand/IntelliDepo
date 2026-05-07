# LPR System Installation Guide

## Prerequisites

### 1. Python Environment
Ensure Python 3.11+ is installed and accessible.

```bash
python --version
# Should output: Python 3.11.x or higher
```

### 2. Install Tesseract OCR (REQUIRED)

Tesseract OCR is essential for license plate text recognition.

#### Windows Installation:

1. **Download Tesseract**:
   - Visit: https://github.com/UB-Mannheim/tesseract/wiki
   - Download the latest Windows installer (e.g., `tesseract-ocr-w64-setup-5.3.3.20231005.exe`)

2. **Install Tesseract**:
   - Run the installer
   - Install to default location: `C:\Program Files\Tesseract-OCR\`
   - ✅ Check "Add to PATH" during installation

3. **Verify Installation**:
   ```bash
   tesseract --version
   ```
   
   If this fails, manually add to PATH:
   - Open System Properties → Environment Variables
   - Add to PATH: `C:\Program Files\Tesseract-OCR\`
   - Restart terminal

4. **Set Environment Variable** (if not in PATH):
   ```powershell
   $env:TESSERACT_CMD = "C:\Program Files\Tesseract-OCR\tesseract.exe"
   ```

### 3. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This will install:
- ✅ streamlit>=1.44.0
- ✅ opencv-python-headless>=4.10.0
- ✅ pytesseract>=0.3.10
- ✅ numpy
- ✅ ultralytics (YOLO)
- ✅ And all other dependencies

## Verification

Run the verification script:

```bash
cd backend
python verify_installation.py
```

Expected output:
```
✓ Python 3.11+ detected
✓ Streamlit installed (version 1.55.0)
✓ OpenCV installed (version 4.13.0)
✓ Pytesseract installed
✓ Tesseract OCR found at: C:\Program Files\Tesseract-OCR\tesseract.exe
✓ Video file exists: LPR_RECOGNITION.mp4
✓ All dependencies verified!
```

## Running the Application

### Method 1: Batch Script (Recommended for Windows)
```bash
cd backend
start_lpr_production.bat
```

### Method 2: PowerShell Script
```powershell
cd backend
.\start_lpr_production.ps1
```

### Method 3: Direct Streamlit
```bash
cd backend
streamlit run app/depot/gate/streamlit_lpr_production.py
```

### Method 4: Main Entry Point
```bash
cd backend
streamlit run streamlit_app.py
```

## Troubleshooting

### Issue: "Tesseract not found"

**Symptoms**:
- Warning message in Streamlit UI
- No text recognition, only bounding boxes

**Solutions**:

1. **Verify Tesseract is installed**:
   ```bash
   tesseract --version
   ```

2. **Set environment variable**:
   ```powershell
   # PowerShell
   $env:TESSERACT_CMD = "C:\Program Files\Tesseract-OCR\tesseract.exe"
   
   # Or permanently in Windows:
   [System.Environment]::SetEnvironmentVariable('TESSERACT_CMD', 'C:\Program Files\Tesseract-OCR\tesseract.exe', 'User')
   ```

3. **Restart terminal and application**

### Issue: "Module not found" errors

**Solution**:
```bash
cd backend
pip install -r requirements.txt --upgrade
```

### Issue: Video file not found

**Solution**:
1. Verify video path in the Streamlit sidebar
2. Default path: `C:\Users\karte\OneDrive - Fidelis Technology Services Pvt Ltd\Desktop\intelli-platform\LPR_RECOGNITION.mp4`
3. Or upload a video file directly through the UI

### Issue: Slow performance

**Solutions**:
1. Increase "Process Every N Frames" slider (e.g., 5-10)
2. Decrease "Preview Width" slider (e.g., 960px)
3. Close other applications
4. Use a video with lower resolution

### Issue: Low accuracy

**Solutions**:
1. Decrease "Process Every N Frames" to 1-2
2. Lower "Minimum Confidence" threshold
3. Ensure video has good lighting and clear plates
4. Increase "Preview Width" for better resolution

## System Requirements

### Minimum:
- CPU: Intel i5 or equivalent
- RAM: 8 GB
- Storage: 2 GB free space
- OS: Windows 10/11

### Recommended:
- CPU: Intel i7 or equivalent
- RAM: 16 GB
- Storage: 5 GB free space
- GPU: NVIDIA GPU with CUDA support (optional, for faster processing)
- OS: Windows 11

## Next Steps

After successful installation:

1. **Start the application** using one of the methods above
2. **Access the UI** at http://localhost:8501
3. **Configure settings** in the sidebar
4. **Click "Start Processing"** to begin vehicle detection
5. **Review results** in the metrics and table

## Support

If you encounter issues:
1. Check this troubleshooting guide
2. Review `LPR_SYSTEM_README.md` for detailed documentation
3. Check the Streamlit console for error messages
4. Contact the development team

---

**Last Updated**: 2026-04-29
