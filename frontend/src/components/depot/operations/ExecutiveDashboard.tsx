"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  ShieldAlert,
  Eye,
  Package,
  Hash,
  Map,
  Layers,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Truck,
  Camera,
  BarChart3,
  Zap,
  Clock,
} from "lucide-react";
import { THROUGHPUT, DAYS } from "@/lib/depot-data";
import { getAllActiveAlerts, type UnifiedAlert } from "@/services/depotVision";
import { getActiveBreaches, getIncidents, getPerimeterZones, type IncidentResponse } from "@/services/depotPerimeter";
import { getCapacityStatus, type CapacityStatusEntry } from "@/services/depotCluster";
import { getCountSessions, getManifests, type CountSessionResponse, type ManifestResponse } from "@/services/depotCounting";
import { getAccessLogs, type AccessLogResponse } from "@/services/depotGate";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModuleStatus {
  name: string;
  icon: React.ElementType;
  status: "operational" | "degraded" | "offline";
  metric: string;
  detail: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Memoized KPI Card Component
// ---------------------------------------------------------------------------

interface KPICardProps {
  label: string;
  value: string;
  trend: string;
  icon: React.ElementType;
  color: string;
}

const KPICard = memo(({ label, value, trend, icon: Icon, color }: KPICardProps) => {
  const cardStyle = useMemo(() => ({
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-card)",
    color: "var(--text-primary)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  }), []);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(229,82,26,0.12)";
    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(229,82,26,0.3)";
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)";
    (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-card)";
  }, []);

  return (
    <div
      className="rounded-[14px] p-3 sm:p-4 relative overflow-hidden transition-all hover:-translate-y-0.5 group cursor-default"
      style={cardStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-[9px] font-black tracking-[0.08em] uppercase" style={{ color: "var(--text-faint)" }}>
          {label}
        </span>
      </div>
      <div className="text-[24px] sm:text-[28px] font-extrabold leading-none" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{trend}</div>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#E5521A] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
});

KPICard.displayName = "KPICard";

// ---------------------------------------------------------------------------
// Memoized Module Health Card Component
// ---------------------------------------------------------------------------

const ModuleHealthCard = memo(({ mod }: { mod: ModuleStatus }) => {
  const Icon = mod.icon;
  const statusColorMap: Record<string, string> = useMemo(() => ({
    operational: "var(--color-success)",
    degraded: "var(--color-warning)",
    offline: "var(--color-danger)",
  }), []);
  
  const sColor = statusColorMap[mod.status];
  
  const cardStyle = useMemo(() => ({
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-card)",
    color: "var(--text-primary)",
  }), []);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-strong)";
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-card)";
  }, []);

  const progressWidth = useMemo(() => {
    return mod.status === "operational" ? "100%" : mod.status === "degraded" ? "60%" : "0%";
  }, [mod.status]);

  return (
    <div
      className="rounded-[14px] p-4 transition-all"
      style={cardStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center border"
            style={{ background: `${sColor}12`, borderColor: `${sColor}25` }}
          >
            <Icon className="w-4 h-4" style={{ color: sColor }} />
          </div>
          <div>
            <div className="text-[13px] font-black" style={{ color: "var(--text-primary)" }}>{mod.name}</div>
            <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{mod.detail}</div>
          </div>
        </div>
        <span
          className="text-[8px] font-black px-2 py-0.5 rounded-full border uppercase"
          style={{ background: `${sColor}15`, color: sColor, borderColor: `${sColor}30` }}
        >
          {mod.status}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-surface-2)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: progressWidth,
              background: sColor,
            }}
          />
        </div>
        <span className="text-[11px] font-black" style={{ color: sColor }}>{mod.metric}</span>
      </div>
    </div>
  );
});

ModuleHealthCard.displayName = "ModuleHealthCard";

// ---------------------------------------------------------------------------
// Skeleton loader for initial load
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-5 animate-pulse" style={{ color: "var(--text-primary)" }}>
      {/* Header skeleton */}
      <div className="flex justify-between items-start mb-5">
        <div className="space-y-2">
          <div className="route-skeleton-bar h-3 w-24" />
          <div className="route-skeleton-bar h-6 w-48" />
          <div className="route-skeleton-bar h-3 w-36" />
        </div>
        <div className="route-skeleton-bar h-8 w-28 rounded-lg" />
      </div>
      {/* KPI strip skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="route-skeleton-bar h-20 rounded-[14px]" />
        ))}
      </div>
      {/* Module grid skeleton */}
      <div className="route-skeleton-bar h-5 w-32 mb-3" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="route-skeleton-bar h-20 rounded-[14px]" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExecutiveDashboard() {
  const [visionAlerts, setVisionAlerts] = useState<UnifiedAlert[]>([]);
  const [activeBreaches, setActiveBreaches] = useState(0);
  const [incidents, setIncidents] = useState<IncidentResponse[]>([]);
  const [capacityStatus, setCapacityStatus] = useState<CapacityStatusEntry[]>([]);
  const [perimeterZones, setPerimeterZones] = useState(0);
  const [countSessions, setCountSessions] = useState<CountSessionResponse[]>([]);
  const [manifests, setManifests] = useState<ManifestResponse[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLogResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const results = await Promise.allSettled([
      getAllActiveAlerts(),
      getActiveBreaches(),
      getIncidents(),
      getCapacityStatus(),
      getPerimeterZones(),
      getCountSessions(),
      getManifests(),
      getAccessLogs({ limit: 100 }),
    ]);
    if (results[0].status === "fulfilled") setVisionAlerts(results[0].value);
    if (results[1].status === "fulfilled") setActiveBreaches(results[1].value.length);
    if (results[2].status === "fulfilled") setIncidents(results[2].value);
    if (results[3].status === "fulfilled") setCapacityStatus(results[3].value);
    if (results[4].status === "fulfilled") setPerimeterZones(results[4].value.length);
    if (results[5].status === "fulfilled") setCountSessions(results[5].value);
    if (results[6].status === "fulfilled") setManifests(results[6].value);
    if (results[7].status === "fulfilled") setAccessLogs(results[7].value);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchAll();
    const interval = setInterval(() => void fetchAll(), 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  if (loading) return <DashboardSkeleton />;

  // Derived KPIs - memoized to prevent recalculation on every render
  const totalAlerts = useMemo(() => visionAlerts.length + activeBreaches, [visionAlerts.length, activeBreaches]);
  const openIncidents = useMemo(() => incidents.filter((i) => i.status === "open" || i.status === "escalated").length, [incidents]);
  const resolvedIncidents = useMemo(() => incidents.filter((i) => i.status === "resolved").length, [incidents]);
  const criticalIncidents = useMemo(() => incidents.filter((i) => i.severity === "critical").length, [incidents]);
  const avgCapacity = useMemo(() => {
    return capacityStatus.length > 0
      ? Math.round(capacityStatus.reduce((acc, c) => acc + c.utilization_pct, 0) / capacityStatus.length)
      : 84;
  }, [capacityStatus]);
  const zonesExceedingWarning = useMemo(() => capacityStatus.filter((c) => c.exceeds_warning).length, [capacityStatus]);

  const totalCounted = useMemo(() => countSessions.reduce((s, c) => s + c.total_counted, 0), [countSessions]);
  const totalExpected = useMemo(() => manifests.reduce((s, m) => s + (m.total_expected ?? 0), 0), [manifests]);
  const countAccuracy = useMemo(() => {
    return totalExpected > 0 ? ((totalCounted / totalExpected) * 100).toFixed(1) : "—";
  }, [totalCounted, totalExpected]);
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const gateEventsToday = useMemo(() => {
    return accessLogs.filter((log) => log.processed_at.startsWith(todayKey)).length || accessLogs.length;
  }, [accessLogs, todayKey]);

  const modules: ModuleStatus[] = useMemo(() => [
    { name: "Object Detection", icon: Eye, status: "operational", metric: `${perimeterZones} zones`, detail: "YOLO v8 active", color: "var(--color-success)" },
    { name: "Automated Counting", icon: Hash, status: "operational", metric: `${countAccuracy}% acc`, detail: `${countSessions.length} sessions today`, color: "var(--color-success)" },
    { name: "Cluster Mapping", icon: Map, status: zonesExceedingWarning > 0 ? "degraded" : "operational", metric: `${avgCapacity}% avg`, detail: `${zonesExceedingWarning} zones over threshold`, color: zonesExceedingWarning > 0 ? "var(--color-warning)" : "var(--color-success)" },
    { name: "Inventory Sequencing", icon: Layers, status: "operational", metric: "96.4% FIFO", detail: "Rules enforced", color: "var(--color-success)" },
    { name: "Gate & LPR", icon: Shield, status: "operational", metric: `${gateEventsToday} events`, detail: "OCR active", color: "var(--color-success)" },
    { name: "Perimeter Security", icon: ShieldAlert, status: activeBreaches > 0 ? "degraded" : "operational", metric: `${perimeterZones} zones`, detail: `${activeBreaches} active breaches`, color: activeBreaches > 0 ? "var(--color-danger)" : "var(--color-success)" },
  ], [perimeterZones, countAccuracy, countSessions.length, zonesExceedingWarning, avgCapacity, gateEventsToday, activeBreaches]);

  const maxThroughput = useMemo(() => Math.max(...THROUGHPUT), []);

  // KPI data - memoized to prevent recreation on every render
  const kpiData = useMemo(() => [
    { label: "Detection Accuracy", value: `${countAccuracy}%`, trend: "YOLO v8 confidence", icon: Eye, color: "var(--color-success)" },
    { label: "Active Alerts", value: String(totalAlerts), trend: `${visionAlerts.length} vision · ${activeBreaches} perimeter`, icon: AlertTriangle, color: totalAlerts > 0 ? "var(--color-warning)" : "var(--color-success)" },
    { label: "Open Incidents", value: String(openIncidents), trend: `${criticalIncidents} critical`, icon: ShieldAlert, color: openIncidents > 0 ? "var(--color-danger)" : "var(--color-success)" },
    { label: "Depot Occupancy", value: `${avgCapacity}%`, trend: `${zonesExceedingWarning} zones at risk`, icon: Package, color: avgCapacity > 90 ? "var(--color-danger)" : avgCapacity > 80 ? "var(--color-warning)" : "var(--color-success)" },
    { label: "Gate Events", value: String(gateEventsToday), trend: "LPR scans today", icon: Truck, color: "var(--color-info)" },
    { label: "Resolved Today", value: String(resolvedIncidents), trend: `${resolvedIncidents} incidents closed`, icon: CheckCircle2, color: "var(--color-success)" },
  ], [countAccuracy, totalAlerts, visionAlerts.length, activeBreaches, openIncidents, criticalIncidents, avgCapacity, zonesExceedingWarning, gateEventsToday, resolvedIncidents]);

  // Card style using CSS vars — adapts to light/dark
  const cardStyle = useMemo(() => ({
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-card)",
    color: "var(--text-primary)",
  }), []);

  const innerCardStyle = useMemo(() => ({
    backgroundColor: "var(--bg-surface-2)",
    border: "1px solid var(--border-default)",
  }), []);

  return (
    <motion.div 
      className="p-4 sm:p-5" 
      style={{ animation: "fadeIn 0.3s ease" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >

      {/* Header */}
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <div className="text-[11px] font-black tracking-[0.1em] uppercase mb-1" style={{ color: "#E5521A" }}>
            Executive Overview
          </div>
          <h1 className="text-[20px] sm:text-[22px] font-extrabold" style={{ color: "var(--text-primary)" }}>
            Operations Hub
          </h1>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            IntelliDepot · All 6 modules active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold"
            style={{ backgroundColor: "rgba(34,211,161,0.1)", border: "1px solid rgba(34,211,161,0.25)", color: "var(--color-success)" }}
          >
            <Activity className="w-3.5 h-3.5" />
            System Online
          </span>
        </div>
      </div>

      {/* Hero KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {kpiData.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="h-px mb-5" style={{ background: "linear-gradient(90deg, transparent, rgba(229,82,26,0.4), transparent)" }} />

      {/* Module Health Grid */}
      <div className="mb-5">
        <h2 className="text-[14px] font-black mb-3" style={{ color: "var(--text-primary)" }}>
          Module Health
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {modules.map((mod) => (
            <ModuleHealthCard key={mod.name} mod={mod} />
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-5">
        {/* Throughput Chart */}
        <div className="rounded-[14px] p-4 sm:p-[18px]" style={cardStyle}>
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[13px] font-black" style={{ color: "var(--text-primary)" }}>
              Daily Throughput (Bags)
            </span>
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded-full border"
              style={{ background: "rgba(229,82,26,0.1)", color: "#E5521A", borderColor: "rgba(229,82,26,0.2)" }}
            >
              THIS WEEK
            </span>
          </div>
          <div className="flex items-end gap-1.5 sm:gap-2 h-[140px] sm:h-[170px] px-1 sm:px-2">
            {THROUGHPUT.map((v, i) => {
              const h = Math.round((v / maxThroughput) * 130);
              const isHighlight = i === 4;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[8px]" style={{ color: "var(--text-muted)" }}>{(v / 1000).toFixed(1)}k</span>
                  <div
                    className="w-full rounded-t transition-all hover:opacity-90"
                    style={{
                      height: h,
                      background: isHighlight
                        ? "linear-gradient(to bottom, #FF7A42, rgba(255,122,66,0.4))"
                        : "linear-gradient(to bottom, rgba(229,82,26,0.9), rgba(229,82,26,0.3))",
                      filter: isHighlight ? "drop-shadow(0 0 4px rgba(229,82,26,0.5))" : undefined,
                    }}
                  />
                  <span className="text-[9px]" style={{ color: "var(--text-faint)" }}>{DAYS[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Counting Sessions */}
        <div className="rounded-[14px] p-4 sm:p-[18px]" style={cardStyle}>
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[13px] font-black" style={{ color: "var(--text-primary)" }}>
              Counting Sessions
            </span>
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded-full border"
              style={{ background: "rgba(91,155,245,0.12)", color: "var(--color-info)", borderColor: "rgba(91,155,245,0.25)" }}
            >
              {countSessions.length} TODAY
            </span>
          </div>
          <div className="space-y-2">
            {countSessions.length === 0 ? (
              <div className="text-center py-6 text-[11px]" style={{ color: "var(--text-faint)" }}>
                No counting sessions today
              </div>
            ) : (
              countSessions.slice(0, 5).map((cs) => {
                const matchColor = cs.reconciliation_status === "matched"
                  ? "var(--color-success)"
                  : cs.reconciliation_status === "mismatch"
                  ? "var(--color-danger)"
                  : "var(--color-warning)";
                const manifest = manifests.find((m) => m.id === cs.manifest_id);
                return (
                  <div key={cs.id} className="p-2.5 rounded-[10px]" style={innerCardStyle}>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-black" style={{ color: "var(--text-primary)" }}>
                        {manifest?.manifest_code ?? "—"}
                      </span>
                      <span
                        className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                        style={{ background: `${matchColor}15`, color: matchColor }}
                      >
                        {cs.reconciliation_status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                      <span>{cs.total_counted}/{manifest?.total_expected ?? "?"} items</span>
                      <span style={{ color: cs.discrepancy_total !== 0 ? "var(--color-danger)" : "var(--color-success)" }}>
                        {cs.discrepancy_total >= 0 ? "+" : ""}{cs.discrepancy_total}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Capacity Overview */}
      {capacityStatus.length > 0 && (
        <div className="rounded-[14px] p-4 sm:p-[18px] mb-5" style={cardStyle}>
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[13px] font-black" style={{ color: "var(--text-primary)" }}>
              Zone Capacity Status
            </span>
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded-full border"
              style={{ background: "rgba(245,166,35,0.12)", color: "var(--color-warning)", borderColor: "rgba(245,166,35,0.25)" }}
            >
              {zonesExceedingWarning} AT RISK
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
            {capacityStatus.map((cs) => {
              const color = cs.exceeds_critical
                ? "var(--color-danger)"
                : cs.exceeds_warning
                ? "var(--color-warning)"
                : "var(--color-success)";
              return (
                <div key={cs.zone_code} className="rounded-lg p-3" style={innerCardStyle}>
                  <div className="text-[11px] font-black mb-1" style={{ color: "var(--text-primary)" }}>
                    {cs.name}
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden mb-1" style={{ backgroundColor: "var(--bg-surface-3)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, cs.utilization_pct)}%`, background: color }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span style={{ color: "var(--text-muted)" }}>{cs.current_occupancy}/{cs.max_capacity_units}</span>
                    <span style={{ color, fontWeight: 900 }}>{cs.utilization_pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Security & Incident Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Vision Alerts */}
        <div className="rounded-[14px] p-4 sm:p-[18px]" style={cardStyle}>
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[13px] font-black" style={{ color: "var(--text-primary)" }}>
              Vision Alerts
            </span>
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded-full border"
              style={{ background: "rgba(245,166,35,0.12)", color: "var(--color-warning)", borderColor: "rgba(245,166,35,0.25)" }}
            >
              {visionAlerts.length} ACTIVE
            </span>
          </div>
          <div className="space-y-2">
            {visionAlerts.slice(0, 4).map((alert) => {
              const sevColor = alert.severity === "critical"
                ? "var(--color-danger)"
                : alert.severity === "high"
                ? "#F97316"
                : "var(--color-warning)";
              return (
                <div
                  key={alert.id}
                  className="p-2.5 rounded-[10px]"
                  style={{ ...innerCardStyle, borderLeft: `3px solid ${sevColor}` }}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black" style={{ color: sevColor }}>
                      {alert.type === "count_mismatch" ? "Count Mismatch" : "Colour Mismatch"}
                    </span>
                    <span className="text-[9px]" style={{ color: "var(--text-faint)" }}>
                      {new Date(alert.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{alert.message}</div>
                </div>
              );
            })}
            {visionAlerts.length === 0 && (
              <div className="text-center py-6 text-[11px]" style={{ color: "var(--text-faint)" }}>
                No active vision alerts
              </div>
            )}
          </div>
        </div>

        {/* Security Incidents */}
        <div className="rounded-[14px] p-4 sm:p-[18px]" style={cardStyle}>
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[13px] font-black" style={{ color: "var(--text-primary)" }}>
              Security Incidents
            </span>
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded-full border"
              style={{ background: "rgba(240,74,74,0.12)", color: "var(--color-danger)", borderColor: "rgba(240,74,74,0.25)" }}
            >
              {openIncidents} OPEN
            </span>
          </div>
          <div className="space-y-2">
            {incidents.filter((i) => i.status !== "resolved").slice(0, 4).map((inc) => {
              const sevColor = inc.severity === "critical"
                ? "var(--color-danger)"
                : inc.severity === "high"
                ? "#F97316"
                : "var(--color-warning)";
              return (
                <div
                  key={inc.id}
                  className="p-2.5 rounded-[10px]"
                  style={{ ...innerCardStyle, borderLeft: `3px solid ${sevColor}` }}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black" style={{ color: sevColor }}>{inc.title}</span>
                    <span
                      className="text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase"
                      style={{ background: `${sevColor}15`, color: sevColor }}
                    >
                      {inc.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {inc.escalated_to || "Unassigned"}
                    </span>
                    {inc.escalation_deadline && inc.status === "open" && (
                      <span className="flex items-center gap-1 text-[9px]" style={{ color: "var(--color-warning)" }}>
                        <Clock className="w-3 h-3" />
                        {Math.max(0, Math.round((new Date(inc.escalation_deadline).getTime() - Date.now()) / 60000))}m
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {incidents.filter((i) => i.status !== "resolved").length === 0 && (
              <div className="text-center py-6 text-[11px]" style={{ color: "var(--text-faint)" }}>
                No active security incidents
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
