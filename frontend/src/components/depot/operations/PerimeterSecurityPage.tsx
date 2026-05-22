"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  ShieldAlert,
  Eye,
  EyeOff,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Radar,
  Moon,
  Sun,
  Camera,
  Zap,
  X,
  ChevronDown,
} from "lucide-react";
import {
  getPerimeterZones,
  getActiveBreaches,
  getIncidents,
  acknowledgeIncident,
  resolveIncident,
  resolveBreach,
  configureNightVision,
  runSecurityAgent,
  type PerimeterZoneResponse,
  type BreachResponse,
  type IncidentResponse,
} from "@/services/depotPerimeter";
import { exportIncidentReport, downloadCsv } from "@/lib/exportUtils";

// ---------------------------------------------------------------------------
// Severity config
// ---------------------------------------------------------------------------

const SEV: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#F04A4A", bg: "rgba(240,74,74,0.1)", label: "CRITICAL" },
  high: { color: "#F97316", bg: "rgba(249,115,22,0.1)", label: "HIGH" },
  medium: { color: "#F5A623", bg: "rgba(245,166,35,0.1)", label: "MEDIUM" },
  low: { color: "#22D3A1", bg: "rgba(34,211,161,0.1)", label: "LOW" },
};

const ZONE_TYPE_COLORS: Record<string, string> = {
  restricted: "#F04A4A",
  controlled: "#F97316",
  hazardous: "#F5A623",
  loading: "#5B9BF5",
  general: "#22D3A1",
};

const BREACH_TYPE_LABELS: Record<string, string> = {
  unauthorized_entry: "Unauthorized Entry",
  loitering: "Loitering",
  forced_entry: "Forced Entry",
  after_hours: "After Hours",
  object_left: "Object Left Behind",
  unknown: "Unknown",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#F5A623",
  acknowledged: "#5B9BF5",
  escalated: "#F97316",
  resolved: "#22D3A1",
};

type TabType = "overview" | "breaches" | "incidents" | "zones";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PerimeterSecurityPage() {
  const [tab, setTab] = useState<TabType>("overview");
  const [zones, setZones] = useState<PerimeterZoneResponse[]>([]);
  const [breaches, setBreaches] = useState<BreachResponse[]>([]);
  const [incidents, setIncidents] = useState<IncidentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentRunning, setAgentRunning] = useState(false);

  // Acknowledge / resolve modals
  const [ackModal, setAckModal] = useState<string | null>(null);
  const [resolveModal, setResolveModal] = useState<{ id: string; type: "breach" | "incident" } | null>(null);
  const [reason, setReason] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [z, b, i] = await Promise.allSettled([
        getPerimeterZones(),
        getActiveBreaches(),
        getIncidents(),
      ]);
      if (z.status === "fulfilled") setZones(z.value);
      if (b.status === "fulfilled") setBreaches(b.value);
      if (i.status === "fulfilled") setIncidents(i.value);
    } catch {
      // fallback: keep existing state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => void fetchData(), 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Derived stats
  const activeBreaches = breaches.filter((b) => !b.resolved_at);
  const openIncidents = incidents.filter((i) => i.status === "open");
  const escalatedIncidents = incidents.filter((i) => i.status === "escalated");
  const resolvedIncidents = incidents.filter((i) => i.status === "resolved");
  const nightVisionZones = zones.filter((z) => z.is_active);

  const handleAcknowledge = async () => {
    if (!ackModal || reason.length < 5) return;
    try {
      await acknowledgeIncident(ackModal, reason);
      setAckModal(null);
      setReason("");
      void fetchData();
    } catch { /* keep modal open */ }
  };

  const handleResolve = async () => {
    if (!resolveModal || reason.length < 5) return;
    try {
      if (resolveModal.type === "incident") {
        await resolveIncident(resolveModal.id, reason);
      } else {
        await resolveBreach(resolveModal.id, reason);
      }
      setResolveModal(null);
      setReason("");
      void fetchData();
    } catch { /* keep modal open */ }
  };

  const handleRunAgent = async () => {
    setAgentRunning(true);
    try {
      await runSecurityAgent({ simulate_breach_count: 1 });
      void fetchData();
    } catch { /* ignore */ }
    setAgentRunning(false);
  };

  const tabs: { label: string; value: TabType; icon: React.ElementType }[] = [
    { label: "Overview", value: "overview", icon: Shield },
    { label: "Breaches", value: "breaches", icon: ShieldAlert },
    { label: "Incidents", value: "incidents", icon: AlertTriangle },
    { label: "Zones", value: "zones", icon: MapPin },
  ];

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      {/* Header */}
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
            Perimeter Security
          </h1>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            Zone monitoring, breach detection, and incident escalation
          </p>
        </div>
        <button
          onClick={handleRunAgent}
          disabled={agentRunning}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg theme-bg-accent text-white text-[11px] font-bold hover:bg-[var(--accent-hover)] transition disabled:opacity-50"
        >
          <Radar className="w-3.5 h-3.5" />
          {agentRunning ? "Scanning..." : "Run Security Agent"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        {[
          { v: zones.length, l: "Active Zones", c: "#5B9BF5", icon: MapPin },
          { v: activeBreaches.length, l: "Active Breaches", c: "#F04A4A", icon: ShieldAlert },
          { v: openIncidents.length, l: "Open Incidents", c: "#F5A623", icon: AlertTriangle },
          { v: escalatedIncidents.length, l: "Escalated", c: "#F97316", icon: Zap },
          { v: resolvedIncidents.length, l: "Resolved", c: "#22D3A1", icon: CheckCircle2 },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.l}
              className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-3.5 transition-all hover:border-[#2A3F68]"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-3.5 h-3.5" style={{ color: s.c }} />
                <span className="text-[10px] text-[#8A9BBF]">{s.l}</span>
              </div>
              <div className="text-[26px] font-extrabold" style={{ color: s.c, fontFamily: "'Syne', sans-serif" }}>
                {s.v}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                tab === t.value
                  ? "border-[var(--accent)] theme-bg-accent-subtle theme-text-nav-active"
                  : "border-[#1E2F50] text-[#8A9BBF] hover:border-[#2A3F68] hover:text-[#E8EDF8]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-16 text-[#4E6090] text-sm">Loading perimeter data...</div>
      ) : (
        <>
          {/* ─── OVERVIEW TAB ─── */}
          {tab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Zone Coverage Map */}
              <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
                <div className="flex justify-between items-center mb-3.5">
                  <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Zone Coverage
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#5B9BF5]/12 text-[#5B9BF5] border border-[#5B9BF5]/25">
                    {zones.length} ZONES
                  </span>
                </div>
                <div className="relative w-full h-[280px] bg-[#0F1A30] rounded-lg border border-[#1E2F50] overflow-hidden">
                  {/* Warehouse floor plan grid */}
                  <svg className="absolute inset-0 w-full h-full opacity-10">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <line key={`h${i}`} x1="0" y1={`${(i + 1) * 10}%`} x2="100%" y2={`${(i + 1) * 10}%`} stroke="#4E6090" strokeWidth="0.5" />
                    ))}
                    {Array.from({ length: 10 }).map((_, i) => (
                      <line key={`v${i}`} x1={`${(i + 1) * 10}%`} y1="0" x2={`${(i + 1) * 10}%`} y2="100%" stroke="#4E6090" strokeWidth="0.5" />
                    ))}
                  </svg>
                  {/* Zone markers */}
                  {zones.map((zone, i) => {
                    const x = 15 + (i % 3) * 30;
                    const y = 20 + Math.floor(i / 3) * 40;
                    const color = ZONE_TYPE_COLORS[zone.zone_type] || "#5B9BF5";
                    const hasActiveBreach = activeBreaches.some((b) => b.zone_id === zone.id);
                    return (
                      <div
                        key={zone.id}
                        className="absolute flex flex-col items-center"
                        style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
                      >
                        {hasActiveBreach && (
                          <div className="absolute w-10 h-10 rounded-full animate-ping" style={{ background: `${color}20` }} />
                        )}
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center border"
                          style={{ background: `${color}20`, borderColor: `${color}40` }}
                        >
                          <Shield className="w-4 h-4" style={{ color }} />
                        </div>
                        <span className="text-[8px] text-[#8A9BBF] mt-1 whitespace-nowrap max-w-[80px] truncate text-center">
                          {zone.name}
                        </span>
                        {hasActiveBreach && (
                          <span className="text-[7px] font-bold text-[#F04A4A] animate-pulse">BREACH</span>
                        )}
                      </div>
                    );
                  })}
                  {zones.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-[#4E6090] text-xs">
                      No perimeter zones configured
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Breach Events */}
              <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
                <div className="flex justify-between items-center mb-3.5">
                  <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Recent Breaches
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F04A4A]/12 text-[#F04A4A] border border-[#F04A4A]/25">
                    {activeBreaches.length} ACTIVE
                  </span>
                </div>
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {breaches.slice(0, 8).map((b) => {
                    const sev = SEV[b.severity] || SEV.medium;
                    const zone = zones.find((z) => z.id === b.zone_id);
                    return (
                      <div
                        key={b.id}
                        className="p-2.5 rounded-[10px] bg-[#0F1A30] hover:bg-[var(--accent-subtle)] transition-colors"
                        style={{ borderLeft: `3px solid ${sev.color}` }}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold" style={{ color: sev.color }}>
                            {BREACH_TYPE_LABELS[b.breach_type] || b.breach_type}
                          </span>
                          <span className="text-[9px] text-[#4E6090]">
                            {new Date(b.detected_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[10px] text-[#8A9BBF]">
                            {zone?.name || "Unknown Zone"}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {b.confidence && (
                              <span className="text-[9px] text-[#4E6090]">
                                {(b.confidence * 100).toFixed(0)}%
                              </span>
                            )}
                            <span
                              className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: sev.bg, color: sev.color }}
                            >
                              {sev.label}
                            </span>
                            {b.resolved_at ? (
                              <CheckCircle2 className="w-3 h-3 text-[#22D3A1]" />
                            ) : (
                              <button
                                onClick={() => { setResolveModal({ id: b.id, type: "breach" }); setReason(""); }}
                                className="text-[9px] text-[#5B9BF5] hover:theme-text-nav-active transition"
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {breaches.length === 0 && (
                    <div className="text-center py-8 text-[#4E6090] text-xs">No breach events recorded</div>
                  )}
                </div>
              </div>

              {/* Active Incidents Feed */}
              <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px] lg:col-span-2">
                <div className="flex justify-between items-center mb-3.5">
                  <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Active Incidents
                  </span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F5A623]/12 text-[#F5A623] border border-[#F5A623]/25">
                    {openIncidents.length + escalatedIncidents.length} ACTIVE
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {incidents.filter((i) => i.status !== "resolved").slice(0, 6).map((inc) => {
                    const sev = SEV[inc.severity] || SEV.medium;
                    const statusColor = STATUS_COLORS[inc.status] || "#8A9BBF";
                    const deadline = inc.escalation_deadline ? new Date(inc.escalation_deadline) : null;
                    const now = new Date();
                    const minutesLeft = deadline ? Math.max(0, Math.round((deadline.getTime() - now.getTime()) / 60000)) : null;
                    return (
                      <div
                        key={inc.id}
                        className="p-3.5 rounded-[12px] bg-[#0F1A30] border border-[#1E2F50] hover:border-[#2A3F68] transition"
                        style={{ borderLeftWidth: 4, borderLeftColor: sev.color }}
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <div className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                            {inc.title}
                          </div>
                          <div className="flex gap-1">
                            <span
                              className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border"
                              style={{ background: `${sev.color}22`, color: sev.color, borderColor: `${sev.color}44` }}
                            >
                              {sev.label}
                            </span>
                            <span
                              className="text-[8px] font-bold px-1.5 py-0.5 rounded-full border"
                              style={{ background: `${statusColor}22`, color: statusColor, borderColor: `${statusColor}44` }}
                            >
                              {inc.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-[#8A9BBF] mb-2 leading-relaxed line-clamp-2">
                          {inc.description}
                        </p>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 text-[10px] text-[#4E6090]">
                            {inc.escalated_to && (
                              <span>Escalated to: <span className="text-[#8A9BBF]">{inc.escalated_to}</span></span>
                            )}
                            {minutesLeft !== null && inc.status === "open" && (
                              <span className="flex items-center gap-1 text-[#F5A623]">
                                <Clock className="w-3 h-3" />
                                {minutesLeft}m left
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            {inc.status === "open" && (
                              <button
                                onClick={() => { setAckModal(inc.id); setReason(""); }}
                                className="px-2 py-1 rounded-md theme-bg-accent text-white text-[10px] font-bold hover:bg-[var(--accent-hover)] transition"
                              >
                                Acknowledge
                              </button>
                            )}
                            {(inc.status === "open" || inc.status === "acknowledged" || inc.status === "escalated") && (
                              <button
                                onClick={() => { setResolveModal({ id: inc.id, type: "incident" }); setReason(""); }}
                                className="px-2 py-1 rounded-md border border-[#22D3A1]/30 text-[#22D3A1] text-[10px] font-bold hover:bg-[#22D3A1]/10 transition"
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {incidents.filter((i) => i.status !== "resolved").length === 0 && (
                    <div className="col-span-2 text-center py-8 text-[#4E6090] text-xs">
                      No active incidents — perimeter secure
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── BREACHES TAB ─── */}
          {tab === "breaches" && (
            <div className="flex flex-col gap-2.5">
              {breaches.map((b) => {
                const sev = SEV[b.severity] || SEV.medium;
                const zone = zones.find((z) => z.id === b.zone_id);
                return (
                  <div
                    key={b.id}
                    className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                    style={{ borderLeftWidth: 4, borderLeftColor: sev.color }}
                  >
                    <div className="flex justify-between flex-wrap gap-1.5 mb-1.5">
                      <div>
                        <div className="text-[14px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                          {BREACH_TYPE_LABELS[b.breach_type] || b.breach_type}
                        </div>
                        <div className="flex gap-1.5 items-center mt-1.5">
                          <span
                            className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                            style={{ background: `${sev.color}22`, color: sev.color, borderColor: `${sev.color}44` }}
                          >
                            {sev.label}
                          </span>
                          {b.resolved_at ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-[#22D3A1]/10 text-[#22D3A1] border-[#22D3A1]/30">
                              RESOLVED
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/30">
                              ACTIVE
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-[#4E6090]">
                          {new Date(b.detected_at).toLocaleString()}
                        </div>
                        {b.confidence && (
                          <div className="text-[10px] text-[#8A9BBF] mt-0.5">
                            Confidence: {(b.confidence * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-[12px] text-[#8A9BBF] mb-2">
                      Zone: {zone?.name || "Unknown"} {b.notes && `· ${b.notes}`}
                    </div>
                    {b.resolution_notes && (
                      <div className="text-[11px] text-[#22D3A1] mb-2">
                        Resolution: {b.resolution_notes}
                      </div>
                    )}
                    <div className="flex gap-2">
                      {b.snapshot_ref && (
                        <button className="px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-bold hover:theme-text-nav-active hover:border-[var(--accent-border)] transition">
                          View Snapshot
                        </button>
                      )}
                      {!b.resolved_at && (
                        <button
                          onClick={() => { setResolveModal({ id: b.id, type: "breach" }); setReason(""); }}
                          className="px-3 py-1.5 rounded-lg bg-[#22D3A1] text-[#0D1526] text-[11px] font-bold hover:bg-[#34E4B0] transition"
                        >
                          Resolve Breach
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {breaches.length === 0 && (
                <div className="text-center py-16 text-[#4E6090] text-sm">No breach events recorded</div>
              )}
            </div>
          )}

          {/* ─── INCIDENTS TAB ─── */}
          {tab === "incidents" && (
            <div className="flex flex-col gap-2.5">
              {incidents.length > 0 && (
                <div className="flex gap-2 mb-1">
                  <button
                    onClick={() => exportIncidentReport(incidents.map((i) => ({
                      id: i.id, title: i.title, severity: i.severity, status: i.status,
                      description: i.description, escalated_to: i.escalated_to,
                      created_at: i.created_at, resolved_at: i.resolved_at,
                      resolution_notes: i.resolution_notes,
                    })))}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-[#1E2F50] text-[#8A9BBF] hover:border-[var(--accent-border)] hover:theme-text-nav-active transition"
                  >
                    Export PDF
                  </button>
                  <button
                    onClick={() => downloadCsv(
                      `incidents-${new Date().toISOString().slice(0, 10)}.csv`,
                      ["ID", "Title", "Severity", "Status", "Escalated To", "Created", "Resolved"],
                      incidents.map((i) => [
                        i.id.slice(0, 8), i.title, i.severity, i.status,
                        i.escalated_to || "", new Date(i.created_at).toLocaleString(),
                        i.resolved_at ? new Date(i.resolved_at).toLocaleString() : "",
                      ]),
                    )}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-[#1E2F50] text-[#8A9BBF] hover:border-[#22D3A1]/30 hover:text-[#22D3A1] transition"
                  >
                    Export CSV
                  </button>
                </div>
              )}
              {incidents.map((inc) => {
                const sev = SEV[inc.severity] || SEV.medium;
                const statusColor = STATUS_COLORS[inc.status] || "#8A9BBF";
                const deadline = inc.escalation_deadline ? new Date(inc.escalation_deadline) : null;
                const now = new Date();
                const minutesLeft = deadline ? Math.max(0, Math.round((deadline.getTime() - now.getTime()) / 60000)) : null;
                return (
                  <div
                    key={inc.id}
                    className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                    style={{ borderLeftWidth: 4, borderLeftColor: sev.color }}
                  >
                    <div className="flex justify-between flex-wrap gap-1.5 mb-1.5">
                      <div>
                        <div className="text-[14px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                          {inc.title}
                        </div>
                        <div className="flex gap-1.5 items-center mt-1.5">
                          <span
                            className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                            style={{ background: `${sev.color}22`, color: sev.color, borderColor: `${sev.color}44` }}
                          >
                            {sev.label}
                          </span>
                          <span
                            className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                            style={{ background: `${statusColor}22`, color: statusColor, borderColor: `${statusColor}44` }}
                          >
                            {inc.status.toUpperCase()}
                          </span>
                          {inc.escalation_level > 0 && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-[#F97316]/10 text-[#F97316] border-[#F97316]/30">
                              ESC L{inc.escalation_level}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-[#4E6090]">
                          {new Date(inc.created_at).toLocaleString()}
                        </div>
                        {inc.escalated_to && (
                          <div className="text-[10px] text-[#8A9BBF] mt-0.5">
                            Assigned: {inc.escalated_to}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-[12px] text-[#8A9BBF] mb-2 leading-relaxed">{inc.description}</div>
                    {minutesLeft !== null && inc.status === "open" && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <Clock className="w-3.5 h-3.5 text-[#F5A623]" />
                        <span className="text-[11px] text-[#F5A623] font-bold">
                          Auto-escalation in {minutesLeft} min
                        </span>
                        <div className="flex-1 h-1 bg-[#1E2F50] rounded-full overflow-hidden ml-2">
                          <div
                            className="h-full rounded-full bg-[#F5A623] transition-all"
                            style={{ width: `${Math.max(0, 100 - (minutesLeft / 5) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {inc.resolution_notes && (
                      <div className="text-[11px] text-[#22D3A1] mb-2">Resolution: {inc.resolution_notes}</div>
                    )}
                    <div className="flex gap-2 mt-2">
                      {inc.video_archive_ref && (
                        <button className="px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-bold hover:theme-text-nav-active hover:border-[var(--accent-border)] transition">
                          View Evidence
                        </button>
                      )}
                      {inc.status === "open" && (
                        <button
                          onClick={() => { setAckModal(inc.id); setReason(""); }}
                          className="px-3 py-1.5 rounded-lg theme-bg-accent text-white text-[11px] font-bold hover:bg-[var(--accent-hover)] transition"
                        >
                          Acknowledge
                        </button>
                      )}
                      {inc.status !== "resolved" && (
                        <button
                          onClick={() => { setResolveModal({ id: inc.id, type: "incident" }); setReason(""); }}
                          className="px-3 py-1.5 rounded-lg bg-[#22D3A1] text-[#0D1526] text-[11px] font-bold hover:bg-[#34E4B0] transition"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {incidents.length === 0 && (
                <div className="text-center py-16 text-[#4E6090] text-sm">No incidents recorded</div>
              )}
            </div>
          )}

          {/* ─── ZONES TAB ─── */}
          {tab === "zones" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {zones.map((zone) => {
                const typeColor = ZONE_TYPE_COLORS[zone.zone_type] || "#5B9BF5";
                const zoneBreaches = activeBreaches.filter((b) => b.zone_id === zone.id);
                return (
                  <div
                    key={zone.id}
                    className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 transition-all hover:border-[#2A3F68]"
                  >
                    <div className="flex justify-between items-start mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center border"
                          style={{ background: `${typeColor}15`, borderColor: `${typeColor}30` }}
                        >
                          <Shield className="w-4 h-4" style={{ color: typeColor }} />
                        </div>
                        <div>
                          <div className="text-[14px] font-bold text-[#E8EDF8]">{zone.name}</div>
                          <div className="text-[10px] text-[#8A9BBF]">{zone.description || "No description"}</div>
                        </div>
                      </div>
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                        style={{ background: `${typeColor}15`, color: typeColor, borderColor: `${typeColor}30` }}
                      >
                        {zone.zone_type.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2.5">
                      <div className="bg-[#0F1A30] rounded-lg p-2 text-center">
                        <div className="text-[10px] text-[#4E6090]">Severity</div>
                        <div className="text-[12px] font-bold" style={{ color: (SEV[zone.alert_severity] || SEV.medium).color }}>
                          {zone.alert_severity.toUpperCase()}
                        </div>
                      </div>
                      <div className="bg-[#0F1A30] rounded-lg p-2 text-center">
                        <div className="text-[10px] text-[#4E6090]">Night Vision</div>
                        <div className="flex items-center justify-center gap-1">
                          {zone.alert_on_entry ? (
                            <Moon className="w-3 h-3 text-[#A78BFA]" />
                          ) : (
                            <Sun className="w-3 h-3 text-[#F5A623]" />
                          )}
                          <span className="text-[11px] text-[#8A9BBF]">
                            {zone.alert_on_entry ? "On" : "Off"}
                          </span>
                        </div>
                      </div>
                      <div className="bg-[#0F1A30] rounded-lg p-2 text-center">
                        <div className="text-[10px] text-[#4E6090]">Breaches</div>
                        <div className={`text-[12px] font-bold ${zoneBreaches.length > 0 ? "text-[#F04A4A]" : "text-[#22D3A1]"}`}>
                          {zoneBreaches.length}
                        </div>
                      </div>
                    </div>
                    {zone.camera_id && (
                      <div className="flex items-center gap-1.5 text-[10px] text-[#4E6090]">
                        <Camera className="w-3 h-3" />
                        Camera linked: {zone.camera_id.slice(0, 8)}...
                      </div>
                    )}
                  </div>
                );
              })}
              {zones.length === 0 && (
                <div className="col-span-2 text-center py-16 text-[#4E6090] text-sm">
                  No perimeter zones configured
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── ACKNOWLEDGE MODAL ─── */}
      {ackModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setAckModal(null)}>
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[16px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                Acknowledge Incident
              </h3>
              <button onClick={() => setAckModal(null)} className="text-[#4E6090] hover:text-[#E8EDF8] transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the action being taken (min 5 characters)..."
              className="w-full h-24 bg-[#0F1A30] border border-[#1E2F50] rounded-lg p-3 text-[12px] text-[#E8EDF8] placeholder-[#4E6090] resize-none focus:border-[var(--accent)] focus:outline-none"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setAckModal(null)}
                className="px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledge}
                disabled={reason.length < 5}
                className="px-4 py-1.5 rounded-lg theme-bg-accent text-white text-[11px] font-bold disabled:opacity-40"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── RESOLVE MODAL ─── */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setResolveModal(null)}>
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[16px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                Resolve {resolveModal.type === "incident" ? "Incident" : "Breach"}
              </h3>
              <button onClick={() => setResolveModal(null)} className="text-[#4E6090] hover:text-[#E8EDF8] transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Resolution notes (min 5 characters)..."
              className="w-full h-24 bg-[#0F1A30] border border-[#1E2F50] rounded-lg p-3 text-[12px] text-[#E8EDF8] placeholder-[#4E6090] resize-none focus:border-[#22D3A1] focus:outline-none"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setResolveModal(null)}
                className="px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={reason.length < 5}
                className="px-4 py-1.5 rounded-lg bg-[#22D3A1] text-[#0D1526] text-[11px] font-bold disabled:opacity-40"
              >
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
