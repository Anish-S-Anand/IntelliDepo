# Implementation Plan: Central Manager Location Filter

## Overview

This implementation plan converts the central manager location filter design into actionable coding tasks. The feature adds a dropdown component to the Command Center dashboard, enabling central managers to filter their view by warehouse location (Mumbai, Bengaluru, Hyderabad, or combined view of all three). The implementation reuses the existing LocationFilter component from regional-manager-location-filter, integrates with existing CommandPage logic by modifying warehouse scope determination, and persists user selection via localStorage using a separate storage key.

## Tasks

- [x] 1. Extend LocationFilter component to support central manager configuration
  - Modify `frontend/src/components/depot/operations/LocationFilter.tsx` to accept options as props
  - Update `LocationFilterProps` interface to include optional `options` array prop
  - Update component to use `options` prop if provided, otherwise use default FILTER_OPTIONS
  - Ensure dropdown dynamically renders options based on the options array length
  - Verify existing styling and accessibility features work with 4 options
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 10.1_

- [ ]* 1.1 Write unit tests for extended LocationFilter component
  - Test component renders with custom options array (4 options for central manager)
  - Test component falls back to default options when none provided
  - Test dropdown correctly renders all 4 options for central manager configuration
  - Test component maintains styling consistency with 3 or 4 options
  - Test keyboard navigation works correctly with 4 options
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 2. Create central manager filter configuration constants
  - Add new constants in CommandPage.tsx or separate config file
  - Define `CENTRAL_MANAGER_LOCATION_FILTER_STORAGE_KEY = 'centralManagerLocationFilter'`
  - Define `CentralManagerLocationFilterValue` type: `'combined' | 'WH_MUM' | 'WH_BLR' | 'WH_HYD'`
  - Define `CENTRAL_MANAGER_FILTER_OPTIONS` array with 4 filter options
  - Define `CENTRAL_MANAGER_FILTER_TO_WAREHOUSE_IDS` mapping constant
  - _Requirements: 10.2, 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ]* 2.1 Write unit tests for central manager configuration constants
  - Test CENTRAL_MANAGER_FILTER_OPTIONS contains exactly 4 options in correct order
  - Test first option is "Mumbai, Bengaluru, and Hyderabad (Combined)" with value 'combined'
  - Test remaining options are Mumbai (WH_MUM), Bengaluru (WH_BLR), Hyderabad (WH_HYD)
  - Test CENTRAL_MANAGER_FILTER_TO_WAREHOUSE_IDS mapping correctness
  - Test storage key constant matches 'centralManagerLocationFilter'
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 3. Add localStorage utilities for central manager filter
  - Implement `loadCentralManagerFilterFromStorage()` function with error handling
  - Validate stored value is one of: 'combined', 'WH_MUM', 'WH_BLR', 'WH_HYD'
  - Implement `saveCentralManagerFilterToStorage(value)` function with error handling
  - Add fallback to 'combined' for invalid or missing storage values
  - Add console warnings for storage access failures
  - Use CENTRAL_MANAGER_LOCATION_FILTER_STORAGE_KEY constant
  - _Requirements: 3.1, 3.2, 3.3, 6.1, 6.2, 6.3, 6.4_

- [ ]* 3.1 Write property test for localStorage restoration
  - **Property 2: LocalStorage Restoration**
  - **Validates: Requirements 3.3**
  - For any valid CentralManagerLocationFilterValue stored in localStorage, assert component restores that value on mount
  - Test all 4 valid values: 'combined', 'WH_MUM', 'WH_BLR', 'WH_HYD'
  - Test invalid values default to 'combined'
  - Test missing values default to 'combined'

- [x] 4. Integrate central manager filter into CommandPage component
  - Import central manager configuration constants into CommandPage.tsx
  - Add new state for central managers: `const [centralLocationFilter, setCentralLocationFilter] = useState<CentralManagerLocationFilterValue>('combined')`
  - Initialize centralLocationFilter from localStorage on mount using `loadCentralManagerFilterFromStorage()`
  - Create `handleCentralFilterChange` callback that updates state and saves to localStorage
  - Conditionally render LocationFilter with 4 options when `personaKey === 'central_manager'`
  - Position central manager LocationFilter beside LIVE button in header
  - Ensure coexistence with existing regional manager filter (different state, different rendering condition)
  - _Requirements: 1.1, 1.2, 1.3, 3.3, 6.1, 6.2, 6.4, 10.1, 10.6_

- [ ]* 4.1 Write property test for filter visibility based on role
  - **Property 1: Filter Visibility Based on Role**
  - **Validates: Requirements 1.1, 1.3**
  - Generate user objects with various role values
  - Assert central manager LocationFilter is visible if and only if role is 'central_manager'
  - Test with roles: central_manager, regional_manager, warehouse_manager, admin, undefined
  - Assert regional manager filter is NOT visible when role is 'central_manager'

- [ ] 5. Modify warehouse scope calculation for central managers
  - Update `forcedWarehouseIds` useMemo in CommandPage.tsx to handle central_manager role
  - Add conditional branch: if `personaKey === 'central_manager'`, derive warehouse IDs from centralLocationFilter
  - Use CENTRAL_MANAGER_FILTER_TO_WAREHOUSE_IDS mapping for scope determination
  - Preserve existing regional_manager logic using separate locationFilter state
  - Preserve existing logic for other roles using `scopedWarehouseIdsForLogin()`
  - Ensure useMemo dependencies include personaKey, user?.email, locationFilter, and centralLocationFilter
  - _Requirements: 4.1, 4.2, 4.3, 7.1, 11.1, 11.2, 11.3, 11.4_

- [ ]* 5.1 Write property tests for warehouse scope calculation
  - **Property 7: Warehouse Scope Update on Filter Change**
  - **Validates: Requirements 7.1, 11.1, 11.2, 11.3, 11.4**
  - For any central manager filter selection change, assert forcedWarehouseIds matches CENTRAL_MANAGER_FILTER_TO_WAREHOUSE_IDS mapping
  - Test all 4 filter values: 'combined', 'WH_MUM', 'WH_BLR', 'WH_HYD'
  - **Property 3: Single Warehouse Data Filtering**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
  - For single warehouse selections (MUM, BLR, HYD), assert forcedWarehouseIds contains only that warehouse ID
  - For combined selection, assert forcedWarehouseIds contains WH_MUM, WH_BLR, and WH_HYD

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Trigger data refetch on central manager filter change
  - Add useEffect hook that watches centralLocationFilter state for central managers
  - When centralLocationFilter changes, trigger data fetch via existing `fetchSnapshot()` or `getUnifiedDepotSource()`
  - Apply debouncing (300ms) to prevent excessive API calls on rapid filter changes
  - Verify warehouse scope is updated before data fetch occurs
  - Ensure existing regional manager filter refetch logic is not affected
  - _Requirements: 7.1, 7.2, 10.3_

- [ ]* 7.1 Write property test for data refetch on scope change
  - **Property 8: Data Refetch on Scope Change**
  - **Validates: Requirements 7.2**
  - For any change to forcedWarehouseIds for central managers, assert data fetch is triggered with updated warehouse IDs
  - Mock fetch functions to verify they are called with correct warehouse scope (3 warehouses for combined)
  - Test that fetch occurs before rendering updated content

- [x] 8. Update dashboard sections to respect central manager filtered scope
  - Verify KPI cards receive filtered data from updated warehouse scope (3 warehouses in combined view)
  - Verify camera feeds filter cameras based on updated warehouse scope
  - Update WeatherWidget to receive filtered warehouseIds prop for central manager scope
  - Verify zone grouping uses filtered warehouse scope (1 or 3 warehouses)
  - Ensure all existing data flow functions (buildScopedHierarchy, groupedCameras) work with 3-warehouse scope
  - _Requirements: 7.3, 7.4, 7.5, 8.5, 10.4_

- [ ]* 8.1 Write property tests for dashboard section filtering
  - **Property 9: Camera Filtering by Warehouse Scope**
  - **Validates: Requirements 7.4**
  - For any central manager warehouse scope, assert all displayed cameras have warehouse_id in scope array
  - Assert no cameras with warehouse_id outside scope are displayed
  - Test with single warehouse (MUM, BLR, or HYD) and combined (all 3)
  - **Property 11: Weather Widget Warehouse Scope Alignment**
  - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
  - For any central manager warehouse scope, assert WeatherWidget receives warehouseIds prop matching current scope exactly
  - Test combined view passes all 3 warehouse IDs (WH_MUM, WH_BLR, WH_HYD)
  - Test single warehouse views pass only that warehouse ID

- [x] 9. Implement combined view data aggregation for 3 warehouses
  - Verify displayKpis aggregates metrics from all 3 warehouses when centralLocationFilter is 'combined'
  - Ensure camera feeds show cameras from all 3 warehouses in combined view
  - Ensure weather widget displays weather for all 3 warehouses in combined view
  - Test that warehouse-specific sections are displayed for WH_MUM, WH_BLR, and WH_HYD
  - Verify aggregation logic scales correctly from 2 warehouses (regional) to 3 warehouses (central)
  - _Requirements: 5.1, 5.2, 5.3, 8.1_

- [ ]* 9.1 Write property tests for combined view aggregation with 3 warehouses
  - **Property 4: Combined View Data Inclusion**
  - **Validates: Requirements 5.1**
  - When centralLocationFilter is 'combined', assert displayed data includes entries from WH_MUM AND WH_BLR AND WH_HYD
  - **Property 5: Metric Aggregation in Combined View**
  - **Validates: Requirements 5.2**
  - When centralLocationFilter is 'combined', assert displayed metrics equal sum/aggregation from all 3 warehouses
  - Test aggregation with various metric types (counts, averages, sums)

- [x] 10. Add error handling for central manager edge cases
  - Handle case where selected warehouse (MUM, BLR, or HYD) returns no data (display "No data available for {warehouse_name}")
  - Handle case where camera feeds are empty for selected warehouse (display "No cameras found for selected warehouse")
  - Handle case where weather API fails for one or more warehouses (hide failed warehouse weather data)
  - Ensure graceful degradation when localStorage is unavailable
  - Test that invalid filter values in localStorage default to 'combined'
  - _Requirements: 3.2, 6.1, 6.3_

- [ ]* 10.1 Write unit tests for error handling
  - Test empty data scenarios for each warehouse (MUM, BLR, HYD) display appropriate messaging
  - Test invalid localStorage values default to 'combined' for central manager filter
  - Test localStorage write failures don't break filter functionality
  - Test component handles missing user object gracefully for central manager
  - Test filter coexists with regional manager filter without state conflicts

- [x] 11. Add accessibility features for central manager filter
  - Update `aria-label` to "Select warehouse location filter for central manager"
  - Test Tab key navigation to focus the central manager filter
  - Test Enter and Space keys expand the 4-option dropdown
  - Test Arrow keys navigate between 4 options
  - Test Escape key closes dropdown
  - Verify focus indicator is visible when filter is focused
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ]* 11.1 Write unit tests for accessibility features
  - Test aria-label is "Select warehouse location filter for central manager"
  - Test filter is keyboard accessible (Tab, Enter, Space, Arrow keys, Escape)
  - Test focus indicator is visible
  - Test screen reader compatibility with 4 options

- [x] 12. Final checkpoint - Ensure all tests pass and feature is complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify central manager filter is only visible for central_manager role
  - Verify default selection is "Mumbai, Bengaluru, and Hyderabad (Combined)" on first load
  - Verify filter selection persists across page refreshes using separate storage key
  - Verify single warehouse selections (MUM, BLR, HYD) show only that warehouse's data
  - Verify combined view shows aggregated data from all 3 warehouses
  - Verify all dashboard sections (KPIs, cameras, weather, zones) update correctly when filter changes
  - Verify central and regional manager filters coexist without conflicts
  - Verify weather widget filtering is working correctly for all filter options

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The implementation uses TypeScript and React with TailwindCSS for styling
- Reuses existing LocationFilter component with extended configuration support
- No backend changes are required - feature operates entirely on frontend
- Uses separate storage key (`centralManagerLocationFilter`) to avoid conflicts with regional manager filter
- Existing RBAC and warehouse access controls are preserved
- Filter integrates with existing CommandPage logic via forcedWarehouseIds override
- Property tests validate universal correctness properties from design document
- Unit tests validate specific examples, UI behavior, and edge cases
- Checkpoints ensure incremental validation throughout implementation
- Weather widget filtering (Task 8) is critical per user requirements

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1"] },
    { "id": 1, "tasks": ["4.1"] },
    { "id": 2, "tasks": ["5.1"] },
    { "id": 3, "tasks": ["7.1"] },
    { "id": 4, "tasks": ["8.1", "9.1"] },
    { "id": 5, "tasks": ["10.1", "11.1"] }
  ]
}
```
