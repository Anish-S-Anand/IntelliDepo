"""
Validate trained cement bag detection model.

This script validates the trained model against the test dataset
and checks if it meets production accuracy thresholds.
"""
import sys
from pathlib import Path
import logging

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Validate cement bag detection model."""
    from ultralytics import YOLO
    
    # Paths
    project_root = Path(__file__).parent
    model_path = project_root / "app" / "depot" / "vision" / "training_data" / "weights" / "trained" / "cement_bags_finetuned" / "weights" / "best.pt"
    dataset_path = project_root / "tmp" / "cement_bag_images"
    data_yaml = dataset_path / "data.yaml"
    
    # Check if model exists
    if not model_path.exists():
        logger.error(f"Model not found: {model_path}")
        logger.info("Please train the model first: python train_cement_bags.py")
        return 1
    
    # Check if dataset exists
    if not data_yaml.exists():
        logger.error(f"Dataset not found: {data_yaml}")
        return 1
    
    logger.info("="*80)
    logger.info("CEMENT BAG DETECTION MODEL VALIDATION")
    logger.info("="*80)
    logger.info(f"Model: {model_path}")
    logger.info(f"Dataset: {dataset_path}")
    logger.info("="*80)
    
    try:
        # Load model
        logger.info("Loading model...")
        model = YOLO(str(model_path))
        
        # Run validation
        logger.info("Running validation on test dataset...")
        results = model.val(
            data=str(data_yaml),
            split="test",
            imgsz=960,
            batch=8,
            conf=0.001,
            iou=0.6,
            verbose=True,
        )
        
        # Extract metrics
        map50 = float(results.box.map50)
        map50_95 = float(results.box.map)
        precision = float(results.box.mp)
        recall = float(results.box.mr)
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        # Print results
        logger.info("="*80)
        logger.info("VALIDATION RESULTS")
        logger.info("="*80)
        logger.info(f"Metrics:")
        logger.info(f"  - mAP50:     {map50:.4f} (threshold: ≥0.97)")
        logger.info(f"  - mAP50-95:  {map50_95:.4f}")
        logger.info(f"  - Precision: {precision:.4f} (threshold: ≥0.96)")
        logger.info(f"  - Recall:    {recall:.4f} (threshold: ≥0.92)")
        logger.info(f"  - F1-Score:  {f1_score:.4f}")
        logger.info("="*80)
        
        # Check thresholds
        passed = (
            map50 >= 0.97 and
            precision >= 0.96 and
            recall >= 0.92
        )
        
        if passed:
            logger.info("✓ VALIDATION PASSED")
            logger.info("  Model meets all production accuracy thresholds!")
            logger.info("  Ready for deployment.")
        else:
            logger.warning("✗ VALIDATION FAILED")
            if map50 < 0.97:
                logger.warning(f"  - mAP50 {map50:.4f} below threshold 0.97")
            if precision < 0.96:
                logger.warning(f"  - Precision {precision:.4f} below threshold 0.96")
            if recall < 0.92:
                logger.warning(f"  - Recall {recall:.4f} below threshold 0.92")
            logger.warning("  Consider retraining with more epochs or different hyperparameters.")
        
        logger.info("\nNext steps:")
        if passed:
            logger.info("1. Deploy model to production:")
            logger.info(f"   cp {model_path} backend/app/depot/vision/training_data/weights/production/current.pt")
            logger.info("2. Update .env: YOLO_WEIGHTS=backend/app/depot/vision/training_data/weights/production/current.pt")
            logger.info("3. Restart backend server")
        else:
            logger.info("1. Retrain with more epochs: python train_cement_bags.py")
            logger.info("2. Adjust hyperparameters in training script")
            logger.info("3. Validate again after retraining")
        
        return 0 if passed else 1
        
    except Exception as e:
        logger.error(f"Validation failed: {e}", exc_info=True)
        return 1

if __name__ == "__main__":
    sys.exit(main())
