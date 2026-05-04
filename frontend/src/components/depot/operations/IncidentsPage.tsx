"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Radar, Shield, AlertTriangle, MapPin } from "lucide-react";
import { SEV_COL, STA_COL } from "@/lib/depot-data";
import type { Incident } from "@/lib/depot-data";
import {
  getIncidents,
  getActiveBreaches,
  acknowledgeIncident,
  resolveIncident,
  type IncidentResponse,
  type BreachResponse,
} from "@/services/depotPerimeter";

type FilterType = "all" | "open" | "acknowledged" | "resolved" | "CRITICAL" | "HIGH" | "perimeter";
type ViewTab = "incidents" | "perimeter";

/** Map backend incidents to the UI Incident shape */
function mapBackendIncident(inc: IncidentResponse): Incident {
  const sevMap: Record<string, Incident["sev"]> = {
    critical: "CRITICAL",
    high: "HIGH",
    medium: "MEDIUM",
    low: "LOW",
  };
  const statusMap: Record<string, Incident["status"]> = {
    open: "open",
    acknowledged: "acknowledged",
    escalated: "acknowledged",
    resolved: "resolved",
  };
  return {
    id: inc.id,
    type: inc.title,
    sev: sevMap[inc.severity] || "MEDIUM",
    loc: inc.escalated_to ? `Escalated to ${inc.escalated_to}` : "Perimeter Zone",
    t: new Date(inc.created_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }),
    status: statusMap[inc.status] || "open",
    cam: inc.video_archive_ref ? "Evidence" : "—",
    desc: inc.description || inc.title,
    assignee: inc.acknowledged_by || inc.escalated_to || "—",
  };
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [breaches, setBreaches] = useState<BreachResponse[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [viewTab, setViewTab] = useState<ViewTab>("incidents");
  const [resolveModalId, setResolveModalId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  // Fetch real incidents from backend
  const fetchIncidents = useCallback(async () => {
    try {
      const backendIncidents = await getIncidents();
      setIncidents(backendIncidents.map(mapBackendIncident));
    } catch {
      // Keep empty — don't pad with stale mock data
    }
  }, []);

  const fetchBreaches = useCallback(async () => {
    try {
      const data = await getActiveBreaches();
      setBreaches(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    void fetchIncidents();
    void fetchBreaches();
    const interval = setInterval(() => {
      void fetchIncidents();
      void fetchBreaches();
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchIncidents, fetchBreaches]);

  const filtered = useMemo(() => incidents.filter((i) => {
    if (filter === "all") return true;
    if (filter === i.status) return true;
    if (filter === i.sev) return true;
    return false;
  }), [incidents, filter]);

  const cntOpen = useMemo(() => incidents.filter((i) => i.status === "open").length, [incidents]);
  const cntAck = useMemo(() => incidents.filter((i) => i.status === "acknowledged").length, [incidents]);
  const cntRes = useMemo(() => incidents.filter((i) => i.status === "resolved").length, [incidents]);
  const cntCrit = useMemo(() => incidents.filter((i) => i.sev === "CRITICAL").length, [incidents]);

  const acknowledge = async (id: string) => {
    // Prevent double-clicks
    if (acknowledging !== null) return;
    setAcknowledging(id);
    try {
      // Try backend first for UUID-like IDs
      if (id.includes("-") && id.length > 10) {
        try {
          await acknowledgeIncident(id, "Acknowledged from incident console");
          void fetchIncidents();
          return;
        } catch { /* fall through to local state */ }
      }
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: "acknowledged" as const, assignee: "Command Center" } : i
        )
      );
    } finally {
      setAcknowledging(null);
    }
  };

  const handleResolve = async () => {
    if (!resolveModalId || resolveNotes.length < 5 || resolving) return;
    setResolving(true);
    try {
      if (resolveModalId.includes("-") && resolveModalId.length > 10) {
        try {
          await resolveIncident(resolveModalId, resolveNotes);
          void fetchIncidents();
          setResolveModalId(null);
          setResolveNotes("");
          return;
        } catch { /* fall through */ }
      }
      setIncidents((prev) =>
        prev.map((i) =>
          i.id === resolveModalId ? { ...i, status: "resolved" as const } : i
        )
      );
      setResolveModalId(null);
      setResolveNotes("");
    } finally {
      setResolving(false);
    }
  };

  const filters: { label: string; value: FilterType; style?: string }[] = [
    { label: "All", value: "all" },
    { label: "Open", value: "open" },
    { label: "Acknowledged", value: "acknowledged" },
    { label: "Resolved", value: "resolved" },
    { label: "Critical", value: "CRITICAL", style: "border-[#EF4444] text-[#EF4444]" },
    { label: "High", value: "HIGH", style: "border-[#F97316] text-[#F97316]" },
  ];

  const BREACH_TYPE_LABELS: Record<string, string> = {
    unauthorized_entry: "Unauthorized Entry",
    loitering: "Loitering",
    forced_entry: "Forced Entry",
    after_hours: "After Hours",
    object_left: "Object Left Behind",
    unknown: "Unknown",
  };

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#E8EDF8]">
            Incidents & Alerts
          </h1>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            Live feed with severity tracking, escalation workflows, and perimeter breaches
          </p>
        </div>
        <button className="px-3.5 py-2 rounded-lg bg-[#E5521A] border-[#E5521A] text-white text-[11px] font-bold">
          + Report Incident
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { v: cntOpen, l: "Open", c: "#F5A623" },
          { v: cntAck, l: "Acknowledged", c: "#5B9BF5" },
          { v: cntRes, l: "Resolved", c: "#22D3A1" },
          { v: cntCrit, l: "Critical", c: "#F04A4A" },
        ].map((s) => (
          <div key={s.l} className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-3.5 text-center transition-all hover:border-[#2A3F68]">
            <div className="text-[26px] font-extrabold" style={{ color: s.c }}>
              {s.v}
            </div>
            <div className="text-[10px] text-[#8A9BBF] mt-1">{s.l}</div>
          </div>
        ))}
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 mb-4 bg-[#0F1A30] rounded-xl p-1 w-fit">
        <button
          onClick={() => setViewTab("incidents")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold transition-colors ${
            viewTab === "incidents"
              ? "bg-[#E5521A] text-white"
              : "text-[#8A9BBF] hover:text-[#E8EDF8]"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Incidents
        </button>
        <button
          onClick={() => setViewTab("perimeter")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold transition-colors ${
            viewTab === "perimeter"
              ? "bg-[#E5521A] text-white"
              : "text-[#8A9BBF] hover:text-[#E8EDF8]"
          }`}
        >
          <Radar className="w-3.5 h-3.5" />
          Perimeter Breaches
          {breaches.length > 0 && (
            <span className="ml-1 w-4 h-4 rounded-full bg-[#F04A4A] text-white text-[8px] flex items-center justify-center">
              {breaches.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Incidents Tab ── */}
      {viewTab === "incidents" && (
        <>
          {/* Filters */}
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                  filter === f.value
                    ? "border-[#E5521A] bg-[#E5521A]/10 text-[#E5521A]"
                    : f.style || "border-[#1E2F50] text-[#8A9BBF] hover:border-[#2A3F68] hover:text-[#E8EDF8]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Incident List */}
          <div className="flex flex-col gap-2.5">
            {filtered.map((i) => (
              <div
                key={i.id}
                className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
                style={{ borderLeftWidth: 4, borderLeftColor: SEV_COL[i.sev] }}
              >
                <div className="flex justify-between flex-wrap gap-1.5 mb-1.5">
                  <div>
                    <div className="text-[14px] font-bold text-[#E8EDF8]">{i.type}</div>
                    <div className="flex gap-1.5 items-center mt-1.5">
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                        style={{ background: `${SEV_COL[i.sev]}22`, color: SEV_COL[i.sev], borderColor: `${SEV_COL[i.sev]}44` }}
                      >
                        {i.sev}
                      </span>
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                        style={{ background: `${STA_COL[i.status]}22`, color: STA_COL[i.status], borderColor: `${STA_COL[i.status]}44` }}
                      >
                        {i.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[#4E6090]">{i.t}</div>
                    <div className="text-[10px] text-[#8A9BBF] mt-0.5">{i.cam !== "—" ? `📷 ${i.cam}` : ""}</div>
                  </div>
                </div>
                <div className="text-[12px] text-[#8A9BBF] mb-2 leading-relaxed">{i.desc}</div>
                <div className="text-[10px] text-[#4E6090]">📍 {i.loc} · 👤 {i.assignee}</div>
                <div className="flex gap-2 mt-2.5">
                  <button className="px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-bold hover:text-[#E5521A] hover:border-[#E5521A]/40 transition">
                    View Evidence
                  </button>
                  {i.status === "open" && (
                    <button
                      onClick={() => acknowledge(i.id)}
                      disabled={acknowledging === i.id}
                      className="px-3 py-1.5 rounded-lg bg-[#E5521A] text-white text-[11px] font-bold hover:bg-[#FF7A42] transition disabled:opacity-50"
                    >
                      {acknowledging === i.id ? "..." : "Take Action"}
                    </button>
                  )}
                  {i.status !== "resolved" && (
                    <button
                      onClick={() => { setResolveModalId(i.id); setResolveNotes(""); }}
                      disabled={acknowledging === i.id}
                      className="px-3 py-1.5 rounded-lg border border-[#22D3A1]/30 text-[#22D3A1] text-[11px] font-bold hover:bg-[#22D3A1]/10 transition disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Perimeter Breaches Tab ── */}
      {viewTab === "perimeter" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-[#F04A4A]" />
            <span className="text-[13px] font-bold text-[#E8EDF8]">Active Perimeter Breaches</span>
            <span className="text-[10px] text-[#8A9BBF]">— Real-time breach monitoring</span>
          </div>

          {breaches.length === 0 ? (
            <div className="text-center py-16">
              <Radar className="w-10 h-10 text-[#22D3A1] mx-auto mb-3 opacity-50" />
              <div className="text-[#22D3A1] text-[14px] font-bold">All Clear</div>
              <div className="text-[#4E6090] text-[12px] mt-1">No active perimeter breaches detected</div>
            </div>
          ) : (
            breaches.map((b) => {
              const sevColors: Record<string, string> = {
                critical: "#F04A4A", high: "#F97316", medium: "#F5A623", low: "#22D3A1",
              };
              const col = sevColors[b.severity] || "#8A9BBF";
              return (
                <div
                  key={b.id}
                  className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4"
                  style={{ borderLeftWidth: 4, borderLeftColor: col }}
                >
                  <div className="flex justify-between flex-wrap gap-2 mb-2">
                    <div>
                      <div className="text-[13px] font-bold text-[#E8EDF8]">
                        {BREACH_TYPE_LABELS[b.breach_type] || b.breach_type}
                      </div>
                      <div className="flex gap-1.5 mt-1.5">
                        <span
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                          style={{ background: `${col}22`, color: col, borderColor: `${col}44` }}
                        >
                          {b.severity.toUpperCase()}
                        </span>
                        {b.confidence && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#1E2F50] text-[#8A9BBF]">
                            {Math.round(b.confidence * 100)}% confidence
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-[#4E6090]">
                        {new Date(b.detected_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}
                      </div>
                      {b.camera_id && (
                        <div className="text-[10px] text-[#8A9BBF] mt-0.5">📷 {b.camera_id}</div>
                      )}
                    </div>
                  </div>
                  {b.notes && (
                    <div className="text-[12px] text-[#8A9BBF] mb-2">{b.notes}</div>
                  )}
                  <div className="flex items-center gap-1.5 text-[10px] text-[#4E6090]">
                    <MapPin className="w-3 h-3" />
                    Zone ID: {b.zone_id}
                    {b.alert_sent && (
                      <span className="ml-2 text-[#22D3A1]">✓ Alert sent</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModalId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setResolveModalId(null)}>
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-bold text-[#E8EDF8] mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>
              Resolve Incident
            </h3>
            <textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              placeholder="Resolution notes (min 5 characters)..."
              className="w-full h-24 bg-[#0F1A30] border border-[#1E2F50] rounded-lg p-3 text-[12px] text-[#E8EDF8] placeholder-[#4E6090] resize-none focus:border-[#22D3A1] focus:outline-none"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setResolveModalId(null)}
                className="px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolveNotes.length < 5 || resolving}
                className="px-4 py-1.5 rounded-lg bg-[#22D3A1] text-[#0D1526] text-[11px] font-bold disabled:opacity-40"
              >
                {resolving ? "Resolving..." : "Resolve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
