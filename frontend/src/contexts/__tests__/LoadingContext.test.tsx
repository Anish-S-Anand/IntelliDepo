import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { LoadingProvider, useLoading } from "../LoadingContext";

/**
 * Unit Tests for LoadingContext
 * 
 * These tests cover specific scenarios and edge cases for the LoadingContext.
 * Validates: Requirements 1.1-1.6, 3.1-3.6, 8.1-8.6, 9.1-9.6
 */

describe("LoadingContext - Unit Tests", () => {
  // ==========================================================================
  // Provider Tests
  // ==========================================================================

  describe("LoadingProvider", () => {
    it("should render children correctly", () => {
      render(
        <LoadingProvider>
          <div data-testid="child">Test Child</div>
        </LoadingProvider>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByTestId("child")).toHaveTextContent("Test Child");
    });
  });

  // ==========================================================================
  // Hook Tests
  // ==========================================================================

  describe("useLoading hook", () => {
    it("should throw error when used outside provider", () => {
      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useLoading());
      }).toThrow(
        "useLoading must be used within LoadingProvider. " +
          "Ensure LoadingProvider wraps your component tree in app/layout.tsx"
      );

      consoleError.mockRestore();
    });

    it("should provide loading context values when used inside provider", () => {
      const { result } = renderHook(() => useLoading(), {
        wrapper: LoadingProvider,
      });

      expect(result.current.loading).toBe(false);
      expect(typeof result.current.startLoading).toBe("function");
      expect(typeof result.current.stopLoading).toBe("function");
      expect(typeof result.current.withLoading).toBe("function");
    });
  });

  // ==========================================================================
  // State Management Tests
  // ==========================================================================

  describe("startLoading and stopLoading", () => {
    it("should set loading to true when startLoading is called", () => {
      const { result } = renderHook(() => useLoading(), {
        wrapper: LoadingProvider,
      });

      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.startLoading();
      });

      expect(result.current.loading).toBe(true);
    });

    it("should set loading to false when stopLoading is called and counter reaches 0", () => {
      const { result } = renderHook(() => useLoading(), {
        wrapper: LoadingProvider,
      });

      act(() => {
        result.current.startLoading();
      });
      expect(result.current.loading).toBe(true);

      act(() => {
        result.current.stopLoading();
      });
      expect(result.current.loading).toBe(false);
    });

    it("should keep loading true when counter is still greater than 0", () => {
      const { result } = renderHook(() => useLoading(), {
        wrapper: LoadingProvider,
      });

      // Start twice
      act(() => {
        result.current.startLoading();
        result.current.startLoading();
      });
      expect(result.current.loading).toBe(true);

      // Stop once - should still be loading
      act(() => {
        result.current.stopLoading();
      });
      expect(result.current.loading).toBe(true);

      // Stop again - now should not be loading
      act(() => {
        result.current.stopLoading();
      });
      expect(result.current.loading).toBe(false);
    });

    it("should handle counter never going negative (extra stopLoading calls)", () => {
      const { result } = renderHook(() => useLoading(), {
        wrapper: LoadingProvider,
      });

      // Call stopLoading multiple times without any startLoading
      act(() => {
        result.current.stopLoading();
        result.current.stopLoading();
        result.current.stopLoading();
      });

      expect(result.current.loading).toBe(false);

      // Start once, should work correctly
      act(() => {
        result.current.startLoading();
      });
      expect(result.current.loading).toBe(true);
    });

    it("should handle single operation lifecycle (start → stop)", () => {
      const { result } = renderHook(() => useLoading(), {
        wrapper: LoadingProvider,
      });

      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.startLoading();
      });
      expect(result.current.loading).toBe(true);

      act(() => {
        result.current.stopLoading();
      });
      expect(result.current.loading).toBe(false);
    });

    it("should handle multiple concurrent operations", () => {
      const { result } = renderHook(() => useLoading(), {
        wrapper: LoadingProvider,
      });

      // Start multiple operations
      act(() => {
        result.current.startLoading(); // counter: 1
        result.current.startLoading(); // counter: 2
        result.current.startLoading(); // counter: 3
      });
      expect(result.current.loading).toBe(true);

      // Stop operations one by one
      act(() => {
        result.current.stopLoading(); // counter: 2
      });
      expect(result.current.loading).toBe(true);

      act(() => {
        result.current.stopLoading(); // counter: 1
      });
      expect(result.current.loading).toBe(true);

      act(() => {
        result.current.stopLoading(); // counter: 0
      });
      expect(result.current.loading).toBe(false);
    });
  });

  // ==========================================================================
  // withLoading Tests
  // ==========================================================================

  describe("withLoading", () => {
    it("should wrap async functions correctly", async () => {
      vi.useRealTimers(); // Use real timers for async tests

      const { result } = renderHook(() => useLoading(), {
        wrapper: LoadingProvider,
      });

      const asyncFn = vi.fn().mockResolvedValue("success");

      const wrappedResult = await act(async () => {
        return result.current.withLoading(asyncFn);
      });

      expect(asyncFn).toHaveBeenCalledTimes(1);
      expect(wrappedResult).toBe("success");
    });

    it("should show loading during async operation and hide after completion", async () => {
      vi.useRealTimers(); // Use real timers for async tests

      const { result } = renderHook(() => useLoading(), {
        wrapper: LoadingProvider,
      });

      let resolveAsyncFn: (value: string) => void;
      const asyncFn = vi.fn().mockImplementation(
        () => new Promise<string>((resolve) => {
          resolveAsyncFn = resolve;
        })
      );

      expect(result.current.loading).toBe(false);

      // Start the async operation
      const promise = result.current.withLoading(asyncFn);

      // Should be loading immediately
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      // Complete the async operation
      await act(async () => {
        resolveAsyncFn!("done");
        await promise;
      });

      // Should not be loading after completion
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it("should hide loading after error and propagate error", async () => {
      vi.useRealTimers(); // Use real timers for async tests

      const { result } = renderHook(() => useLoading(), {
        wrapper: LoadingProvider,
      });

      const errorMessage = "Test error";
      const asyncFn = vi.fn().mockRejectedValue(new Error(errorMessage));

      expect(result.current.loading).toBe(false);

      await expect(
        result.current.withLoading(asyncFn)
      ).rejects.toThrow(errorMessage);

      // Should not be loading after error
      expect(result.current.loading).toBe(false);
    });
  });

  // ==========================================================================
  // Timeout Recovery Tests
  // ==========================================================================

  describe("Timeout Recovery", () => {
    it("should trigger timeout recovery after 30 seconds", () => {
      vi.useFakeTimers();
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <LoadingProvider>{children}</LoadingProvider>
      );

      const { result } = renderHook(() => useLoading(), { wrapper });

      // Start loading
      act(() => {
        result.current.startLoading();
      });
      expect(result.current.loading).toBe(true);

      // Advance time by 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // Should have reset loading state
      expect(result.current.loading).toBe(false);

      // Should have logged warning
      expect(consoleWarn).toHaveBeenCalledWith(
        "[LoadingContext] Automatic timeout recovery triggered after 30 seconds"
      );

      consoleWarn.mockRestore();
      vi.useRealTimers();
    });

    it("should reset counter to 0 after timeout", () => {
      vi.useFakeTimers();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <LoadingProvider>{children}</LoadingProvider>
      );

      const { result } = renderHook(() => useLoading(), { wrapper });

      // Start multiple operations
      act(() => {
        result.current.startLoading();
        result.current.startLoading();
        result.current.startLoading();
      });
      expect(result.current.loading).toBe(true);

      // Advance time by 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // Should have reset to false
      expect(result.current.loading).toBe(false);

      // Verify counter was reset: new start should work correctly
      act(() => {
        result.current.startLoading();
      });
      expect(result.current.loading).toBe(true);

      act(() => {
        result.current.stopLoading();
      });
      expect(result.current.loading).toBe(false);

      vi.useRealTimers();
    });

    it("should clear timeout when operations complete normally", () => {
      vi.useFakeTimers();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <LoadingProvider>{children}</LoadingProvider>
      );

      const { result } = renderHook(() => useLoading(), { wrapper });

      act(() => {
        result.current.startLoading();
      });
      expect(result.current.loading).toBe(true);

      // Complete the operation normally
      act(() => {
        result.current.stopLoading();
      });
      expect(result.current.loading).toBe(false);

      // Advance time by 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // Should still be false (timeout was cleared)
      expect(result.current.loading).toBe(false);

      vi.useRealTimers();
    });

    it("should clear timeout on unmount", () => {
      vi.useFakeTimers();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <LoadingProvider>{children}</LoadingProvider>
      );

      const { result, unmount } = renderHook(() => useLoading(), { wrapper });

      act(() => {
        result.current.startLoading();
      });
      expect(result.current.loading).toBe(true);

      // Unmount the component
      unmount();

      // Advance time by 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // No error should occur (timeout was cleaned up)
      vi.useRealTimers();
    });

    it("should reset timeout when new operation starts", () => {
      vi.useFakeTimers();
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <LoadingProvider>{children}</LoadingProvider>
      );

      const { result } = renderHook(() => useLoading(), { wrapper });

      // Start first operation
      act(() => {
        result.current.startLoading();
      });

      // Advance time by 25 seconds (not enough for timeout)
      act(() => {
        vi.advanceTimersByTime(25000);
      });

      // Start another operation (should reset timeout)
      act(() => {
        result.current.startLoading();
      });

      // Advance time by another 25 seconds (total 50s from first start, but only 25s from second)
      act(() => {
        vi.advanceTimersByTime(25000);
      });

      // Should still be loading (timeout was reset)
      expect(result.current.loading).toBe(true);

      // Warning should not have been called yet
      expect(consoleWarn).not.toHaveBeenCalled();

      // Advance another 5 seconds to trigger timeout (30s from second start)
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Now timeout should have triggered
      expect(result.current.loading).toBe(false);
      expect(consoleWarn).toHaveBeenCalledWith(
        "[LoadingContext] Automatic timeout recovery triggered after 30 seconds"
      );

      consoleWarn.mockRestore();
      vi.useRealTimers();
    });
  });
});
