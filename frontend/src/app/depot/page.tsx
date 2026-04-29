"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /depot root redirects directly to the Operations Hub.
 * This avoids the legacy HTML mount and goes straight to the main dashboard.
 */
export default function DepotPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/depot/operations");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#080d18]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e5521a] border-t-transparent" />
        <span className="text-xs text-[#4E6090]">Loading IntelliDepot...</span>
      </div>
    </div>
  );
}
