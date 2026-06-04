# Implementation Plan: Regional Manager Location Filter

## Overview

This implementation plan converts the regional manager location filter design into actionable coding tasks. The feature adds a dropdown component to the Command Center dashboard, enabling regional managers to filter their view by warehouse location (Hyderabad, Bengaluru, or both combined). The implementation integrates with existing CommandPage logic by modifying warehouse scope determination and persisting user selection via localStorage.

## Tasks

- [x] 1. Create LocationFilter component with UI and basic functionality
  - Create new file `frontend/src/components/depot/operations/LocationFilter.tsx`
  - Define `LocationFilterProps` interface with value, onChange, and optional disabled properties
  - Define `FilterOption` type and `FILTER_OPTIONS` constant array with three options
  - Implement dropdown using native HTML `<select>` element with TailwindCSS styling
  - Add ChevronDown icon from lucide-react
  - Apply styling to match dashboard controls (background: #0D1526, border: #1E2F50, text: #E8EDF8)
  - Add hover effect for border color (#2A3F68)
  - Include `aria-label` attribute: "Select warehouse location filter"
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 8.3, 8.4, 8.5, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]* 1.1 Write unit tests for LocationFilter component
  - Test dropdown renders with three options in correct order
  - Test component matches design system styling (colors, fonts, icons)
  - Test ARIA label is correct
  - Test keyboard accessibility (Tab, Enter, Space, Arrow keys, Escape)
  - Test onChange callback is triggered with correct value
  - Test disabled prop prevents interaction
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 8.2, 8.3, 10.5_

- [x] 2. Add localStorage persistence utilities
  - Create storage key constant `LOCATION_FILTER_STORAGE_KEY = 'regionalManagerLocationFilter'`
  - Implement `loadFilterFromStorage()` function with error handling and validation
  - Implement `saveFilterToStorage(value)` function with error handling
  - Add fallback to 'combined' for invalid or missing storage values
  - Add console warnings for storage access failures
  - _Requirements: 3.2, 3.3, 6.1, 6.2, 6.3, 6.4_

- [ ]* 2.1 Write unit tests for localStorage utilities
  - Test `loadFilterFromStorage()` returns stored value for valid inputs
  - Test `loadFilterFromStorage()` returns 'combined' for invalid values
  - Test `loadFilterFromStorage()` returns 'combined' when localStorage is empty
  - Test `loadFilterFromStorage()` handles localStorage access errors gracefully
  - Test `saveFilterToStorage()` writes correct value to localStorage
  - Test `saveFilterToStorage()` handles write failures gracefully
  - Test storage key constant matches 'regionalManagerLocationFilter'
  - _Requirements: 3.1, 3.2, 3.3, 6.1, 6.2_

- [x] 3. Integrate LocationFilter into CommandPage component
  - Import LocationFilter component into `frontend/src/components/depot/operations/CommandPage.tsx`
  - Add new state: `const [locationFilter, setLocationFilter] = useState<'combined' | 'WH_HYD' | 'WH_BLR'>('combined')`
  - Initialize locationFilter from localStorage on component mount using `loadFilterFromStorage()`
  - Create `handleFilterChange` callback that updates state and saves to localStorage
  - Conditionally render LocationFilter only when `personaKey === 'regional_manager'`
  - Position LocationFilter beside LIVE button in header section
  - _Requirements: 1.1, 1.2, 1.3, 3.3, 6.1, 6.2, 6.4_

- [ ]* 3.1 Write property test for filter visibility based on role
  - **Property 1: Filter Visibility Based on Role**
  - **Validates: Requirements 1.1, 1.3**
  - Generate user objects with various role values
  - Assert LocationFilter is visible if and only if role is 'regional_manager'
  - Test with roles: regional_manager, warehouse_manager, central_manager, admin, undefined

- [x] 4. Modify warehouse scope calculation logic
  - Create `FILTER_TO_WAREHOUSE_IDS` mapping constant
  - Modify `forcedWarehouseIds` useMemo to check if `personaKey === 'regional_manager'`
  - If regional manager, derive warehouse IDs from locationFilter using mapping
  - If not regional manager, use existing `scopedWarehouseIdsForLogin()` logic
  - Ensure useMemo dependencies include personaKey, user?.email, and locationFilter
  - _Requirements: 4.1, 4.2, 7.1, 9.1, 9.2_

- [ ]* 4.1 Write property tests for warehouse scope calculation
  - **Property 7: Warehouse Scope Update on Filter Change**
  - **Validates: Requirements 7.1, 9.2**
  - For any LocationFilter selection change, assert forcedWarehouseIds matches FILTER_TO_WAREHOUSE_IDS mapping
  - Test all three filter values: 'combined', 'WH_HYD', 'WH_BLR'
  - **Property 3: Single Warehouse Data Filtering**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
  - For single warehouse selections, assert forcedWarehouseIds contains only that warehouse ID
  - For combined selection, assert forcedWarehouseIds contains both WH_HYD and WH_BLR

- [~] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Trigger data refetch on filter change
  - Add useEffect hook that watches locationFilter state
  - When locationFilter changes, trigger data fetch via existing `fetchSnapshot()` or `getUnifiedDepotSource()`
  - Ensure debouncing is applied to prevent excessive API calls (300ms debounce)
  - Verify warehouse scope is updated before data fetch occurs
  - _Requirements: 7.1, 7.2, 9.3_

- [ ]* 6.1 Write property test for data refetch on scope change
  - **Property 8: Data Refetch on Scope Change**
  - **Validates: Requirements 7.2**
  - For any change to forcedWarehouseIds, assert data fetch is triggered with updated warehouse IDs
  - Mock fetch functions to verify they are called with correct parameters
  - Test that fetch occurs before rendering updated content

- [x] 7. Update dashboard sections to respect filtered scope
  - Verify KPI cards receive filtered data from updated warehouse scope
  - Verify camera feeds filter cameras based on updated warehouse scope
  - Verify weather widget receives filtered warehouseIds prop
  - Verify zone grouping uses filtered warehouse scope
  - Ensure all existing data flow functions (buildScopedHierarchy, groupedCameras) receive updated scope
  - _Requirements: 7.3, 7.4, 7.5, 4.3, 4.4_

- [ ]* 7.1 Write property tests for dashboard section filtering
  - **Property 9: Camera Filtering by Warehouse Scope**
  - **Validates: Requirements 7.4**
  - For any warehouse scope, assert all displayed cameras have warehouse_id in scope array
  - Assert no cameras with warehouse_id outside scope are displayed
  - **Property 10: Weather Widget Warehouse Scope Alignment**
  - **Validates: Requirements 7.5**
  - For any warehouse scope, assert WeatherWidget receives warehouseIds prop matching current scope exactly

- [x] 8. Implement combined view data aggregation
  - Verify displayKpis aggregates metrics from both warehouses when locationFilter is 'combined'
  - Ensure camera feeds show cameras from both warehouses in combined view
  - Ensure weather widget displays weather for both warehouses in combined view
  - Test that warehouse-specific sections are displayed for both WH_HYD and WH_BLR
  - _Requirements: 5.1, 5.2, 5.3_

- [ ]* 8.1 Write property tests for combined view aggregation
  - **Property 4: Combined View Data Inclusion**
  - **Validates: Requirements 5.1**
  - When locationFilter is 'combined', assert displayed data includes entries from both WH_HYD and WH_BLR
  - **Property 5: Metric Aggregation in Combined View**
  - **Validates: Requirements 5.2**
  - When locationFilter is 'combined', assert displayed metrics equal sum/aggregation of both warehouses

- [-] 9. Add error handling for edge cases
  - Handle case where selected warehouse returns no data (display "No data available for {warehouse_name}")
  - Handle case where camera feeds are empty for selected warehouse (display "No cameras found for selected warehouse")
  - Handle case where weather API fails for selected warehouse (hide weather widget)
  - Ensure graceful degradation when localStorage is unavailable
  - _Requirements: 3.2, 6.1_

- [ ]* 9.1 Write unit tests for error handling
  - Test empty data scenarios display appropriate messaging
  - Test invalid localStorage values default to 'combined'
  - Test localStorage write failures don't break functionality
  - Test component handles missing user object gracefully

- [~] 10. Final checkpoint - Ensure all tests pass and feature is complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify filter is only visible for regional_manager role
  - Verify default selection is "Combined" on first load
  - Verify filter selection persists across page refreshes
  - Verify single warehouse selections show only that warehouse's data
  - Verify combined view shows aggregated data from both warehouses
  - Verify all dashboard sections update correctly when filter changes

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The implementation uses TypeScript and React with TailwindCSS for styling
- No backend changes are required - feature operates entirely on frontend
- Existing RBAC and warehouse access controls are preserved
- Filter integrates with existing CommandPage logic via forcedWarehouseIds override
- LocalStorage key `regionalManagerLocationFilter` is used for persistence
- Property tests validate universal correctness properties from design document
- Unit tests validate specific examples, UI behavior, and edge cases
- Checkpoints ensure incremental validation throughout implementation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "3.1"] },
    { "id": 2, "tasks": ["4.1"] },
    { "id": 3, "tasks": ["6.1"] },
    { "id": 4, "tasks": ["7.1", "8.1"] },
    { "id": 5, "tasks": ["9.1"] }
  ]
}
```
