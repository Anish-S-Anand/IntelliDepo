# Frontend UI Performance & Theming Fixes - Bugfix Design

## Overview

This design addresses 7 critical frontend bugs affecting the IntelliDepot platform: performance degradation during navigation, light theme visibility issues, missing landing page video hero, mobile responsiveness failures, non-functional LPR camera feeds, login page theme switching problems, and chart integration issues. The fix strategy focuses on targeted optimizations using Next.js 14 features, CSS variable corrections, HLS.js video streaming, Tailwind responsive utilities, backend API integration for camera feeds, and iframe-based chart embedding.

## Glossary

- **Bug_Condition (C)**: The conditions that trigger each of the 7 bugs
- **Property (P)**: The desired correct behavior for each bug category
- **Preservation**: Existing dark theme, desktop layouts, and non-buggy functionality that must remain unchanged
- **Next.js App Router**: The routing system in Next.js 14 used for navigation
- **CSS Custom Properties**: CSS variables (--variable-name) used for theming
- **HLS.js**: HTTP Live Streaming library for video playback (v1.6.16)
- **Tailwind Breakpoints**: Responsive design breakpoints (xs: 375px, sm: 640px, md: 768px, lg: 1024px)
- **LPR**: License Plate Recognition system integrated with backend
- **MJPEG Stream**: Motion JPEG video streaming format for camera feeds
- **Framer Motion**: Animation library (v12.38.0) for landing page interactions

## Bug Details

### Bug Condition

The bugs manifest across 7 distinct categories, each with specific trigger conditions:

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ApplicationContext
  OUTPUT: boolean
  
  RETURN (
    // C1: Performance Bug
    (input.eventType = "route_change" AND input.transitionTime > 300ms) OR
    
    // C2: Light Theme Bug
    (input.theme = "light" AND input.textContrast < 4.5) OR
    
    // C3: Landing Page Bug
    (input.route = "/" AND input.videoHero = false) OR
    
    // C4: Mobile Bug
    (input.viewportWidth <= 768 AND input.responsive = false) OR
    
    // C5: Camera/LPR Bug
    (input.component = "VideoFeed" AND input.videoLoading = false) OR
    
    // C6: Login Theme Bug
    (input.route = "/login" AND input.themeApplied = false) OR
    
    // C7: Chart Integration Bug
    (input.chartType = "fidelis_chart" AND input.integrated = false)
  )
END FUNCTION
```

### Examples

**Example 1: Performance Issue**
- **Trigger**: User clicks navigation from Dashboard to Operations Hub
- **Current Behavior**: 2-3 second delay, sluggish transition, no loading indicators
- **Root Cause**: No route prefetching, no loading states, heavy component re-renders

**Example 2: Light Theme Visibility**
- **Trigger**: User activates light theme toggle
- **Current Behavior**: UI remains dark bluish (#0D1526, #14203A), text barely visible
- **Root Cause**: CSS overrides in globals.css use hardcoded dark colors that don't respect theme class

**Example 3: Landing Page**
- **Trigger**: User visits root URL "/"
- **Current Behavior**: Static page, no video, minimal animation
- **Root Cause**: Video element references non-existent /logo_intro.mp4, no fallback

**Example 4: Mobile Responsiveness**
- **Trigger**: User accesses application on iPhone (viewport width 375px)
- **Current Behavior**: Desktop layout squeezed, sidebar overlaps content, text too small
- **Root Cause**: Missing responsive classes, fixed widths, no mobile-specific layouts

**Example 5: LPR Camera Feed**
- **Trigger**: User navigates to IntelliVision Camera section
- **Current Behavior**: Black screens, no video loading, "OFFLINE" status
- **Root Cause**: Incorrect API endpoint construction, missing CORS headers, snapshot polling fails

**Example 6: Login Theme Switching**
- **Trigger**: User toggles theme on login page
- **Current Behavior**: Theme doesn't apply properly, text visibility issues
- **Root Cause**: Inline styles override theme variables, missing theme-aware color calculations

**Example 7: Chart Integration**
- **Trigger**: User accesses page with fidelis chart on mobile device
- **Current Behavior**: Chart not integrated, not mobile responsive
- **Root Cause**: HTML file not embedded, no responsive iframe wrapper

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Dark theme colors and styling must remain exactly as currently implemented
- Desktop layouts (viewport > 1024px) must display identically to current state
- Existing API endpoints and data structures must remain unchanged
- Authentication flow and session management must continue working as-is
- Non-camera components (KPIs, charts, forms) must function identically
- Sidebar navigation structure and routing must remain unchanged

**Scope:**
All inputs that do NOT involve the 7 bug conditions should be completely unaffected by this fix. This includes:
- Dark theme usage (most common user scenario)
- Desktop browser access (primary use case)
- Non-video components and pages
- Existing data visualization (Recharts components)
- Authentication and authorization flows
- Backend API communication patterns

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

### 1. Performance Issues

**Root Cause Category: Unoptimized Next.js Configuration**
- No route prefetching enabled in next.config.mjs
- Missing loading.tsx files for route segments
- Heavy component re-renders without React.memo or useMemo
- No code splitting for large dependencies (TensorFlow.js, Three.js)
- Synchronous data fetching blocking navigation

**Evidence from Code:**
- `next.config.mjs` has `optimizePackageImports` but no prefetch configuration
- No `loading.tsx` files found in app directory structure
- Components like VideoFeed re-render on every parent update

### 2. Light Theme Visibility

**Root Cause Category: CSS Specificity and Hardcoded Colors**
- `globals.css` contains hardcoded dark colors (#0D1526, #14203A) in arbitrary Tailwind classes
- CSS overrides use `!important` which prevents theme variables from applying
- Light theme CSS variables defined but overridden by specific selectors
- Text color overrides force dark text in light mode

**Evidence from Code:**
```css
/* From globals.css - these override theme variables */
html:not(.dark) [class*="bg-[#0D1526]"] {
  background-color: #F0F4FA !important;
}
```

### 3. Landing Page Video

**Root Cause Category: Missing Video Asset and Fallback**
- Video source `/logo_intro.mp4` not present in public directory
- No error handling for missing video
- No fallback content when video fails to load
- Video autoplay may be blocked by browser policies

**Evidence from Code:**
```tsx
// From intelli-landing.tsx
<source src="/logo_intro.mp4" type="video/mp4" />
// No fallback, no error handling
```

### 4. Mobile Responsiveness

**Root Cause Category: Fixed Widths and Missing Responsive Classes**
- Sidebar uses fixed width without mobile breakpoint handling
- Grid layouts use fixed column counts without responsive variants
- Text sizes don't scale for mobile viewports
- No mobile-specific navigation patterns

**Evidence from Code:**
```css
/* From globals.css - sidebar not responsive */
.depot-sidebar {
  position: fixed !important;
  width: 280px !important; /* Fixed width */
}
```

### 5. LPR/Camera Feeds

**Root Cause Category: API Endpoint Construction and CORS**
- `getBackendBase()` function constructs incorrect URLs
- Snapshot endpoint polling fails due to CORS or 404 errors
- No retry logic for failed video loads
- Backend API may not be serving video endpoints correctly

**Evidence from Code:**
```tsx
// From VideoFeed.tsx
const snapshotUrl = videoFile
  ? `/backend/depot/vision/cameras/video-library/${encodeURIComponent(videoFile)}/snapshot?seek=${seekSeconds}`
  : `${getBackendBase()}/depot/vision/cameras/${cameraId}/snapshot?seek=${seekSeconds}`;
```

### 6. Login Theme Switching

**Root Cause Category: Inline Styles Override Theme Variables**
- Login page uses inline `style` props that calculate colors based on theme
- These calculations happen once on mount, not on theme change
- Theme toggle doesn't trigger re-render of styled elements
- CSS variables not used consistently

**Evidence from Code:**
```tsx
// From login/page.tsx
const pageBg = isDark ? "#010810" : "#F0F4FA";
// These are calculated once, not reactive to theme changes
```

### 7. Chart Integration

**Root Cause Category: HTML File Not Embedded**
- `fidelis_chart_updated (1).html` exists in root but not integrated
- No iframe or component to display the chart
- Chart HTML not responsive (fixed widths)
- No route or page created for chart display

**Evidence from Code:**
- File exists: `fidelis_chart_updated (1).html`
- No references found in frontend codebase
- No chart route in app directory

## Correctness Properties

Property 1: Bug Condition - Performance Optimization

_For any_ navigation event where route changes occur, the fixed application SHALL complete transitions in < 300ms with smooth loading states, prefetched routes, and optimized component rendering.

**Validates: Requirements 2.1.1, 2.1.2, 2.1.3**

Property 2: Bug Condition - Light Theme Visibility

_For any_ theme state where light theme is active, the fixed application SHALL display distinct light colors (whites, light grays) with text contrast ratio ≥ 4.5:1 and no dark bluish colors.

**Validates: Requirements 2.2.1, 2.2.2, 2.2.3, 2.2.4**

Property 3: Bug Condition - Landing Page Video Hero

_For any_ page load where the landing page is accessed, the fixed application SHALL display a looping logo_intro.mp4 video hero with animated interactive elements.

**Validates: Requirements 2.3.1, 2.3.2, 2.3.3**

Property 4: Bug Condition - Mobile Responsiveness

_For any_ viewport where width ≤ 768px, the fixed application SHALL display fully responsive layouts with adapted components, readable text, and mobile-optimized navigation.

**Validates: Requirements 2.4.1, 2.4.2, 2.4.3**

Property 5: Bug Condition - LPR Camera Feeds

_For any_ component where VideoFeed is rendered, the fixed application SHALL display live video streams without black screens, with correct backend integration and functional LPR recognition.

**Validates: Requirements 2.5.1, 2.5.2, 2.5.3, 2.5.4**

Property 6: Bug Condition - Login Theme Switching

_For any_ theme toggle event on the login page, the fixed application SHALL properly apply theme changes with correct colors, backgrounds, and text visibility.

**Validates: Requirements 2.6.1, 2.6.2, 2.6.3**

Property 7: Bug Condition - Chart Integration

_For any_ chart display where fidelis chart is accessed, the fixed application SHALL properly integrate the chart with mobile-responsive rendering.

**Validates: Requirements 2.7.1, 2.7.2, 2.7.3**

Property 8: Preservation - Non-Buggy Behavior

_For any_ input that does NOT match the 7 bug conditions (dark theme, desktop layouts, non-video components, existing functionality), the fixed application SHALL produce exactly the same behavior as the original application.

**Validates: Requirements 3.1.1, 3.1.2, 3.1.3, 3.2.1, 3.2.2, 3.2.3, 3.3.1, 3.3.2, 3.3.3, 3.4.1, 3.4.2, 3.4.3, 3.5.1, 3.5.2, 3.5.3, 3.6.1, 3.6.2, 3.6.3, 3.7.1, 3.7.2, 3.7.3**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

#### 1. Performance Optimization

**File**: `frontend/next.config.mjs`

**Function**: Next.js configuration

**Specific Changes**:
1. **Enable Route Prefetching**: Add `experimental.optimizeCss: true` and configure link prefetching
   - Enable automatic prefetching for Link components
   - Add `prefetch={true}` to critical navigation links

2. **Add Loading States**: Create `loading.tsx` files for each route segment
   - `frontend/src/app/depot/loading.tsx` - skeleton for depot pages
   - `frontend/src/app/platform/loading.tsx` - skeleton for platform pages
   - Use Suspense boundaries for async components

3. **Optimize Component Rendering**: Wrap heavy components with React.memo
   - Memoize VideoFeed component to prevent unnecessary re-renders
   - Use useMemo for expensive calculations in dashboard KPIs
   - Implement useCallback for event handlers

4. **Code Splitting**: Configure dynamic imports for large dependencies
   - Lazy load TensorFlow.js only when camera page is accessed
   - Dynamic import Three.js for 3D visualizations
   - Split chart libraries per route

5. **Add Transition Indicators**: Implement loading progress bar
   - Use NProgress or custom loading bar component
   - Show skeleton screens during route transitions

#### 2. Light Theme Visibility

**File**: `frontend/src/app/globals.css`

**Function**: Theme CSS variables and overrides

**Specific Changes**:
1. **Remove Hardcoded Dark Colors**: Replace all `bg-[#0D1526]` style arbitrary values with CSS variables
   - Replace `bg-[#0D1526]` with `theme-bg-surface` utility class
   - Replace `bg-[#14203A]` with `theme-bg-card` utility class
   - Remove `!important` flags that prevent theme switching

2. **Fix Light Theme Text Contrast**: Update light theme CSS variables
   - Change `--text-primary` in `:root` from `#0D1117` to ensure 4.5:1 contrast
   - Update `--text-secondary` to `#1F2937` for better readability
   - Ensure all text colors meet WCAG AA standards

3. **Update Component Classes**: Replace inline color styles with theme-aware classes
   - Convert `text-[#E8EDF8]` to `theme-text-primary`
   - Convert `border-[#1E2F50]` to `theme-border`
   - Use Tailwind's `dark:` prefix for theme-specific styles

4. **Test Contrast Ratios**: Verify all text/background combinations
   - Light theme: dark text (#0D1117) on light backgrounds (#FFFFFF, #F0F4FA)
   - Ensure buttons, inputs, and cards have sufficient contrast

5. **Fix Button Visibility Across Entire Frontend**: Add comprehensive button styling rules
   - **Light Theme Buttons**: 
     - Primary buttons: Strong border (2px solid #D1D5DB), dark text (#0D1117), white background
     - Secondary buttons: Medium border (1.5px solid #9CA3AF), dark text, light gray background (#F9FAFB)
     - Accent buttons: Keep existing accent color (#E5521A) with white text
     - Hover states: Darken border and background slightly
   - **Dark Theme Buttons**:
     - Primary buttons: Visible border (#2A3F68), light text (#E8EDF8), dark background (#14203A)
     - Secondary buttons: Subtle border (#1E2F50), muted text (#A0B0D0), darker background (#0F1A30)
     - Accent buttons: Keep existing accent color with white text
     - Hover states: Brighten border and background
   - **Button Classes to Add**:
     ```css
     /* Light theme button overrides */
     html:not(.dark) button:not([class*="bg-[#E5521A]"]):not([class*="bg-blue"]):not([class*="bg-emerald"]):not([class*="bg-red"]) {
       border-width: 2px !important;
       border-color: #D1D5DB !important;
       color: #0D1117 !important;
       font-weight: 700 !important;
     }
     
     html:not(.dark) button:not([class*="bg-[#E5521A]"]):not([class*="bg-blue"]):not([class*="bg-emerald"]):not([class*="bg-red"]):hover {
       border-color: #9CA3AF !important;
       background-color: #F3F4F6 !important;
     }
     
     /* Dark theme button enhancements */
     html.dark button:not([class*="bg-[#E5521A]"]):not([class*="bg-blue"]):not([class*="bg-emerald"]):not([class*="bg-red"]) {
       border-width: 1.5px !important;
       border-color: #2A3F68 !important;
       color: #E8EDF8 !important;
     }
     
     html.dark button:not([class*="bg-[#E5521A]"]):not([class*="bg-blue"]):not([class*="bg-emerald"]):not([class*="bg-red"]):hover {
       border-color: #3A5088 !important;
       background-color: #1a2a48 !important;
     }
     ```
   - **Analyze and Fix Specific Button Patterns**:
     - Export buttons (e.g., "Edit Export", "Export Report")
     - Action buttons (e.g., "Run Simulation", "Refresh")
     - Navigation buttons (e.g., tab switches, filters)
     - Icon-only buttons (ensure visible background or border)
     - Ensure minimum touch target size (44x44px) for mobile

6. **Production-Ready Button Audit**: Systematically review all button instances
   - Search for all `<button` elements across frontend
   - Test each button type in both light and dark themes
   - Ensure consistent styling patterns
   - Document button variants in design system

#### 3. Landing Page Video Hero

**File**: `frontend/src/components/layout/intelli-landing.tsx`

**Function**: Landing page hero section

**Specific Changes**:
1. **Add Video Asset**: Place `logo_intro.mp4` in `frontend/public/` directory
   - Ensure video is optimized (< 10MB, H.264 codec)
   - Add WebM format for better browser support

2. **Implement Video Fallback**: Add error handling for missing video
   - Display gradient background if video fails to load
   - Show loading spinner while video buffers
   - Provide static image fallback

3. **Add Autoplay Handling**: Ensure video plays on all browsers
   - Add `muted` attribute (required for autoplay)
   - Use `playsInline` for iOS support
   - Implement play() promise handling

4. **Enhance Animations**: Use Framer Motion for hero content
   - Fade-in animation for headline (duration: 0.8s)
   - Stagger animation for CTA buttons (delay: 0.2s)
   - Parallax effect on scroll

5. **Optimize Video Loading**: Implement lazy loading
   - Use `loading="lazy"` for video element
   - Preload only first few seconds
   - Stream remaining content

#### 4. Mobile Responsiveness

**File**: `frontend/src/app/globals.css` and component files

**Function**: Responsive layouts and mobile navigation

**Specific Changes**:
1. **Responsive Sidebar**: Add mobile breakpoint handling
   - Hide sidebar by default on mobile (< 768px)
   - Add hamburger menu toggle button
   - Implement slide-in drawer for mobile navigation
   - Use `transform: translateX(-100%)` for off-canvas positioning

2. **Responsive Grid Layouts**: Update grid classes with breakpoints
   - Change `grid-cols-4` to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
   - Update KPI grid: `grid-cols-2 md:grid-cols-4`
   - Make camera grid responsive: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`

3. **Responsive Typography**: Scale text for mobile
   - Reduce heading sizes: `text-4xl` → `text-2xl sm:text-4xl`
   - Adjust body text: `text-base` → `text-sm sm:text-base`
   - Ensure minimum touch target size (44x44px)

4. **Mobile Navigation**: Implement mobile-specific patterns
   - Bottom navigation bar for primary actions
   - Collapsible sections for long content
   - Swipeable cards for horizontal scrolling

5. **Responsive Images and Videos**: Optimize media for mobile
   - Use `object-fit: cover` for video backgrounds
   - Implement responsive image srcsets
   - Reduce video quality on mobile connections

#### 5. LPR/Camera Feeds

**File**: `frontend/src/components/depot/cameras/VideoFeed.tsx`

**Function**: Video feed rendering and LPR integration

**Specific Changes**:
1. **Fix API Endpoint Construction**: Correct backend URL building
   - Use environment variable `NEXT_PUBLIC_BACKEND_URL` consistently
   - Ensure `/backend` proxy rewrite works correctly
   - Add fallback to `http://localhost:8000` for development

2. **Implement Retry Logic**: Add exponential backoff for failed loads
   - Retry snapshot fetch up to 3 times with increasing delays
   - Show "Reconnecting..." status during retries
   - Fall back to "OFFLINE" after max retries

3. **Add CORS Headers**: Ensure backend serves correct headers
   - Backend must include `Access-Control-Allow-Origin: *`
   - Add `crossOrigin="anonymous"` to image elements
   - Handle CORS preflight requests

4. **Implement HLS Streaming**: Use HLS.js for better video performance
   - Install and configure HLS.js library
   - Stream video using M3U8 playlists
   - Fall back to MJPEG if HLS not supported

5. **Integrate LPR Backend**: Connect to real LPR API endpoints
   - Replace `simulateLPR()` with actual API call
   - Use `/depot/vision/lpr/detect` endpoint
   - Display detected plates in real-time overlay

#### 6. Login Theme Switching

**File**: `frontend/src/app/login/page.tsx`

**Function**: Login page theme handling

**Specific Changes**:
1. **Replace Inline Styles with CSS Variables**: Use theme-aware variables
   - Replace `style={{ backgroundColor: pageBg }}` with `className="theme-bg-page"`
   - Remove all inline color calculations
   - Use CSS custom properties that react to theme changes

2. **Add Theme Change Listener**: Re-render on theme toggle
   - Use `useEffect` to listen for theme changes
   - Force re-render when theme changes
   - Update all theme-dependent values

3. **Use Tailwind Dark Mode**: Leverage Tailwind's dark: prefix
   - Replace inline styles with `bg-[#F0F4FA] dark:bg-[#010810]`
   - Use `text-gray-900 dark:text-white` for text
   - Apply `border-gray-300 dark:border-gray-700` for borders

4. **Fix Theme Toggle Component**: Ensure toggle updates all elements
   - Verify ThemeProvider context updates correctly
   - Check that `html.dark` class is added/removed
   - Ensure localStorage persists theme choice

#### 7. Chart Integration

**File**: Create new `frontend/src/app/platform/analytics/page.tsx`

**Function**: Chart display page

**Specific Changes**:
1. **Create Chart Route**: Add new page for chart display
   - Create `frontend/src/app/platform/analytics/page.tsx`
   - Add navigation link in sidebar
   - Implement route protection (auth required)

2. **Embed Chart HTML**: Use iframe to display chart
   - Copy `fidelis_chart_updated (1).html` to `frontend/public/charts/`
   - Create iframe wrapper component
   - Set iframe src to `/charts/fidelis_chart_updated (1).html`

3. **Make Chart Responsive**: Add responsive iframe wrapper
   - Use aspect-ratio CSS for responsive sizing
   - Implement `width: 100%` and `height: auto`
   - Add media queries for mobile optimization

4. **Add Theme Support**: Pass theme to chart iframe
   - Use postMessage API to communicate theme
   - Update chart HTML to accept theme parameter
   - Toggle chart colors based on theme

5. **Optimize Chart Loading**: Implement lazy loading
   - Load chart only when analytics page is accessed
   - Show loading spinner while chart loads
   - Handle iframe load errors gracefully

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs BEFORE implementing the fix, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate each bug condition and assert that the bug manifests. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Performance Test**: Measure navigation time from Dashboard to Operations Hub (will fail on unfixed code - expect > 2000ms)
2. **Light Theme Test**: Activate light theme and measure text contrast ratio (will fail on unfixed code - expect < 4.5:1)
3. **Landing Page Test**: Load landing page and check for video element (will fail on unfixed code - expect video not playing)
4. **Mobile Test**: Resize viewport to 375px and check layout responsiveness (will fail on unfixed code - expect overflow)
5. **Camera Feed Test**: Load VideoFeed component and check for video loading (will fail on unfixed code - expect black screen)
6. **Login Theme Test**: Toggle theme on login page and check color application (will fail on unfixed code - expect colors not changing)
7. **Chart Test**: Navigate to analytics page and check for chart display (will fail on unfixed code - expect 404 or missing chart)

**Expected Counterexamples**:
- Navigation takes 2-3 seconds with no loading indicators
- Light theme displays dark bluish colors with poor text contrast
- Landing page shows no video or video fails to load
- Mobile viewport shows desktop layout squeezed
- Camera feeds show black screens with "OFFLINE" status
- Login page theme toggle doesn't update colors
- Chart page doesn't exist or chart not displayed

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedApplication(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Test Cases**:
1. **Performance Fix**: Navigate between all routes and assert transition time < 300ms
2. **Light Theme Fix**: Activate light theme and assert text contrast ≥ 4.5:1 on all pages
3. **Landing Page Fix**: Load landing page and assert video plays and loops
4. **Mobile Fix**: Test all pages at 375px, 640px, 768px viewports and assert responsive layout
5. **Camera Feed Fix**: Load camera page and assert all feeds show "LIVE" status with video
6. **Login Theme Fix**: Toggle theme multiple times and assert colors update correctly
7. **Chart Fix**: Navigate to analytics page and assert chart displays and is responsive

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalApplication(input) = fixedApplication(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for dark theme and desktop layouts, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Dark Theme Preservation**: Test all pages in dark theme and assert colors match original
2. **Desktop Layout Preservation**: Test all pages at 1920px viewport and assert layout matches original
3. **Non-Video Component Preservation**: Test KPI cards, forms, buttons and assert behavior matches original
4. **Authentication Preservation**: Test login flow and assert authentication works identically
5. **API Communication Preservation**: Test all API calls and assert requests/responses match original
6. **Navigation Preservation**: Test sidebar navigation and assert routing works identically

### Unit Tests

- Test route transition timing with performance.now() measurements
- Test light theme CSS variable values with getComputedStyle()
- Test video element attributes (autoplay, loop, muted, playsInline)
- Test responsive breakpoints with window.matchMedia()
- Test VideoFeed component with mocked API responses
- Test theme toggle functionality with context updates
- Test chart iframe loading and responsive sizing

### Property-Based Tests

- Generate random navigation sequences and verify all transitions < 300ms
- Generate random theme toggle sequences and verify colors always correct
- Generate random viewport sizes and verify responsive layout always adapts
- Generate random camera IDs and verify video feeds always load
- Generate random user interactions and verify no regressions in existing features

### Integration Tests

- Test full user flow: landing page → login → dashboard → camera page
- Test theme switching across all pages in sequence
- Test mobile navigation: hamburger menu → sidebar → page navigation
- Test camera feed with real backend API (if available in test environment)
- Test chart display with real HTML file
- Test performance across multiple route transitions
- Test responsive behavior across all breakpoints (375px, 640px, 768px, 1024px, 1920px)
