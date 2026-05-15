# Theme CSS Variables Documentation

This document describes the CSS variables defined in `src/app/globals.css` for the IntelliDepot theme system.

## Overview

The theme system uses CSS custom properties (variables) to enable seamless switching between light and dark themes. All colors meet WCAG AA accessibility standards for contrast ratios.

## Light Theme Variables

Defined in `:root` selector, these are the default theme colors:

### Page Backgrounds
- `--bg-page: #F0F4FA` - Warm off-white page background
- `--bg-page-2: #E8EDF7` - Alternative page background

### Surface Backgrounds
- `--bg-surface: #FFFFFF` - Pure white for cards and surfaces
- `--bg-surface-2: #F5F7FC` - Light gray surface variant
- `--bg-surface-3: #EEF1F8` - Lighter gray surface variant

### Navigation
- `--bg-nav: #FFFFFF` - Clean white navigation background
- `--bg-nav-border: #E5E7EB` - Navigation border color
- `--bg-nav-item: #F3F4F6` - Navigation item hover background
- `--bg-nav-active: rgba(229,82,26,0.08)` - Active navigation item background

### Text Colors
- `--text-primary: #0D1117` - Deep charcoal for maximum legibility (18.92:1 contrast)
- `--text-secondary: #1F2937` - Secondary text (14.68:1 contrast)
- `--text-muted: #4B5563` - Muted text (7.56:1 contrast)
- `--text-faint: #9CA3AF` - Faint text for less important content
- `--text-nav: #374151` - Navigation text color
- `--text-nav-active: #E5521A` - Active navigation text (accent color)

### Borders
- `--border-default: #E5E7EB` - Subtle gray borders (1.24:1 contrast)
- `--border-strong: #D1D5DB` - Stronger borders for emphasis (1.47:1 contrast)

### Inputs
- `--bg-input: #FFFFFF` - White input backgrounds
- `--border-input: #D1D5DB` - Input border color
- `--text-input: #0D1117` - Input text color
- `--placeholder: #9CA3AF` - Placeholder text color

### Cards
- `--bg-card: #FFFFFF` - White card backgrounds
- `--bg-card-hover: #F9FAFB` - Card hover state
- `--border-card: #E5E7EB` - Card border color

### Accent/Brand Colors
- `--accent: #E5521A` - Brand orange (3.78:1 contrast on white)
- `--accent-hover: #FF7A42` - Accent hover state
- `--accent-subtle: rgba(229,82,26,0.08)` - Subtle accent background
- `--accent-border: rgba(229,82,26,0.25)` - Accent border

### Status Colors
- `--color-success: #16a34a` - Green for success states
- `--color-warning: #d97706` - Amber for warnings
- `--color-danger: #dc2626` - Red for errors/danger
- `--color-info: #2563eb` - Blue for informational states

## Dark Theme Variables

Defined in `html.dark` selector, these override light theme when dark mode is active:

### Page Backgrounds
- `--bg-page: #080e1c` - Deep navy page background
- `--bg-page-2: #0a1120` - Alternative dark page background

### Surface Backgrounds
- `--bg-surface: #0D1526` - Dark navy for cards and surfaces
- `--bg-surface-2: #111d35` - Lighter dark surface variant
- `--bg-surface-3: #14203A` - Medium dark surface variant

### Navigation
- `--bg-nav: #0D1526` - Dark navigation background
- `--bg-nav-border: #1E2F50` - Dark navigation border
- `--bg-nav-item: #14203A` - Navigation item hover background
- `--bg-nav-active: rgba(229,82,26,0.12)` - Active navigation item background

### Text Colors
- `--text-primary: #ffffff` - Pure white for maximum legibility (18.22:1 contrast)
- `--text-secondary: #e2e8f8` - Light secondary text (14.87:1 contrast)
- `--text-muted: #a0b0d0` - Muted light text (8.34:1 contrast)
- `--text-faint: #6a7fa8` - Faint text for less important content
- `--text-nav: #a0b0d0` - Navigation text color
- `--text-nav-active: #E5521A` - Active navigation text (accent color)

### Borders
- `--border-default: #1E2F50` - Subtle dark borders (1.37:1 contrast)
- `--border-strong: #2A3F68` - Stronger borders for emphasis (1.74:1 contrast)

### Inputs
- `--bg-input: #0F1A30` - Dark input backgrounds
- `--border-input: #1E2F50` - Input border color
- `--text-input: #E8EDF8` - Light input text
- `--placeholder: #4E6090` - Placeholder text color

### Cards
- `--bg-card: #14203A` - Dark card backgrounds
- `--bg-card-hover: #1a2a48` - Card hover state
- `--border-card: #1E2F50` - Card border color

### Accent/Brand Colors
- `--accent: #E5521A` - Brand orange (4.82:1 contrast on dark)
- `--accent-hover: #FF7A42` - Accent hover state
- `--accent-subtle: rgba(229,82,26,0.10)` - Subtle accent background
- `--accent-border: rgba(229,82,26,0.25)` - Accent border

### Status Colors
- `--color-success: #22D3A1` - Bright green for success states
- `--color-warning: #F5A623` - Bright amber for warnings
- `--color-danger: #F04A4A` - Bright red for errors/danger
- `--color-info: #5B9BF5` - Bright blue for informational states

## WCAG AA Compliance

All text colors meet WCAG 2.1 Level AA contrast requirements:

### Light Theme Contrast Ratios
- Primary text on page: **17.15:1** (exceeds 4.5:1 requirement)
- Primary text on surface: **18.92:1** (exceeds 4.5:1 requirement)
- Secondary text on page: **13.30:1** (exceeds 4.5:1 requirement)
- Secondary text on surface: **14.68:1** (exceeds 4.5:1 requirement)
- Muted text on page: **6.85:1** (exceeds 4.5:1 requirement)
- Muted text on surface: **7.56:1** (exceeds 4.5:1 requirement)
- Accent on white: **3.78:1** (exceeds 3:1 requirement for large text)

### Dark Theme Contrast Ratios
- Primary text on page: **19.27:1** (exceeds 4.5:1 requirement)
- Primary text on surface: **18.22:1** (exceeds 4.5:1 requirement)
- Secondary text on page: **15.72:1** (exceeds 4.5:1 requirement)
- Secondary text on surface: **14.87:1** (exceeds 4.5:1 requirement)
- Muted text on page: **8.82:1** (exceeds 4.5:1 requirement)
- Muted text on surface: **8.34:1** (exceeds 4.5:1 requirement)
- Accent on dark: **4.82:1** (exceeds 3:1 requirement for large text)

## Usage

### In CSS
```css
.my-component {
  background-color: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}
```

### In Tailwind (via utility classes)
```tsx
<div className="theme-bg-surface theme-text-primary theme-border">
  Content
</div>
```

### Theme Switching
The theme is controlled by adding/removing the `dark` class on the `<html>` element:

```typescript
// Enable dark theme
document.documentElement.classList.add('dark');

// Enable light theme
document.documentElement.classList.remove('dark');
```

## Smooth Transitions

All theme-aware components include smooth color transitions:

```css
.theme-transition {
  transition: background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease;
}
```

## Requirements Satisfied

This theme system satisfies the following requirements:
- **6.1-6.6**: Text visibility and contrast in both themes
- **7.1-7.8**: Background and surface colors
- **8.1-8.4**: Border and divider visibility
- **1.11-1.12**: Typography contrast ratios (WCAG AA)

## Testing

Contrast ratios are validated in `src/app/__tests__/theme-contrast.test.ts`. Run tests with:

```bash
npm test -- theme-contrast.test.ts
```
