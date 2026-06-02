"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

/**
 * /depot root redirects to the role-specific Command Center.
 */
export default function DepotPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const normalizedRole = (user?.role ?? "").toLowerCase().replace(/\s+/g, "_");
    const commandRoute = normalizedRole === "warehouse_manager" || normalizedRole.includes("warehouse")
      ? "/depot/command/warehouse"
      : normalizedRole === "regional_manager" || normalizedRole.includes("regional")
        ? "/depot/command/regional"
        : normalizedRole === "central_manager" || normalizedRole.includes("central")
          ? "/depot/command/central"
          : normalizedRole.includes("admin")
            ? "/depot/command/admin"
            : "/depot/command";

    router.replace(commandRoute);
  }, [router, user?.role]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#080d18]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        <span className="text-xs text-[#4E6090]">Loading IntelliDepot...</span>
      </div>
    </div>
  );
}
