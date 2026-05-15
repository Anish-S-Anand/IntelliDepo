"use client";

import AppCard from "@/components/platform/AppCard";
import { Building2 } from "lucide-react";

export default function PlatformPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Header */}
      <div className="mb-12">
        <h2
          className="font-black text-[#0f2356] dark:text-white mb-4"
          style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}
        >
          Welcome to IntelliDepot
        </h2>
        <p
          className="text-slate-600 dark:text-slate-300 max-w-2xl"
          style={{ fontSize: "clamp(1rem, 1.5vw, 1.2rem)", lineHeight: 1.7 }}
        >
          Your smart warehouse management platform — monitor live cameras,
          track inventory, manage gate entries, and respond to incidents,
          all from one place.
        </p>
      </div>

      {/* App Card */}
      <div className="max-w-xl">
        <AppCard
          title="IntelliDepot"
          description="Comprehensive warehouse operations management — live camera monitoring, inventory tracking, gate LPR, and real-time incident response."
          icon={Building2}
          href="/platform/depot"
          color="orange"
          badge="Live"
        />
      </div>

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-700">
        <p
          className="text-slate-500 dark:text-slate-400 text-center"
          style={{ fontSize: 14 }}
        >
          Fidelis Platform · IntelliDepot™ · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
