# Requirements Document

## Introduction

This document specifies the requirements for improving the IntelliVision video feed display interface. The IntelliVision system provides real-time camera monitoring for depot operations, displaying 6 camera feeds in a 3x2 grid layout with AI-powered detection overlays. The current interface underutilizes available screen space, with video feeds appearing smaller than necessary and a log section consuming valuable vertical space. This feature will optimize the interface to maximize video feed visibility while maintaining all existing detection and monitoring capabilities.

## Glossary

- **Video_Feed_Component**: The React component that renders individual camera video streams with detection overlays (VideoFeed.tsx)
- **Camera_Grid_Component**: The parent React component that manages the 3x2 grid layout of video feeds (CameraGrid.tsx)
- **LPR_Detection_Log**: The "Recent LPR Detections" section displaying license plate recognition events at the bottom of the interface
- **Detection_Overlay**: Visual indicators (badges, bounding boxes) displayed on top of video feeds showing detected objects (vehicles, workers, cement bags)
- **Metrics_Bar**: The horizontal bar displaying aggregate counts (Vehicles, Workers, Cement Bags, Active Feeds)
- **Grid_Layout**: The 3x2 arrangement of video feeds (3 columns, 2 rows, 6 total feeds)
- **Screen_Space**: The available viewport area within the browser window for displaying the camera interface
- **Video_Height**: The vertical dimension (in pixels or CSS units) of each individual video feed container

## Requirements

### Requirement 1: Increase Video Feed Height

**User Story:** As a depot operator, I want larger video feeds that fill more of the screen vertically, so that I can see camera footage more clearly and identify details more easily.

#### Acceptance Criteria

1. THE Video_Feed_Component SHALL increase its height from 180px to a larger value that better utilizes available Screen_Space
2. THE Camera_Grid_Component SHALL maintain the 3x2 Grid_Layout with 6 video feeds after height changes
3. THE Video_Feed_Component SHALL preserve the aspect ratio of video content when rendering at increased height
4. THE Detection_Overlay SHALL remain properly positioned and scaled relative to the increased Video_Height
5. THE Camera_Grid_Component SHALL ensure all 6 video feeds remain visible without requiring vertical scrolling on standard desktop screens (1920x1080 or larger)

### Requirement 2: Remove LPR Detection Log Section

**User Story:** As a depot operator, I want the LPR detection log removed from the main camera view, so that more screen space is available for video feeds.

#### Acceptance Criteria

1. THE Camera_Grid_Component SHALL NOT render the LPR_Detection_Log section at the bottom of the interface
2. THE Camera_Grid_Component SHALL reclaim the vertical space previously occupied by the LPR_Detection_Log for video feed display
3. THE Camera_Grid_Component SHALL continue to track and count LPR detections internally for the Metrics_Bar display
4. THE Video_Feed_Component SHALL continue to display the most recent license plate detection as an overlay badge on individual camera feeds
5. THE Camera_Grid_Component SHALL maintain all existing LPR detection callback functionality for future feature integration

### Requirement 3: Optimize Screen Space Utilization

**User Story:** As a depot operator, I want the camera grid to use available screen space more effectively, so that I can monitor depot operations with maximum visibility.

#### Acceptance Criteria

1. THE Camera_Grid_Component SHALL calculate Video_Height dynamically based on available Screen_Space minus header and Metrics_Bar height
2. THE Camera_Grid_Component SHALL maintain consistent gap spacing (gap-2 / 8px) between video feeds in the Grid_Layout
3. THE Camera_Grid_Component SHALL ensure the Metrics_Bar and header remain visible at the top of the interface
4. THE Video_Feed_Component SHALL use CSS object-fit properties to ensure video content fills the container without distortion
5. THE Camera_Grid_Component SHALL remain responsive and functional on screen resolutions from 1920x1080 to 4K (3840x2160)

### Requirement 4: Preserve Existing Functionality

**User Story:** As a depot operator, I want all current detection and monitoring features to continue working after UI improvements, so that operational capabilities are not disrupted.

#### Acceptance Criteria

1. THE Video_Feed_Component SHALL continue to display real-time detection overlays (vehicles, workers, cement bags) at the increased Video_Height
2. THE Camera_Grid_Component SHALL continue to aggregate and display detection counts in the Metrics_Bar
3. THE Video_Feed_Component SHALL continue to display camera status indicators (LIVE, OFFLINE, CONNECTING) in the same position
4. THE Video_Feed_Component SHALL continue to display camera names and latest plate detections as overlay badges
5. THE Camera_Grid_Component SHALL maintain all existing callback handlers (onDetectionUpdate, onPlateDetected) without modification to their signatures

### Requirement 5: Maintain Production Stability

**User Story:** As a system administrator, I want UI changes to be implemented safely without breaking existing functionality, so that the production system remains stable and reliable.

#### Acceptance Criteria

1. THE Camera_Grid_Component SHALL NOT modify any detection logic, AI model loading, or backend API integration code
2. THE Video_Feed_Component SHALL NOT alter video streaming, canvas rendering, or frame processing logic
3. THE Camera_Grid_Component SHALL maintain all existing TypeScript type definitions and component interfaces
4. THE Video_Feed_Component SHALL preserve all existing CSS class names used by parent components or external stylesheets
5. THE Camera_Grid_Component SHALL ensure changes are limited to layout styling (Tailwind CSS classes) and conditional rendering of the LPR_Detection_Log section

## Notes

### Implementation Guidance

The requirements focus on CSS/layout changes rather than functional logic changes. The primary modifications will be:

1. **Video height adjustment**: Change the `h-[180px]` class in VideoFeed.tsx to a larger value (e.g., `h-[280px]` or `h-[320px]`)
2. **LPR log removal**: Add a conditional check in CameraGrid.tsx to skip rendering the LPR log section while preserving the `plateLog` state and related logic
3. **Grid layout optimization**: Adjust the `flex-1` and gap properties in the grid container to maximize space utilization

### Testing Considerations

- Test on multiple screen resolutions (1920x1080, 2560x1440, 3840x2160)
- Verify detection overlays remain properly positioned at new video heights
- Confirm all 6 feeds remain visible without scrolling
- Validate that removing the LPR log doesn't break plate detection callbacks
- Check that metrics bar continues to update correctly

### Future Enhancements

While out of scope for this feature, potential future improvements could include:

- Making video height configurable via user preferences
- Adding a collapsible/expandable LPR log accessible via a button
- Implementing fullscreen mode for individual camera feeds
- Adding responsive breakpoints for smaller screens (tablets, laptops)
