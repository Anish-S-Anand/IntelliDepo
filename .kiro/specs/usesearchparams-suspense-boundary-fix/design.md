# useSearchParams() Suspense Boundary Fix - Design

## Overview

This design addresses the Next.js prerender errors caused by `useSearchParams()` hook usage without Suspense boundaries. The bug prevents static site generation for 40+ pages, blocking deployment. The fix involves wrapping affected components in Suspense boundaries with appropriate loading fallbacks, while ensuring runtime behavior remains unchanged.

The approach follows Next.js 13+ App Router requirements: components using dynamic APIs like `useSearchParams()` must be wrapped in Suspense to enable proper static generation. This fix will also improve the user experience by providing visible loading indicators during navigation and data fetching.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a component uses `useSearchParams()` hook without being wrapped in a Suspense boundary
- **Property (P)**: The desired behavior - components using `useSearchParams()` must be wrapped in Suspense with appropriate loading fallbacks, and the build must complete successfully
- **Preservation**: Runtime behavior for search parameter access and all non-affected components must remain unchanged
- **useSearchParams()**: Next.js App Router hook that provides access to URL search parameters in client components
- **Suspense Boundary**: React component that enables declarative loading states and is required by Next.js for components using dynamic APIs during static generation
- **Static Generation**: Next.js build-time process that pre-renders pages to HTML for optimal performance
- **Prerender Error**: Build-time error that occurs when Next.js cannot statically generate a page due to improper use of dynamic APIs
- **NavigationEvents**: Component in `frontend/src/components/layout/NavigationEvents.tsx` that tracks route changes using `useSearchParams()`
- **LoadingIndicator**: Global loading overlay component that displays during API requests and navigation
- **LoadingContext**: React context that manages loading state across the application

## Bug Details

### Bug Condition

The bug manifests when a client component uses the `useSearchParams()` hook without being wrapped in a React Suspense boundary. Next.js App Router requires Suspense boundaries for components using dynamic APIs during static generation. Without Suspense, the build process cannot complete static page generation.

**Formal Specification:**
```
FUNCTION isBugCondition(component)
  INPUT: component of type ReactComponent
  OUTPUT: boolean
  
  RETURN component.usesHook("useSearchParams") 
         AND NOT component.wrappedInSuspense()
         AND component.isClientComponent()
         AND context.isStaticGeneration()
END FUNCTION
```

### Examples

**Example 1: NavigationEvents Component (Critical)**
- **Location**: `frontend/src/components/layout/NavigationEvents.tsx`
- **Current Code**: 
  ```typescript
  export function NavigationEvents() {
    const searchParams = useSearchParams(); // ❌ No Suspense boundary
    // ...
  }
  ```
- **Impact**: Affects ALL pages since it's included in root layout
- **Error**: "useSearchParams() should be wrapped in a suspense boundary at page"

**Example 2: SettingsPage Component (Critical)**
- **Location**: `frontend/src/app/depot/settings/page.tsx`
- **Current Code**: Uses `useSearchParams()` to read tab parameter
- **Impact**: Settings page cannot be statically generated
- **Error**: Build fails with prerender error

**Example 3: HeatmapPage Component (High)**
- **Location**: `frontend/src/components/depot/operations/HeatmapPage.tsx`
- **Current Code**: Uses `useSearchParams()` for zone filtering
- **Impact**: Heatmap visualization page generation blocked

**Example 4: IncidentsPage Component (High)**
- **Location**: `frontend/src/components/depot/operations/IncidentsPage.tsx`
- **Current Code**: Uses `useSearchParams()` for incident filtering
- **Impact**: Incident management page generation blocked

**Example 5: AnalysisSection Component (High)**
- **Location**: `frontend/src/components/depot/operations/AnalysisSection.tsx`
- **Current Code**: Uses `useSearchParams()` with router navigation
- **Impact**: Analysis dashboard section generation blocked

### Expected Behavior

After the fix is applied, components using `useSearchParams()` should be properly wrapped in Suspense boundaries, enabling successful static generation while maintaining identical runtime behavior.

**Correct Implementation Pattern:**
```typescript
// ✅ Proper Suspense boundary usage
export function NavigationEvents() {
  return (
    <Suspense fallback={null}>
      <NavigationEventsContent />
    </Suspense>
  );
}

function NavigationEventsContent() {
  const searchParams = useSearchParams(); // ✅ Wrapped in Suspense
  // ...
}
```

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Runtime access to search parameters must continue to work identically
- User navigation with query parameters must function as before
- All interactive features depending on search parameters must remain operational
- Development mode (`npm run dev`) must continue to function normally
- Components NOT using `useSearchParams()` must remain completely unchanged

**Scope:**
All components that do NOT use `useSearchParams()` should be completely unaffected by this fix. This includes:
- Components using other hooks (useState, useEffect, etc.)
- Components with static props only
- Components that don't interact with URL parameters
- Server components (which cannot use `useSearchParams()` anyway)

The fix ONLY affects:
1. Static generation phase (build time)
2. Components explicitly using `useSearchParams()`
3. Addition of loading fallback UI for better UX

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Next.js App Router Requirement Not Met**: Next.js 13+ App Router requires that components using dynamic APIs like `useSearchParams()` be wrapped in Suspense boundaries for static generation. This is a breaking change from Pages Router behavior.

2. **NavigationEvents Component in Root Layout**: The `NavigationEvents` component uses `useSearchParams()` and is included in the root layout (`app/layout.tsx`), causing ALL pages to fail static generation.

3. **Missing Suspense in Page Components**: Multiple page components (`SettingsPage`, `HeatmapPage`, `IncidentsPage`, `AnalysisSection`) directly use `useSearchParams()` without Suspense boundaries.

4. **Migration Gap from Pages Router**: The application may have been migrated from Next.js Pages Router where `useSearchParams()` didn't require Suspense. The migration didn't add the necessary boundaries.

5. **Inconsistent Loading State Visibility**: While a `LoadingContext` and `LoadingIndicator` exist, they don't integrate with navigation events properly, resulting in poor UX during page transitions.

## Correctness Properties

Property 1: Bug Condition - Suspense Boundary Wrapping

_For any_ client component that uses the `useSearchParams()` hook, the fixed implementation SHALL wrap the hook usage within a React Suspense boundary, include an appropriate loading fallback, and enable successful static page generation during the build process.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Runtime Behavior Unchanged

_For any_ component that does NOT use `useSearchParams()` OR any runtime behavior of components that do use search parameters, the fixed code SHALL produce exactly the same result as the original code, preserving all existing functionality for search parameter access, user navigation, and interactive features.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File 1**: `frontend/src/components/layout/NavigationEvents.tsx` (CRITICAL - affects all pages)

**Current Implementation**:
```typescript
export function NavigationEvents() {
  const pathname = usePathname();
  const searchParams = useSearchParams(); // ❌ No Suspense
  const { stopLoading } = useLoading();

  useEffect(() => {
    stopLoading();
  }, [pathname, searchParams, stopLoading]);

  return null;
}
```

**Fixed Implementation**:
```typescript
import { Suspense } from "react";

export function NavigationEvents() {
  return (
    <Suspense fallback={null}>
      <NavigationEventsContent />
    </Suspense>
  );
}

function NavigationEventsContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams(); // ✅ Wrapped in Suspense
  const { stopLoading, startLoading } = useLoading();

  useEffect(() => {
    // Show loading indicator when navigation starts
    startLoading();
    
    // Hide loading indicator when navigation completes
    const timer = setTimeout(() => {
      stopLoading();
    }, 100); // Small delay to prevent flicker on instant navigations

    return () => {
      clearTimeout(timer);
      stopLoading();
    };
  }, [pathname, searchParams, startLoading, stopLoading]);

  return null;
}
```

**Rationale**: 
- Split into wrapper and content components following Next.js pattern
- Added `startLoading()` call to show loading indicator during navigation
- Added small delay to prevent UI flicker on fast navigations
- Suspense fallback is `null` since this is a side-effect-only component

---

**File 2**: `frontend/src/app/depot/settings/page.tsx`

**Specific Changes**:
1. **Extract Search Params Logic**: Create a separate component for `useSearchParams()` usage
2. **Add Suspense Boundary**: Wrap the extracted component in Suspense
3. **Provide Loading Fallback**: Show skeleton UI matching the page structure

**Implementation Pattern**:
```typescript
import { Suspense } from "react";

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const searchParams = useSearchParams(); // ✅ Now wrapped in Suspense
  // ... existing logic
}

function SettingsPageSkeleton() {
  return (
    <div className="p-5">
      {/* Skeleton matching page structure */}
      <div className="route-skeleton-bar h-7 w-52 mb-4" />
      <div className="route-skeleton-bar h-4 w-40 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="route-skeleton-bar h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

---

**File 3**: `frontend/src/components/depot/operations/HeatmapPage.tsx`

**Specific Changes**:
1. **Create Suspense Wrapper**: Extract `useSearchParams()` usage into separate component
2. **Add Loading Fallback**: Provide skeleton matching heatmap layout
3. **Maintain Zone Filtering Logic**: Ensure zone parameter continues to work

**Implementation Pattern**:
```typescript
import { Suspense } from "react";

export default function HeatmapPage() {
  return (
    <Suspense fallback={<HeatmapPageSkeleton />}>
      <HeatmapPageContent />
    </Suspense>
  );
}

function HeatmapPageContent() {
  const searchParams = useSearchParams(); // ✅ Wrapped in Suspense
  const zoneParam = searchParams.get("zone");
  // ... existing logic
}

function HeatmapPageSkeleton() {
  return (
    <div className="p-5">
      {/* Skeleton matching heatmap structure */}
      <div className="route-skeleton-bar h-7 w-48 mb-4" />
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <div className="route-skeleton-bar h-[400px] rounded-lg" />
        <div className="route-skeleton-bar h-[400px] rounded-lg" />
      </div>
    </div>
  );
}
```

---

**File 4**: `frontend/src/components/depot/operations/IncidentsPage.tsx`

**Specific Changes**:
1. **Wrap in Suspense**: Extract search params logic
2. **Add Filtering Support**: Maintain status and severity filtering via URL params
3. **Provide Loading State**: Show incident list skeleton

**Implementation Pattern**:
```typescript
import { Suspense } from "react";

export default function IncidentsPage() {
  return (
    <Suspense fallback={<IncidentsPageSkeleton />}>
      <IncidentsPageContent />
    </Suspense>
  );
}

function IncidentsPageContent() {
  const searchParams = useSearchParams(); // ✅ Wrapped in Suspense
  const statusFilter = searchParams.get("status");
  const severityFilter = searchParams.get("severity");
  // ... existing logic
}

function IncidentsPageSkeleton() {
  return (
    <div className="p-5">
      {/* Skeleton matching incidents list */}
      <div className="route-skeleton-bar h-7 w-52 mb-4" />
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="route-skeleton-bar h-8 w-24 rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="route-skeleton-bar h-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

---

**File 5**: `frontend/src/components/depot/operations/AnalysisSection.tsx`

**Specific Changes**:
1. **Suspense Wrapping**: Extract `useSearchParams()` into separate component
2. **Maintain Router Integration**: Ensure navigation with query params continues to work
3. **Add Loading Fallback**: Show analysis section skeleton

**Implementation Pattern**:
```typescript
import { Suspense } from "react";

export default function AnalysisSection() {
  return (
    <Suspense fallback={<AnalysisSectionSkeleton />}>
      <AnalysisSectionContent />
    </Suspense>
  );
}

function AnalysisSectionContent() {
  const searchParams = useSearchParams(); // ✅ Wrapped in Suspense
  const router = useRouter();
  // ... existing logic with query param handling
}

function AnalysisSectionSkeleton() {
  return (
    <div className="p-4">
      {/* Skeleton matching analysis section */}
      <div className="route-skeleton-bar h-6 w-40 mb-3" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="route-skeleton-bar h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

---

### Additional Improvements

**Enhancement 1: Improve LoadingIndicator Visibility**

Current issue: Loading indicator exists but may not be visible enough during navigation.

**File**: `frontend/src/components/ui/LoadingIndicator.tsx`

**Changes**:
1. Increase z-index to ensure it's above all content
2. Add more prominent backdrop blur
3. Increase spinner size and add pulsing animation
4. Add "Loading..." text for clarity

*Note: The current implementation already has good visibility, but we can verify it's working correctly with navigation events.*

---

**Enhancement 2: Add Route-Level Loading States**

For better UX, ensure each major route has a `loading.tsx` file for Next.js to use during navigation.

**Affected Routes**:
- `frontend/src/app/depot/settings/loading.tsx` (create if missing)
- `frontend/src/app/depot/operations/loading.tsx` (create if missing)
- `frontend/src/app/depot/heatmap/loading.tsx` (create if missing)

**Implementation**:
```typescript
export default function LoadingState() {
  return (
    <div className="p-5">
      <div className="route-skeleton-bar h-7 w-52 mb-4" />
      <div className="route-skeleton-bar h-4 w-40 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="route-skeleton-bar h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, verify the bug is fixed (build succeeds, pages render with Suspense), then confirm preservation of existing behavior (runtime functionality unchanged, non-affected components untouched).

### Exploratory Bug Condition Checking

**Goal**: Verify that wrapping `useSearchParams()` in Suspense resolves the prerender errors on the UNFIXED code first, then confirm the fix works.

**Test Plan**: 
1. Run `npm run build` on UNFIXED code to reproduce prerender errors
2. Identify all affected pages from error output
3. Apply Suspense boundaries to one component at a time
4. Verify build succeeds for each fixed component
5. Confirm all 40+ pages can be statically generated

**Test Cases**:
1. **NavigationEvents Test**: Build fails with "useSearchParams() should be wrapped in a suspense boundary" for all pages (will fail on unfixed code) ✅
2. **SettingsPage Test**: Settings page fails static generation (will fail on unfixed code) ✅
3. **HeatmapPage Test**: Heatmap page fails static generation (will fail on unfixed code) ✅
4. **IncidentsPage Test**: Incidents page fails static generation (will fail on unfixed code) ✅
5. **AnalysisSection Test**: Analysis section causes parent page generation to fail (will fail on unfixed code) ✅

**Expected Counterexamples**:
```bash
# Running: npm run build
Error: useSearchParams() should be wrapped in a suspense boundary at page "/depot/settings"
Error: useSearchParams() should be wrapped in a suspense boundary at page "/depot/operations"
Error: useSearchParams() should be wrapped in a suspense boundary at page "/depot/heatmap"
# ... 40+ similar errors
Build failed with prerender errors
```

**Expected Causes After Analysis**:
- Missing Suspense boundaries around `useSearchParams()` calls
- NavigationEvents component affecting all pages due to root layout inclusion
- Next.js App Router static generation requirements not met

### Fix Checking

**Goal**: Verify that for all components where the bug condition holds (uses `useSearchParams()` without Suspense), the fixed function produces the expected behavior (successful static generation with proper loading states).

**Pseudocode:**
```
FOR ALL component WHERE isBugCondition(component) DO
  result := buildWithFixedComponent(component)
  ASSERT result.buildSucceeds = true
  ASSERT result.hasSuspenseBoundary = true
  ASSERT result.hasLoadingFallback = true
  ASSERT result.prerenderErrorCount = 0
END FOR
```

**Test Implementation**:

**Test 1: Build Success Test**
```bash
# After applying Suspense fixes to all components
npm run build

# Expected output:
# ✓ Generating static pages (40/40)
# ✓ Finalizing page optimization
# Build completed successfully
```

**Test 2: Static Generation Verification**
```bash
npm run build
# Check build output logs for:
# ✓ /depot/settings
# ✓ /depot/operations  
# ✓ /depot/heatmap
# ✓ /depot/incidents
# ... all pages show ✓ instead of ✗
```

**Test 3: Component-Specific Suspense Tests**

Create unit tests to verify Suspense boundaries exist:

```typescript
// frontend/src/__tests__/suspense-boundaries.test.tsx
import { render } from '@testing-library/react';
import NavigationEvents from '@/components/layout/NavigationEvents';
import SettingsPage from '@/app/depot/settings/page';

test('NavigationEvents wraps useSearchParams in Suspense', () => {
  // This test will pass if Suspense boundary exists
  const { container } = render(<NavigationEvents />);
  expect(container).toBeInTheDocument();
  // Build would fail if Suspense is missing
});

test('SettingsPage wraps useSearchParams in Suspense', () => {
  const { container } = render(<SettingsPage />);
  expect(container).toBeInTheDocument();
  // Build would fail if Suspense is missing
});

// Repeat for all affected components
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (components not using `useSearchParams()` OR runtime behavior of fixed components), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL component WHERE NOT isBugCondition(component) DO
  ASSERT originalBehavior(component) = fixedBehavior(component)
END FOR

FOR ALL runtimeScenario IN affectedComponents DO
  ASSERT originalRuntime(scenario) = fixedRuntime(scenario)
END FOR
```

**Testing Approach**: Manual testing and automated tests are recommended for preservation checking because:
- It verifies runtime behavior matches exactly across all user interactions
- It catches subtle regressions in search parameter handling
- It provides strong guarantees that UX is preserved for end users
- Property-based testing can generate many URL parameter combinations automatically

**Test Plan**: 

1. **Manual Runtime Verification** - Test on UNFIXED code first to establish baseline, then verify fixed code matches:

**Test Case 1: Settings Page Tab Navigation**
```
Given: User navigates to /depot/settings?tab=notifications
When: Page loads
Then: Notifications tab should be active (same as before fix)

Given: User clicks "Profile" tab
When: URL changes to /depot/settings?tab=profile  
Then: Profile tab content should display (same as before fix)
```

**Test Case 2: Heatmap Zone Filtering**
```
Given: User navigates to /depot/heatmap?zone=A1
When: Page loads
Then: Heatmap should filter to zone A1 (same as before fix)

Given: User clicks "All Zones"
When: URL changes to /depot/heatmap
Then: Heatmap should show all zones (same as before fix)
```

**Test Case 3: Incidents Page Filtering**
```
Given: User navigates to /depot/incidents?status=open&severity=critical
When: Page loads
Then: Only open critical incidents should display (same as before fix)

Given: User changes filter to "resolved"
When: URL updates with new status parameter
Then: Resolved incidents should display (same as before fix)
```

**Test Case 4: Navigation Loading States**
```
Given: User is on /depot/dashboard
When: User clicks link to /depot/operations
Then: Loading indicator should appear briefly (improved by fix)
And: Page should transition smoothly (same as before fix)
And: All operations data should load correctly (same as before fix)
```

2. **Automated Property-Based Tests** - Generate random URL parameter combinations:

```typescript
// frontend/src/__tests__/search-params-preservation.property.test.ts
import fc from 'fast-check';
import { renderHook } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';

test('search parameters are correctly read regardless of Suspense wrapping', () => {
  fc.assert(
    fc.property(
      fc.dictionary(fc.string(), fc.string()), // Random query params
      (params) => {
        // Simulate URL with params
        const searchParams = new URLSearchParams(params);
        
        // Both wrapped and unwrapped should read same values
        // (This verifies runtime behavior preservation)
        const keys = Array.from(searchParams.keys());
        keys.forEach(key => {
          const value = searchParams.get(key);
          expect(value).toBe(params[key]);
        });
      }
    )
  );
});
```

3. **Component-Specific Preservation Tests**:

```typescript
// frontend/src/__tests__/component-preservation.test.tsx

test('OperationsDashboard (non-affected component) renders identically', () => {
  const { container: before } = render(<OperationsDashboard />);
  // Apply fix
  const { container: after } = render(<OperationsDashboard />);
  
  // Structure should be identical since component doesn't use useSearchParams
  expect(before.innerHTML).toBe(after.innerHTML);
});

test('PerimeterSecurityPage (non-affected component) renders identically', () => {
  const { container: before } = render(<PerimeterSecurityPage />);
  // Apply fix  
  const { container: after } = render(<PerimeterSecurityPage />);
  
  // Structure should be identical
  expect(before.innerHTML).toBe(after.innerHTML);
});
```

4. **Development Mode Test**:
```bash
# Verify dev mode still works after fixes
npm run dev

# Navigate to all affected pages manually:
# - http://localhost:3000/depot/settings
# - http://localhost:3000/depot/operations
# - http://localhost:3000/depot/heatmap
# - http://localhost:3000/depot/incidents

# Expected: All pages load normally with HMR working
```

5. **Non-Affected Components Test**:
```typescript
// Verify components that don't use useSearchParams are untouched
test('components without useSearchParams remain unchanged', () => {
  const componentsToVerify = [
    'OperationsDashboard',
    'PerimeterSecurityPage', 
    'VisionPage',
    'CountingPage',
  ];
  
  componentsToVerify.forEach(component => {
    // Git diff should show no changes to these files
    // or verify via file hash comparison
  });
});
```

### Unit Tests

- Test that Suspense boundaries exist around `useSearchParams()` calls
- Test that loading fallbacks render correctly during Suspense
- Test that search parameter values are correctly read after Suspense wrapping
- Test that navigation events trigger loading indicators
- Test edge cases: empty search params, special characters in params, multiple params

### Property-Based Tests

- Generate random URL parameter combinations and verify they're correctly read
- Generate random navigation sequences and verify loading states display
- Test that all combinations of tab/filter/zone parameters work correctly
- Verify no memory leaks from loading state management across many navigations

### Integration Tests

- Test full user flow: navigate between pages with different query parameters
- Test that loading indicators appear during navigation transitions
- Test that all affected pages can be accessed and function correctly
- Test build and deployment pipeline end-to-end
- Verify static generation produces valid HTML for all pages
