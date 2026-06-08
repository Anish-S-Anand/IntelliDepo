import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { LoadingIndicator } from "../LoadingIndicator";
import { LoadingProvider } from "@/contexts/LoadingContext";
import * as LoadingContext from "@/contexts/LoadingContext";

/**
 * Unit Tests for LoadingIndicator Component
 * 
 * These tests verify the visual loading indicator component.
 * Validates: Requirements 2.1-2.7, 10.1-10.6
 */

describe("LoadingIndicator - Component Tests", () => {
  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("Rendering", () => {
    it("should render when loading is true", () => {
      // Mock useLoading to return loading=true
      vi.spyOn(LoadingContext, "useLoading").mockReturnValue({
        loading: true,
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
        withLoading: vi.fn(),
      });

      render(<LoadingIndicator />);

      // Check that the loading indicator is in the document
      const loadingIndicator = screen.getByRole("status");
      expect(loadingIndicator).toBeInTheDocument();
    });

    it("should not render when loading is false", () => {
      // Mock useLoading to return loading=false
      vi.spyOn(LoadingContext, "useLoading").mockReturnValue({
        loading: false,
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
        withLoading: vi.fn(),
      });

      render(<LoadingIndicator />);

      // Check that the loading indicator is NOT in the document
      const loadingIndicator = screen.queryByRole("status");
      expect(loadingIndicator).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe("Accessibility", () => {
    it("should have correct ARIA attributes", () => {
      vi.spyOn(LoadingContext, "useLoading").mockReturnValue({
        loading: true,
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
        withLoading: vi.fn(),
      });

      render(<LoadingIndicator />);

      const loadingIndicator = screen.getByRole("status");
      
      expect(loadingIndicator).toHaveAttribute("role", "status");
      expect(loadingIndicator).toHaveAttribute("aria-live", "polite");
      expect(loadingIndicator).toHaveAttribute("aria-label", "Loading");
    });

    it("should contain sr-only text for screen readers", () => {
      vi.spyOn(LoadingContext, "useLoading").mockReturnValue({
        loading: true,
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
        withLoading: vi.fn(),
      });

      render(<LoadingIndicator />);

      const srText = screen.getByText("Loading, please wait");
      expect(srText).toBeInTheDocument();
      expect(srText).toHaveClass("sr-only");
    });

    it("should have backdrop that is not focusable", () => {
      vi.spyOn(LoadingContext, "useLoading").mockReturnValue({
        loading: true,
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
        withLoading: vi.fn(),
      });

      render(<LoadingIndicator />);

      const backdrop = screen.getByRole("status");
      
      // Backdrop should not have tabIndex attribute (not focusable)
      expect(backdrop).not.toHaveAttribute("tabIndex");
    });
  });

  // ==========================================================================
  // Styling Tests
  // ==========================================================================

  describe("Styling", () => {
    it("should have fixed positioning and high z-index", () => {
      vi.spyOn(LoadingContext, "useLoading").mockReturnValue({
        loading: true,
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
        withLoading: vi.fn(),
      });

      render(<LoadingIndicator />);

      const backdrop = screen.getByRole("status");
      
      // Check for fixed positioning and z-index classes
      expect(backdrop).toHaveClass("fixed");
      expect(backdrop).toHaveClass("inset-0");
      expect(backdrop).toHaveClass("z-[9999]");
    });

    it("should have flex center layout", () => {
      vi.spyOn(LoadingContext, "useLoading").mockReturnValue({
        loading: true,
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
        withLoading: vi.fn(),
      });

      render(<LoadingIndicator />);

      const backdrop = screen.getByRole("status");
      
      // Check for flexbox centering classes
      expect(backdrop).toHaveClass("flex");
      expect(backdrop).toHaveClass("items-center");
      expect(backdrop).toHaveClass("justify-center");
    });

    it("should have backdrop with opacity classes", () => {
      vi.spyOn(LoadingContext, "useLoading").mockReturnValue({
        loading: true,
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
        withLoading: vi.fn(),
      });

      render(<LoadingIndicator />);

      const backdrop = screen.getByRole("status");
      
      // Check for backdrop opacity classes
      expect(backdrop.className).toMatch(/bg-(black|white)\//);
    });

    it("should have spinner with animation class", () => {
      vi.spyOn(LoadingContext, "useLoading").mockReturnValue({
        loading: true,
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
        withLoading: vi.fn(),
      });

      const { container } = render(<LoadingIndicator />);

      // Find the spinner element (the div with animate-spin)
      const spinner = container.querySelector(".animate-spin");
      
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass("animate-spin");
      expect(spinner).toHaveClass("rounded-full");
      expect(spinner).toHaveClass("border-4");
    });

    it("should have spinner with correct size (48px × 48px)", () => {
      vi.spyOn(LoadingContext, "useLoading").mockReturnValue({
        loading: true,
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
        withLoading: vi.fn(),
      });

      const { container } = render(<LoadingIndicator />);

      const spinner = container.querySelector(".animate-spin");
      
      expect(spinner).toHaveClass("h-12");
      expect(spinner).toHaveClass("w-12");
    });

    it("should have aria-hidden on spinner", () => {
      vi.spyOn(LoadingContext, "useLoading").mockReturnValue({
        loading: true,
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
        withLoading: vi.fn(),
      });

      const { container } = render(<LoadingIndicator />);

      const spinner = container.querySelector(".animate-spin");
      
      expect(spinner).toHaveAttribute("aria-hidden", "true");
    });
  });

  // ==========================================================================
  // Integration with LoadingContext
  // ==========================================================================

  describe("Integration with LoadingContext", () => {
    it("should use loading state from context", () => {
      // Mock loading=false - indicator should not be visible
      vi.spyOn(LoadingContext, "useLoading").mockReturnValue({
        loading: false,
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
        withLoading: vi.fn(),
      });

      const { rerender } = render(<LoadingIndicator />);

      // Initially, loading is false - no indicator visible
      expect(screen.queryByRole("status")).not.toBeInTheDocument();

      // Mock loading=true - indicator should be visible
      vi.spyOn(LoadingContext, "useLoading").mockReturnValue({
        loading: true,
        startLoading: vi.fn(),
        stopLoading: vi.fn(),
        withLoading: vi.fn(),
      });

      rerender(<LoadingIndicator />);

      // Now indicator should be visible
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });
});
