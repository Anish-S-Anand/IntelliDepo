# Requirements Document

## Introduction

The Regional Manager Location Filter feature enables regional managers to filter the Command Center dashboard view by warehouse location. This allows them to view data for a single warehouse (Hyderabad or Bengaluru) or a combined view of both warehouses. The filter provides a dropdown selector positioned beside the "LIVE" button in the dashboard header, defaults to the combined view on page load, and persists the user's selection across sessions using localStorage.

## Glossary

- **Location_Filter**: A dropdown UI component that allows users to select which warehouse(s) to display on the dashboard
- **Command_Dashboard**: The CommandPage component located at `/frontend/src/components/depot/operations/CommandPage.tsx`
- **Regional_Manager**: A user with role `regional_manager` who has access to multiple warehouses (WH_HYD and WH_BLR)
- **Warehouse_Scope**: The set of warehouse IDs currently visible based on the filter selection
- **Filter_State**: The currently selected filter value stored in localStorage
- **Combined_View**: Display mode showing aggregated data from both Hyderabad and Bengaluru warehouses
- **Single_Warehouse_View**: Display mode showing data exclusively from one selected warehouse
- **LIVE_Button**: The existing UI element that displays real-time connection status in the dashboard header
- **LocalStorage**: Browser-based persistent storage mechanism for maintaining user preferences

## Requirements

### Requirement 1: Filter Component Visibility

**User Story:** As a regional manager, I want to see a location filter in my dashboard header, so that I know filtering options are available to me.

#### Acceptance Criteria

1. WHERE the user has role `regional_manager`, THE Command_Dashboard SHALL display the Location_Filter component
2. THE Location_Filter SHALL be positioned horizontally beside the LIVE_Button in the dashboard header area
3. WHERE the user has role `warehouse_manager` OR role `central_manager` OR role `admin`, THE Command_Dashboard SHALL NOT display the Location_Filter component

### Requirement 2: Filter Options

**User Story:** As a regional manager, I want to select between individual warehouses or a combined view, so that I can focus on specific locations or see the complete regional picture.

#### Acceptance Criteria

1. THE Location_Filter SHALL provide exactly three selectable options
2. THE Location_Filter SHALL display "Hyderabad and Bengaluru (Combined)" as the first option
3. THE Location_Filter SHALL display "Hyderabad" as the second option
4. THE Location_Filter SHALL display "Bengaluru" as the third option
5. WHEN the user clicks the Location_Filter, THE Location_Filter SHALL expand to show all three options

### Requirement 3: Default Filter Selection

**User Story:** As a regional manager, I want to see the combined view by default when I open the dashboard, so that I immediately have visibility into all my warehouses.

#### Acceptance Criteria

1. WHEN the Command_Dashboard loads for the first time, THE Location_Filter SHALL be set to "Hyderabad and Bengaluru (Combined)"
2. WHEN no Filter_State exists in LocalStorage, THE Location_Filter SHALL default to "Hyderabad and Bengaluru (Combined)"
3. WHEN a valid Filter_State exists in LocalStorage, THE Location_Filter SHALL be set to the stored value

### Requirement 4: Single Warehouse Filtering

**User Story:** As a regional manager, I want to select a single warehouse and see only that warehouse's data, so that I can focus deeply on one location without distractions.

#### Acceptance Criteria

1. WHEN the user selects "Hyderabad" from the Location_Filter, THE Command_Dashboard SHALL display data exclusively from WH_HYD
2. WHEN the user selects "Bengaluru" from the Location_Filter, THE Command_Dashboard SHALL display data exclusively from WH_BLR
3. WHEN a Single_Warehouse_View is active, THE Command_Dashboard SHALL hide all data from non-selected warehouses
4. WHEN a Single_Warehouse_View is active, THE Command_Dashboard SHALL NOT aggregate data from multiple warehouses

### Requirement 5: Combined View Filtering

**User Story:** As a regional manager, I want to select the combined view and see data from both warehouses together, so that I can compare and analyze regional performance.

#### Acceptance Criteria

1. WHEN the user selects "Hyderabad and Bengaluru (Combined)" from the Location_Filter, THE Command_Dashboard SHALL display data from both WH_HYD and WH_BLR
2. WHEN Combined_View is active, THE Command_Dashboard SHALL aggregate metrics from both warehouses
3. WHEN Combined_View is active, THE Command_Dashboard SHALL display warehouse-specific sections for both WH_HYD and WH_BLR

### Requirement 6: Filter State Persistence

**User Story:** As a regional manager, I want my filter selection to be remembered when I return to the dashboard, so that I don't have to reselect my preferred view every time.

#### Acceptance Criteria

1. WHEN the user changes the Location_Filter selection, THE Command_Dashboard SHALL write the selected value to LocalStorage
2. THE Command_Dashboard SHALL use the storage key `regionalManagerLocationFilter` for Filter_State
3. WHEN the Command_Dashboard unmounts, THE Filter_State SHALL remain in LocalStorage
4. WHEN the user closes the browser and reopens the Command_Dashboard, THE Location_Filter SHALL restore the Filter_State from LocalStorage

### Requirement 7: Data Scope Modification

**User Story:** As a regional manager, I want the dashboard to update immediately when I change the filter, so that I see accurate data for my selected scope without page refresh.

#### Acceptance Criteria

1. WHEN the user changes the Location_Filter selection, THE Command_Dashboard SHALL update the Warehouse_Scope immediately
2. WHEN the Warehouse_Scope changes, THE Command_Dashboard SHALL re-fetch data using the new scope
3. WHEN the Warehouse_Scope changes, THE Command_Dashboard SHALL update all KPI cards to reflect the filtered data
4. WHEN the Warehouse_Scope changes, THE Command_Dashboard SHALL update all camera feeds to show only cameras from the filtered warehouses
5. WHEN the Warehouse_Scope changes, THE Command_Dashboard SHALL update the weather widget to show weather for filtered warehouses only

### Requirement 8: Filter Component Styling

**User Story:** As a regional manager, I want the location filter to match the existing dashboard design, so that it feels like a natural part of the interface.

#### Acceptance Criteria

1. THE Location_Filter SHALL use the existing TailwindCSS design system classes
2. THE Location_Filter SHALL use the same color scheme as existing dashboard controls (background: `#0D1526`, border: `#1E2F50`, text: `#E8EDF8`)
3. THE Location_Filter SHALL use font size `11px` and font weight `bold` for consistency with dashboard controls
4. WHEN the Location_Filter is hovered, THE Location_Filter SHALL change border color to `#2A3F68`
5. THE Location_Filter SHALL display a chevron-down icon to indicate it is a dropdown

### Requirement 9: Filter Integration with Existing Code

**User Story:** As a developer, I want the filter to integrate seamlessly with existing dashboard logic, so that minimal code changes are required and existing functionality is preserved.

#### Acceptance Criteria

1. THE Location_Filter SHALL reuse the existing `scopedWarehouseIdsForLogin` function logic for determining warehouse scope
2. WHEN the filter selection changes, THE Command_Dashboard SHALL update the `forcedWarehouseIds` value
3. THE Command_Dashboard SHALL pass the updated warehouse scope to the `getUnifiedDepotSource` function
4. THE Command_Dashboard SHALL NOT modify backend API endpoints
5. THE Command_Dashboard SHALL NOT modify the ROLE_WAREHOUSE_REGISTRY constant structure

### Requirement 10: Filter Accessibility

**User Story:** As a regional manager using assistive technology, I want the filter to be keyboard accessible and properly labeled, so that I can operate it without a mouse.

#### Acceptance Criteria

1. THE Location_Filter SHALL be focusable using the Tab key
2. WHEN the Location_Filter has focus, THE Location_Filter SHALL display a visible focus indicator
3. THE Location_Filter SHALL be operable using Enter and Space keys to expand options
4. THE Location_Filter SHALL be operable using Arrow keys to navigate between options
5. THE Location_Filter SHALL include an `aria-label` attribute with value "Select warehouse location filter"
