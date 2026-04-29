"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Analytics has been merged into the Operations Hub (Dashboard).
 * This page redirects to /depot/operations.
 */
export default function AnalyticsRoute() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/depot/operations");
  }, [router]);

  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5521a] border-t-transparent mx-auto mb-3" />
        <p className="text-[#8A9BBF] text-[12px]">Redirecting to Operations Hub…</p>
      </div>
    </div>
  );
}
