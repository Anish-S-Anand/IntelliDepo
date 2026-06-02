# Implementation Plan: Cement Bag Detection Training System

## Overview

This implementation plan covers the complete cement bag detection training system, including database schema, training pipeline, validation framework, model registry, deployment controller, monitoring service, and API endpoints. The system integrates with existing realtime_counter.py and detection.py modules to provide production-grade model training, validation, deployment, and monitoring capabilities.

## Tasks

- [ ] 1. Database Schema and Migrations
  - [x] 1.1 Create training_models table migration
    - Create Alembic migration for training_models table with all fields (id, version, model_name, model_path, base_model, status, hyperparameters, metrics, dataset metadata, training metadata, deployment metadata, audit fields)
    - Add indexes for status, version, and created_at
    - Add CHECK constraint for valid status values
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [-] 1.2 Create training_runs table migration
    - Create Alembic migration for training_runs table tracking individual training executions
    - Include progress tracking fields (current_epoch, total_epochs, best_epoch)
    - Include epoch_metrics JSONB array for per-epoch metrics
    - Add error handling fields (error_message, error_traceback)
    - Add indexes for model_id, status, and created_at
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_
  
  - [-] 1.3 Create validation_reports table migration
    - Create Alembic migration for validation_reports table
    - Include core metrics fields (map50, map50_95, precision, recall, f1_score)
    - Include edge case results and calibration fields
    - Include inference benchmark fields (GPU/CPU FPS and latency)
    - Include error analysis fields (false positive/negative counts)
    - Add indexes for model_id, passed status, and map50
    - _Requirements: 5.2, 5.3, 5.4, 5.8, 16.1, 16.4_
  
  - [-] 1.4 Create deployment_history table migration
    - Create Alembic migration for deployment_history table
    - Include deployment configuration and backup information
    - Include A/B testing fields (ab_test_id, traffic_split)
    - Include rollback tracking fields
    - Add indexes for model_id, status, and deployed_at
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
  
  - [-] 1.5 Create detection_metrics table migration
    - Create Alembic migration for detection_metrics table with time-series partitioning
    - Include detection counts and confidence metrics
    - Include performance metrics (inference_time_ms, fps)
    - Include error tracking fields
    - Add indexes for camera_id, timestamp, and model_version
    - Create monthly partitions for performance
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.8_
  
  - [-] 1.6 Create anomaly_alerts table migration
    - Create Alembic migration for anomaly_alerts table
    - Include anomaly type, severity, and status fields
    - Include metrics and threshold violation details
    - Include acknowledgment and resolution tracking
    - Add indexes for camera_id, status, detected_at, and severity
    - _Requirements: 8.5, 8.6_

- [ ] 2. Dataset Management Implementation
  - [ ] 2.1 Implement DatasetManager class with validation
    - Create backend/app/depot/vision/training/dataset_manager.py
    - Implement validate_dataset() method checking directory structure, image integrity, label format, bounding box coordinates, class labels, and split integrity
    - Implement compute_statistics() method for dataset stats
    - Implement create_split() method for stratified splitting
    - Add comprehensive error handling for corrupted files
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_
  
  - [ ]* 2.2 Write unit tests for DatasetManager
    - Test dataset validation detects corrupted images
    - Test label validation catches invalid bounding boxes
    - Test split validation detects duplicate images
    - Test statistics computation accuracy
    - Test stratified splitting maintains class balance
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 15.1, 15.2_
  
  - [~] 2.3 Implement data augmentation utilities
    - Create backend/app/depot/vision/training/augmentation.py
    - Implement apply_augmentation() method with rotation, scaling, brightness, contrast, horizontal flip
    - Implement mosaic augmentation for small object detection
    - Ensure bounding box transformations are correct
    - Apply augmentation only to training split
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [ ]* 2.4 Write unit tests for augmentation
    - Test rotation preserves bounding box annotations
    - Test scaling maintains box coordinates
    - Test brightness/contrast adjustments
    - Test mosaic augmentation correctness
    - Test augmentation is not applied to validation/test splits
    - _Requirements: 6.1, 6.2, 6.3, 6.7_

- [ ] 3. Training System Implementation
  - [~] 3.1 Implement TrainingSystem class
    - Create backend/app/depot/vision/training/trainer.py
    - Implement train_model() method orchestrating end-to-end training
    - Implement validate_hyperparameters() method
    - Implement set_random_seeds() for reproducibility
    - Implement track_training_progress() with callback support
    - Support GPU/CPU training with automatic fallback
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 18.1, 18.2, 18.3, 18.4, 18.5_
  
  - [~] 3.2 Implement hyperparameter configuration
    - Implement TrainingConfig dataclass with all hyperparameters
    - Accept command-line arguments for epochs, imgsz, batch, patience, device
    - Accept arguments for learning rate, momentum, weight_decay
    - Validate hyperparameter values (reject negative epochs, batch size > GPU memory)
    - Save complete hyperparameter configuration with trained model
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  
  - [~] 3.3 Implement training progress tracking
    - Log training configuration at start
    - Log epoch metrics (epoch number, train loss, val loss, validation metrics)
    - Save intermediate checkpoints every 10 epochs
    - Save best model checkpoint based on validation mAP50
    - Log training time per epoch and estimated time remaining
    - Support TensorBoard logging for visualization
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.8_
  
  - [~] 3.4 Implement training error handling
    - Handle corrupted images (skip and continue with remaining data)
    - Handle GPU OOM (reduce batch size automatically and retry)
    - Detect training divergence (stop early if loss increases for 5 epochs)
    - Log detailed error context for debugging
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ]* 3.5 Write integration tests for training pipeline
    - Test end-to-end training from dataset to model weights
    - Test GPU fallback to CPU on unavailability
    - Test early stopping on divergence
    - Test checkpoint saving and restoration
    - Test reproducibility with same random seed
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 18.1, 18.2_

- [~] 4. Checkpoint - Verify training pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Validation Pipeline Implementation
  - [~] 5.1 Implement ValidationPipeline class
    - Create backend/app/depot/vision/training/validator.py
    - Implement validate_model() method with multi-stage validation
    - Implement compute_metrics() for mAP50, mAP50-95, Precision, Recall, F1
    - Implement benchmark_inference() for GPU/CPU speed measurement
    - Generate comprehensive ValidationReport with recommendations
    - _Requirements: 5.1, 5.2, 5.3, 5.7, 5.8_
  
  - [~] 5.2 Implement edge case testing
    - Test model on edge case datasets (low light, heavy occlusion, unusual angles)
    - Require minimum 85% detection rate on edge cases
    - Include edge case results in validation report
    - _Requirements: 5.5, 5.6_
  
  - [~] 5.3 Implement confidence calibration
    - Implement calibrate_confidence() method with temperature scaling
    - Compute calibration curves (predicted confidence vs actual accuracy)
    - Compute expected calibration error (ECE)
    - Save calibration parameters with model
    - Apply calibration in Detection_Engine
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8_
  
  - [~] 5.4 Implement false positive/negative analysis
    - Detect and save false positives with frame, bbox, confidence
    - Detect and save false negatives with frame, ground truth, detection results
    - Categorize false positives by type (worker, truck part, shadow)
    - Categorize false negatives by type (low confidence, occlusion, lighting, angle)
    - Compute FPR and FNR per category
    - Generate report with recommendations
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_
  
  - [ ]* 5.5 Write unit tests for validation pipeline
    - Test metric computation accuracy
    - Test edge case detection rate calculation
    - Test calibration ECE computation
    - Test false positive/negative categorization
    - _Requirements: 5.2, 5.3, 5.6, 16.4, 19.5, 19.6_

- [ ] 6. Model Registry Implementation
  - [~] 6.1 Implement ModelRegistry class
    - Create backend/app/depot/vision/models/registry.py
    - Implement register_model() method with version assignment
    - Implement get_model() method for retrieval by version
    - Implement list_models() with filtering and sorting
    - Implement update_deployment_status() method
    - Implement retire_model() method
    - Implement compare_models() method
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_
  
  - [~] 6.2 Implement model versioning logic
    - Support semantic versioning (v1.0.0) and timestamp-based versioning
    - Assign unique version identifiers on registration
    - Store model weights, hyperparameters, and metrics together
    - Record source dataset version and training script commit hash
    - _Requirements: 11.1, 11.2, 11.3_
  
  - [ ]* 6.3 Write unit tests for model registry
    - Test model registration and version assignment
    - Test model retrieval by version
    - Test model listing with filters
    - Test model comparison logic
    - Test retirement marking
    - _Requirements: 11.1, 11.2, 11.5, 11.6, 11.7, 11.8_

- [ ] 7. Detection Engine Enhancements
  - [~] 7.1 Implement DetectionEngine class
    - Create backend/app/depot/vision/detection_engine.py (or enhance existing detection.py)
    - Implement detect_frame() method with confidence and IoU thresholds
    - Implement detect_batch() for GPU optimization
    - Implement reload_model() for hot-reload capability
    - Implement get_model_info() for metadata retrieval
    - Support exclusion regions for workers/trucks
    - _Requirements: 3.1, 3.2, 3.6, 3.7, 10.6_
  
  - [~] 7.2 Implement batch inference optimization
    - Process multiple frames simultaneously
    - Configure batch size based on available GPU memory
    - Achieve 2-3x throughput improvement
    - _Requirements: 13.3, 13.4_
  
  - [~] 7.3 Implement model export utilities
    - Create backend/app/depot/vision/models/export.py
    - Implement export_model() for ONNX format
    - Implement export_model() for TensorRT format
    - Implement export_model() for CoreML format
    - Validate exported models produce identical results
    - Measure inference speed for each format
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8_
  
  - [~] 7.4 Implement inference optimization
    - Support TensorRT optimization for NVIDIA GPUs
    - Support half-precision (FP16) inference
    - Achieve minimum 30 FPS on GPU for 1920x1080 video
    - Achieve minimum 5 FPS on CPU for 1920x1080 video
    - _Requirements: 13.1, 13.2, 13.5, 13.8_
  
  - [ ]* 7.5 Write performance tests for detection engine
    - Test GPU inference meets 30 FPS target
    - Test CPU inference meets 5 FPS target
    - Test batch inference throughput improvement
    - Test model hot-reload without service restart
    - _Requirements: 13.1, 13.2, 13.3, 10.6_

- [~] 8. Checkpoint - Verify detection and export functionality
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Deployment Controller Implementation
  - [~] 9.1 Implement DeploymentController class
    - Create backend/app/depot/vision/models/deployment.py
    - Implement deploy_model() method with backup creation
    - Implement rollback_deployment() method
    - Implement start_ab_test() for A/B testing
    - Implement finalize_ab_test() to promote winning model
    - Implement get_deployment_history() method
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
  
  - [~] 9.2 Implement safe deployment workflow
    - Validate model exists and is validated before deployment
    - Create backup of current production model
    - Copy new model to production path
    - Update model registry with deployment metadata
    - Trigger hot-reload in Detection_Engine
    - Monitor initial performance for configured duration
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [~] 9.3 Implement automatic rollback
    - Detect deployment failures (file system errors, model loading errors)
    - Restore backed-up model weights
    - Update registry with rollback status
    - Log detailed rollback reason
    - Alert administrators
    - _Requirements: 7.4, 7.5, 9.7_
  
  - [~] 9.4 Implement A/B testing
    - Route configurable percentage of traffic to new model
    - Track detection metrics for both model versions
    - Compare performance between versions
    - Promote better-performing model to 100% traffic
    - _Requirements: 7.6, 7.7, 7.8_
  
  - [ ]* 9.5 Write integration tests for deployment
    - Test end-to-end deployment workflow
    - Test automatic rollback on failure
    - Test A/B testing traffic split
    - Test backup creation and restoration
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 10. Monitoring Service Implementation
  - [~] 10.1 Implement MonitoringService class
    - Create backend/app/depot/vision/monitoring/metrics_collector.py
    - Implement record_detection() method
    - Implement compute_metrics() for time window aggregation
    - Implement get_dashboard_data() for monitoring UI
    - Persist metrics to detection_metrics table
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.8_
  
  - [~] 10.2 Implement anomaly detection
    - Create backend/app/depot/vision/monitoring/anomaly_detector.py
    - Implement detect_anomalies() method
    - Detect confidence drops (avg < 0.70 for 5 minutes)
    - Detect latency spikes (> 200ms GPU, > 1000ms CPU)
    - Detect detection count anomalies (sudden drops/spikes)
    - Detect error rate increases
    - _Requirements: 8.5, 8.6_
  
  - [~] 10.3 Implement alerting system
    - Create backend/app/depot/vision/monitoring/alerting.py
    - Implement generate_alert() method
    - Support severity levels (info, warning, critical)
    - Store alerts in anomaly_alerts table
    - Support webhook notifications
    - _Requirements: 8.5, 8.6_
  
  - [ ]* 10.4 Write unit tests for monitoring
    - Test metrics aggregation accuracy
    - Test anomaly detection thresholds
    - Test alert generation logic
    - Test dashboard data formatting
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 11. Video Processing Integration
  - [~] 11.1 Implement Video_Processor enhancements
    - Enhance backend/app/depot/vision/camera.py or create video_processor.py
    - Handle RTSP streams with VIDEO_API_KEY authentication
    - Decode uploaded video files (MP4, AVI, MKV)
    - Handle variable frame rates (15-60 fps) without dropping frames
    - Handle variable resolutions (640x480 to 1920x1080) with resizing
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [~] 11.2 Implement connection retry and error handling
    - Retry connection up to 3 times with exponential backoff
    - Skip corrupted frames and log warnings
    - Process frames in batches for memory management
    - Extract frame timestamps for synchronization
    - _Requirements: 4.5, 4.6, 4.7, 4.8, 9.6_
  
  - [ ]* 11.3 Write integration tests for video processing
    - Test RTSP stream connection and authentication
    - Test video file decoding for multiple formats
    - Test connection retry logic
    - Test corrupted frame handling
    - _Requirements: 4.1, 4.2, 4.5, 4.6_

- [ ] 12. API Endpoints Implementation
  - [~] 12.1 Implement training API endpoints
    - Create POST /depot/vision/training/models endpoint
    - Create POST /depot/vision/training/runs endpoint
    - Create GET /depot/vision/training/runs/{run_id} endpoint
    - Create POST /depot/vision/training/validate endpoint
    - Add request validation and error handling
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.2_
  
  - [~] 12.2 Implement deployment API endpoints
    - Create POST /depot/vision/deployment/deploy endpoint
    - Create POST /depot/vision/deployment/rollback endpoint
    - Create POST /depot/vision/deployment/ab-test endpoint
    - Create GET /depot/vision/deployment/history endpoint
    - Add authorization checks for deployment operations
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  
  - [~] 12.3 Implement monitoring API endpoints
    - Create GET /depot/vision/monitoring/metrics endpoint
    - Create GET /depot/vision/monitoring/anomalies endpoint
    - Create POST /depot/vision/monitoring/anomalies/{anomaly_id}/acknowledge endpoint
    - Add query parameter support for filtering
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  
  - [~] 12.4 Implement model registry API endpoints
    - Create GET /depot/vision/models endpoint
    - Create GET /depot/vision/models/{version} endpoint
    - Create GET /depot/vision/models/{version}/compare/{other_version} endpoint
    - Add filtering and sorting support
    - _Requirements: 11.5, 11.6, 11.8_
  
  - [ ]* 12.5 Write API integration tests
    - Test training endpoints create database records
    - Test deployment endpoints update model status
    - Test monitoring endpoints return correct metrics
    - Test model registry endpoints filter and sort correctly
    - _Requirements: 1.1, 7.1, 8.1, 11.5_

- [~] 13. Checkpoint - Verify API endpoints
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Integration with Existing Systems
  - [~] 14.1 Integrate with realtime_counter.py
    - Update realtime_counter.py to support hot-reload from YOLO_WEIGHTS env var
    - Implement model file change detection
    - Implement automatic model reload on file change
    - Implement fallback to previous model on loading errors
    - Log model version metadata (filename, load timestamp)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_
  
  - [~] 14.2 Integrate with detection.py
    - Update detection.py to read from training_models table
    - Use weights_path column for model file location
    - Respect confidence_threshold and iou_threshold per model
    - Link DetectionRun records to training_models
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [~] 14.3 Implement multi-camera support
    - Maintain separate detection state per camera stream
    - Distribute inference workload across available GPUs
    - Support per-camera confidence and IoU thresholds
    - Aggregate detection metrics across all cameras
    - Support adding/removing cameras without restart
    - Isolate failures (one camera failure doesn't affect others)
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_
  
  - [ ]* 14.4 Write integration tests for existing systems
    - Test realtime_counter.py loads models from configured path
    - Test realtime_counter.py hot-reloads on file change
    - Test detection.py reads from training_models table
    - Test multi-camera concurrent processing
    - _Requirements: 10.1, 10.6, 17.1, 17.2_

- [ ] 15. Configuration and Environment Setup
  - [ ] 15.1 Create configuration files
    - Create training_config.yaml with hyperparameter defaults
    - Create deployment_config.yaml with deployment settings
    - Create monitoring_config.yaml with threshold configurations
    - Document all environment variables in .env.example
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  
  - [x] 15.2 Create directory structure
    - Create backend/app/depot/vision/training_data/datasets/ directory
    - Create backend/app/depot/vision/training_data/weights/ directory structure
    - Create backend/app/depot/vision/training_data/exports/ directory
    - Create backend/app/depot/vision/training_data/logs/ directory
    - Set up symlinks for production model paths
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 11.1, 11.2_
  
  - [~] 15.3 Create CLI scripts
    - Create train_model.py CLI script for training
    - Create validate_model.py CLI script for validation
    - Create deploy_model.py CLI script for deployment
    - Create export_model.py CLI script for model export
    - Add argument parsing and help documentation
    - _Requirements: 1.1, 1.2, 1.3, 5.1, 7.1, 20.1, 20.2, 20.3_

- [ ] 16. Error Handling and Resilience
  - [~] 16.1 Implement comprehensive error handling
    - Add try-catch blocks for all external operations (file I/O, database, network)
    - Log detailed error context (stack trace, input parameters, system state)
    - Implement exponential backoff for retryable operations
    - Add circuit breakers for external service calls
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_
  
  - [~] 16.2 Implement fallback strategies
    - GPU unavailability → fall back to CPU inference
    - Model loading failure → fall back to previous model version
    - Training divergence → stop early and log metrics
    - Deployment failure → automatic rollback to backup
    - _Requirements: 9.2, 9.3, 9.4, 9.7_
  
  - [ ]* 16.3 Write error handling tests
    - Test GPU OOM handling and batch size reduction
    - Test model loading retry logic
    - Test deployment rollback on failure
    - Test video stream reconnection
    - _Requirements: 9.1, 9.2, 9.4, 9.5, 9.6, 9.7_

- [ ] 17. Documentation and Deployment
  - [~] 17.1 Create API documentation
    - Document all API endpoints with request/response examples
    - Create OpenAPI/Swagger specification
    - Add authentication and authorization requirements
    - Document error codes and responses
    - _Requirements: All API endpoints_
  
  - [~] 17.2 Create user guides
    - Write training workflow guide (dataset preparation → training → validation → deployment)
    - Write deployment guide (validation → deployment → monitoring → rollback)
    - Write monitoring guide (metrics interpretation, anomaly response)
    - Write troubleshooting guide (common errors and solutions)
    - _Requirements: 1.1, 5.1, 7.1, 8.1_
  
  - [~] 17.3 Create deployment scripts
    - Create database migration script
    - Create initial data seeding script (base models, default configs)
    - Create backup and restore scripts
    - Create health check scripts
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 18. Final Integration Testing
  - [ ]* 18.1 End-to-end workflow test
    - Test complete workflow: dataset validation → training → validation → deployment → monitoring
    - Verify all database records are created correctly
    - Verify model files are stored in correct locations
    - Verify API endpoints return expected responses
    - _Requirements: All requirements_
  
  - [ ]* 18.2 Production readiness test
    - Test system handles 47-image dataset correctly
    - Test model achieves minimum 97% mAP50 on validation
    - Test GPU inference achieves minimum 30 FPS
    - Test CPU inference achieves minimum 5 FPS
    - Test monitoring detects anomalies correctly
    - Test deployment rollback works correctly
    - _Requirements: 3.2, 3.3, 5.2, 5.3, 13.1, 13.2, 7.4, 7.5, 8.5, 8.6_
  
  - [ ]* 18.3 Multi-camera stress test
    - Test system handles multiple concurrent camera streams
    - Test inference workload distribution across GPUs
    - Test per-camera configuration isolation
    - Test failure isolation (one camera failure doesn't affect others)
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_

- [~] 19. Final checkpoint - Production deployment
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- The system uses Python with PyTorch and Ultralytics YOLO for all ML operations
- Database migrations use Alembic for version control
- API endpoints follow RESTful conventions
- All components include comprehensive error handling and logging
- The system integrates seamlessly with existing realtime_counter.py and detection.py modules
- Production deployment requires GPU for optimal performance (30+ FPS), but CPU fallback is supported (5+ FPS)

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"]
    },
    {
      "id": 1,
      "tasks": ["2.1", "15.1", "15.2"]
    },
    {
      "id": 2,
      "tasks": ["2.2", "2.3", "3.1", "3.2", "6.1", "6.2"]
    },
    {
      "id": 3,
      "tasks": ["2.4", "3.3", "3.4", "5.1", "6.3", "7.1"]
    },
    {
      "id": 4,
      "tasks": ["3.5", "5.2", "5.3", "7.2", "7.3"]
    },
    {
      "id": 5,
      "tasks": ["5.4", "5.5", "7.4", "9.1", "9.2", "10.1"]
    },
    {
      "id": 6,
      "tasks": ["7.5", "9.3", "9.4", "10.2", "10.3", "11.1"]
    },
    {
      "id": 7,
      "tasks": ["9.5", "10.4", "11.2", "12.1", "12.2"]
    },
    {
      "id": 8,
      "tasks": ["11.3", "12.3", "12.4", "14.1", "14.2"]
    },
    {
      "id": 9,
      "tasks": ["12.5", "14.3", "15.3", "16.1"]
    },
    {
      "id": 10,
      "tasks": ["14.4", "16.2", "17.1", "17.2"]
    },
    {
      "id": 11,
      "tasks": ["16.3", "17.3", "18.1"]
    },
    {
      "id": 12,
      "tasks": ["18.2", "18.3"]
    }
  ]
}
```
