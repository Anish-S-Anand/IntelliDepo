# Design Document: IntelliVision Video Feed UI Improvements

## Overview

This design specifies the implementation approach for optimizing the IntelliVision camera monitoring interface by increasing video feed height and removing the LPR detection log section. The changes focus exclusively on CSS styling and conditional rendering to maximize screen space utilization while preserving all existing detection, streaming, and monitoring functionality.

### Design Goals

1. **Maximize Video Visibility**: Increase individual video feed height from 180px to utilize more vertical screen space
2. **Reclaim Wasted Space**: Remove the LPR detection log section that consumes valuable vertical space
3. **Maintain Functionality**: Preserve all detection overlays, metrics tracking, and callback handlers
4. **Ensure Production Safety**: Limit changes to CSS classes and conditional rendering only
5. **Support Standard Resolutions**: Ensure all 6 feeds fit without scrolling on 1920x1080 screens

### Scope

**In Scope:**
- Modifying video feed height CSS class in VideoFeed.tsx
- Adding conditional rendering to hide LPR log section in CameraGrid.tsx
- Adjusting grid layout properties for optimal space utilization
- Verifying detection overlays scale correctly at new heights

**Out of Scope:**
- Changes to video streaming, canvas rendering, or frame processing logic
- Modifications to detection algorithms, AI model loading, or backend APIs
- Alterations to TypeScript interfaces, component props, or callback signatures
- Responsive design for mobile/tablet screens (desktop-only optimization)
- User-configurable video height settings

## Architecture

### Component Hierarchy

```
CameraGrid (Parent Container)
├── Header Section
│   ├── Title + Camera Count Badge
│   └── ModelStatus Component
├── Metrics Bar
│   ├── Vehicles Count
│   ├── Workers Count
│   ├── Cement Bags Count
│   ├── Active Feeds Count
│   └── Plates Detected Count (conditional)
├── Grid Container (3x2 layout)
│   ├── VideoFeed #1 (with detection overlays)
│   ├── VideoFeed #2 (with detection overlays)
│   ├── VideoFeed #3 (with detection overlays)
│   ├── VideoFeed #4 (with detection overlays)
│   ├── VideoFeed #5 (with detection overlays)
│   └── VideoFeed #6 (with detection overlays)
└── LPR Log Section (TO BE REMOVED)
```

### Layout Calculation

**Current Layout (Before Changes):**
```
Total Viewport Height: 1080px
├── Header: ~40px
├── Metrics Bar: ~50px
├── Grid Container: ~380px (2 rows × 180px + gaps)
├── LPR Log Section: ~100px
└── Padding/Margins: ~20px
Total Used: ~590px (490px wasted)
```

**Optimized Layout (After Changes):**
```
Total Viewport Height: 1080px
├── Header: ~40px
├── Metrics Bar: ~50px
├── Grid Container: ~960px (2 rows × 460px + gaps)
└── Padding/Margins: ~30px
Total Used: ~1080px (maximized)
```

**Video Height Calculation:**
```
Available Height = Viewport Height - Header - Metrics Bar - Padding - Gaps
Available Height = 1080px - 40px - 50px - 30px - 16px (2 gaps × 8px)
Available Height = 944px

Per-Row Height = 944px / 2 rows = 472px
Safe Video Height = 460px (with 12px buffer for browser chrome)
```

### CSS Class Changes

**VideoFeed.tsx:**
- **Current**: `h-[180px]`
- **New**: `h-[460px]`
- **Rationale**: Calculated to maximize vertical space while ensuring 2 rows fit on 1920x1080 screens

**CameraGrid.tsx:**
- **Grid Container**: Maintain `flex-1` to fill available space
- **Grid Layout**: Keep `grid-cols-3 gap-2` (3 columns, 8px gaps)
- **LPR Log Section**: Add conditional rendering to skip this block

## Components and Interfaces

### VideoFeed Component

**File**: `frontend/src/components/depot/cameras/VideoFeed.tsx`

**Interface** (unchanged):
```typescript
interface VideoFeedProps {
  name: string;
  cameraId: string;
  videoFile?: string;
  cameraIndex: number;
  offline?: boolean;
  onDetectionUpdate?: (vehicles: Array<{ 
    bbox: [number, number, number, number]; 
    class: string; 
    score: number 
  }>) => void;
  onPlateDetected?: (plate: string) => void;
}
```

**Modification**:
```typescript
// Line 127: Change container height class
// BEFORE:
<div className="relative h-[180px] overflow-hidden rounded-md bg-black">

// AFTER:
<div className="relative h-[460px] overflow-hidden rounded-md bg-black">
```

**Impact Analysis**:
- Canvas elements use `width: 100%, height: 100%` → will scale automatically
- Detection overlays use absolute positioning → will maintain relative positions
- Status badges use absolute positioning with `bottom-0` → will remain at bottom
- Video aspect ratio preserved via `objectFit: cover` → no distortion

### CameraGrid Component

**File**: `frontend/src/components/depot/cameras/CameraGrid.tsx`

**State Management** (unchanged):
```typescript
const [plateLog, setPlateLog] = useState<Array<{
  time: string; 
  camera: string; 
  plate: string 
}>>([]);
```

**Callback Handlers** (unchanged):
```typescript
const handlePlateDetected = useCallback(
  (cameraIndex: number, cameraName: string, plate: string) => {
    setPlateLog((prev) => [
      { time: new Date().toLocaleTimeString(), camera: cameraName, plate },
      ...prev.slice(0, 19),
    ]);
    // ... rest of logic
  },
  [],
);
```

**Modification**:
```typescript
// Lines 215-228: Remove LPR Log Section rendering
// BEFORE:
{plateLog.length > 0 && (
  <div className="rounded bg-[#111827] p-2">
    <div className="text-[10px] font-bold text-white/60 mb-1.5">Recent LPR Detections</div>
    <div className="flex flex-col gap-1 max-h-20 overflow-y-auto">
      {plateLog.slice(0, 5).map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-[9px]">
          <span className="text-white/40">{entry.time}</span>
          <span className="text-white/60">{entry.camera}</span>
          <span className="font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">
            {entry.plate}
          </span>
        </div>
      ))}
    </div>
  </div>
)}

// AFTER:
{/* LPR Log Section removed to maximize video feed space */}
{/* plateLog state and handlePlateDetected callback preserved for future features */}
```

**Preserved Elements**:
- `plateLog` state array (lines 109)
- `handlePlateDetected` callback (lines 145-157)
- Metrics bar "Plates Detected" count (lines 183-189)
- Individual camera plate overlay badges (lines 207-211)

## Data Models

### Detection Counts Interface

```typescript
interface DetectionCounts {
  vehicles: number;
  workers: number;
  cementBags: number;
  plates: string[];  // Array of detected plates (most recent first)
}
```

**Usage**: Stored in `detections` state object keyed by camera index:
```typescript
const [detections, setDetections] = useState<Record<number, DetectionCounts>>({});
```

### Plate Log Entry Interface

```typescript
interface PlateLogEntry {
  time: string;      // Formatted timestamp (e.g., "2:45:30 PM")
  camera: string;    // Camera name (e.g., "Gate Entry North - LPR")
  plate: string;     // License plate string (e.g., "MH 12 AB 3456")
}
```

**Usage**: Stored in `plateLog` state array (preserved but not rendered):
```typescript
const [plateLog, setPlateLog] = useState<PlateLogEntry[]>([]);
```

### Camera Data Interface

```typescript
interface CameraData {
  id: string;           // Unique camera identifier
  name: string;         // Display name
  stream_url?: string;  // Backend stream URL (optional)
  videoFile?: string;   // Local video file name (optional)
}
```

## Testing Strategy

### Manual Testing Checklist

**Visual Verification (1920x1080 screen):**
1. ✓ All 6 video feeds visible without vertical scrolling
2. ✓ Video feeds appear larger and more readable
3. ✓ Detection overlays (vehicle/worker/bag badges) properly positioned
4. ✓ License plate overlay badges visible in top-right corner
5. ✓ Camera status indicators (LIVE/OFFLINE) visible at bottom
6. ✓ No visual artifacts or layout breaks

**Functional Verification:**
1. ✓ Detection counts update correctly in metrics bar
2. ✓ "Plates Detected" count increments when plates detected
3. ✓ Individual camera plate badges show most recent detection
4. ✓ Video streaming continues without interruption
5. ✓ Canvas rendering and detection overlays work correctly
6. ✓ No console errors or warnings

**Resolution Testing:**
- **1920x1080** (primary target): All 6 feeds fit, no scrolling
- **2560x1440**: Verify increased space doesn't cause layout issues
- **3840x2160** (4K): Ensure scaling remains proportional

**Browser Testing:**
- Chrome (primary)
- Firefox
- Edge
- Safari (if available)

### Unit Testing

**Not Required** - Changes are CSS-only and don't affect component logic. Manual visual testing is sufficient for this feature.

### Integration Testing

**Not Required** - No changes to API calls, state management logic, or callback signatures. Existing integration tests remain valid.

## Error Handling

### Potential Issues and Mitigations

**Issue 1: Video feeds don't fit on smaller screens**
- **Detection**: Manual testing on 1920x1080 screen
- **Mitigation**: Reduce height from 460px to 440px if needed
- **Fallback**: Revert to 180px if layout breaks

**Issue 2: Detection overlays misaligned at new height**
- **Detection**: Visual inspection of badge positions
- **Mitigation**: Overlays use relative positioning, should scale automatically
- **Fallback**: No code changes needed (overlays are already responsive)

**Issue 3: Canvas rendering issues at larger dimensions**
- **Detection**: Check for canvas drawing errors in console
- **Mitigation**: Canvas uses percentage-based sizing, should scale automatically
- **Fallback**: No changes to canvas logic required

**Issue 4: Metrics bar "Plates Detected" count stops updating**
- **Detection**: Verify count increments when plates detected
- **Mitigation**: Ensure `handlePlateDetected` callback still updates `plateLog` state
- **Fallback**: Callback logic unchanged, should work correctly

## Implementation Plan

### Phase 1: Video Height Increase

**File**: `frontend/src/components/depot/cameras/VideoFeed.tsx`

**Change**:
```typescript
// Line 127
- <div className="relative h-[180px] overflow-hidden rounded-md bg-black">
+ <div className="relative h-[460px] overflow-hidden rounded-md bg-black">
```

**Verification**:
1. Start development server: `npm run dev`
2. Navigate to IntelliVision camera page
3. Verify all 6 feeds visible without scrolling
4. Check detection overlays properly positioned
5. Confirm video streaming works correctly

### Phase 2: LPR Log Removal

**File**: `frontend/src/components/depot/cameras/CameraGrid.tsx`

**Change**:
```typescript
// Lines 215-228: Replace entire LPR log section with comment
- {plateLog.length > 0 && (
-   <div className="rounded bg-[#111827] p-2">
-     {/* ... entire log rendering block ... */}
-   </div>
- )}
+ {/* LPR Log Section removed to maximize video feed space */}
+ {/* plateLog state and handlePlateDetected callback preserved for future features */}
```

**Verification**:
1. Confirm LPR log section no longer visible
2. Verify "Plates Detected" count still appears in metrics bar
3. Check individual camera plate badges still show latest detection
4. Confirm no console errors related to plateLog state

### Phase 3: Final Testing

**Cross-Resolution Testing**:
1. Test on 1920x1080 screen (primary target)
2. Test on 2560x1440 screen (verify no layout issues)
3. Test on 3840x2160 screen (verify scaling)

**Cross-Browser Testing**:
1. Chrome (primary browser)
2. Firefox
3. Edge
4. Safari (if available)

**Functional Testing**:
1. Verify all detection types work (vehicles, workers, bags)
2. Confirm plate detection callbacks fire correctly
3. Check metrics bar updates in real-time
4. Validate video streaming stability

## Rollback Plan

**If issues occur in production:**

1. **Immediate Rollback** (revert both changes):
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Partial Rollback** (revert only video height):
   ```typescript
   // VideoFeed.tsx line 127
   - <div className="relative h-[460px] overflow-hidden rounded-md bg-black">
   + <div className="relative h-[180px] overflow-hidden rounded-md bg-black">
   ```

3. **Partial Rollback** (restore LPR log):
   ```typescript
   // CameraGrid.tsx lines 215-228
   // Restore original LPR log rendering block
   ```

**Rollback Triggers**:
- Video feeds don't fit on 1920x1080 screens
- Detection overlays misaligned or not visible
- Video streaming breaks or becomes unstable
- Console errors related to canvas rendering
- Metrics bar stops updating correctly

## Deployment Considerations

### Pre-Deployment Checklist

- [ ] Code changes reviewed and approved
- [ ] Manual testing completed on all target resolutions
- [ ] Cross-browser testing completed
- [ ] No console errors or warnings
- [ ] Detection functionality verified working
- [ ] Metrics bar updates correctly
- [ ] Video streaming stable

### Deployment Steps

1. **Merge to main branch**
   ```bash
   git checkout main
   git merge feature/intellivision-video-feed-ui-improvements
   ```

2. **Build production bundle**
   ```bash
   cd frontend
   npm run build
   ```

3. **Deploy to production**
   ```bash
   # Follow standard deployment process
   ```

4. **Post-Deployment Verification**
   - Access production IntelliVision page
   - Verify video feeds display at increased height
   - Confirm LPR log section removed
   - Check all detection features working
   - Monitor for errors in production logs

### Monitoring

**Metrics to Watch**:
- Frontend error rates (should remain unchanged)
- Video streaming stability (should remain unchanged)
- Detection callback success rates (should remain unchanged)
- User feedback on visibility improvements

**Success Criteria**:
- All 6 video feeds visible without scrolling on 1920x1080 screens
- No increase in frontend errors or warnings
- Detection functionality unchanged
- Positive user feedback on improved visibility

## Future Enhancements

While out of scope for this feature, potential future improvements include:

1. **Configurable Video Height**: User preference setting to adjust video feed size
2. **Collapsible LPR Log**: Button to show/hide LPR log on demand
3. **Fullscreen Mode**: Expand individual camera feed to full screen
4. **Responsive Design**: Optimize layout for tablet and laptop screens
5. **Grid Layout Options**: Allow 2x3, 4x2, or custom grid configurations
6. **Picture-in-Picture**: Detach individual feeds to separate windows
7. **Recording Playback**: Scrub through historical footage with timeline
8. **Multi-Monitor Support**: Span camera grid across multiple displays

## Appendix

### File Modification Summary

| File | Lines Changed | Type | Description |
|------|---------------|------|-------------|
| `VideoFeed.tsx` | 127 | CSS | Change `h-[180px]` to `h-[460px]` |
| `CameraGrid.tsx` | 215-228 | Conditional Rendering | Remove LPR log section block |

### CSS Class Reference

**Tailwind Classes Used**:
- `h-[180px]` → `h-[460px]`: Fixed height in pixels
- `flex-1`: Flex grow to fill available space
- `grid-cols-3`: 3-column grid layout
- `gap-2`: 8px gap between grid items (0.5rem × 4 = 8px)
- `overflow-hidden`: Hide overflow content
- `rounded-md`: Medium border radius
- `bg-black`: Black background color

### Screen Resolution Reference

| Resolution | Width | Height | Target Support |
|------------|-------|--------|----------------|
| 1920x1080 | 1920px | 1080px | ✓ Primary |
| 2560x1440 | 2560px | 1440px | ✓ Secondary |
| 3840x2160 | 3840px | 2160px | ✓ Tertiary |
| 1366x768 | 1366px | 768px | ✗ Not supported |
| 1280x720 | 1280px | 720px | ✗ Not supported |

### Browser Compatibility

| Browser | Version | Support Level |
|---------|---------|---------------|
| Chrome | 90+ | ✓ Full |
| Firefox | 88+ | ✓ Full |
| Edge | 90+ | ✓ Full |
| Safari | 14+ | ✓ Full |
| Opera | 76+ | ✓ Full |

### Related Documentation

- [IntelliVision Requirements Document](.kiro/specs/intellivision-video-feed-ui-improvements/requirements.md)
- [VideoFeed Component Source](frontend/src/components/depot/cameras/VideoFeed.tsx)
- [CameraGrid Component Source](frontend/src/components/depot/cameras/CameraGrid.tsx)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
