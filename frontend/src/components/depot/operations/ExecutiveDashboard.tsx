"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDepotCommandSnapshot, type CameraRecord } from "@/services/depotCommand";
import { getIncidents, type IncidentResponse } from "@/services/depotPerimeter";

interface LiveZone {
  zone_code: string;
  name: string;
  utilization_pct: number;
  current_occupancy: number;
  max_capacity_units: number;
  status: string;
}
import {
  ShieldAlert,
  CheckCircle2,
  Activity,
  Clock,
  UserX,
  PersonStanding,
  Flame,
  Camera,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  Package,
  Eye,
  Wifi,
  WifiOff,
  CircleDot,
  TriangleAlert,
} from "lucide-react";

// ─── Throughput data ────────────────────────────────────────────────────────
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKLY = [
  { enter: 320, exit: 290 },
  { enter: 380, exit: 350 },
  { enter: 290, exit: 265 },
  { enter: 410, exit: 385 },
  { enter: 450, exit: 420 }, // Friday — peak
  { enter: 360, exit: 330 },
  { enter: 240, exit: 215 },
];
const WEEKLY_TOTALS = WEEKLY.reduce(
  (a, d) => ({ enter: a.enter + d.enter, exit: a.exit + d.exit }),
  { enter: 0, exit: 0 }
);

function zoneDisplayName(zone: ZoneResponse) {
  const code = zone.zone_code?.trim();
  return code ? `Zone ${code}` : "Zone";
}

// ─── 6 Cameras — replaced by live backend data ──────────────────────────────
// (CAMERAS constant removed — now fetched from API)

// ─── 4 Zones — replaced by live backend data ─────────────────────────────────
// (ZONES constant removed — now fetched from API)

// ─── Incidents ───────────────────────────────────────────────────────────────
type Severity = "critical" | "high" | "medium";
type Status   = "open" | "escalated" | "monitoring";
const ALLOWED_INCIDENT_VIDEOS = new Set(["Perimeter_Detection.mp4", "Theft Camera .mp4"]);
const SEED_INCIDENT_VIDEO_MAP: Record<string, string> = {
  "seed://breach-0": "Perimeter_Detection.mp4",
  "seed://breach-inbound-gate": "Perimeter_Detection.mp4",
  "seed://breach-staging-area": "Theft Camera .mp4",
};

interface Incident {
  id: string;
  title: string;
  what: string;           // plain-language "what happened"
  where: string;          // plain-language "where"
  doWhat: string;         // plain-language "what to do"
  severity: Severity;
  status: Status;
  assignee: string;
  ago: string;
  countdown?: number;     // minutes until escalation
  icon: React.ElementType;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const INCIDENTS: Incident[] = [
  {
    id: "INC-001",
    title: "Unauthorized Entry",
    what: "Someone entered Gate C without a valid badge — scan failed 3 times in a row.",
    where: "Gate C · North Side",
    doWhat: "Security officer should check Gate C immediately.",
    severity: "critical", status: "escalated",
    assignee: "Sec. Officer Rajan",
    ago: "12 min ago", countdown: 18,
    icon: UserX,
  },
  {
    id: "INC-002",
    title: "Person Loitering",
    what: "Someone has been standing in the restricted staging area near Bay 7 for over 15 minutes with no work order.",
    where: "Bay 7 · Staging Area",
    doWhat: "Supervisor should go and check this person's access.",
    severity: "high", status: "open",
    assignee: "Supervisor Meera",
    ago: "27 min ago", countdown: 33,
    icon: PersonStanding,
  },
  {
    id: "INC-003",
    title: "Unauthorized Entry",
    what: "A vehicle entered Dock B at 08:42 but its number plate was not in our system.",
    where: "Dock B · Vehicle Gate",
    doWhat: "Ops Lead should verify the vehicle and driver at Dock B.",
    severity: "high", status: "open",
    assignee: "Ops Lead Vishal",
    ago: "44 min ago", countdown: 16,
    icon: UserX,
  },
  {
    id: "INC-004",
    title: "Bag Count Mismatch",
    what: "Camera counted 1,208 bags but the delivery note says 1,300. That's 92 bags unaccounted for.",
    where: "Zone C · Receiving Area",
    doWhat: "Count team should do a manual recount in Zone C.",
    severity: "high", status: "monitoring",
    assignee: "Count Lead Priya",
    ago: "1 hr ago",
    icon: Eye,
  },
  {
    id: "INC-005",
    title: "Person Loitering",
    what: "Two people were spotted near Emergency Exit E-2 for 22 minutes after their shift ended.",
    where: "Emergency Exit E-2",
    doWhat: "Security should check Emergency Exit E-2 now.",
    severity: "medium", status: "open",
    assignee: "Unassigned",
    ago: "1 hr 21 min ago",
    icon: PersonStanding,
  },
  {
    id: "INC-006",
    title: "Zone A Almost Full",
    what: "Zone A is 91% full and getting close to its limit. New bags may not fit soon.",
    where: "Zone A · Storage",
    doWhat: "Warehouse manager should redirect incoming bags to Zone D.",
    severity: "medium", status: "monitoring",
    assignee: "Warehouse Mgr. Anil",
    ago: "1 hr 37 min ago",
    icon: Flame,
  },
  {
    id: "INC-007",
    title: "Camera Signal Lost",
    what: "Camera CAM-06 in Zone B (Aisle 4) is not sending a clear picture — signal keeps dropping.",
    where: "Zone B · Aisle 4",
    doWhat: "Tech team should check and restart CAM-06.",
    severity: "medium", status: "open",
    assignee: "Tech. Support Karan",
    ago: "1 hr 50 min ago",
    icon: Camera,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function zoneColor(pct: number): string {
  if (pct >= 95) return "var(--color-danger)";
  if (pct >= 85) return "var(--color-warning)";
  return "var(--color-success)";
}
function zoneLabel(pct: number): string {
  if (pct >= 95) return "⚠ Critical – Full";
  if (pct >= 85) return "! Almost Full";
  return "✓ Normal";
}
function sevColor(s: Severity): string {
  if (s === "critical") return "var(--color-danger)";
  if (s === "high")     return "#F97316";
  return "var(--color-warning)";
}
function statusBg(s: Status): { bg: string; text: string; border: string; label: string } {
  if (s === "escalated")  return { bg: "rgba(240,74,74,0.10)",   text: "var(--color-danger)",  border: "rgba(240,74,74,0.25)",   label: "🚨 Escalated" };
  if (s === "open")       return { bg: "rgba(245,166,35,0.12)",  text: "var(--color-warning)", border: "rgba(245,166,35,0.28)",  label: "⚡ Action Needed" };
  return                         { bg: "rgba(91,155,245,0.10)",  text: "var(--color-info)",    border: "rgba(91,155,245,0.25)",  label: "👁 Watching" };
}
function fmtK(n: number): string {
  return String(n);
}
function relativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}
function countdownMinutes(deadline: string | null): number | undefined {
  if (!deadline) return undefined;
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 60000));
}
function normalizeSeverity(severity: string): Severity {
  if (severity === "critical" || severity === "high" || severity === "medium") return severity;
  return "medium";
}
function normalizeStatus(status: string): Status {
  if (status === "escalated") return "escalated";
  if (status === "acknowledged") return "monitoring";
  return "open";
}
function incidentIcon(title: string): React.ElementType {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes("loiter")) return PersonStanding;
  if (lowerTitle.includes("camera")) return Camera;
  if (lowerTitle.includes("storage") || lowerTitle.includes("zone")) return Flame;
  if (lowerTitle.includes("count")) return Eye;
  return UserX;
}
function dedupeIncidentResponses(incidents: IncidentResponse[]): IncidentResponse[] {
  const seen = new Set<string>();
  const unique: IncidentResponse[] = [];

  for (const incident of incidents) {
    const baseDescription = (incident.description || "")
      .split("Acknowledged:")[0]
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const key = [
      incident.title.trim().toLowerCase(),
      baseDescription,
      incident.severity,
      incident.video_archive_ref || "",
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(incident);
  }

  return unique;
}
function hasSupportedIncidentVideo(incident: IncidentResponse): boolean {
  const videoRef = incident.video_archive_ref || "";
  return ALLOWED_INCIDENT_VIDEOS.has(videoRef) || ALLOWED_INCIDENT_VIDEOS.has(SEED_INCIDENT_VIDEO_MAP[videoRef]);
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, color, icon: Icon, cardStyle,
}: {
  label: string; value: string; sub: string; color: string;
  icon: React.ElementType; cardStyle: React.CSSProperties;
}) {
  return (
    <div
      className="rounded-[14px] p-3 sm:p-4 relative overflow-hidden cursor-default transition-all hover:-translate-y-0.5 group"
      style={{ ...cardStyle, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(229,82,26,0.10)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(229,82,26,0.25)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 6px rgba(0,0,0,0.05)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-card)";
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" style={{ color }} />
        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wide leading-tight" style={{ color: "var(--text-faint)" }}>
          {label}
        </span>
      </div>
      <div className="text-[24px] sm:text-[28px] font-extrabold leading-none" style={{ color }}>
        {value}
      </div>
      <div className="text-[9px] sm:text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{sub}</div>
      <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-[14px] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
    </div>
  );
}

// ─── Section heading ─────────────────────────────────────────────────────────
function SectionHeading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <h2 className="text-[13px] sm:text-[14px] font-black" style={{ color: "var(--text-primary)" }}>
        {children}
      </h2>
      {sub && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{sub}</span>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ExecutiveDashboard() {
  const router = useRouter();
  const [, setTick] = useState(0);
  const [cameras, setCameras] = useState<CameraRecord[]>([]);
  const [liveZones, setLiveZones] = useState<LiveZone[]>([]);
  const [backendIncidents, setBackendIncidents] = useState<IncidentResponse[]>([]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    
    const loadDashboardData = () => {
      if (cancelled) return;
      
      getDepotCommandSnapshot().then((snap) => {
        if (!cancelled && snap.cameras.data.length > 0) setCameras(snap.cameras.data);
      }).catch(() => {});
      // Same endpoint as Inventory page — live utilization from active batches
      fetch("/backend/depot/vision/cluster/zones")
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then((data: LiveZone[]) => { if (data.length > 0) setLiveZones(data); })
        .catch(() => {});
      getIncidents()
        .then((items) => { if (!cancelled) setBackendIncidents(dedupeIncidentResponses(items)); })
        .catch(() => {});
    };

    loadDashboardData();
    const id = setInterval(loadDashboardData, 10000);
    // Re-fetch immediately when a batch is added or deleted in Inventory
    window.addEventListener("depot:batch-change", loadDashboardData);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("depot:batch-change", loadDashboardData);
    };
  }, []);

  // Map backend cameras to the shape used in the UI
  const CAMERAS = cameras.length > 0
    ? cameras.map((c) => ({
        id: c.id,
        location: c.name,
        status: c.status === "active" ? "online" as const : "offline" as const,
        zone: c.zone ?? "—",
      }))
    : [] as { id: string; location: string; status: "online" | "offline"; zone: string }[];

  // Single source of truth: same zones endpoint as Inventory page
  const ZONES = liveZones.map((z) => ({
    id: z.zone_code,
    name: z.name,
    pct: Math.round(z.utilization_pct),
    used: z.current_occupancy,
    total: z.max_capacity_units,
  }));

  const activeIncidents: Incident[] = backendIncidents
    .filter((incident) => incident.status !== "resolved")
    .map((incident) => ({
      id: incident.id,
      title: incident.title,
      what: incident.description || incident.title,
      where: `Zone ID: ${incident.zone_id}`,
      doWhat: incident.status === "acknowledged"
        ? "Incident is acknowledged and awaiting closure."
        : "Ops team should review and take action.",
      severity: normalizeSeverity(incident.severity),
      status: normalizeStatus(incident.status),
      assignee: incident.acknowledged_by || incident.escalated_to || "Unassigned",
      ago: relativeTime(incident.created_at),
      countdown: countdownMinutes(incident.escalation_deadline),
      icon: incidentIcon(incident.title),
    }));

  const openCount     = activeIncidents.filter((i) => i.status === "open" || i.status === "escalated").length;
  const critCount     = activeIncidents.filter((i) => i.severity === "critical").length;
  const offlineCams   = CAMERAS.filter((c) => c.status === "offline").length;
  const atRiskZones   = ZONES.filter((z) => z.pct >= 85).length;
  const avgOccupancy  = ZONES.length > 0 ? Math.round(ZONES.reduce((a, z) => a + z.pct, 0) / ZONES.length) : 0;

  const MAX_BAR = Math.max(...WEEKLY.flatMap((d) => [d.enter, d.exit]));
  const CHART_H = 220;

  const cardStyle: React.CSSProperties = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-card)",
    color: "var(--text-primary)",
  };
  const innerCard: React.CSSProperties = {
    backgroundColor: "var(--bg-surface-2)",
    border: "1px solid var(--border-default)",
  };

  return (
    <div className="p-3 sm:p-4 lg:p-5 w-full max-w-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
        <div>
          <div className="text-[10px] sm:text-[11px] font-black tracking-[0.1em] uppercase mb-1" style={{ color: "#E5521A" }}>
            Executive Overview
          </div>
          <h1 className="text-[18px] sm:text-[22px] font-extrabold" style={{ color: "var(--text-primary)" }}>
            Operations Hub
          </h1>
          <p className="text-[10px] sm:text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            IntelliDepot · {CAMERAS.filter(c => c.status === "online").length} of {CAMERAS.length} cameras active
          </p>
        </div>
        <span
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold self-start"
          style={{ backgroundColor: "rgba(34,211,161,0.1)", border: "1px solid rgba(34,211,161,0.25)", color: "var(--color-success)" }}
        >
          <Activity className="w-3.5 h-3.5" />
          System Online
        </span>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
        <KpiCard label="Alerts Right Now" value={String(critCount + offlineCams + atRiskZones)}
                                                                sub={`${critCount} urgent · ${offlineCams} camera offline`} color={(critCount + offlineCams) > 0 ? "var(--color-warning)" : "var(--color-success)"} icon={AlertTriangle} cardStyle={cardStyle} />
        <KpiCard label="Problems to Fix" value={String(openCount)} sub={openCount > 0 ? `${openCount} open incident${openCount !== 1 ? "s" : ""}` : "All clear"} color={openCount > 0 ? "var(--color-danger)" : "var(--color-success)"} icon={ShieldAlert} cardStyle={cardStyle} />
        <KpiCard label="Storage Used"   value={`${avgOccupancy}%`} sub={`${atRiskZones} zones almost full`} color={avgOccupancy > 90 ? "var(--color-danger)" : avgOccupancy > 80 ? "var(--color-warning)" : "var(--color-success)"} icon={Package} cardStyle={cardStyle} />
        <KpiCard label="Fixed"          value={String(INCIDENTS.filter(i => i.status !== "open" && i.status !== "escalated").length)} sub="Incidents resolved" color="var(--color-success)" icon={CheckCircle2} cardStyle={cardStyle} />
      </div>

      <div className="h-px mb-5" style={{ background: "linear-gradient(90deg, transparent, rgba(229,82,26,0.35), transparent)" }} />

      {/* ── Cameras ────────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <SectionHeading sub="Live status of all 6 cameras">📷 Camera Status</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-2.5">
          {CAMERAS.map((cam) => {
            const online = cam.status === "online";
            const col = online ? "var(--color-success)" : "var(--color-danger)";
            return (
              <div key={cam.id} className="rounded-[12px] p-3" style={cardStyle}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] sm:text-[12px] font-black" style={{ color: "var(--text-primary)" }}>
                    {cam.location}
                  </span>
                  <span
                    className="flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full"
                    style={{ background: `${col}15`, color: col, border: `1px solid ${col}30` }}
                  >
                    {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {online ? "ON" : "OFF"}
                  </span>
                </div>
                <div className="text-[9px] mt-1 font-bold" style={{ color: "var(--text-faint)" }}>
                  {cam.zone}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Throughput Chart ───────────────────────────────────────────────── */}
      <div className="rounded-[14px] p-4 sm:p-[18px] mb-5" style={cardStyle}>
        {/* Chart header */}
        <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
          <div>
            <span className="text-[13px] font-black" style={{ color: "var(--text-primary)" }}>
              📦 Daily Throughput — Bags
            </span>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              How many bags entered and left the depot each day
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: "#E5521A" }} />
              <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>Bags In</span>
              <span className="text-[10px] font-black" style={{ color: "#E5521A" }}>{fmtK(WEEKLY_TOTALS.enter)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(91,155,245,0.85)" }} />
              <span className="text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>Bags Out</span>
              <span className="text-[10px] font-black" style={{ color: "var(--color-info)" }}>{fmtK(WEEKLY_TOTALS.exit)}</span>
            </div>
          </div>
        </div>

        {/* Grouped bars */}
        <div className="w-full overflow-x-auto">
          <div className="flex items-end gap-3 sm:gap-5" style={{ minWidth: 300, minHeight: CHART_H + 52 }}>
            {WEEKLY.map((day, i) => {
              const eH   = Math.max(8, Math.round((day.enter / MAX_BAR) * CHART_H));
              const xH   = Math.max(8, Math.round((day.exit  / MAX_BAR) * CHART_H));
              const peak = i === 4;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" style={{ minWidth: 40 }}>
                  <div className="flex items-end gap-[5px]" style={{ height: CHART_H }}>
                    {/* In bar */}
                    <div className="flex flex-col items-center justify-end gap-[3px]" style={{ height: CHART_H }}>
                      <span className="text-[10px] font-bold" style={{ color: peak ? "#E5521A" : "var(--text-muted)" }}>
                        {day.enter}
                      </span>
                      <div style={{
                        width: "clamp(16px,2.4vw,28px)", height: eH,
                        borderRadius: "4px 4px 0 0",
                        background: peak
                          ? "linear-gradient(to bottom,#FF7A42,rgba(255,122,66,0.55))"
                          : "linear-gradient(to bottom,rgba(229,82,26,0.92),rgba(229,82,26,0.38))",
                        filter: peak ? "drop-shadow(0 0 6px rgba(229,82,26,0.55))" : undefined,
                      }} />
                    </div>
                    {/* Out bar */}
                    <div className="flex flex-col items-center justify-end gap-[3px]" style={{ height: CHART_H }}>
                      <span className="text-[10px] font-bold" style={{ color: peak ? "var(--color-info)" : "var(--text-faint)" }}>
                        {day.exit}
                      </span>
                      <div style={{
                        width: "clamp(16px,2.4vw,28px)", height: xH,
                        borderRadius: "4px 4px 0 0",
                        background: peak
                          ? "linear-gradient(to bottom,rgba(91,155,245,1),rgba(91,155,245,0.5))"
                          : "linear-gradient(to bottom,rgba(91,155,245,0.85),rgba(91,155,245,0.28))",
                      }} />
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-[11px]"
                    style={{ color: peak ? "#E5521A" : "var(--text-faint)", fontWeight: peak ? 900 : 600 }}>
                    {DAYS[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary strip */}
        <div className="mt-4 pt-3 grid grid-cols-2 gap-2 sm:gap-3"
          style={{ borderTop: "1px solid var(--border-default)" }}>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ backgroundColor: "rgba(229,82,26,0.07)", border: "1px solid rgba(229,82,26,0.15)" }}>
            <ArrowUpCircle className="w-4 h-4 shrink-0" style={{ color: "#E5521A" }} />
            <div>
              <div className="text-[9px] font-black uppercase" style={{ color: "var(--text-faint)" }}>Total Bags In</div>
              <div className="text-[14px] sm:text-[15px] font-extrabold" style={{ color: "#E5521A" }}>
                {WEEKLY_TOTALS.enter} this week
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ backgroundColor: "rgba(91,155,245,0.07)", border: "1px solid rgba(91,155,245,0.18)" }}>
            <ArrowDownCircle className="w-4 h-4 shrink-0" style={{ color: "var(--color-info)" }} />
            <div>
              <div className="text-[9px] font-black uppercase" style={{ color: "var(--text-faint)" }}>Total Bags Out</div>
              <div className="text-[14px] sm:text-[15px] font-extrabold" style={{ color: "var(--color-info)" }}>
                {WEEKLY_TOTALS.exit} this week
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Zone Capacity ──────────────────────────────────────────────────── */}
      <div className="rounded-[14px] p-4 sm:p-[18px] mb-5" style={cardStyle}>
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
          <SectionHeading sub="">🏭 Storage Zone Levels</SectionHeading>
          {atRiskZones > 0 && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full border"
              style={{ background: "rgba(245,166,35,0.12)", color: "var(--color-warning)", borderColor: "rgba(245,166,35,0.25)" }}>
              {atRiskZones} zone{atRiskZones > 1 ? "s" : ""} need attention
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {ZONES.map((z) => {
            const col   = zoneColor(z.pct);
            const label = zoneLabel(z.pct);
            return (
              <div key={z.id} className="rounded-[12px] p-3 sm:p-4" style={innerCard}>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[13px] sm:text-[15px] font-black" style={{ color: "var(--text-primary)" }}>
                    {z.name}
                  </span>
                  <span className="text-[15px] sm:text-[18px] font-extrabold" style={{ color: col }}>
                    {z.pct}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2.5 sm:h-3 rounded-full overflow-hidden mb-2"
                  style={{ backgroundColor: "var(--bg-surface-3)" }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${z.pct}%`, background: col }} />
                </div>
                {/* Status label */}
                <div className="text-[9px] sm:text-[10px] font-black" style={{ color: col }}>{label}</div>
                <div className="text-[9px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                  {z.used.toLocaleString()} / {z.total.toLocaleString()} bags
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Incidents ──────────────────────────────────────────────────────── */}
      <div className="rounded-[14px] p-4 sm:p-[18px]" style={cardStyle}>
        <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
          <div>
            <SectionHeading sub="">🚨 Active Incidents</SectionHeading>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {critCount > 0 && (
              <span className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full border"
                style={{ background: "rgba(240,74,74,0.10)", color: "var(--color-danger)", borderColor: "rgba(240,74,74,0.25)" }}>
                <TriangleAlert className="w-3 h-3" />
                {critCount} Urgent
              </span>
            )}
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full border"
              style={{ background: "rgba(245,166,35,0.10)", color: "var(--color-warning)", borderColor: "rgba(245,166,35,0.25)" }}>
              {openCount} Needs Action
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {activeIncidents.map((inc) => {
            const sc  = sevColor(inc.severity);
            const sb  = statusBg(inc.status);
            const Icon = inc.icon;
            return (
              <div key={inc.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/depot/incidents?incident=${encodeURIComponent(inc.id)}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/depot/incidents?incident=${encodeURIComponent(inc.id)}`);
                  }
                }}
                className="rounded-[14px] overflow-hidden transition-all hover:-translate-y-0.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#E5521A]/50"
                style={{ ...innerCard, borderLeft: `4px solid ${sc}` }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = sc)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-default)")}
              >
                {/* Coloured top strip */}
                <div className="px-3 pt-3 pb-2">
                  {/* Status badge */}
                  <div className="flex justify-between items-start gap-1.5 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" style={{ color: sc }} />
                      <span className="text-[11px] sm:text-[12px] font-black leading-tight" style={{ color: sc }}>
                        {inc.title}
                      </span>
                    </div>
                    <span className="text-[8px] sm:text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                      style={{ background: sb.bg, color: sb.text, border: `1px solid ${sb.border}` }}>
                      {sb.label}
                    </span>
                  </div>

                  {/* What happened — plain language */}
                  <div className="rounded-lg px-2.5 py-2 mb-2"
                    style={{ backgroundColor: "var(--bg-surface-3)", border: "1px solid var(--border-default)" }}>
                    <div className="text-[9px] font-black uppercase mb-1" style={{ color: "var(--text-faint)" }}>What happened</div>
                    <p className="text-[10px] sm:text-[11px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
                      {inc.what}
                    </p>
                  </div>

                  {/* Action needed */}
                  <div className="rounded-lg px-2.5 py-2 mb-2"
                    style={{ backgroundColor: `${sc}0D`, border: `1px solid ${sc}25` }}>
                    <div className="text-[9px] font-black uppercase mb-0.5" style={{ color: sc }}>Action needed</div>
                    <p className="text-[10px] sm:text-[11px] leading-snug font-bold" style={{ color: sc }}>
                      {inc.doWhat}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="flex justify-between items-center text-[9px]" style={{ color: "var(--text-faint)" }}>
                    <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                      <span className="font-bold truncate" style={{ color: "var(--text-muted)" }}>
                        📍 {inc.where}
                      </span>
                      <span className="truncate">👤 {inc.assignee}</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span>{inc.ago}</span>
                      {inc.countdown !== undefined && (
                        <span className="flex items-center gap-0.5 font-black" style={{ color: "var(--color-warning)" }}>
                          <Clock className="w-3 h-3" />
                          {inc.countdown}m left
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* All-clear state (if no incidents) */}
        {activeIncidents.length === 0 && (
          <div className="text-center py-10">
            <CircleDot className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--color-success)" }} />
            <p className="font-black" style={{ color: "var(--color-success)" }}>All clear — no active incidents</p>
          </div>
        )}
      </div>
    </div>
  );
}
