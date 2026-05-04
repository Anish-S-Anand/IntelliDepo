# INTELLI Platform - Testing Guide

## Environment Setup

### Prerequisites
- Node.js 18+
- pnpm package manager
- Running on localhost:3000

### Starting Development Server
```bash
cd /vercel/share/v0-project
pnpm install  # if not done already
pnpm dev      # starts dev server on localhost:3000
```

## Testing Workflow

### Step 1: Login
1. Navigate to `http://localhost:3000`
2. You'll see the landing page with Fidelis branding
3. Click "Login" or navigate to `/login`
4. Use test credentials:
   - Email: `test@example.com`
   - Password: `password`
5. Should redirect to `/platform`

### Step 2: Platform Hub
1. After login, you should see the INTELLI Platform hub
2. Verify the following elements are visible:
   - Header: "Welcome to INTELLI"
   - 4 App Cards:
     - **Stream** (Blue) - Real-time financial intelligence
     - **Depot** (Orange) - Warehouse operations ✓ TARGET
     - **Cafe** (Green) - Employee engagement
     - **Recruit** (Purple) - Talent acquisition
   - Footer: Platform branding

### Step 3: Click Depot Card (Main Fix Test)
1. Click the **Depot** card (Orange)
2. Should navigate to `/platform/depot`
3. **VERIFY THIS RENDERS PROPERLY** - You should see:
   - ✓ Dark/Light themed dashboard (default: dark)
   - ✓ Left sidebar with 11 navigation icons
   - ✓ Top navigation bar with Fidelis logo
   - ✓ Main content area showing Dashboard page
   - ✓ KPI cards displaying metrics

### Step 4: Test IntelliDepot Dashboard Elements

#### Sidebar Navigation
- Click each item and verify:
  - [ ] DASH - Dashboard view
  - [ ] VISION - Vision section (coming soon)
  - [ ] VIDEO - Video section
  - [ ] COMMAND - Command center
  - [ ] ANALYTICS - Analytics view
  - [ ] ZONES - Zone management
  - [ ] SEQ - Sequencing
  - [ ] PERI - Perimeter
  - [ ] ALERTS - Alerts section
  - [ ] RISK - Risk analysis
  - [ ] REPORT - Reporting

#### Top Bar Elements
- [ ] Logo displays correctly (Fidelis logo + IntelliDepot text)
- [ ] "LIVE" badge shows with green indicator
- [ ] Theme toggle button works (switches dark/light)
- [ ] Logout button present and clickable
- [ ] All elements properly aligned

#### Dashboard Content
- [ ] Page title appears: "Dashboard"
- [ ] Subtitle: "Real-time operations monitoring and analytics"
- [ ] 4 KPI cards visible:
  - Active Cameras: 48
  - Alerts Today: 12
  - System Health: 98%
  - Avg Response: 2.4s
- [ ] Recent Activity card shows

### Step 5: Theme Toggle Testing
1. Click theme toggle button (moon/sun icon)
2. Page should transition from dark to light theme
3. Verify:
   - [ ] Background changes to light gray (#F0F4FA)
   - [ ] Text changes to dark color (#0F1C33)
   - [ ] Sidebar background becomes white
   - [ ] Cards have proper light theme styling
   - [ ] All text remains readable
4. Toggle back to dark theme and verify reversal

### Step 6: Mobile Responsiveness Testing

#### Desktop View (> 768px)
- [ ] Sidebar always visible
- [ ] Full navigation items with labels
- [ ] All content properly spaced
- [ ] No hamburger menu visible

#### Tablet View (768px - 1024px)
- [ ] Responsive grid adjusts
- [ ] Sidebar visible but may be narrower
- [ ] Content reflows properly

#### Mobile View (< 768px)
- [ ] Sidebar hidden by default
- [ ] Hamburger menu visible in top-right
- [ ] Click hamburger shows mobile menu
- [ ] Menu items display vertically
- [ ] Content takes full width
- [ ] Touch interactions work properly

### Step 7: Navigation Testing
1. Click different nav items multiple times
2. Verify:
   - [ ] Active item highlighting works
   - [ ] Left accent bar appears on active item
   - [ ] Page content updates
   - [ ] No errors in console

### Step 8: Logout Testing
1. Click logout button (top right)
2. Should redirect to `/login`
3. Previous session should be cleared
4. Attempting to access `/platform` should redirect to login

### Step 9: Session Persistence
1. Log in again
2. Navigate to `/platform/depot`
3. Refresh page (Ctrl+R)
4. Page should remain on Depot (session persists)
5. Navigate to different nav items
6. Refresh page - should stay on current item

## Error Scenarios

### Blank Screen Issues
If you see a blank screen:
1. Check browser console (F12) for errors
2. Check Network tab for failed requests
3. Verify `IntelliDepot.tsx` is loading
4. Clear cache and reload

### Styling Not Applied
If styling looks wrong:
1. Verify CSS-in-JS is working (should see style tags)
2. Check for conflicting Tailwind classes
3. Clear browser cache
4. Check browser DevTools for style overrides

### Navigation Not Working
If navigation items don't work:
1. Check console for JavaScript errors
2. Verify `onClick` handlers are firing
3. Check `activePage` state is updating
4. Look for router issues

## Browser DevTools Inspection

### Check Component is Rendering
```javascript
// In console, run:
document.querySelector('.intelli-depot')
// Should return the element
```

### Check CSS Variables
```javascript
// In console:
getComputedStyle(document.documentElement).getPropertyValue('--acc')
// Should return: #E5521A
```

### Check Theme State
Look for `--text` variable color and `--bg` variable background - these should swap with theme toggle.

## Performance Testing

1. **Load Time**: Dashboard should load in < 2 seconds
2. **Theme Toggle**: Instant transition (< 300ms)
3. **Navigation**: Immediate response to clicks
4. **Memory**: No console warnings about memory leaks

## Regression Testing

After any changes, verify:
- [ ] Login still works
- [ ] Platform hub displays all 4 cards
- [ ] Depot click navigates and renders
- [ ] All nav items accessible
- [ ] Theme toggle works
- [ ] Logout redirects properly
- [ ] TypeScript builds without errors
- [ ] No console errors in DevTools

## Automated Testing (Future)

```bash
# Run type checking
pnpm tsc --noEmit

# Run Next.js build
pnpm build

# Run linting (if configured)
pnpm lint
```

## Success Criteria

✓ All the above tests pass
✓ No TypeScript errors
✓ No console errors
✓ No blank screens
✓ Responsive on all screen sizes
✓ Theme switching works
✓ Navigation fully functional
✓ Professional Fidelis branding present

## Support

If issues arise:
1. Check `/FIX_SUMMARY.md` for what was changed
2. Review `/IMPLEMENTATION_SUMMARY.md` for architecture
3. Check `/vercel/share/v0-project/FIX_SUMMARY.md` for detailed fixes
4. Inspect browser console and Network tab
