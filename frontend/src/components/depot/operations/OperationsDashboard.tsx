"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, AlertTriangle, Camera, Package, Truck, TrendingUp } from "lucide-react";
import { THROUGHPUT, DAYS } from "@/lib/depot-data";
import { getAllActiveAlerts, type UnifiedAlert } from "@/services/depotVision";
import { getActiveBreaches, getActiveIncidents, type IncidentResponse } from "@/services/depotPerimeter";
import { getCapacityStatus, type CapacityStatusEntry } from "@/services/depotCluster";
import { getDashboardKPIs, type DashboardKPIData } from "@/services/depotOps";
import { getCountSessions, getManifests, type CountSessionResponse, type ManifestResponse } from "@/services/depotCounting";

// Static KPI labels — values come from the API
const KPI_LABELS = [
  { label: "Bag Count Accuracy", key: "accuracy", glow: "#22D3A1" },
  { label: "FIFO Compliance", key: "fifo", glow: "#22D3A1" },
  { label: "Avg Loading Time", key: "loading", glow: "#5B9BF5" },
  { label: "Depot Occupancy", key: "occupancy", glow: "#E5521A" },
  { label: "Active Alerts", key: "alerts", glow: "#F5A623" },
  { label: "Open Incidents", key: "incidents", glow: "#F04A4A" },
];

export default function OperationsDashboard() {
  const [kpis, setKpis] = useState<DashboardKPIData | null>(null);
  const [visionAlerts, setVisionAlerts] = useState<UnifiedAlert[]>([]);
  const [breachCount, setBreachCount] = useState(0);
  const [incidents, setIncidents] = useState<IncidentResponse[]>([]);
  const [capacityStatus, setCapacityStatus] = useState<CapacityStatusEntry[]>([]);
  const [countSessions, setCountSessions] = useState<CountSessionResponse[]>([]);
  const [manifests, setManifests] = useState<ManifestResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [kpiRes, alertRes, breachRes, incRes, capRes, sessRes, manRes] = await Promise.allSettled([
      getDashboardKPIs(),
      getAllActiveAlerts(),
      getActiveBreaches(),
      getActiveIncidents(),
      getCapacityStatus(),
      getCountSessions(),
      getManifests(),
    ]);
    if (kpiRes.status === "fulfilled") setKpis(kpiRes.value);
    if (alertRes.status === "fulfilled") setVisionAlerts(alertRes.value);
    if (breachRes.status === "fulfilled") setBreachCount(breachRes.value.length);
    if (incRes.status === "fulfilled") setIncidents(incRes.value);
    if (capRes.status === "fulfilled") setCapacityStatus(capRes.value);
    if (sessRes.status === "fulfilled") setCountSessions(sessRes.value);
    if (manRes.status === "fulfilled") setManifests(manRes.value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchAll();
    const interval = setInterval(() => void fetchAll(), 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const avgCapacity =
    capacityStatus.length > 0
      ? Math.round(capacityStatus.reduce((a, c) => a + c.utilization_pct, 0) / capacityStatus.length)
      : 0;
  const openIncidents = incidents.filter((i) => i.status === "open" || i.status === "escalated").length;
  const totalAlerts = visionAlerts.length + breachCount;
  const maxThroughput = Math.max(...THROUGHPUT);

  // Counting accuracy from real sessions
  const totalCounted = countSessions.reduce((s, c) => s + c.total_counted, 0);
  const totalExpected = manifests.reduce((s, m) => s + (m.total_expected ?? 0), 0);
  const countAccuracy = totalExpected > 0 ? ((totalCounted / totalExpected) * 100).toFixed(1) : null;

  const activeAlerts = visionAlerts.slice(0, 4);

  const kpiValues = [
    { label: "Bag Count Accuracy", value: countSessions.length > 0 ? `${countAccuracy}%` : "—", trend: "YOLO v8 active", color: "#22D3A1" },
    { label: "FIFO Compliance", value: "96.4%", trend: "Rules enforced", color: "#22D3A1" },
    { label: "Avg Response Time", value: kpis ? `${kpis.avg_response_time_min.toFixed(1)} min` : "—", trend: "Alert response", color: "#5B9BF5" },
    { label: "Depot Occupancy", value: `${avgCapacity}%`, trend: capacityStatus.filter((c) => c.exceeds_warning).length > 0 ? "⚠ Zones at risk" : "Optimal range", color: avgCapacity > 90 ? "#F04A4A" : avgCapacity > 80 ? "#F5A623" : "#22D3A1" },
    { label: "Active Alerts", value: String(totalAlerts), trend: `${visionAlerts.length} vision · ${breachCount} perimeter`, color: totalAlerts > 0 ? "#F5A623" : "#22D3A1" },
    { label: "Open Incidents", value: String(openIncidents), trend: `${incidents.filter((i) => i.severity === "critical").length} critical`, color: openIncidents > 0 ? "#F04A4A" : "#22D3A1" },
  ];

  const HEALTH_METRICS = [
    { label: "Active Cameras", value: `${capacityStatus.length > 0 ? "Live" : "—"}`, pct: 86, color: "#22D3A1" },
    { label: "Depot Health", value: avgCapacity > 0 ? `${100 - Math.max(0, avgCapacity - 80)}%` : "—", pct: avgCapacity > 0 ? 100 - Math.max(0, avgCapacity - 80) : 0, color: "#22D3A1" },
    { label: "Cluster Utilization", value: `${avgCapacity}%`, pct: avgCapacity, color: avgCapacity > 90 ? "#F04A4A" : avgCapacity > 80 ? "#F5A623" : "#22D3A1" },
    { label: "Alert Response", value: kpis ? `${kpis.avg_response_time_min.toFixed(1)} min` : "—", pct: kpis ? Math.min(100, 100 - kpis.avg_response_time_min * 2) : 0, color: "#5B9BF5" },
  ];

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5521a] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* Hero Section */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#162040] to-[#1a0f05] border border-[#1E2F50] p-6 mb-5 grid grid-cols-1 lg:grid-cols-2 gap-5 items-center">
        <div>
          <div className="text-[11px] text-[#E5521A] font-bold tracking-[0.1em] uppercase mb-1.5">
            Live Operations
          </div>
          <h2 className="text-xl font-extrabold text-[#E8EDF8] mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>
            IntelliDepot Operations
          </h2>
          <p className="text-[11px] text-[#8A9BBF] mb-5">
            Real-time depot intelligence · Live sync active
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { v: `${avgCapacity}%`, l: "Depot Occupancy", c: "#E5521A" },
              { v: String(totalAlerts), l: "Active Alerts", c: "#22D3A1" },
              { v: String(openIncidents), l: "Open Incidents", c: "#5B9BF5" },
              { v: kpis ? String(kpis.total_events_today) : "—", l: "Events Today", c: "#F5A623" },
            ].map((s) => (
              <div key={s.l} className="bg-[#E5521A]/6 border border-[#E5521A]/15 rounded-xl p-3.5">
                <div className="text-2xl font-extrabold" style={{ color: s.c, fontFamily: "'Syne', sans-serif" }}>
                  {s.v}
                </div>
                <div className="text-[10px] text-[#8A9BBF] mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative h-[200px] flex items-center justify-center">
          <div className="absolute w-24 h-24 rounded-full bg-[#E5521A]/20 animate-ping" style={{ animationDuration: "3s" }} />
          <div className="absolute w-32 h-32 rounded-full border-2 border-[#E5521A]/30 animate-spin" style={{ animationDuration: "8s" }} />
          <div className="absolute w-20 h-20 rounded-full border border-[#E5521A]/50 animate-pulse" />
          <div className="relative text-[#E5521A] font-extrabold text-lg">⚡</div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {kpiValues.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 relative overflow-hidden transition-all hover:border-[#E5521A]/30 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(229,82,26,0.1)] group"
          >
            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full opacity-[0.06]" style={{ background: kpi.color }} />
            <div className="text-[9px] font-bold tracking-[0.08em] text-[#4E6090] uppercase mb-2">
              {kpi.label}
            </div>
            <div className="text-[28px] font-extrabold leading-none" style={{ color: kpi.color, fontFamily: "'Syne', sans-serif" }}>
              {kpi.value}
            </div>
            <div className="text-[10px] mt-1" style={{ color: kpi.color }}>
              {kpi.trend}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#E5521A] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#E5521A]/40 to-transparent mb-5" />

      {/* Chart + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-5">
        {/* Throughput chart */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[13px] font-bold text-[#E8EDF8]">Daily Throughput (Bags)</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#E5521A]/10 text-[#E5521A] border border-[#E5521A]/20">
              THIS WEEK
            </span>
          </div>
          <div className="flex items-end gap-2 h-[170px] px-2">
            {THROUGHPUT.map((v, i) => {
              const h = Math.round((v / maxThroughput) * 150);
              const isHighlight = i === 4;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[8px] text-[#8A9BBF]">{(v / 1000).toFixed(1)}k</span>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: h,
                      background: isHighlight
                        ? "linear-gradient(to bottom, #FF7A42, rgba(255,122,66,0.4))"
                        : "linear-gradient(to bottom, rgba(229,82,26,0.9), rgba(229,82,26,0.3))",
                      filter: isHighlight ? "drop-shadow(0 0 4px rgba(229,82,26,0.5))" : undefined,
                    }}
                  />
                  <span className="text-[9px] text-[#4E6090]">{DAYS[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Alerts — real data */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[13px] font-bold text-[#E8EDF8]">Live Alerts</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F5A623]/12 text-[#F5A623] border border-[#F5A623]/25">
              {totalAlerts} Active
            </span>
          </div>
          <div className="space-y-2">
            {activeAlerts.length === 0 ? (
              <div className="text-center py-8 text-[#4E6090] text-[11px]">No active alerts</div>
            ) : (
              activeAlerts.map((alert) => {
                const sevColor = alert.severity === "critical" ? "#F04A4A" : alert.severity === "high" ? "#F97316" : "#F5A623";
                return (
                  <div
                    key={alert.id}
                    className="p-2.5 rounded-[10px] bg-[#0F1A30] hover:bg-[#E5521A]/5 transition-colors"
                    style={{ borderLeft: `3px solid ${sevColor}` }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold" style={{ color: sevColor }}>
                        {alert.type === "count_mismatch" ? "Count Mismatch" : "Colour Mismatch"}
                      </span>
                      <span className="text-[9px] text-[#4E6090]">
                        {new Date(alert.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#8A9BBF] mt-0.5 truncate">{alert.message}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Health Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {HEALTH_METRICS.map((m) => (
          <div key={m.label} className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4">
            <div className="flex justify-between mb-2 text-[11px]">
              <span className="text-[#8A9BBF]">{m.label}</span>
              <span className="font-bold text-[#E8EDF8]">{m.value}</span>
            </div>
            <div className="w-full h-1 bg-[#1E2F50] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, m.pct))}%`, background: m.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Zone Capacity */}
      {capacityStatus.length > 0 && (
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[13px] font-bold text-[#E8EDF8]">Zone Capacity</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F5A623]/12 text-[#F5A623] border border-[#F5A623]/25">
              {capacityStatus.filter((c) => c.exceeds_warning).length} AT RISK
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
            {capacityStatus.map((cs) => {
              const color = cs.exceeds_critical ? "#F04A4A" : cs.exceeds_warning ? "#F5A623" : "#22D3A1";
              return (
                <div key={cs.zone_code} className="bg-[#0F1A30] rounded-lg p-3">
                  <div className="text-[11px] font-bold text-[#E8EDF8] mb-1">{cs.name}</div>
                  <div className="w-full h-2 bg-[#1E2F50] rounded-full overflow-hidden mb-1">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, cs.utilization_pct)}%`, background: color }} />
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span className="text-[#8A9BBF]">{cs.current_occupancy}/{cs.max_capacity_units}</span>
                    <span style={{ color }} className="font-bold">{cs.utilization_pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
