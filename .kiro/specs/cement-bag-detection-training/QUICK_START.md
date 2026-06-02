# Quick Start - Cement Bag Detection Training

## 🚀 Get Started in 15 Minutes

This quick start guide gets you from zero to a trained model in 15 minutes.

### Prerequisites
```bash
pip install ultralytics torch opencv-python pillow pyyaml sqlalchemy alembic
```

### Step 1: Database Setup (2 minutes)
```bash
cd backend
alembic upgrade head
```

### Step 2: Verify Dataset (1 minute)
```bash
ls backend/tmp/cement_bag_images/
# Should show: data.yaml, README.roboflow.txt, train/, valid/, test/
```

### Step 3: Train Model (10 minutes)
```bash
cd backend
python -m app.depot.vision.train_model_cli \
    --data tmp/cement_bag_images \
    --epochs 20 \
    --batch 8 \
    --device 0
```

### Step 4: Validate Model (1 minute)
```bash
python -m app.depot.vision.validate_model_cli \
    --model app/depot/vision/training_data/weights/trained/cement_bags_training/weights/best.pt \
    --data tmp/cement_bag_images
```

### Step 5: Deploy (1 minute)
```bash
cd app/depot/vision/training_data/weights/production
ln -s ../../trained/cement_bags_training/weights/best.pt current.pt
```

## ✅ Success!

Your model is now trained and deployed. The realtime_counter.py will automatically use it.

## 📊 Expected Results

- **mAP50**: ≥ 0.97 (97% accuracy)
- **Precision**: ≥ 0.96 (96% correct detections)
- **Recall**: ≥ 0.92 (92% of bags detected)
- **Training Time**: ~10 minutes (GPU) or ~2 hours (CPU)

## 🔧 Troubleshooting

**GPU Out of Memory?**
```bash
python -m app.depot.vision.train_model_cli --batch 4
```

**Need More Accuracy?**
```bash
python -m app.depot.vision.train_model_cli --epochs 80
```

## 📚 Next Steps

1. Read `IMPLEMENTATION_GUIDE.md` for full system implementation
2. Review `requirements.md` for all 20 requirements
3. Check `design.md` for architecture details
4. Follow `tasks.md` for complete task list

## 🎯 Production Checklist

Before deploying to production:
- [ ] Model achieves mAP50 ≥ 0.97
- [ ] Tested on edge cases (low light, occlusion)
- [ ] Backup of previous model created
- [ ] Monitoring enabled
- [ ] VIDEO_API_KEY configured in .env
- [ ] Database migrations applied
- [ ] Services restarted

---

**Ready for production! 🎉**
