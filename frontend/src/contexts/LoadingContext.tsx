"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { registerLoadingCallbacks } from "@/services/api";

// ============================================================================
// Types
// ============================================================================

interface LoadingState {
  loading: boolean;
  counter: number;
  timeoutId: NodeJS.Timeout | null;
}

interface LoadingContextValue {
  loading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
  withLoading: <T>(fn: () => Promise<T>) => Promise<T>;
}

interface LoadingProviderProps {
  children: React.ReactNode;
}

// ============================================================================
// Context
// ============================================================================

const LoadingContext = createContext<LoadingContextValue | undefined>(
  undefined
);

// ============================================================================
// Provider Component
// ============================================================================

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [state, setState] = useState<LoadingState>({
    loading: false,
    counter: 0,
    timeoutId: null,
  });

  // Start loading: increment counter and set loading to true
  const startLoading = useCallback(() => {
    setState((prev) => {
      const newCounter = prev.counter + 1;
      const newLoading = newCounter > 0;

      // Clear existing timeout and start new one
      if (prev.timeoutId) {
        clearTimeout(prev.timeoutId);
      }

      // Set 30-second timeout for automatic recovery
      const timeoutId = setTimeout(() => {
        console.warn(
          "[LoadingContext] Automatic timeout recovery triggered after 30 seconds"
        );
        setState({ loading: false, counter: 0, timeoutId: null });
      }, 30000);

      return { loading: newLoading, counter: newCounter, timeoutId };
    });
  }, []);

  // Stop loading: decrement counter and clear timeout when counter reaches 0
  const stopLoading = useCallback(() => {
    setState((prev) => {
      const newCounter = Math.max(0, prev.counter - 1);
      const newLoading = newCounter > 0;

      // Clear timeout when counter reaches 0
      if (newCounter === 0 && prev.timeoutId) {
        clearTimeout(prev.timeoutId);
        return { loading: false, counter: 0, timeoutId: null };
      }

      return { ...prev, loading: newLoading, counter: newCounter };
    });
  }, []);

  // Higher-order function: wrap async operation with automatic loading management
  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      startLoading();
      try {
        return await fn();
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading]
  );

  // Register callbacks with API service on mount
  useEffect(() => {
    registerLoadingCallbacks(startLoading, stopLoading);
  }, [startLoading, stopLoading]);

  // Cleanup on unmount: clear pending timeout
  useEffect(() => {
    return () => {
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
      }
    };
  }, [state.timeoutId]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      loading: state.loading,
      startLoading,
      stopLoading,
      withLoading,
    }),
    [state.loading, startLoading, stopLoading, withLoading]
  );

  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
    </LoadingContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useLoading(): LoadingContextValue {
  const context = useContext(LoadingContext);

  if (!context) {
    throw new Error(
      "useLoading must be used within LoadingProvider. " +
        "Ensure LoadingProvider wraps your component tree in app/layout.tsx"
    );
  }

  return context;
}
