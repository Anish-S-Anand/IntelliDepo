# Requirements Document

## Introduction

This document specifies requirements for enhancing the bag counting detection system in the IntelliDepo vision application. The current system uses YOLOv8-based detection with real-time counting capabilities but requires improvements in detection accuracy, training dataset integration, action categorization, and counting line geometry validation to achieve production-grade reliability for warehouse operations.

The enhancement focuses on analyzing the counting summary section and video feeds, integrating improved training datasets, categorizing all detectable actions in the video stream, and ensuring the counting line is properly configured to target only bags with horizontal orientation.

## Glossary

- **Vision_System**: The IntelliDepo computer vision module responsible for object detection, tracking, and counting in warehouse video feeds
- **Bag_Detector**: The YOLOv8-based neural network model that identifies cement bags in video frames
- **Counting_Line**: A horizontal virtual boundary in the video frame that triggers count increments when bags cross it
- **Training_Dataset**: A collection of labeled images and videos used to train or fine-tune the bag detection model
- **Action_Category**: A classification of detectable events in the video stream (loading, unloading, movement, stacking, etc.)
- **Confidence_Score**: A numerical value (0-1) representing the model's certainty that a detected object is a bag
- **Exclusion_Zone**: A region in the video frame where detections should be suppressed (workers, trucks, non-bag objects)
- **Detection_Run**: A single execution of the object detection pipeline on a video stream or frame sequence
- **Counting_Session**: A time-bounded period during which bags are counted and reconciled against a manifest
- **Manifest**: An expected shipment record containing the anticipated count of bags, boxes, pallets, and other items

## Requirements

### Requirement 1: Detection Accuracy Analysis

**User Story:** As a warehouse operations manager, I want to analyze the current detection accuracy in the counting summary section, so that I can identify specific failure modes and improvement opportunities.

#### Acceptance Criteria

1. WHEN a Detection_Run is completed, THE Vision_System SHALL compute and store precision, recall, and F1-score metrics for bag detections
2. WHEN the counting summary is displayed, THE Vision_System SHALL show the current Confidence_Score distribution across all detected bags
3. WHEN a false positive detection occurs, THE Vision_System SHALL log the detection with frame reference, bounding box coordinates, and confidence value
4. WHEN a false negative occurs (missed bag), THE Vision_System SHALL provide a mechanism to mark and log the missed detection for analysis
5. THE Vision_System SHALL generate a detection accuracy report comparing counted bags against Manifest expected values with discrepancy breakdown by category (false positives, false negatives, correct detections)

### Requirement 2: Training Dataset Integration

**User Story:** As an ML engineer, I want to identify and integrate relevant training datasets for bag detection, so that the model can achieve higher accuracy across diverse lighting and scene conditions.

#### Acceptance Criteria

1. THE Vision_System SHALL provide a dataset registry that catalogs available Training_Datasets with metadata (source, size, annotation format, scene conditions)
2. WHEN a new Training_Dataset is registered, THE Vision_System SHALL validate that annotations include bounding boxes, class labels, and confidence scores in YOLO format
3. THE Vision_System SHALL support integration of datasets containing cement bags, grain bags, and similar industrial packaging under varied lighting conditions (daylight, warehouse lighting, shadows)
4. WHEN multiple Training_Datasets are available, THE Vision_System SHALL provide a dataset selection interface that allows filtering by scene type, lighting condition, and bag type
5. THE Vision_System SHALL track which Training_Dataset version was used to train each Bag_Detector model version for reproducibility

### Requirement 3: Model Training and Fine-Tuning

**User Story:** As an ML engineer, I want to train and fine-tune the bag detection model using integrated datasets, so that detection accuracy improves in production scenarios.

#### Acceptance Criteria

1. WHEN a Training_Dataset is selected, THE Vision_System SHALL provide a training pipeline that fine-tunes the Bag_Detector using the selected dataset
2. THE Vision_System SHALL support training with data augmentation techniques (rotation, brightness adjustment, scaling) to improve model robustness
3. WHEN training is initiated, THE Vision_System SHALL log training hyperparameters (learning rate, batch size, epochs, confidence threshold) for reproducibility
4. WHEN training completes, THE Vision_System SHALL generate a validation report showing mAP50, precision, recall, and loss curves
5. THE Vision_System SHALL support A/B testing by allowing multiple Bag_Detector model versions to run in parallel on the same video stream for comparison

### Requirement 4: Action Categorization

**User Story:** As a warehouse supervisor, I want all detectable actions in the video to be properly categorized, so that I can understand operational patterns and identify process bottlenecks.

#### Acceptance Criteria

1. THE Vision_System SHALL detect and categorize the following Action_Categories: "loading", "unloading", "stacking", "unstacking", "movement", "idle", "quality_inspection"
2. WHEN a bag crosses the Counting_Line, THE Vision_System SHALL assign an Action_Category based on direction of movement and zone context
3. WHEN multiple bags are detected in close proximity with coordinated movement, THE Vision_System SHALL categorize the action as "batch_transfer"
4. WHEN a worker is detected near bags without bag movement for more than 5 seconds, THE Vision_System SHALL categorize the action as "quality_inspection"
5. THE Vision_System SHALL maintain an action timeline that records Action_Category transitions with timestamps for each Counting_Session

### Requirement 5: Counting Line Geometry Validation

**User Story:** As a system administrator, I want to ensure the counting line is horizontal and positioned correctly, so that only bags are counted and other objects are excluded.

#### Acceptance Criteria

1. THE Vision_System SHALL validate that the Counting_Line is horizontal with a tolerance of ±5 degrees from the true horizontal axis
2. WHEN the Counting_Line is configured, THE Vision_System SHALL display a visual overlay on the video feed showing the line position and orientation
3. THE Vision_System SHALL reject Counting_Line configurations where the line intersects Exclusion_Zones (truck bodies, worker zones, walls)
4. WHEN a detection crosses the Counting_Line, THE Vision_System SHALL verify the detected object class is "bag" before incrementing the count
5. THE Vision_System SHALL provide a calibration interface that allows adjusting the Counting_Line position and validates that it targets the bag transfer corridor

### Requirement 6: Exclusion Zone Management

**User Story:** As a system administrator, I want to define and manage exclusion zones, so that workers, trucks, and non-bag objects do not trigger false counts.

#### Acceptance Criteria

1. THE Vision_System SHALL support defining Exclusion_Zones as polygonal regions in the video frame coordinate space
2. WHEN a detection bounding box overlaps an Exclusion_Zone by more than 15% IoU, THE Vision_System SHALL suppress the detection
3. THE Vision_System SHALL automatically detect and create Exclusion_Zones for truck bodies using the "Truck", "Truck Back", and "Truck space" classes from the primary model
4. WHEN a person is detected by the general COCO model, THE Vision_System SHALL create a temporary Exclusion_Zone around the person bounding box
5. THE Vision_System SHALL persist Exclusion_Zone configurations per camera and allow manual adjustment through a configuration interface

### Requirement 7: Confidence Threshold Optimization

**User Story:** As a warehouse operations manager, I want to optimize the confidence threshold for bag detection, so that the system balances precision and recall for maximum counting accuracy.

#### Acceptance Criteria

1. THE Vision_System SHALL provide a confidence threshold tuning interface that shows the precision-recall curve for the current Bag_Detector
2. WHEN the confidence threshold is adjusted, THE Vision_System SHALL recompute detection results on a validation set and display updated precision, recall, and F1-score
3. THE Vision_System SHALL recommend an optimal confidence threshold that maximizes F1-score based on historical Detection_Run data
4. WHEN the confidence threshold is below 0.40, THE Vision_System SHALL display a warning that false positive rates may be unacceptably high
5. THE Vision_System SHALL support per-camera confidence threshold overrides to account for varying lighting and scene conditions

### Requirement 8: Real-Time Detection Monitoring

**User Story:** As a warehouse supervisor, I want to monitor detection performance in real-time, so that I can identify and respond to counting issues immediately.

#### Acceptance Criteria

1. WHEN a Counting_Session is active, THE Vision_System SHALL display live detection overlays on the video feed showing bounding boxes, class labels, and Confidence_Scores
2. THE Vision_System SHALL update the counting summary display every 2 seconds with current bag count, active detections, and average confidence
3. WHEN the average Confidence_Score drops below 0.60 for more than 10 consecutive frames, THE Vision_System SHALL generate a low-confidence alert
4. THE Vision_System SHALL display the current Action_Category for each detected bag in the live feed overlay
5. WHEN a detection is suppressed due to Exclusion_Zone overlap, THE Vision_System SHALL optionally display the suppressed detection with a distinct visual indicator (e.g., red bounding box)

### Requirement 9: Detection Result Export

**User Story:** As a data analyst, I want to export detection results and analysis data, so that I can perform offline analysis and generate reports.

#### Acceptance Criteria

1. THE Vision_System SHALL provide an export function that generates a CSV file containing all detections from a Detection_Run with columns: frame_number, timestamp, class_label, confidence, bbox_x, bbox_y, bbox_w, bbox_h, action_category
2. WHEN a Counting_Session is completed, THE Vision_System SHALL generate a summary report in JSON format containing total counts by class, accuracy metrics, and discrepancy analysis
3. THE Vision_System SHALL support exporting annotated video frames with detection overlays for manual review
4. THE Vision_System SHALL provide an API endpoint that returns detection results in real-time for integration with external analytics systems
5. FOR ALL exported detection data, THE Vision_System SHALL include metadata fields: camera_id, model_version, confidence_threshold, counting_line_position

### Requirement 10: Counting Line Horizontal Enforcement

**User Story:** As a system administrator, I want the counting line to be strictly horizontal, so that bag counts are consistent regardless of camera mounting angle.

#### Acceptance Criteria

1. THE Vision_System SHALL enforce that the Counting_Line y-coordinate is constant across the entire frame width
2. WHEN the Counting_Line is configured with a non-horizontal orientation, THE Vision_System SHALL reject the configuration and display an error message
3. THE Vision_System SHALL provide a visual grid overlay during Counting_Line configuration to assist with horizontal alignment
4. WHEN the camera is mounted at an angle, THE Vision_System SHALL apply perspective correction to ensure the Counting_Line remains horizontal relative to the physical floor plane
5. THE Vision_System SHALL validate that the Counting_Line does not intersect the top 10% or bottom 10% of the frame to avoid edge artifacts

### Requirement 11: Dataset Annotation Quality Validation

**User Story:** As an ML engineer, I want to validate the quality of training dataset annotations, so that poor-quality data does not degrade model performance.

#### Acceptance Criteria

1. WHEN a Training_Dataset is imported, THE Vision_System SHALL validate that all bounding boxes have non-zero width and height
2. THE Vision_System SHALL detect and flag annotations where bounding boxes extend outside the image boundaries
3. THE Vision_System SHALL compute and report the distribution of bounding box sizes and aspect ratios to identify outliers
4. WHEN duplicate annotations are detected (multiple boxes with IoU > 0.90 for the same class), THE Vision_System SHALL flag them for review
5. THE Vision_System SHALL provide a manual annotation review interface that displays images with bounding boxes and allows correction or deletion of invalid annotations

### Requirement 12: Multi-Camera Counting Coordination

**User Story:** As a warehouse operations manager, I want to coordinate bag counting across multiple cameras, so that bags are not double-counted when they appear in overlapping camera views.

#### Acceptance Criteria

1. WHEN multiple cameras have overlapping fields of view, THE Vision_System SHALL detect and suppress duplicate bag detections using spatial and temporal correlation
2. THE Vision_System SHALL maintain a global tracking registry that assigns unique IDs to bags across camera boundaries
3. WHEN a bag is counted by one camera, THE Vision_System SHALL mark the bag ID as counted and prevent re-counting by other cameras within a 10-second window
4. THE Vision_System SHALL provide a multi-camera view interface that displays all active camera feeds with synchronized timestamps
5. THE Vision_System SHALL generate a consolidated counting report that aggregates counts from all cameras while eliminating duplicates

### Requirement 13: Detection Model Versioning

**User Story:** As an ML engineer, I want to version and manage detection models, so that I can track performance changes and roll back to previous versions if needed.

#### Acceptance Criteria

1. THE Vision_System SHALL assign a unique version identifier to each trained Bag_Detector model
2. WHEN a new model version is deployed, THE Vision_System SHALL log the deployment timestamp, model version, and Training_Dataset version used
3. THE Vision_System SHALL support rollback to a previous Bag_Detector version through a model management interface
4. WHEN multiple model versions are available, THE Vision_System SHALL display a comparison table showing accuracy metrics (mAP50, precision, recall) for each version
5. THE Vision_System SHALL maintain a model performance history that tracks accuracy metrics over time for each deployed model version

### Requirement 14: Bag Visual Validation Enhancement

**User Story:** As an ML engineer, I want to enhance the visual validation of bag detections, so that false positives from reflections, shadows, and non-bag objects are reduced.

#### Acceptance Criteria

1. THE Vision_System SHALL compute a visual quality score for each bag detection based on color distribution, edge density, saturation, and aspect ratio
2. WHEN a detection has a visual quality score below 0.20, THE Vision_System SHALL suppress the detection even if the model confidence is high
3. THE Vision_System SHALL adapt the visual validation thresholds based on lighting conditions detected in the current frame (daylight, warehouse lighting, low light)
4. WHEN a bag detection overlaps a known reflection zone (glass, metal surfaces), THE Vision_System SHALL apply stricter visual validation criteria
5. THE Vision_System SHALL log all suppressed detections with visual quality scores for offline analysis and threshold tuning

### Requirement 15: Action Timeline Visualization

**User Story:** As a warehouse supervisor, I want to visualize the action timeline for a counting session, so that I can understand the sequence of operations and identify delays.

#### Acceptance Criteria

1. THE Vision_System SHALL generate an action timeline visualization showing Action_Category transitions over time for each Counting_Session
2. WHEN the timeline is displayed, THE Vision_System SHALL show the duration of each action phase (loading, unloading, idle, etc.)
3. THE Vision_System SHALL highlight timeline segments where the average Confidence_Score dropped below 0.60
4. WHEN a mismatch alert is triggered, THE Vision_System SHALL annotate the timeline with the alert timestamp and discrepancy details
5. THE Vision_System SHALL support exporting the action timeline as an image or interactive HTML report for sharing with stakeholders
