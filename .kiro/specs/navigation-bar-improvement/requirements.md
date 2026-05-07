# Requirements Document

## Introduction

This document specifies the requirements for improving the IntelliDepot navigation bar (sidebar and topbar) to match the reference design from `fidelis-chart-updated.html`. The goal is to enhance the user interface to make navigation clearer and more user-friendly by expanding the sidebar width, showing full navigation labels, adding visual active state indicators, and improving overall layout and spacing.

## Glossary

- **Sidebar**: The vertical navigation component on the left side of the IntelliDepot application containing navigation items
- **Navigation_Item**: An individual clickable element in the sidebar that navigates to a specific page or section
- **Active_State**: The visual state of a navigation item when the user is currently on that page
- **Accent_Bar**: A colored vertical bar (4px wide, orange #E5521A) displayed on the left edge of an active navigation item
- **Badge**: A small circular indicator displaying a count (e.g., alert count) positioned on a navigation item
- **Topbar**: The horizontal navigation bar at the top of the application
- **Theme**: The color scheme of the application (light or dark mode)
- **Layout_Container**: The main content area that adjusts its margin based on sidebar width
- **Responsive_Behavior**: The ability of the UI to adapt to different screen sizes (mobile, tablet, desktop)

## Requirements

### Requirement 1: Expand Sidebar Width

**User Story:** As a user, I want the sidebar to be wider with full navigation labels visible, so that I can clearly understand what each navigation item represents without abbreviations.

#### Acceptance Criteria

1. THE Sidebar SHALL have a width of 204px (increased from current 64px/w-16)
2. WHEN the sidebar is displayed, THE Navigation_Item SHALL show full labels (e.g., "Command Center" instead of "CMD")
3. THE Sidebar SHALL maintain its fixed position on the left side of the screen
4. WHEN the sidebar width changes, THE Layout_Container SHALL adjust its left margin to 204px to accommodate the wider sidebar
5. THE Sidebar SHALL preserve all current navigation items and routing functionality

### Requirement 2: Update Navigation Item Structure

**User Story:** As a user, I want navigation items to have a horizontal layout with icons beside labels, so that I can quickly scan and identify navigation options.

#### Acceptance Criteria

1. THE Navigation_Item SHALL use a horizontal layout (inline-flex with row direction) instead of vertical stack
2. THE Navigation_Item SHALL display the icon beside the label with a 10px gap between them
3. THE Navigation_Item SHALL have a minimum height of 50px (increased from current 44px)
4. THE Navigation_Item SHALL use padding of 0 13px for horizontal spacing
5. THE Navigation_Item SHALL have a vertical gap of 3px between adjacent items
6. THE Navigation_Item label SHALL use font-size 13.5px and font-weight 700
7. THE Navigation_Item icon SHALL maintain size of 20px
8. THE Navigation_Item label SHALL have letter-spacing of 0.01em

### Requirement 3: Implement Active State Indicator

**User Story:** As a user, I want a clear visual indicator showing which page I'm currently on, so that I can maintain context while navigating the application.

#### Acceptance Criteria

1. WHEN a Navigation_Item is active, THE Accent_Bar SHALL be displayed on the left edge of the item
2. THE Accent_Bar SHALL have a width of 4px and height of 28px
3. THE Accent_Bar SHALL use color #E5521A (orange accent color)
4. THE Accent_Bar SHALL have border-radius of 0 3px 3px 0 (rounded on right side only)
5. THE Accent_Bar SHALL be positioned absolutely at the left edge, centered vertically
6. WHEN a Navigation_Item is active, THE Navigation_Item SHALL have background color rgba(229,82,26,0.12)
7. WHEN a Navigation_Item is active, THE Navigation_Item SHALL have border color rgba(229,82,26,0.22)
8. WHEN a Navigation_Item is active, THE Navigation_Item text SHALL use color #E5521A

### Requirement 4: Adjust Badge Positioning

**User Story:** As a user, I want alert badges to be clearly visible on navigation items, so that I can quickly identify items requiring attention.

#### Acceptance Criteria

1. WHEN a Navigation_Item has a badge count greater than 0, THE Badge SHALL be displayed
2. THE Badge SHALL be positioned at the top-right corner of the Navigation_Item
3. THE Badge SHALL remain visible and properly positioned with the wider navigation item layout
4. THE Badge SHALL display the count value or "9+" if count exceeds 9
5. THE Badge SHALL use background color #F04A4A (red) for alert visibility

### Requirement 5: Maintain Responsive Behavior

**User Story:** As a mobile user, I want the navigation to work seamlessly on my device, so that I can access all features regardless of screen size.

#### Acceptance Criteria

1. WHEN the viewport width is less than 768px (mobile), THE Sidebar SHALL collapse and slide off-screen
2. WHEN the viewport width is less than 768px AND the sidebar is opened, THE Sidebar SHALL slide in from the left with a smooth transition
3. WHEN the viewport width is 768px or greater (desktop), THE Sidebar SHALL remain visible at 204px width
4. THE Sidebar SHALL preserve current mobile hamburger menu functionality
5. WHEN the viewport width changes from mobile to desktop, THE Sidebar SHALL automatically adjust its visibility and width

### Requirement 6: Preserve Theme Support

**User Story:** As a user, I want the navigation improvements to work in both light and dark themes, so that my preferred theme experience is maintained.

#### Acceptance Criteria

1. WHEN the theme is light, THE Sidebar SHALL use light theme colors from CSS variables (--bg-nav, --text-nav, etc.)
2. WHEN the theme is dark, THE Sidebar SHALL use dark theme colors from CSS variables
3. WHEN the theme changes, THE Sidebar SHALL transition smoothly between color schemes
4. THE Accent_Bar SHALL maintain color #E5521A in both themes for consistency
5. THE Navigation_Item hover states SHALL adapt to the current theme

### Requirement 7: Maintain Navigation Functionality

**User Story:** As a user, I want all existing navigation features to continue working, so that I don't lose any functionality with the UI improvements.

#### Acceptance Criteria

1. THE Sidebar SHALL preserve role-based navigation filtering (warehouse manager, regional manager, admin views)
2. THE Sidebar SHALL maintain all current navigation routes and links
3. WHEN a Navigation_Item is clicked, THE application SHALL navigate to the correct route
4. THE Sidebar SHALL continue to fetch and display live alert counts for the Incidents navigation item
5. THE Sidebar SHALL preserve the current navigation item order and grouping

### Requirement 8: Implement Smooth Transitions

**User Story:** As a user, I want smooth visual transitions when interacting with navigation elements, so that the interface feels polished and responsive.

#### Acceptance Criteria

1. WHEN hovering over a Navigation_Item, THE Navigation_Item SHALL transition background and border colors smoothly over 0.18 seconds
2. WHEN the active state changes, THE Accent_Bar SHALL appear/disappear with a smooth transition
3. WHEN the sidebar opens/closes on mobile, THE Sidebar SHALL slide with a transition duration of 0.3 seconds
4. WHEN the theme changes, THE Sidebar colors SHALL transition over 0.25 seconds
5. THE Navigation_Item SHALL use CSS transition property for all animated properties

### Requirement 9: Ensure Accessibility

**User Story:** As a user with accessibility needs, I want the navigation to be clearly readable and usable, so that I can navigate the application effectively.

#### Acceptance Criteria

1. THE Navigation_Item labels SHALL use font-size 13.5px for better visibility (increased from abbreviated labels)
2. THE Navigation_Item SHALL maintain high contrast between text and background in both themes
3. THE Navigation_Item SHALL have sufficient padding and height (50px) for easy clicking/tapping
4. THE Accent_Bar SHALL provide clear visual indication of active state without relying solely on color
5. THE Navigation_Item SHALL preserve hover states for keyboard navigation support

### Requirement 10: Update Layout Container Margins

**User Story:** As a user, I want the main content area to properly adjust for the wider sidebar, so that content is not obscured or misaligned.

#### Acceptance Criteria

1. WHEN the viewport width is 768px or greater, THE Layout_Container SHALL have a left margin of 204px
2. WHEN the viewport width is less than 768px, THE Layout_Container SHALL have no left margin (sidebar is collapsed)
3. THE Layout_Container SHALL transition smoothly when margin changes
4. THE Layout_Container SHALL preserve all current padding and spacing for content
5. THE Layout_Container SHALL maintain proper alignment with the Topbar

