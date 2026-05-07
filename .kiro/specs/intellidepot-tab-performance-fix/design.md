# IntelliDepot Tab Performance Fix - Technical Design

## Overview

The IntelliDepot UI experiences slow tab switching (>500ms) due to redundant API calls, lack of caching, competing requests, and poor loading states. This design implements a comprehensive performance optimization using React Query for intelligent caching, request coordination, and prefetching. The fix targets <100ms tab switching with 70-90% reduction in API calls while preserving all existing functionality including real-time updates, theme support, role-based access, and error handling.

**Key Strategy:**
- Implement React Query with 30s stale time and 5min cache time for all depot API calls
- Defer sidebar/topbar alert fetching by 2-3 seconds to prioritize page content
- Add instant skeleton loading states for immediate visual feedback
- Enable hover-based prefetching for predictive data loading
- Coordinate API calls through centralized query keys to prevent duplicates

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when users click tab links and experience >500ms delays with blank screens due to redundant API fetching
- **Property (P)**: The desired behavior when tabs are switched - instant rendering (<100ms) using cached data with smooth skeleton loading states
- **Preservation**: Existing functionality that must remain unchanged - real-time updates, theme support, role-based access, error handling, refresh behavior, alert badges, navigation, mobile responsiveness
- **React Query**: TanStack Query v5 - a data synchronization library that provides caching, background updates, and request deduplication
- **Stale Time**: Duration (30s) before cached data is considered outdated and eligible for background refetch
- **Cache Time**: Duration (5min) before unused cached data is garbage collected
- **Query Key**: Unique identifier for cached data (e.g., `['depot', 'vision', 'alerts']`)
- **Prefetch**: Loading data in the background before it's needed (triggered on hover)
- **Deferred Fetch**: Delaying non-critical API calls (sidebar/topbar alerts) by 2-3 seconds to prioritize page content
- **Skeleton Loading**: Instant placeholder UI that matches the target page layout, providing immediate visual feedback

## Bug Details

### Bug Condition

The bug manifests when a user clicks on any tab link in the sidebar (Operations, Vision, Inventory, Counting, Gate, Incidents, etc.). The system makes redundant API calls on every navigation, shows blank screens during loading, and experiences network congestion from competing requests (page data + sidebar alerts + topbar alerts firing simultaneously).

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type NavigationEvent
  OUTPUT: boolean
  
  RETURN input.action == "tab_click"
         AND input.targetTab IN ['operations', 'vision', 'inventory', 'counting', 'gate', 'incidents', 'heatmap', 'sequencing', 'command']
         AND (renderTime > 100ms OR apiCallsMade > 1 OR cacheNotUsed)
END FUNCTION
```

### Examples

- **Operations Tab**: User clicks "OPS" → ExecutiveDashboard mounts → Makes 8 parallel API calls (getAllActiveAlerts, getActiveBreaches, getIncidents, getCapacityStatus, getPerimeterZones, getCountSessions, getManifests, getAccessLogs) → Sidebar makes 2 more calls (getAllActiveAlerts, getPerimeterAlertCount) → TopBar makes 2 more calls (same as sidebar) → Total 12 API calls, 600ms delay, blank screen

- **Inventory Tab**: User clicks "INV" → InventoryPage mounts → Fetches zones and batches → Sidebar/TopBar fetch alerts → Total 4 API calls → User clicks back to "OPS" → All 12 API calls repeat even though data is <10 seconds old → 550ms delay

- **Vision to Gate**: User clicks "VIS" → Loads vision data → Clicks "GTE" → All vision data discarded, gate data fetched from scratch → No prefetching despite Next.js Link prefetch enabled → 480ms delay with blank screen

- **Rapid Navigation**: User clicks "OPS" → "INV" → "VIS" in quick succession → Each navigation triggers full API call set → Network congestion → Some requests timeout → 800ms+ delays

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Real-time data updates must continue to work through existing polling mechanisms (30-60 second intervals)
- Theme switching (dark/light mode) must continue to apply correctly to all tab content
- Role-based access control must continue to show only authorized tabs for warehouse managers and regional managers
- Refresh button in TopBar must continue to force-refresh current page data, bypassing the cache
- Alert badges in sidebar must continue to show accurate counts that update every 60 seconds
- Browser back/forward navigation must continue to work correctly between tabs
- Mobile sidebar must continue to display and close correctly after tab selection
- Error handling must continue to handle API failures gracefully without crashing
- All visual elements (KPI cards, charts, tables, module health, incident lists) must continue to render correctly with proper styling and animations

**Scope:**
All inputs that do NOT involve tab navigation (refresh button clicks, theme toggles, profile menu interactions, alert acknowledgments, form submissions) should be completely unaffected by this fix. This includes:
- Manual refresh actions (must bypass cache)
- Real-time polling updates (must continue on schedule)
- User interactions within a tab (filters, searches, modals)
- Authentication and authorization flows

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **No Caching Layer**: Each component fetches data independently using raw `fetch()` or axios calls without any caching mechanism. When users navigate back to a previously visited tab, all data is re-fetched even if it's only seconds old.

2. **Competing API Calls**: ExecutiveDashboard makes 8 parallel calls, while DepotSidebar and DepotTopBar simultaneously fetch alert data. These competing requests create network congestion and slow down critical page rendering.

3. **No Request Deduplication**: Multiple components request the same data (e.g., `getAllActiveAlerts` called by ExecutiveDashboard, DepotSidebar, and DepotTopBar). Without coordination, 3 identical requests are made simultaneously.

4. **No Prefetching**: Next.js Link components have `prefetch={true}` but only prefetch the route bundle, not the data. Users must wait for data fetching to complete after clicking.

5. **Poor Loading States**: Components show blank screens or simple spinners during loading. No skeleton states provide immediate visual feedback, making delays feel longer.

6. **Synchronous Component Loading**: Even with `dynamic()` imports, components load synchronously before showing any content, blocking the UI thread.

## Correctness Properties

Property 1: Bug Condition - Fast Tab Switching with Caching

_For any_ tab navigation where the user clicks a sidebar link and the target tab's data is in cache (fetched within 30 seconds), the fixed system SHALL render the tab content within <100ms using cached data, display an instant skeleton loading state during the transition, and trigger a background refetch to update stale data without blocking the UI.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**

Property 2: Preservation - Existing Functionality Unchanged

_For any_ user interaction that is NOT a tab navigation (refresh button, theme toggle, alert acknowledgment, filter change, form submission), the fixed system SHALL produce exactly the same behavior as the original system, preserving real-time updates, theme support, role-based access, error handling, and all visual elements.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `frontend/src/app/depot/layout.tsx`

**Function**: Root layout component

**Specific Changes**:
1. **Add React Query Provider**: Wrap the depot layout with `QueryClientProvider` to enable caching across all child components
   - Import `QueryClient` and `QueryClientProvider` from `@tanstack/react-query`
   - Create a `QueryClient` instance with global cache configuration (30s stale time, 5min cache time)
   - Wrap existing layout content with the provider

2. **Configure Global Query Defaults**: Set default options for all queries
   - `staleTime: 30000` (30 seconds - data is fresh for 30s)
   - `cacheTime: 300000` (5 minutes - unused data kept for 5min)
   - `refetchOnWindowFocus: false` (prevent refetch on tab focus)
   - `retry: 1` (retry failed requests once)

---

**File**: `frontend/src/hooks/useDepotData.ts` (NEW FILE)

**Purpose**: Centralized React Query hooks for all depot API calls

**Specific Changes**:
1. **Create Query Hooks**: Define custom hooks for each API endpoint
   - `useVisionAlerts()` - wraps `getAllActiveAlerts()`
   - `useActiveBreaches()` - wraps `getActiveBreaches()`
   - `useIncidents()` - wraps `getIncidents()`
   - `useCapacityStatus()` - wraps `getCapacityStatus()`
   - `usePerimeterZones()` - wraps `getPerimeterZones()`
   - `useCountSessions()` - wraps `getCountSessions()`
   - `useManifests()` - wraps `getManifests()`
   - `useAccessLogs()` - wraps `getAccessLogs()`
   - `useZones()` - wraps `getZones()` from depotCluster
   - `useBatches()` - wraps batch fetching from depotVision

2. **Define Query Keys**: Establish consistent query key structure
   - `['depot', 'vision', 'alerts']` for vision alerts
   - `['depot', 'perimeter', 'breaches']` for breaches
   - `['depot', 'perimeter', 'incidents']` for incidents
   - `['depot', 'cluster', 'capacity']` for capacity status
   - `['depot', 'cluster', 'zones']` for zones
   - `['depot', 'counting', 'sessions']` for count sessions
   - `['depot', 'counting', 'manifests']` for manifests
   - `['depot', 'gate', 'logs']` for access logs

3. **Add Prefetch Helpers**: Export prefetch functions for hover-based loading
   - `prefetchVisionAlerts(queryClient)` - prefetches vision alerts
   - `prefetchInventoryData(queryClient)` - prefetches zones and batches
   - `prefetchOperationsData(queryClient)` - prefetches all dashboard data

4. **Add Refresh Helpers**: Export functions to invalidate cache for manual refresh
   - `refreshCurrentPage(queryClient, pageName)` - invalidates queries for specific page

---

**File**: `frontend/src/components/depot/operations/ExecutiveDashboard.tsx`

**Function**: Main dashboard component

**Specific Changes**:
1. **Replace useState with React Query**: Remove all `useState` for data and `useEffect` for fetching
   - Replace `const [visionAlerts, setVisionAlerts] = useState([])` with `const { data: visionAlerts = [] } = useVisionAlerts()`
   - Replace `const [activeBreaches, setActiveBreaches] = useState(0)` with `const { data: breaches = [] } = useActiveBreaches()`
   - Apply same pattern for incidents, capacityStatus, perimeterZones, countSessions, manifests, accessLogs

2. **Combine Loading States**: Use React Query's `isLoading` flags
   - `const isLoading = isLoadingAlerts || isLoadingBreaches || isLoadingIncidents || ...`
   - Show `DashboardSkeleton` when `isLoading` is true

3. **Remove Manual Polling**: Delete `setInterval` logic
   - React Query handles background refetching automatically based on `staleTime`

4. **Add Error Handling**: Use React Query's `error` and `isError` flags
   - Display error states when queries fail
   - Preserve existing error handling behavior

---

**File**: `frontend/src/components/depot/operations/InventoryPage.tsx`

**Function**: Inventory management component

**Specific Changes**:
1. **Replace useState with React Query**: Remove manual data fetching
   - Replace `const [zones, setZones] = useState([])` with `const { data: zones = [] } = useZones()`
   - Replace `const [clusters, setClusters] = useState([])` with `const { data: batches = [] } = useBatches()`

2. **Remove fetchData Function**: Delete `fetchData` callback and `useEffect`
   - React Query handles fetching and refetching automatically

3. **Update Loading State**: Use React Query's `isLoading`
   - `const isLoading = isLoadingZones || isLoadingBatches`

4. **Preserve Local State**: Keep search, filter, viewTab, modals as local state
   - These are UI-only states that don't need caching

---

**File**: `frontend/src/components/depot/layout/DepotSidebar.tsx`

**Function**: Sidebar navigation with alert badges

**Specific Changes**:
1. **Defer Alert Fetching**: Add 2-second delay before fetching alerts
   - Use React Query's `enabled` option: `enabled: deferredEnabled`
   - Set `deferredEnabled` to `true` after 2-second timeout

2. **Replace useState with React Query**: Use shared alert queries
   - Replace manual fetching with `useVisionAlerts()` and `usePerimeterAlertCount()`
   - Reuse cached data from ExecutiveDashboard if available

3. **Remove Manual Polling**: Delete `setInterval` logic
   - React Query handles background refetching

4. **Add Prefetch on Hover**: Implement hover-based prefetching
   - Add `onMouseEnter` handlers to Link components
   - Call appropriate prefetch functions (e.g., `prefetchInventoryData()` on INV hover)

---

**File**: `frontend/src/components/depot/layout/DepotTopBar.tsx`

**Function**: Top navigation bar with alert bell

**Specific Changes**:
1. **Defer Alert Fetching**: Add 3-second delay before fetching alerts
   - Use React Query's `enabled` option: `enabled: deferredEnabled`
   - Set `deferredEnabled` to `true` after 3-second timeout

2. **Replace useState with React Query**: Use shared alert queries
   - Replace manual fetching with `useVisionAlerts()` and `usePerimeterAlertCount()`
   - Reuse cached data from ExecutiveDashboard and DepotSidebar

3. **Remove Manual Polling**: Delete `setInterval` logic

4. **Implement Refresh Button**: Add cache invalidation on refresh click
   - Call `refreshCurrentPage(queryClient, currentPage)` on refresh button click
   - Use `useQueryClient()` hook to access query client

---

**File**: `frontend/src/app/depot/dashboard/page.tsx`

**Function**: Dashboard route wrapper

**Specific Changes**:
1. **Enhance Loading State**: Replace simple spinner with skeleton
   - Import and use `DashboardSkeleton` component
   - Match skeleton structure to actual dashboard layout

---

**File**: `frontend/src/app/depot/inventory/page.tsx`

**Function**: Inventory route wrapper

**Specific Changes**:
1. **Enhance Loading State**: Replace simple spinner with skeleton
   - Create `InventorySkeleton` component
   - Show zone bars skeleton, cluster cards skeleton

---

**File**: `frontend/src/components/depot/skeletons/DashboardSkeleton.tsx` (NEW FILE)

**Purpose**: Skeleton loading state for dashboard

**Specific Changes**:
1. **Create Skeleton Component**: Match ExecutiveDashboard layout
   - KPI strip skeleton (6 cards)
   - Module health grid skeleton (6 cards)
   - Charts row skeleton (2 sections)
   - Capacity overview skeleton
   - Security incidents skeleton (2 sections)

2. **Use CSS Variables**: Ensure theme compatibility
   - Use `var(--bg-card)`, `var(--border-card)` for styling
   - Add pulse animation for loading effect

---

**File**: `frontend/src/components/depot/skeletons/InventorySkeleton.tsx` (NEW FILE)

**Purpose**: Skeleton loading state for inventory

**Specific Changes**:
1. **Create Skeleton Component**: Match InventoryPage layout
   - Zone bars skeleton (4 bars)
   - Cluster cards grid skeleton (8 cards)
   - Search and filter bar skeleton

2. **Use CSS Variables**: Ensure theme compatibility

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that measure tab switching performance, count API calls, and verify caching behavior. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Slow Tab Switching Test**: Navigate from Operations to Inventory, measure render time (will fail on unfixed code - expect >500ms)
2. **Redundant API Calls Test**: Navigate to Operations, count API calls, navigate away and back, count again (will fail on unfixed code - expect 12 calls each time)
3. **Competing Requests Test**: Navigate to Operations, observe network tab for simultaneous requests (will fail on unfixed code - expect 12 parallel requests)
4. **No Caching Test**: Navigate to Operations, wait 5 seconds, navigate to Inventory, navigate back to Operations, verify data is re-fetched (will fail on unfixed code - expect fresh fetch)

**Expected Counterexamples**:
- Tab switching takes 500-800ms with blank screens
- 12 API calls made on every Operations tab visit
- Sidebar and TopBar alerts fetched simultaneously with page data
- No cache reuse when navigating back to recently visited tabs
- Possible causes: no caching layer, competing requests, no request deduplication, no prefetching

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL navigation WHERE isBugCondition(navigation) DO
  result := handleTabSwitch_fixed(navigation)
  ASSERT result.renderTime < 100ms
  ASSERT result.usedCache == true OR result.isFirstVisit == true
  ASSERT result.apiCallCount <= 3 (only for uncached data)
  ASSERT result.showedSkeletonImmediately == true
END FOR
```

**Test Cases**:
1. **Fast Tab Switching**: Navigate between tabs, verify <100ms render time with cached data
2. **Cache Reuse**: Navigate to Operations, navigate away, navigate back within 30s, verify cached data used
3. **Background Refetch**: Navigate to Operations, wait 31s, navigate away and back, verify background refetch triggered
4. **Reduced API Calls**: Navigate to Operations, count API calls, verify ≤8 calls (no duplicates from sidebar/topbar)
5. **Deferred Sidebar/TopBar**: Navigate to Operations, verify sidebar/topbar alerts fetch after 2-3s delay
6. **Prefetch on Hover**: Hover over Inventory link, verify prefetch triggered, click link, verify instant render
7. **Skeleton Loading**: Click any tab, verify skeleton appears within 16ms (1 frame)

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT behavior_original(input) = behavior_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-navigation inputs

**Test Plan**: Observe behavior on UNFIXED code first for non-navigation interactions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Real-time Updates Preservation**: Observe that polling updates work on unfixed code (alerts update every 60s), then verify this continues after fix
2. **Theme Switching Preservation**: Observe that theme toggle works on unfixed code, then verify all tab content applies theme correctly after fix
3. **Role-based Access Preservation**: Observe that warehouse managers see limited tabs on unfixed code, then verify same behavior after fix
4. **Refresh Button Preservation**: Observe that refresh button bypasses cache on unfixed code (if implemented), then verify it invalidates React Query cache after fix
5. **Alert Badge Preservation**: Observe that alert badges update every 60s on unfixed code, then verify same behavior after fix
6. **Browser Navigation Preservation**: Observe that back/forward buttons work on unfixed code, then verify same behavior after fix
7. **Mobile Sidebar Preservation**: Observe that mobile sidebar opens/closes correctly on unfixed code, then verify same behavior after fix
8. **Error Handling Preservation**: Simulate API failures on unfixed code, observe error handling, then verify same behavior after fix
9. **Visual Elements Preservation**: Observe that all KPI cards, charts, tables render correctly on unfixed code, then verify same styling and animations after fix

### Unit Tests

- Test React Query hooks return correct data structure
- Test query key generation is consistent
- Test prefetch functions trigger correct queries
- Test refresh functions invalidate correct queries
- Test deferred fetching delays by correct amount
- Test skeleton components render without errors

### Property-Based Tests

- Generate random navigation sequences, verify all render within <100ms after first visit
- Generate random timing scenarios (navigate, wait X seconds, navigate back), verify cache behavior
- Generate random role configurations, verify correct tabs shown
- Generate random theme switches during navigation, verify correct styling applied

### Integration Tests

- Test full user flow: login → navigate all tabs → verify performance
- Test cache invalidation flow: navigate → refresh → verify fresh data
- Test prefetch flow: hover → wait → click → verify instant render
- Test error recovery flow: simulate API failure → navigate → verify error handling → retry → verify success
- Test mobile flow: open sidebar → select tab → verify sidebar closes → verify content renders
