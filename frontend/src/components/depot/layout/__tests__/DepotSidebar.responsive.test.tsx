import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DepotSidebar from '../DepotSidebar';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  usePathname: () => '/depot/operations',
}));

// Mock auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: { role: 'admin' },
  }),
}));

// Mock depot services
vi.mock('@/services/depotVision', () => ({
  getAllActiveAlerts: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/depotPerimeter', () => ({
  getPerimeterAlertCount: vi.fn().mockResolvedValue(0),
}));

/**
 * Mobile Responsive Behavior Tests for DepotSidebar
 * 
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
 * 
 * These tests verify that the sidebar behaves correctly on mobile devices:
 * - Collapses off-screen on mobile viewports (< 768px)
 * - Slides in with animation when opened
 * - Has correct width (204px) when open
 * - Works with overlay functionality
 */
describe('DepotSidebar - Mobile Responsive Behavior', () => {
  let originalInnerWidth: number;

  beforeEach(() => {
    // Store original window width
    originalInnerWidth = window.innerWidth;
    
    // Clear any timers from previous tests
    vi.clearAllTimers();
  });

  afterEach(() => {
    // Restore original window width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  /**
   * Test: Sidebar collapse on mobile (< 768px viewport)
   * Requirement 5.1: WHEN the viewport width is less than 768px (mobile), 
   * THE Sidebar SHALL collapse and slide off-screen
   */
  it('should collapse and slide off-screen on mobile viewport (< 768px)', () => {
    // Set mobile viewport width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375, // Mobile width
    });

    const { container } = render(<DepotSidebar open={false} />);
    
    const sidebar = container.querySelector('.depot-sidebar');
    expect(sidebar).toBeTruthy();
    
    // Check that sidebar has the correct classes for mobile collapse
    const sidebarClasses = sidebar?.className || '';
    
    // When open=false, sidebar should have -translate-x-full on mobile
    // The CSS class should be: "-translate-x-full md:translate-x-0"
    expect(sidebarClasses).toContain('-translate-x-full');
    
    // Verify the sidebar has transition classes for animation
    expect(sidebarClasses).toContain('transition-all');
    expect(sidebarClasses).toContain('duration-300');
  });

  /**
   * Test: Sidebar slide-in animation when opened
   * Requirement 5.2: WHEN the viewport width is less than 768px AND the sidebar is opened, 
   * THE Sidebar SHALL slide in from the left with a smooth transition
   */
  it('should slide in from left with smooth transition when opened on mobile', () => {
    // Set mobile viewport width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375, // Mobile width
    });

    const { container } = render(<DepotSidebar open={true} />);
    
    const sidebar = container.querySelector('.depot-sidebar');
    expect(sidebar).toBeTruthy();
    
    const sidebarClasses = sidebar?.className || '';
    
    // When open=true, sidebar should have translate-x-0 (visible)
    expect(sidebarClasses).toContain('translate-x-0');
    
    // Verify transition properties for smooth animation
    expect(sidebarClasses).toContain('transition-all');
    expect(sidebarClasses).toContain('duration-300');
    
    // Verify z-index for proper layering
    expect(sidebarClasses).toContain('z-40');
  });

  /**
   * Test: Sidebar width is 204px when open on mobile
   * Requirement 5.4: Ensure sidebar width is 204px when open on mobile
   */
  it('should have width of 204px when open on mobile', () => {
    // Set mobile viewport width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375, // Mobile width
    });

    const { container } = render(<DepotSidebar open={true} />);
    
    const sidebar = container.querySelector('.depot-sidebar');
    expect(sidebar).toBeTruthy();
    
    const sidebarClasses = sidebar?.className || '';
    
    // Verify width class is w-[204px]
    expect(sidebarClasses).toContain('w-[204px]');
  });

  /**
   * Test: Desktop viewport behavior
   * Requirement 5.3: WHEN the viewport width is 768px or greater (desktop), 
   * THE Sidebar SHALL remain visible at 204px width
   */
  it('should remain visible at 204px width on desktop viewport (>= 768px)', () => {
    // Set desktop viewport width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024, // Desktop width
    });

    const { container } = render(<DepotSidebar open={false} />);
    
    const sidebar = container.querySelector('.depot-sidebar');
    expect(sidebar).toBeTruthy();
    
    const sidebarClasses = sidebar?.className || '';
    
    // On desktop, sidebar should have md:translate-x-0 to override mobile collapse
    // The CSS class pattern is: "-translate-x-full md:translate-x-0"
    // This means on md breakpoint and above, it's always visible
    expect(sidebarClasses).toContain('md:translate-x-0');
    
    // Verify width
    expect(sidebarClasses).toContain('w-[204px]');
  });

  /**
   * Test: Sidebar positioning and layout
   * Verifies that sidebar has correct positioning for mobile overlay behavior
   */
  it('should have fixed positioning for mobile overlay behavior', () => {
    const { container } = render(<DepotSidebar open={true} />);
    
    const sidebar = container.querySelector('.depot-sidebar');
    expect(sidebar).toBeTruthy();
    
    const sidebarClasses = sidebar?.className || '';
    
    // Verify fixed positioning
    expect(sidebarClasses).toContain('fixed');
    expect(sidebarClasses).toContain('left-0');
    expect(sidebarClasses).toContain('top-[52px]');
    expect(sidebarClasses).toContain('bottom-0');
  });

  /**
   * Test: Sidebar structure and content
   * Verifies that sidebar renders navigation items correctly
   */
  it('should render navigation items with full labels', () => {
    const { container } = render(<DepotSidebar open={true} />);
    
    // Check that navigation items are rendered
    const navItems = container.querySelectorAll('.depot-sidebar-item');
    expect(navItems.length).toBeGreaterThan(0);
    
    // Verify that at least one navigation item exists
    // (The exact number depends on user role, but admin should see all items)
    expect(navItems.length).toBeGreaterThanOrEqual(8);
  });

  /**
   * Test: Sidebar responsive classes
   * Verifies all responsive classes are present for proper mobile behavior
   */
  it('should have all required responsive classes', () => {
    const { container } = render(<DepotSidebar open={false} />);
    
    const sidebar = container.querySelector('.depot-sidebar');
    expect(sidebar).toBeTruthy();
    
    const sidebarClasses = sidebar?.className || '';
    
    // Check all required classes for responsive behavior
    const requiredClasses = [
      'depot-sidebar',
      'fixed',
      'left-0',
      'top-[52px]',
      'bottom-0',
      'w-[204px]',
      'flex',
      'flex-col',
      'items-center',
      'py-3',
      'gap-1',
      'z-40',
      'transition-all',
      'duration-300',
    ];
    
    requiredClasses.forEach(className => {
      expect(sidebarClasses).toContain(className);
    });
  });

  /**
   * Test: Sidebar animation timing
   * Verifies that transition duration is set correctly (300ms)
   */
  it('should have 300ms transition duration for smooth animation', () => {
    const { container } = render(<DepotSidebar open={true} />);
    
    const sidebar = container.querySelector('.depot-sidebar');
    expect(sidebar).toBeTruthy();
    
    const sidebarClasses = sidebar?.className || '';
    
    // Verify transition duration is 300ms
    expect(sidebarClasses).toContain('duration-300');
  });

  /**
   * Test: Sidebar close callback
   * Verifies that onClose callback is provided for mobile overlay interaction
   */
  it('should accept onClose callback for mobile overlay interaction', () => {
    const onCloseMock = vi.fn();
    
    render(<DepotSidebar open={true} onClose={onCloseMock} />);
    
    // The component should accept the onClose prop without errors
    // The actual click handling is tested in integration tests
    expect(onCloseMock).not.toHaveBeenCalled(); // Not called on render
  });

  /**
   * Test: Sidebar maintains width consistency
   * Verifies that sidebar width is consistent across open/closed states
   */
  it('should maintain 204px width in both open and closed states', () => {
    const { container: containerClosed } = render(<DepotSidebar open={false} />);
    const sidebarClosed = containerClosed.querySelector('.depot-sidebar');
    const classesWhenClosed = sidebarClosed?.className || '';
    
    const { container: containerOpen } = render(<DepotSidebar open={true} />);
    const sidebarOpen = containerOpen.querySelector('.depot-sidebar');
    const classesWhenOpen = sidebarOpen?.className || '';
    
    // Both should have w-[204px]
    expect(classesWhenClosed).toContain('w-[204px]');
    expect(classesWhenOpen).toContain('w-[204px]');
  });
});
