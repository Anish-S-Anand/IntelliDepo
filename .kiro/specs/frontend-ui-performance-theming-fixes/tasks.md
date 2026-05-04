# Implementation Plan

## Overview

This task list implements fixes for 7 critical frontend bugs: performance degradation, light theme visibility, landing page video hero, mobile responsiveness, LPR camera feeds, login theme switching, and chart integration. The workflow follows the bug condition methodology: explore bugs first, write preservation tests, then implement fixes with validation.

---

## Phase 1: Bug Condition Exploration Tests

### 1.1 Performance Bug Exploration

- [ ] 1.1 Write performance bug condition exploration test
  - **Property 1: Bug Condition** - Navigation Performance Degradation
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate slow navigation exists
  - **Scoped PBT Approach**: Test navigation between specific routes (Dashboard → Operations Hub, Camera → Fleet Management)
  - Test implementation: Measure `performance.now()` before and after route transitions
  - Assert: `transitionTime < 300ms` for all route changes
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (transition times > 2000ms - this proves the bug exists)
  - Document counterexamples found (e.g., "Dashboard → Operations Hub takes 2.3 seconds")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1.1, 1.1.2, 1.1.3_

### 1.2 Light Theme Bug Exploration

- [ ] 1.2 Write light theme bug condition exploration test
  - **Property 1: Bug Condition** - Light Theme Visibility Issues
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate poor light theme visibility
  - **Scoped PBT Approach**: Test specific UI elements (buttons, text, backgrounds) in light theme across all pages
  - Test implementation: Activate light theme, use `getComputedStyle()` to measure text/background colors
  - Assert: Text contrast ratio ≥ 4.5:1, background colors are light (not dark bluish), buttons have strong borders and visibility
  - Test button visibility specifically: "Edit Export" button, action buttons, navigation buttons
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (contrast < 4.5:1, dark bluish colors present, buttons barely visible - this proves the bug exists)
  - Document counterexamples found (e.g., "Light theme uses #0D1526 background, text contrast 2.1:1, Edit Export button barely visible")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.2.1, 1.2.2, 1.2.3, 1.2.4, 1.2.5, 1.2.6, 1.2.7_

### 1.3 Landing Page Bug Exploration

- [ ] 1.3 Write landing page bug condition exploration test
  - **Property 1: Bug Condition** - Missing Video Hero
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate missing video hero
  - **Scoped PBT Approach**: Test landing page load and video element presence
  - Test implementation: Navigate to "/", query for video element, check attributes (autoplay, loop, muted, src)
  - Assert: Video element exists, src="/logo_intro.mp4", video is playing and looping
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (video not playing or missing - this proves the bug exists)
  - Document counterexamples found (e.g., "Video element present but not playing, 404 error for logo_intro.mp4")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.3.1, 1.3.2, 1.3.3_

### 1.4 Mobile Responsiveness Bug Exploration

- [ ] 1.4 Write mobile responsiveness bug condition exploration test
  - **Property 1: Bug Condition** - Mobile Layout Failures
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate non-responsive layouts
  - **Scoped PBT Approach**: Test specific viewport widths (375px, 640px, 768px) across all pages
  - Test implementation: Resize viewport to mobile sizes, check for horizontal overflow, sidebar visibility, text readability
  - Assert: No horizontal overflow, sidebar hidden or drawer-style, text size appropriate, touch targets ≥ 44px
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (horizontal overflow, sidebar overlaps content - this proves the bug exists)
  - Document counterexamples found (e.g., "At 375px viewport, sidebar overlaps content, horizontal scroll present")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.4.1, 1.4.2, 1.4.3_

### 1.5 LPR/Camera Feed Bug Exploration

- [ ] 1.5 Write LPR/camera feed bug condition exploration test
  - **Property 1: Bug Condition** - Non-Functional Video Feeds
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate black screens and failed video loading
  - **Scoped PBT Approach**: Test VideoFeed component with specific camera IDs
  - Test implementation: Render VideoFeed component, check for video loading, verify API endpoint construction
  - Assert: Video element shows "LIVE" status, no black screen, snapshot URL correct, backend integration working
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (black screens, "OFFLINE" status - this proves the bug exists)
  - Document counterexamples found (e.g., "Camera ID 'cam-001' shows black screen, snapshot URL returns 404")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.5.1, 1.5.2, 1.5.3, 1.5.4_

### 1.6 Login Theme Bug Exploration

- [ ] 1.6 Write login theme bug condition exploration test
  - **Property 1: Bug Condition** - Login Theme Switching Failures
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate theme switching not working on login page
  - **Scoped PBT Approach**: Test theme toggle on login page specifically
  - Test implementation: Navigate to "/login", toggle theme, check computed styles for background and text colors
  - Assert: Theme toggle updates colors correctly, text visibility maintained, CSS variables applied
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (colors don't update, text visibility issues - this proves the bug exists)
  - Document counterexamples found (e.g., "Theme toggle on login page doesn't update background color")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.6.1, 1.6.2, 1.6.3_

### 1.7 Chart Integration Bug Exploration

- [ ] 1.7 Write chart integration bug condition exploration test
  - **Property 1: Bug Condition** - Missing Chart Integration
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate chart not integrated
  - **Scoped PBT Approach**: Test chart display on analytics page at various viewport sizes
  - Test implementation: Navigate to analytics page, check for chart iframe, verify responsive sizing
  - Assert: Chart iframe exists, src points to fidelis chart HTML, responsive at mobile sizes
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (chart page doesn't exist or chart not displayed - this proves the bug exists)
  - Document counterexamples found (e.g., "Analytics page returns 404, no chart iframe found")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.7.1, 1.7.2, 1.7.3_

---

## Phase 2: Preservation Property Tests

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Buggy Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (dark theme, desktop layouts, existing functionality)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  
  - [ ] 2.1 Dark theme preservation test
    - Observe: Dark theme colors (#0D1526, #14203A) display correctly on unfixed code
    - Write property-based test: For all pages in dark theme, colors match original values
    - Verify test passes on UNFIXED code
    - _Requirements: 3.1.1, 3.1.2, 3.1.3_
  
  - [ ] 2.2 Desktop layout preservation test
    - Observe: Desktop layouts (viewport > 1024px) display correctly on unfixed code
    - Write property-based test: For all pages at 1920px viewport, layout matches original
    - Verify test passes on UNFIXED code
    - _Requirements: 3.3.1, 3.3.2, 3.3.3_
  
  - [ ] 2.3 Existing functionality preservation test
    - Observe: Non-camera components (KPIs, forms, buttons) function correctly on unfixed code
    - Write property-based test: For all non-video components, behavior matches original
    - Verify test passes on UNFIXED code
    - _Requirements: 3.2.1, 3.2.2, 3.2.3_
  
  - [ ] 2.4 Authentication preservation test
    - Observe: Login flow and session management work correctly on unfixed code
    - Write property-based test: For all authentication flows, behavior matches original
    - Verify test passes on UNFIXED code
    - _Requirements: 3.4.1, 3.4.2, 3.4.3_
  
  - [ ] 2.5 Data visualization preservation test
    - Observe: Existing charts (Recharts components) render correctly on unfixed code
    - Write property-based test: For all existing visualizations, rendering matches original
    - Verify test passes on UNFIXED code
    - _Requirements: 3.5.1, 3.5.2, 3.5.3_
  
  - [ ] 2.6 Navigation structure preservation test
    - Observe: Sidebar navigation and routing work correctly on unfixed code
    - Write property-based test: For all navigation interactions, behavior matches original
    - Verify test passes on UNFIXED code
    - _Requirements: 3.6.1, 3.6.2, 3.6.3_
  
  - [ ] 2.7 Non-video components preservation test
    - Observe: Components without video functionality work correctly on unfixed code
    - Write property-based test: For all non-video components, behavior matches original
    - Verify test passes on UNFIXED code
    - _Requirements: 3.7.1, 3.7.2, 3.7.3_

---

## Phase 3: Implementation

### 3. Fix for Frontend UI Performance & Theming Issues

  - [ ] 3.1 Performance Optimization
    - Update `frontend/next.config.mjs` to enable route prefetching
    - Add `experimental.optimizeCss: true` configuration
    - Configure link prefetching for critical navigation
    - Create loading.tsx files for route segments:
      - `frontend/src/app/depot/loading.tsx` with skeleton UI
      - `frontend/src/app/platform/loading.tsx` with skeleton UI
    - Wrap heavy components with React.memo (VideoFeed, dashboard KPIs)
    - Implement useMemo for expensive calculations
    - Configure dynamic imports for large dependencies (TensorFlow.js, Three.js)
    - Add NProgress loading bar for route transitions
    - _Bug_Condition: isPerformanceBugCondition(input) where input.eventType = "route_change"_
    - _Expected_Behavior: result.transitionTime < 300ms AND result.responsive = true_
    - _Preservation: Dark theme, desktop layouts, existing functionality remain unchanged_
    - _Requirements: 2.1.1, 2.1.2, 2.1.3_

  - [x] 3.2 Light Theme Visibility Fix
    - Update `frontend/src/app/globals.css` to remove hardcoded dark colors
    - Replace all `bg-[#0D1526]` arbitrary values with CSS variables
    - Replace all `bg-[#14203A]` arbitrary values with CSS variables
    - Remove `!important` flags that prevent theme switching
    - Update light theme CSS variables for text contrast ≥ 4.5:1
    - Change `--text-primary` in `:root` to ensure proper contrast
    - Update `--text-secondary` to `#1F2937` for readability
    - Convert inline color styles to theme-aware classes
    - Add comprehensive button visibility rules for both themes:
      - Light theme: Strong borders (2px solid #D1D5DB), dark text (#0D1117), white background
      - Dark theme: Visible borders (#2A3F68), light text (#E8EDF8), dark background (#14203A)
      - Hover states for both themes
    - Audit ALL button instances across entire frontend:
      - Search for all `<button` elements
      - Test each button type in both themes
      - Fix "Edit Export" button and similar faint buttons
      - Ensure minimum touch target size (44x44px)
    - Test contrast ratios on all pages
    - _Bug_Condition: isLightThemeBugCondition(input) where input.theme = "light"_
    - _Expected_Behavior: result.colors ≠ dark_bluish_colors AND result.textContrast >= 4.5 AND result.buttonVisibility = "excellent"_
    - _Preservation: Dark theme colors and styling remain unchanged_
    - _Requirements: 2.2.1, 2.2.2, 2.2.3, 2.2.4, 2.2.5, 2.2.6, 2.2.7_

  - [ ] 3.3 Landing Page Video Hero
    - Place `logo_intro.mp4` in `frontend/public/` directory
    - Optimize video (< 10MB, H.264 codec)
    - Add WebM format for browser support
    - Update `frontend/src/components/layout/intelli-landing.tsx`
    - Add video error handling and fallback
    - Implement autoplay with `muted`, `playsInline` attributes
    - Add play() promise handling for browser compatibility
    - Enhance animations with Framer Motion:
      - Fade-in for headline (0.8s duration)
      - Stagger animation for CTA buttons (0.2s delay)
      - Parallax effect on scroll
    - Implement lazy loading for video
    - _Bug_Condition: isLandingPageBugCondition(input) where input.route = "/"_
    - _Expected_Behavior: result.hasVideoHero = true AND result.videoLooping = true AND result.animated = true_
    - _Preservation: Existing landing page content and structure remain unchanged_
    - _Requirements: 2.3.1, 2.3.2, 2.3.3_

  - [ ] 3.4 Mobile Responsiveness
    - Update `frontend/src/app/globals.css` for responsive sidebar
    - Hide sidebar by default on mobile (< 768px)
    - Add hamburger menu toggle button
    - Implement slide-in drawer for mobile navigation
    - Use `transform: translateX(-100%)` for off-canvas positioning
    - Update grid layouts with responsive breakpoints:
      - Change `grid-cols-4` to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
      - Update KPI grid: `grid-cols-2 md:grid-cols-4`
      - Make camera grid responsive: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
    - Scale typography for mobile:
      - Reduce heading sizes: `text-4xl` → `text-2xl sm:text-4xl`
      - Adjust body text: `text-base` → `text-sm sm:text-base`
    - Implement mobile navigation patterns:
      - Bottom navigation bar for primary actions
      - Collapsible sections for long content
      - Swipeable cards for horizontal scrolling
    - Optimize media for mobile:
      - Use `object-fit: cover` for video backgrounds
      - Implement responsive image srcsets
    - Test all pages at 375px, 640px, 768px viewports
    - _Bug_Condition: isMobileBugCondition(input) where input.width <= 768_
    - _Expected_Behavior: result.responsive = true AND result.layoutAdapted = true_
    - _Preservation: Desktop layouts (viewport > 1024px) remain unchanged_
    - _Requirements: 2.4.1, 2.4.2, 2.4.3_

  - [x] 3.5 LPR/Camera Feed Integration
    - Update `frontend/src/components/depot/cameras/VideoFeed.tsx`
    - Fix API endpoint construction using `NEXT_PUBLIC_BACKEND_URL`
    - Ensure `/backend` proxy rewrite works correctly
    - Add fallback to `http://localhost:8000` for development
    - Implement retry logic with exponential backoff (3 retries)
    - Show "Reconnecting..." status during retries
    - Add CORS handling with `crossOrigin="anonymous"`
    - Implement HLS.js streaming:
      - Install and configure HLS.js library
      - Stream video using M3U8 playlists
      - Fall back to MJPEG if HLS not supported
    - Integrate LPR backend:
      - Replace `simulateLPR()` with actual API call
      - Use `/depot/vision/lpr/detect` endpoint
      - Display detected plates in real-time overlay
    - Test with multiple camera IDs
    - _Bug_Condition: isCameraBugCondition(input) where input.component = "VideoFeed"_
    - _Expected_Behavior: result.videoLoading = true AND result.blackScreen = false AND result.lprFunctional = true_
    - _Preservation: Non-camera components remain unchanged_
    - _Requirements: 2.5.1, 2.5.2, 2.5.3, 2.5.4_

  - [ ] 3.6 Login Page Theme Switching
    - Update `frontend/src/app/login/page.tsx`
    - Replace inline styles with CSS variables
    - Remove all inline color calculations (pageBg, etc.)
    - Use theme-aware className: `theme-bg-page`
    - Add theme change listener with useEffect
    - Force re-render when theme changes
    - Use Tailwind dark mode classes:
      - `bg-[#F0F4FA] dark:bg-[#010810]` for backgrounds
      - `text-gray-900 dark:text-white` for text
      - `border-gray-300 dark:border-gray-700` for borders
    - Verify ThemeProvider context updates correctly
    - Check that `html.dark` class is added/removed
    - Ensure localStorage persists theme choice
    - Test theme toggle multiple times
    - _Bug_Condition: isLoginThemeBugCondition(input) where input.route = "/login"_
    - _Expected_Behavior: result.themeApplied = true AND result.textVisible = true_
    - _Preservation: Authentication flow remains unchanged_
    - _Requirements: 2.6.1, 2.6.2, 2.6.3_

  - [ ] 3.7 Chart Integration
    - Copy `fidelis_chart_updated (1).html` to `frontend/public/charts/`
    - Create new route: `frontend/src/app/platform/analytics/page.tsx`
    - Add navigation link in sidebar for analytics
    - Implement route protection (auth required)
    - Create iframe wrapper component for chart
    - Set iframe src to `/charts/fidelis_chart_updated (1).html`
    - Make chart responsive:
      - Use aspect-ratio CSS for responsive sizing
      - Implement `width: 100%` and `height: auto`
      - Add media queries for mobile optimization
    - Add theme support:
      - Use postMessage API to communicate theme
      - Update chart HTML to accept theme parameter
      - Toggle chart colors based on theme
    - Implement lazy loading:
      - Load chart only when analytics page is accessed
      - Show loading spinner while chart loads
      - Handle iframe load errors gracefully
    - Test on mobile devices (375px, 640px, 768px)
    - _Bug_Condition: isChartBugCondition(input) where input.chartType = "fidelis_chart"_
    - _Expected_Behavior: result.integrated = true AND result.mobileResponsive = true_
    - _Preservation: Existing charts (Recharts components) remain unchanged_
    - _Requirements: 2.7.1, 2.7.2, 2.7.3_

  - [ ] 3.8 Verify all bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - All Bugs Fixed
    - **IMPORTANT**: Re-run the SAME tests from Phase 1 - do NOT write new tests
    - The tests from Phase 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run all 7 bug condition exploration tests from Phase 1
    - **EXPECTED OUTCOME**: All tests PASS (confirms all bugs are fixed)
    
    - [ ] 3.8.1 Re-run performance test (task 1.1)
      - Assert: Navigation transitions < 300ms
      - _Requirements: 2.1.1, 2.1.2, 2.1.3_
    
    - [ ] 3.8.2 Re-run light theme test (task 1.2)
      - Assert: Text contrast ≥ 4.5:1, light colors, buttons highly visible
      - _Requirements: 2.2.1, 2.2.2, 2.2.3, 2.2.4, 2.2.5, 2.2.6, 2.2.7_
    
    - [ ] 3.8.3 Re-run landing page test (task 1.3)
      - Assert: Video playing and looping
      - _Requirements: 2.3.1, 2.3.2, 2.3.3_
    
    - [ ] 3.8.4 Re-run mobile responsiveness test (task 1.4)
      - Assert: Responsive layouts at all mobile viewports
      - _Requirements: 2.4.1, 2.4.2, 2.4.3_
    
    - [ ] 3.8.5 Re-run camera feed test (task 1.5)
      - Assert: Video feeds show "LIVE" status, no black screens
      - _Requirements: 2.5.1, 2.5.2, 2.5.3, 2.5.4_
    
    - [ ] 3.8.6 Re-run login theme test (task 1.6)
      - Assert: Theme switching works correctly
      - _Requirements: 2.6.1, 2.6.2, 2.6.3_
    
    - [ ] 3.8.7 Re-run chart integration test (task 1.7)
      - Assert: Chart displays and is responsive
      - _Requirements: 2.7.1, 2.7.2, 2.7.3_

  - [ ] 3.9 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Buggy Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from Phase 2 - do NOT write new tests
    - Run all 7 preservation property tests from Phase 2
    - **EXPECTED OUTCOME**: All tests PASS (confirms no regressions)
    - Confirm dark theme, desktop layouts, and existing functionality unchanged
    - _Requirements: 3.1.1, 3.1.2, 3.1.3, 3.2.1, 3.2.2, 3.2.3, 3.3.1, 3.3.2, 3.3.3, 3.4.1, 3.4.2, 3.4.3, 3.5.1, 3.5.2, 3.5.3, 3.6.1, 3.6.2, 3.6.3, 3.7.1, 3.7.2, 3.7.3_

---

## Phase 4: Final Validation

- [ ] 4. Checkpoint - Ensure all tests pass and production readiness
  - Verify all 7 bug condition tests pass (Phase 1 tests re-run in task 3.8)
  - Verify all 7 preservation tests pass (Phase 2 tests re-run in task 3.9)
  - Run full integration test suite
  - Test complete user flows:
    - Landing page → Login → Dashboard → Camera page
    - Theme switching across all pages
    - Mobile navigation on all pages
  - Verify button visibility across entire frontend in both themes
  - Test on multiple devices and browsers:
    - Desktop: Chrome, Firefox, Safari (1920px viewport)
    - Mobile: iPhone (375px), iPad (768px), Android (640px)
  - Performance audit:
    - Lighthouse score > 90 for performance
    - All route transitions < 300ms
    - No console errors or warnings
  - Accessibility audit:
    - WCAG AA compliance for text contrast
    - Keyboard navigation works
    - Screen reader compatibility
  - Ask user if any issues arise or if production deployment should proceed
  - _Requirements: All requirements from bugfix.md_

---

## Notes

- **Production-Ready Focus**: All changes must be production-ready with comprehensive testing
- **Button Visibility Critical**: Systematically audit and fix ALL buttons across the entire frontend
- **Theme Consistency**: Both light and dark themes must have excellent visibility and contrast
- **Mobile-First**: Test all changes on mobile devices throughout implementation
- **Backend Integration**: Ensure LPR/camera feeds integrate correctly with backend API
- **Performance Monitoring**: Continuously measure and optimize navigation performance
- **Regression Prevention**: Run preservation tests after each implementation task
- **User Feedback**: Engage user for validation at checkpoint before considering complete
