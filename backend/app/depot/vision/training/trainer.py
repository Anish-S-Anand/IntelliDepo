"""Training system for YOLO models."""
from __future__ import annotations
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional, Dict
import torch
import numpy as np
import random
import time
import logging

logger = logging.getLogger(__name__)

@dataclass
class TrainingConfig:
    """Training hyperparameters."""
    epochs: int = 100
    imgsz: int = 960
    batch: int = 8
    patience: int = 25
    lr0: float = 0.01
    lrf: float = 0.01
    momentum: float = 0.937
    weight_decay: float = 0.0005
    warmup_epochs: int = 3
    device: str = "0"
    seed: int = 42
    augmentation: bool = True
    
@dataclass
class TrainingResult:
    """Training output."""
    model_path: Path
    metrics: Dict[str, float]
    training_time: float
    best_epoch: int
    logs_path: Path
    hyperparameters: TrainingConfig

class TrainingSystem:
    """Manages YOLO model training lifecycle."""
    
    def set_random_seeds(self, seed: int = 42) -> None:
        """Set random seeds for reproducibility."""
        random.seed(seed)
        np.random.seed(seed)
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed(seed)
            torch.cuda.manual_seed_all(seed)
            torch.backends.cudnn.deterministic = True
            torch.backends.cudnn.benchmark = False
        logger.info(f"Random seeds set to {seed}")
    
    def train_model(
        self,
        dataset_path: Path,
        base_model_path: Path,
        hyperparameters: TrainingConfig,
        output_dir: Path,
    ) -> TrainingResult:
        """
        Train a YOLO model from annotated dataset.
        
        Steps:
        1. Set random seeds for reproducibility
        2. Load base model
        3. Configure training parameters
        4. Train with automatic GPU/CPU fallback
        5. Save best model and metrics
        """
        from ultralytics import YOLO
        
        # Set random seeds
        self.set_random_seeds(hyperparameters.seed)
        
        # Automatic GPU/CPU detection and fallback
        if not torch.cuda.is_available():
            logger.warning("CUDA not available. Falling back to CPU training.")
            logger.warning("CPU training will be significantly slower (~10-20x). Consider using a GPU for production training.")
            hyperparameters.device = "cpu"
            # Reduce batch size for CPU to avoid memory issues
            if hyperparameters.batch > 4:
                original_batch = hyperparameters.batch
                hyperparameters.batch = 4
                logger.info(f"Reduced batch size from {original_batch} to {hyperparameters.batch} for CPU training")
        else:
            gpu_count = torch.cuda.device_count()
            logger.info(f"CUDA available with {gpu_count} GPU(s)")
            # Ensure device parameter is valid
            if hyperparameters.device not in ["cpu", "mps"] and not hyperparameters.device.isdigit():
                hyperparameters.device = "0"
        
        # Validate dataset path
        data_yaml = dataset_path / "data.yaml"
        if not data_yaml.exists():
            raise FileNotFoundError(f"Dataset YAML not found: {data_yaml}")
        
        # Validate base model
        if not base_model_path.exists():
            raise FileNotFoundError(f"Base model not found: {base_model_path}")
        
        logger.info(f"Loading base model: {base_model_path}")
        model = YOLO(str(base_model_path))
        
        # Create output directory
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Train with error handling
        start_time = time.time()
        
        try:
            logger.info(f"Starting training with {hyperparameters.epochs} epochs")
            logger.info(f"Dataset: {data_yaml}")
            logger.info(f"Device: {hyperparameters.device}")
            logger.info(f"Batch size: {hyperparameters.batch}")
            
            results = model.train(
                data=str(data_yaml),
                epochs=hyperparameters.epochs,
                imgsz=hyperparameters.imgsz,
                batch=hyperparameters.batch,
                patience=hyperparameters.patience,
                lr0=hyperparameters.lr0,
                lrf=hyperparameters.lrf,
                momentum=hyperparameters.momentum,
                weight_decay=hyperparameters.weight_decay,
                warmup_epochs=hyperparameters.warmup_epochs,
                device=hyperparameters.device,
                project=str(output_dir),
                name="cement_bags_finetuned",
                exist_ok=True,
                verbose=True,
                save=True,
                save_period=10,
                plots=True,
                # Augmentation settings
                hsv_h=0.015,
                hsv_s=0.7,
                hsv_v=0.4,
                degrees=15.0,
                translate=0.1,
                scale=0.5,
                shear=0.0,
                perspective=0.0,
                flipud=0.0,
                fliplr=0.5,
                mosaic=1.0,
                mixup=0.0,
            )
            
            training_time = time.time() - start_time
            
            # Extract metrics from results
            try:
                # Try to get metrics from results object
                if hasattr(results, 'results_dict'):
                    metrics_dict = results.results_dict
                elif hasattr(results, 'metrics'):
                    metrics_dict = results.metrics
                else:
                    metrics_dict = {}
                
                metrics = {
                    "map50": float(metrics_dict.get("metrics/mAP50(B)", 0.0)),
                    "map50_95": float(metrics_dict.get("metrics/mAP50-95(B)", 0.0)),
                    "precision": float(metrics_dict.get("metrics/precision(B)", 0.0)),
                    "recall": float(metrics_dict.get("metrics/recall(B)", 0.0)),
                }
            except Exception as e:
                logger.warning(f"Could not extract metrics: {e}")
                metrics = {
                    "map50": 0.0,
                    "map50_95": 0.0,
                    "precision": 0.0,
                    "recall": 0.0,
                }
            
            # Get best model path
            best_model_path = output_dir / "cement_bags_finetuned" / "weights" / "best.pt"
            
            if not best_model_path.exists():
                # Try last.pt if best.pt doesn't exist
                best_model_path = output_dir / "cement_bags_finetuned" / "weights" / "last.pt"
            
            logger.info(f"Training completed in {training_time:.1f}s")
            logger.info(f"Best model saved to: {best_model_path}")
            logger.info(f"Metrics: mAP50={metrics['map50']:.4f}, Precision={metrics['precision']:.4f}, Recall={metrics['recall']:.4f}")
            
            return TrainingResult(
                model_path=best_model_path,
                metrics=metrics,
                training_time=training_time,
                best_epoch=getattr(results, 'best_epoch', hyperparameters.epochs),
                logs_path=output_dir / "cement_bags_finetuned",
                hyperparameters=hyperparameters
            )
            
        except RuntimeError as e:
            if "out of memory" in str(e).lower():
                # Reduce batch size and retry
                logger.warning(f"GPU OOM detected, reducing batch size from {hyperparameters.batch} to {hyperparameters.batch // 2}")
                hyperparameters.batch = max(1, hyperparameters.batch // 2)
                torch.cuda.empty_cache()
                return self.train_model(dataset_path, base_model_path, hyperparameters, output_dir)
            else:
                logger.error(f"Training failed: {e}")
                raise
