"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  Shield,
  User,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Incident {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  severity_score: number;
  status: string;
  source: string;
  zone: string | null;
  assigned_to: string | null;
  escalation_level: number;
  escalation_chain: { tier: string; assigned_at: string }[];
  escalation_deadline: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  resolution_steps: string[];
  created_at: string;
}

interface AuditEntry {
  id: string;
  action: string;
  actor: string | null;
  actor_role: string | null;
  previous_state: string | null;
  new_state: string | null;
  details: string | null;
  created_at: string;
}

interface Notification {
  id: string;
  channel: string;
  recipient: string | null;
  status: string;
  sent_at: string;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_INCIDENTS: Incident[] = [
  {
    id: "inc-001", title: "SLA Breach — Cold Chain Delivery", description: "Breach probability exceeded 95%. Client: ColdChain Inc. Temperature compliance SLA violated.",
    priority: "P1", severity_score: 1.0, status: "escalated", source: "sla_breach", zone: "Cold Storage",
    assigned_to: "Operations Manager", escalation_level: 1,
    escalation_chain: [
      { tier: "Shift Supervisor", assigned_at: new Date(Date.now() - 3600000).toISOString() },
      { tier: "Operations Manager", assigned_at: new Date(Date.now() - 1800000).toISOString() },
    ],
    escalation_deadline: new Date(Date.now() + 600000).toISOString(),
    acknowledged_at: null, resolved_at: null, resolution_notes: null, resolution_steps: [],
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "inc-002", title: "Unauthorized Vehicle at Inbound Gate", description: "LPR mismatch detected. Vehicle plate KA-05-XY-1234 not in approved list.",
    priority: "P2", severity_score: 0.75, status: "acknowledged", source: "perimeter", zone: "Inbound Gate",
    assigned_to: "Shift Supervisor", escalation_level: 0,
    escalation_chain: [{ tier: "Shift Supervisor", assigned_at: new Date(Date.now() - 1200000).toISOString() }],
    escalation_deadline: new Date(Date.now() + 300000).toISOString(),
    acknowledged_at: new Date(Date.now() - 600000).toISOString(), resolved_at: null, resolution_notes: null, resolution_steps: [],
    created_at: new Date(Date.now() - 1200000).toISOString(),
  },
  {
    id: "inc-003", title: "Forklift Equipment Malfunction", description: "Hydraulic pressure sensor reading below threshold on FORK-03.",
    priority: "P3", severity_score: 0.5, status: "open", source: "sensor", zone: "Dispatch Bay",
    assigned_to: "Shift Supervisor", escalation_level: 0,
    escalation_chain: [{ tier: "Shift Supervisor", assigned_at: new Date(Date.now() - 300000).toISOString() }],
    escalation_deadline: new Date(Date.now() + 3300000).toISOString(),
    acknowledged_at: null, resolved_at: null, resolution_notes: null, resolution_steps: [],
    created_at: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: "inc-004", title: "Dwell Time Alert — Truck TRK-1002", description: "Vehicle in staging area for 4h 30m. SLA threshold: 3h.",
    priority: "P2", severity_score: 0.75, status: "resolved", source: "alert", zone: "Staging Area",
    assigned_to: "Shift Supervisor", escalation_level: 0,
    escalation_chain: [{ tier: "Shift Supervisor", assigned_at: new Date(Date.now() - 7200000).toISOString() }],
    escalation_deadline: null,
    acknowledged_at: new Date(Date.now() - 5400000).toISOString(),
    resolved_at: new Date(Date.now() - 3600000).toISOString(),
    resolution_notes: "Vehicle dispatched to DOCK-A2. Loading completed.",
    resolution_steps: ["Contacted driver", "Assigned to available dock", "Loading completed", "Vehicle departed"],
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

const MOCK_AUDIT: Record<string, AuditEntry[]> = {
  "inc-001": [
    { id: "a1", action: "created_from_sla_breach", actor: "system", actor_role: "breach_detection_agent", previous_state: null, new_state: "open", details: "SLA: Cold Chain Delivery, Prob: 95%", created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: "a2", action: "notification_sent", actor: "system", actor_role: "system", previous_state: null, new_state: null, details: "Channel: in_app, Recipient: Shift Supervisor", created_at: new Date(Date.now() - 3590000).toISOString() },
    { id: "a3", action: "auto_escalated", actor: "system", actor_role: "escalation_agent", previous_state: "open", new_state: "escalated", details: "Escalated to tier 1: Operations Manager", created_at: new Date(Date.now() - 1800000).toISOString() },
    { id: "a4", action: "notification_sent", actor: "system", actor_role: "system", previous_state: null, new_state: null, details: "Channel: email, Recipient: Operations Manager", created_at: new Date(Date.now() - 1790000).toISOString() },
  ],
};

const MOCK_NOTIFICATIONS: Record<string, Notification[]> = {
  "inc-001": [
    { id: "n1", channel: "in_app", recipient: "Shift Supervisor", status: "read", sent_at: new Date(Date.now() - 3590000).toISOString() },
    { id: "n2", channel: "email", recipient: "Operations Manager", status: "delivered", sent_at: new Date(Date.now() - 1790000).toISOString() },
    { id: "n3", channel: "sms", recipient: "Operations Manager", status: "sent", sent_at: new Date(Date.now() - 1780000).toISOString() },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRI_COL: Record<string, { bg: string; text: string; label: string }> = {
  P1: { bg: "bg-red-500/15", text: "text-red-400", label: "P1 — Critical" },
  P2: { bg: "bg-orange-500/15", text: "text-orange-400", label: "P2 — High" },
  P3: { bg: "bg-amber-500/15", text: "text-amber-400", label: "P3 — Medium" },
  P4: { bg: "bg-blue-500/15", text: "text-blue-400", label: "P4 — Low" },
};

const STA_COL: Record<string, { bg: string; text: string }> = {
  open: { bg: "bg-red-500/15", text: "text-red-400" },
  acknowledged: { bg: "bg-amber-500/15", text: "text-amber-400" },
  escalated: { bg: "bg-orange-500/15", text: "text-orange-400" },
  in_progress: { bg: "bg-blue-500/15", text: "text-blue-400" },
  resolved: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  closed: { bg: "bg-gray-500/15", text: "text-gray-400" },
};

const CH_ICON: Record<string, string> = {
  in_app: "App", email: "Email", sms: "SMS", whatsapp: "WA", push: "Push",
};

function relTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EscalationTimeline({ chain }: { chain: { tier: string; assigned_at: string }[] }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {chain.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          {i > 0 && <ArrowRight className="w-3.5 h-3.5 text-[#4E6090]" />}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
            i === chain.length - 1 ? "border-[#E5521A]/40 bg-[#E5521A]/10" : "border-[#1E2F50] bg-[#0D1526]"
          }`}>
            <User className="w-3 h-3 text-[#8A9BBF]" />
            <span className="text-[10px] font-bold text-white">{step.tier}</span>
            <span className="text-[9px] text-[#4E6090]">{relTime(step.assigned_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResolutionSteps({ steps }: { steps: string[] }) {
  if (steps.length === 0) return null;
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#4E6090]">Resolution Steps</p>
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[#8A9BBF]">{step}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const TABS = ["Active Incidents", "Escalation Timeline", "Audit Trail", "Notifications"] as const;
type Tab = (typeof TABS)[number];

export default function EscalationFlowPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Active Incidents");
  const [incidents, setIncidents] = useState<Incident[]>(MOCK_INCIDENTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // Fetch from backend
  const fetchIncidents = useCallback(async () => {
    try {
      const { getActiveIncidents } = await import("@/services/depotOps");
      const data = await getActiveIncidents();
      if (data.length > 0) { setIncidents(data as Incident[]); return; }
    } catch { /* fallback */ }
  }, []);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  const fetchAudit = useCallback(async (id: string) => {
    try {
      const { getIncidentAudit } = await import("@/services/depotOps");
      const data = await getIncidentAudit(id);
      setAuditEntries(data as AuditEntry[]);
      return;
    } catch { /* fallback */ }
    setAuditEntries(MOCK_AUDIT[id] || []);
  }, []);

  const fetchNotifications = useCallback(async (id: string) => {
    try {
      const { getIncidentNotifications } = await import("@/services/depotOps");
      const data = await getIncidentNotifications(id);
      setNotifications(data as Notification[]);
      return;
    } catch { /* fallback */ }
    setNotifications(MOCK_NOTIFICATIONS[id] || []);
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchAudit(selectedId);
      fetchNotifications(selectedId);
    }
  }, [selectedId, fetchAudit, fetchNotifications]);

  const selected = incidents.find((i) => i.id === selectedId);

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // KPIs
  const open = incidents.filter((i) => i.status === "open").length;
  const escalated = incidents.filter((i) => i.status === "escalated").length;
  const p1Count = incidents.filter((i) => i.priority === "P1").length;
  const resolved = incidents.filter((i) => i.status === "resolved").length;

  return (
    <div className="min-h-screen bg-[#0D1526] text-white px-6 py-5 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incident Escalation</h1>
          <p className="text-sm text-gray-400 mt-0.5">F-069 to F-073 — Auto-escalation, severity classifier, Novu alerts, resolution workflows, audit trail</p>
        </div>
        <button onClick={() => { setRefreshing(true); fetchIncidents().then(() => setRefreshing(false)); }}
          className="flex items-center gap-2 rounded-lg border border-[#1E2F50] bg-[#14203A] px-3 py-2 text-sm hover:bg-[#1E2F50]">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-red-500/20 text-red-400"><AlertTriangle className="w-5 h-5" /></div>
          <div><p className="text-xs text-gray-400 uppercase tracking-wider">Open</p><p className="text-xl font-bold">{open}</p></div>
        </div>
        <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-orange-500/20 text-orange-400"><Zap className="w-5 h-5" /></div>
          <div><p className="text-xs text-gray-400 uppercase tracking-wider">Escalated</p><p className="text-xl font-bold">{escalated}</p></div>
        </div>
        <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-red-500/20 text-red-400"><Shield className="w-5 h-5" /></div>
          <div><p className="text-xs text-gray-400 uppercase tracking-wider">P1 Critical</p><p className="text-xl font-bold">{p1Count}</p></div>
        </div>
        <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-emerald-500/20 text-emerald-400"><CheckCircle2 className="w-5 h-5" /></div>
          <div><p className="text-xs text-gray-400 uppercase tracking-wider">Resolved</p><p className="text-xl font-bold">{resolved}</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[#1E2F50] bg-[#14203A] p-1 w-fit mb-6">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? "bg-[#E5521A] text-white shadow-sm" : "text-gray-400 hover:text-white"
            }`}>{tab}</button>
        ))}
      </div>

      {/* Incident List / Escalation Timeline */}
      {(activeTab === "Active Incidents" || activeTab === "Escalation Timeline") && (
        <div className="space-y-3">
          {incidents.map((inc) => {
            const pri = PRI_COL[inc.priority] || PRI_COL.P3;
            const sta = STA_COL[inc.status] || STA_COL.open;
            const isExpanded = expandedIds.has(inc.id);
            return (
              <div key={inc.id}
                className={`rounded-xl border bg-[#14203A] p-4 transition-all cursor-pointer ${
                  selectedId === inc.id ? "border-[#E5521A]" : "border-[#1E2F50] hover:border-[#2A3F68]"
                }`}
                style={{ borderLeftWidth: 4, borderLeftColor: inc.priority === "P1" ? "#ef4444" : inc.priority === "P2" ? "#f97316" : "#f59e0b" }}
                onClick={() => { setSelectedId(inc.id); toggle(inc.id); }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${pri.bg} ${pri.text}`}>{pri.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${sta.bg} ${sta.text}`}>{inc.status}</span>
                      {inc.zone && <span className="text-[10px] text-[#4E6090]">{inc.zone}</span>}
                    </div>
                    <h3 className="text-sm font-bold text-white mt-1.5">{inc.title}</h3>
                    {inc.description && <p className="text-xs text-[#8A9BBF] mt-0.5 line-clamp-2">{inc.description}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-[#4E6090]">{relTime(inc.created_at)}</p>
                    <p className="text-[10px] text-[#8A9BBF] mt-0.5">Tier {inc.escalation_level}</p>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-[#4E6090] mt-1 ml-auto" /> : <ChevronDown className="w-4 h-4 text-[#4E6090] mt-1 ml-auto" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-[#1E2F50] space-y-3">
                    {/* Escalation Timeline Diagram */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#4E6090] mb-2">Escalation Path</p>
                      <EscalationTimeline chain={inc.escalation_chain} />
                    </div>
                    {inc.escalation_deadline && inc.status !== "resolved" && (
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[#8A9BBF]">Next escalation: {formatTime(inc.escalation_deadline)}</span>
                      </div>
                    )}
                    {inc.assigned_to && (
                      <div className="flex items-center gap-2 text-xs">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[#8A9BBF]">Assigned to: <strong className="text-white">{inc.assigned_to}</strong></span>
                      </div>
                    )}
                    <ResolutionSteps steps={inc.resolution_steps} />
                    {inc.resolution_notes && (
                      <div className="rounded-lg bg-[#0D1526] border border-[#1E2F50] p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#4E6090] mb-1">Resolution Notes</p>
                        <p className="text-xs text-[#8A9BBF]">{inc.resolution_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Audit Trail Tab */}
      {activeTab === "Audit Trail" && (
        <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Audit Trail (F-073)</h3>
          {!selectedId ? (
            <p className="text-xs text-[#4E6090]">Select an incident above to view its audit trail.</p>
          ) : (
            <div className="space-y-0">
              {auditEntries.map((entry, i) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                      entry.action.includes("escalat") ? "bg-orange-400" :
                      entry.action.includes("resolv") ? "bg-emerald-400" :
                      entry.action.includes("creat") ? "bg-blue-400" :
                      entry.action.includes("notif") ? "bg-purple-400" :
                      "bg-gray-400"
                    }`} />
                    {i < auditEntries.length - 1 && <div className="w-0.5 flex-1 bg-[#1E2F50] min-h-[24px]" />}
                  </div>
                  <div className="pb-4 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white capitalize">{entry.action.replace(/_/g, " ")}</span>
                      {entry.new_state && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          STA_COL[entry.new_state]?.bg || "bg-gray-500/15"} ${STA_COL[entry.new_state]?.text || "text-gray-400"
                        }`}>{entry.new_state}</span>
                      )}
                      <span className="text-[10px] text-[#4E6090]">{formatTime(entry.created_at)}</span>
                    </div>
                    {entry.details && <p className="text-[11px] text-[#8A9BBF] mt-0.5">{entry.details}</p>}
                    <p className="text-[10px] text-[#4E6090] mt-0.5">By: {entry.actor_role || entry.actor || "system"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === "Notifications" && (
        <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Alert History (F-071)</h3>
          {!selectedId ? (
            <p className="text-xs text-[#4E6090]">Select an incident to view its notification history.</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n.id} className="flex items-center justify-between rounded-lg border border-[#1E2F50] bg-[#0D1526] p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                      <Bell className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{CH_ICON[n.channel] || n.channel}</p>
                      <p className="text-[10px] text-[#8A9BBF]">To: {n.recipient || "—"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      n.status === "read" ? "bg-emerald-500/15 text-emerald-400" :
                      n.status === "delivered" ? "bg-blue-500/15 text-blue-400" :
                      n.status === "failed" ? "bg-red-500/15 text-red-400" :
                      "bg-amber-500/15 text-amber-400"
                    }`}>{n.status}</span>
                    <p className="text-[10px] text-[#4E6090] mt-0.5">{relTime(n.sent_at)}</p>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && <p className="text-xs text-[#4E6090]">No notifications recorded.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
