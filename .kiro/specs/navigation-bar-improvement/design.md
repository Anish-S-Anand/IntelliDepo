# Design Document: Navigation Bar Improvement

## Overview

This design document specifies the technical implementation for improving the IntelliDepot navigation sidebar to match the reference design from `fidelis-chart-updated.html`. The improvements focus on expanding the sidebar width, displaying full navigation labels, adding visual active state indicators with an accent bar, and improving overall layout and spacing while maintaining all existing functionality.

### Design Goals

1. **Enhanced Clarity**: Replace abbreviated labels (CMD, OPS, INV) with full descriptive labels (Command Center, Operations Hub, Inventory)
2. **Visual Hierarchy**: Add a 4px orange accent bar on the left edge of active navigation items
3. **Improved Layout**: Expand sidebar from 64px to 204px width with horizontal icon+label layout
4. **Zero Breaking Changes**: Preserve all existing navigation, routing, role-based filtering, and mobile responsiveness
5. **Theme Compatibility**: Ensure all changes work seamlessly in both light and dark themes

### Scope

**In Scope:**
- Sidebar width expansion (64px → 204px)
- Navigation item layout changes (vertical → horizontal)
- Active state accent bar implementation
- Full label display
- Layout container margin adjustments
- CSS transitions and hover states
- Theme-aware styling

**Out of Scope:**
- Changes to navigation routes or routing logic
- Modifications to role-based filtering logic
- Changes to alert fetching or badge display logic
- Topbar modifications (beyond minor adjustments if needed)
- Mobile hamburger menu functionality changes

## Architecture

### Component Structure

The navigation bar improvement involves three primary components:

```
frontend/src/
├── components/depot/layout/
│   └── DepotSidebar.tsx          # Main sidebar component (MODIFIED)
├── app/depot/
│   └── layout.tsx                 # Layout container (MODIFIED)
└── app/
    └── globals.css                # Global styles (MODIFIED)
```

### Data Flow

The existing data flow remains unchanged:

```
DepotSidebar Component
├── useAuthStore → user role
├── usePathname → active route detection
├── getAllActiveAlerts() → vision alerts
├── getPerimeterAlertCount() → perimeter alerts
└── NAV_ITEMS arrays → filtered by role
```

### State Management

No new state is introduced. Existing state remains:
- `sidebarOpen` (boolean) - managed in layout.tsx
- `alertCount` (number) - managed in DepotSidebar.tsx
- `user` - from authStore
- `pathname` - from Next.js router

## Components and Interfaces

### 1. DepotSidebar Component

**File:** `frontend/src/components/depot/layout/DepotSidebar.tsx`

#### Changes Required

**Width and Layout:**
```typescript
// BEFORE: Fixed width w-16 (64px)
<aside className="depot-sidebar fixed left-0 top-[52px] bottom-0 w-16 ...">

// AFTER: Fixed width w-[204px]
<aside className="depot-sidebar fixed left-0 top-[52px] bottom-0 w-[204px] ...">
```

**Navigation Item Structure:**
```typescript
// BEFORE: Vertical flex layout (flex-col)
<Link
  className="depot-sidebar-item relative w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 ..."
>
  <Icon className="w-4 h-4" />
  <span className="text-[7px] font-bold uppercase">{item.label}</span>
</Link>

// AFTER: Horizontal flex layout (flex-row)
<Link
  className="depot-sidebar-item relative w-auto min-h-[50px] rounded-xl inline-flex flex-row items-center justify-start gap-[10px] px-[13px] ..."
>
  <Icon className="w-5 h-5" />
  <span className="text-[13.5px] font-bold tracking-[0.01em]">{item.fullLabel}</span>
</Link>
```

**Label Display:**
- Change from `item.label` (abbreviated) to `item.fullLabel` (full text)
- Update font size from `text-[7px]` to `text-[13.5px]`
- Update letter-spacing to `tracking-[0.01em]`
- Remove `uppercase` class (full labels use normal case)

**Dimensions:**
- Width: `w-11` → `w-auto` (auto-width based on content)
- Height: `h-11` → `min-h-[50px]` (minimum height)
- Padding: Add `px-[13px]` for horizontal padding
- Gap: `gap-0.5` → `gap-[10px]` (10px between icon and label)

**Icon Size:**
- Update from `w-4 h-4` (16px) to `w-5 h-5` (20px)

**Badge Positioning:**
```typescript
// BEFORE: Positioned for small square button
<span className="absolute top-0.5 right-0.5 w-4 h-4 ...">

// AFTER: Positioned for wider horizontal button
<span className="absolute top-[6px] right-[10px] min-w-[13px] h-[13px] text-[7px] ...">
```

#### Updated NAV_ITEMS Arrays

The `fullLabel` property already exists in the arrays, so no changes needed to the data structure. The component will simply use `item.fullLabel` instead of `item.label` for display.

### 2. Layout Container Component

**File:** `frontend/src/app/depot/layout.tsx`

#### Changes Required

**Main Content Margin:**
```typescript
// BEFORE: md:ml-16 (64px left margin on desktop)
<main className="pt-[52px] md:ml-16 min-h-[100vh] theme-transition" ...>

// AFTER: md:ml-[204px] (204px left margin on desktop)
<main className="pt-[52px] md:ml-[204px] min-h-[100vh] theme-transition" ...>
```

**Mobile Behavior:**
- No changes to mobile behavior
- Sidebar still collapses off-screen on mobile (< 768px)
- Overlay and toggle functionality remain unchanged

### 3. Global CSS Styles

**File:** `frontend/src/app/globals.css`

#### New CSS Rules

**Active State Accent Bar:**
```css
/* Add to existing .depot-sidebar-item.active rule */
.depot-sidebar-item.active::before {
  content: '';
  position: absolute;
  left: -9px;  /* Position outside the sidebar padding */
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 28px;
  background: var(--accent);  /* #E5521A */
  border-radius: 0 3px 3px 0;  /* Rounded on right side only */
  transition: opacity 0.18s ease;
}
```

**Updated Navigation Item Styles:**
```css
.depot-sidebar-item {
  /* Update existing rule */
  min-height: 50px;  /* Increased from 44px */
  padding: 0 13px;   /* Horizontal padding */
  gap: 10px;         /* Space between icon and label */
  transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
}

.depot-sidebar-item:hover {
  background-color: var(--bg-nav-item) !important;
  color: var(--text-secondary) !important;
  border-color: var(--border-default) !important;
}

.depot-sidebar-item.active {
  background-color: rgba(229,82,26,0.12) !important;
  color: #E5521A !important;
  border-color: rgba(229,82,26,0.22) !important;
}
```

**Sidebar Width:**
```css
.depot-sidebar {
  width: 204px;  /* Explicit width for consistency */
  background-color: var(--bg-nav) !important;
  border-right-color: var(--bg-nav-border) !important;
  transition: transform 0.3s ease, background-color 0.25s ease, border-color 0.25s ease;
}

/* Mobile: sidebar slides off-screen */
@media (max-width: 767px) {
  .depot-sidebar {
    transform: translateX(-100%);
  }
  
  .depot-sidebar.open {
    transform: translateX(0);
  }
}

/* Desktop: sidebar always visible */
@media (min-width: 768px) {
  .depot-sidebar {
    transform: translateX(0) !important;
  }
}
```

**Vertical Spacing:**
```css
/* Update sidebar padding and gap */
.depot-sidebar {
  padding: 10px 8px;  /* Vertical and horizontal padding */
  gap: 3px;           /* Gap between navigation items */
}
```

## Data Models

No new data models are introduced. Existing data structures remain unchanged:

### Navigation Item Interface (Implicit)

```typescript
interface NavItem {
  label: string;        // Abbreviated label (e.g., "CMD")
  fullLabel: string;    // Full label (e.g., "Command Center")
  href: string;         // Route path
  icon: LucideIcon;     // Icon component
}
```

### Component Props (Unchanged)

```typescript
// DepotSidebar props
interface DepotSidebarProps {
  open: boolean;
  onClose?: () => void;
}

// Layout props
interface DepotLayoutProps {
  children: React.ReactNode;
}
```

## Error Handling

### Graceful Degradation

1. **Missing fullLabel Property:**
   - Fallback to `label` property if `fullLabel` is undefined
   - Implementation: `{item.fullLabel || item.label}`

2. **CSS Not Loaded:**
   - Inline styles provide fallback for critical dimensions
   - Tailwind classes ensure basic layout works

3. **Theme Variables Not Defined:**
   - CSS variables have fallback values
   - Example: `background: var(--bg-nav, #FFFFFF)`

4. **Mobile Responsiveness:**
   - Sidebar collapses gracefully on small screens
   - Overlay prevents interaction issues
   - Touch events properly handled

### Error Boundaries

No new error boundaries needed. Existing React error boundaries in the application will catch any rendering errors.

## Testing Strategy

### Manual Testing Checklist

#### Desktop Testing (≥768px)

**Visual Verification:**
- [ ] Sidebar width is 204px
- [ ] Navigation items show full labels (not abbreviations)
- [ ] Icons are 20px × 20px
- [ ] Icon and label have 10px gap
- [ ] Navigation items have minimum 50px height
- [ ] Active item has orange accent bar (4px × 28px) on left edge
- [ ] Active item has orange background (rgba(229,82,26,0.12))
- [ ] Active item has orange border (rgba(229,82,26,0.22))
- [ ] Active item text is orange (#E5521A)
- [ ] Hover states work correctly
- [ ] Badge positioning is correct on Incidents item
- [ ] Main content has 204px left margin
- [ ] No content overlap or misalignment

**Functional Verification:**
- [ ] All navigation links work correctly
- [ ] Active state updates when navigating
- [ ] Role-based filtering works (warehouse manager, regional manager, admin)
- [ ] Alert counts display correctly
- [ ] Alert polling works (60-second interval)
- [ ] Smooth transitions on hover and active state changes

**Theme Testing:**
- [ ] Light theme: sidebar is white, text is dark
- [ ] Dark theme: sidebar is dark navy, text is light
- [ ] Accent bar is orange (#E5521A) in both themes
- [ ] Theme toggle transitions smoothly
- [ ] All colors use CSS variables correctly

#### Mobile Testing (<768px)

**Visual Verification:**
- [ ] Sidebar is hidden by default (translateX(-100%))
- [ ] Hamburger menu button works
- [ ] Sidebar slides in from left when opened
- [ ] Sidebar width is 204px when open
- [ ] Overlay appears behind sidebar
- [ ] Overlay is semi-transparent black
- [ ] Navigation items display correctly (full labels, icons)
- [ ] Active state accent bar displays correctly

**Functional Verification:**
- [ ] Tapping overlay closes sidebar
- [ ] Tapping navigation item closes sidebar and navigates
- [ ] Sidebar closes on route change
- [ ] Sidebar closes on window resize to desktop
- [ ] Touch events work smoothly
- [ ] No scroll issues when sidebar is open

#### Cross-Browser Testing

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

#### Responsive Breakpoints

Test at:
- [ ] 320px (mobile small)
- [ ] 375px (mobile medium)
- [ ] 768px (tablet/desktop breakpoint)
- [ ] 1024px (desktop)
- [ ] 1440px (large desktop)
- [ ] 1920px (full HD)

### Regression Testing

**Existing Functionality:**
- [ ] All routes navigate correctly
- [ ] Role-based navigation filtering works
- [ ] Alert fetching and display works
- [ ] Badge counts update correctly
- [ ] Topbar remains unchanged
- [ ] Page content displays correctly
- [ ] No console errors
- [ ] No layout shifts or flashing

### Accessibility Testing

**Keyboard Navigation:**
- [ ] Tab through navigation items works
- [ ] Enter/Space activates navigation items
- [ ] Focus indicators are visible
- [ ] Focus order is logical

**Screen Reader:**
- [ ] Navigation items have proper labels
- [ ] Active state is announced
- [ ] Badge counts are announced
- [ ] Sidebar role is properly identified

**Visual:**
- [ ] Text contrast meets WCAG AA standards
- [ ] Active state is distinguishable without color alone (accent bar provides shape)
- [ ] Hover states are clear
- [ ] Font size is readable (13.5px minimum)

### Performance Testing

**Metrics to Verify:**
- [ ] No layout thrashing on navigation
- [ ] Smooth 60fps transitions
- [ ] No memory leaks from alert polling
- [ ] Fast initial render
- [ ] No unnecessary re-renders

## Implementation Plan

### Phase 1: CSS Foundation (30 minutes)

1. **Update globals.css:**
   - Add accent bar pseudo-element styles
   - Update `.depot-sidebar` width and padding
   - Update `.depot-sidebar-item` dimensions and layout
   - Add responsive media queries
   - Test theme compatibility

2. **Verify CSS:**
   - Check in browser DevTools
   - Verify CSS variables resolve correctly
   - Test in both themes

### Phase 2: Sidebar Component (45 minutes)

1. **Update DepotSidebar.tsx:**
   - Change sidebar width class: `w-16` → `w-[204px]`
   - Update navigation item classes:
     - Layout: `flex-col` → `inline-flex flex-row`
     - Alignment: `items-center justify-center` → `items-center justify-start`
     - Width: `w-11` → `w-auto`
     - Height: `h-11` → `min-h-[50px]`
     - Padding: Add `px-[13px]`
     - Gap: `gap-0.5` → `gap-[10px]`
   - Update icon size: `w-4 h-4` → `w-5 h-5`
   - Change label display: `{item.label}` → `{item.fullLabel}`
   - Update label classes:
     - Font size: `text-[7px]` → `text-[13.5px]`
     - Remove: `uppercase`
     - Add: `tracking-[0.01em]`
   - Update badge positioning:
     - Top: `top-0.5` → `top-[6px]`
     - Right: `right-0.5` → `right-[10px]`
     - Width: `w-4` → `min-w-[13px]`
     - Height: `h-4` → `h-[13px]`
     - Font: `text-[7px]` (keep same)

2. **Test Component:**
   - Verify rendering in browser
   - Check all navigation items
   - Test active state
   - Test hover states
   - Verify badge display

### Phase 3: Layout Container (15 minutes)

1. **Update layout.tsx:**
   - Change main margin: `md:ml-16` → `md:ml-[204px]`
   - Verify mobile behavior unchanged

2. **Test Layout:**
   - Check content alignment
   - Verify no overlap
   - Test responsive behavior

### Phase 4: Testing & Refinement (60 minutes)

1. **Desktop Testing:**
   - Test all navigation items
   - Test role-based filtering
   - Test theme switching
   - Test active states
   - Test hover states
   - Test badge display

2. **Mobile Testing:**
   - Test sidebar open/close
   - Test overlay
   - Test navigation
   - Test responsive breakpoints

3. **Cross-Browser Testing:**
   - Test in Chrome, Firefox, Safari, Edge
   - Verify consistent rendering

4. **Accessibility Testing:**
   - Test keyboard navigation
   - Test screen reader
   - Verify contrast ratios

5. **Performance Testing:**
   - Check for layout shifts
   - Verify smooth transitions
   - Test alert polling

### Phase 5: Documentation & Handoff (15 minutes)

1. **Update Documentation:**
   - Document changes made
   - Note any deviations from design
   - List any known issues

2. **Create PR:**
   - Write clear PR description
   - Include screenshots
   - List testing performed

## Deployment Considerations

### Pre-Deployment Checklist

- [ ] All tests pass
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Code reviewed
- [ ] Screenshots captured
- [ ] Documentation updated

### Rollback Plan

If issues are discovered in production:

1. **Immediate Rollback:**
   - Revert the PR
   - Deploy previous version
   - Investigate issues

2. **CSS-Only Rollback:**
   - If only CSS issues, can hotfix globals.css
   - Revert specific CSS rules
   - No component changes needed

3. **Component Rollback:**
   - Revert DepotSidebar.tsx changes
   - Revert layout.tsx changes
   - Keep CSS changes (they won't break anything)

### Monitoring

After deployment, monitor:
- [ ] Error tracking (Sentry/similar)
- [ ] User feedback
- [ ] Performance metrics
- [ ] Browser console errors
- [ ] Mobile device testing

## Risk Assessment

### Low Risk

✅ **CSS Changes:**
- CSS is additive, not destructive
- Uses existing CSS variable system
- Fallbacks in place

✅ **Width Changes:**
- Simple dimension updates
- No complex calculations
- Responsive breakpoints well-defined

✅ **Label Changes:**
- Data already exists in arrays
- Simple property swap
- No data fetching changes

### Medium Risk

⚠️ **Layout Shifts:**
- Main content margin change could cause brief layout shift
- Mitigation: Use CSS transitions
- Test thoroughly on different screen sizes

⚠️ **Mobile Responsiveness:**
- Wider sidebar could cause issues on small tablets
- Mitigation: Test at all breakpoints
- Ensure 768px breakpoint is correct

### High Risk

❌ **None Identified**

All changes are UI-only with no business logic modifications.

## Alternatives Considered

### Alternative 1: Collapsible Sidebar

**Description:** Add a collapse button to toggle between 64px and 204px widths.

**Pros:**
- Gives users control
- Maximizes screen space when needed
- Common pattern in enterprise apps

**Cons:**
- Adds complexity
- Requires state management
- Not in requirements
- More testing needed

**Decision:** Rejected - Not in requirements, adds unnecessary complexity.

### Alternative 2: Tooltip Labels on Hover

**Description:** Keep 64px width, show full labels in tooltips on hover.

**Pros:**
- Maintains compact sidebar
- No layout changes needed
- Simple implementation

**Cons:**
- Doesn't match reference design
- Poor mobile experience
- Requires hover (not touch-friendly)
- Doesn't meet requirements

**Decision:** Rejected - Doesn't meet requirements for always-visible full labels.

### Alternative 3: Icon-Only with Bottom Labels

**Description:** Keep vertical layout but expand width, show icon above label.

**Pros:**
- Maintains vertical visual flow
- Familiar pattern

**Cons:**
- Doesn't match reference design
- Less space-efficient
- Harder to scan

**Decision:** Rejected - Reference design clearly shows horizontal layout.

## Appendix

### CSS Variable Reference

```css
/* Navigation Colors */
--bg-nav:           /* Sidebar background */
--bg-nav-border:    /* Sidebar border */
--bg-nav-item:      /* Nav item hover background */
--bg-nav-active:    /* Nav item active background */
--text-nav:         /* Nav item text color */
--text-nav-active:  /* Nav item active text color */
--accent:           /* Orange accent color #E5521A */
--accent-border:    /* Orange border color */
```

### Dimension Reference

```
Sidebar:
- Width: 204px
- Padding: 10px 8px
- Gap: 3px

Navigation Item:
- Min Height: 50px
- Padding: 0 13px
- Gap: 10px (icon to label)
- Border Radius: 12px
- Border Width: 1px

Icon:
- Size: 20px × 20px

Label:
- Font Size: 13.5px
- Font Weight: 700
- Letter Spacing: 0.01em

Accent Bar:
- Width: 4px
- Height: 28px
- Position: Left edge, vertically centered
- Border Radius: 0 3px 3px 0
- Color: #E5521A

Badge:
- Min Width: 13px
- Height: 13px
- Font Size: 7px
- Position: Top 6px, Right 10px
```

### Color Reference

```
Accent Orange: #E5521A
Active Background: rgba(229,82,26,0.12)
Active Border: rgba(229,82,26,0.22)
Hover Background: var(--bg-nav-item)
Badge Background: #F04A4A
```

### Responsive Breakpoints

```
Mobile: < 768px
  - Sidebar: translateX(-100%) (hidden)
  - Main margin: 0

Desktop: ≥ 768px
  - Sidebar: translateX(0) (visible)
  - Main margin: 204px
```

### File Change Summary

```
Modified Files:
1. frontend/src/components/depot/layout/DepotSidebar.tsx
   - Sidebar width: w-16 → w-[204px]
   - Nav item layout: vertical → horizontal
   - Label display: abbreviated → full
   - Dimensions and spacing updates

2. frontend/src/app/depot/layout.tsx
   - Main margin: md:ml-16 → md:ml-[204px]

3. frontend/src/app/globals.css
   - Active state accent bar styles
   - Updated navigation item styles
   - Responsive media queries
```

### Testing Checklist Summary

```
Desktop:
✓ Visual layout correct
✓ Active state accent bar displays
✓ Full labels visible
✓ Hover states work
✓ Theme switching works
✓ Navigation functions correctly
✓ Role-based filtering works
✓ Alert badges display correctly

Mobile:
✓ Sidebar collapses off-screen
✓ Hamburger menu opens sidebar
✓ Overlay works correctly
✓ Navigation closes sidebar
✓ Touch events work smoothly

Cross-Browser:
✓ Chrome
✓ Firefox
✓ Safari
✓ Edge

Accessibility:
✓ Keyboard navigation
✓ Screen reader support
✓ Color contrast
✓ Focus indicators
```
