# Implementation Plan: Global Loading Indicator

## Overview

This plan implements a production-ready global loading indicator for the IntelliDepo frontend. The implementation follows a structured approach: core infrastructure first (LoadingContext with reference counting and timeout), then visual component (LoadingIndicator), root layout integration, and comprehensive testing (property-based and unit tests). The feature provides centralized loading state management using React Context API, integrated with the existing Next.js App Router, Zustand patterns, and Tailwind CSS theme system.

**Key Technologies**: TypeScript, React, Next.js, Vitest, fast-check, React Testing Library

## Tasks

- [ ] 1. Create LoadingContext with reference counting and timeout safety
  - [ ] 1.1 Create `src/contexts/LoadingContext.tsx` with LoadingContext, LoadingProvider, and useLoading hook
    - Define TypeScript interfaces: `LoadingState`, `LoadingContextValue`, `LoadingProviderProps`
    - Implement reference counting: counter increments on `startLoading()`, decrements on `stopLoading()`
    - Implement 30-second timeout safety mechanism with automatic recovery
    - Implement `withLoading` higher-order function for wrapping async operations
    - Add cleanup logic in useEffect to prevent memory leaks
    - Export LoadingContext, LoadingProvider, and useLoading hook
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 2. Create LoadingIndicator visual component
  - [ ] 2.1 Create `src/components/ui/LoadingIndicator.tsx` with theme-aware spinner
    - Implement fixed centered positioning with z-index 9999
    - Add semi-transparent backdrop using Tailwind classes (bg-black/50 dark, bg-white/30 light)
    - Create 48px × 48px spinner with CSS animations
    - Add ARIA attributes: role="status", aria-live="polite", aria-label="Loading"
    - Include sr-only text "Loading, please wait" for screen readers
    - Use theme-aware Tailwind classes for light/dark mode support
    - Ensure GPU-accelerated animations using transform property
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [ ] 3. Integrate LoadingProvider into root layout
  - [ ] 3.1 Update `src/app/layout.tsx` to include LoadingProvider
    - Import LoadingProvider from `@/contexts/LoadingContext`
    - Wrap LoadingProvider around {children} inside ThemeProvider
    - Verify LoadingProvider is mounted after ThemeProvider for proper theme integration
    - Ensure LoadingProvider wraps all page content for global accessibility
    - _Requirements: 1.4, 7.1, 7.2_

- [ ] 4. Write property-based test for reference counting invariant
  - [ ]* 4.1 Create `src/contexts/__tests__/LoadingContext.property.test.tsx` with fast-check tests
    - **Property 1: Reference Counting Invariant**
    - **Validates: Requirements 3.4, 3.5, 3.6**
    - Import fast-check library
    - Generate random sequences of 'start' and 'stop' operations (10-50 operations per sequence)
    - Test with minimum 100 iterations
    - Verify invariants: counter >= 0, loading === (counter > 0), stopLoading at 0 doesn't go negative
    - Test edge cases: single operation, multiple concurrent, unbalanced operations, interleaved patterns
    - _Requirements: 3.4, 3.5, 3.6_

- [ ] 5. Write unit tests for LoadingContext and LoadingIndicator
  - [ ]* 5.1 Create `src/contexts/__tests__/LoadingContext.test.tsx` with comprehensive unit tests
    - Test LoadingProvider renders children correctly
    - Test useLoading hook throws error when used outside provider
    - Test startLoading sets loading to true
    - Test stopLoading sets loading to false when counter reaches 0
    - Test counter never goes negative (extra stopLoading calls)
    - Test single operation lifecycle (start → stop)
    - Test multiple concurrent operations (start, start, stop, stop)
    - Test withLoading wraps async functions correctly
    - Test withLoading shows loading during operation and hides after completion
    - Test withLoading hides loading after error and propagates error
    - Test timeout recovery fires after 30 seconds
    - Test timeout resets loading state and counter to 0
    - Test timeout is cleared when operations complete normally
    - Test timeout is cleared on unmount
    - Test console.warn is called when timeout recovery occurs
    - Use Vitest fake timers for timeout tests
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [ ]* 5.2 Create `src/components/ui/__tests__/LoadingIndicator.test.tsx` with component tests
    - Test component renders when loading is true (mock LoadingContext)
    - Test component does not render when loading is false
    - Test component has correct ARIA attributes (role="status", aria-live="polite", aria-label="Loading")
    - Test component contains sr-only text "Loading, please wait"
    - Test component has fixed positioning and z-index classes
    - Test component has backdrop with opacity classes
    - Test component has spinner with animation class
    - Test backdrop is not focusable (no tabIndex)
    - Use React Testing Library for rendering and queries
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [ ] 6. Checkpoint - Verify core functionality
  - Ensure all tests pass, ask the user if questions arise.
  - Verify LoadingContext correctly manages state with reference counting
  - Verify LoadingIndicator renders correctly in both light and dark themes
  - Verify timeout recovery mechanism works as expected
  - _Requirements: All_

- [ ] 7. Optional: Integrate with service layer for automatic loading management
  - [ ]* 7.1 Update service layer functions to use withLoading wrapper
    - Identify async service functions in `src/services/` directory
    - Wrap service functions with withLoading for automatic loading state management
    - Test integration with existing API calls (e.g., depotCommand.ts functions)
    - Verify loading indicator shows during API calls
    - Verify loading indicator hides on success and error
    - This is optional enhancement - core functionality works without this
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 8. Final checkpoint - Production readiness verification
  - Ensure all tests pass with 100% coverage for critical paths
  - Manual test: Verify loading indicator appears on button clicks with async operations
  - Manual test: Verify loading indicator works across all routes
  - Manual test: Verify loading indicator theme integration in both light and dark modes
  - Manual test: Verify accessibility with screen reader (NVDA or JAWS)
  - Manual test: Test timeout recovery by simulating a stuck operation
  - Manual test: Test concurrent operations (multiple buttons clicked simultaneously)
  - Ask the user if questions arise or if any adjustments are needed
  - _Requirements: All_

## Notes

- **Testing Framework**: This project uses Vitest (not Jest), React Testing Library, and fast-check for property-based testing
- **fast-check**: Already installed in package.json, no additional installation needed
- **Optional Tasks**: Tasks marked with `*` are optional testing and enhancement tasks that can be skipped for faster MVP delivery
- **Reference Counting**: The core correctness property validates that the reference counting mechanism maintains correct state under all operation sequences
- **Timeout Safety**: 30-second automatic timeout prevents stuck loading states from forgotten stopLoading calls or hung operations
- **Theme Integration**: LoadingIndicator uses Tailwind's theme-aware classes to automatically adapt to light/dark mode changes
- **Performance**: Uses GPU-accelerated CSS animations (transform, opacity) rather than JavaScript animations for smooth 60fps rendering
- **Accessibility**: Full WCAG 2.1 AA compliance with ARIA live regions and screen reader support
- **Memory Safety**: Cleanup logic in useEffect prevents memory leaks from pending timeouts
- **Developer Experience**: Simple APIs (startLoading, stopLoading, withLoading) make integration straightforward
- **Production Ready**: Comprehensive error handling, timeout recovery, and edge case coverage ensure robust production deployment

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["4.1", "5.1", "5.2"] },
    { "id": 4, "tasks": ["7.1"] }
  ]
}
```
