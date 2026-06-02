"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BellRing,
  Camera,
  ChevronDown,
  DoorClosed,
  DoorOpen,
  Gauge,
  Layers,
  PackageCheck,
  Phone,
  Radio,
  RefreshCw,
  Send,
  Shield,
  Timer,
  Truck,
  Users,
  X,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import {
  closeCommandGate,
  contactCommandOperator,
  openCommandGate,
  triggerCommandAlert,
  type CommandActionResponse,
  type CommandCenterSnapshot,
  type CommandGateSummary,
  type CommandKpi,
  type DepotHierarchy,
} from "@/services/depotCommand";
import { getUnifiedDepotSource } from "@/services/depotUnifiedSource";
import { useDepotCommandEvents } from "@/hooks/useDepotCommandEvents";
import { DEPOT_WAREHOUSE_ORDER, DEPOT_WAREHOUSE_REGISTRY } from "@/lib/depot-camera-registry";

const TONE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  healthy: { color: "#22D3A1", bg: "rgba(34,211,161,0.12)", border: "rgba(34,211,161,0.28)" },
  warning: { color: "#F5A623", bg: "rgba(245,166,35,0.12)", border: "rgba(245,166,35,0.28)" },
  critical: { color: "#F04A4A", bg: "rgba(240,74,74,0.12)", border: "rgba(240,74,74,0.28)" },
  normal: { color: "#5B9BF5", bg: "rgba(91,155,245,0.12)", border: "rgba(91,155,245,0.28)" },
};

const KPI_ICONS: Record<string, typeof Camera> = {
  cameras: Camera,
  bags_in: PackageCheck,
  bags_out: PackageCheck,
  vehicles: Truck,
  avg_unload: Timer,
  occupancy: Layers,
  occupancy_count: Layers,
  total_capacity: Layers,
  workers: Users,
  gates: Shield,
  incidents: AlertTriangle,
  inventory: PackageCheck,
  zones: Layers,
  access: Truck,
};

const KPI_DISPLAY_ORDER = ["bags_in", "bags_out", "total_capacity", "occupancy_count"] as const;
const HIDDEN_KPI_KEYS = new Set(["capacity_remaining", "occupancy"]);

const KPI_ROUTE_MAP: Record<string, string> = {
  bags_in: "/depot/operations",
  bags_out: "/depot/operations",
  total_capacity: "/depot/heatmap",
  occupancy_count: "/depot/heatmap",
  occupancy: "/depot/heatmap",
  incidents: "/depot/incidents",
  workers: "/depot/counting",
  avg_unload: "/depot/counting",
  vehicles: "/depot/gate",
  cameras: "/depot/vision",
};

const BROADCAST_TYPES = [
  { value: "fire_alert", label: "Fire Alert" },
  { value: "smoke_detection", label: "Smoke Detection" },
  { value: "intruder_alert", label: "Intruder Alert" },
  { value: "weather_warning", label: "Weather Warning" },
  { value: "operational_announcement", label: "Operational" },
];

const BROADCAST_AUDIENCES = [
  { value: "workers", label: "Workers" },
  { value: "warehouse_staff", label: "Warehouse Staff" },
  { value: "managers", label: "Managers" },
  { value: "custom_group", label: "Custom Group" },
];

const BROADCAST_CHANNELS = [
  { value: "email", label: "Email" },
  { value: "speaker", label: "Speaker" },
  { value: "in_app", label: "App" },
];

export type CommandPersona = "warehouse_manager" | "regional_manager" | "central_manager" | "admin";

const WAREHOUSE_LABELS: Record<string, { name: string; region: string; title: string }> = {
  WH_HYD: { name: DEPOT_WAREHOUSE_REGISTRY.WH_HYD.name, region: "South", title: `${DEPOT_WAREHOUSE_REGISTRY.WH_HYD.name} - Operations Dashboard` },
  WH_BLR: { name: DEPOT_WAREHOUSE_REGISTRY.WH_BLR.name, region: "South", title: `${DEPOT_WAREHOUSE_REGISTRY.WH_BLR.name} - Operations Dashboard` },
  WH_MUM: { name: DEPOT_WAREHOUSE_REGISTRY.WH_MUM.name, region: "West", title: `${DEPOT_WAREHOUSE_REGISTRY.WH_MUM.name} - Operations Dashboard` },
};

const ROLE_WAREHOUSE_REGISTRY = {
  WH_HYD: {
    name: DEPOT_WAREHOUSE_REGISTRY.WH_HYD.name,
    region_id: DEPOT_WAREHOUSE_REGISTRY.WH_HYD.regionId,
    zones: DEPOT_WAREHOUSE_REGISTRY.WH_HYD.zones,
    cameras: DEPOT_WAREHOUSE_REGISTRY.WH_HYD.cameras,
    metrics: { bagsIn: 1260, bagsOut: 1040, vehicles: 38, workers: 82, incidents: 2, occupancy: 74, unload: 34, health: 91 },
  },
  WH_BLR: {
    name: DEPOT_WAREHOUSE_REGISTRY.WH_BLR.name,
    region_id: DEPOT_WAREHOUSE_REGISTRY.WH_BLR.regionId,
    zones: DEPOT_WAREHOUSE_REGISTRY.WH_BLR.zones,
    cameras: DEPOT_WAREHOUSE_REGISTRY.WH_BLR.cameras,
    metrics: { bagsIn: 1435, bagsOut: 1195, vehicles: 44, workers: 76, incidents: 3, occupancy: 71, unload: 29, health: 91 },
  },
  WH_MUM: {
    name: DEPOT_WAREHOUSE_REGISTRY.WH_MUM.name,
    region_id: DEPOT_WAREHOUSE_REGISTRY.WH_MUM.regionId,
    zones: DEPOT_WAREHOUSE_REGISTRY.WH_MUM.zones,
    cameras: DEPOT_WAREHOUSE_REGISTRY.WH_MUM.cameras,
    metrics: { bagsIn: 980, bagsOut: 910, vehicles: 31, workers: 64, incidents: 1, occupancy: 82, unload: 37, health: 88 },
  },
} as const;

type RoleWarehouseId = keyof typeof ROLE_WAREHOUSE_REGISTRY;

// Zone→gate mapping: Z1→Gate A, Z2→Gate B, Z3→Gate C, Z4→no gate
// Zone→camera mapping: Z1→[cam1,cam2], Z2→[cam3], Z3→[cam4], Z4→[cam5,cam6]
const COMMAND_PAGE_GATE_SEED = [
  { suffix: "A", name: "Gate A - North Entry", status: "open" },
  { suffix: "B", name: "Gate B - South Exit", status: "closed" },
  { suffix: "C", name: "Gate C - Loading Dock", status: "open" },
] as const;

const ZONE_CAM_START_PAGE = [0, 2, 3, 4] as const;
const ZONE_CAM_COUNT_PAGE = [2, 1, 1, 2] as const;
// Gate index per zone (null = no gate for Z4)
const ZONE_GATE_IDX_PAGE = [0, 1, 2, null] as const;

function scopedWarehouseIdsForLogin(email?: string, persona?: CommandPersona): RoleWarehouseId[] {
  const normalized = (email || "").toLowerCase();
  if (persona === "warehouse_manager") {
    if (normalized.includes("wm.hyd")) return ["WH_HYD"];
    if (normalized.includes("wm.mum")) return ["WH_MUM"];
    return ["WH_BLR"];
  }
  if (persona === "regional_manager") return ["WH_BLR", "WH_HYD"];
  return DEPOT_WAREHOUSE_ORDER as RoleWarehouseId[];
}

function buildScopedHierarchy(warehouseIds: RoleWarehouseId[]): DepotHierarchy {
  const regions = [
    {
      id: "REG_SOUTH",
      name: "South Region",
      warehouses: warehouseIds.filter((id) => ROLE_WAREHOUSE_REGISTRY[id].region_id === "REG_SOUTH"),
    },
    {
      id: "REG_WEST",
      name: "West Region",
      warehouses: warehouseIds.filter((id) => ROLE_WAREHOUSE_REGISTRY[id].region_id === "REG_WEST"),
    },
  ].filter((region) => region.warehouses.length > 0);

  return {
    organization: "Fidelis",
    regions: regions.map((region) => ({
      id: region.id,
      name: region.name,
      warehouses: region.warehouses.map((warehouseId) => {
        const warehouse = ROLE_WAREHOUSE_REGISTRY[warehouseId];
        return {
          id: warehouseId,
          name: warehouse.name,
          zones: warehouse.zones.map((zone, index) => {
            const gateIdx = ZONE_GATE_IDX_PAGE[index];
            const gate = gateIdx !== null ? COMMAND_PAGE_GATE_SEED[gateIdx] : null;
            const camStart = ZONE_CAM_START_PAGE[index];
            const camCount = ZONE_CAM_COUNT_PAGE[index];
            const cameras = warehouse.cameras.slice(camStart, camStart + camCount).map((cameraId) => ({
              id: cameraId,
              name: cameraId,
              status: "live",
              zone,
              gate_id: gate ? `${warehouseId}-GATE-${gate.suffix}` : null,
            }));
            return {
              id: zone,
              name: `${zone} (Zone ${index + 1})`,
              gates: gate ? [{
                id: `${warehouseId}-GATE-${gate.suffix}`,
                name: gate.name,
                gate_code: `GATE-${gate.suffix}`,
                status: gate.status,
                cameras,
              }] : [],
              cameras,
            };
          }),
        };
      }),
    })),
  };
}

const PERSONA_PROFILES: Record<CommandPersona, {
  title: string;
  subtitle: string;
  scope: string;
  location: string;
}> = {
  warehouse_manager: {
    title: "Warehouse Manager Command Center",
    subtitle: "Live warehouse visibility, local controls, and shift-level analysis.",
    scope: "Warehouse",
    location: "Current warehouse",
  },
  regional_manager: {
    title: "Regional Manager Command Center",
    subtitle: "Multi-warehouse visibility, regional alerts, and cross-warehouse comparison.",
    scope: "Region",
    location: "India region",
  },
  central_manager: {
    title: "Central Command Center",
    subtitle: "National warehouse visibility, central governance, and major incident oversight.",
    scope: "National",
    location: "All regions",
  },
  admin: {
    title: "Administrator Command Center",
    subtitle: "Platform configuration, integrations, permissions, and operational audit.",
    scope: "Platform",
    location: "All warehouses",
  },
};

function normalizeCommandPersona(role?: string | null): CommandPersona {
  const normalized = (role || "").toLowerCase().replace(/\s+/g, "_");
  if (normalized.includes("warehouse")) return "warehouse_manager";
  if (normalized.includes("regional")) return "regional_manager";
  if (normalized.includes("central")) return "central_manager";
  if (normalized.includes("admin")) return "admin";
  return "warehouse_manager";
}

function fmtTime(value?: string | null) {
  if (!value) return "No activity";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function healthTone(score: number) {
  if (score >= 85) return TONE_STYLES.healthy;
  if (score >= 65) return TONE_STYLES.warning;
  return TONE_STYLES.critical;
}

function KpiCard({ kpi, href, hideDetail }: { kpi: CommandKpi; href?: string; hideDetail?: boolean }) {
  const tone = TONE_STYLES[kpi.tone] ?? TONE_STYLES.normal;
  const Icon = KPI_ICONS[kpi.key] ?? Activity;
  const isInteractive = typeof href === "string";

  const className = `group rounded-[12px] bg-white p-4 text-left transition duration-200 ease-out ${
    isInteractive
      ? "cursor-pointer hover:-translate-y-1 hover:scale-[1.015] hover:bg-white hover:shadow-lg hover:shadow-orange-950/10 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
      : ""
  }`;
  const cardStyle = {
    border: "1px solid var(--border-default, #1E2F50)",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  };

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4E6090]">{kpi.label}</div>
          <div className="mt-2 text-[26px] font-extrabold leading-none text-[#E8EDF8]">{kpi.value}</div>
        </div>
        <div className="flex items-center gap-2">
          {isInteractive && (
            <ArrowUpRight className="h-4 w-4 text-[#E5521A] opacity-75 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
          )}
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border" style={{ background: tone.bg, borderColor: tone.border }}>
            <Icon className="h-4 w-4" style={{ color: tone.color }} />
          </div>
        </div>
      </div>
      <div className="mt-3 text-[11px] font-semibold text-[#8A9BBF]">{!hideDetail && kpi.detail}</div>
    </>
  );

  return href ? (
    <Link href={href} className={className} style={cardStyle} aria-label={`${kpi.label}: open related tab`}>
      {content}
    </Link>
  ) : (
    <div className={className} style={cardStyle}>{content}</div>
  );
}

function GateSelector({
  gates,
  selectedGateId,
  disabled,
  onChange,
}: {
  gates: CommandGateSummary[];
  selectedGateId: string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  const selected = gates.find((gate) => gate.id === selectedGateId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4E6090]">Gate</span>
      <div className="relative">
        <select
          value={selectedGateId}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || gates.length === 0}
          className="appearance-none rounded-[10px] border border-[#1E2F50] bg-[#0D1526] py-2 pl-3 pr-8 text-[11px] font-bold text-[#E8EDF8] outline-none transition-colors hover:border-[#2A3F68] disabled:opacity-50"
        >
          {gates.map((gate) => (
            <option key={gate.id} value={gate.id}>
              {gate.gate_code} - {gate.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4E6090]" />
      </div>
      {selected && (
        <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold ${selected.status === "open" ? "bg-[#F5A623]/15 text-[#F5A623]" : "bg-[#22D3A1]/15 text-[#22D3A1]"}`}>
          {selected.status.toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default function CommandPage({ forcedPersona }: { forcedPersona?: CommandPersona } = {}) {
  const user = useAuthStore((state) => state.user);
  const personaKey = forcedPersona ?? normalizeCommandPersona(user?.role);
  const forcedWarehouseIds = useMemo(
    () => scopedWarehouseIdsForLogin(user?.email, personaKey),
    [personaKey, user?.email],
  );
  const [snapshot, setSnapshot] = useState<CommandCenterSnapshot | null>(null);
  const [hierarchy, setHierarchy] = useState<DepotHierarchy | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [selectedGateId, setSelectedGateId] = useState("");
  // Track manually overridden gate statuses so auto-refresh doesn't revert them
  const manualGateOverrides = useRef<Record<string, "open" | "closed">>({});
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastPriority, setBroadcastPriority] = useState("P2");
  const [broadcastType, setBroadcastType] = useState("operational_announcement");
  const [broadcastAudience, setBroadcastAudience] = useState("warehouse_staff");
  const [broadcastChannels, setBroadcastChannels] = useState<string[]>(["in_app"]);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactMsg, setContactMsg] = useState("");
  const [contactChannel, setContactChannel] = useState("in_app");

  const showFeedback = (msg: string, ok = true) => {
    setFeedback({ msg, ok });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const toggleBroadcastChannel = (channel: string) => {
    setBroadcastChannels((current) => (
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel]
    ));
  };

  const fetchSnapshot = useCallback(async () => {
    try {
      const scopedSource = await getUnifiedDepotSource({
        role: user?.role,
        email: user?.email,
        location: user?.location,
      });
      const scopedSnapshot = scopedSource.commandSnapshot;
      const scopedHierarchy = buildScopedHierarchy(forcedWarehouseIds);
      // Re-apply any manual gate overrides so auto-refresh doesn't revert them
      const overrides = manualGateOverrides.current;
      if (Object.keys(overrides).length > 0) {
        scopedSnapshot.gates = scopedSnapshot.gates.map((gate) =>
          overrides[gate.id] ? { ...gate, status: overrides[gate.id] } : gate
        );
      }
      setSnapshot(scopedSnapshot);
      setHierarchy(scopedHierarchy);
      setSelectedGateId((previous) =>
        scopedSnapshot.gates.some((gate) => gate.id === previous) ? previous : scopedSnapshot.gates[0]?.id || ""
      );
    } catch {
      showFeedback("Command snapshot is unavailable", false);
    } finally {
      setLoading(false);
    }
  }, [forcedWarehouseIds, user?.email, user?.location, user?.role]);

  useEffect(() => {
    void fetchSnapshot();
    const interval = window.setInterval(() => void fetchSnapshot(), 30000);
    return () => window.clearInterval(interval);
  }, [fetchSnapshot]);

  useDepotCommandEvents(() => {
    void fetchSnapshot();
  });

  const selectedGate = useMemo(
    () => snapshot?.gates.find((gate) => gate.id === selectedGateId),
    [snapshot?.gates, selectedGateId],
  );
  const persona = PERSONA_PROFILES[personaKey];
  const canOperateGate = personaKey === "warehouse_manager" || personaKey === "admin";
  const scopedCameras = snapshot?.cameras ?? [];
  const scopedKpis = snapshot?.kpis ?? [];
  const displayKpis = useMemo(() => {
    const pinnedKeys = new Set<string>(KPI_DISPLAY_ORDER);
    const pinned = KPI_DISPLAY_ORDER
      .map((key) => scopedKpis.find((kpi) => kpi.key === key))
      .filter((kpi): kpi is CommandKpi => Boolean(kpi));
    return [...pinned, ...scopedKpis.filter((kpi) => !pinnedKeys.has(kpi.key) && !HIDDEN_KPI_KEYS.has(kpi.key))];
  }, [scopedKpis]);
  const visibleWarehouseIds = Array.from(new Set(scopedCameras.map((camera) => camera.warehouse_id).filter(Boolean))) as string[];
  const visibleRegions = Array.from(new Set(scopedCameras.map((camera) => camera.region_id).filter(Boolean))) as string[];
  const primaryWarehouse = visibleWarehouseIds[0];
  const pageTitle = personaKey === "warehouse_manager"
    ? WAREHOUSE_LABELS[primaryWarehouse]?.title || "Warehouse Operations Dashboard"
    : personaKey === "regional_manager"
      ? `${visibleRegions.includes("REG_WEST") ? "West" : "South"} Region - Regional Dashboard`
      : personaKey === "central_manager"
        ? "National Command Center"
        : "Admin Command Center";
  const scopeLabel = personaKey === "warehouse_manager"
    ? WAREHOUSE_LABELS[primaryWarehouse]?.name || "Assigned Warehouse"
    : personaKey === "regional_manager"
      ? visibleRegions.includes("REG_WEST") ? "West Region" : "South Region"
      : "All Warehouses";
  const incidentKpi = Number(scopedKpis.find((kpi) => kpi.key === "incidents")?.value || 0);
  const occupancyKpi = scopedKpis.find((kpi) => kpi.key === "occupancy")?.value || "0%";
  const personaRows = visibleWarehouseIds.map((warehouseId) => {
    const warehouseHealth = ROLE_WAREHOUSE_REGISTRY[warehouseId as RoleWarehouseId]?.metrics.health ?? snapshot?.health_score ?? 82;

    return {
      name: WAREHOUSE_LABELS[warehouseId]?.name || warehouseId,
      region: WAREHOUSE_LABELS[warehouseId]?.region || "Region",
      health: String(warehouseHealth),
      incidents: incidentKpi,
      occupancy: occupancyKpi,
      tone: warehouseHealth >= 85 ? "#22D3A1" : warehouseHealth >= 65 ? "#F5A623" : "#F04A4A",
    };
  });
  const groupedCameras = visibleWarehouseIds.map((warehouseId) => ({
    warehouseId,
    label: WAREHOUSE_LABELS[warehouseId]?.name || warehouseId,
    cameras: scopedCameras.filter((camera) => camera.warehouse_id === warehouseId),
  }));

  const updateGateStatus = (gateId: string, status: "open" | "closed") => {
    // Record manual override so auto-refresh preserves it
    manualGateOverrides.current[gateId] = status;
    setSnapshot((current) => {
      if (!current) return current;
      return {
        ...current,
        gates: current.gates.map((gate) => gate.id === gateId ? { ...gate, status } : gate),
      };
    });
  };

  const runAction = async (key: string, fn: () => Promise<CommandActionResponse>, successMsg: string) => {
    setActionLoading(key);
    if (key === "open-gate" && selectedGateId) updateGateStatus(selectedGateId, "open");
    if (key === "close-gate" && selectedGateId) updateGateStatus(selectedGateId, "closed");
    try {
      await fn();
      showFeedback(successMsg, true);
      // Don't re-fetch for gate actions — optimistic update is the source of truth
      if (!key.includes("gate")) void fetchSnapshot();
    } catch {
      if (key === "open-gate" && selectedGateId) updateGateStatus(selectedGateId, "closed");
      if (key === "close-gate" && selectedGateId) updateGateStatus(selectedGateId, "open");
      showFeedback("Action failed. Check backend connection.", false);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || !snapshot) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5521a] border-t-transparent" />
      </div>
    );
  }

  const tone = healthTone(snapshot.health_score);

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#E5521A] bg-[#E5521A] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white">
              {persona.scope}
            </span>
            <span className="text-[11px] font-semibold text-[#8A9BBF]">{user?.full_name || persona.location}</span>
          </div>
          <h1 className="text-[22px] font-extrabold text-[#E8EDF8]">{pageTitle}</h1>
          <p className="mt-1 text-[11px] text-[#8A9BBF]">
            {persona.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {feedback && (
            <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${feedback.ok ? "bg-[#22D3A1]/15 text-[#22D3A1]" : "bg-[#F04A4A]/15 text-[#F04A4A]"}`}>
              {feedback.msg}
            </span>
          )}
          <button
            type="button"
            onClick={() => void fetchSnapshot()}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#1E2F50] bg-[#14203A] text-[#8A9BBF] transition hover:border-[#2A3F68] hover:text-[#E8EDF8]"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <section className="mb-5 rounded-[14px] border border-[#1E2F50] bg-[#14203A] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-extrabold text-[#E8EDF8]">
              {personaKey === "warehouse_manager" ? "Warehouse Operating Scope" : personaKey === "regional_manager" ? "Regional Warehouse Scope" : personaKey === "central_manager" ? "Central Operating Scope" : "Administration Scope"}
            </h2>
            <p className="mt-1 text-[11px] text-[#8A9BBF]">{scopeLabel}</p>
          </div>
          <span className="rounded-full border border-[#5B9BF5]/30 bg-[#5B9BF5]/10 px-3 py-1.5 text-[10px] font-bold uppercase text-[#5B9BF5]">
            Role based view
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {personaRows.map((row) => (
            <div key={row.name} className="rounded-[12px] border border-[#1E2F50] bg-[#0D1526] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-extrabold text-[#E8EDF8]">{row.name}</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-[#8A9BBF]">{row.region}</div>
                </div>
                <div className="text-right">
                  <div className="text-[18px] font-extrabold leading-none" style={{ color: row.tone }}>{row.health}</div>
                  <div className="mt-1 text-[9px] font-bold uppercase text-[#4E6090]">Health</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-lg bg-[#14203A] px-2 py-1.5 text-[#8A9BBF]">
                  Incidents <span className="font-bold text-[#E8EDF8]">{row.incidents}</span>
                </div>
                <div className="rounded-lg bg-[#14203A] px-2 py-1.5 text-[#8A9BBF]">
                  Occupancy <span className="font-bold text-[#E8EDF8]">{row.occupancy}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {hierarchy && (
        <section className="mb-5 rounded-[14px] border border-[#1E2F50] bg-[#14203A] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-extrabold text-[#E8EDF8]">Warehouse Hierarchy</h2>
              <p className="mt-1 text-[11px] text-[#8A9BBF]">Only warehouses authorized for this login are rendered</p>
            </div>
            <span className="rounded-full border border-[#22D3A1]/30 bg-[#22D3A1]/10 px-3 py-1.5 text-[10px] font-bold uppercase text-[#22D3A1]">
              Gates 1-3 · Zone mapped cameras
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {hierarchy.regions.map((region) => (
              <div key={region.id} className="rounded-[12px] border border-[#1E2F50] bg-[#0D1526] p-3">
                <div className="mb-2 text-[12px] font-extrabold text-[#E8EDF8]">{region.name}</div>
                <div className="space-y-2">
                  {region.warehouses.map((warehouse) => (
                    <div key={warehouse.id} className="rounded-[10px] border border-[#1E2F50] bg-[#14203A] p-3">
                      <div className="text-[11px] font-bold text-[#E8EDF8]">{warehouse.name}</div>
                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                        {warehouse.zones.map((zone) => (
                          <div key={zone.id} className="rounded-lg bg-[#0D1526] p-2">
                            <div className="text-[10px] font-extrabold text-[#5B9BF5]">{zone.name}</div>
                            <div className="mt-1 text-[10px] text-[#8A9BBF]">{zone.gates.length} gates · {zone.cameras.length} cameras</div>
                            {zone.gates.slice(0, 2).map((gate) => (
                              <div key={gate.id} className="mt-1 truncate text-[9px] text-[#4E6090]">
                                {gate.gate_code}: {gate.status}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
        <section className="rounded-[14px] border border-[#1E2F50] bg-[#14203A] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#4E6090]">Depot Health</div>
              <div className="mt-2 text-[46px] font-extrabold leading-none" style={{ color: tone.color }}>
                {snapshot.health_score}
              </div>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2" style={{ background: tone.bg, borderColor: tone.border }}>
              <Gauge className="h-7 w-7" style={{ color: tone.color }} />
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#0D1526]">
            <div className="h-full rounded-full" style={{ width: `${snapshot.health_score}%`, background: tone.color }} />
          </div>
          <p className="mt-3 text-[11px] font-semibold text-[#8A9BBF]">
            Score is reduced by open incidents, active breaches, stock exceptions, capacity risk, and access denials.
          </p>
        </section>

        <section className="rounded-[14px] border border-[#1E2F50] bg-[#14203A] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-[#E5521A]" />
              <span className="text-[13px] font-extrabold text-[#E8EDF8]">Control Actions</span>
            </div>
            <GateSelector
              gates={snapshot.gates}
              selectedGateId={selectedGateId}
              disabled={!!actionLoading}
              onChange={setSelectedGateId}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              {
                key: "open-gate",
                icon: DoorOpen,
                label: "Open Gate",
                sub: selectedGate?.name ?? "No gate selected",
                color: "#22D3A1",
                requiresGateControl: true,
                fn: () => openCommandGate(selectedGateId || undefined),
                success: `${selectedGate?.name ?? "Gate"} opened`,
              },
              {
                key: "close-gate",
                icon: DoorClosed,
                label: "Close Gate",
                sub: selectedGate?.name ?? "No gate selected",
                color: "#F5A623",
                requiresGateControl: true,
                fn: () => closeCommandGate(selectedGateId || undefined),
                success: `${selectedGate?.name ?? "Gate"} closed`,
              },
              {
                key: "broadcast",
                icon: Radio,
                label: "Broadcast",
                sub: personaKey === "warehouse_manager" ? "Local alert" : personaKey === "regional_manager" ? "Regional alert" : "Central alert",
                color: "#E5521A",
                onClick: () => setBroadcastOpen(true),
              },
              {
                key: "contact",
                icon: Phone,
                label: "Contact",
                sub: "Page supervisor",
                color: "#5B9BF5",
                onClick: () => setContactOpen(true),
              },
            ].filter((action) => !("requiresGateControl" in action) || canOperateGate).map((action) => {
              const Icon = action.icon;
              const isLoading = actionLoading === action.key;
              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => {
                    if ("onClick" in action && action.onClick) action.onClick();
                    else if ("fn" in action && action.fn) void runAction(action.key, action.fn, action.success);
                  }}
                  disabled={!!actionLoading || (action.key.includes("gate") && !selectedGateId)}
                  className="flex min-h-[108px] flex-col items-center justify-center gap-2 rounded-[12px] border border-[#33476C] bg-[#101D34] px-3 py-4 text-center transition hover:border-[#4A628E] hover:bg-[#1A2A45] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border" style={{ background: `${action.color}20`, borderColor: `${action.color}55` }}>
                    {isLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: action.color, borderTopColor: "transparent" }} />
                    ) : (
                      <Icon className="h-5 w-5" style={{ color: action.color }} />
                    )}
                  </div>
                  <div className="text-[12px] font-extrabold" style={{ color: action.color }}>{action.label}</div>
                  <div className="max-w-full truncate text-[10px] font-bold text-[#8B9BC1]">{action.sub}</div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[#22D3A1]" />
        <h2 className="text-[13px] font-extrabold text-[#E8EDF8]">Analysis KPIs</h2>
      </div>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {displayKpis.map((kpi) => (
          <KpiCard
            key={kpi.key}
            kpi={kpi}
            href={KPI_ROUTE_MAP[kpi.key]}
            hideDetail={personaKey === "warehouse_manager"}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <section className="rounded-[14px] border border-[#1E2F50] bg-[#14203A] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#5B9BF5]" />
            <h2 className="text-[13px] font-extrabold text-[#E8EDF8]">Recent Activity</h2>
          </div>
          <div className="space-y-2">
            {snapshot.timeline.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex gap-3 rounded-[10px] border border-[#1E2F50] bg-[#0D1526] p-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-[#5B9BF5]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate text-[12px] font-bold text-[#E8EDF8]">{item.title}</div>
                    <div className="whitespace-nowrap text-[10px] text-[#4E6090]">{fmtTime(item.occurred_at)}</div>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#8A9BBF]">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <section className="rounded-[14px] border border-[#1E2F50] bg-[#14203A] p-4">
          <div className="mb-3 flex items-center gap-2">
            <DoorClosed className="h-4 w-4 text-[#F5A623]" />
            <h2 className="text-[13px] font-extrabold text-[#E8EDF8]">Visibility: Gate Status</h2>
          </div>
          <div className="space-y-2">
            {snapshot.gates.map((gate) => (
              <div key={gate.id} className="flex items-center justify-between rounded-[10px] border border-[#1E2F50] bg-[#0D1526] p-3">
                <div>
                  <div className="text-[12px] font-bold text-[#E8EDF8]">{gate.gate_code}</div>
                  <div className="text-[10px] text-[#8A9BBF]">{gate.name}</div>
                </div>
                <div className="text-right">
                  <div className={gate.status === "open" ? "text-[11px] font-extrabold text-[#F5A623]" : "text-[11px] font-extrabold text-[#22D3A1]"}>
                    {gate.status.toUpperCase()}
                  </div>
                  <div className="text-[10px] text-[#4E6090]">{gate.total_entries_today} entries</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[14px] border border-[#1E2F50] bg-[#14203A] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Camera className="h-4 w-4 text-[#5B9BF5]" />
            <h2 className="text-[13px] font-extrabold text-[#E8EDF8]">Visibility: Camera Coverage</h2>
          </div>
          <div className="space-y-3">
            {groupedCameras.map((group) => (
              <div key={group.warehouseId} className="space-y-2">
                {personaKey !== "warehouse_manager" && (
                  <div className="px-1 text-[10px] font-extrabold uppercase text-[#5B9BF5]">{group.label} Cameras</div>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {group.cameras.map((camera) => (
                    <div key={camera.id} className="flex items-center justify-between rounded-[10px] border border-[#1E2F50] bg-[#0D1526] p-3">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-bold text-[#E8EDF8]">{camera.name}</div>
                        <div className="text-[10px] text-[#8A9BBF]">{camera.zone || "Unassigned"} - {camera.protocol.toUpperCase()}</div>
                      </div>
                      <span className={camera.status === "active" ? "text-[10px] font-extrabold text-[#22D3A1]" : "text-[10px] font-extrabold text-[#F5A623]"}>
                        {camera.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {broadcastOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] grid min-h-dvh place-items-center overflow-y-auto bg-black/70 px-4 py-10" onClick={() => setBroadcastOpen(false)}>
          <div className="my-auto w-full max-w-md rounded-[16px] border border-[#1E2F50] bg-[#14203A] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-[#E5521A]" />
                <h3 className="text-[15px] font-extrabold text-[#E8EDF8]">Broadcast Message</h3>
              </div>
              <button type="button" onClick={() => setBroadcastOpen(false)} className="text-[#4E6090] hover:text-[#E8EDF8]"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <input value={broadcastTitle} onChange={(event) => setBroadcastTitle(event.target.value)} placeholder="Alert title" className="w-full rounded-[10px] border border-[#1E2F50] bg-[#0D1526] px-3 py-2 text-[12px] text-[#E8EDF8] outline-none placeholder:text-[#4E6090]" />
              <textarea value={broadcastMsg} onChange={(event) => setBroadcastMsg(event.target.value)} placeholder="Describe the required action..." rows={3} className="w-full resize-none rounded-[10px] border border-[#1E2F50] bg-[#0D1526] px-3 py-2 text-[12px] text-[#E8EDF8] outline-none placeholder:text-[#4E6090]" />
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#4E6090]">Use case</div>
                <div className="grid grid-cols-2 gap-2">
                  {BROADCAST_TYPES.map((type) => (
                    <button key={type.value} type="button" onClick={() => setBroadcastType(type.value)} className={`rounded-[10px] border px-2 py-2 text-[11px] font-bold ${broadcastType === type.value ? "border-[#E5521A] bg-[#E5521A] text-white" : "border-[#1E2F50] text-[#8A9BBF]"}`}>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#4E6090]">
                  <Users className="h-3 w-3" />
                  Recipients
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {BROADCAST_AUDIENCES.map((audience) => (
                    <button key={audience.value} type="button" onClick={() => setBroadcastAudience(audience.value)} className={`rounded-[10px] border px-2 py-2 text-[11px] font-bold transition ${broadcastAudience === audience.value ? "border-[#E5521A] bg-[#E5521A] text-white" : "border-[#1E2F50] text-[#8A9BBF] hover:border-[#2A3F68] hover:text-[#E8EDF8]"}`}>
                      {audience.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#4E6090]">Delivery channels</div>
                <div className="grid grid-cols-2 gap-2">
                  {BROADCAST_CHANNELS.map((channel) => {
                    const active = broadcastChannels.includes(channel.value);
                    return (
                      <button key={channel.value} type="button" onClick={() => toggleBroadcastChannel(channel.value)} className={`rounded-[10px] border px-2 py-2 text-[11px] font-bold transition ${active ? "border-[#E5521A] bg-[#E5521A] text-white" : "border-[#1E2F50] text-[#8A9BBF] hover:border-[#2A3F68] hover:text-[#E8EDF8]"}`}>
                        {channel.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["P1", "P2", "P3"].map((priority) => (
                  <button key={priority} type="button" onClick={() => setBroadcastPriority(priority)} className={`rounded-[10px] border py-2 text-[11px] font-bold ${broadcastPriority === priority ? "border-[#E5521A] bg-[#E5521A] text-white" : "border-[#1E2F50] text-[#8A9BBF]"}`}>
                    {priority}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setBroadcastOpen(false)} className="flex-1 rounded-[10px] border border-[#1E2F50] py-2 text-[12px] font-bold text-[#8A9BBF]">Cancel</button>
              <button
                type="button"
                disabled={!broadcastMsg.trim() || broadcastChannels.length === 0}
                onClick={async () => {
                  setBroadcastOpen(false);
                  await runAction("broadcast", () => triggerCommandAlert({
                    title: broadcastTitle.trim() || "Command Center alert",
                    message: broadcastMsg.trim(),
                    priority: broadcastPriority,
                    broadcast_type: broadcastType,
                    audience: broadcastAudience,
                    channels: broadcastChannels,
                  }), "Broadcast sent and incident created");
                  setBroadcastTitle("");
                  setBroadcastMsg("");
                  setBroadcastPriority("P2");
                  setBroadcastType("operational_announcement");
                  setBroadcastAudience("warehouse_staff");
                  setBroadcastChannels(["in_app"]);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#E5521A] py-2 text-[12px] font-bold text-white disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" /> Send
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {contactOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] grid min-h-dvh place-items-center overflow-y-auto bg-black/70 px-4 py-10" onClick={() => setContactOpen(false)}>
          <div className="my-auto w-full max-w-md rounded-[16px] border border-[#1E2F50] bg-[#14203A] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#5B9BF5]" />
                <h3 className="text-[15px] font-extrabold text-[#E8EDF8]">Contact Operator</h3>
              </div>
              <button type="button" onClick={() => setContactOpen(false)} className="text-[#4E6090] hover:text-[#E8EDF8]"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {["in_app", "intercom", "radio"].map((channel) => (
                  <button key={channel} type="button" onClick={() => setContactChannel(channel)} className={`rounded-[10px] border py-2 text-[11px] font-bold transition ${contactChannel === channel ? "border-[#E5521A] bg-[#E5521A] text-white" : "border-[#1E2F50] text-[#8A9BBF] hover:border-[#2A3F68] hover:text-[#E8EDF8]"}`}>
                    {channel.replace("_", "-")}
                  </button>
                ))}
              </div>
              <textarea value={contactMsg} onChange={(event) => setContactMsg(event.target.value)} placeholder="Message for Shift Supervisor..." rows={3} className="w-full resize-none rounded-[10px] border border-[#1E2F50] bg-[#0D1526] px-3 py-2 text-[12px] text-[#E8EDF8] outline-none placeholder:text-[#4E6090]" />
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setContactOpen(false)} className="flex-1 rounded-[10px] border border-[#1E2F50] py-2 text-[12px] font-bold text-[#8A9BBF]">Cancel</button>
              <button
                type="button"
                disabled={!contactMsg.trim()}
                onClick={async () => {
                  setContactOpen(false);
                  await runAction("contact", () => contactCommandOperator({
                    operator: "Shift Supervisor",
                    channel: contactChannel,
                    message: contactMsg.trim(),
                  }), "Shift Supervisor paged");
                  setContactMsg("");
                  setContactChannel("in_app");
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#5B9BF5] py-2 text-[12px] font-bold text-white disabled:opacity-40"
              >
                <Phone className="h-3.5 w-3.5" /> Page
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
