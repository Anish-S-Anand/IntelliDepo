"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useLoading } from "@/contexts/LoadingContext";

/**
 * Hook that automatically shows loading indicator during Next.js navigation
 */
export function useNavigationLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { startLoading, stopLoading } = useLoading();

  useEffect(() => {
    // Stop loading when navigation completes
    stopLoading();
  }, [pathname, searchParams, stopLoading]);

  // Return function to manually trigger loading for navigation
  return { startNavigationLoading: startLoading };
}
