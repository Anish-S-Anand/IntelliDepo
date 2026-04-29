# Production LPR Recognition System

## Overview
This is a production-grade License Plate Recognition (LPR) system built with Streamlit, OpenCV, and Tesseract OCR. The system accurately detects and recognizes vehicle license plates from video feeds.

## Features

### ✅ Removed
- ❌ Cement Bag Detection UI (removed as requested)
- ❌ Old YOLO demo interface

### ✅ New Production Features
- 🚗 **Accurate Vehicle Detection**: Multi-strategy plate detection using Haar Cascades and morphological operations
- 📊 **Real-time Tracking**: Tracks unique vehicles across multiple frames
- 🎯 **High Accuracy OCR**: Multi-scale Tesseract OCR with advanced preprocessing
- 📈 **Production Metrics**: Frame rate, confidence scores, vehicle count
- ✓ **Format Validation**: Validates Indian license plate formats
- 🔄 **Duplicate Handling**: Intelligent merging of duplicate detections
- 📝 **Detailed Logging**: Complete vehicle records with timestamps

## System Requirements

### Software Dependencies
- Python 3.11+
- Tesseract OCR (required for text recognition)
- OpenCV
- Streamlit

### Installation

1. **Install Tesseract OCR** (Windows):
   ```bash
   # Download from: https://github.com/UB-Mannheim/tesseract/wiki
   # Install to: C:\Program Files\Tesseract-OCR\
   ```

2. **Install Python Dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Verify Installation**:
   ```bash
   python -c "import cv2, pytesseract, streamlit; print('All dependencies installed!')"
   ```

## Usage

### Quick Start

#### Option 1: Using Batch Script (Windows)
```bash
cd backend
start_lpr_production.bat
```

#### Option 2: Using PowerShell Script
```powershell
cd backend
.\start_lpr_production.ps1
```

#### Option 3: Direct Streamlit Command
```bash
cd backend
streamlit run app/depot/gate/streamlit_lpr_production.py
```

#### Option 4: Using Main Entry Point
```bash
cd backend
streamlit run streamlit_app.py
```

### Accessing the Application
Once started, open your browser to:
```
http://localhost:8501
```

## Configuration

### Video Source
The default video path is configured to:
```
C:\Users\karte\OneDrive - Fidelis Technology Services Pvt Ltd\Desktop\intelli-platform\LPR_RECOGNITION.mp4
```

You can:
1. Use the default video path
2. Enter a custom video path in the sidebar
3. Upload a video file directly through the UI

### Detection Settings

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| **Process Every N Frames** | 2 | 1-10 | Frame stride for processing (higher = faster, lower accuracy) |
| **Minimum Confidence** | 0.40 | 0.0-1.0 | Minimum OCR confidence threshold |
| **Duplicate Threshold** | 0.85 | 0.0-1.0 | Similarity threshold for merging duplicates |
| **Preview Width** | 1280px | 640-1920 | Frame width for processing and display |

## Technical Details

### Detection Pipeline

1. **Frame Preprocessing**:
   - Bilateral filtering for noise reduction
   - Grayscale conversion
   - CLAHE (Contrast Limited Adaptive Histogram Equalization)

2. **Candidate Detection**:
   - **Strategy 1**: Haar Cascade classifiers
   - **Strategy 2**: Morphological operations + Sobel gradients + contour detection
   - Aspect ratio filtering (2.0-7.0)
   - Area ratio filtering (0.0008-0.08)

3. **OCR Processing**:
   - Multi-scale processing (2.0x, 2.5x, 3.0x)
   - Dual thresholding (Otsu + Adaptive)
   - Morphological cleanup
   - Tesseract OCR with custom configuration

4. **Validation**:
   - Format validation against Indian plate patterns
   - Confidence boosting for valid formats
   - Duplicate detection and merging

### Supported License Plate Formats

- **Standard**: `KA01AB1234`
- **New Format**: `KA01AB1234`
- **Old Format**: `ABC1234`
- **BH Series**: `22BH1234AB`

### Performance Metrics

The system displays:
- **Frames**: Total frames processed
- **Video FPS**: Original video frame rate
- **Processing FPS**: Actual processing speed
- **Unique Vehicles**: Number of distinct vehicles detected
- **High Confidence**: Percentage of detections with ≥85% confidence

## Production Considerations

### ✅ Production-Ready Features
- Error handling and graceful degradation
- Fallback mode when OCR is unavailable
- Progress tracking and status updates
- Comprehensive logging
- Memory-efficient frame processing
- Configurable performance tuning

### 🔒 Security
- Input validation for video paths
- Safe file handling for uploads
- No hardcoded credentials
- Secure temporary file management

### 📊 Monitoring
- Real-time metrics dashboard
- Per-vehicle confidence tracking
- Frame-by-frame detection logs
- Vehicle status indicators (✓ Verified / ⚠ Review)

## Troubleshooting

### Issue: "Tesseract OCR not found"
**Solution**: 
1. Install Tesseract from: https://github.com/UB-Mannheim/tesseract/wiki
2. Set environment variable: `TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe`
3. Restart the application

### Issue: "Could not open video"
**Solution**:
1. Verify the video file exists at the specified path
2. Check file permissions
3. Ensure the video format is supported (MP4, MOV, AVI, MKV)

### Issue: Low detection accuracy
**Solution**:
1. Decrease frame stride (process more frames)
2. Lower minimum confidence threshold
3. Increase preview width for better resolution
4. Ensure good video quality and lighting

### Issue: Slow processing
**Solution**:
1. Increase frame stride (skip more frames)
2. Decrease preview width
3. Close other applications
4. Use a faster machine or GPU acceleration

## API Integration

The system integrates with the FastAPI backend at:
```
POST /depot/gate/lpr/scan
POST /depot/gate/lpr/scan-image
```

See `backend/app/depot/gate/lpr.py` for API documentation.

## File Structure

```
backend/
├── streamlit_app.py                          # Main entry point
├── start_lpr_production.bat                  # Windows batch launcher
├── start_lpr_production.ps1                  # PowerShell launcher
├── app/
│   └── depot/
│       └── gate/
│           ├── streamlit_lpr_production.py   # Production LPR UI
│           ├── streamlit_lpr_demo.py         # Original demo (kept for reference)
│           └── lpr.py                        # FastAPI backend
└── requirements.txt                          # Python dependencies
```

## Development

### Running Tests
```bash
cd backend
pytest tests/test_integration_depot.py::test_gate_vehicle_lpr_flow -v
```

### Code Quality
- Type hints throughout
- Comprehensive error handling
- Production-grade logging
- Clean code architecture

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the logs in the Streamlit console
3. Contact the development team

## License

Proprietary - Intelli Platform

---

**Version**: 1.0.0  
**Last Updated**: 2026-04-29  
**Status**: ✅ Production Ready
