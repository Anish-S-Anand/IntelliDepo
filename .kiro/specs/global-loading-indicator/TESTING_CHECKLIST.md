# Testing Checklist - Global Loading Indicator

Use this checklist to verify the loading indicator is working correctly in your production environment.

## ✅ Visual Verification

- [ ] **Loading indicator is visible**
  - Large 80px blue spinner with glow
  - Pulsing outer ring animation
  - "Loading" text with bouncing dots
  - Dark backdrop (60% opacity) with blur

- [ ] **Loading indicator is centered**
  - Horizontally centered
  - Vertically centered
  - Above all other content (z-index 9999)

- [ ] **Backdrop is working**
  - Background is dimmed
  - Blur effect is visible
  - Content behind is still visible but dimmed

## ✅ Automatic API Loading

Test these scenarios:

- [ ] **Login page**
  1. Go to login page
  2. Enter credentials
  3. Click "Sign In"
  4. ✅ Loading indicator should appear
  5. ✅ Loading should hide when dashboard loads

- [ ] **Command Center / Dashboard**
  1. Navigate to Command Center
  2. ✅ Loading should appear during navigation
  3. ✅ Loading should appear while fetching data
  4. ✅ Loading should hide when data loads

- [ ] **Analytics Page**
  1. Navigate to Analytics
  2. ✅ Loading should appear during navigation
  3. ✅ Loading should appear while fetching analytics data
  4. ✅ Loading should hide when charts appear

- [ ] **Settings Page**
  1. Navigate to Settings
  2. ✅ Loading should appear during navigation
  3. Make a change and save
  4. ✅ Loading should appear during save
  5. ✅ Loading should hide after save completes

## ✅ Navigation Loading

Test these navigation scenarios:

- [ ] **Menu navigation**
  1. Click any menu item
  2. ✅ Loading should appear immediately
  3. ✅ Loading should hide when new page loads

- [ ] **Browser back/forward**
  1. Click back button
  2. ✅ Loading should appear
  3. ✅ Loading should hide when page loads

- [ ] **Direct URL entry**
  1. Type a URL in the address bar
  2. ✅ Loading should appear
  3. ✅ Loading should hide when page loads

## ✅ Concurrent Operations

Test multiple simultaneous requests:

- [ ] **Multiple quick clicks**
  1. Rapidly click different menu items
  2. ✅ Loading should stay visible
  3. ✅ Loading should only hide when ALL operations complete

- [ ] **Multiple API calls**
  1. Open a page that makes multiple API calls
  2. ✅ Loading should appear
  3. ✅ Loading should stay visible until all calls complete

## ✅ Error Handling

Test error scenarios:

- [ ] **API error**
  1. Trigger an API call that will fail (e.g., invalid endpoint)
  2. ✅ Loading should appear
  3. ✅ Loading should hide even when error occurs
  4. ✅ Error message should appear (not stuck loading)

- [ ] **Network offline**
  1. Disconnect network
  2. Try to navigate or fetch data
  3. ✅ Loading should appear
  4. ✅ Loading should timeout and hide after 15-30 seconds
  5. ✅ Console should show timeout warning

## ✅ Timeout Protection

- [ ] **30-second timeout**
  1. Simulate a stuck operation (if possible)
  2. ✅ Loading should automatically hide after 30 seconds
  3. ✅ Console should show warning: "[LoadingContext] Automatic timeout recovery triggered"

## ✅ Performance Verification

- [ ] **No jank or stuttering**
  1. Navigate between pages multiple times
  2. ✅ Animations should be smooth (60fps)
  3. ✅ No lag or stuttering

- [ ] **No memory leaks**
  1. Navigate between pages 20+ times
  2. ✅ Performance should remain consistent
  3. ✅ No browser slowdown

- [ ] **Quick operations**
  1. Test fast API calls (< 100ms)
  2. ✅ Loading should show briefly
  3. ✅ Should not flash annoyingly

## ✅ Accessibility

- [ ] **Screen reader**
  1. Enable screen reader (NVDA, JAWS, or VoiceOver)
  2. Trigger loading
  3. ✅ Should announce "Loading, please wait"

- [ ] **Keyboard navigation**
  1. Use Tab key to navigate
  2. Trigger loading
  3. ✅ Focus should not be trapped
  4. ✅ Can still navigate with keyboard

## ✅ Theme Integration

- [ ] **Dark mode**
  1. Switch to dark theme
  2. Trigger loading
  3. ✅ Loading indicator should be visible
  4. ✅ Spinner should be bright blue
  5. ✅ Backdrop should be dark

- [ ] **Light mode**
  1. Switch to light theme
  2. Trigger loading
  3. ✅ Loading indicator should be visible
  4. ✅ Spinner should be visible against light background

## ✅ Browser Compatibility

Test in different browsers:

- [ ] **Chrome**
  - ✅ Loading indicator works
  - ✅ Animations are smooth
  
- [ ] **Firefox**
  - ✅ Loading indicator works
  - ✅ Animations are smooth
  
- [ ] **Edge**
  - ✅ Loading indicator works
  - ✅ Animations are smooth

## 🐛 Common Issues & Solutions

### Loading not showing during API calls
**Solution**: Verify you're using `import api from '@/services/api'`

### Loading not showing during navigation
**Solution**: Verify NavigationEvents component is in layout.tsx

### Loading shows but is hard to see
**Solution**: Check z-index (should be 9999) and backdrop opacity

### Loading stays forever
**Solution**: Check console for errors. Should auto-hide after 30 seconds.

### Multiple loading indicators
**Solution**: Ensure only one LoadingProvider in app tree

## 📊 Expected Results

After all tests:
- ✅ Loading indicator is **highly visible**
- ✅ Shows **automatically** for all API calls
- ✅ Shows **automatically** during navigation
- ✅ **Smooth** animations with no lag
- ✅ **Zero performance** impact
- ✅ **Accessible** to screen readers
- ✅ **Works** in all browsers and themes

## 📝 Notes

Record any issues found:

1. Issue: ____________________________________
   Steps: ____________________________________
   Expected: _________________________________
   Actual: ___________________________________

2. Issue: ____________________________________
   Steps: ____________________________________
   Expected: _________________________________
   Actual: ___________________________________

---

**Testing Date**: ________________
**Tester Name**: ________________
**Environment**: ☐ Development ☐ Staging ☐ Production
**Status**: ☐ Passed ☐ Failed ☐ Partial
