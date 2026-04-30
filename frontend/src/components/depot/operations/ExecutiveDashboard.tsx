"use client";

import { useState, useEffect, useCallback } from "react";
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
    // Use Promise.allSettled so one 401 doesn't block the rest
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
    // Reduced polling interval for better performance
    const interval = setInterval(() => void fetchAll(), 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Derived KPIs
  const totalAlerts = visionAlerts.length + activeBreaches;
  const openIncidents = incidents.filter((i) => i.status === "open" || i.status === "escalated").length;
  const resolvedIncidents = incidents.filter((i) => i.status === "resolved").length;
  const criticalIncidents = incidents.filter((i) => i.severity === "critical").length;
  const avgCapacity = capacityStatus.length > 0
    ? Math.round(capacityStatus.reduce((acc, c) => acc + c.utilization_pct, 0) / capacityStatus.length)
    : 84;
  const zonesExceedingWarning = capacityStatus.filter((c) => c.exceeds_warning).length;

  // Counting KPIs from real API data
  const totalCounted = countSessions.reduce((s, c) => s + c.total_counted, 0);
  const totalExpected = manifests.reduce((s, m) => s + (m.total_expected ?? 0), 0);
  const countAccuracy = totalExpected > 0 ? ((totalCounted / totalExpected) * 100).toFixed(1) : "—";
  const mismatches = countSessions.filter((c) => c.reconciliation_status === "mismatch").length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const gateEventsToday = accessLogs.filter((log) => log.processed_at.startsWith(todayKey)).length || accessLogs.length;

  // Module status
  const modules: ModuleStatus[] = [
    { name: "Object Detection", icon: Eye, status: "operational", metric: `${perimeterZones} zones`, detail: "YOLO v8 active", color: "#22D3A1" },
    { name: "Automated Counting", icon: Hash, status: "operational", metric: `${countAccuracy}% acc`, detail: `${countSessions.length} sessions today`, color: "#22D3A1" },
    { name: "Cluster Mapping", icon: Map, status: zonesExceedingWarning > 0 ? "degraded" : "operational", metric: `${avgCapacity}% avg`, detail: `${zonesExceedingWarning} zones over threshold`, color: zonesExceedingWarning > 0 ? "#F5A623" : "#22D3A1" },
    { name: "Inventory Sequencing", icon: Layers, status: "operational", metric: "96.4% FIFO", detail: "Rules enforced", color: "#22D3A1" },
    { name: "Gate & LPR", icon: Shield, status: "operational", metric: `${gateEventsToday} events`, detail: "OCR active", color: "#22D3A1" },
    { name: "Perimeter Security", icon: ShieldAlert, status: activeBreaches > 0 ? "degraded" : "operational", metric: `${perimeterZones} zones`, detail: `${activeBreaches} active breaches`, color: activeBreaches > 0 ? "#F04A4A" : "#22D3A1" },
  ];

  const statusColors = { operational: "#22D3A1", degraded: "#F5A623", offline: "#F04A4A" };
  const maxThroughput = Math.max(...THROUGHPUT);

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      {/* Header */}
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <div className="text-[11px] text-[#E5521A] font-bold tracking-[0.1em] uppercase mb-1">
            Executive Overview
          </div>
          <h1 className="text-[22px] font-extrabold text-[#E8EDF8]">
            Operations Hub
          </h1>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            IntelliDepot · All 6 modules active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22D3A1]/10 border border-[#22D3A1]/25 text-[#22D3A1] text-[11px] font-bold">
            <Activity className="w-3.5 h-3.5" />
            System Online
          </span>
        </div>
      </div>

      {/* Hero KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {[
          { label: "Detection Accuracy", value: `${countAccuracy}%`, trend: "YOLO v8 confidence", icon: Eye, color: "#22D3A1" },
          { label: "Active Alerts", value: String(totalAlerts), trend: `${visionAlerts.length} vision · ${activeBreaches} perimeter`, icon: AlertTriangle, color: totalAlerts > 0 ? "#F5A623" : "#22D3A1" },
          { label: "Open Incidents", value: String(openIncidents), trend: `${criticalIncidents} critical`, icon: ShieldAlert, color: openIncidents > 0 ? "#F04A4A" : "#22D3A1" },
          { label: "Depot Occupancy", value: `${avgCapacity}%`, trend: `${zonesExceedingWarning} zones at risk`, icon: Package, color: avgCapacity > 90 ? "#F04A4A" : avgCapacity > 80 ? "#F5A623" : "#22D3A1" },
          { label: "Gate Events", value: String(gateEventsToday), trend: "LPR scans today", icon: Truck, color: "#5B9BF5" },
          { label: "Resolved Today", value: String(resolvedIncidents), trend: `${resolvedIncidents} incidents closed`, icon: CheckCircle2, color: "#22D3A1" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 relative overflow-hidden transition-all hover:border-[#E5521A]/30 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(229,82,26,0.1)] group"
            >
              <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full opacity-[0.06]" style={{ background: kpi.color }} />
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className="w-3.5 h-3.5" style={{ color: kpi.color }} />
                <span className="text-[9px] font-bold tracking-[0.08em] text-[#4E6090] uppercase">{kpi.label}</span>
              </div>
              <div className="text-[28px] font-extrabold leading-none" style={{ color: kpi.color, fontFamily: "'Syne', sans-serif" }}>
                {kpi.value}
              </div>
              <div className="text-[10px] text-[#8A9BBF] mt-1">{kpi.trend}</div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#E5521A] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          );
        })}
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#E5521A]/40 to-transparent mb-5" />

      {/* Module Status Grid */}
      <div className="mb-5">
        <h2 className="text-[14px] font-bold text-[#E8EDF8] mb-3" >
          Module Health
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {modules.map((mod) => {
            const Icon = mod.icon;
            const sColor = statusColors[mod.status];
            return (
              <div
                key={mod.name}
                className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 transition-all hover:border-[#2A3F68]"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center border"
                      style={{ background: `${mod.color}12`, borderColor: `${mod.color}25` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: mod.color }} />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-[#E8EDF8]">{mod.name}</div>
                      <div className="text-[10px] text-[#8A9BBF]">{mod.detail}</div>
                    </div>
                  </div>
                  <span
                    className="text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase"
                    style={{ background: `${sColor}15`, color: sColor, borderColor: `${sColor}30` }}
                  >
                    {mod.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-[#1E2F50] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: mod.status === "operational" ? "100%" : mod.status === "degraded" ? "60%" : "0%",
                        background: sColor,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: mod.color }}>{mod.metric}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-5">
        {/* Throughput Chart */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[13px] font-bold text-[#E8EDF8]" >
              Daily Throughput (Bags)
            </span>
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

        {/* Counting Accuracy Summary */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[13px] font-bold text-[#E8EDF8]" >
              Counting Sessions
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#5B9BF5]/12 text-[#5B9BF5] border border-[#5B9BF5]/25">
              {countSessions.length} TODAY
            </span>
          </div>
          <div className="space-y-2">
            {countSessions.length === 0 ? (
              <div className="text-center py-6 text-[#4E6090] text-[11px]">No counting sessions today</div>
            ) : (
              countSessions.slice(0, 5).map((cs) => {
                const matchColor = cs.reconciliation_status === "matched" ? "#22D3A1" : cs.reconciliation_status === "mismatch" ? "#F04A4A" : "#F5A623";
                const manifest = manifests.find((m) => m.id === cs.manifest_id);
                return (
                  <div key={cs.id} className="p-2.5 rounded-[10px] bg-[#0F1A30]">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-[#E8EDF8]">{manifest?.manifest_code ?? "—"}</span>
                      <span
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${matchColor}15`, color: matchColor }}
                      >
                        {cs.reconciliation_status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1 text-[10px] text-[#8A9BBF]">
                      <span>{cs.total_counted}/{manifest?.total_expected ?? "?"} items</span>
                      <span style={{ color: cs.discrepancy_total !== 0 ? "#F04A4A" : "#22D3A1" }}>
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
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px] mb-5">
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[13px] font-bold text-[#E8EDF8]" >
              Zone Capacity Status
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F5A623]/12 text-[#F5A623] border border-[#F5A623]/25">
              {zonesExceedingWarning} AT RISK
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
            {capacityStatus.map((cs) => {
              const color = cs.exceeds_critical ? "#F04A4A" : cs.exceeds_warning ? "#F5A623" : "#22D3A1";
              return (
                <div key={cs.zone_code} className="bg-[#0F1A30] rounded-lg p-3">
                  <div className="text-[11px] font-bold text-[#E8EDF8] mb-1">{cs.name}</div>
                  <div className="w-full h-2 bg-[#1E2F50] rounded-full overflow-hidden mb-1">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, cs.utilization_pct)}%`, background: color }} />
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

      {/* Security & Incident Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Vision Alerts */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[13px] font-bold text-[#E8EDF8]" >
              Vision Alerts
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F5A623]/12 text-[#F5A623] border border-[#F5A623]/25">
              {visionAlerts.length} ACTIVE
            </span>
          </div>
          <div className="space-y-2">
            {visionAlerts.slice(0, 4).map((alert) => {
              const sevColor = alert.severity === "critical" ? "#F04A4A" : alert.severity === "high" ? "#F97316" : "#F5A623";
              return (
                <div key={alert.id} className="p-2.5 rounded-[10px] bg-[#0F1A30]" style={{ borderLeft: `3px solid ${sevColor}` }}>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold" style={{ color: sevColor }}>
                      {alert.type === "count_mismatch" ? "Count Mismatch" : "Colour Mismatch"}
                    </span>
                    <span className="text-[9px] text-[#4E6090]">
                      {new Date(alert.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#8A9BBF] mt-0.5">{alert.message}</div>
                </div>
              );
            })}
            {visionAlerts.length === 0 && (
              <div className="text-center py-6 text-[#4E6090] text-[11px]">No active vision alerts</div>
            )}
          </div>
        </div>

        {/* Perimeter & Incident Feed */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[13px] font-bold text-[#E8EDF8]" >
              Security Incidents
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F04A4A]/12 text-[#F04A4A] border border-[#F04A4A]/25">
              {openIncidents} OPEN
            </span>
          </div>
          <div className="space-y-2">
            {incidents.filter((i) => i.status !== "resolved").slice(0, 4).map((inc) => {
              const sevColor = inc.severity === "critical" ? "#F04A4A" : inc.severity === "high" ? "#F97316" : "#F5A623";
              return (
                <div key={inc.id} className="p-2.5 rounded-[10px] bg-[#0F1A30]" style={{ borderLeft: `3px solid ${sevColor}` }}>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold" style={{ color: sevColor }}>{inc.title}</span>
                    <span
                      className="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                      style={{ background: `${sevColor}15`, color: sevColor }}
                    >
                      {inc.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] text-[#8A9BBF]">{inc.escalated_to || "Unassigned"}</span>
                    {inc.escalation_deadline && inc.status === "open" && (
                      <span className="flex items-center gap-1 text-[9px] text-[#F5A623]">
                        <Clock className="w-3 h-3" />
                        {Math.max(0, Math.round((new Date(inc.escalation_deadline).getTime() - Date.now()) / 60000))}m
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {incidents.filter((i) => i.status !== "resolved").length === 0 && (
              <div className="text-center py-6 text-[#4E6090] text-[11px]">No active security incidents</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

