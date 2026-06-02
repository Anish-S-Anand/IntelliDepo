"""
Data augmentation utilities for YOLO training.

This module provides augmentation transformations including:
- Rotation, scaling, brightness, contrast adjustments
- Mosaic augmentation for small object detection
- Bounding box transformation utilities
"""

from dataclasses import dataclass
from typing import List, Tuple
import numpy as np


@dataclass
class BoundingBox:
    """Normalized bounding box (0-1 coordinates)."""
    x: float  # top-left x
    y: float  # top-left y
    w: float  # width
    h: float  # height
    class_id: int


@dataclass
class AugmentationConfig:
    """Configuration for data augmentation."""
    rotation_range: Tuple[float, float] = (-15, 15)  # degrees
    scale_range: Tuple[float, float] = (0.8, 1.2)
    brightness_range: Tuple[float, float] = (0.8, 1.2)
    contrast_range: Tuple[float, float] = (0.8, 1.2)
    horizontal_flip_prob: float = 0.5
    mosaic_prob: float = 0.5


class AugmentationPipeline:
    """Applies data augmentation to images and bounding boxes."""
    
    def __init__(self, config: AugmentationConfig):
        """
        Initialize augmentation pipeline.
        
        Args:
            config: Augmentation configuration
        """
        self.config = config
    
    def apply_augmentation(
        self,
        image: np.ndarray,
        boxes: List[BoundingBox],
    ) -> Tuple[np.ndarray, List[BoundingBox]]:
        """
        Apply augmentation to image and transform bounding boxes.
        
        Args:
            image: Input image (BGR format)
            boxes: List of bounding boxes
            
        Returns:
            Tuple of (augmented_image, transformed_boxes)
        """
        raise NotImplementedError("Augmentation not yet implemented")
    
    def apply_rotation(
        self,
        image: np.ndarray,
        boxes: List[BoundingBox],
        angle: float,
    ) -> Tuple[np.ndarray, List[BoundingBox]]:
        """Apply rotation and transform boxes."""
        raise NotImplementedError("Rotation not yet implemented")
    
    def apply_scaling(
        self,
        image: np.ndarray,
        boxes: List[BoundingBox],
        scale: float,
    ) -> Tuple[np.ndarray, List[BoundingBox]]:
        """Apply scaling and transform boxes."""
        raise NotImplementedError("Scaling not yet implemented")
    
    def apply_brightness(
        self,
        image: np.ndarray,
        factor: float,
    ) -> np.ndarray:
        """Apply brightness adjustment."""
        raise NotImplementedError("Brightness adjustment not yet implemented")
    
    def apply_contrast(
        self,
        image: np.ndarray,
        factor: float,
    ) -> np.ndarray:
        """Apply contrast adjustment."""
        raise NotImplementedError("Contrast adjustment not yet implemented")
    
    def apply_horizontal_flip(
        self,
        image: np.ndarray,
        boxes: List[BoundingBox],
    ) -> Tuple[np.ndarray, List[BoundingBox]]:
        """Apply horizontal flip and transform boxes."""
        raise NotImplementedError("Horizontal flip not yet implemented")
    
    def apply_mosaic(
        self,
        images: List[np.ndarray],
        boxes_list: List[List[BoundingBox]],
    ) -> Tuple[np.ndarray, List[BoundingBox]]:
        """
        Apply mosaic augmentation (combine 4 images).
        
        Args:
            images: List of 4 images
            boxes_list: List of bounding boxes for each image
            
        Returns:
            Tuple of (mosaic_image, combined_boxes)
        """
        raise NotImplementedError("Mosaic augmentation not yet implemented")
