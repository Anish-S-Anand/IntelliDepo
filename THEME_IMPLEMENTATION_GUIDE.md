# Theme Implementation Guide

## Current Status

The theme system has been partially implemented but needs complete overhaul. Currently:
- `ThemeProvider` and `ThemeToggle` exist and work
- `globals.css` has CSS variables defined
- BUT: Most depot components use hardcoded dark colors that don't respond to theme changes

## Problem

Components like `InventoryPage`, `IncidentsPage`, `ExecutiveDashboard`, etc. use hardcoded colors:
- `bg-[#0D1526]` (dark navy)
- `bg-[#14203A]` (card background)
- `text-[#E8EDF8]` (light text)
- `text-[#8A9BBF]` (muted text)
- `border-[#1E2F50]` (borders)

These need to be replaced with CSS variables that change based on theme.

## Solution

### 1. CSS Variables (DONE in globals.css)

Light theme:
- `--bg-page`: #f4f6fa (light gray)
- `--bg-surface`: #ffffff (white)
- `--text-primary`: #0a0f1e (black)
- `--text-secondary`: #374151 (dark gray)
- `--text-muted`: #6b7280 (gray)

Dark theme:
- `--bg-page`: #080e1c (very dark)
- `--bg-surface`: #0D1526 (dark navy)
- `--text-primary`: #E8EDF8 (white)
- `--text-secondary`: #b8c4d8 (light gray)
- `--text-muted`: #8A9BBF (muted light)

### 2. Component Updates Needed

Replace hardcoded colors with CSS variables in:

**High Priority (visible in screenshot):**
- ✅ `DepotTopBar.tsx` - DONE
- ✅ `DepotSidebar.tsx` - DONE
- ✅ `DepotLayout.tsx` - DONE
- ⚠️ `InventoryPage.tsx` - Needs update
- ⚠️ `IncidentsPage.tsx` - Needs update
- ⚠️ `ExecutiveDashboard.tsx` - Needs update
- ⚠️ `SettingsPage.tsx` - Needs update

**Medium Priority:**
- `CameraGrid.tsx`
- `PerimeterSecurityPage.tsx`
- All other depot operation pages

### 3. Quick Fix Approach

Instead of rewriting every component, use CSS class overrides in `globals.css`:

```css
/* Override hardcoded dark colors */
html:not(.dark) .bg-\\[\\#0D1526\\] { background-color: #ffffff !important; }
html:not(.dark) .bg-\\[\\#14203A\\] { background-color: #f8f9fc !important; }
html:not(.dark) .text-\\[\\#E8EDF8\\] { color: #0a0f1e !important; }
html:not(.dark) .text-\\[\\#8A9BBF\\] { color: #6b7280 !important; }
html:not(.dark) .text-\\[\\#4E6090\\] { color: #9ca3af !important; }
html:not(.dark) .border-\\[\\#1E2F50\\] { border-color: #e2e6f0 !important; }
```

This allows the existing components to work without modification.

### 4. Recommended Approach (Better)

Create a utility function that returns theme-aware class names:

```typescript
// lib/theme-utils.ts
export function themeClass(lightClass: string, darkClass: string) {
  return `${lightClass} dark:${darkClass}`;
}

// Usage:
className={themeClass("bg-white text-black", "bg-[#0D1526] text-white")}
```

### 5. Implementation Steps

1. ✅ Add CSS variables to `globals.css`
2. ✅ Update `DepotTopBar`, `DepotSidebar`, `DepotLayout` to use CSS variables
3. ⚠️ Add CSS overrides for hardcoded Tailwind classes (quick fix)
4. ⚠️ Gradually migrate components to use CSS variables directly

## Testing Checklist

- [ ] Toggle theme in depot — verify all colors invert
- [ ] Check sidebar: light = white bg, dark = navy bg
- [ ] Check cards: light = white, dark = navy
- [ ] Check text: light = black, dark = white
- [ ] Check inputs: light = white bg, dark = dark bg
- [ ] Check borders: light = gray, dark = navy
- [ ] Verify no "flash" of wrong theme on page load
- [ ] Test on all depot pages (Operations, Inventory, Incidents, etc.)

## Next Steps

Add the CSS overrides to `globals.css` to make existing components theme-aware without rewriting them all.
