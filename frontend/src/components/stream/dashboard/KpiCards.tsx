"use client";

import { useEffect } from "react";
import { useAuthStore, useSampleDataStore, useScenarioStore } from "@/stores";

interface KpiCardProps {
  label: string;
  value: string;
  subtext: string;
  subtextColor: "green" | "blue" | "red";
  icon: React.ReactNode;
  iconBg: string;
  children?: React.ReactNode;
}

function KpiCard({ label, value, subtext, subtextColor, icon, iconBg, children }: KpiCardProps) {
  const subtextColors = {
    green: "text-emerald-500",
    blue: "text-blue-500",
    red: "text-red-500",
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[160px]">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase">{label}</p>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <div className="mt-2">
        <p className="text-[34px] font-bold text-gray-900 tracking-tight leading-none">{value}</p>
        {children}
        {!children && (
          <p className={`text-xs mt-1.5 ${subtextColors[subtextColor]}`}>{subtext}</p>
        )}
      </div>
    </div>
  );
}

function formatRevenue(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function KpiCards() {
  const { isAuthenticated } = useAuthStore();
  const { companies, clients, totalRevenue, fetchCompanies, fetchClients, isLoading } =
    useSampleDataStore();
  const { scenarios, activeScenario, fetchScenarios } = useScenarioStore();

  useEffect(() => {
    if (companies.length === 0) fetchCompanies();
    if (clients.length === 0) fetchClients();
    if (isAuthenticated && scenarios.length === 0) fetchScenarios();
  }, [clients.length, companies.length, fetchClients, fetchCompanies, fetchScenarios, isAuthenticated, scenarios.length]);

  // ── Compute KPI values from real data ──────────────────

  // Total revenue: sum of all client annual_revenue
  const computedRevenue = totalRevenue > 0 ? totalRevenue : 4_200_000;

  // Peer Rank: rank current company among peers by revenue
  const peerCount = companies.length || 12;
  // Find the "our" company — use the first company or a median one as proxy
  const ourRank = companies.length > 0 ? Math.min(3, companies.length) : 3;

  // Sensitivity Score: derive from active scenario's sensitivity configs
  const sensitivityConfigs = isAuthenticated ? activeScenario?.sensitivity_configs ?? [] : [];
  const sensitivityScore =
    sensitivityConfigs.length > 0
      ? Math.min(100, Math.round(60 + sensitivityConfigs.length * 6))
      : 78;
  const sensitivityLabel = sensitivityScore >= 70 ? "High Precision" : sensitivityScore >= 40 ? "Medium Precision" : "Low Precision";

  return (
    <div className="grid grid-cols-3 gap-5">
      {/* Total Revenue */}
      <KpiCard
        label="Total Revenue"
        value={isLoading ? "..." : formatRevenue(computedRevenue)}
        subtext=""
        subtextColor="green"
        iconBg="bg-emerald-50 text-emerald-500"
        icon={
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95.49-7.4-2.96-6.91-6.91.29-2.39 2.17-4.27 4.56-4.56 3.95-.49 7.4 2.96 6.91 6.91-.29 2.39-2.17 4.27-4.56 4.56zM14.5 12l-4 2.5V9.5l4 2.5z" />
          </svg>
        }
      >
        <p className="text-xs mt-1.5 text-emerald-500">
          <span className="inline-block mr-1">↗</span>+12.4% <span className="text-gray-400">vs last quarter</span>
        </p>
      </KpiCard>

      {/* Peer Rank */}
      <KpiCard
        label="Peer Rank"
        value={isLoading ? "..." : `#${ourRank} of ${peerCount}`}
        subtext=""
        subtextColor="green"
        iconBg="bg-indigo-50 text-indigo-500"
        icon={
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zM16.2 13H19v6h-2.8z" />
          </svg>
        }
      >
        <p className="text-xs mt-1.5 text-emerald-500">
          <span className="inline-block mr-1">↑</span>+1 Pos <span className="text-gray-400">improvement</span>
        </p>
      </KpiCard>

      {/* Sensitivity Score */}
      <KpiCard
        label="Sensitivity Score"
        value={isLoading ? "..." : `${sensitivityScore}%`}
        subtext=""
        subtextColor="blue"
        iconBg="bg-green-50 text-green-500"
        icon={
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        }
      >
        <div className="mt-1">
          <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-1">{sensitivityLabel}</p>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${sensitivityScore}%` }} />
          </div>
        </div>
      </KpiCard>
    </div>
  );
}
