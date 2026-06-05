# Design Document

## Overview

The Central Manager Location Filter feature adds a dropdown component to the Command Center dashboard that allows central managers to filter their view by warehouse location. The filter enables toggling between individual warehouse views (Mumbai, Bengaluru, or Hyderabad) and a combined view of all three warehouses. The design integrates seamlessly with existing dashboard architecture by modifying the warehouse scope determination logic while preserving all existing backend APIs and data structures.

## Architecture

### Component Structure

```
CommandPage (existing)
├── Header Section
│   ├── Page Title & Metadata
│   ├── WeatherWidget (existing)
│   └── LocationFilter (REUSED from regional-manager-location-filter)
│       ├── Dropdown Component
│       ├── Selection State Management
│       └── LocalStorage Persistence
├── Control Actions Section (existing)
├── KPI Cards Section (existing)
└── Camera Feeds Section (existing)
```

### Data Flow

```
User Selection
    ↓
LocationFilter Component
    ↓
Update forcedWarehouseIds state
    ↓
Write to localStorage
    ↓
Trigger warehouse scope recalculation
    ↓
Re-fetch data via getUnifiedDepotSource
    ↓
Update KPIs, cameras, weather, zones
```

### State Management

The feature introduces minimal new state within the existing CommandPage component:

```typescript
// New state for central managers
const [locationFilter, setLocationFilter] = useState<'combined' | 'WH_MUM' | 'WH_BLR' | 'WH_HYD'>('combined');

// Modified existing state derivation
const forcedWarehouseIds = useMemo(() => {
  // For central managers, use locationFilter to determine scope
  if (personaKey === 'central_manager') {
    if (locationFilter === 'WH_MUM') return ['WH_MUM'];
    if (locationFilter === 'WH_BLR') return ['WH_BLR'];
    if (locationFilter === 'WH_HYD') return ['WH_HYD'];
    return ['WH_MUM', 'WH_BLR', 'WH_HYD']; // combined
  }
  // For regional managers, use existing locationFilter logic
  if (personaKey === 'regional_manager') {
    if (locationFilter === 'WH_HYD') return ['WH_HYD'];
    if (locationFilter === 'WH_BLR') return ['WH_BLR'];
    return ['WH_HYD', 'WH_BLR']; // combined for regional
  }
  // For other roles, use existing logic
  return scopedWarehouseIdsForLogin(user?.email, personaKey);
}, [personaKey, user?.email, locationFilter]);
```

## Components and Interfaces

### LocationFilter Component (Reused)

The existing LocationFilter component from regional-manager-location-filter will be reused with different configuration props.

**Interface:**

```typescript
interface LocationFilterProps {
  value: 'combined' | 'WH_MUM' | 'WH_BLR' | 'WH_HYD';
  onChange: (value: 'combined' | 'WH_MUM' | 'WH_BLR' | 'WH_HYD') => void;
  disabled?: boolean;
}

type FilterOption = {
  value: 'combined' | 'WH_MUM' | 'WH_BLR' | 'WH_HYD';
  label: string;
};

const CENTRAL_MANAGER_FILTER_OPTIONS: FilterOption[] = [
  { value: 'combined', label: 'Mumbai, Bengaluru, and Hyderabad (Combined)' },
  { value: 'WH_MUM', label: 'Mumbai' },
  { value: 'WH_BLR', label: 'Bengaluru' },
  { value: 'WH_HYD', label: 'Hyderabad' },
];
```

**Implementation Pattern:**

The component follows the same pattern as the existing implementation in regional-manager-location-filter, using:
- TailwindCSS for styling
- Native HTML `<select>` element for accessibility
- ChevronDown icon from lucide-react
- Custom styling to match dashboard controls

**Styling:**

```typescript
// Color scheme (matching existing dashboard controls)
const FILTER_STYLES = {
  background: '#0D1526',
  border: '#1E2F50',
  borderHover: '#2A3F68',
  text: '#E8EDF8',
  labelText: '#4E6090',
  fontSize: '11px',
  fontWeight: 'bold',
};
```

### Modified CommandPage Component

**Changes to existing logic:**

1. **Conditional rendering** - Display LocationFilter for central_manager role with 4 options (combined, Mumbai, Bengaluru, Hyderabad)
2. **Warehouse scope calculation** - Use locationFilter state to override forcedWarehouseIds for central managers
3. **LocalStorage integration** - Load initial filter value from localStorage using different storage key
4. **Coexistence with regional manager filter** - Support both central and regional manager filters in same component

**Storage key constant:**

```typescript
const CENTRAL_MANAGER_LOCATION_FILTER_STORAGE_KEY = 'centralManagerLocationFilter';
const REGIONAL_MANAGER_LOCATION_FILTER_STORAGE_KEY = 'regionalManagerLocationFilter'; // existing
```

## Data Models

### Filter State Type

```typescript
type CentralManagerLocationFilterValue = 'combined' | 'WH_MUM' | 'WH_BLR' | 'WH_HYD';
type RegionalManagerLocationFilterValue = 'combined' | 'WH_HYD' | 'WH_BLR'; // existing
```

### LocalStorage Schema

```typescript
// Key: 'centralManagerLocationFilter'
// Value: CentralManagerLocationFilterValue ('combined' | 'WH_MUM' | 'WH_BLR' | 'WH_HYD')
// Example: localStorage.getItem('centralManagerLocationFilter') => 'WH_MUM'
```

### Warehouse Scope Mapping

```typescript
const CENTRAL_MANAGER_FILTER_TO_WAREHOUSE_IDS: Record<CentralManagerLocationFilterValue, RoleWarehouseId[]> = {
  'combined': ['WH_MUM', 'WH_BLR', 'WH_HYD'],
  'WH_MUM': ['WH_MUM'],
  'WH_BLR': ['WH_BLR'],
  'WH_HYD': ['WH_HYD'],
};
```

## Integration Points

### With Existing CommandPage Logic

The filter integrates with these existing functions and data flows:

1. **scopedWarehouseIdsForLogin** - Logic is preserved; filter adds an override layer for central managers
2. **buildScopedHierarchy** - Receives updated warehouse IDs array, no modification needed
3. **getUnifiedDepotSource** - Receives updated warehouse scope via existing role/email/location parameters
4. **WeatherWidget** - Receives filtered warehouse IDs via existing warehouseIds prop
5. **Camera grouping** - Uses existing groupedCameras logic with filtered scopedCameras
6. **KPI aggregation** - Uses existing displayKpis logic with filtered snapshot data

### With Regional Manager Filter

The central manager filter coexists with the existing regional manager filter:
- Uses different storage key: `centralManagerLocationFilter` vs `regionalManagerLocationFilter`
- Uses different filter options: 4 options (3 warehouses + combined) vs 3 options (2 warehouses + combined)
- Applies to different role: `central_manager` vs `regional_manager`
- Same UI component (LocationFilter) with different configuration

### With Backend APIs

**No backend changes required.** The feature operates entirely on the frontend by:
- Modifying which warehouse IDs are included in data fetch requests
- Filtering client-side data based on warehouse scope
- Using existing API contracts and response structures

## Error Handling

### Invalid LocalStorage Values

```typescript
function loadCentralManagerFilterFromStorage(): CentralManagerLocationFilterValue {
  try {
    const stored = localStorage.getItem(CENTRAL_MANAGER_LOCATION_FILTER_STORAGE_KEY);
    if (stored === 'WH_MUM' || stored === 'WH_BLR' || stored === 'WH_HYD' || stored === 'combined') {
      return stored;
    }
  } catch (error) {
    console.warn('Failed to load central manager location filter from storage:', error);
  }
  return 'combined'; // default fallback
}
```

### Storage Write Failures

```typescript
function saveCentralManagerFilterToStorage(value: CentralManagerLocationFilterValue): void {
  try {
    localStorage.setItem(CENTRAL_MANAGER_LOCATION_FILTER_STORAGE_KEY, value);
  } catch (error) {
    console.error('Failed to save central manager location filter to storage:', error);
    // Non-blocking error - filter still works in current session
  }
}
```

### Empty Data Scenarios

When a single warehouse is selected but returns no data:
- Display empty state messaging: "No data available for {warehouse_name}"
- KPI cards show "0" or "N/A" values
- Camera feeds section shows "No cameras found for selected warehouse"
- Weather widget hides the warehouse if API fails

### Role-Based Fallback

If role detection fails or user object is unavailable:
- Filter component is not rendered (safe default)
- Existing warehouse scope logic continues to work
- No runtime errors from missing filter state

## Accessibility

### Keyboard Navigation

```typescript
<select
  aria-label="Select warehouse location filter for central manager"
  className="..."
  value={value}
  onChange={(e) => onChange(e.target.value as CentralManagerLocationFilterValue)}
  onKeyDown={(e) => {
    // Native select handles Enter, Space, Arrow keys automatically
    if (e.key === 'Escape') {
      e.currentTarget.blur(); // Close dropdown on Escape
    }
  }}
>
  {CENTRAL_MANAGER_FILTER_OPTIONS.map(option => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ))}
</select>
```

### Focus Management

```css
/* Focus indicator styling */
select:focus {
  outline: none;
  border-color: #2A3F68;
  box-shadow: 0 0 0 2px rgba(229, 82, 26, 0.2);
}
```

### Screen Reader Support

- Uses native `<select>` element for automatic ARIA semantics
- Includes descriptive `aria-label` attribute: "Select warehouse location filter for central manager"
- Options have clear, human-readable labels
- State changes announce automatically via native select behavior

## Performance Considerations

### Data Fetching Optimization

```typescript
// Debounce rapid filter changes to prevent excessive API calls
const debouncedFetchSnapshot = useMemo(
  () => debounce(fetchSnapshot, 300),
  [fetchSnapshot]
);

// When filter changes, cancel pending fetches and trigger new one
useEffect(() => {
  debouncedFetchSnapshot();
  return () => debouncedFetchSnapshot.cancel();
}, [locationFilter, debouncedFetchSnapshot]);
```

### LocalStorage Access

- Read from localStorage only once on component mount
- Write to localStorage immediately on filter change (no debouncing needed - synchronous operation)
- No performance impact from localStorage operations (single key, small value)

### Re-render Optimization

```typescript
// Memoize filter options to prevent recreation on every render
const centralManagerFilterOptions = useMemo(() => CENTRAL_MANAGER_FILTER_OPTIONS, []);

// Memoize warehouse ID mapping to prevent recalculation
const warehouseIds = useMemo(
  () => CENTRAL_MANAGER_FILTER_TO_WAREHOUSE_IDS[locationFilter],
  [locationFilter]
);
```

### Three-Warehouse Data Impact

- Combined view fetches data for 3 warehouses instead of 2 (regional manager)
- Minimal performance impact: existing architecture already supports multiple warehouses
- Data aggregation scales linearly with warehouse count
- Client-side filtering handles 3 warehouses efficiently

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Filter Visibility Based on Role

*For any* user object with a role attribute, the LocationFilter component with central manager options SHALL be visible in the CommandPage if and only if the user's role is `central_manager`.

**Validates: Requirements 1.1, 1.3**

### Property 2: LocalStorage Restoration

*For any* valid CentralManagerLocationFilterValue (`'combined'`, `'WH_MUM'`, `'WH_BLR'`, or `'WH_HYD'`) stored in localStorage under the key `centralManagerLocationFilter`, when the CommandPage component mounts, the LocationFilter SHALL be initialized to that stored value.

**Validates: Requirements 3.3**

### Property 3: Single Warehouse Data Filtering

*For any* single warehouse selection (`'WH_MUM'`, `'WH_BLR'`, or `'WH_HYD'`), all data displayed in the CommandPage (cameras, KPIs, zones, weather) SHALL contain only entries with a warehouse_id matching the selected warehouse, and SHALL NOT contain data from any other warehouse.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

### Property 4: Combined View Data Inclusion

*For any* snapshot of depot data, when the LocationFilter value is `'combined'`, the displayed data SHALL include entries with warehouse_id equal to `'WH_MUM'` AND entries with warehouse_id equal to `'WH_BLR'` AND entries with warehouse_id equal to `'WH_HYD'`.

**Validates: Requirements 5.1**

### Property 5: Metric Aggregation in Combined View

*For any* set of warehouse-specific KPI metrics, when the LocationFilter value is `'combined'`, the displayed aggregate metrics SHALL equal the sum (or appropriate aggregation function) of the metrics from all three warehouses (WH_MUM, WH_BLR, WH_HYD).

**Validates: Requirements 5.2**

### Property 6: Filter Selection Persistence

*For any* valid CentralManagerLocationFilterValue, when the user changes the LocationFilter selection to that value, the value SHALL be immediately written to localStorage under the key `centralManagerLocationFilter`.

**Validates: Requirements 6.1**

### Property 7: Warehouse Scope Update on Filter Change

*For any* LocationFilter selection change, the warehouse scope (forcedWarehouseIds) SHALL be updated immediately to match the mapping defined by CENTRAL_MANAGER_FILTER_TO_WAREHOUSE_IDS, before any data fetching occurs.

**Validates: Requirements 7.1, 11.1, 11.2, 11.3, 11.4**

### Property 8: Data Refetch on Scope Change

*For any* change to the warehouse scope (forcedWarehouseIds), the CommandPage SHALL trigger a data fetch operation (via getUnifiedDepotSource or equivalent) with the updated warehouse IDs before rendering updated dashboard content.

**Validates: Requirements 7.2**

### Property 9: Camera Filtering by Warehouse Scope

*For any* warehouse scope configuration, all camera feeds displayed in the CommandPage SHALL have a warehouse_id property that exists within the current warehouse scope array, and no cameras with warehouse_id outside the scope SHALL be displayed.

**Validates: Requirements 7.4**

### Property 10: Zone Filtering by Warehouse Scope

*For any* warehouse scope configuration, all zone displays in the CommandPage SHALL have a warehouse_id property that exists within the current warehouse scope array, and no zones with warehouse_id outside the scope SHALL be displayed.

**Validates: Requirements 7.5**

### Property 11: Weather Widget Warehouse Scope Alignment

*For any* warehouse scope configuration, the WeatherWidget component SHALL receive a warehouseIds prop that contains exactly the warehouse IDs in the current scope, with no additional or missing warehouse IDs.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

## Testing Strategy

### Unit Tests

**Example-based tests** for specific UI and configuration scenarios:
- Dropdown renders with four options in correct order (Combined, Mumbai, Bengaluru, Hyderabad)
- Default selection is "Combined" when localStorage is empty
- Filter positioned beside LIVE button in header
- Styling matches design system (colors, fonts, icons)
- Storage key constant is `centralManagerLocationFilter`
- Keyboard accessibility (Tab, Enter, Space, Arrow keys)
- ARIA label is "Select warehouse location filter for central manager"
- Filter does not display for non-central-manager roles (warehouse_manager, regional_manager, admin)

**Edge case tests**:
- Invalid localStorage values default to "combined"
- LocalStorage write failures are handled gracefully
- Component handles missing user object
- Filter coexists with regional manager filter without conflicts

### Property-Based Tests

**Universal properties** tested across generated inputs:

Each property-based test MUST:
- Run minimum 100 iterations
- Include a comment tag referencing the design property
- Tag format: **Feature: central-manager-location-filter, Property {number}: {property_text}**

**Property Test 1: Filter visibility**
- For any user role, filter visibility matches role === "central_manager"
- Tag: `Feature: central-manager-location-filter, Property 1: Filter Visibility Based on Role`

**Property Test 2: LocalStorage restoration**
- For any valid filter value stored in localStorage, component restores that value
- Tag: `Feature: central-manager-location-filter, Property 2: LocalStorage Restoration`

**Property Test 3: Single warehouse filtering**
- For any single warehouse selection (MUM, BLR, or HYD), displayed data contains only that warehouse ID
- Tag: `Feature: central-manager-location-filter, Property 3: Single Warehouse Data Filtering`

**Property Test 4: Combined view inclusion**
- For combined selection, displayed data includes all three warehouse IDs (WH_MUM, WH_BLR, WH_HYD)
- Tag: `Feature: central-manager-location-filter, Property 4: Combined View Data Inclusion`

**Property Test 5: Metric aggregation**
- For any set of warehouse metrics, combined view aggregate equals sum from all three warehouses
- Tag: `Feature: central-manager-location-filter, Property 5: Metric Aggregation in Combined View`

**Property Test 6: Filter persistence**
- For any valid filter selection, localStorage is updated with that value
- Tag: `Feature: central-manager-location-filter, Property 6: Filter Selection Persistence`

**Property Test 7: Warehouse scope update**
- For any filter selection change, warehouse scope updates to match mapping
- Tag: `Feature: central-manager-location-filter, Property 7: Warehouse Scope Update on Filter Change`

**Property Test 8: Data refetch**
- For any scope change, data fetch is triggered with new warehouse IDs
- Tag: `Feature: central-manager-location-filter, Property 8: Data Refetch on Scope Change`

**Property Test 9: Camera filtering**
- For any warehouse scope, cameras displayed match warehouse IDs in scope
- Tag: `Feature: central-manager-location-filter, Property 9: Camera Filtering by Warehouse Scope`

**Property Test 10: Zone filtering**
- For any warehouse scope, zones displayed match warehouse IDs in scope
- Tag: `Feature: central-manager-location-filter, Property 10: Zone Filtering by Warehouse Scope`

**Property Test 11: Weather widget scope**
- For any warehouse scope, weather widget receives exactly those warehouse IDs
- Tag: `Feature: central-manager-location-filter, Property 11: Weather Widget Warehouse Scope Alignment`

### Integration Tests

- Filter integrates with existing scopedWarehouseIdsForLogin logic
- getUnifiedDepotSource called with correct updated scope (3 warehouses)
- Filter does not modify backend API endpoints
- Filter coexists with regional manager filter without interference
- Weather widget correctly displays weather for 1 or 3 warehouses based on selection
- KPI cards aggregate correctly across 3 warehouses in combined view
- Camera feeds show correct cameras for each of the 3 warehouses

## Migration and Rollout

### Deployment Strategy

**No migration required** - feature is additive:
1. Deploy frontend changes
2. Feature activates automatically for central_manager role
3. Other roles see no changes (regional managers keep their 2-warehouse filter)
4. No database migrations needed
5. No backend deployments needed

### Rollback Plan

If issues arise:
1. Remove central manager filter rendering from CommandPage
2. Restore original forcedWarehouseIds derivation logic for central_manager role
3. No data cleanup needed (localStorage values are benign)
4. Regional manager filter continues to work independently

### Feature Flag (Optional)

For controlled rollout, wrap filter rendering:

```typescript
const ENABLE_CENTRAL_MANAGER_LOCATION_FILTER = true; // or from environment config

{ENABLE_CENTRAL_MANAGER_LOCATION_FILTER && personaKey === 'central_manager' && (
  <LocationFilter 
    value={locationFilter} 
    onChange={handleFilterChange}
    options={CENTRAL_MANAGER_FILTER_OPTIONS}
  />
)}
```

## Security Considerations

### Role-Based Access Control

The filter honors existing RBAC:
- Only central_manager role sees the central manager filter
- Regional managers continue to see their own 2-warehouse filter
- Filter cannot grant access to warehouses outside user's permission scope
- Backend APIs enforce warehouse access independently of frontend filtering

### Data Isolation

- Filter operates on already-authorized data from getUnifiedDepotSource
- No new data access paths created
- Cannot bypass existing warehouse scope restrictions
- Each role's filter uses separate localStorage keys to prevent cross-contamination

### LocalStorage Security

- Storage key is user-specific (browser-bound)
- No sensitive data stored (only filter selection value)
- Invalid storage values gracefully default to "combined"
- XSS protection handled by React's automatic escaping
- Different storage keys for different roles (centralManagerLocationFilter vs regionalManagerLocationFilter)

## Future Enhancements

### Potential Extensions

1. **Warehouse search/autocomplete** - If warehouse count grows beyond 3-4
2. **Custom warehouse groups** - Allow central managers to define custom groupings
3. **Filter state in URL** - Share filtered dashboard views via URL parameters
4. **Multi-region support** - Extend to support filtering across multiple regions beyond India
5. **Analytics** - Track which warehouse views are most frequently used
6. **Filter presets** - Save and recall favorite filter configurations
7. **Comparison mode** - Side-by-side comparison of multiple warehouses
8. **Unified filter component** - Abstract regional and central manager filters into single configurable component

### Compatibility Notes

The design supports these extensions without breaking changes:
- Filter component accepts additional warehouse IDs in options array
- Storage schema supports any string value (forward-compatible)
- Warehouse scope calculation is centralized and easily extended
- Component architecture supports multiple role-based filter configurations
