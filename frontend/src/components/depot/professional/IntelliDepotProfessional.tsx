"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Brain,
  Boxes,
  Camera,
  ChartColumn,
  ChevronRight,
  CircleAlert,
  Command,
  Factory,
  Gauge,
  Link2,
  MoonStar,
  RefreshCw,
  Settings,
  Shield,
  SunMedium,
  Truck,
} from "lucide-react";
import {
  aiRecommendations,
  analyticsPoints,
  anomalies,
  apiHealth,
  auditLog,
  cameras,
  certificateExpiry,
  clusters,
  commandFeed,
  complianceRows,
  depots,
  fleetRows,
  incidentsSeed,
  iotDevices,
  leakages,
  operationsChecklists,
  operationsExceptions,
  operationsTasks,
  scenarios,
  settingsIntegrations,
  throughput,
  type IncidentRecord,
  type IncidentSeverity,
  type IncidentStatus,
} from "./data";

type PageKey =
  | "dashboard"
  | "command"
  | "vision"
  | "inventory"
  | "ops"
  | "incidents"
  | "sla"
  | "analytics"
  | "brain"
  | "connect"
  | "risk"
  | "settings";

type ClusterFilter = "all" | "full" | "empty" | "fifo";
type IncidentFilter = "all" | IncidentStatus | IncidentSeverity;

const navItems: { id: PageKey; label: string; short: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "command", label: "Command", short: "CMD", icon: Command },
  { id: "dashboard", label: "Dashboard", short: "DASH", icon: Gauge },
  { id: "vision", label: "Vision", short: "VIS", icon: Camera },
  { id: "inventory", label: "Inventory", short: "INV", icon: Boxes },
  { id: "ops", label: "Operations", short: "OPS", icon: Factory },
  { id: "incidents", label: "Incidents", short: "INC", icon: AlertTriangle },
  { id: "sla", label: "Fleet", short: "FLEET", icon: Truck },
  { id: "analytics", label: "Analytics", short: "DATA", icon: ChartColumn },
  { id: "brain", label: "AI Brain", short: "AI", icon: Brain },
  { id: "connect", label: "Connect", short: "LINK", icon: Link2 },
  { id: "risk", label: "Risk", short: "RISK", icon: Shield },
  { id: "settings", label: "Settings", short: "SET", icon: Settings },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function severityClasses(severity: IncidentSeverity) {
  if (severity === "CRITICAL") return "border-red-500/35 bg-red-500/10 text-red-300";
  if (severity === "HIGH") return "border-orange-500/35 bg-orange-500/10 text-orange-300";
  if (severity === "MEDIUM") return "border-yellow-500/35 bg-yellow-500/10 text-yellow-300";
  return "border-emerald-500/35 bg-emerald-500/10 text-emerald-300";
}

function statusClasses(status: IncidentStatus) {
  if (status === "resolved") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  if (status === "acknowledged") return "bg-sky-500/10 text-sky-300 border-sky-500/30";
  return "bg-amber-500/10 text-amber-300 border-amber-500/30";
}

export function IntelliDepotProfessional() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [selectedDepotId, setSelectedDepotId] = useState(depots[0].id);
  const [isLight, setIsLight] = useState(false);
  const [clusterSearch, setClusterSearch] = useState("");
  const [clusterFilter, setClusterFilter] = useState<ClusterFilter>("all");
  const [incidentFilter, setIncidentFilter] = useState<IncidentFilter>("all");
  const [liveActive, setLiveActive] = useState(true);
  const [incidents, setIncidents] = useState(incidentsSeed);
  const [flashMessage, setFlashMessage] = useState("Native React rebuild active. Original legacy HTML is no longer driving this screen.");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const saved = window.localStorage.getItem("fidelis_theme");
    if (saved === "light") setIsLight(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("fidelis_theme", isLight ? "light" : "dark");
  }, [isLight]);

  const depot = depots.find((item) => item.id === selectedDepotId) ?? depots[0];
  const openIncidents = incidents.filter((incident) => incident.status !== "resolved");
  const criticalCount = incidents.filter((incident) => incident.severity === "CRITICAL").length;
  const throughputCurrent = 820 + ((refreshTick * 17) % 101);

  const visibleClusters = clusters.filter((cluster) => {
    const query = clusterSearch.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      cluster.id.toLowerCase().includes(query) ||
      cluster.product.toLowerCase().includes(query) ||
      cluster.zone.toLowerCase().includes(query);
    if (!matchesSearch) return false;
    const occupancy = Math.round((cluster.occupied / cluster.capacity) * 100);
    if (clusterFilter === "full") return occupancy >= 90;
    if (clusterFilter === "empty") return cluster.occupied === 0;
    if (clusterFilter === "fifo") return !cluster.fifoOk;
    return true;
  });

  const visibleIncidents = incidents.filter((incident) => {
    if (incidentFilter === "all") return true;
    if (incidentFilter === "open" || incidentFilter === "acknowledged" || incidentFilter === "resolved") {
      return incident.status === incidentFilter;
    }
    return incident.severity === incidentFilter;
  });

  const theme = isLight
    ? {
        shell: "bg-[#eef3fb] text-[#0f1c33]",
        panel: "bg-white border-[#dce4f1]",
        panelSoft: "bg-[#f7f9fc] border-[#dce4f1]",
        textSubtle: "text-[#4a5e7a]",
        nav: "bg-white border-[#dce4f1]",
        input: "bg-[#f5f7fc] border-[#dce4f1]",
      }
    : {
        shell: "bg-[#080d18] text-[#e8edf8]",
        panel: "bg-[#111e35] border-[#1c2d4f]",
        panelSoft: "bg-[#0d1526] border-[#1c2d4f]",
        textSubtle: "text-[#7a8fae]",
        nav: "bg-[#0b1220] border-[#1c2d4f]",
        input: "bg-[#0d1526] border-[#1c2d4f]",
      };

  const acknowledgeIncident = (id: string) => {
    setIncidents((current) => current.map((incident) => (incident.id === id ? { ...incident, status: "acknowledged", assignee: "Control Room" } : incident)));
    setFlashMessage(`Incident ${id} acknowledged and assigned to Control Room.`);
  };

  const refreshData = () => {
    setRefreshTick((value) => value + 1);
    setFlashMessage(`Live depot telemetry refreshed for ${depot.name}.`);
  };

  const reportIncident = () => {
    const newIncident: IncidentRecord = {
      id: `INC-${String(incidents.length + 1).padStart(3, "0")}`,
      type: "Manual Report",
      severity: "HIGH",
      location: depot.name,
      timeAgo: "Just now",
      status: "open",
      camera: "-",
      description: "Incident raised from the native Next.js control surface.",
      assignee: "-",
    };
    setIncidents((current) => [newIncident, ...current]);
    setPage("incidents");
    setFlashMessage(`New incident ${newIncident.id} added to the control queue.`);
  };

  return (
    <div className={cn("min-h-screen transition-colors duration-300", theme.shell)}>
      <div className="grid min-h-screen grid-cols-[64px_1fr] grid-rows-[56px_1fr]">
        <header className={cn("col-span-2 flex items-center gap-3 border-b px-4", theme.nav)}>
          <button type="button" onClick={() => setPage("dashboard")} className="flex items-center gap-3 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#c43a08] to-[#e5521a] shadow-[0_0_18px_rgba(229,82,26,0.25)]">
              <Image src="/fidelis-logo.png" alt="Fidelis logo" width={22} height={22} className="h-5 w-5 object-contain" />
            </div>
            <div>
              <p className="text-[15px] font-extrabold tracking-tight text-[#e5521a]">Fidelis</p>
              <p className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", theme.textSubtle)}>IntelliDepot Professional</p>
            </div>
          </button>

          <div className="h-7 w-px bg-white/10" />

          <select value={selectedDepotId} onChange={(event) => setSelectedDepotId(event.target.value)} className={cn("rounded-lg border px-3 py-2 text-xs font-semibold outline-none", theme.input)}>
            {depots.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.location})
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-3">
            <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold", liveActive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-white/5 text-white/50")}>
              <span className={cn("h-2 w-2 rounded-full", liveActive ? "animate-pulse bg-emerald-400" : "bg-white/30")} />
              {liveActive ? "LIVE SYNC" : "PAUSED"}
            </div>
            <button type="button" onClick={() => setLiveActive((value) => !value)} className={cn("rounded-lg border p-2 transition hover:border-[#e5521a]/50", theme.panelSoft)}>
              {liveActive ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button type="button" onClick={refreshData} className={cn("rounded-lg border p-2 transition hover:border-[#e5521a]/50", theme.panelSoft)}>
              <RefreshCw className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setIsLight((value) => !value)} className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold", theme.panelSoft)}>
              {isLight ? <SunMedium className="h-4 w-4 text-amber-500" /> : <MoonStar className="h-4 w-4 text-sky-300" />}
              {isLight ? "Light" : "Dark"}
            </button>
          </div>
        </header>

        <aside className={cn("flex flex-col items-center gap-2 border-r px-2 py-3", theme.nav)}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.id === page;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPage(item.id)}
                title={item.label}
                className={cn("relative flex w-full flex-col items-center gap-1 rounded-xl border px-1 py-3 text-[10px] font-semibold transition", active ? "border-[#e5521a]/50 bg-[#e5521a]/12 text-white shadow-[0_10px_30px_rgba(229,82,26,0.18)]" : cn(theme.panelSoft, "hover:border-[#e5521a]/30"))}
              >
                <Icon className={cn("h-4 w-4", item.id === "incidents" && criticalCount > 0 ? "text-red-400" : "")} />
                <span>{item.short}</span>
                {item.id === "incidents" ? <span className="absolute right-1 top-1 rounded-full bg-red-500 px-1.5 text-[9px] text-white">{openIncidents.length}</span> : null}
              </button>
            );
          })}
        </aside>

        <main className="overflow-y-auto">
          <div className="mx-auto max-w-[1480px] p-5">
            <div className={cn("mb-5 flex items-center justify-between rounded-2xl border px-4 py-3", theme.panel)}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e5521a]">Native Next.js Workspace</p>
                <p className={cn("mt-1 text-sm", theme.textSubtle)}>{flashMessage}</p>
              </div>
              <button type="button" onClick={reportIncident} className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white">
                Report Incident
              </button>
            </div>

            {page === "dashboard" ? <DashboardView depot={depot} throughputCurrent={throughputCurrent} incidents={incidents} panelClass={theme.panel} panelSoftClass={theme.panelSoft} subtleTextClass={theme.textSubtle} /> : null}
            {page === "command" ? <CommandView depot={depot} panelClass={theme.panel} panelSoftClass={theme.panelSoft} /> : null}
            {page === "vision" ? <VisionView panelClass={theme.panel} panelSoftClass={theme.panelSoft} subtleTextClass={theme.textSubtle} /> : null}
            {page === "inventory" ? <InventoryView panelClass={theme.panel} panelSoftClass={theme.panelSoft} subtleTextClass={theme.textSubtle} clusterSearch={clusterSearch} setClusterSearch={setClusterSearch} clusterFilter={clusterFilter} setClusterFilter={setClusterFilter} visibleClusters={visibleClusters} /> : null}
            {page === "incidents" ? <IncidentsView panelClass={theme.panel} panelSoftClass={theme.panelSoft} incidents={visibleIncidents} totalIncidents={incidents} incidentFilter={incidentFilter} setIncidentFilter={setIncidentFilter} acknowledgeIncident={acknowledgeIncident} /> : null}
            {page === "ops" ? <OperationsView panelClass={theme.panel} panelSoftClass={theme.panelSoft} /> : null}
            {page === "sla" ? <FleetView panelClass={theme.panel} panelSoftClass={theme.panelSoft} depot={depot} /> : null}
            {page === "analytics" ? <AnalyticsView panelClass={theme.panel} panelSoftClass={theme.panelSoft} /> : null}
            {page === "brain" ? <BrainView panelClass={theme.panel} panelSoftClass={theme.panelSoft} /> : null}
            {page === "connect" ? <ConnectView panelClass={theme.panel} panelSoftClass={theme.panelSoft} /> : null}
            {page === "risk" ? <RiskView panelClass={theme.panel} panelSoftClass={theme.panelSoft} /> : null}
            {page === "settings" ? <SettingsView panelClass={theme.panel} panelSoftClass={theme.panelSoft} /> : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function PauseIcon() {
  return (
    <div className="flex gap-1">
      <span className="block h-4 w-1 rounded bg-current" />
      <span className="block h-4 w-1 rounded bg-current" />
    </div>
  );
}

function PlayIcon() {
  return <div className="h-0 w-0 border-y-[8px] border-l-[12px] border-y-transparent border-l-current" />;
}

function DashboardView({
  depot,
  throughputCurrent,
  incidents,
  panelClass,
  panelSoftClass,
  subtleTextClass,
}: {
  depot: (typeof depots)[number];
  throughputCurrent: number;
  incidents: IncidentRecord[];
  panelClass: string;
  panelSoftClass: string;
  subtleTextClass: string;
}) {
  const activeAlerts = incidents.filter((incident) => incident.status !== "resolved").slice(0, 4);
  const peak = Math.max(...throughput);

  return (
    <div className="space-y-5">
      <section className={cn("rounded-[28px] border p-6", panelClass)}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">Live Operations</div>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em]">{depot.name}</h1>
            <p className={cn("mt-2 text-sm", subtleTextClass)}>{depot.location} · Real-time depot intelligence with AI-assisted control loops</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricChip label="Depot Health" value={`${depot.health}%`} valueClass="text-[#e5521a]" />
            <MetricChip label="Active Trucks" value={`${depot.trucks}/15`} valueClass="text-emerald-400" />
            <MetricChip label="Cameras Online" value={`${depot.cameras}/14`} valueClass="text-sky-400" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-6">
        <KpiCard panelClass={panelClass} label="Bag Count Accuracy" value="99.8%" detail="+12.5% vs manual" tone="emerald" />
        <KpiCard panelClass={panelClass} label="FIFO Compliance" value={`${depot.fifo.toFixed(1)}%`} detail="+8.2% MoM" tone="emerald" />
        <KpiCard panelClass={panelClass} label="Avg Loading Time" value={`${depot.loadMinutes} min`} detail="-35% faster" tone="sky" />
        <KpiCard panelClass={panelClass} label="Depot Occupancy" value={`${depot.utilization}%`} detail="Optimal range" tone="orange" />
        <KpiCard panelClass={panelClass} label="Throughput" value={`${throughputCurrent} t/d`} detail="+15% capacity" tone="emerald" />
        <KpiCard panelClass={panelClass} label="Loss Prevention" value="INR 42K/mo" detail="+INR 8K gain" tone="amber" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <div className={cn("rounded-[28px] border p-5", panelClass)}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Daily Throughput</h2>
            <span className="rounded-full border border-[#e5521a]/20 bg-[#e5521a]/10 px-3 py-1 text-xs font-semibold text-[#ff8b5c]">This week</span>
          </div>
          <div className="flex h-48 items-end gap-4 rounded-2xl border border-white/5 px-4 pb-6 pt-4">
            {throughput.map((value, index) => {
              const height = `${Math.max(18, Math.round((value / peak) * 100))}%`;
              const label = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index];
              return (
                <div key={label} className="flex flex-1 flex-col items-center gap-3">
                  <span className="text-xs text-white/55">{(value / 1000).toFixed(1)}k</span>
                  <div className="flex h-full w-full items-end">
                    <div className={cn("w-full rounded-t-xl", index === 4 ? "bg-[#ff7a42]" : "bg-gradient-to-t from-[#8a2d0d] to-[#e5521a]")} style={{ height }} />
                  </div>
                  <span className="text-xs text-white/50">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={cn("rounded-[28px] border p-5", panelClass)}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Live Alerts</h2>
            <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">{activeAlerts.length} active</span>
          </div>
          <div className="space-y-3">
            {activeAlerts.map((incident) => (
              <div key={incident.id} className={cn("rounded-2xl border-l-4 p-4", panelSoftClass, severityClasses(incident.severity))}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{incident.type}</p>
                  <span className="text-xs">{incident.timeAgo}</span>
                </div>
                <p className="mt-1 text-sm text-white/70">{incident.location}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function CommandView({ depot, panelClass, panelSoftClass }: { depot: (typeof depots)[number]; panelClass: string; panelSoftClass: string }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <section className={cn("rounded-[28px] border p-5", panelClass)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff8b5c]">Global Depot Command</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Multi-depot orchestration</h2>
          </div>
          <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">AI prioritized</span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {depots.map((item) => (
            <div key={item.id} className={cn("rounded-3xl border p-4", item.id === depot.id ? "border-[#e5521a]/45 bg-[#e5521a]/10" : panelSoftClass)}>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{item.name}</p>
                <span className="rounded-full bg-white/5 px-2 py-1 text-xs">{item.id}</span>
              </div>
              <p className="mt-2 text-sm text-white/60">{item.location}</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span>Health</span><span className="font-semibold text-emerald-400">{item.health}%</span></div>
                <div className="flex justify-between"><span>Utilization</span><span>{item.utilization}%</span></div>
                <div className="flex justify-between"><span>Trucks</span><span>{item.trucks}</span></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={cn("rounded-[28px] border p-5", panelClass)}>
        <h2 className="text-xl font-bold">Global feed</h2>
        <div className="mt-4 space-y-3">
          {commandFeed.map((item) => (
            <div key={item} className={cn("flex items-start gap-3 rounded-2xl border p-4", panelSoftClass)}>
              <ChevronRight className="mt-0.5 h-4 w-4 text-[#ff8b5c]" />
              <p className="text-sm leading-6 text-white/75">{item}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function VisionView({ panelClass, subtleTextClass }: { panelClass: string; panelSoftClass: string; subtleTextClass: string }) {
  return (
    <div className="space-y-5">
      <section className={cn("rounded-[28px] border p-5", panelClass)}>
        <h2 className="text-2xl font-black tracking-[-0.04em]">IntelliVision command wall</h2>
        <p className={cn("mt-2 text-sm", subtleTextClass)}>Live camera confidence, edge AI detections, and activity summaries across the depot.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cameras.map((cameraItem) => (
          <div key={cameraItem.id} className={cn("rounded-[26px] border p-4", panelClass)}>
            <div className={cn("relative h-44 overflow-hidden rounded-2xl border", cameraItem.status === "inactive" ? "border-white/10 bg-black/30" : cameraItem.status === "alert" ? "border-red-500/30 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.14),rgba(7,10,18,0.95))]" : "border-white/10 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.12),rgba(7,10,18,0.95))]")}>
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.28))]" />
              <div className="absolute left-3 top-3 rounded-full bg-black/45 px-2 py-1 text-[10px] font-semibold">{cameraItem.id}</div>
              <div className={cn("absolute right-3 top-3 rounded-full px-2 py-1 text-[10px] font-semibold uppercase", cameraItem.status === "active" ? "bg-emerald-500/10 text-emerald-300" : cameraItem.status === "alert" ? "bg-red-500/10 text-red-300" : "bg-white/10 text-white/50")}>{cameraItem.status}</div>
              {cameraItem.status === "inactive" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/45">
                  <Camera className="h-8 w-8" />
                  <p className="text-sm font-medium">Camera offline</p>
                </div>
              ) : (
                <div className="absolute bottom-3 left-3 right-3 grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-xl bg-black/35 px-2 py-1.5">Vehicles {cameraItem.vehicles}</div>
                  <div className="rounded-xl bg-black/35 px-2 py-1.5">Pallets {cameraItem.pallets}</div>
                  <div className="rounded-xl bg-black/35 px-2 py-1.5">People {cameraItem.people}</div>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{cameraItem.name}</p>
                <p className="mt-1 text-sm text-white/60">{cameraItem.resolution} · {cameraItem.fps} fps · {cameraItem.confidence}% confidence</p>
              </div>
              <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", cameraItem.activity === "HIGH" ? "bg-orange-500/10 text-orange-300" : cameraItem.activity === "MEDIUM" ? "bg-yellow-500/10 text-yellow-300" : cameraItem.activity === "LOW" ? "bg-sky-500/10 text-sky-300" : "bg-white/10 text-white/40")}>{cameraItem.activity}</span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function InventoryView({
  panelClass,
  panelSoftClass,
  subtleTextClass,
  clusterSearch,
  setClusterSearch,
  clusterFilter,
  setClusterFilter,
  visibleClusters,
}: {
  panelClass: string;
  panelSoftClass: string;
  subtleTextClass: string;
  clusterSearch: string;
  setClusterSearch: (value: string) => void;
  clusterFilter: ClusterFilter;
  setClusterFilter: (value: ClusterFilter) => void;
  visibleClusters: typeof clusters;
}) {
  return (
    <div className="space-y-5">
      <section className={cn("rounded-[28px] border p-5", panelClass)}>
        <h2 className="text-2xl font-black tracking-[-0.04em]">Inventory intelligence</h2>
        <p className={cn("mt-2 text-sm", subtleTextClass)}>Search storage clusters, watch occupancy pressure, and flag FIFO exceptions before they turn into loss.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input value={clusterSearch} onChange={(event) => setClusterSearch(event.target.value)} placeholder="Search by cluster, zone, or product" className="min-w-[260px] flex-1 rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm outline-none" />
          {(["all", "full", "empty", "fifo"] as ClusterFilter[]).map((value) => (
            <button key={value} type="button" onClick={() => setClusterFilter(value)} className={cn("rounded-full border px-3 py-2 text-xs font-semibold uppercase", clusterFilter === value ? "border-[#e5521a]/40 bg-[#e5521a]/12 text-white" : panelSoftClass)}>
              {value === "all" ? "All clusters" : value === "full" ? "Near full" : value === "empty" ? "Empty" : "FIFO warn"}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleClusters.map((cluster) => {
          const occupancy = Math.round((cluster.occupied / cluster.capacity) * 100);
          const occupancyClass = occupancy >= 90 ? "text-red-300" : occupancy >= 75 ? "text-amber-300" : "text-emerald-300";
          return (
            <div key={cluster.id} className={cn("rounded-[26px] border p-4", panelClass)}>
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold">{cluster.id}</p>
                <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-semibold">Zone {cluster.zone}</span>
              </div>
              <p className="mt-2 text-sm text-white/70">{cluster.product}</p>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>Occupancy</span>
                  <span className={cn("font-semibold", occupancyClass)}>{occupancy}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/8">
                  <div className={cn("h-2 rounded-full", occupancy >= 90 ? "bg-red-500" : occupancy >= 75 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${occupancy}%` }} />
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-white/65">
                <div className="flex justify-between"><span>Batch</span><span>{cluster.batch}</span></div>
                <div className="flex justify-between"><span>Expiry</span><span>{cluster.expiry}</span></div>
                <div className="flex justify-between"><span>Last activity</span><span>{cluster.activity}</span></div>
                <div className="flex justify-between"><span>FIFO</span><span className={cluster.fifoOk ? "text-emerald-300" : "text-red-300"}>{cluster.fifoOk ? "Compliant" : "Warning"}</span></div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function IncidentsView({
  panelClass,
  panelSoftClass,
  incidents,
  totalIncidents,
  incidentFilter,
  setIncidentFilter,
  acknowledgeIncident,
}: {
  panelClass: string;
  panelSoftClass: string;
  incidents: IncidentRecord[];
  totalIncidents: IncidentRecord[];
  incidentFilter: IncidentFilter;
  setIncidentFilter: (value: IncidentFilter) => void;
  acknowledgeIncident: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <section className={cn("rounded-[28px] border p-5", panelClass)}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">Incidents and security alerts</div>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.04em]">Incident management center</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <MetricChip label="Open" value={`${totalIncidents.filter((item) => item.status === "open").length}`} valueClass="text-amber-300" />
            <MetricChip label="Acknowledged" value={`${totalIncidents.filter((item) => item.status === "acknowledged").length}`} valueClass="text-sky-300" />
            <MetricChip label="Resolved" value={`${totalIncidents.filter((item) => item.status === "resolved").length}`} valueClass="text-emerald-300" />
            <MetricChip label="Critical" value={`${totalIncidents.filter((item) => item.severity === "CRITICAL").length}`} valueClass="text-red-300" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          {(["all", "open", "acknowledged", "resolved", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as IncidentFilter[]).map((value) => (
            <button key={value} type="button" onClick={() => setIncidentFilter(value)} className={cn("rounded-full border px-3 py-2 text-xs font-semibold uppercase", incidentFilter === value ? "border-[#e5521a]/40 bg-[#e5521a]/12 text-white" : panelSoftClass)}>
              {value}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        {incidents.map((incident) => (
          <div key={incident.id} className={cn("rounded-[28px] border p-5", panelClass)}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", severityClasses(incident.severity))}>{incident.severity}</span>
                  <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase", statusClasses(incident.status))}>{incident.status}</span>
                </div>
                <h3 className="mt-3 text-xl font-bold">{incident.type}</h3>
                <p className="mt-1 text-sm text-white/60">{incident.location} · {incident.timeAgo} · Camera {incident.camera}</p>
              </div>
              {incident.status === "open" ? <button type="button" onClick={() => acknowledgeIncident(incident.id)} className="rounded-full bg-[#e5521a] px-4 py-2 text-sm font-semibold text-white">Acknowledge</button> : null}
            </div>
            <p className="mt-4 text-sm leading-6 text-white/75">{incident.description}</p>
            <div className="mt-4 flex items-center gap-2 text-sm text-white/55">
              <CircleAlert className="h-4 w-4" />
              Assignee: {incident.assignee}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function OperationsView({ panelClass, panelSoftClass }: { panelClass: string; panelSoftClass: string }) {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <ContentListCard title="Priority tasks" panelClass={panelClass} items={operationsTasks.map((task) => `${task.title} · ${task.owner} · ${task.priority}`)} />
      <ContentListCard title="Operational checklist" panelClass={panelClass} items={operationsChecklists} />
      <ContentListCard title="Exceptions" panelClass={panelClass} items={operationsExceptions} />
      <div className={cn("xl:col-span-3 rounded-[28px] border p-5", panelSoftClass)}>
        <p className="text-sm text-white/70">This section is now React-driven and ready to connect to real task APIs, checklist completion state, and workflow automation.</p>
      </div>
    </div>
  );
}

function FleetView({ panelClass, panelSoftClass, depot }: { panelClass: string; panelSoftClass: string; depot: (typeof depots)[number] }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard panelClass={panelClass} label="Average dwell" value={`${depot.loadMinutes} min`} detail="Target below 30 min" tone="emerald" />
        <KpiCard panelClass={panelClass} label="Fleet utilization" value={`${depot.trucks}/15`} detail="Active loading lanes" tone="sky" />
        <KpiCard panelClass={panelClass} label="On-time SLA" value="96.4%" detail="+6.8% this week" tone="emerald" />
      </section>
      <section className={cn("rounded-[28px] border p-5", panelClass)}>
        <h2 className="text-xl font-bold">Truck and dock status</h2>
        <div className="mt-4 grid gap-3">
          {fleetRows.map((row) => (
            <div key={row.truck} className={cn("grid gap-3 rounded-2xl border p-4 text-sm md:grid-cols-4", panelSoftClass)}>
              <span className="font-semibold">{row.truck}</span>
              <span>{row.dock}</span>
              <span className={row.dwell > 30 ? "text-red-300" : row.dwell > 20 ? "text-amber-300" : "text-emerald-300"}>{row.dwell} min dwell</span>
              <span className="uppercase text-white/60">{row.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AnalyticsView({ panelClass, panelSoftClass }: { panelClass: string; panelSoftClass: string }) {
  const points = analyticsPoints.map((value, index) => `${36 + index * 70},${110 - value}`);
  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-3">
        <KpiCard panelClass={panelClass} label="Supervisor score" value="94" detail="+18%" tone="emerald" />
        <KpiCard panelClass={panelClass} label="Loadmen productivity" value="420 bags/hr" detail="+12%" tone="emerald" />
        <KpiCard panelClass={panelClass} label="Incident resolution" value="1.2 hrs" detail="-60%" tone="sky" />
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className={cn("rounded-[28px] border p-5", panelClass)}>
          <h2 className="text-xl font-bold">Efficiency score trend</h2>
          <svg viewBox="0 0 500 130" className="mt-4 h-44 w-full">
            <line x1="36" y1="10" x2="36" y2="110" stroke="rgba(255,255,255,0.16)" />
            <line x1="36" y1="110" x2="495" y2="110" stroke="rgba(255,255,255,0.16)" />
            <polyline points={points.join(" ")} fill="none" stroke="#e5521a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className={cn("rounded-[28px] border p-5", panelClass)}>
          <h2 className="text-xl font-bold">Detected anomalies</h2>
          <div className="mt-4 space-y-3">
            {anomalies.map((item) => (
              <div key={item.title} className={cn("rounded-2xl border p-4", panelSoftClass)}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{item.title}</p>
                  <span className={item.score >= 80 ? "text-red-300" : item.score >= 70 ? "text-orange-300" : "text-yellow-300"}>{item.score}</span>
                </div>
                <p className="mt-2 text-sm text-white/65">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function BrainView({ panelClass, panelSoftClass }: { panelClass: string; panelSoftClass: string }) {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <ContentListCard title="AI recommendations" panelClass={panelClass} items={aiRecommendations} />
      <ContentListCard title="Revenue leakage signals" panelClass={panelClass} items={leakages.map((item) => `${item.title} · ${item.status} · ${item.impact}`)} />
      <ContentListCard title="Scenario outcomes" panelClass={panelClass} items={scenarios.map((item) => `${item.title} · ${item.impact} · ${item.summary}`)} />
      <div className={cn("xl:col-span-3 rounded-[28px] border p-5", panelSoftClass)}>
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-[#ff8b5c]" />
          <p className="text-sm text-white/70">AI Brain is now a native module and can be wired to live recommendations, anomaly explanations, and multi-step automations next.</p>
        </div>
      </div>
    </div>
  );
}

function ConnectView({ panelClass, panelSoftClass }: { panelClass: string; panelSoftClass: string }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ContentListCard title="API health" panelClass={panelClass} items={apiHealth.map((item) => `${item.name} · ${item.status} · ${item.latency}`)} />
      <ContentListCard title="IoT device state" panelClass={panelClass} items={iotDevices.map((item) => `${item.name} · ${item.status} · ${item.detail}`)} />
      <div className={cn("xl:col-span-2 rounded-[28px] border p-5", panelSoftClass)}>
        <p className="text-sm text-white/70">This integration layer is ready for real connector health polling and device telemetry streams.</p>
      </div>
    </div>
  );
}

function RiskView({ panelClass, panelSoftClass }: { panelClass: string; panelSoftClass: string }) {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <ContentListCard title="Compliance posture" panelClass={panelClass} items={complianceRows.map((item) => `${item.title} · ${item.score}%`)} />
      <ContentListCard title="Certificate expiry" panelClass={panelClass} items={certificateExpiry.map((item) => `${item.title} · ${item.daysLeft} days left`)} />
      <ContentListCard title="Audit log" panelClass={panelClass} items={auditLog} />
      <div className={cn("xl:col-span-3 rounded-[28px] border p-5", panelSoftClass)}>
        <p className="text-sm text-white/70">Risk and compliance cards are now native React blocks and can be hydrated from backend audit APIs whenever you’re ready.</p>
      </div>
    </div>
  );
}

function SettingsView({ panelClass, panelSoftClass }: { panelClass: string; panelSoftClass: string }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <ContentListCard title="Connected integrations" panelClass={panelClass} items={settingsIntegrations} />
      <div className={cn("rounded-[28px] border p-5", panelClass)}>
        <h2 className="text-xl font-bold">Control settings</h2>
        <div className="mt-4 space-y-3">
          {["Incident escalation policy", "Vision confidence threshold", "Billing variance tolerance", "Night shift alert routing"].map((item) => (
            <div key={item} className={cn("flex items-center justify-between rounded-2xl border p-4", panelSoftClass)}>
              <span className="text-sm">{item}</span>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">Enabled</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricChip({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className={cn("mt-2 text-xl font-black", valueClass)}>{value}</p>
    </div>
  );
}

function KpiCard({ panelClass, label, value, detail, tone }: { panelClass: string; label: string; value: string; detail: string; tone: "emerald" | "sky" | "orange" | "amber" }) {
  const valueClass = tone === "emerald" ? "text-emerald-400" : tone === "sky" ? "text-sky-400" : tone === "orange" ? "text-[#ff8b5c]" : "text-amber-300";
  return (
    <div className={cn("rounded-[24px] border p-4", panelClass)}>
      <p className="text-sm text-white/55">{label}</p>
      <p className={cn("mt-3 text-2xl font-black tracking-[-0.04em]", valueClass)}>{value}</p>
      <p className="mt-2 text-sm text-white/55">{detail}</p>
    </div>
  );
}

function ContentListCard({ title, panelClass, items }: { title: string; panelClass: string; items: string[] }) {
  return (
    <section className={cn("rounded-[28px] border p-5", panelClass)}>
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white/75">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
