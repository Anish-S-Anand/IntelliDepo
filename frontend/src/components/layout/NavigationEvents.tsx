"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLoading } from "@/contexts/LoadingContext";

/**
 * Component that listens to Next.js navigation events and shows loading indicator
 * Must be included in the root layout
 * 
 * Wrapped in Suspense to fix Next.js prerender errors with useSearchParams()
 */
export function NavigationEvents() {
  return (
    <Suspense fallback={null}>
      <NavigationEventsContent />
    </Suspense>
  );
}

/**
 * Inner component that uses useSearchParams() hook
 * Must be wrapped in Suspense for static generation compatibility
 */
function NavigationEventsContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { stopLoading, startLoading } = useLoading();

  useEffect(() => {
    // Show loading indicator when navigation starts
    startLoading();
    
    // Hide loading indicator when navigation completes
    // Small delay to prevent UI flicker on instant navigations
    const timer = setTimeout(() => {
      stopLoading();
    }, 100);

    return () => {
      clearTimeout(timer);
      stopLoading();
    };
  }, [pathname, searchParams, startLoading, stopLoading]);

  return null;
}
