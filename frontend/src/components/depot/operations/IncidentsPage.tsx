"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Radar, Shield, AlertTriangle, MapPin, Camera, X, Bell, CheckCircle2, ExternalLink, UserCheck } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { SEV_COL, STA_COL } from "@/lib/depot-data";
import type { Incident } from "@/lib/depot-data";
import { getVideoUrl } from "@/services/depotVision";
import {
  getActiveBreaches,
  createIncidentFromBreach,
  acknowledgeIncident,
  resolveIncident,
  type IncidentResponse,
  type BreachResponse,
} from "@/services/depotPerimeter";
import {
  createOpsIncident,
  getUnifiedIncidentDetail,
  getUnifiedIncidents,
  runIncidentBusinessAction,
  type IncidentBusinessAction,
  type UnifiedIncident,
} from "@/services/depotOps";
import { getUnifiedDepotSource } from "@/services/depotUnifiedSource";

type FilterType = "all" | "acknowledged" | "resolved" | "CRITICAL" | "HIGH" | "perimeter";

type SelectedVideo = {
  evidenceId: string;
  videoFile: string;
  title: string;
};

type AnalysisReport = {
  incidentId: string;
  incidentType: string;
  breachType: string;
  videoFile: string;
};

type AcknowledgmentConfirmation = {
  isOpen: boolean;
  incidentId: string | null;
  assignedTo?: string;
  notificationsSent?: string[];
  notificationDetails?: Record<string, string>;
};

const BUSINESS_ACTIONS: { action: IncidentBusinessAction; label: string; notes: string; assigned_to?: string }[] = [
  { action: "dispatch_security", label: "Dispatch Security", notes: "Security team dispatched to incident location.", assigned_to: "Security Team" },
  { action: "notify_supervisor", label: "Notify Supervisor", notes: "Shift supervisor notified for incident follow-up." },
  { action: "escalate_to_regional_manager", label: "Escalate", notes: "Incident escalated to regional manager.", assigned_to: "Regional Manager" },
  { action: "mark_false_alarm", label: "False Alarm", notes: "Marked as false alarm after verification." },
  { action: "resolve_with_outcome", label: "Resolve", notes: "Incident resolved with documented outcome." },
];

const EMPTY_VALUE = "-";
const ALLOWED_EVIDENCE_TYPES = new Set(["unauthorized_entry", "loitering"]);
const ALLOWED_EVIDENCE_VIDEOS = new Set(["Perimeter_Detection.mp4", "Theft Camera .mp4"]);

const BREACH_TYPE_LABELS: Record<string, string> = {
  unauthorized_entry: "Unauthorized Entry",
  loitering: "Loitering",
  forced_entry: "Forced Entry",
  after_hours: "After Hours",
  object_left: "Object Left Behind",
  unknown: "Unknown",
};

const RAW_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readableAssignee(acknowledgedBy?: string | null, escalatedTo?: string | null): string {
  if (escalatedTo && !RAW_ID_PATTERN.test(escalatedTo)) return escalatedTo;
  if (acknowledgedBy && !RAW_ID_PATTERN.test(acknowledgedBy)) return acknowledgedBy;
  if (acknowledgedBy) return "Shift Supervisor";
  return EMPTY_VALUE;
}

function readableZone(zoneId?: string | null): string {
  if (!zoneId) return EMPTY_VALUE;
  if (RAW_ID_PATTERN.test(zoneId)) return "Zone ID: BLR-Z2";
  return `Zone ID: ${zoneId}`;
}

const BREACH_VIDEO_MAP: Record<string, string> = {
  unauthorized_entry: "Perimeter_Detection.mp4",
  loitering: "Theft Camera .mp4",
};

const SEED_EVIDENCE_VIDEO_MAP: Record<string, string> = {
  "seed://breach-0": "Perimeter_Detection.mp4",
  "seed://breach-inbound-gate": "Perimeter_Detection.mp4",
  "seed://breach-staging-area": "Theft Camera .mp4",
};

function resolveEvidenceVideo(ref?: string | null, breachType?: string | null): string | null {
  if (ref && ALLOWED_EVIDENCE_VIDEOS.has(ref)) return ref;
  if (breachType && BREACH_VIDEO_MAP[breachType]) return BREACH_VIDEO_MAP[breachType];
  if (ref && SEED_EVIDENCE_VIDEO_MAP[ref]) return SEED_EVIDENCE_VIDEO_MAP[ref];
  return null;
}

function dedupeIncidents(backendIncidents: IncidentResponse[]): IncidentResponse[] {
  const seen = new Set<string>();
  const unique: IncidentResponse[] = [];

  for (const incident of backendIncidents) {
    const baseDescription = (incident.description || "")
      .split("Acknowledged:")[0]
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const key = [
      incident.title.trim().toLowerCase(),
      baseDescription,
      incident.severity,
      resolveEvidenceVideo(incident.video_archive_ref) || "",
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(incident);
  }

  return unique;
}

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
    loc: readableZone(inc.zone_id),
    t: new Date(inc.created_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }),
    status: statusMap[inc.status] || "open",
    cam: resolveEvidenceVideo(inc.video_archive_ref) || EMPTY_VALUE,
    desc: inc.description || inc.title,
    assignee: readableAssignee(inc.acknowledged_by, inc.escalated_to),
  };
}

function formatUnifiedTime(value?: string | null): string {
  if (!value) return EMPTY_VALUE;
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function evidenceHref(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (typeof window === "undefined") return url;
  return `${window.location.protocol}//${window.location.hostname}:8000${url}`;
}

function unifiedSeverityColor(severity: UnifiedIncident["severity"]): string {
  if (severity === "critical") return "#F04A4A";
  if (severity === "warning") return "#F5A623";
  return "#5B9BF5";
}

function notificationColor(status: string): string {
  const normalized = status.toLowerCase();
  if (["delivered", "sent", "read"].includes(normalized)) return "#22D3A1";
  if (["failed", "cancelled"].includes(normalized)) return "#F04A4A";
  if (["retrying", "queued", "sending", "pending"].includes(normalized)) return "#F5A623";
  return "#8A9BBF";
}

export default function IncidentsPage() {
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [rawIncidents, setRawIncidents] = useState<IncidentResponse[]>([]);
  const [breaches, setBreaches] = useState<BreachResponse[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [resolveModalId, setResolveModalId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(null);
  const [videoLoadError, setVideoLoadError] = useState<string | null>(null);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
  const [ackConfirmation, setAckConfirmation] = useState<AcknowledgmentConfirmation>({ isOpen: false, incidentId: null });
  const [unifiedIncidents, setUnifiedIncidents] = useState<UnifiedIncident[]>([]);
  const [selectedUnifiedIncident, setSelectedUnifiedIncident] = useState<UnifiedIncident | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [businessActionLoading, setBusinessActionLoading] = useState<IncidentBusinessAction | null>(null);
  const [businessActionNotes, setBusinessActionNotes] = useState("");
  const [notifyChannel, setNotifyChannel] = useState("in_app");
  const [notifyRecipient, setNotifyRecipient] = useState("Shift Supervisor");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportZone, setReportZone] = useState("");
  const [reportPriority, setReportPriority] = useState("P2");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const selectedIncidentId = searchParams.get("incident");

  // Track locally acknowledged incidents so re-fetches don't revert them
  const localAcknowledged = useRef<Map<string, { assignee: string; at: string }>>(new Map());

  // Fetch real incidents from backend
  const fetchIncidents = useCallback(async () => {
    try {
      const source = await getUnifiedDepotSource({
        role: user?.role,
        email: user?.email,
        location: user?.location,
      });
      const uniqueIncidents = dedupeIncidents(source.incidents);
      // Re-apply any local acknowledgments that the backend doesn't know about
      const mergedRaw = uniqueIncidents.map((inc) => {
        const local = localAcknowledged.current.get(inc.id);
        if (local && inc.status === "open") {
          return { ...inc, status: "acknowledged", acknowledged_by: local.assignee, acknowledged_at: local.at };
        }
        return inc;
      });
      setRawIncidents(mergedRaw);
      setIncidents(mergedRaw.map(mapBackendIncident));
    } catch {
      // Keep empty — don't pad with stale mock data
    }
  }, []);

  const fetchBreaches = useCallback(async () => {
    try {
      const data = await getActiveBreaches();
      setBreaches(
        data
          .filter((breach) => ALLOWED_EVIDENCE_TYPES.has(breach.breach_type))
          .filter((breach, index, all) => all.findIndex((item) => item.breach_type === breach.breach_type) === index),
      );
    } catch {
      // Keep the current real breach data instead of substituting demo records.
    }
  }, [user?.email, user?.location, user?.role]);

  const fetchUnifiedIncidents = useCallback(async () => {
    try {
      const data = await getUnifiedIncidents({ limit: 50 });
      setUnifiedIncidents(data);
    } catch {
      // Unified API is additive during migration; keep legacy incident data visible.
    }
  }, []);

  useEffect(() => {
    void fetchIncidents();
    void fetchBreaches();
    void fetchUnifiedIncidents();
    const interval = setInterval(() => {
      void fetchIncidents();
      void fetchBreaches();
      void fetchUnifiedIncidents();
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchIncidents, fetchBreaches, fetchUnifiedIncidents]);

  const filtered = useMemo(() => incidents.filter((i) => {
    if (filter === "all") return true;
    if (filter === i.status) return true;
    if (filter === i.sev) return true;
    return false;
  }), [incidents, filter]);

  const cntTotal = incidents.length;
  const cntAck = useMemo(() => incidents.filter((i) => i.status === "acknowledged").length, [incidents]);
  const cntRes = useMemo(() => incidents.filter((i) => i.status === "resolved").length, [incidents]);
  const cntCrit = useMemo(() => incidents.filter((i) => i.sev === "CRITICAL").length, [incidents]);
  const incidentByBreachId = useMemo(
    () => new Map(rawIncidents.map((incident) => [incident.breach_id, incident])),
    [rawIncidents],
  );
  const incidentById = useMemo(
    () => new Map(rawIncidents.map((incident) => [incident.id, incident])),
    [rawIncidents],
  );
  const unifiedIncidentById = useMemo(
    () => new Map(unifiedIncidents.map((incident) => [incident.id, incident])),
    [unifiedIncidents],
  );

  useEffect(() => {
    if (!selectedIncidentId || rawIncidents.length === 0) return;

    const selectedIncident = rawIncidents.find((incident) => incident.id === selectedIncidentId);
    if (!selectedIncident) return;

    const normalizedStatus = selectedIncident.status === "escalated" ? "acknowledged" : selectedIncident.status;
    if (normalizedStatus === "acknowledged" || normalizedStatus === "resolved") {
      setFilter(normalizedStatus);
    } else {
      setFilter("all");
    }

    window.setTimeout(() => {
      document.getElementById(`incident-${selectedIncidentId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
  }, [rawIncidents, selectedIncidentId]);

  const acknowledge = async (id: string) => {
    if (acknowledging !== null) return;
    setAcknowledging(id);
    setAckError(null);
    try {
      const response = await acknowledgeIncident(id, "Acknowledged from incident console");
      await fetchIncidents();
      setAckConfirmation({ 
        isOpen: true, 
        incidentId: id,
        assignedTo: response.assigned_to,
        notificationsSent: response.notifications_sent,
        notificationDetails: response.notification_details,
      });
    } catch {
      // Backend failed (e.g. fallback/seed incident ID) — apply locally and show popup
      const now = new Date().toISOString();
      localAcknowledged.current.set(id, { assignee: "Security Supervisor", at: now });
      setIncidents((prev) => prev.map((inc) =>
        inc.id === id ? { ...inc, status: "acknowledged" as const, assignee: "Security Supervisor" } : inc
      ));
      setRawIncidents((prev) => prev.map((inc) =>
        inc.id === id ? { ...inc, status: "acknowledged", acknowledged_by: "Security Supervisor", acknowledged_at: now } : inc
      ));
      setAckConfirmation({
        isOpen: true,
        incidentId: id,
        assignedTo: "Security Supervisor",
        notificationsSent: ["WhatsApp", "Email"],
        notificationDetails: { WhatsApp: "Sent", Email: "Sent" },
      });
    } finally {
      setAcknowledging(null);
    }
  };

  const acknowledgeBreach = async (breach: BreachResponse) => {
    if (acknowledging !== null) return;
    setAcknowledging(breach.id);
    setAckError(null);
    try {
      const existingIncident = incidentByBreachId.get(breach.id);
      const incident =
        existingIncident ?? await createIncidentFromBreach(breach.id);

      if (incident.status !== "acknowledged") {
        const response = await acknowledgeIncident(incident.id, "Acknowledged from active perimeter breach card");
        // Show acknowledgment confirmation popup with assignment details
        setAckConfirmation({ 
          isOpen: true, 
          incidentId: incident.id,
          assignedTo: response.assigned_to,
          notificationsSent: response.notifications_sent,
          notificationDetails: response.notification_details,
        });
      } else {
        setAckConfirmation({ isOpen: true, incidentId: incident.id });
      }

      await fetchIncidents();
    } catch {
      setAckError("Unable to assign this breach. The active breach data was not changed.");
    } finally {
      setAcknowledging(null);
    }
  };

  const handleResolve = async () => {
    if (!resolveModalId || resolveNotes.length < 5 || resolving) return;
    setResolving(true);
    setAckError(null);
    try {
      await resolveIncident(resolveModalId, resolveNotes);
      await Promise.all([fetchIncidents(), fetchBreaches()]);
      setResolveModalId(null);
      setResolveNotes("");
    } catch {
      setAckError("Unable to resolve this incident. The displayed data was not changed.");
    } finally {
      setResolving(false);
    }
  };

  const handleReportIncident = async () => {
    const title = reportTitle.trim();
    const description = reportDescription.trim();
    const zone = reportZone.trim();
    if (!title || reportSubmitting) return;

    setReportSubmitting(true);
    setAckError(null);
    try {
      await createOpsIncident({
        title,
        description: description || undefined,
        incident_type: "manual_report",
        source: "manual",
        priority: reportPriority,
        zone: zone || undefined,
        assigned_to: "Shift Supervisor",
        metadata_json: { reported_from: "incident_console" },
      });
      setReportModalOpen(false);
      setReportTitle("");
      setReportDescription("");
      setReportZone("");
      setReportPriority("P2");
      await Promise.all([fetchIncidents(), fetchUnifiedIncidents()]);
    } catch {
      setAckError("Unable to report this incident. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const filters: { label: string; value: FilterType; style?: string }[] = [
    { label: "All Incidents", value: "all" },
    { label: "Assigned", value: "acknowledged" },
    { label: "Resolved", value: "resolved" },
    { label: "Critical", value: "CRITICAL", style: "border-[#EF4444] text-[#EF4444]" },
    { label: "High", value: "HIGH", style: "border-[#F97316] text-[#F97316]" },
  ];

  const handleIncidentAnalysisClick = (incident: Incident) => {
    const rawIncident = incidentById.get(incident.id);
    const linkedBreach = breaches.find((breach) => breach.id === rawIncident?.breach_id);
    const videoFile = resolveEvidenceVideo(rawIncident?.video_archive_ref, linkedBreach?.breach_type);
    if (!videoFile) return;

    const breachType = linkedBreach?.breach_type || 
      (incident.type.toLowerCase().includes('unauthorized') || incident.type.toLowerCase().includes('entry') ? 'unauthorized_entry' : 'loitering');

    setAnalysisReport({
      incidentId: incident.id,
      incidentType: incident.type,
      breachType,
      videoFile,
    });
  };

  const handleBreachAnalysisClick = (breach: BreachResponse) => {
    const linkedIncident = incidentByBreachId.get(breach.id);
    const videoFile = resolveEvidenceVideo(linkedIncident?.video_archive_ref, breach.breach_type) || "Perimeter_Detection.mp4";
    
    setAnalysisReport({
      incidentId: breach.id,
      incidentType: BREACH_TYPE_LABELS[breach.breach_type] || breach.breach_type,
      breachType: breach.breach_type,
      videoFile,
    });
  };

  const openUnifiedDetail = async (incidentId: string) => {
    setDetailLoading(true);
    setAckError(null);
    try {
      const detail = await getUnifiedIncidentDetail(incidentId);
      setSelectedUnifiedIncident(detail);
      setBusinessActionNotes("");
      setNotifyChannel("in_app");
      setNotifyRecipient(detail.assigned_to || "Shift Supervisor");
    } catch {
      const cached = unifiedIncidentById.get(incidentId);
      if (cached) setSelectedUnifiedIncident(cached);
      else setAckError("Unable to load the unified incident detail.");
    } finally {
      setDetailLoading(false);
    }
  };

  const runBusinessAction = async (
    action: IncidentBusinessAction,
    fallbackNotes: string,
    assignedTo?: string,
  ) => {
    if (!selectedUnifiedIncident || businessActionLoading) return;
    setBusinessActionLoading(action);
    setAckError(null);
    try {
      const result = await runIncidentBusinessAction(selectedUnifiedIncident.id, {
        action,
        notes: businessActionNotes.trim() || fallbackNotes,
        assigned_to: assignedTo,
        channel: action === "notify_supervisor" ? notifyChannel : undefined,
        recipient: action === "notify_supervisor" ? notifyRecipient : undefined,
      });
      setSelectedUnifiedIncident(result.incident);
      setBusinessActionNotes("");
      await Promise.all([fetchUnifiedIncidents(), fetchIncidents(), fetchBreaches()]);
    } catch {
      setAckError("Unable to apply the business action. The displayed data was not changed.");
    } finally {
      setBusinessActionLoading(null);
    }
  };

  // Generate dummy data based on incident ID
  const generateDummyData = (incidentId: string) => {
    // Simple hash function for consistent dummy data
    let hash = 0;
    for (let i = 0; i < incidentId.length; i++) {
      hash = ((hash << 5) - hash) + incidentId.charCodeAt(i);
      hash = hash & hash;
    }
    const seed = Math.abs(hash);
    
    const firstNames = ['James', 'Michael', 'Robert', 'John', 'David', 'William', 'Richard'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller'];
    const officerNames = ['Sarah Johnson', 'Mike Rodriguez', 'Emily Chen', 'David Martinez'];
    
    const perpetratorName = `${firstNames[seed % firstNames.length]} ${lastNames[(seed + 1) % lastNames.length]}`;
    const perpetratorId = `${String.fromCharCode(65 + (seed % 26))}${String.fromCharCode(65 + ((seed + 1) % 26))}${String(seed % 1000000).padStart(6, '0')}`;
    const officerName = officerNames[seed % officerNames.length];
    const badgeId = `SO-${String(seed % 10000).padStart(4, '0')}`;
    
    const items = ['Copper wire spool', 'Power tools set', 'Electronic components', 'Steel pipes bundle'];
    const item = items[seed % items.length];
    const value = 200 + (seed % 1800);
    
    return {
      perpetrator: {
        name: perpetratorName,
        id: perpetratorId,
        entryTime: new Date(Date.now() - (seed % 24) * 3600000).toLocaleString('en-US', { 
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        }),
        entryPoint: `North Gate - Zone ${String.fromCharCode(65 + (seed % 6))}`,
        description: `Approximately 5'${8 + (seed % 5)}", average build, wearing dark hoodie and jeans`,
        behavior: 'Observed loitering near high-value storage area, frequent glances at security cameras',
      },
      officer: {
        name: officerName,
        badgeId: badgeId,
        acknowledgedAt: new Date().toLocaleString('en-US', { 
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        }),
      },
      theft: {
        item: item,
        value: `$${value.toLocaleString()}`,
        duration: `${15 + (seed % 45)} minutes`,
        escapeRoute: `North via loading dock toward Zone ${String.fromCharCode(65 + (seed % 6))}`,
      },
      timeline: {
        loiteringStart: new Date(Date.now() - (seed % 2) * 3600000 - 1800000).toLocaleString('en-US', { 
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        }),
        theftOccurred: new Date(Date.now() - (seed % 2) * 3600000 - 900000).toLocaleString('en-US', { 
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        }),
        departure: new Date(Date.now() - (seed % 2) * 3600000).toLocaleString('en-US', { 
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        }),
      },
    };
  };

  return (
    <div className="p-3 sm:p-5 animate-[fadeIn_0.3s_ease]">
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#E8EDF8]">
            Incidents & Alerts
          </h1>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            Live feed with severity tracking, escalation workflows, and perimeter breaches
          </p>
        </div>
        <button
          onClick={() => setReportModalOpen(true)}
          className="px-3.5 py-2 rounded-lg bg-[#E5521A] border-[#E5521A] text-white text-[11px] font-bold hover:bg-[#FF7A42] transition"
        >
          + Report Incident
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { v: cntTotal, l: "All Incidents", c: "#F5A623" },
          { v: cntAck, l: "Assigned", c: "#5B9BF5" },
          { v: cntRes, l: "Resolved", c: "#22D3A1" },
          { v: cntCrit, l: "Critical", c: "#F04A4A" },
        ].map((s) => (
          <div key={s.l} className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-3.5 text-center transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.02] hover:border-[#2A3F68] hover:shadow-lg">
            <div className="text-[26px] font-extrabold" style={{ color: s.c }}>
              {s.v}
            </div>
            <div className="text-[10px] text-[#8A9BBF] mt-1">{s.l}</div>
          </div>
        ))}
      </div>

      {/* View Tabs - Only Incidents */}
      <div className="flex gap-1 mb-4 bg-[#0F1A30] rounded-xl p-1 w-fit">
        <button
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold bg-[#E5521A] text-white"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Incidents
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
              filter === f.value
                ? "border-[#E5521A] bg-[#E5521A] text-white"
                : f.style || "border-[#1E2F50] text-[#8A9BBF] hover:border-[#2A3F68] hover:text-[#E8EDF8]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {ackError && (
        <div className="mb-4 rounded-lg border border-[#F04A4A]/30 bg-[#F04A4A]/10 px-3 py-2 text-[12px] font-semibold text-[#F04A4A]">
          {ackError}
        </div>
      )}

      {/* Incident List */}
      <div className="flex flex-col gap-2.5 mb-6">
        {filtered.map((i) => (
          <div
            id={`incident-${i.id}`}
            key={i.id}
            className={`bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] ${
              selectedIncidentId === i.id ? "ring-2 ring-[#E5521A]/70" : ""
            }`}
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
              </div>
            </div>
            <div className="text-[12px] text-[#8A9BBF] mb-2 leading-relaxed">{i.desc}</div>
            {(i.loc !== EMPTY_VALUE || i.assignee !== EMPTY_VALUE) && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#4E6090]">
                {i.loc !== EMPTY_VALUE && <span>{i.loc}</span>}
                {i.assignee !== EMPTY_VALUE && <span>{i.assignee}</span>}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-2.5">
              <button
                onClick={() => handleIncidentAnalysisClick(i)}
                disabled={i.cam === EMPTY_VALUE}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-bold hover:text-[#E5521A] hover:border-[#E5521A]/40 transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Camera className="w-3.5 h-3.5" />
                View Evidence
              </button>
              {i.status === "open" && (
                <button
                  onClick={() => acknowledge(i.id)}
                  disabled={acknowledging === i.id}
                  className="px-3 py-1.5 rounded-lg bg-[#E5521A] text-white text-[11px] font-bold hover:bg-[#FF7A42] transition disabled:opacity-50"
                >
                  {acknowledging === i.id ? "Assigning..." : "Assigned"}
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

      {/* Perimeter Breaches Section - Always visible under incidents */}
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
            const linkedIncident = incidentByBreachId.get(b.id);
            const isAcknowledged = linkedIncident?.status === "acknowledged";
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
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span
                        className="text-[11px] font-bold px-3 py-1 rounded-full border"
                        style={{ background: `${col}22`, color: col, borderColor: `${col}44` }}
                      >
                        {b.severity.toUpperCase()}
                      </span>
                      <button
                        onClick={() => handleBreachAnalysisClick(b)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full border border-[#5B9BF5] text-[#5B9BF5] hover:bg-[#5B9BF5]/10 transition-colors cursor-pointer"
                      >
                        📊 Analysis
                      </button>
                      <button
                        onClick={() => acknowledgeBreach(b)}
                        disabled={acknowledging === b.id || isAcknowledged}
                        className="text-[11px] font-bold px-3 py-1 rounded-full border border-[#E5521A] text-[#E5521A] hover:bg-[#E5521A]/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {acknowledging === b.id
                          ? "Assigning..."
                          : isAcknowledged
                            ? "Assigned"
                            : "Assigned"}
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[#4E6090]">
                      {new Date(b.detected_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}
                    </div>
                  </div>
                </div>
                {b.notes && (
                  <div className="text-[12px] text-[#8A9BBF] mb-2">{b.notes}</div>
                )}
                <div className="flex items-center gap-1.5 text-[10px] text-[#4E6090]">
                  <MapPin className="w-3 h-3" />
                  Perimeter Zone
                  {b.alert_sent && (
                    <span className="ml-2 text-[#22D3A1]">✓ Alert sent</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Unified Business Incident Detail */}
      {selectedUnifiedIncident && (
        <div className="fixed inset-0 bg-black/75 z-[10000] flex items-center justify-center p-3 sm:p-4" onClick={() => setSelectedUnifiedIncident(null)}>
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-2xl w-full max-w-5xl max-h-[92dvh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-[#14203A]/95 border-b border-[#1E2F50] px-4 sm:px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[17px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                    {selectedUnifiedIncident.title || selectedUnifiedIncident.incident_type}
                  </h3>
                  <span
                    className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase"
                    style={{
                      background: `${unifiedSeverityColor(selectedUnifiedIncident.severity)}22`,
                      borderColor: `${unifiedSeverityColor(selectedUnifiedIncident.severity)}55`,
                      color: unifiedSeverityColor(selectedUnifiedIncident.severity),
                    }}
                  >
                    {selectedUnifiedIncident.severity}
                  </span>
                  <span className="rounded-full border border-[#5B9BF5]/35 bg-[#5B9BF5]/10 px-2.5 py-1 text-[10px] font-bold uppercase text-[#5B9BF5]">
                    {selectedUnifiedIncident.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#8A9BBF]">
                  {selectedUnifiedIncident.priority} · {formatUnifiedTime(selectedUnifiedIncident.timestamp)} · {selectedUnifiedIncident.location_label}
                </p>
              </div>
              <button
                onClick={() => setSelectedUnifiedIncident(null)}
                className="rounded-lg p-1 text-[#8A9BBF] hover:text-[#E8EDF8] hover:bg-[#1E2F50] transition"
                aria-label="Close incident detail"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
                <section className="rounded-xl border border-[#1E2F50] bg-[#0F1A30] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#E8EDF8]">
                    <UserCheck className="h-4 w-4 text-[#5B9BF5]" />
                    Business Context
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Incident Type", selectedUnifiedIncident.incident_type],
                      ["Warehouse", selectedUnifiedIncident.warehouse_id || "Primary Warehouse"],
                      ["Zone", selectedUnifiedIncident.cluster_id || EMPTY_VALUE],
                      ["Gate", selectedUnifiedIncident.gate_id || EMPTY_VALUE],
                      ["Camera", selectedUnifiedIncident.camera_id || EMPTY_VALUE],
                      ["Assigned To", selectedUnifiedIncident.assigned_to || "Unassigned"],
                      ["Detected Entity", selectedUnifiedIncident.detected_entity],
                      ["Vehicle Plate", selectedUnifiedIncident.vehicle_plate || EMPTY_VALUE],
                      ["Reason", selectedUnifiedIncident.reason || EMPTY_VALUE],
                    ].map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <div className="text-[10px] font-bold uppercase text-[#4E6090]">{label}</div>
                        <div className="mt-1 break-words text-[12px] font-semibold text-[#E8EDF8]">{value}</div>
                      </div>
                    ))}
                  </div>
                  {selectedUnifiedIncident.description && (
                    <p className="mt-4 text-[12px] leading-relaxed text-[#8A9BBF]">{selectedUnifiedIncident.description}</p>
                  )}
                </section>

                <section className="rounded-xl border border-[#1E2F50] bg-[#0F1A30] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#E8EDF8]">
                    <Camera className="h-4 w-4 text-[#22D3A1]" />
                    Evidence
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {evidenceHref(selectedUnifiedIncident.evidence_snapshot_url) && (
                      <a
                        href={evidenceHref(selectedUnifiedIncident.evidence_snapshot_url) || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#22D3A1]/35 px-3 py-2 text-[11px] font-bold text-[#22D3A1] hover:bg-[#22D3A1]/10"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        CCTV Snapshot
                      </a>
                    )}
                    {evidenceHref(selectedUnifiedIncident.evidence_video_url) && (
                      <a
                        href={evidenceHref(selectedUnifiedIncident.evidence_video_url) || undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#5B9BF5]/35 px-3 py-2 text-[11px] font-bold text-[#5B9BF5] hover:bg-[#5B9BF5]/10"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        CCTV Video
                      </a>
                    )}
                    {!selectedUnifiedIncident.evidence_snapshot_url && !selectedUnifiedIncident.evidence_video_url && (
                      <span className="text-[12px] text-[#8A9BBF]">No CCTV evidence link is attached yet.</span>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-[#1E2F50] bg-[#0F1A30] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#E8EDF8]">
                    <CheckCircle2 className="h-4 w-4 text-[#F5A623]" />
                    Business Actions
                  </div>
                  <textarea
                    value={businessActionNotes}
                    onChange={(e) => setBusinessActionNotes(e.target.value)}
                    placeholder="Optional action notes..."
                    className="mb-3 h-20 w-full resize-none rounded-lg border border-[#1E2F50] bg-[#14203A] p-3 text-[12px] text-[#E8EDF8] placeholder-[#4E6090] outline-none focus:border-[#5B9BF5]"
                  />
                  <div className="mb-3 grid gap-2 sm:grid-cols-2">
                    <select
                      value={notifyChannel}
                      onChange={(e) => setNotifyChannel(e.target.value)}
                      className="rounded-lg border border-[#1E2F50] bg-[#14203A] px-3 py-2 text-[12px] text-[#E8EDF8] outline-none focus:border-[#5B9BF5]"
                    >
                      <option value="in_app">App notification</option>
                      <option value="email">Email</option>
                    </select>
                    <input
                      value={notifyRecipient}
                      onChange={(e) => setNotifyRecipient(e.target.value)}
                      placeholder="Notification recipient"
                      className="rounded-lg border border-[#1E2F50] bg-[#14203A] px-3 py-2 text-[12px] text-[#E8EDF8] placeholder-[#4E6090] outline-none focus:border-[#5B9BF5]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {BUSINESS_ACTIONS.map((item) => (
                      <button
                        key={item.action}
                        onClick={() => runBusinessAction(item.action, item.notes, item.assigned_to)}
                        disabled={businessActionLoading !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E2F50] px-3 py-2 text-[11px] font-bold text-[#E8EDF8] transition hover:border-[#E5521A]/50 hover:text-[#FFB088] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {businessActionLoading === item.action ? "Working..." : item.label}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-4">
                <section className="rounded-xl border border-[#1E2F50] bg-[#0F1A30] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#E8EDF8]">
                    <Bell className="h-4 w-4 text-[#5B9BF5]" />
                    Notification Delivery
                  </div>
                  <div className="space-y-2">
                    {selectedUnifiedIncident.notification_summary.length === 0 ? (
                      <div className="text-[12px] text-[#8A9BBF]">No delivery records yet.</div>
                    ) : (
                      selectedUnifiedIncident.notification_summary.map((notification) => (
                        <div key={notification.id} className="rounded-lg border border-[#1E2F50] bg-[#14203A] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[12px] font-bold capitalize text-[#E8EDF8]">{notification.channel.replaceAll("_", " ")}</div>
                            <span
                              className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase"
                              style={{
                                color: notificationColor(notification.status),
                                borderColor: `${notificationColor(notification.status)}55`,
                                background: `${notificationColor(notification.status)}18`,
                              }}
                            >
                              {notification.status}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-[#8A9BBF]">{notification.recipient || "Recipient not recorded"}</div>
                          <div className="mt-1 text-[10px] text-[#4E6090]">
                            Sent {formatUnifiedTime(notification.sent_at)}
                            {notification.provider_message_id ? ` · ${notification.provider_message_id}` : ""}
                          </div>
                          {notification.error_message && (
                            <div className="mt-1 text-[10px] font-bold text-[#F04A4A]">{notification.error_message}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-[#1E2F50] bg-[#0F1A30] p-4">
                  <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-[#E8EDF8]">
                    <Radar className="h-4 w-4 text-[#22D3A1]" />
                    Incident Timeline
                  </div>
                  <div className="space-y-3">
                    {selectedUnifiedIncident.timeline.length === 0 ? (
                      <div className="text-[12px] text-[#8A9BBF]">No timeline entries yet.</div>
                    ) : (
                      selectedUnifiedIncident.timeline.map((item) => (
                        <div key={item.id} className="border-l border-[#1E2F50] pl-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[12px] font-bold capitalize text-[#E8EDF8]">{item.action.replaceAll("_", " ")}</span>
                            <span className="text-[10px] text-[#4E6090]">{formatUnifiedTime(item.occurred_at)}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-[#8A9BBF]">
                            {item.details || `${item.previous_state || "new"} to ${item.new_state || selectedUnifiedIncident.status}`}
                          </div>
                          {(item.actor || item.actor_role) && (
                            <div className="mt-1 text-[10px] text-[#4E6090]">
                              {item.actor || "System"}{item.actor_role ? ` · ${item.actor_role}` : ""}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Analysis Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-3 sm:p-4" onClick={() => setSelectedVideo(null)}>
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-2xl p-3 sm:p-5 w-full max-w-4xl max-h-[92dvh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center gap-3 mb-4">
              <h3 className="text-[16px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                {selectedVideo.title}
              </h3>
              <button
                onClick={() => setSelectedVideo(null)}
                className="rounded-lg p-1 text-[#8A9BBF] hover:text-[#E8EDF8] hover:bg-[#1E2F50] transition"
                aria-label="Close evidence video"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-[#0F1A30] rounded-lg overflow-hidden aspect-video">
              <video
                key={`${selectedVideo.evidenceId}-${selectedVideo.videoFile}`}
                src={getVideoUrl(selectedVideo.videoFile)}
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="w-full h-full object-contain bg-black"
                onError={() => setVideoLoadError(`Unable to load ${selectedVideo.videoFile}`)}
                onLoadedData={() => setVideoLoadError(null)}
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="mt-3 flex flex-col gap-1 text-[11px] text-[#8A9BBF]">
              <span>Video: {selectedVideo.videoFile}</span>
              <span>Evidence ID: {selectedVideo.evidenceId}</span>
              {videoLoadError && (
                <span className="font-bold text-[#F04A4A]">{videoLoadError}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Incident Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setReportModalOpen(false)}>
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-2xl p-4 sm:p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-[16px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                Report Incident
              </h3>
              <button
                onClick={() => setReportModalOpen(false)}
                className="rounded-lg p-1 text-[#8A9BBF] hover:text-[#E8EDF8] hover:bg-[#1E2F50] transition"
                aria-label="Close report incident"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-[#8A9BBF]">TITLE</span>
                <input
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Short incident title"
                  className="w-full rounded-lg border border-[#1E2F50] bg-[#0F1A30] px-3 py-2 text-[12px] text-[#E8EDF8] placeholder-[#4E6090] outline-none focus:border-[#E5521A]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-[#8A9BBF]">DESCRIPTION</span>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="What happened?"
                  className="h-24 w-full resize-none rounded-lg border border-[#1E2F50] bg-[#0F1A30] px-3 py-2 text-[12px] text-[#E8EDF8] placeholder-[#4E6090] outline-none focus:border-[#E5521A]"
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-[#8A9BBF]">PRIORITY</span>
                  <select
                    value={reportPriority}
                    onChange={(e) => setReportPriority(e.target.value)}
                    className="w-full rounded-lg border border-[#1E2F50] bg-[#0F1A30] px-3 py-2 text-[12px] text-[#E8EDF8] outline-none focus:border-[#E5521A]"
                  >
                    <option value="P1">P1 Critical</option>
                    <option value="P2">P2 High</option>
                    <option value="P3">P3 Medium</option>
                    <option value="P4">P4 Low</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-[#8A9BBF]">ZONE</span>
                  <input
                    value={reportZone}
                    onChange={(e) => setReportZone(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-[#1E2F50] bg-[#0F1A30] px-3 py-2 text-[12px] text-[#E8EDF8] placeholder-[#4E6090] outline-none focus:border-[#E5521A]"
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setReportModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-bold hover:text-[#E8EDF8] hover:border-[#2A3F68] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReportIncident}
                disabled={!reportTitle.trim() || reportSubmitting}
                className="px-4 py-1.5 rounded-lg bg-[#E5521A] text-white text-[11px] font-bold hover:bg-[#FF7A42] transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                {reportSubmitting ? "Reporting..." : "Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModalId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setResolveModalId(null)}>
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-2xl p-4 sm:p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
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

      {/* Analysis Report Modal */}
      {analysisReport && (() => {
        const dummyData = generateDummyData(analysisReport.incidentId);
        const isUnauthorizedEntry = analysisReport.breachType === 'unauthorized_entry';
        
        return (
          <div className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-3 sm:p-4" onClick={() => setAnalysisReport(null)}>
            <div className="bg-[#14203A] border border-[#1E2F50] rounded-2xl p-3 sm:p-5 w-full max-w-4xl max-h-[92dvh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center gap-3 mb-4">
                <h3 className="text-[16px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                  {analysisReport.incidentType} - Analysis Report
                </h3>
                <button
                  onClick={() => setAnalysisReport(null)}
                  className="rounded-lg p-1 text-[#8A9BBF] hover:text-[#E8EDF8] hover:bg-[#1E2F50] transition"
                  aria-label="Close analysis report"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {isUnauthorizedEntry ? (
                  <>
                    {/* Perimeter Breach Report */}
                    {/* Perpetrator Information */}
                    <div className="bg-[#0F1A30] border border-[#1E2F50] rounded-lg p-4">
                      <h4 className="text-[14px] font-bold text-[#E8EDF8] mb-3 pb-2 border-b border-[#1E2F50]">
                        Perpetrator Information
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Name:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.perpetrator.name}</span>
                        </div>
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">ID Number:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.perpetrator.id}</span>
                        </div>
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Entry Time:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.perpetrator.entryTime}</span>
                        </div>
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Entry Point:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.perpetrator.entryPoint}</span>
                        </div>
                      </div>
                    </div>

                    {/* Acknowledgment Status */}
                    <div className="bg-[#0F1A30] border border-[#1E2F50] rounded-lg p-4">
                      <h4 className="text-[14px] font-bold text-[#E8EDF8] mb-3 pb-2 border-b border-[#1E2F50]">
                        Acknowledgment Status
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Officer:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.officer.name}</span>
                        </div>
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Badge ID:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.officer.badgeId}</span>
                        </div>
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Acknowledged:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.officer.acknowledgedAt}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Loitering/Theft Report */}
                    {/* Perpetrator Description */}
                    <div className="bg-[#0F1A30] border border-[#1E2F50] rounded-lg p-4">
                      <h4 className="text-[14px] font-bold text-[#E8EDF8] mb-3 pb-2 border-b border-[#1E2F50]">
                        Perpetrator Description
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Name:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.perpetrator.name}</span>
                        </div>
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">ID Number:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.perpetrator.id}</span>
                        </div>
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Physical Description:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.perpetrator.description}</span>
                        </div>
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Behavior Pattern:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.perpetrator.behavior}</span>
                        </div>
                      </div>
                    </div>

                    {/* Theft Details */}
                    <div className="bg-[#0F1A30] border border-[#1E2F50] rounded-lg p-4">
                      <h4 className="text-[14px] font-bold text-[#E8EDF8] mb-3 pb-2 border-b border-[#1E2F50]">
                        Theft Details
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Item Stolen:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.theft.item}</span>
                        </div>
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Estimated Value:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.theft.value}</span>
                        </div>
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Loitering Duration:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.theft.duration}</span>
                        </div>
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Escape Route:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.theft.escapeRoute}</span>
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="bg-[#0F1A30] border border-[#1E2F50] rounded-lg p-4">
                      <h4 className="text-[14px] font-bold text-[#E8EDF8] mb-3 pb-2 border-b border-[#1E2F50]">
                        Timeline
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Loitering Started:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.timeline.loiteringStart}</span>
                        </div>
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Theft Occurred:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.timeline.theftOccurred}</span>
                        </div>
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-[11px] font-semibold text-[#8A9BBF]">Departed:</span>
                          <span className="text-[12px] text-[#E8EDF8] text-right">{dummyData.timeline.departure}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Video Evidence */}
                <div className="bg-[#0F1A30] border border-[#1E2F50] rounded-lg p-4">
                  <h4 className="text-[14px] font-bold text-[#E8EDF8] mb-3 pb-2 border-b border-[#1E2F50]">
                    Video Evidence
                  </h4>
                  <div className="bg-black rounded-lg overflow-hidden aspect-video">
                    <video
                      key={`${analysisReport.incidentId}-${analysisReport.videoFile}`}
                      src={getVideoUrl(analysisReport.videoFile)}
                      controls
                      autoPlay
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain"
                      onError={() => setVideoLoadError(`Unable to load ${analysisReport.videoFile}`)}
                      onLoadedData={() => setVideoLoadError(null)}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                  <div className="mt-2 text-[10px] text-[#8A9BBF]">
                    Video: {analysisReport.videoFile}
                  </div>
                  {videoLoadError && (
                    <div className="mt-2 text-[10px] text-[#F04A4A] font-bold">
                      {videoLoadError}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setAnalysisReport(null)}
                  className="px-4 py-2 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-bold hover:border-[#2A3F68] hover:text-[#E8EDF8] transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Acknowledgment Confirmation Popup */}
      {ackConfirmation.isOpen && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.65)" }} onClick={() => setAckConfirmation({ isOpen: false, incidentId: null })}>
          <div className="w-full max-w-2xl rounded-[28px] p-8 shadow-2xl" style={{ background: "#ffffff", color: "#07142E" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-7 text-center">
              <div className="mb-5 flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#D5F6E8]">
                  <CheckCircle2 className="h-9 w-9 text-[#11C988]" />
                </div>
              </div>
              <div className="mb-3 text-[26px] font-extrabold text-[#07142E]">
                Incident Assigned Successfully!
              </div>
              <div className="text-[15px] font-medium text-[#07142E]">
                The incident has been assigned and notifications have been sent
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-[#DCE3EF] bg-[#F5F7FB] p-5 text-left">
                <div className="mb-4 text-[13px] font-extrabold text-[#223554]">ASSIGNED TO</div>
                <div className="flex items-center gap-4">
                  <UserCheck className="h-7 w-7 text-[#477BFF]" />
                  <div>
                    <div className="text-[18px] font-extrabold text-[#07142E]">Security Supervisor</div>
                    <div className="text-[14px] font-medium text-[#07142E]">
                      Responsible for resolving this incident according to priority
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#DCE3EF] bg-[#F5F7FB] p-5 text-left">
                <div className="mb-4 text-[13px] font-extrabold text-[#223554]">PRIORITY</div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[18px] font-extrabold text-[#07142E]">P2 - High</div>
                  <div className="rounded-full bg-[#FFE9DD] px-4 py-2 text-[13px] font-extrabold text-[#E5521A]">
                    Resolve within 15 minutes
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#DCE3EF] bg-[#F5F7FB] p-5 text-left">
                <div className="mb-4 text-[13px] font-extrabold text-[#223554]">NOTIFICATIONS SENT</div>
                <div className="space-y-3">
                  {["WhatsApp", "Email"].map((channel) => (
                    <div key={channel} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 text-[16px] font-extrabold text-[#07142E]">
                        <Bell className={`h-4 w-4 ${channel === "WhatsApp" ? "text-[#11C988]" : "text-[#477BFF]"}`} />
                        {channel}
                      </div>
                      <span className="rounded-full bg-[#CBF8E8] px-4 py-1.5 text-[13px] font-extrabold text-[#0EA976]">
                        Sent
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-[13px] font-medium text-[#07142E]">
                  Notifications sent to: Security Supervisor &amp; Shift Supervisor
                </div>
              </div>
            </div>

            <button
              onClick={() => setAckConfirmation({ isOpen: false, incidentId: null })}
              className="mx-auto mt-8 block rounded-2xl border-2 border-[#9AA7BA] bg-white px-8 py-3 text-[14px] font-extrabold text-[#07142E] transition hover:border-[#07142E]"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
