# Design Document

## Overview

The Regional Manager Location Filter feature adds a dropdown component to the Command Center dashboard that allows regional managers to filter their view by warehouse location. The filter enables toggling between individual warehouse views (Hyderabad or Bengaluru) and a combined view of both warehouses. The design integrates seamlessly with existing dashboard architecture by modifying the warehouse scope determination logic while preserving all existing backend APIs and data structures.

## Architecture

### Component Structure

```
CommandPage (existing)
├── Header Section
│   ├── Page Title & Metadata
│   ├── WeatherWidget (existing)
│   └── LocationFilter (NEW)
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
// New state
const [locationFilter, setLocationFilter] = useState<'combined' | 'WH_HYD' | 'WH_BLR'>('combined');

// Modified existing state derivation
const forcedWarehouseIds = useMemo(() => {
  // For regional managers, use locationFilter to determine scope
  if (personaKey === 'regional_manager') {
    if (locationFilter === 'WH_HYD') return ['WH_HYD'];
    if (locationFilter === 'WH_BLR') return ['WH_BLR'];
    return ['WH_HYD', 'WH_BLR']; // combined
  }
  // For other roles, use existing logic
  return scopedWarehouseIdsForLogin(user?.email, personaKey);
}, [personaKey, user?.email, locationFilter]);
```

## Components and Interfaces

### LocationFilter Component

A new React component that renders a styled dropdown selector.

**Interface:**

```typescript
interface LocationFilterProps {
  value: 'combined' | 'WH_HYD' | 'WH_BLR';
  onChange: (value: 'combined' | 'WH_HYD' | 'WH_BLR') => void;
  disabled?: boolean;
}

type FilterOption = {
  value: 'combined' | 'WH_HYD' | 'WH_BLR';
  label: string;
};

const FILTER_OPTIONS: FilterOption[] = [
  { value: 'combined', label: 'Hyderabad and Bengaluru (Combined)' },
  { value: 'WH_HYD', label: 'Hyderabad' },
  { value: 'WH_BLR', label: 'Bengaluru' },
];
```

**Implementation Pattern:**

The component follows the same pattern as the existing `GateSelector` component in CommandPage.tsx, using:
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

1. **Conditional rendering** - Display LocationFilter only for regional_manager role
2. **Warehouse scope calculation** - Use locationFilter state to override forcedWarehouseIds for regional managers
3. **LocalStorage integration** - Load initial filter value from localStorage and persist changes

**Storage key constant:**

```typescript
const LOCATION_FILTER_STORAGE_KEY = 'regionalManagerLocationFilter';
```

## Data Models

### Filter State Type

```typescript
type LocationFilterValue = 'combined' | 'WH_HYD' | 'WH_BLR';
```

### LocalStorage Schema

```typescript
// Key: 'regionalManagerLocationFilter'
// Value: LocationFilterValue ('combined' | 'WH_HYD' | 'WH_BLR')
// Example: localStorage.getItem('regionalManagerLocationFilter') => 'WH_HYD'
```

### Warehouse Scope Mapping

```typescript
const FILTER_TO_WAREHOUSE_IDS: Record<LocationFilterValue, RoleWarehouseId[]> = {
  'combined': ['WH_HYD', 'WH_BLR'],
  'WH_HYD': ['WH_HYD'],
  'WH_BLR': ['WH_BLR'],
};
```

## Integration Points

### With Existing CommandPage Logic

The filter integrates with these existing functions and data flows:

1. **scopedWarehouseIdsForLogin** - Logic is preserved; filter adds an override layer for regional managers
2. **buildScopedHierarchy** - Receives updated warehouse IDs array, no modification needed
3. **getUnifiedDepotSource** - Receives updated warehouse scope via existing role/email/location parameters
4. **WeatherWidget** - Receives filtered warehouse IDs via existing warehouseIds prop
5. **Camera grouping** - Uses existing groupedCameras logic with filtered scopedCameras
6. **KPI aggregation** - Uses existing displayKpis logic with filtered snapshot data

### With Backend APIs

**No backend changes required.** The feature operates entirely on the frontend by:
- Modifying which warehouse IDs are included in data fetch requests
- Filtering client-side data based on warehouse scope
- Using existing API contracts and response structures

## Error Handling

### Invalid LocalStorage Values

```typescript
function loadFilterFromStorage(): LocationFilterValue {
  try {
    const stored = localStorage.getItem(LOCATION_FILTER_STORAGE_KEY);
    if (stored === 'WH_HYD' || stored === 'WH_BLR' || stored === 'combined') {
      return stored;
    }
  } catch (error) {
    console.warn('Failed to load location filter from storage:', error);
  }
  return 'combined'; // default fallback
}
```

### Storage Write Failures

```typescript
function saveFilterToStorage(value: LocationFilterValue): void {
  try {
    localStorage.setItem(LOCATION_FILTER_STORAGE_KEY, value);
  } catch (error) {
    console.error('Failed to save location filter to storage:', error);
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

## Accessibility

### Keyboard Navigation

```typescript
<select
  aria-label="Select warehouse location filter"
  className="..."
  value={value}
  onChange={(e) => onChange(e.target.value as LocationFilterValue)}
  onKeyDown={(e) => {
    // Native select handles Enter, Space, Arrow keys automatically
    if (e.key === 'Escape') {
      e.currentTarget.blur(); // Close dropdown on Escape
    }
  }}
>
  {FILTER_OPTIONS.map(option => (
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
- Includes descriptive `aria-label` attribute
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
const filterOptions = useMemo(() => FILTER_OPTIONS, []);

// Memoize warehouse ID mapping to prevent recalculation
const warehouseIds = useMemo(
  () => FILTER_TO_WAREHOUSE_IDS[locationFilter],
  [locationFilter]
);
```

## Testing Strategy

### Unit Tests

**Example-based tests** for specific UI and configuration scenarios:
- Dropdown renders with three options in correct order
- Default selection is "Combined" when localStorage is empty
- Filter positioned beside LIVE button in header
- Styling matches design system (colors, fonts, icons)
- Storage key constant is `regionalManagerLocationFilter`
- Keyboard accessibility (Tab, Enter, Space, Arrow keys)
- ARIA label is correct

**Edge case tests**:
- Invalid localStorage values default to "combined"
- LocalStorage write failures are handled gracefully
- Component handles missing user object

### Property-Based Tests

**Universal properties** tested across generated inputs:
- For any user role, filter visibility matches role === "regional_manager"
- For any valid filter value stored in localStorage, component restores that value
- For any single warehouse selection (HYD or BLR), displayed data contains only that warehouse ID
- For combined selection, displayed data includes both WH_HYD and WH_BLR
- For any valid filter selection, localStorage is updated with that value
- For any filter selection change, warehouse scope updates to match
- For any scope change, data fetch is triggered with new warehouse IDs
- For any warehouse scope, cameras displayed match warehouse IDs in scope
- For any warehouse scope, weather widget receives only warehouses in scope

### Integration Tests

- Filter integrates with existing scopedWarehouseIdsForLogin logic
- getUnifiedDepotSource called with correct updated scope
- Filter does not modify backend API endpoints
- Filter does not modify ROLE_WAREHOUSE_REGISTRY constant

## Migration and Rollout

### Deployment Strategy

**No migration required** - feature is additive:
1. Deploy frontend changes
2. Feature activates automatically for regional_manager role
3. Other roles see no changes
4. No database migrations needed
5. No backend deployments needed

### Rollback Plan

If issues arise:
1. Remove LocationFilter component from CommandPage render
2. Restore original forcedWarehouseIds derivation logic
3. No data cleanup needed (localStorage values are benign)

### Feature Flag (Optional)

For controlled rollout, wrap filter rendering:

```typescript
const ENABLE_LOCATION_FILTER = true; // or from environment config

{ENABLE_LOCATION_FILTER && personaKey === 'regional_manager' && (
  <LocationFilter value={locationFilter} onChange={handleFilterChange} />
)}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Filter Visibility Based on Role

*For any* user object with a role attribute, the LocationFilter component SHALL be visible in the CommandPage if and only if the user's role is `regional_manager`.

**Validates: Requirements 1.1, 1.3**

### Property 2: LocalStorage Restoration

*For any* valid LocationFilterValue (`'combined'`, `'WH_HYD'`, or `'WH_BLR'`) stored in localStorage under the key `regionalManagerLocationFilter`, when the CommandPage component mounts, the LocationFilter SHALL be initialized to that stored value.

**Validates: Requirements 3.3, 6.4**

### Property 3: Single Warehouse Data Filtering

*For any* single warehouse selection (`'WH_HYD'` or `'WH_BLR'`), all data displayed in the CommandPage (cameras, KPIs, zones, weather) SHALL contain only entries with a warehouse_id matching the selected warehouse, and SHALL NOT contain data from any other warehouse.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 4: Combined View Data Inclusion

*For any* snapshot of depot data, when the LocationFilter value is `'combined'`, the displayed data SHALL include entries with warehouse_id equal to `'WH_HYD'` AND entries with warehouse_id equal to `'WH_BLR'`.

**Validates: Requirements 5.1**

### Property 5: Metric Aggregation in Combined View

*For any* set of warehouse-specific KPI metrics, when the LocationFilter value is `'combined'`, the displayed aggregate metrics SHALL equal the sum (or appropriate aggregation function) of the metrics from both WH_HYD and WH_BLR.

**Validates: Requirements 5.2**

### Property 6: Filter Selection Persistence

*For any* valid LocationFilterValue, when the user changes the LocationFilter selection to that value, the value SHALL be immediately written to localStorage under the key `regionalManagerLocationFilter`.

**Validates: Requirements 6.1**

### Property 7: Warehouse Scope Update on Filter Change

*For any* LocationFilter selection change, the warehouse scope (forcedWarehouseIds) SHALL be updated immediately to match the mapping defined by FILTER_TO_WAREHOUSE_IDS, before any data fetching occurs.

**Validates: Requirements 7.1, 9.2**

### Property 8: Data Refetch on Scope Change

*For any* change to the warehouse scope (forcedWarehouseIds), the CommandPage SHALL trigger a data fetch operation (via getUnifiedDepotSource or equivalent) with the updated warehouse IDs before rendering updated dashboard content.

**Validates: Requirements 7.2**

### Property 9: Camera Filtering by Warehouse Scope

*For any* warehouse scope configuration, all camera feeds displayed in the CommandPage SHALL have a warehouse_id property that exists within the current warehouse scope array, and no cameras with warehouse_id outside the scope SHALL be displayed.

**Validates: Requirements 7.4**

### Property 10: Weather Widget Warehouse Scope Alignment

*For any* warehouse scope configuration, the WeatherWidget component SHALL receive a warehouseIds prop that contains exactly the warehouse IDs in the current scope, with no additional or missing warehouse IDs.

**Validates: Requirements 7.5**

## Security Considerations

### Role-Based Access Control

The filter honors existing RBAC:
- Only regional_manager role sees the filter
- Filter cannot grant access to warehouses outside user's permission scope
- Backend APIs enforce warehouse access independently of frontend filtering

### Data Isolation

- Filter operates on already-authorized data from getUnifiedDepotSource
- No new data access paths created
- Cannot bypass existing warehouse scope restrictions

### LocalStorage Security

- Storage key is user-specific (browser-bound)
- No sensitive data stored (only filter selection value)
- Invalid storage values gracefully default to "combined"
- XSS protection handled by React's automatic escaping

## Future Enhancements

### Potential Extensions

1. **Warehouse search/autocomplete** - If warehouse count grows beyond 2-3
2. **Custom warehouse groups** - Allow regional managers to define custom groupings
3. **Filter state in URL** - Share filtered dashboard views via URL parameters
4. **Multi-region support** - Extend to support filtering across multiple regions
5. **Analytics** - Track which warehouse views are most frequently used
6. **Filter presets** - Save and recall favorite filter configurations

### Compatibility Notes

The design supports these extensions without breaking changes:
- Filter component accepts additional warehouse IDs in options array
- Storage schema supports any string value (forward-compatible)
- Warehouse scope calculation is centralized and easily extended
