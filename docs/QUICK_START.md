# Quick Start Guide - LPR Recognition System

## ⚡ Fast Setup (5 minutes)

### Step 1: Install Tesseract OCR (REQUIRED)

**Download & Install**:
1. Go to: https://github.com/UB-Mannheim/tesseract/wiki
2. Download: `tesseract-ocr-w64-setup-5.3.3.20231005.exe` (or latest)
3. Run installer → Install to `C:\Program Files\Tesseract-OCR\`
4. ✅ Check "Add to PATH" during installation

**Verify**:
```bash
tesseract --version
```

### Step 2: Verify Installation

```bash
cd backend
python verify_installation.py
```

You should see:
```
✓ All dependencies verified!
✓ System is ready to run the LPR application
```

### Step 3: Launch Application

**Windows (Double-click)**:
```
backend/start_lpr_production.bat
```

**Or Command Line**:
```bash
cd backend
streamlit run streamlit_app.py
```

### Step 4: Access UI

Open browser to: **http://localhost:8501**

### Step 5: Start Processing

1. Video path is pre-configured: `LPR_RECOGNITION.mp4`
2. Adjust settings in sidebar (optional)
3. Click **"▶️ Start Processing"**
4. Watch vehicles being detected in real-time!

---

## 🎯 Current Status

✅ **Working**:
- Python 3.12.5 installed
- Streamlit 1.55.0 installed
- OpenCV 4.13.0 installed
- Pytesseract 0.3.13 installed
- NumPy 2.1.3 installed
- Video file exists (14.0 MB)

⚠️ **Needs Installation**:
- Tesseract OCR executable (see Step 1 above)

---

## 📊 What to Expect

Once running, you'll see:
- 🎥 Real-time video processing
- 🚗 Vehicle detection with bounding boxes
- 📝 License plate text recognition
- 📈 Live metrics (FPS, vehicle count, confidence)
- 📋 Detailed vehicle table with timestamps

---

## 🔧 Quick Settings

| Setting | Recommended | Purpose |
|---------|-------------|---------|
| Process Every N Frames | 2 | Balance speed/accuracy |
| Minimum Confidence | 0.40 | Accept most detections |
| Preview Width | 1280px | Good quality display |

---

## ❓ Troubleshooting

### "Tesseract not found" warning
→ Install Tesseract (Step 1 above)

### Slow processing
→ Increase "Process Every N Frames" to 5-10

### Low accuracy
→ Decrease "Process Every N Frames" to 1

### Video not found
→ Upload video through UI or check path in sidebar

---

## 📚 More Information

- **Full Documentation**: `LPR_SYSTEM_README.md`
- **Installation Guide**: `INSTALLATION_GUIDE.md`
- **API Documentation**: `backend/app/depot/gate/lpr.py`

---

**Ready to go? Run `start_lpr_production.bat` and start detecting vehicles!** 🚀
