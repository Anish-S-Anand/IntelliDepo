"use client";

import React, { useEffect, useState } from "react";
import { useLoading } from "@/contexts/LoadingContext";

interface LoadingBoundaryProps {
  children: React.ReactNode;
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Optional loading delay in ms to prevent flashing for fast requests */
  delay?: number;
}

/**
 * Component that automatically shows loading indicator based on isLoading prop
 * Useful for wrapping data-fetching components
 * 
 * @example
 * <LoadingBoundary isLoading={isLoading}>
 *   <DataComponent data={data} />
 * </LoadingBoundary>
 */
export function LoadingBoundary({ children, isLoading = false, delay = 0 }: LoadingBoundaryProps) {
  const { startLoading, stopLoading } = useLoading();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (isLoading) {
      if (delay > 0) {
        // Delay showing loading indicator to prevent flashing
        timeoutId = setTimeout(() => {
          setShouldShow(true);
          startLoading();
        }, delay);
      } else {
        setShouldShow(true);
        startLoading();
      }
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (shouldShow) {
        stopLoading();
        setShouldShow(false);
      }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (shouldShow) {
        stopLoading();
      }
    };
  }, [isLoading, delay, startLoading, stopLoading, shouldShow]);

  return <>{children}</>;
}
