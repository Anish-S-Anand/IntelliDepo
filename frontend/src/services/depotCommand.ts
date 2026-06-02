import api from "./api";
import { DEPOT_WAREHOUSE_ORDER, DEPOT_WAREHOUSE_REGISTRY } from "@/lib/depot-camera-registry";
import { ZONE_SEED } from "./depotUnifiedSource";

export interface CameraRecord {
  id: string;
  name: string;
  stream_url: string;
  protocol: string;
  zone: string | null;
  status: string;
  is_active: boolean;
  last_seen: string | null;
  frame_rate: number;
  resolution: string;
  created_at: string;
}

export interface ActiveStreamSummary {
  camera_id: string;
  stream_url: string;
  connected_at: string;
  frames_captured: number;
}

export interface ActiveStreamsResponse {
  active_count: number;
  streams: ActiveStreamSummary[];
}

export interface CameraFrame {
  camera_id: string;
  timestamp: string;
  frame_number: number;
  width: number;
  height: number;
  format: string;
}

export interface BreachRecord {
  id: string;
  zone_id: string;
  camera_id: string | null;
  breach_type: string;
  severity: string;
  confidence: number | null;
  snapshot_ref: string | null;
  alert_sent: boolean;
  notes: string | null;
  detected_at: string;
  resolved_at: string | null;
}

export interface GateRecord {
  id: string;
  gate_code: string;
  name: string;
  gate_type: string;
  camera_id: string | null;
  status: string;
  total_entries_today: number;
}

export interface AccessLogRecord {
  id: string;
  gate_id: string;
  gate_code: string | null;
  plate_number: string;
  plate_confidence: number;
  decision: string;
  direction: string;
  denied_reason: string | null;
  processed_at: string;
}

export interface LowStockRecord {
  id: string;
  sku_id: string;
  zone: string;
  rack: string | null;
  bin_location: string | null;
  quantity: number;
  reserved_quantity: number;
  reorder_level: number;
  max_capacity: number | null;
  status: string;
}

export interface ObservabilityResponse {
  status: string;
  timestamp: string;
  database?: { status?: string };
  metrics?: {
    total_requests?: number;
    total_errors?: number;
    error_rate?: number;
    avg_latency_ms?: number;
  };
}

export type IntegrationState = "live" | "auth" | "offline";

export interface IntegrationPanel<T> {
  state: IntegrationState;
  data: T;
  message?: string;
}

export interface DepotCommandSnapshot {
  generatedAt: string;
  cameras: IntegrationPanel<CameraRecord[]>;
  activeStreams: IntegrationPanel<ActiveStreamsResponse>;
  breaches: IntegrationPanel<BreachRecord[]>;
  gates: IntegrationPanel<GateRecord[]>;
  accessLogs: IntegrationPanel<AccessLogRecord[]>;
  lowStock: IntegrationPanel<LowStockRecord[]>;
  observability: IntegrationPanel<ObservabilityResponse | null>;
}

export interface CommandKpi {
  key: string;
  label: string;
  value: string;
  detail: string;
  tone: "healthy" | "warning" | "critical" | "normal";
}

export interface CommandException {
  id: string;
  source: string;
  title: string;
  detail: string;
  priority: string;
  zone: string | null;
  created_at: string | null;
}

export interface CommandZoneSummary {
  zone_code: string;
  name: string;
  utilization_pct: number;
  current_occupancy: number;
  max_capacity_units: number;
  status: string;
}

export interface CommandGateSummary {
  id: string;
  gate_code: string;
  name: string;
  gate_type: string;
  status: string;
  total_entries_today: number;
  warehouse_id?: string | null;
  region_id?: string | null;
  last_activity_at: string | null;
}

export interface CommandCameraSummary {
  id: string;
  name: string;
  zone: string | null;
  status: string;
  protocol: string;
  warehouse_id?: string | null;
  region_id?: string | null;
  last_seen: string | null;
}

export interface CommandTimelineItem {
  id: string;
  type: string;
  title: string;
  detail: string;
  status: string;
  occurred_at: string;
}

export interface CommandCenterSnapshot {
  generated_at: string;
  health_score: number;
  kpis: CommandKpi[];
  gates: CommandGateSummary[];
  cameras: CommandCameraSummary[];
  zones: CommandZoneSummary[];
  exceptions: CommandException[];
  timeline: CommandTimelineItem[];
  recent_actions: CommandActionResponse[];
}

export interface HierarchyCamera {
  id: string;
  name: string;
  status: string;
  zone: string;
  gate_id: string | null;
}

export interface HierarchyGate {
  id: string;
  name: string;
  gate_code: string;
  status: string;
  cameras: HierarchyCamera[];
}

export interface HierarchyZone {
  id: string;
  name: string;
  gates: HierarchyGate[];
  cameras: HierarchyCamera[];
}

export interface HierarchyWarehouse {
  id: string;
  name: string;
  zones: HierarchyZone[];
}

export interface HierarchyRegion {
  id: string;
  name: string;
  warehouses: HierarchyWarehouse[];
}

export interface DepotHierarchy {
  organization: string;
  regions: HierarchyRegion[];
}

interface LegacyPerimeterIncident {
  id: string;
  severity: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
}

interface LegacyZone {
  zone_code: string;
  name: string;
  utilization_pct: number;
  current_occupancy: number;
  max_capacity_units: number;
  status: string;
}

function countTone(count: number, criticalAt = 4): CommandKpi["tone"] {
  if (count >= criticalAt) return "critical";
  if (count > 0) return "warning";
  return "healthy";
}

const DEMO_WAREHOUSES = {
  WH_HYD: {
    name: DEPOT_WAREHOUSE_REGISTRY.WH_HYD.name,
    region_id: DEPOT_WAREHOUSE_REGISTRY.WH_HYD.regionId,
    zones: DEPOT_WAREHOUSE_REGISTRY.WH_HYD.zones,
    cameras: DEPOT_WAREHOUSE_REGISTRY.WH_HYD.cameras,
    metrics: { bags_in: 1260, bags_out: 1040, vehicles: 38, workers: 82, incidents: 2, occupancy: 74, unload: 34 },
  },
  WH_BLR: {
    name: DEPOT_WAREHOUSE_REGISTRY.WH_BLR.name,
    region_id: DEPOT_WAREHOUSE_REGISTRY.WH_BLR.regionId,
    zones: DEPOT_WAREHOUSE_REGISTRY.WH_BLR.zones,
    cameras: DEPOT_WAREHOUSE_REGISTRY.WH_BLR.cameras,
    metrics: { bags_in: 1435, bags_out: 1195, vehicles: 44, workers: 76, incidents: 3, occupancy: 71, unload: 29 },
  },
  WH_MUM: {
    name: DEPOT_WAREHOUSE_REGISTRY.WH_MUM.name,
    region_id: DEPOT_WAREHOUSE_REGISTRY.WH_MUM.regionId,
    zones: DEPOT_WAREHOUSE_REGISTRY.WH_MUM.zones,
    cameras: DEPOT_WAREHOUSE_REGISTRY.WH_MUM.cameras,
    metrics: { bags_in: 980, bags_out: 910, vehicles: 31, workers: 64, incidents: 1, occupancy: 82, unload: 37 },
  },
} as const;

type DemoWarehouseId = keyof typeof DEMO_WAREHOUSES;
type DemoMetricKey = keyof typeof DEMO_WAREHOUSES.WH_HYD.metrics;

// Zone→gate mapping: Z1→Gate A, Z2→Gate B, Z3→Gate C, Z4→no gate
// Zone→camera mapping: Z1→[cam1,cam2], Z2→[cam3], Z3→[cam4], Z4→[cam5,cam6]
const COMMAND_GATE_SEED = [
  { suffix: "A", name: "Gate A - North Entry", gateType: "entry", status: "open" },
  { suffix: "B", name: "Gate B - South Exit", gateType: "exit", status: "closed" },
  { suffix: "C", name: "Gate C - Loading Dock", gateType: "loading", status: "open" },
] as const;

// Camera start index per zone: Z1 starts at 0 (2 cams), Z2 at 2 (1 cam), Z3 at 3 (1 cam), Z4 at 4 (2 cams)
const ZONE_CAM_START = [0, 2, 3, 4] as const;
const ZONE_CAM_COUNT = [2, 1, 1, 2] as const;
// Gate index per zone (null = no gate)
const ZONE_GATE_IDX = [0, 1, 2, null] as const;

function demoWarehouseIds(): DemoWarehouseId[] {
  if (typeof window === "undefined") return ["WH_BLR"];
  const token = localStorage.getItem("token") || "";
  if (token.includes("wh-hyd")) return ["WH_HYD"];
  if (token.includes("wh-blr")) return ["WH_BLR"];
  if (token.includes("wh-mum")) return ["WH_MUM"];
  if (token.includes("regional-india")) return ["WH_BLR", "WH_HYD"];
  return DEPOT_WAREHOUSE_ORDER as DemoWarehouseId[];
}

function scopedBreakdown(warehouseIds: DemoWarehouseId[], key: DemoMetricKey) {
  return warehouseIds.map((id) => `${id.replace("WH_", "")}: ${DEMO_WAREHOUSES[id].metrics[key]}`).join(" | ");
}

function demoCommandCenterSnapshot(): CommandCenterSnapshot {
  const now = new Date().toISOString();
  const warehouseIds = demoWarehouseIds();
  const metrics = warehouseIds.map((id) => DEMO_WAREHOUSES[id].metrics);
  const sum = (key: DemoMetricKey) => metrics.reduce((total, item) => total + Number(item[key]), 0);
  const avgUnload = Math.round(sum("unload") / Math.max(metrics.length, 1));
  const totalOccupied = warehouseIds.reduce((s, id) => s + (ZONE_SEED[id] ?? []).reduce((zs, z) => zs + z.occupancy, 0), 0);
  const totalCapacity = warehouseIds.reduce((s, id) => s + (ZONE_SEED[id] ?? []).reduce((zs, z) => zs + z.maxCapacity, 0), 0);
  const occupancyPct = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;
  const cameras = warehouseIds.flatMap((warehouseId) => {
    const wh = DEMO_WAREHOUSES[warehouseId];
    return wh.zones.flatMap((zone, zoneIndex) => {
      const start = ZONE_CAM_START[zoneIndex];
      const count = ZONE_CAM_COUNT[zoneIndex];
      return wh.cameras.slice(start, start + count).map((cameraId) => ({
        id: cameraId,
        name: cameraId,
        zone,
        status: "active",
        protocol: "rtsp",
        warehouse_id: warehouseId,
        region_id: DEMO_WAREHOUSES[warehouseId].region_id,
        last_seen: now,
      }));
    });
  });
  const gates = warehouseIds.flatMap((warehouseId) => COMMAND_GATE_SEED.map((gate, index) => ({
    id: `${warehouseId}-GATE-${gate.suffix}`,
    gate_code: `GATE-${gate.suffix}`,
    name: gate.name,
    gate_type: gate.gateType,
    status: gate.status,
    total_entries_today: 14 + index * 4,
    warehouse_id: warehouseId,
    region_id: DEMO_WAREHOUSES[warehouseId].region_id,
    last_activity_at: now,
  })));
  return {
    generated_at: now,
    health_score: 82,
    kpis: [
      { key: "bags_in",           label: "Bags In (Weekly)",       value: String(sum("bags_in")),    detail: scopedBreakdown(warehouseIds, "bags_in"),    tone: "healthy" },
      { key: "bags_out",          label: "Bags Out (Weekly)",      value: String(sum("bags_out")),   detail: scopedBreakdown(warehouseIds, "bags_out"),   tone: "healthy" },
      { key: "total_capacity",    label: "Total Capacity",         value: String(totalCapacity),     detail: "Total storage units across assigned zones", tone: "healthy" },
      { key: "occupancy_count",   label: "Occupancy Count",        value: String(totalOccupied),     detail: "Occupied storage units in assigned scope",  tone: occupancyPct >= 80 ? "warning" : "healthy" },
      { key: "vehicles",          label: "Vehicles (Today)",       value: String(sum("vehicles")),   detail: scopedBreakdown(warehouseIds, "vehicles"),   tone: "normal" },
      { key: "avg_unload",        label: "Avg Unload (Today)",     value: `${avgUnload}m`,           detail: "Average across assigned warehouses",        tone: "normal" },
      { key: "incidents",         label: "Incidents (Today)",      value: String(sum("incidents")),  detail: scopedBreakdown(warehouseIds, "incidents"),  tone: sum("incidents") > 3 ? "critical" : "warning" },
      { key: "workers",           label: "Workers (Today)",        value: String(sum("workers")),    detail: scopedBreakdown(warehouseIds, "workers"),    tone: "healthy" },
      { key: "cameras",           label: "Active Cameras",         value: `${cameras.length}/${cameras.length}`, detail: `${warehouseIds.length} warehouse camera group(s)`, tone: "healthy" },
    ],
    gates,
    cameras,
    zones: warehouseIds.flatMap((warehouseId) => {
      const seedZones = ZONE_SEED[warehouseId] ?? [];
      return seedZones.map((z, index) => {
        const util = Math.round((z.occupancy / z.maxCapacity) * 100);
        return {
          zone_code: z.code,
          name: `${z.code} (Cluster ${index + 1})`,
          utilization_pct: util,
          current_occupancy: z.occupancy,
          max_capacity_units: z.maxCapacity,
          status: util >= 90 ? "critical" : util >= 80 ? "warning" : "normal",
        };
      });
    }),
    exceptions: [
      { id: "ex-1", source: "Incident", title: "Unauthorized vehicle at inbound gate", detail: "LPR mismatch detected at Gate A", priority: "P1", zone: "Gate A", created_at: now },
      { id: "ex-2", source: "Inventory", title: "SKU cement-bag-43 below reorder level", detail: "38 available, reorder at 75", priority: "P2", zone: "Zone B", created_at: now },
      { id: "ex-3", source: "Perimeter", title: "Restricted zone motion detected", detail: "Camera flagged movement near perimeter", priority: "P2", zone: "Perimeter", created_at: now },
      { id: "ex-4", source: "Capacity", title: "Zone A nearing capacity", detail: "920 / 1000 bags occupied", priority: "P3", zone: "Zone A", created_at: now },
    ],
    timeline: [
      { id: "tl-1", type: "gate", title: "KA03NP0051 entry", detail: "GATE-A - granted", status: "granted", occurred_at: now },
      { id: "tl-2", type: "incident", title: "Unauthorized vehicle at inbound gate", detail: "High - open", status: "open", occurred_at: now },
      { id: "tl-3", type: "command", title: "Broadcast", detail: "Shift supervisor notified", status: "completed", occurred_at: now },
    ],
    recent_actions: [],
  };
}

type ApiOutcome<T> =
  | { kind: "success"; data: T }
  | { kind: "auth" }
  | { kind: "offline"; message: string };

async function safeGet<T>(url: string): Promise<ApiOutcome<T>> {
  try {
    const response = await api.get<T>(url);
    return { kind: "success", data: response.data };
  } catch (error: unknown) {
    const status = typeof error === "object" && error !== null && "response" in error
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;

    if (status === 401 || status === 403) {
      return { kind: "auth" };
    }

    return { kind: "offline", message: status ? `HTTP ${status}` : "Unavailable" };
  }
}

function toPanel<T>(outcome: ApiOutcome<T>, fallback: T): IntegrationPanel<T> {
  if (outcome.kind === "success") {
    return { state: "live", data: outcome.data };
  }
  if (outcome.kind === "auth") {
    return { state: "auth", data: fallback, message: "Authentication required" };
  }
  return { state: "offline", data: fallback, message: outcome.message };
}

export async function getDepotCommandSnapshot(): Promise<DepotCommandSnapshot> {
  const [cameras, activeStreams, breaches, gates, accessLogs, lowStock, observability] = await Promise.all([
    safeGet<CameraRecord[]>("/depot/vision/cameras/"),
    safeGet<ActiveStreamsResponse>("/depot/vision/cameras/streams/active"),
    safeGet<BreachRecord[]>("/depot/vision/perimeter/breaches/active"),
    safeGet<GateRecord[]>("/depot/gate/gates"),
    safeGet<AccessLogRecord[]>("/depot/gate/access-logs?limit=8"),
    safeGet<LowStockRecord[]>("/depot/inventory/reports/low-stock"),
    safeGet<ObservabilityResponse>("/health/observability"),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    cameras: toPanel(cameras, []),
    activeStreams: toPanel(activeStreams, { active_count: 0, streams: [] }),
    breaches: toPanel(breaches, []),
    gates: toPanel(gates, []),
    accessLogs: toPanel(accessLogs, []),
    lowStock: toPanel(lowStock, []),
    observability: toPanel(observability, null),
  };
}

async function getLegacyCommandCenterSnapshot(): Promise<CommandCenterSnapshot> {
  const [base, incidents, zones, recentActions] = await Promise.all([
    getDepotCommandSnapshot(),
    safeGet<LegacyPerimeterIncident[]>("/depot/vision/perimeter/incidents"),
    safeGet<LegacyZone[]>("/depot/vision/cluster/zones"),
    safeGet<CommandActionResponse[]>("/depot/command/actions/recent?limit=8"),
  ]);

  const now = new Date().toISOString();
  const cameras = base.cameras.data;
  const gates = base.gates.data;
  const breaches = base.breaches.data;
  const logs = base.accessLogs.data;
  const incidentRows = incidents.kind === "success"
    ? incidents.data.filter((incident) => incident.status !== "resolved")
    : [];
  const zoneRows = zones.kind === "success" ? zones.data : [];
  const actionRows = recentActions.kind === "success" ? recentActions.data : [];

  const activeCameraCount = cameras.filter((camera) => camera.status === "active").length;
  const openGateCount = gates.filter((gate) => gate.status === "open").length;
  const highIncidentCount = incidentRows.filter((incident) => ["critical", "high"].includes(incident.severity)).length;
  const capacityRiskCount = zoneRows.filter((zone) => zone.utilization_pct >= 80).length;
  const deniedAccessCount = logs.filter((log) => log.decision !== "granted").length;
  const riskPoints = highIncidentCount * 12 + incidentRows.length * 5 + breaches.length * 4 + capacityRiskCount * 6 + deniedAccessCount * 3;

  if (cameras.length === 0 && gates.length === 0 && zoneRows.length === 0 && incidentRows.length === 0) {
    return demoCommandCenterSnapshot();
  }

  return {
    generated_at: now,
    health_score: Math.max(0, Math.min(100, 100 - riskPoints)),
    kpis: [
      {
        key: "cameras",
        label: "Active Cameras",
        value: `${activeCameraCount}/${cameras.length}`,
        detail: "Live visual coverage",
        tone: activeCameraCount === cameras.length ? "healthy" : "warning",
      },
      {
        key: "gates",
        label: "Open Gates",
        value: String(openGateCount),
        detail: `${gates.reduce((sum, gate) => sum + (gate.total_entries_today || 0), 0)} entries today`,
        tone: openGateCount > 0 ? "warning" : "healthy",
      },
      {
        key: "incidents",
        label: "Open Incidents",
        value: String(incidentRows.length + breaches.length),
        detail: `${highIncidentCount} high priority`,
        tone: countTone(incidentRows.length + breaches.length),
      },
      {
        key: "zones",
        label: "Capacity Risk",
        value: String(capacityRiskCount),
        detail: "Zones above 80% utilization",
        tone: countTone(capacityRiskCount, 3),
      },
    ],
    gates: gates.map((gate) => ({
      id: gate.id,
      gate_code: gate.gate_code,
      name: gate.name,
      gate_type: gate.gate_type,
      status: gate.status,
      total_entries_today: gate.total_entries_today,
      last_activity_at: null,
    })),
    cameras: cameras.map((camera) => ({
      id: camera.id,
      name: camera.name,
      zone: camera.zone,
      status: camera.status,
      protocol: camera.protocol,
      last_seen: camera.last_seen,
    })),
    zones: zoneRows
      .sort((a, b) => b.utilization_pct - a.utilization_pct)
      .slice(0, 6)
      .map((zone) => ({
        zone_code: zone.zone_code,
        name: zone.name,
        utilization_pct: zone.utilization_pct,
        current_occupancy: zone.current_occupancy,
        max_capacity_units: zone.max_capacity_units,
        status: zone.status,
      })),
    exceptions: [],
    timeline: [
      ...logs.map((log) => ({
        id: log.id,
        type: "gate",
        title: `${log.plate_number} ${log.direction}`,
        detail: `${log.gate_code || "Gate"} - ${log.decision}`,
        status: log.decision,
        occurred_at: log.processed_at,
      })),
      ...actionRows.map((action) => ({
        id: action.id,
        type: "command",
        title: action.action_type.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()),
        detail: action.message,
        status: action.status,
        occurred_at: now,
      })),
    ].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()).slice(0, 12),
    recent_actions: actionRows,
  };
}

export async function getCommandCenterSnapshot(): Promise<CommandCenterSnapshot> {
  try {
    const res = await api.get<CommandCenterSnapshot>("/depot/command/snapshot", { timeout: 5000 });
    return {
      ...res.data,
      kpis: res.data.kpis.filter((kpi) => kpi.key !== "inventory" && kpi.key !== "access"),
    };
  } catch {
    return getLegacyCommandCenterSnapshot();
  }
}

export async function getDepotHierarchy(): Promise<DepotHierarchy> {
  const { data } = await api.get<DepotHierarchy>("/depot/hierarchy");
  return data;
}

export async function getCommandKpis(scope: "warehouse" | "region" | "central" | "admin" = "warehouse"): Promise<CommandKpi[]> {
  const { data } = await api.get<CommandKpi[]>(`/depot/command/kpis?scope=${scope}`);
  return data;
}

export interface CameraRegisterPayload {
  name: string;
  stream_url: string;
  protocol?: "rtsp" | "http" | "https";
  zone?: string;
  frame_rate?: number;
  resolution?: string;
}

export async function registerCamera(payload: CameraRegisterPayload): Promise<CameraRecord> {
  const res = await api.post<CameraRecord>("/depot/vision/cameras/register", payload);
  return res.data;
}

export async function deleteCamera(cameraId: string): Promise<void> {
  await api.delete(`/depot/vision/cameras/${cameraId}`);
}

export async function reconnectCamera(cameraId: string) {
  const response = await api.post<{ camera_id: string; status: string }>(`/depot/vision/cameras/${cameraId}/connect`);
  return response.data;
}

export async function getCameraFrame(cameraId: string): Promise<IntegrationPanel<CameraFrame | null>> {
  const outcome = await safeGet<CameraFrame>(`/depot/vision/cameras/${cameraId}/frame`);
  return toPanel(outcome, null);
}

/**
 * Get the MJPEG stream URL for a camera (for use in <img> src).
 * Points directly to the backend port to bypass Next.js proxy buffering.
 * seek: offset in seconds so cameras sharing the same video show different parts.
 */
export function getCameraMjpegUrl(cameraId: string, theme: "dark" | "light" = "dark", seek = 0): string {
  const base = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
  const seekParam = seek > 0 ? `&seek=${seek}` : "";
  return `${base}/depot/vision/cameras/${cameraId}/mjpeg?theme=${theme}${seekParam}`;
}

/**
 * Get the snapshot URL for a camera (for use in <img> src).
 * seek: offset in seconds so cameras sharing the same video show different parts.
 */
export function getCameraSnapshotUrl(cameraId: string, theme: "dark" | "light" = "light", seek = 0): string {
  const base = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
  const seekParam = seek > 0 ? `&seek=${seek}` : "";
  return `${base}/depot/vision/cameras/${cameraId}/snapshot?theme=${theme}${seekParam}`;
}

/**
 * Get the RTSP proxy MJPEG stream URL for any RTSP/HTTP source.
 */
export function getRtspProxyUrl(rtspUrl: string): string {
  const base = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
  return `${base}/depot/vision/cameras/rtsp-proxy/stream?url=${encodeURIComponent(rtspUrl)}`;
}

// ---------------------------------------------------------------------------
// Quick Action types & functions
// ---------------------------------------------------------------------------

export interface CommandActionResponse {
  id: string;
  action_type: string;
  status: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  zone: string | null;
  message: string;
}

export type CommandActionErrorKind = "auth" | "offline" | "server";

export class CommandActionError extends Error {
  kind: CommandActionErrorKind;
  status?: number;
  constructor(kind: CommandActionErrorKind, message: string, status?: number) {
    super(message);
    this.name = "CommandActionError";
    this.kind = kind;
    this.status = status;
  }
}

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "response" in error) {
    return (error as { response?: { status?: number } }).response?.status;
  }
  return undefined;
}

function toCommandActionError(error: unknown): CommandActionError {
  const status = getHttpStatus(error);
  if (status === 401 || status === 403)
    return new CommandActionError("auth", "Please sign in to run Command Center actions.", status);
  if (status)
    return new CommandActionError("server", `Command action failed (HTTP ${status}).`, status);
  return new CommandActionError("offline", "Command action service is unavailable.");
}

function isDemoSession(): boolean {
  return typeof window !== "undefined" && localStorage.getItem("token")?.startsWith("demo-token-") === true;
}

const DEMO_GATES = [
  { id: "gate-a", name: "Gate A - North Entry" },
  { id: "gate-b", name: "Gate B - South Exit" },
];

function demoCommandAction(url: string, payload: Record<string, unknown>): CommandActionResponse {
  const actionType = url.split("/").pop()?.replaceAll("-", "_") || "command_action";
  const gateId = typeof payload.gate_id === "string" ? payload.gate_id : undefined;
  const gate = gateId ? DEMO_GATES.find((g) => g.id === gateId) : undefined;
  const zone = typeof payload.zone === "string" ? payload.zone : null;
  const messages: Record<string, string> = {
    open_gate: `${gate?.name || "Selected gate"} opened in demo mode`,
    close_gate: `${gate?.name || "Selected gate"} closed in demo mode`,
    lock_zone: `Zone ${zone || "perimeter"} locked in demo mode`,
    trigger_alert: "Manual alert triggered in demo mode",
    contact_operator: "Operator paged in demo mode",
  };
  return {
    id: `demo-${Date.now()}`,
    action_type: actionType,
    status: "success",
    target_type: gate ? "gate" : zone ? "zone" : null,
    target_id: gate?.id ?? null,
    target_name: gate?.name ?? null,
    zone,
    message: messages[actionType] ?? "Action completed in demo mode",
  };
}

async function postCommandAction(url: string, payload: Record<string, unknown>): Promise<CommandActionResponse> {
  try {
    const res = await api.post<CommandActionResponse>(url, payload);
    return res.data;
  } catch (error) {
    const status = getHttpStatus(error);
    if (
      isDemoSession()
      || status === 404
      || status === 500
      || status === 502
      || status === 503
      || status === 504
      || status === undefined
    ) {
      return demoCommandAction(url, payload);
    }
    throw toCommandActionError(error);
  }
}

function validUuid(value?: string): string | undefined {
  if (!value) return undefined;
  // Accept real UUIDs or demo gate IDs like "WH_BLR-GATE-A"
  return value;
}

export async function openCommandGate(gateId?: string): Promise<CommandActionResponse> {
  return postCommandAction("/depot/command/actions/open-gate", { gate_id: validUuid(gateId) });
}

export async function closeCommandGate(gateId?: string): Promise<CommandActionResponse> {
  return postCommandAction("/depot/command/actions/close-gate", { gate_id: validUuid(gateId) });
}

export async function lockCommandZone(zone = "Depot perimeter"): Promise<CommandActionResponse> {
  return postCommandAction("/depot/command/actions/lock-zone", {
    zone,
    reason: "Manual lockdown from Command Center quick action",
  });
}

export async function triggerCommandAlert(params?: {
  title?: string;
  message?: string;
  priority?: string;
  broadcast_type?: string;
  audience?: string;
  channels?: string[];
}): Promise<CommandActionResponse> {
  return postCommandAction("/depot/command/actions/trigger-alert", {
    title: params?.title ?? "Manual Command Center alert",
    message: params?.message ?? "All operators notified from Command Center quick action",
    priority: params?.priority ?? "P2",
    broadcast_type: params?.broadcast_type ?? "operational_announcement",
    audience: params?.audience ?? "warehouse_staff",
    channels: params?.channels ?? ["in_app"],
  });
}

export async function contactCommandOperator(params?: {
  operator?: string;
  channel?: string;
  message?: string;
}): Promise<CommandActionResponse> {
  return postCommandAction("/depot/command/actions/contact-operator", {
    operator: params?.operator ?? "Shift Supervisor",
    channel: params?.channel ?? "in_app",
    message: params?.message ?? "Please contact Command Center",
  });
}
