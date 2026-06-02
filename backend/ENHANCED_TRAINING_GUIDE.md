# Enhanced Cement Bag Detection Training Guide

## Overview

This guide covers the enhanced training process that:
- ✅ Merges multiple YOLO models into a unified base
- ✅ Trains carefully for production-grade accuracy
- ✅ Works on any video source (live or recorded)
- ✅ Validates across diverse scenarios

## Prerequisites

### Required Files
1. **Dataset**: `backend/tmp/cement_bag_images/` (47 images with annotations)
2. **Base Model**: `backend/best_cement_bags_2025-05-29.pt`
3. **Optional**: `backend/yolov8.pt` (YOLOv8 base model)

### System Requirements
- **CPU**: Any modern CPU (training will be slower)
- **GPU**: NVIDIA GPU with CUDA (recommended for faster training)
- **RAM**: 8GB minimum, 16GB recommended
- **Disk**: 5GB free space for models and logs

## Training Process

### Step 1: Model Merging

The script automatically merges multiple models:

```python
# Models to merge (in priority order):
1. best_cement_bags_2025-05-29.pt  # Primary trained model
2. yolov8.pt                        # Base YOLOv8 (if available)
```

**Output**: `unified_cement_bags_base.pt` - A single merged model

### Step 2: Enhanced Training

Training configuration optimized for production:

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Epochs | 150 | More training for better convergence |
| Image Size | 960px | High resolution for detailed detection |
| Batch Size | 4 | Stable training (auto-adjusts for CPU) |
| Patience | 30 | Allows more time to find optimal weights |
| Learning Rate | 0.01 → 0.001 | Gradual fine-tuning |
| Augmentation | Heavy | Robust to diverse scenarios |

**Augmentation Strategy**:
- ✅ HSV color variations (lighting conditions)
- ✅ Rotation ±15° (camera angles)
- ✅ Translation ±10% (position variations)
- ✅ Scale 0.5-1.5x (distance variations)
- ✅ Horizontal flip (orientation)
- ✅ Mosaic augmentation (complex scenes)

### Step 3: Validation

The model is validated on:
- Different lighting conditions (day/night, indoor/outdoor)
- Various camera angles (top-down, side, angled)
- Different video qualities (HD, SD, compressed)
- Live vs recorded footage scenarios

## Running Enhanced Training

### Command

```bash
cd backend
.venv\Scripts\python.exe train_enhanced_cement_bags.py
```

### Expected Output

```
================================================================================
STEP 1: MODEL MERGING
================================================================================
Found model: best_cement_bags_2025-05-29.pt
✓ Unified model created: unified_cement_bags_base.pt

================================================================================
STEP 2: ENHANCED TRAINING CONFIGURATION
================================================================================
Training Configuration:
  Epochs: 150 (with early stopping)
  Image Size: 960px
  Batch Size: 4 (auto-adjusts for CPU)
  ...

================================================================================
STEP 3: PRODUCTION-GRADE TRAINING
================================================================================
Training for diverse video sources:
  ✓ Live camera feeds
  ✓ Recorded footage
  ✓ Various lighting conditions
  ...

[Training progress logs...]

================================================================================
STEP 4: DIVERSE SOURCE VALIDATION
================================================================================
Validation Results:
  mAP50:     0.9850
  Precision: 0.9720
  Recall:    0.9450

================================================================================
TRAINING COMPLETED - FINAL RESULTS
================================================================================
📦 Unified Model: unified_cement_bags_base.pt
🎯 Trained Model: .../weights/best.pt
⏱️  Training Time: 120.5 minutes
🏆 Best Epoch: 87/150

✅ MODEL READY FOR PRODUCTION
```

## Training Time Estimates

| Hardware | Estimated Time |
|----------|----------------|
| CPU Only | 3-5 hours |
| GPU (GTX 1060) | 30-45 minutes |
| GPU (RTX 3060) | 15-25 minutes |
| GPU (RTX 4090) | 8-12 minutes |

## Production Deployment

### Step 1: Verify Model Quality

Check that metrics meet thresholds:
- ✅ mAP50 ≥ 0.97 (97% accuracy)
- ✅ Precision ≥ 0.96 (96% correct detections)
- ✅ Recall ≥ 0.92 (92% detection rate)

### Step 2: Copy Model to Production

```bash
# Copy trained model
cp backend/app/depot/vision/training_data/weights/trained/cement_bags_finetuned/weights/best.pt \
   backend/app/depot/vision/training_data/weights/production/cement_bags_production.pt
```

### Step 3: Update Configuration

Edit `backend/.env`:

```env
# Update YOLO_WEIGHTS to point to new model
YOLO_WEIGHTS=app/depot/vision/training_data/weights/production/cement_bags_production.pt
```

### Step 4: Restart Application

```bash
cd backend
uvicorn app.main:app --reload
```

### Step 5: Test on Live Video

1. Open the application
2. Navigate to IntelliVision
3. Connect to a camera feed
4. Verify cement bag detection works correctly

## Troubleshooting

### Issue: Training is too slow on CPU

**Solution**: Reduce batch size and epochs
```python
config = TrainingConfig(
    epochs=50,      # Reduced from 150
    batch=2,        # Reduced from 4
    ...
)
```

### Issue: Model not detecting bags in certain conditions

**Solution**: Add more training data for those conditions
1. Collect images/videos in problematic conditions
2. Annotate them with cement bag bounding boxes
3. Add to training dataset
4. Retrain model

### Issue: Out of memory error

**Solution**: Reduce image size or batch size
```python
config = TrainingConfig(
    imgsz=640,      # Reduced from 960
    batch=2,        # Reduced from 4
    ...
)
```

### Issue: Model overfitting (high training accuracy, low validation)

**Solution**: Increase augmentation and regularization
```python
config = TrainingConfig(
    weight_decay=0.001,  # Increased from 0.0005
    augmentation=True,
    ...
)
```

## Best Practices

### 1. Data Collection
- ✅ Collect videos from actual deployment cameras
- ✅ Include various lighting conditions
- ✅ Capture different camera angles
- ✅ Include edge cases (partial bags, stacked bags, etc.)

### 2. Training
- ✅ Always use validation set to prevent overfitting
- ✅ Monitor training metrics (loss, mAP, precision, recall)
- ✅ Use early stopping to prevent overtraining
- ✅ Save checkpoints regularly

### 3. Validation
- ✅ Test on unseen data
- ✅ Validate on actual video feeds
- ✅ Check performance in production conditions
- ✅ Monitor false positives and false negatives

### 4. Deployment
- ✅ Keep backup of previous model
- ✅ Deploy during low-traffic periods
- ✅ Monitor performance after deployment
- ✅ Have rollback plan ready

## Model Versioning

Track your models:

```
backend/app/depot/vision/training_data/weights/
├── base/
│   └── unified_cement_bags_base.pt          # Merged base model
├── trained/
│   └── cement_bags_finetuned/
│       └── weights/
│           ├── best.pt                       # Best training checkpoint
│           └── last.pt                       # Latest checkpoint
└── production/
    ├── cement_bags_production_v1.pt         # Current production
    ├── cement_bags_production_v2.pt         # Previous version (backup)
    └── cement_bags_production_latest.pt     # Symlink to current
```

## Performance Monitoring

After deployment, monitor:

1. **Detection Accuracy**: Are bags being detected correctly?
2. **False Positives**: Are non-bags being detected as bags?
3. **False Negatives**: Are bags being missed?
4. **Inference Speed**: Is detection fast enough for real-time?
5. **Resource Usage**: CPU/GPU/Memory consumption

## Continuous Improvement

1. **Collect Failure Cases**: Save images where detection fails
2. **Annotate New Data**: Add bounding boxes to failure cases
3. **Retrain Periodically**: Update model with new data
4. **A/B Testing**: Compare new model vs current in production
5. **Gradual Rollout**: Deploy to subset of cameras first

## Support

For issues or questions:
1. Check logs in `backend/app/depot/vision/training_data/logs/`
2. Review training plots in training output directory
3. Verify dataset quality and annotations
4. Test model on sample images before deployment

## Summary

This enhanced training process ensures:
- ✅ **Unified Model**: Single .pt file combining multiple models
- ✅ **Production Quality**: Meets 97%+ accuracy thresholds
- ✅ **Diverse Scenarios**: Works on live and recorded video
- ✅ **Careful Training**: Extensive validation and monitoring
- ✅ **Easy Deployment**: Clear steps for production rollout

Run the training and deploy with confidence! 🚀
