"use client";

import { useState, useEffect, useCallback } from "react";
import { INCIDENTS as MOCK_INCIDENTS, SEV_COL, STA_COL } from "@/lib/depot-data";
import type { Incident } from "@/lib/depot-data";
import {
  getIncidents,
  acknowledgeIncident,
  resolveIncident,
  type IncidentResponse,
} from "@/services/depotPerimeter";

type FilterType = "all" | "open" | "acknowledged" | "resolved" | "CRITICAL" | "HIGH";

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
  const [incidents, setIncidents] = useState<Incident[]>(MOCK_INCIDENTS);
  const [filter, setFilter] = useState<FilterType>("all");
  const [resolveModalId, setResolveModalId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  // Fetch real incidents from backend and merge with mock data
  const fetchIncidents = useCallback(async () => {
    try {
      const backendIncidents = await getIncidents();
      const mapped = backendIncidents.map(mapBackendIncident);
      // Merge: backend incidents first, then mock data for non-overlapping IDs
      const backendIds = new Set(mapped.map((i) => i.id));
      const merged = [...mapped, ...MOCK_INCIDENTS.filter((m) => !backendIds.has(m.id))];
      setIncidents(merged);
    } catch {
      // Fallback to mock data
      setIncidents(MOCK_INCIDENTS);
    }
  }, []);

  useEffect(() => {
    void fetchIncidents();
    const interval = setInterval(() => void fetchIncidents(), 20000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  const filtered = incidents.filter((i) => {
    if (filter === "all") return true;
    if (filter === i.status) return true;
    if (filter === i.sev) return true;
    return false;
  });

  const cntOpen = incidents.filter((i) => i.status === "open").length;
  const cntAck = incidents.filter((i) => i.status === "acknowledged").length;
  const cntRes = incidents.filter((i) => i.status === "resolved").length;
  const cntCrit = incidents.filter((i) => i.sev === "CRITICAL").length;

  const acknowledge = async (id: string) => {
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
  };

  const handleResolve = async () => {
    if (!resolveModalId || resolveNotes.length < 5) return;
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
  };

  const filters: { label: string; value: FilterType; style?: string }[] = [
    { label: "All", value: "all" },
    { label: "Open", value: "open" },
    { label: "Acknowledged", value: "acknowledged" },
    { label: "Resolved", value: "resolved" },
    { label: "Critical", value: "CRITICAL", style: "border-[#EF4444] text-[#EF4444]" },
    { label: "High", value: "HIGH", style: "border-[#F97316] text-[#F97316]" },
  ];

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
            Incidents & Alerts
          </h1>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            Live feed with severity tracking and escalation workflows
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
            <div className="text-[26px] font-extrabold" style={{ color: s.c, fontFamily: "'Syne', sans-serif" }}>
              {s.v}
            </div>
            <div className="text-[10px] text-[#8A9BBF] mt-1">{s.l}</div>
          </div>
        ))}
      </div>

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
                <div className="text-[14px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                  {i.type}
                </div>
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
                  className="px-3 py-1.5 rounded-lg bg-[#E5521A] text-white text-[11px] font-bold hover:bg-[#FF7A42] transition"
                >
                  Take Action
                </button>
              )}
              {i.status !== "resolved" && (
                <button
                  onClick={() => { setResolveModalId(i.id); setResolveNotes(""); }}
                  className="px-3 py-1.5 rounded-lg border border-[#22D3A1]/30 text-[#22D3A1] text-[11px] font-bold hover:bg-[#22D3A1]/10 transition"
                >
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

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
                disabled={resolveNotes.length < 5}
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
