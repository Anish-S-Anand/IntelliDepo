"use client";

import { useEffect, useMemo } from "react";
import { useAuthStore, useScenarioStore } from "@/stores";
import {
  buildSimulationSnapshot,
  formatSimulationDriverValue,
  type SimulationDriver,
} from "@/utils";

const DEFAULT_DRIVERS: SimulationDriver[] = [
  { label: "Client Retention", value: 420000, pct: 100, color: "bg-blue-500", prefix: "+" },
  { label: "Avg Contract Value", value: 280000, pct: 67, color: "bg-blue-400", prefix: "+" },
  { label: "Churn Rate", value: -150000, pct: 36, color: "bg-red-500", prefix: "" },
];

export default function ImpactSensitivityCard() {
  const { isAuthenticated } = useAuthStore();
  const { activeScenario, fetchScenarios, scenarios } = useScenarioStore();

  useEffect(() => {
    if (isAuthenticated && scenarios.length === 0) {
      fetchScenarios();
    }
  }, [fetchScenarios, isAuthenticated, scenarios.length]);

  const drivers = useMemo(() => {
    if (!isAuthenticated || !activeScenario) return DEFAULT_DRIVERS;
    return buildSimulationSnapshot(activeScenario).drivers;
  }, [activeScenario, isAuthenticated]);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <h3 className="text-sm font-bold tracking-wider text-gray-800 uppercase">Impact Sensitivity</h3>
        </div>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Variance Analysis</span>
      </div>

      <div className="space-y-5">
        {drivers.map((driver) => (
          <div key={driver.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                {driver.label}
              </span>
              <span
                className={`text-xs font-bold ${driver.value >= 0 ? "text-blue-600" : "text-red-500"}`}
              >
                {driver.prefix}{formatSimulationDriverValue(driver.value)}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${driver.color}`}
                style={{ width: `${driver.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
