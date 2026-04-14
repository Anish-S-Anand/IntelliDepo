"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, Radio, TrendingUp } from "lucide-react";

interface KPI {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  pulse?: boolean;
}

interface DashboardKPIData {
  total_events_today: number;
  active_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  medium_alerts: number;
  acknowledged_count: number;
  avg_response_time_min: number;
  events_per_hour: number;
}

const FALLBACK_KPI: DashboardKPIData = {
  total_events_today: 1284,
  active_alerts: 7,
  critical_alerts: 2,
  high_alerts: 3,
  medium_alerts: 2,
  acknowledged_count: 14,
  avg_response_time_min: 2.4,
  events_per_hour: 53.5,
};

export default function DashboardKPIStrip() {
  const [kpi, setKpi] = useState<DashboardKPIData>(FALLBACK_KPI);

  const fetchKPIs = useCallback(async () => {
    try {
      const { getDashboardKPIs } = await import("@/services/depotOps");
      const data = await getDashboardKPIs();
      setKpi(data);
      return;
    } catch {
      // backend unavailable — use simulated refresh
    }
    // Simulated increment when backend is not available
    setKpi((prev) => ({
      ...prev,
      total_events_today: prev.total_events_today + Math.floor(Math.random() * 3),
      events_per_hour: parseFloat((prev.events_per_hour + (Math.random() - 0.5) * 2).toFixed(1)),
    }));
  }, []);

  // Poll every 5s — matches sub-5s dashboard refresh SLA
  useEffect(() => {
    fetchKPIs();
    const interval = setInterval(fetchKPIs, 5000);
    return () => clearInterval(interval);
  }, [fetchKPIs]);

  const tiles: KPI[] = [
    {
      label: "Events Today",
      value: kpi.total_events_today.toLocaleString(),
      sub: `${kpi.events_per_hour}/hr`,
      icon: Activity,
      color: "#22D3A1",
    },
    {
      label: "Active Alerts",
      value: kpi.active_alerts,
      sub: `${kpi.critical_alerts} critical`,
      icon: AlertTriangle,
      color: kpi.critical_alerts > 0 ? "#ef4444" : "#f59e0b",
      pulse: kpi.critical_alerts > 0,
    },
    {
      label: "Critical",
      value: kpi.critical_alerts,
      sub: "Immediate action",
      icon: Radio,
      color: "#ef4444",
      pulse: kpi.critical_alerts > 0,
    },
    {
      label: "High Priority",
      value: kpi.high_alerts,
      sub: "Escalation risk",
      icon: TrendingUp,
      color: "#f97316",
    },
    {
      label: "Acknowledged",
      value: kpi.acknowledged_count,
      sub: "Operator reviewed",
      icon: CheckCircle2,
      color: "#22D3A1",
    },
    {
      label: "Avg Response",
      value: `${kpi.avg_response_time_min}m`,
      sub: "Time to acknowledge",
      icon: Clock,
      color: "#5B9BF5",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.label}
            className="relative overflow-hidden rounded-[14px] border border-[#1E2F50] bg-[#14203A] p-4 transition-all hover:border-[#E5521A]/30 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(229,82,26,0.08)]"
          >
            <div
              className="absolute -top-5 -right-5 w-20 h-20 rounded-full opacity-[0.06]"
              style={{ background: tile.color }}
            />
            <div className="flex items-center gap-1.5 mb-2">
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#4E6090]">
                {tile.label}
              </span>
              {tile.pulse && (
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse ml-auto"
                  style={{ background: tile.color }}
                />
              )}
            </div>
            <div className="text-[22px] font-black leading-none" style={{ color: tile.color }}>
              {tile.value}
            </div>
            <div className="text-[10px] text-[#4E6090] mt-1">{tile.sub}</div>
          </div>
        );
      })}
    </div>
  );
}
