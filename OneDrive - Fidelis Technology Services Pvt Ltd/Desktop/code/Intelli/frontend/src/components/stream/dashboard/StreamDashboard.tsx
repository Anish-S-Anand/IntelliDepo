"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/stores";
import KpiCards from "./KpiCards";
import RevenueConcentrationCard from "./RevenueConcentrationCard";
import ImpactSensitivityCard from "./ImpactSensitivityCard";
import SimulationPanel from "./SimulationPanel";

export default function StreamDashboard() {
  const { token, user, fetchMe, isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (token && !user && !isLoading) {
      fetchMe().catch(() => undefined);
    }
  }, [fetchMe, isLoading, token, user]);

  return (
    <div className="px-8 py-6 space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Precision Curator</h2>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            SYNCHRONIZED
          </span>
          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
        </div>
      </div>

      {!isAuthenticated && !token && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Public data is available below. Sign in to load saved scenarios and persist simulation changes.
        </div>
      )}

      {/* KPI Cards */}
      <KpiCards />

      {/* Middle Row */}
      <div className="grid grid-cols-2 gap-5">
        <RevenueConcentrationCard />
        <ImpactSensitivityCard />
      </div>

      {/* Simulation Panel */}
      <SimulationPanel />
    </div>
  );
}
