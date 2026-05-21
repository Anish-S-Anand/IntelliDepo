# Implementation Plan: Bag Counting Detection Enhancement

## Overview

This implementation plan breaks down the bag counting detection enhancement feature into executable tasks. The feature enhances the IntelliDepo vision system with improved detection accuracy, training dataset integration, action categorization, counting line geometry validation, exclusion zone management, multi-camera coordination, and comprehensive export capabilities.

The implementation is organized into 8 phases over 16 weeks, with each task building incrementally on previous work. All tasks reference specific requirements from the requirements document for traceability.

**Key Components:**
- 9 new database tables for metrics, datasets, model versions, actions, zones, and multi-camera coordination
- 30+ API endpoints for detection monitoring, training, action categorization, and export
- 47 correctness properties for property-based testing
- Visual quality scoring system to reduce false positives
- Action categorization with 7 categories (loading, unloading, stacking, etc.)
- Counting line geometry validation with perspective correction
- Multi-camera coordination with duplicate suppression

## Tasks

### Phase 1: Database Schema & Core Infrastructure

- [ ] 1. Create database schema migrations for all new tables
  - [-] 1.1 Create migration for DetectionMetrics table
    - Add table with fields: id, run_id, precision, recall, f1_score, true_positives, false_positives, false_negatives, confidence_distribution (JSONB), created_at
    - Add foreign key constraint to depot_detection_runs
    - Add indexes on run_id and created_at
    - _Requirements: 1.1_
  
  - [-] 1.2 Create migration for TrainingDataset table
    - Add table with fields: id, name (unique), source, size_images, size_annotations, annotation_format, scene_conditions (JSONB), quality_score, is_active, created_at
    - Add unique constraint on name
    - Add indexes on is_active and annotation_format
    - _Requirements: 2.1, 2.2_
  
  - [-] 1.3 Create migration for ModelVersion table
    - Add table with fields: id, version_name (unique), model_id, dataset_id, weights_path, hyperparameters (JSONB), performance_metrics (JSONB), deployed_at, is_active, created_at
    - Add foreign key constraints to depot_detection_models and depot_training_datasets
    - Add indexes on model_id, is_active, and deployed_at
    - _Requirements: 13.1, 13.2_
  
  - [-] 1.4 Create migration for ActionEvent table
    - Add table with fields: id, session_id, track_id, action_category, start_time, end_time, duration_seconds, avg_confidence, zone, created_at
    - Add foreign key constraint to depot_count_sessions
    - Add indexes on session_id, action_category, and start_time
    - _Requirements: 4.5_
  
  - [-] 1.5 Create migration for ExclusionZone table
    - Add table with fields: id, camera_id, name, polygon_coords (JSONB), zone_type, is_temporary, expires_at, created_at
    - Add foreign key constraint to depot_cameras
    - Add indexes on camera_id, zone_type, and is_temporary
    - _Requirements: 6.1, 6.5_
  
  - [-] 1.6 Create migration for CountingLine table
    - Add table with fields: id, camera_id, y_coordinate, angle_degrees, is_valid, validation_errors (JSONB), calibration_matrix (JSONB), created_at
    - Add foreign key constraint to depot_cameras
    - Add indexes on camera_id and is_valid
    - _Requirements: 5.1, 10.1_
  
  - [-] 1.7 Create migration for CameraOverlap table
    - Add table with fields: id, camera_a_id, camera_b_id, overlap_region (JSONB), overlap_percentage, created_at
    - Add foreign key constraints to depot_cameras
    - Add unique constraint on (camera_a_id, camera_b_id)
    - Add indexes on both camera_id fields
    - _Requirements: 12.1_
  
  - [-] 1.8 Create migration for GlobalTrackingRegistry table
    - Add table with fields: id, bag_id (unique), first_seen_camera_id, first_seen_at, last_seen_camera_id, last_seen_at, is_counted, counted_at, counted_by_camera_id, visual_signature (JSONB), created_at
    - Add foreign key constraints to depot_cameras
    - Add indexes on bag_id, is_counted, and first_seen_at
    - _Requirements: 12.2, 12.3_
  
  - [ ] 1.9 Create migration for FalseDetectionLog table
    - Add table with fields: id, run_id, frame_number, detection_type, bbox_x, bbox_y, bbox_w, bbox_h, confidence, expected_class, detected_class, notes, created_at
    - Add foreign key constraint to depot_detection_runs
    - Add indexes on run_id, detection_type, and frame_number
    - _Requirements: 1.3, 1.4_

- [ ] 2. Extend existing models with new fields
  - [~] 2.1 Extend DetectionRun model
    - Add fields: precision, recall, f1_score, true_positives, false_positives, false_negatives, avg_visual_quality_score, suppressed_by_quality
    - Update Pydantic model and SQLAlchemy model
    - _Requirements: 1.1, 14.1_
  
  - [~] 2.2 Extend DetectedObject model
    - Add fields: visual_quality_score, suppressed_by_quality, suppressed_by_exclusion_zone, exclusion_zone_id, action_category
    - Update Pydantic model and SQLAlchemy model
    - _Requirements: 14.1, 6.2, 4.1_

- [ ] 3. Create Pydantic models for new entities
  - [~] 3.1 Create TrainingDataset Pydantic models
    - Create TrainingDatasetCreate, TrainingDatasetUpdate, TrainingDatasetResponse models
    - Include validation for annotation_format enum (yolo, coco, pascal_voc)
    - _Requirements: 2.1_
  
  - [~] 3.2 Create ModelVersion Pydantic models
    - Create ModelVersionCreate, ModelVersionUpdate, ModelVersionResponse models
    - Include validation for semantic versioning format
    - _Requirements: 13.1_
  
  - [~] 3.3 Create ActionEvent Pydantic models
    - Create ActionEventCreate, ActionEventResponse models
    - Include validation for action_category enum
    - _Requirements: 4.1_
  
  - [~] 3.4 Create ExclusionZone Pydantic models
    - Create ExclusionZoneCreate, ExclusionZoneUpdate, ExclusionZoneResponse models
    - Include validation for polygon_coords (3-8 vertices)
    - _Requirements: 6.1_
  
  - [~] 3.5 Create CountingLine Pydantic models
    - Create CountingLineCreate, CountingLineUpdate, CountingLineResponse models
    - Include validation for y_coordinate range [0.0, 1.0]
    - _Requirements: 5.1_

- [~] 4. Checkpoint - Verify database migrations and models
  - Run migrations on test database
  - Verify all foreign key constraints work correctly
  - Test model serialization/deserialization
  - Ensure all tests pass, ask the user if questions arise.


### Phase 2: Detection Accuracy & Visual Quality Scoring

- [ ] 5. Implement visual quality scoring system
  - [~] 5.1 Create visual quality scorer module
    - Create `backend/app/depot/vision/visual_quality.py`
    - Implement color distribution analysis using HSV histogram
    - Implement edge density computation using Canny edge detection
    - Implement saturation measurement
    - Implement aspect ratio validation against expected bag dimensions
    - Compute weighted quality score [0.0-1.0]
    - _Requirements: 14.1_
  
  - [ ]* 5.2 Write property test for visual quality score computation
    - **Property 39: Visual Quality Score Computation**
    - **Validates: Requirements 14.1**
    - Test that quality score is weighted combination of color, edge, saturation, aspect ratio
    - Test that score is always in range [0.0, 1.0]
  
  - [~] 5.3 Implement lighting condition detection
    - Add function to detect lighting conditions (daylight, warehouse, low_light)
    - Use average brightness and histogram analysis
    - _Requirements: 14.3_
  
  - [~] 5.4 Implement adaptive quality thresholds
    - Apply lighting-specific thresholds: daylight → 0.20, warehouse → 0.15, low_light → 0.10
    - Increase threshold by 0.10 for reflection zones
    - _Requirements: 14.3, 14.4_
  
  - [ ]* 5.5 Write property tests for adaptive thresholds
    - **Property 41: Adaptive Quality Threshold**
    - **Validates: Requirements 14.3**
    - **Property 42: Reflection Zone Stricter Validation**
    - **Validates: Requirements 14.4**
  
  - [~] 5.6 Integrate visual quality scoring into detection pipeline
    - Modify detection.py to compute quality score for each detection
    - Suppress detections with quality score < threshold
    - Store quality scores in DetectedObject model
    - Log suppressed detections
    - _Requirements: 14.2, 14.5_
  
  - [ ]* 5.7 Write property tests for quality-based suppression
    - **Property 40: Quality-Based Detection Suppression**
    - **Validates: Requirements 14.2**
    - **Property 43: Suppressed Detection Logging**
    - **Validates: Requirements 14.5**

- [ ] 6. Implement metrics computation system
  - [~] 6.1 Create metrics computer module
    - Create `backend/app/depot/vision/metrics.py`
    - Implement precision, recall, F1-score computation
    - Implement confidence distribution histogram generation
    - Implement true positive/false positive/false negative counting
    - _Requirements: 1.1, 1.2_
  
  - [ ]* 6.2 Write property test for metrics computation
    - **Property 1: Metrics Computation Correctness**
    - **Validates: Requirements 1.1**
    - Test precision = TP/(TP+FP), recall = TP/(TP+FN), F1 = 2×(P×R)/(P+R)
  
  - [~] 6.3 Create API endpoint for computing metrics
    - POST /depot/vision/detection/runs/{run_id}/compute-metrics
    - Accept ground truth annotations in request body
    - Compute and store metrics in DetectionMetrics table
    - Return computed metrics in response
    - _Requirements: 1.1_
  
  - [~] 6.4 Create API endpoint for retrieving metrics
    - GET /depot/vision/detection/runs/{run_id}/metrics
    - Return precision, recall, F1-score, confidence distribution
    - Include true positives, false positives, false negatives counts
    - _Requirements: 1.2_

- [ ] 7. Implement false detection logging
  - [~] 7.1 Create false detection logging functions
    - Add function to log false positive detections
    - Add function to log false negative detections
    - Store frame reference, bbox coordinates, confidence, class labels
    - _Requirements: 1.3, 1.4_
  
  - [ ]* 7.2 Write property test for false detection logging
    - **Property 2: False Detection Logging Completeness**
    - **Validates: Requirements 1.3**
    - Test that log entries contain all required fields
  
  - [~] 7.3 Create API endpoint for logging false detections
    - POST /depot/vision/detection/false-detections
    - Accept detection_type (false_positive, false_negative), frame_number, bbox, confidence, notes
    - Store in FalseDetectionLog table
    - _Requirements: 1.3_
  
  - [~] 7.4 Create API endpoint for retrieving false detections
    - GET /depot/vision/detection/false-detections
    - Support filtering by run_id, detection_type, confidence range
    - Return paginated results
    - _Requirements: 1.3_

- [ ] 8. Implement discrepancy reporting
  - [~] 8.1 Create discrepancy report generator
    - Add function to compare manifest expected counts vs actual counts
    - Compute discrepancies by class (bags, boxes, pallets, cartons)
    - Categorize discrepancies (false positives, false negatives, correct detections)
    - _Requirements: 1.5_
  
  - [ ]* 8.2 Write property test for discrepancy report accuracy
    - **Property 3: Discrepancy Report Accuracy**
    - **Validates: Requirements 1.5**
    - Test that discrepancies are correctly computed for each class

- [~] 9. Checkpoint - Verify detection accuracy features
  - Test visual quality scoring on sample images
  - Verify metrics computation with known ground truth
  - Test false detection logging and retrieval
  - Ensure all tests pass, ask the user if questions arise.


### Phase 3: Training Dataset Integration & Model Versioning

- [ ] 10. Implement dataset registry system
  - [~] 10.1 Create dataset registry module
    - Create `backend/app/depot/vision/dataset_registry.py`
    - Implement dataset cataloging with metadata storage
    - Support YOLO, COCO, Pascal VOC annotation formats
    - Track scene conditions (lighting, bag types, weather)
    - _Requirements: 2.1_
  
  - [~] 10.2 Create API endpoint for registering datasets
    - POST /depot/vision/training/datasets
    - Accept name, source, size_images, size_annotations, annotation_format, scene_conditions
    - Validate required fields and store in TrainingDataset table
    - _Requirements: 2.1_
  
  - [ ]* 10.3 Write property test for dataset annotation validation
    - **Property 4: Dataset Annotation Validation**
    - **Validates: Requirements 2.2**
    - Test that datasets with all required fields are accepted
    - Test that datasets missing fields are rejected
  
  - [~] 10.4 Create API endpoint for listing datasets
    - GET /depot/vision/training/datasets
    - Support filtering by scene_type, lighting_condition, bag_type
    - Return paginated results with metadata
    - _Requirements: 2.4_
  
  - [ ]* 10.5 Write property test for dataset filtering
    - **Property 5: Dataset Filtering Correctness**
    - **Validates: Requirements 2.4**
    - Test that filtered results match all specified criteria

- [ ] 11. Implement dataset validation system
  - [~] 11.1 Create dataset validator module
    - Create `backend/app/depot/vision/dataset_validator.py`
    - Implement bounding box dimension validation (non-zero width/height)
    - Implement bounding box boundary validation (within image bounds)
    - Implement duplicate annotation detection (IoU > 0.90)
    - Compute size/aspect ratio distribution statistics
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [ ]* 11.2 Write property tests for bbox validation
    - **Property 27: Bounding Box Dimension Validation**
    - **Validates: Requirements 11.1**
    - **Property 28: Bounding Box Boundary Validation**
    - **Validates: Requirements 11.2**
    - **Property 29: Bounding Box Distribution Computation**
    - **Validates: Requirements 11.3**
    - **Property 30: Duplicate Annotation Detection**
    - **Validates: Requirements 11.4**
  
  - [~] 11.3 Create API endpoint for dataset validation
    - POST /depot/vision/training/datasets/{dataset_id}/validate
    - Run all validation checks on dataset annotations
    - Return validation report with flagged annotations
    - Store quality_score in TrainingDataset table
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [~] 11.4 Create annotation review interface endpoint
    - GET /depot/vision/training/datasets/{dataset_id}/annotations
    - Return annotations with validation flags
    - Support filtering by validation status (valid, invalid, flagged)
    - _Requirements: 11.5_

- [ ] 12. Implement model versioning system
  - [~] 12.1 Create model version manager module
    - Create `backend/app/depot/vision/model_versioning.py`
    - Implement semantic version ID generation (v1.0.0, v1.1.0, etc.)
    - Track dataset-to-model lineage
    - Store hyperparameters and performance metrics
    - _Requirements: 13.1, 13.2, 2.5_
  
  - [ ]* 12.2 Write property tests for model versioning
    - **Property 6: Model-Dataset Lineage Preservation**
    - **Validates: Requirements 2.5**
    - **Property 35: Model Version ID Uniqueness**
    - **Validates: Requirements 13.1**
    - **Property 36: Model Deployment Logging**
    - **Validates: Requirements 13.2**
  
  - [~] 12.3 Create API endpoint for creating model versions
    - POST /depot/vision/training/models/{model_id}/versions
    - Accept version_name, dataset_id, weights_path, hyperparameters, performance_metrics
    - Store in ModelVersion table
    - _Requirements: 13.1, 13.2_
  
  - [~] 12.4 Create API endpoint for listing model versions
    - GET /depot/vision/training/models/{model_id}/versions
    - Return all versions with performance metrics
    - Include comparison table data
    - _Requirements: 13.4_
  
  - [ ]* 12.5 Write property tests for model comparison
    - **Property 37: Model Comparison Table Completeness**
    - **Validates: Requirements 13.4**
    - **Property 38: Model Performance History Tracking**
    - **Validates: Requirements 13.5**
  
  - [~] 12.6 Create API endpoint for deploying model versions
    - POST /depot/vision/training/models/{model_id}/versions/{version_id}/deploy
    - Set is_active=true for specified version
    - Set is_active=false for all other versions
    - Update detection pipeline to use new model
    - Log deployment timestamp
    - _Requirements: 13.2_
  
  - [~] 12.7 Create API endpoint for rolling back model versions
    - POST /depot/vision/training/models/{model_id}/versions/{version_id}/rollback
    - Deploy specified previous version
    - Log rollback event
    - _Requirements: 13.3_

- [ ] 13. Enhance training pipeline
  - [~] 13.1 Implement data augmentation
    - Modify training.py to support rotation (±15°), brightness (±30%), scaling (0.8-1.2x)
    - Add augmentation configuration parameters
    - _Requirements: 3.2_
  
  - [~] 13.2 Implement hyperparameter logging
    - Log learning rate, batch size, epochs, confidence threshold
    - Store in ModelVersion.hyperparameters JSONB field
    - _Requirements: 3.3_
  
  - [ ]* 13.3 Write property test for hyperparameter logging
    - **Property 7: Training Hyperparameter Logging**
    - **Validates: Requirements 3.3**
    - Test that all hyperparameters are logged and retrievable
  
  - [~] 13.4 Implement validation reporting
    - Generate mAP50, precision-recall curves, loss curves after training
    - Store in ModelVersion.performance_metrics JSONB field
    - _Requirements: 3.4_
  
  - [~] 13.5 Implement A/B testing support
    - Allow multiple model versions to run in parallel on same stream
    - Store results separately for comparison
    - _Requirements: 3.5_
  
  - [ ]* 13.6 Write property test for parallel model execution
    - **Property 8: Parallel Model Execution Independence**
    - **Validates: Requirements 3.5**
    - Test that models produce independent results

- [~] 14. Checkpoint - Verify training and versioning features
  - Test dataset registration and validation
  - Verify model version creation and deployment
  - Test A/B testing with multiple models
  - Ensure all tests pass, ask the user if questions arise.


### Phase 4: Action Categorization & Timeline

- [ ] 15. Implement action categorization system
  - [~] 15.1 Create action categorizer module
    - Create `backend/app/depot/vision/action_categorizer.py`
    - Implement direction vector analysis for line crossing
    - Implement zone context determination
    - Implement dwell time calculation
    - Implement worker proximity detection
    - Implement batch transfer detection (≥3 bags with coordinated movement)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [~] 15.2 Implement action categorization logic
    - Categorize loading (inbound crossing in loading zone)
    - Categorize unloading (outbound crossing)
    - Categorize stacking (upward movement, y-coordinate decreasing)
    - Categorize unstacking (downward movement, y-coordinate increasing)
    - Categorize idle (velocity < 0.1 for >5s)
    - Categorize quality_inspection (idle with worker nearby)
    - Categorize batch_transfer (multiple bags moving together)
    - Categorize movement (default)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ]* 15.3 Write property test for action categorization
    - **Property 9: Action Categorization Correctness**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - Test that action categories match categorization rules
  
  - [~] 15.4 Integrate action categorization into tracking pipeline
    - Modify tracking.py to call action categorizer for each tracked object
    - Store action_category in DetectedObject model
    - Record action transitions in ActionEvent table
    - _Requirements: 4.1_

- [ ] 16. Implement action timeline storage
  - [~] 16.1 Create action event recorder
    - Add function to record action transitions
    - Store session_id, track_id, action_category, start_time, end_time, duration_seconds, avg_confidence, zone
    - Compute duration when action ends
    - _Requirements: 4.5_
  
  - [ ]* 16.2 Write property test for action timeline completeness
    - **Property 10: Action Timeline Completeness**
    - **Validates: Requirements 4.5**
    - Test that timeline contains all action transitions with required fields
  
  - [~] 16.3 Create API endpoint for retrieving action timeline
    - GET /depot/vision/counting/sessions/{session_id}/actions
    - Return action events with timestamps and durations
    - Support filtering by action_category
    - _Requirements: 4.5_

- [ ] 17. Implement action timeline visualization
  - [~] 17.1 Create timeline visualizer module
    - Create `backend/app/depot/vision/timeline_visualizer.py`
    - Generate timeline visualization showing action transitions over time
    - Display duration of each action phase
    - Highlight segments with low confidence (<0.60)
    - Annotate mismatch alerts on timeline
    - _Requirements: 15.1, 15.2, 15.3, 15.4_
  
  - [ ]* 17.2 Write property tests for timeline visualization
    - **Property 44: Timeline Visualization Completeness**
    - **Validates: Requirements 15.1**
    - **Property 45: Action Duration Computation**
    - **Validates: Requirements 15.2**
    - **Property 46: Low Confidence Timeline Highlighting**
    - **Validates: Requirements 15.3**
    - **Property 47: Mismatch Alert Timeline Annotation**
    - **Validates: Requirements 15.4**
  
  - [~] 17.3 Create API endpoint for timeline visualization
    - GET /depot/vision/counting/sessions/{session_id}/timeline
    - Return HTML or image format visualization
    - Include low-confidence highlighting and alert annotations
    - _Requirements: 15.1, 15.3, 15.4_
  
  - [~] 17.4 Create API endpoint for exporting timeline
    - POST /depot/vision/counting/sessions/{session_id}/export-timeline
    - Export as PNG or interactive HTML
    - Return download URL
    - _Requirements: 15.5_

- [~] 18. Checkpoint - Verify action categorization and timeline
  - Test action categorization with sample tracking data
  - Verify timeline visualization generation
  - Test timeline export functionality
  - Ensure all tests pass, ask the user if questions arise.


### Phase 5: Counting Line Geometry & Validation

- [ ] 19. Implement counting line geometry validator
  - [~] 19.1 Create counting line validator module
    - Create `backend/app/depot/vision/counting_line_validator.py`
    - Implement horizontal angle validation (±5° tolerance)
    - Implement position validation (reject top/bottom 10% of frame)
    - Implement exclusion zone intersection detection
    - Validate y-coordinate is constant across frame width
    - _Requirements: 5.1, 10.1, 10.2, 10.5_
  
  - [ ]* 19.2 Write property tests for counting line validation
    - **Property 11: Counting Line Angle Validation**
    - **Validates: Requirements 5.1, 10.2**
    - **Property 12: Counting Line Exclusion Zone Intersection**
    - **Validates: Requirements 5.3**
    - **Property 24: Counting Line Horizontal Constraint**
    - **Validates: Requirements 10.1**
    - **Property 26: Counting Line Position Validation**
    - **Validates: Requirements 10.5**
  
  - [~] 19.3 Create API endpoint for configuring counting line
    - POST /depot/vision/cameras/{camera_id}/counting-line
    - Accept y_coordinate, calibration_matrix
    - Validate horizontal constraint and position
    - Store in CountingLine table with validation status
    - _Requirements: 5.1, 5.5_
  
  - [~] 19.4 Create API endpoint for retrieving counting line
    - GET /depot/vision/cameras/{camera_id}/counting-line
    - Return current configuration with validation status
    - Include validation_errors if any
    - _Requirements: 5.5_

- [ ] 20. Implement perspective correction
  - [~] 20.1 Create perspective correction module
    - Create `backend/app/depot/vision/perspective_correction.py`
    - Implement camera calibration matrix computation using checkerboard pattern
    - Implement homography transformation
    - Ensure counting line remains horizontal after correction
    - _Requirements: 10.4_
  
  - [ ]* 20.2 Write property test for perspective correction
    - **Property 25: Perspective Correction Horizontal Preservation**
    - **Validates: Requirements 10.4**
    - Test that corrected line angle is ≤ 1° from horizontal
  
  - [~] 20.3 Integrate perspective correction into counting line configuration
    - Apply correction when camera is mounted at an angle
    - Store calibration_matrix in CountingLine table
    - _Requirements: 10.4_

- [ ] 21. Implement counting line visual overlay
  - [~] 21.1 Create visual overlay generator
    - Generate visual overlay showing counting line position
    - Display 10x10 grid for alignment assistance
    - Show angle indicator in real-time
    - Highlight validation errors
    - _Requirements: 5.2, 5.5_
  
  - [~] 21.2 Create API endpoint for visual overlay
    - GET /depot/vision/cameras/{camera_id}/counting-line/overlay
    - Return image with counting line and grid overlay
    - Include angle and position indicators
    - _Requirements: 5.2_

- [ ] 22. Implement class-based counting filter
  - [~] 22.1 Add class filter to counting logic
    - Modify counting.py to check object class before incrementing count
    - Only count detections with class="bag"
    - Log filtered detections for analysis
    - _Requirements: 5.4_
  
  - [ ]* 22.2 Write property test for class-based counting
    - **Property 13: Class-Based Counting Filter**
    - **Validates: Requirements 5.4**
    - Test that count increments only for "bag" class

- [~] 23. Checkpoint - Verify counting line geometry features
  - Test counting line validation with various angles
  - Verify perspective correction on angled cameras
  - Test visual overlay generation
  - Ensure all tests pass, ask the user if questions arise.


### Phase 6: Exclusion Zone Management

- [ ] 24. Implement exclusion zone system
  - [~] 24.1 Create exclusion zone manager module
    - Create `backend/app/depot/vision/exclusion_zone_manager.py`
    - Support polygonal regions (3-8 vertices)
    - Implement IoU computation for bbox-polygon overlap
    - Implement suppression logic (>15% IoU threshold)
    - _Requirements: 6.1, 6.2_
  
  - [ ]* 24.2 Write property test for IoU-based suppression
    - **Property 14: IoU-Based Detection Suppression**
    - **Validates: Requirements 6.2**
    - Test that detections are suppressed when IoU > 0.15
  
  - [~] 24.3 Create API endpoint for creating exclusion zones
    - POST /depot/vision/cameras/{camera_id}/exclusion-zones
    - Accept name, polygon_coords, zone_type
    - Validate polygon has 3-8 vertices
    - Store in ExclusionZone table
    - _Requirements: 6.1, 6.5_
  
  - [~] 24.4 Create API endpoint for listing exclusion zones
    - GET /depot/vision/cameras/{camera_id}/exclusion-zones
    - Return all zones for specified camera
    - Include zone_type and is_temporary status
    - _Requirements: 6.5_
  
  - [~] 24.5 Create API endpoint for deleting exclusion zones
    - DELETE /depot/vision/cameras/{camera_id}/exclusion-zones/{zone_id}
    - Remove zone from database
    - _Requirements: 6.5_

- [ ] 25. Implement automatic exclusion zone detection
  - [~] 25.1 Implement automatic truck zone creation
    - Detect truck bodies using "Truck", "Truck Back", "Truck space" classes
    - Create exclusion zones with polygon matching detection bbox
    - Set zone_type="auto_truck"
    - _Requirements: 6.3_
  
  - [ ]* 25.2 Write property test for automatic truck zone creation
    - **Property 15: Automatic Truck Zone Creation**
    - **Validates: Requirements 6.3**
    - Test that zones are created for truck detections
  
  - [~] 25.3 Implement temporary person zone creation
    - Detect persons using COCO model
    - Create temporary exclusion zones around person bbox expanded by 20%
    - Set zone_type="auto_person", is_temporary=true
    - Set expires_at timestamp
    - _Requirements: 6.4_
  
  - [ ]* 25.4 Write property test for temporary person zone creation
    - **Property 16: Temporary Person Zone Creation**
    - **Validates: Requirements 6.4**
    - Test that temporary zones are created with 20% margin
  
  - [~] 25.5 Implement temporary zone expiration
    - Remove temporary zones when person leaves frame
    - Clean up expired zones based on expires_at timestamp
    - _Requirements: 6.4_

- [ ] 26. Integrate exclusion zones into detection pipeline
  - [~] 26.1 Add exclusion zone checking to detection pipeline
    - Modify detection.py to check each detection against exclusion zones
    - Suppress detections with IoU > 0.15
    - Set suppressed_by_exclusion_zone flag
    - Store exclusion_zone_id reference
    - _Requirements: 6.2_
  
  - [~] 26.2 Add optional suppressed detection visualization
    - Display suppressed detections with red bounding boxes
    - Include suppression reason in overlay
    - _Requirements: 8.5_

- [~] 27. Checkpoint - Verify exclusion zone features
  - Test manual exclusion zone creation and deletion
  - Verify automatic truck zone detection
  - Test temporary person zone creation and expiration
  - Ensure all tests pass, ask the user if questions arise.


### Phase 7: Multi-Camera Coordination

- [ ] 28. Implement camera overlap detection
  - [~] 28.1 Create camera coordinator module
    - Create `backend/app/depot/vision/camera_coordinator.py`
    - Implement FOV overlap computation using calibration data
    - Identify overlapping regions in world coordinates
    - Compute overlap percentage
    - _Requirements: 12.1_
  
  - [~] 28.2 Create API endpoint for computing camera overlaps
    - POST /depot/vision/cameras/compute-overlaps
    - Compute overlaps between all camera pairs
    - Store results in CameraOverlap table
    - _Requirements: 12.1_
  
  - [~] 28.3 Create API endpoint for retrieving camera overlaps
    - GET /depot/vision/cameras/overlaps
    - Return overlap matrix for all cameras
    - Include overlap_region and overlap_percentage
    - _Requirements: 12.1_

- [ ] 29. Implement global tracking registry
  - [~] 29.1 Create global tracking registry module
    - Create `backend/app/depot/vision/global_tracking.py`
    - Implement unique bag_id assignment across cameras
    - Track first_seen and last_seen timestamps and cameras
    - Store visual signature (color histogram) for matching
    - _Requirements: 12.2_
  
  - [ ]* 29.2 Write property test for global tracking ID uniqueness
    - **Property 32: Global Tracking ID Uniqueness**
    - **Validates: Requirements 12.2**
    - Test that each bag gets exactly one unique bag_id
  
  - [~] 29.3 Create API endpoint for global tracking registry
    - GET /depot/vision/tracking/global-registry
    - Return all tracked bags with camera history
    - Include is_counted status
    - _Requirements: 12.2_

- [ ] 30. Implement spatial-temporal correlation
  - [~] 30.1 Implement spatial proximity detection
    - Compute world coordinates from camera coordinates
    - Detect detections within 50cm spatial proximity
    - _Requirements: 12.1_
  
  - [~] 30.2 Implement temporal correlation
    - Check detections within 10-second window
    - Correlate detections across cameras using spatial proximity, temporal proximity, and visual similarity
    - _Requirements: 12.1, 12.3_
  
  - [~] 30.3 Implement visual similarity matching
    - Compute color histogram for each detection
    - Match detections using histogram similarity (threshold > 0.85)
    - _Requirements: 12.1_
  
  - [ ]* 30.4 Write property test for multi-camera duplicate suppression
    - **Property 31: Multi-Camera Duplicate Suppression**
    - **Validates: Requirements 12.1**
    - Test that duplicate detections are suppressed

- [ ] 31. Implement temporal deduplication
  - [~] 31.1 Add temporal deduplication logic
    - Mark bags as counted in global registry
    - Prevent re-counting within 10-second window
    - Store counted_at timestamp and counted_by_camera_id
    - _Requirements: 12.3_
  
  - [ ]* 31.2 Write property test for temporal deduplication
    - **Property 33: Temporal Deduplication**
    - **Validates: Requirements 12.3**
    - Test that bags are not re-counted within 10s window

- [ ] 32. Implement distributed locking for count updates
  - [~] 32.1 Add PostgreSQL advisory locks
    - Use advisory locks for atomic count increment operations
    - Implement retry with exponential backoff (3 attempts)
    - Handle lock timeout errors gracefully
    - _Requirements: 12.1_
  
  - [~] 32.2 Add error handling for lock failures
    - Log errors when lock cannot be acquired
    - Queue count updates for background retry
    - Send alerts to administrators
    - _Requirements: Error Handling section_

- [ ] 33. Implement consolidated reporting
  - [~] 33.1 Create consolidated report generator
    - Aggregate counts from all cameras
    - Eliminate duplicates using global tracking registry
    - Count each unique bag_id exactly once
    - _Requirements: 12.5_
  
  - [ ]* 33.2 Write property test for consolidated report deduplication
    - **Property 34: Consolidated Report Deduplication**
    - **Validates: Requirements 12.5**
    - Test that each bag_id is counted exactly once
  
  - [~] 33.3 Create API endpoint for multi-camera view
    - GET /depot/vision/cameras/multi-view
    - Display all active camera feeds with synchronized timestamps
    - _Requirements: 12.4_

- [~] 34. Checkpoint - Verify multi-camera coordination
  - Test camera overlap computation
  - Verify global tracking across cameras
  - Test duplicate suppression and temporal deduplication
  - Ensure all tests pass, ask the user if questions arise.


### Phase 8: Real-Time Monitoring, Export & Confidence Optimization

- [ ] 35. Implement real-time detection monitoring
  - [~] 35.1 Create WebSocket endpoint for live monitoring
    - Create WebSocket endpoint: GET /depot/vision/detection/live-monitor/{camera_id}
    - Stream detection events with confidence scores
    - Update every 2 seconds with current bag count, active detections, average confidence
    - _Requirements: 8.1, 8.2_
  
  - [~] 35.2 Implement low-confidence alert system
    - Monitor average confidence across consecutive frames
    - Generate alert when avg confidence < 0.60 for >10 frames
    - Send alert via notification system
    - _Requirements: 8.3_
  
  - [ ]* 35.3 Write property test for low-confidence alert generation
    - **Property 20: Low Confidence Alert Generation**
    - **Validates: Requirements 8.3**
    - Test that alerts are generated when conditions are met
  
  - [~] 35.4 Add live detection overlay rendering
    - Display bounding boxes, class labels, confidence scores
    - Show action_category for each detection
    - Display suppressed detections with red boxes (optional)
    - _Requirements: 8.1, 8.4, 8.5_

- [ ] 36. Implement confidence threshold optimization
  - [~] 36.1 Create confidence threshold tuning interface
    - Create API endpoint: GET /depot/vision/detection/precision-recall-curve
    - Compute precision-recall curve for current model
    - Display curve visualization
    - _Requirements: 7.1_
  
  - [~] 36.2 Implement threshold adjustment with metric recomputation
    - Create API endpoint: POST /depot/vision/detection/adjust-threshold
    - Accept new threshold value
    - Recompute metrics on validation set
    - Return updated precision, recall, F1-score
    - _Requirements: 7.2_
  
  - [ ]* 36.3 Write property test for threshold metric recomputation
    - **Property 17: Confidence Threshold Metric Recomputation**
    - **Validates: Requirements 7.2**
    - Test that metrics are based only on detections with confidence ≥ threshold
  
  - [~] 36.4 Implement optimal threshold recommendation
    - Analyze historical detection runs
    - Recommend threshold that maximizes F1-score
    - _Requirements: 7.3_
  
  - [ ]* 36.5 Write property test for optimal threshold recommendation
    - **Property 18: Optimal Threshold F1 Maximization**
    - **Validates: Requirements 7.3**
    - Test that recommended threshold produces maximum F1-score
  
  - [~] 36.6 Implement low threshold warning
    - Display warning when threshold < 0.40
    - Explain risk of high false positive rates
    - _Requirements: 7.4_
  
  - [ ]* 36.7 Write property test for low threshold warning
    - **Property 19: Low Threshold Warning**
    - **Validates: Requirements 7.4**
    - Test that warning is displayed when threshold < 0.40
  
  - [~] 36.8 Implement per-camera threshold overrides
    - Allow setting different thresholds per camera
    - Store in camera configuration
    - _Requirements: 7.5_

- [ ] 37. Implement export services
  - [~] 37.1 Create CSV export service
    - Create API endpoint: POST /depot/vision/detection/runs/{run_id}/export-csv
    - Generate CSV with columns: frame_number, timestamp, class_label, confidence, bbox_x, bbox_y, bbox_w, bbox_h, action_category, camera_id, model_version, confidence_threshold, counting_line_position
    - Include metadata fields in all rows
    - Return download URL
    - _Requirements: 9.1, 9.5_
  
  - [ ]* 37.2 Write property test for CSV export completeness
    - **Property 21: CSV Export Completeness**
    - **Validates: Requirements 9.1**
    - Test that CSV contains all detections with all required columns
  
  - [~] 37.3 Create JSON export service
    - Create API endpoint: POST /depot/vision/counting/sessions/{session_id}/export-json
    - Generate JSON with session_id, camera_id, model_version, confidence_threshold, counting_line_position, total_counts, accuracy_metrics, discrepancy_analysis
    - Include all metadata fields
    - _Requirements: 9.2, 9.5_
  
  - [ ]* 37.4 Write property tests for JSON export
    - **Property 22: JSON Export Completeness**
    - **Validates: Requirements 9.2**
    - **Property 23: Export Metadata Completeness**
    - **Validates: Requirements 9.5**
  
  - [~] 37.5 Create annotated frame export service
    - Create API endpoint: POST /depot/vision/detection/runs/{run_id}/export-annotated-frames
    - Render detection overlays on frames
    - Support JPEG sequence or MP4 video format
    - Highlight suppressed detections in red
    - Return download URL
    - _Requirements: 9.3_
  
  - [~] 37.6 Create real-time API endpoint for external systems
    - Create API endpoint: GET /depot/vision/detection/runs/{run_id}/detections/stream
    - Return detection results in real-time
    - Support filtering and pagination
    - _Requirements: 9.4_

- [ ] 38. Implement error handling and recovery
  - [~] 38.1 Add model loading error handling
    - Handle missing or corrupted model weights
    - Fall back to default yolov8n.pt
    - Return HTTP 503 if no model available
    - Log errors with details
    - _Requirements: Error Handling section_
  
  - [~] 38.2 Add dataset validation error handling
    - Return HTTP 400 with detailed validation errors
    - Provide annotation review interface
    - Log validation failures
    - _Requirements: Error Handling section_
  
  - [~] 38.3 Add training pipeline error handling
    - Catch OOM and invalid hyperparameter errors
    - Set training status to "failed"
    - Clean up partial weights files
    - Send notifications to user
    - _Requirements: Error Handling section_
  
  - [~] 38.4 Add model deployment monitoring
    - Monitor first 100 detections after deployment
    - Auto-rollback if precision/recall drops >10%
    - Send critical alerts
    - _Requirements: Error Handling section_
  
  - [~] 38.5 Add export error handling
    - Handle disk space and permission errors
    - Return appropriate HTTP status codes
    - Offer streaming export for large datasets
    - _Requirements: Error Handling section_

- [ ] 39. Final integration and testing
  - [~] 39.1 Integration test: End-to-end detection pipeline
    - Test Camera → Detection → Visual Quality → Metrics → Tracking → Counting → Export
    - Verify all components work together
    - _Requirements: All_
  
  - [~] 39.2 Integration test: Training pipeline
    - Test Dataset Registration → Validation → Training → Deployment
    - Verify model versioning and rollback
    - _Requirements: 2, 3, 11, 13_
  
  - [~] 39.3 Integration test: Multi-camera workflow
    - Test Multiple Cameras → Overlap Detection → Duplicate Suppression → Consolidated Report
    - Verify global tracking and temporal deduplication
    - _Requirements: 12_
  
  - [~] 39.4 Integration test: Action timeline workflow
    - Test Detection → Tracking → Action Categorization → Timeline Generation → Export
    - Verify timeline visualization and annotations
    - _Requirements: 4, 15_
  
  - [ ]* 39.5 Run all property-based tests
    - Execute all 47 property tests with 100 iterations each
    - Verify all properties pass
    - Fix any failures
    - _Requirements: All_

- [~] 40. Final checkpoint - Complete system verification
  - Run full test suite (unit, property, integration tests)
  - Verify all API endpoints are functional
  - Test with real camera feeds and datasets
  - Validate performance metrics (latency <100ms, export <5s)
  - Ensure all tests pass, ask the user if questions arise.


## Notes

### Implementation Guidelines

- **Tasks marked with `*` are optional** and can be skipped for faster MVP delivery. These are primarily property-based test tasks that validate correctness properties.
- **Each task references specific requirements** for traceability back to the requirements document.
- **Checkpoints ensure incremental validation** - run tests and verify functionality before proceeding to the next phase.
- **Property tests validate universal correctness properties** defined in the design document (47 total properties).
- **Unit tests and integration tests** complement property tests by validating specific examples and end-to-end workflows.

### Testing Strategy

- **Property-Based Tests**: 47 properties using Hypothesis framework with 100 iterations per property
- **Unit Tests**: ~70 tests covering visual quality scoring, action categorization, counting line validation, exclusion zones, dataset validation, model versioning, multi-camera coordination, and export services
- **Integration Tests**: ~19 tests covering end-to-end pipelines (detection, training, multi-camera, action timeline)
- **Coverage Target**: >85% line coverage for new code

### Performance Targets

- **Detection latency**: <100ms per frame
- **Multi-camera coordination overhead**: <50ms
- **Export performance**: 1000 detections in <5s
- **Database query performance**: <200ms for metrics retrieval

### Database Schema

The implementation adds 9 new tables:
1. **DetectionMetrics** - Stores precision, recall, F1-score per detection run
2. **TrainingDataset** - Catalogs training datasets with metadata
3. **ModelVersion** - Tracks model versions with performance metrics
4. **ActionEvent** - Records action category transitions
5. **ExclusionZone** - Defines polygonal exclusion regions
6. **CountingLine** - Stores counting line configuration per camera
7. **CameraOverlap** - Tracks camera FOV overlaps
8. **GlobalTrackingRegistry** - Maintains unique bag IDs across cameras
9. **FalseDetectionLog** - Logs false positives and false negatives

### API Endpoints

The implementation adds 30+ new API endpoints across:
- **Detection Accuracy & Monitoring**: Metrics computation, false detection logging, live monitoring
- **Training & Model Management**: Dataset registration/validation, model versioning, deployment/rollback
- **Action Categorization**: Action timeline retrieval, timeline visualization, export
- **Counting Line & Exclusion Zones**: Line configuration, zone management, visual overlays
- **Multi-Camera Coordination**: Overlap computation, global tracking registry, consolidated reporting
- **Export Services**: CSV/JSON export, annotated frame export, real-time streaming

### Implementation Timeline

- **Phase 1** (Weeks 1-2): Database schema & core infrastructure
- **Phase 2** (Weeks 3-4): Detection accuracy & visual quality scoring
- **Phase 3** (Weeks 5-6): Training dataset integration & model versioning
- **Phase 4** (Weeks 7-8): Action categorization & timeline
- **Phase 5** (Weeks 9-10): Counting line geometry & validation
- **Phase 6** (Weeks 11-12): Exclusion zone management
- **Phase 7** (Weeks 13-14): Multi-camera coordination
- **Phase 8** (Weeks 15-16): Real-time monitoring, export & confidence optimization

### Key Design Decisions

1. **Visual Quality Scoring**: Lightweight CV-based scoring (color, edge, saturation, aspect ratio) to reduce false positives without retraining
2. **Action Categorization**: Direction vector analysis + zone context instead of separate classifier
3. **Counting Line Geometry**: Strict horizontal constraint with perspective correction for angled cameras
4. **Multi-Camera Coordination**: Spatial-temporal correlation with 10s window and visual similarity matching
5. **Metrics Storage**: PostgreSQL for persistence (no Redis dependency) to simplify querying and enable historical analysis

### Dependencies

- **Python Libraries**: ultralytics (YOLOv8), opencv-python, numpy, hypothesis (property testing), pytest
- **Database**: PostgreSQL with JSONB support for metadata storage
- **Existing Modules**: camera.py, detection.py, counting.py, tracking.py, training.py

### Error Handling

The implementation includes comprehensive error handling for:
- Model loading failures (fallback to default model)
- Dataset validation failures (detailed error reporting)
- Training pipeline failures (cleanup and notifications)
- Model deployment failures (auto-rollback on performance degradation)
- Export failures (streaming fallback for large datasets)
- Multi-camera coordination failures (distributed lock timeouts, overlap computation errors)


## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8", "1.9"]
    },
    {
      "id": 1,
      "tasks": ["2.1", "2.2", "3.1", "3.2", "3.3", "3.4", "3.5"]
    },
    {
      "id": 2,
      "tasks": ["5.1", "6.1", "7.1", "8.1", "10.1", "11.1", "12.1", "15.1", "16.1", "19.1", "20.1", "24.1", "28.1", "29.1"]
    },
    {
      "id": 3,
      "tasks": ["5.2", "5.3", "5.4", "6.2", "7.2", "8.2", "10.3", "11.2", "12.2", "15.3", "16.2", "19.2", "20.2", "24.2", "29.2"]
    },
    {
      "id": 4,
      "tasks": ["5.6", "6.3", "6.4", "7.3", "10.2", "11.3", "12.3", "15.2", "19.3", "21.1", "24.3", "25.1", "28.2", "30.1"]
    },
    {
      "id": 5,
      "tasks": ["5.5", "5.7", "7.4", "10.4", "11.4", "12.4", "15.4", "16.3", "19.4", "20.3", "21.2", "22.1", "24.4", "25.3", "28.3", "30.2"]
    },
    {
      "id": 6,
      "tasks": ["10.5", "12.5", "17.1", "22.2", "24.5", "25.2", "25.4", "26.1", "30.3", "31.1"]
    },
    {
      "id": 7,
      "tasks": ["12.6", "12.7", "13.1", "13.2", "17.2", "25.5", "26.2", "30.4", "31.2", "32.1"]
    },
    {
      "id": 8,
      "tasks": ["13.3", "13.4", "17.3", "17.4", "32.2", "33.1"]
    },
    {
      "id": 9,
      "tasks": ["13.5", "13.6", "33.2", "33.3", "35.1", "36.1"]
    },
    {
      "id": 10,
      "tasks": ["35.2", "36.2", "37.1"]
    },
    {
      "id": 11,
      "tasks": ["35.3", "35.4", "36.3", "36.4", "37.2", "37.3"]
    },
    {
      "id": 12,
      "tasks": ["36.5", "36.6", "36.8", "37.4", "37.5", "37.6"]
    },
    {
      "id": 13,
      "tasks": ["36.7", "38.1", "38.2", "38.3", "38.4", "38.5"]
    },
    {
      "id": 14,
      "tasks": ["39.1", "39.2", "39.3", "39.4"]
    },
    {
      "id": 15,
      "tasks": ["39.5"]
    }
  ]
}
```

### Dependency Graph Explanation

The task dependency graph organizes implementation into 16 waves for parallel execution:

- **Wave 0**: All database migrations (can run in parallel, no dependencies)
- **Wave 1**: Model extensions and Pydantic models (depend on migrations)
- **Wave 2**: Core module creation (visual quality, metrics, action categorization, counting line, exclusion zones, multi-camera)
- **Wave 3**: Property tests for core modules
- **Wave 4**: API endpoints and integration of core modules
- **Wave 5**: Additional API endpoints and property tests
- **Wave 6**: Advanced features (timeline visualization, automatic zones, deduplication)
- **Wave 7**: Model versioning, training enhancements, distributed locking
- **Wave 8**: Training property tests, timeline export, consolidated reporting
- **Wave 9**: A/B testing, multi-camera view, confidence optimization
- **Wave 10**: Real-time monitoring, threshold adjustment, CSV export
- **Wave 11**: Property tests for monitoring and export, JSON export
- **Wave 12**: Annotated frame export, threshold optimization features
- **Wave 13**: Error handling across all components
- **Wave 14**: Integration tests for all major workflows
- **Wave 15**: Final property-based test execution (all 47 properties)

Tasks within the same wave are independent and can be executed in parallel. Tasks in wave N can only execute after all tasks in waves 0..N-1 complete.

