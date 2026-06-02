"""
Train cement bag detection model from dataset.

This script fine-tunes the existing model on the 47-image dataset
to improve accuracy and detection performance.
"""
import sys
from pathlib import Path
import logging

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.depot.vision.training.trainer import TrainingSystem, TrainingConfig

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Train cement bag detection model."""
    
    # Paths
    project_root = Path(__file__).parent
    dataset_path = project_root / "tmp" / "cement_bag_images"
    base_model_path = project_root / "best_cement_bags_2025-05-29.pt"
    output_dir = project_root / "app" / "depot" / "vision" / "training_data" / "weights" / "trained"
    
    # Check if dataset exists
    if not dataset_path.exists():
        logger.error(f"Dataset not found: {dataset_path}")
        logger.info("Please ensure the cement bag dataset is in backend/tmp/cement_bag_images/")
        return 1
    
    # Check if base model exists
    if not base_model_path.exists():
        logger.error(f"Base model not found: {base_model_path}")
        logger.info("Please ensure best_cement_bags_2025-05-29.pt is in the backend/ directory")
        return 1
    
    # Training configuration
    config = TrainingConfig(
        epochs=100,          # More epochs for better convergence
        imgsz=960,           # Higher resolution for better detection
        batch=8,             # Adjust based on GPU memory
        patience=25,         # Early stopping patience
        lr0=0.01,            # Initial learning rate
        lrf=0.01,            # Final learning rate
        momentum=0.937,      # SGD momentum
        weight_decay=0.0005, # Weight decay for regularization
        warmup_epochs=3,     # Warmup epochs
        device="0",          # GPU 0 (use "cpu" if no GPU)
        seed=42,             # Random seed for reproducibility
        augmentation=True,   # Enable data augmentation
    )
    
    logger.info("="*80)
    logger.info("CEMENT BAG DETECTION MODEL TRAINING")
    logger.info("="*80)
    logger.info(f"Dataset: {dataset_path}")
    logger.info(f"Base Model: {base_model_path}")
    logger.info(f"Output Directory: {output_dir}")
    logger.info(f"Configuration:")
    logger.info(f"  - Epochs: {config.epochs}")
    logger.info(f"  - Image Size: {config.imgsz}")
    logger.info(f"  - Batch Size: {config.batch}")
    logger.info(f"  - Device: {config.device}")
    logger.info("="*80)
    
    # Create trainer
    trainer = TrainingSystem()
    
    try:
        # Train model
        logger.info("Starting training...")
        result = trainer.train_model(
            dataset_path=dataset_path,
            base_model_path=base_model_path,
            hyperparameters=config,
            output_dir=output_dir,
        )
        
        # Print results
        logger.info("="*80)
        logger.info("TRAINING COMPLETED SUCCESSFULLY!")
        logger.info("="*80)
        logger.info(f"Model Path: {result.model_path}")
        logger.info(f"Training Time: {result.training_time:.1f} seconds ({result.training_time/60:.1f} minutes)")
        logger.info(f"Best Epoch: {result.best_epoch}")
        logger.info(f"\nMetrics:")
        logger.info(f"  - mAP50:     {result.metrics['map50']:.4f} (target: ≥0.97)")
        logger.info(f"  - mAP50-95:  {result.metrics['map50_95']:.4f}")
        logger.info(f"  - Precision: {result.metrics['precision']:.4f} (target: ≥0.96)")
        logger.info(f"  - Recall:    {result.metrics['recall']:.4f} (target: ≥0.92)")
        logger.info(f"\nLogs and plots saved to: {result.logs_path}")
        logger.info("="*80)
        
        # Check if model meets production thresholds
        meets_threshold = (
            result.metrics['map50'] >= 0.97 and
            result.metrics['precision'] >= 0.96 and
            result.metrics['recall'] >= 0.92
        )
        
        if meets_threshold:
            logger.info("✓ Model meets production accuracy thresholds!")
            logger.info("  Ready for deployment to production.")
        else:
            logger.warning("⚠ Model does not meet all production thresholds.")
            logger.warning("  Consider training for more epochs or adjusting hyperparameters.")
        
        logger.info("\nNext steps:")
        logger.info("1. Validate the model: python validate_cement_bags.py")
        logger.info("2. Deploy to production: Copy model to production weights directory")
        logger.info("3. Update YOLO_WEIGHTS in .env to point to the new model")
        
        return 0
        
    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        return 1

if __name__ == "__main__":
    sys.exit(main())
