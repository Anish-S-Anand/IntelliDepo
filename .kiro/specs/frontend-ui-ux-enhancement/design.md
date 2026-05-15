# Design Document: Frontend UI/UX Enhancement

## Overview

This design document specifies the technical implementation for enhancing the IntelliDepot frontend UI/UX to improve accessibility, readability, and usability. The enhancement establishes a universal typography system using Inter font, simplifies the application by removing legacy modules (IntelliStream, IntelliCafe, IntelliRecruit), replaces technical terminology with user-friendly language, modernizes navigation with an icon-based sidebar, and ensures production-grade quality across all screen sizes and themes.

### Scope

**In Scope:**
- Frontend directory only (`frontend/src/`)
- Typography system implementation (Inter font, sizing, weights, contrast)
- Module removal (IntelliStream, IntelliCafe, IntelliRecruit)
- Technical terminology replacement
- Navigation bar modernization (icon-based sidebar)
- Button and interactive element visibility enhancements
- Text visibility and contrast improvements
- Background and surface color refinements
- Border and divider visibility enhancements
- Icon-based visual communication
- Responsive design and mobile optimization
- Theme toggle and persistence
- Incidents page functionality and data accuracy
- Parser and serializer for configuration formats

**Out of Scope:**
- Backend API changes (except where required for incidents page)
- Database schema modifications (except removal of legacy module tables)
- Infrastructure changes
- Third-party service integrations
- Performance optimization beyond frontend bundle size

### Goals

1. **Accessibility**: Achieve WCAG 2.1 Level AA compliance for contrast ratios and keyboard navigation
2. **Readability**: Establish universal typography standards with Inter font and increased text sizes
3. **Simplicity**: Remove legacy modules and technical jargon to focus on IntelliDepot functionality
4. **Modernization**: Implement icon-based navigation matching reference design
5. **Production Stability**: Maintain backward compatibility and zero-downtime deployment
6. **Performance**: Achieve FCP < 1.5s and TTI < 3s on 3G networks

### Non-Goals

1. Complete redesign of existing page layouts (only incremental improvements)
2. Migration to a different UI framework (staying with Next.js/React/Tailwind)
3. Rewriting backend services
4. Changing authentication/authorization mechanisms

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js App Router                       │
│                    (frontend/src/app/)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
┌────────▼────────┐            ┌────────▼────────┐
│  Layout Layer   │            │   Page Layer    │
│  - ThemeProvider│            │  - Operations   │
│  - DepotTopBar  │            │  - Inventory    │
│  - DepotSidebar │            │  - Cameras      │
│  - globals.css  │            │  - Incidents    │
└────────┬────────┘            │  - Gate         │
         │                     │  - etc.         │
         │                     └────────┬────────┘
         │                              │
         └──────────┬───────────────────┘
                    │
         ┌──────────▼──────────┐
         │  Component Library  │
         │  - UI Components    │
         │  - Depot Components │
         │  - Skeletons        │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │   Services Layer    │
         │  - depotVision      │
         │  - depotPerimeter   │
         │  - API clients      │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │   Backend APIs      │
         │  - /backend/depot/* │
         └─────────────────────┘
```

### Component Hierarchy

```
App Layout (RootLayout)
├── ThemeProvider (context)
├── DepotTopBar (fixed header)
│   ├── Logo
│   ├── ThemeToggle
│   ├── Notification Bell
│   └── Profile Dropdown
├── DepotSidebar (fixed sidebar)
│   └── Navigation Items (CMD, OPS, INV, CAM, CNT, MAP, GTE, INC)
└── Page Content (dynamic)
    ├── Operations Dashboard
    ├── Incidents Page
    ├── Inventory Page
    ├── Camera Grid
    ├── Gate Console
    └── etc.
```

### Technology Stack

- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS + CSS Variables
- **Icons**: Lucide React
- **Fonts**: Google Fonts (Inter)
- **State Management**: Zustand (auth), React Context (theme)
- **Type Safety**: TypeScript
- **Testing**: Jest + React Testing Library (unit), Playwright (e2e)

## Components and Interfaces

### 1. Typography System

**Component**: Global CSS Variables + Tailwind Configuration

**Location**: `frontend/src/app/globals.css`

**Implementation**:

```css
/* Base Typography */
:root {
  --font-family: 'Inter', 'Arial', 'Helvetica Neue', 'Helvetica', sans-serif;
  --font-size-base: 16px;
  --line-height-base: 1.6;
  --line-height-heading: 1.2;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  font-weight: 500;
  line-height: var(--line-height-base);
  -webkit-font-smoothing: antialiased;
}

/* Heading Sizes */
h1 { font-size: 26px; font-weight: 800; line-height: 1.2; letter-spacing: -0.4px; }
h2 { font-size: 22px; font-weight: 800; line-height: 1.2; letter-spacing: -0.3px; }
h3 { font-size: 18px; font-weight: 800; line-height: 1.2; letter-spacing: -0.2px; }
h4 { font-size: 16px; font-weight: 800; line-height: 1.2; letter-spacing: -0.1px; }
h5 { font-size: 14px; font-weight: 800; line-height: 1.2; }
h6 { font-size: 13px; font-weight: 800; line-height: 1.2; }

/* Component-Specific Sizes */
button { font-size: 16px; font-weight: 700; }
label { font-size: 15px; font-weight: 600; }
input, select, textarea { font-size: 16px; font-weight: 500; }
td, th { font-size: 15px; }
```

**Contrast Requirements**:
- Primary text: 4.5:1 minimum (WCAG AA)
- Large text (18px+): 3:1 minimum (WCAG AA)
- Light theme: `#0D1117` (dark charcoal) on `#F0F4FA` (warm off-white)
- Dark theme: `#FFFFFF` (white) on `#080E1C` (deep navy)

### 2. Theme System

**Component**: `ThemeProvider` + `ThemeToggle`

**Location**: 
- `frontend/src/components/layout/ThemeProvider.tsx`
- `frontend/src/components/layout/ThemeToggle.tsx`
- `frontend/src/app/globals.css`

**Interface**:

```typescript
type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

interface ThemeConfig {
  colors: {
    light: ColorPalette;
    dark: ColorPalette;
  };
}

interface ColorPalette {
  bgPage: string;
  bgSurface: string;
  bgCard: string;
  bgNav: string;
  bgInput: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderDefault: string;
  borderStrong: string;
  accent: string;
  accentHover: string;
}
```

**CSS Variables**:

```css
/* Light Theme */
:root {
  --bg-page: #F0F4FA;
  --bg-surface: #FFFFFF;
  --bg-card: #FFFFFF;
  --bg-nav: #FFFFFF;
  --bg-input: #FFFFFF;
  --text-primary: #0D1117;
  --text-secondary: #1F2937;
  --text-muted: #4B5563;
  --border-default: #E5E7EB;
  --border-strong: #D1D5DB;
  --accent: #E5521A;
  --accent-hover: #FF7A42;
}

/* Dark Theme */
html.dark {
  --bg-page: #080E1C;
  --bg-surface: #0D1526;
  --bg-card: #14203A;
  --bg-nav: #0D1526;
  --bg-input: #0F1A30;
  --text-primary: #FFFFFF;
  --text-secondary: #E2E8F8;
  --text-muted: #A0B0D0;
  --border-default: #1E2F50;
  --border-strong: #2A3F68;
  --accent: #E5521A;
  --accent-hover: #FF7A42;
}
```

**Persistence**:
- Storage: `localStorage.setItem("intelli-theme", theme)`
- Retrieval: `localStorage.getItem("intelli-theme")`
- FOUC Prevention: Inline script in `layout.tsx` applies theme before React hydration

### 3. Navigation System

**Component**: `DepotSidebar`

**Location**: `frontend/src/components/depot/layout/DepotSidebar.tsx`

**Interface**:

```typescript
interface NavItem {
  label: string;        // 3-letter code (CMD, OPS, INV, etc.)
  fullLabel: string;    // Full name for tooltips
  href: string;         // Route path
  icon: LucideIcon;     // Icon component
}

interface DepotSidebarProps {
  open: boolean;        // Mobile drawer state
  onClose?: () => void; // Mobile drawer close handler
}
```

**Navigation Items**:

```typescript
const NAV_ITEMS: NavItem[] = [
  { label: "CMD", fullLabel: "Command Center", href: "/depot/command", icon: Radio },
  { label: "OPS", fullLabel: "Operations Hub", href: "/depot/operations", icon: LayoutDashboard },
  { label: "INV", fullLabel: "Inventory", href: "/depot/inventory", icon: Package },
  { label: "CAM", fullLabel: "Live Cameras", href: "/depot/vision", icon: Eye },
  { label: "CNT", fullLabel: "Counting", href: "/depot/counting", icon: Hash },
  { label: "MAP", fullLabel: "Heatmap", href: "/depot/heatmap", icon: Map },
  { label: "GTE", fullLabel: "Gate Entry", href: "/depot/gate", icon: Shield },
  { label: "INC", fullLabel: "Incidents", href: "/depot/incidents", icon: AlertTriangle },
];
```

**Styling**:
- Width: 64px (4rem) on desktop
- Icon size: 16px (w-4 h-4)
- Label size: 7px, bold, uppercase
- Active state: Orange accent (#E5521A), subtle background, 1px left border
- Hover state: Subtle background color change
- Mobile: Drawer with 280px width, slide-in animation

### 4. Button System

**Component**: Global CSS overrides + Tailwind utilities

**Specifications**:

```css
/* Light Theme Buttons */
html:not(.dark) button {
  border-width: 2px !important;
  font-weight: 700 !important;
}

/* Default buttons */
html:not(.dark) button:not([colored]) {
  border-color: #9CA3AF !important;
  color: #0D1117 !important;
  background-color: #FFFFFF !important;
}

/* Hover states */
html:not(.dark) button:not([colored]):hover {
  border-color: #6B7280 !important;
  background-color: #F9FAFB !important;
}

/* Dark Theme Buttons */
html.dark button {
  border-width: 1.5px !important;
  font-weight: 700 !important;
}

html.dark button:not([colored]) {
  border-color: #2A3F68 !important;
  color: #E8EDF8 !important;
}
```

**Button Variants**:
- **Default**: White bg (light) / transparent (dark), strong border
- **Primary**: Orange accent (#E5521A), white text
- **Danger**: Red (#DC2626), white text
- **Success**: Green (#16A34A), white text
- **Disabled**: 50% opacity, cursor: not-allowed

### 5. Incidents Page

**Component**: `IncidentsPage`

**Location**: `frontend/src/components/depot/operations/IncidentsPage.tsx`

**Interface**:

```typescript
interface Incident {
  id: string;
  type: string;
  sev: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  loc: string;
  t: string;
  status: "open" | "acknowledged" | "resolved";
  cam: string;
  desc: string;
  assignee: string;
}

interface IncidentResponse {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "acknowledged" | "escalated" | "resolved";
  created_at: string;
  acknowledged_by: string | null;
  escalated_to: string | null;
  video_archive_ref: string | null;
}

interface BreachResponse {
  id: string;
  zone_id: string;
  camera_id: string;
  breach_type: string;
  severity: string;
  confidence: number;
  snapshot_ref: string | null;
  alert_sent: boolean;
  notes: string | null;
  detected_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
}
```

**API Integration**:

```typescript
// Service: frontend/src/services/depotPerimeter.ts
async function getIncidents(): Promise<IncidentResponse[]>
async function getActiveBreaches(): Promise<BreachResponse[]>
async function acknowledgeIncident(id: string, notes: string): Promise<void>
async function resolveIncident(id: string, notes: string): Promise<void>
```

**State Management**:
- Fetch incidents and breaches on mount
- Refresh every 20 seconds
- Optimistic UI updates for acknowledge/resolve actions
- Loading states for async operations
- Error handling with user-friendly messages

**Summary Cards**:
- Open incidents count
- Acknowledged incidents count
- Resolved incidents count
- Critical incidents count

**Filters**:
- All, Open, Acknowledged, Resolved
- Critical, High (severity filters)

**Actions**:
- "Take Action" button (open → acknowledged)
- "Resolve" button (open/acknowledged → resolved)
- "View Evidence" button (opens video modal)

### 6. Responsive Design

**Breakpoints**:

```typescript
const BREAKPOINTS = {
  mobile: "max-width: 640px",
  tablet: "640px - 1024px",
  desktop: "min-width: 1024px",
};
```

**Mobile Adaptations**:
- Sidebar: Fixed drawer, slide-in from left
- TopBar: Hamburger menu button visible
- Padding: Reduced from px-6 to px-3
- Font sizes: Base 14px instead of 16px
- Touch targets: Minimum 44px × 44px
- Grid layouts: Stack vertically

**CSS Media Queries**:

```css
@media (max-width: 640px) {
  .depot-sidebar {
    position: fixed;
    z-index: 40;
    width: 280px;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  
  .depot-sidebar.open {
    transform: translateX(0);
  }
}
```

## Data Models

### ThemeConfig

```typescript
interface ThemeConfig {
  version: string;
  colors: {
    light: ColorPalette;
    dark: ColorPalette;
  };
}

interface ColorPalette {
  bgPage: string;
  bgSurface: string;
  bgSurface2: string;
  bgSurface3: string;
  bgCard: string;
  bgNav: string;
  bgNavBorder: string;
  bgNavItem: string;
  bgNavActive: string;
  bgInput: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  textNav: string;
  textNavActive: string;
  borderDefault: string;
  borderStrong: string;
  borderCard: string;
  borderInput: string;
  accent: string;
  accentHover: string;
  accentSubtle: string;
  accentBorder: string;
  colorSuccess: string;
  colorWarning: string;
  colorDanger: string;
  colorInfo: string;
}
```

### UserPreferences

```typescript
interface UserPreferences {
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  notificationsEnabled: boolean;
  language: string;
}
```

### Incident

```typescript
interface Incident {
  id: string;
  type: string;
  sev: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  loc: string;
  t: string;
  status: "open" | "acknowledged" | "resolved";
  cam: string;
  desc: string;
  assignee: string;
}
```

### BreachResponse

```typescript
interface BreachResponse {
  id: string;
  zone_id: string;
  camera_id: string;
  breach_type: "unauthorized_entry" | "loitering" | "forced_entry" | "after_hours" | "object_left" | "unknown";
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
  snapshot_ref: string | null;
  alert_sent: boolean;
  notes: string | null;
  detected_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
}
```

