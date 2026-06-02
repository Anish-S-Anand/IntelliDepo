import { type CommandCenterSnapshot } from "@/services/depotCommand";
import { getZones, getDensityAnalytics, type DensityEntry, type ZoneResponse } from "@/services/depotCluster";
import { getIncidents, type IncidentResponse } from "@/services/depotPerimeter";
import { getBatches, type BatchResponse } from "@/services/depotSequencing";
import { DEPOT_WAREHOUSE_ORDER, DEPOT_WAREHOUSE_REGISTRY, type DepotWarehouseId } from "@/lib/depot-camera-registry";
import storageTruth from "@/data/depotWarehouseStorage.json";

export type DepotRole = "warehouse_manager" | "regional_manager" | "central_manager" | "admin";
export interface UnifiedDepotSource {
  generatedAt: string;
  source: "backend" | "fallback" | "mixed";
  warehouseIds: DepotWarehouseId[];
  kpis: {
    bagsIn: number;
    bagsOut: number;
    vehicles: number;
    avgUnloadMinutes: number;
    incidentsToday: number;
    occupancyPct: number;
    totalCapacityUnits: number;
    capacityRemainingUnits: number;
    workers: number;
    activeCameras: number;
    totalCameras: number;
  };
  weeklyThroughput: Array<{ day: string; enter: number; exit: number }>;
  zones: ZoneResponse[];
  batches: BatchResponse[];
  incidents: IncidentResponse[];
  density: DensityEntry[];
  commandSnapshot: CommandCenterSnapshot;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKLY_WEIGHTS = [0.13, 0.16, 0.12, 0.17, 0.18, 0.15, 0.09];

type ZoneSeedEntry = { code: string; maxCapacity: number; occupancy: number };

// SINGLE SOURCE OF TRUTH: all tabs derive warehouse capacity from shared/depotWarehouseStorage.json.
export const ZONE_SEED = storageTruth.warehouses as Record<DepotWarehouseId, ZoneSeedEntry[]>;

/** Total occupied bags across all zones for a warehouse */
export function warehouseTotalOccupancy(warehouseId: string): number {
  const zones: ZoneSeedEntry[] = ZONE_SEED[warehouseId as DepotWarehouseId] ?? [];
  return zones.reduce((total, zone) => total + zone.occupancy, 0);
}

/** Total capacity across all zones for a warehouse */
export function warehouseTotalCapacity(warehouseId: string): number {
  const zones: ZoneSeedEntry[] = ZONE_SEED[warehouseId as DepotWarehouseId] ?? [];
  return zones.reduce((total, zone) => total + zone.maxCapacity, 0);
}

const WAREHOUSE_SEED = {
  WH_HYD: {
    name: DEPOT_WAREHOUSE_REGISTRY.WH_HYD.name,
    regionId: DEPOT_WAREHOUSE_REGISTRY.WH_HYD.regionId,
    zones: DEPOT_WAREHOUSE_REGISTRY.WH_HYD.zones,
    cameras: DEPOT_WAREHOUSE_REGISTRY.WH_HYD.cameras,
    metrics: { bagsIn: 1260, bagsOut: 1040, vehicles: 38, workers: 82, incidents: 2, occupancy: 74, unload: 34, health: 91 },
  },
  WH_BLR: {
    name: DEPOT_WAREHOUSE_REGISTRY.WH_BLR.name,
    regionId: DEPOT_WAREHOUSE_REGISTRY.WH_BLR.regionId,
    zones: DEPOT_WAREHOUSE_REGISTRY.WH_BLR.zones,
    cameras: DEPOT_WAREHOUSE_REGISTRY.WH_BLR.cameras,
    metrics: { bagsIn: 1435, bagsOut: 1195, vehicles: 44, workers: 76, incidents: 3, occupancy: 71, unload: 29, health: 91 },
  },
  WH_MUM: {
    name: DEPOT_WAREHOUSE_REGISTRY.WH_MUM.name,
    regionId: DEPOT_WAREHOUSE_REGISTRY.WH_MUM.regionId,
    zones: DEPOT_WAREHOUSE_REGISTRY.WH_MUM.zones,
    cameras: DEPOT_WAREHOUSE_REGISTRY.WH_MUM.cameras,
    metrics: { bagsIn: 980, bagsOut: 910, vehicles: 31, workers: 64, incidents: 1, occupancy: 82, unload: 37, health: 88 },
  },
} as const;

type SeedMetricKey = keyof typeof WAREHOUSE_SEED.WH_HYD.metrics;

// Zone→gate mapping: Z1→Gate A, Z2→Gate B, Z3→Gate C, Z4→no gate
// Zone→camera mapping: Z1→[cam1,cam2], Z2→[cam3], Z3→[cam4], Z4→[cam5,cam6]
const GATE_SEED = [
  { suffix: "A", name: "Gate A - North Entry", gateType: "entry", status: "open" },
  { suffix: "B", name: "Gate B - South Exit", gateType: "exit", status: "closed" },
  { suffix: "C", name: "Gate C - Loading Dock", gateType: "loading", status: "open" },
] as const;

// Camera count per zone index: [2, 1, 1, 2]
const ZONE_CAMERA_COUNTS = [2, 1, 1, 2] as const;
// Gate index per zone index: [0=A, 1=B, 2=C, null=none]
const ZONE_GATE_INDEX = [0, 1, 2, null] as const;

export function scopedWarehouseIdsForUser(role?: string, email?: string, location?: string): DepotWarehouseId[] {
  const normalizedRole = (role ?? "").toLowerCase().replace(/\s+/g, "_");
  const normalizedEmail = (email ?? "").toLowerCase();
  const normalizedLocation = (location ?? "").toLowerCase();

  if (normalizedRole === "warehouse_manager" || normalizedRole.includes("warehouse")) {
    if (normalizedEmail.includes("hyd") || normalizedLocation.includes("hyderabad")) return ["WH_HYD"];
    if (normalizedEmail.includes("mum") || normalizedLocation.includes("mumbai")) return ["WH_MUM"];
    return ["WH_BLR"];
  }

  if (normalizedRole === "regional_manager" || normalizedRole.includes("regional")) {
    if (normalizedLocation.includes("west")) return ["WH_MUM"];
    return ["WH_BLR", "WH_HYD"];
  }

  return DEPOT_WAREHOUSE_ORDER;
}

function sumSeed(warehouseIds: DepotWarehouseId[], key: SeedMetricKey): number {
  return warehouseIds.reduce((total, warehouseId) => total + WAREHOUSE_SEED[warehouseId].metrics[key], 0);
}

function avgSeed(warehouseIds: DepotWarehouseId[], key: SeedMetricKey): number {
  return Math.round(sumSeed(warehouseIds, key) / Math.max(warehouseIds.length, 1));
}

function distributeWeekly(totalIn: number, totalOut: number) {
  const makeSeries = (total: number) => {
    let running = 0;
    return WEEKLY_WEIGHTS.map((weight, index) => {
      if (index === WEEKLY_WEIGHTS.length - 1) return Math.max(0, total - running);
      const value = Math.round(total * weight);
      running += value;
      return value;
    });
  };
  const inSeries = makeSeries(totalIn);
  const outSeries = makeSeries(totalOut);
  return DAYS.map((day, index) => ({ day, enter: inSeries[index], exit: outSeries[index] }));
}

function fallbackZones(warehouseIds: DepotWarehouseId[]): ZoneResponse[] {
  return warehouseIds.flatMap((warehouseId) => {
    const zones = ZONE_SEED[warehouseId] ?? [];
    return zones.map((z, index) => {
      const utilization = Math.round((z.occupancy / z.maxCapacity) * 100);
      return {
        id: `${warehouseId}-${z.code}`,
        zone_code: z.code,
        name: `${z.code} (Cluster ${index + 1})`,
        zone_type: "storage",
        floor: "Ground",
        area_sqm: 900 + index * 120,
        max_capacity_units: z.maxCapacity,
        current_occupancy: z.occupancy,
        utilization_pct: utilization,
        status: utilization >= 90 ? "critical" : utilization >= 80 ? "warning" : "normal",
        polygon_coords: null,
        is_active: true,
        created_at: new Date().toISOString(),
      };
    });
  });
}

function normalizeZoneCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function zoneBelongsToWarehouse(zone: Pick<ZoneResponse, "zone_code" | "name">, warehouseId: DepotWarehouseId): boolean {
  const warehouse = WAREHOUSE_SEED[warehouseId];
  const code = normalizeZoneCode(zone.zone_code);
  const name = normalizeZoneCode(zone.name);
  return warehouse.zones.some((zoneCode) => {
    const normalized = normalizeZoneCode(zoneCode);
    return code === normalized || name.includes(normalized);
  });
}

function scopeZones(zones: ZoneResponse[], warehouseIds: DepotWarehouseId[]): ZoneResponse[] {
  const scoped = zones.filter((zone) =>
    zone.is_active !== false && warehouseIds.some((warehouseId) => zoneBelongsToWarehouse(zone, warehouseId))
  );
  return scoped.sort((a, b) => normalizeZoneCode(a.zone_code).localeCompare(normalizeZoneCode(b.zone_code)));
}

function scopeBatches(batches: BatchResponse[], zoneCodes: Set<string>): BatchResponse[] {
  return batches.filter((batch) => zoneCodes.has(normalizeZoneCode(batch.zone)));
}

function scopeDensity(density: DensityEntry[], zoneCodes: Set<string>): DensityEntry[] {
  return density.filter((entry) => zoneCodes.has(normalizeZoneCode(entry.zone_code)));
}

function zoneCapacityTotals(zones: ZoneResponse[]) {
  const totalCapacity = zones.reduce((total, zone) => total + zone.max_capacity_units, 0);
  const totalOccupancy = zones.reduce((total, zone) => total + zone.current_occupancy, 0);

  return {
    totalCapacity,
    totalOccupancy,
    occupancyPct: totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0,
    capacityRemainingUnits: Math.max(0, totalCapacity - totalOccupancy),
  };
}

function fallbackBatches(zones: ZoneResponse[]): BatchResponse[] {
  const now = new Date();
  return zones.map((zone, index) => {
    // Stagger creation dates: each batch created 15-60 days apart going back in time
    const daysAgo = 15 + index * 20; // 15, 35, 55, 75... days ago
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    // Expiry is 6 months after creation
    const expiryDate = new Date(createdAt.getTime() + 180 * 24 * 60 * 60 * 1000);
    return {
      id: `seed-batch-${zone.zone_code}`,
      batch_code: `B-${zone.zone_code}-${index + 1}`,
      sku_code: `SKU-${zone.zone_code}`,
      product_name: ["UltraTech Cement", "ACC Cement", "JSW Cement", "Ambuja Cement"][index % 4],
      zone: zone.zone_code,
      rack: `R-${index + 1}`,
      bin_location: `BIN-${index + 1}`,
      quantity: zone.current_occupancy,
      original_quantity: zone.max_capacity_units,
      manufacture_date: null,
      expiry_date: expiryDate.toISOString(),
      received_at: createdAt.toISOString(),
      sequencing_rule: "FIFO",
      priority_score: 50 + index,
      status: "active",
      is_near_expiry: false,
      days_to_expiry: Math.round((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      created_at: createdAt.toISOString(),
    };
  });
}

function fallbackIncidents(warehouseIds: DepotWarehouseId[]): IncidentResponse[] {
  const now = new Date().toISOString();
  return warehouseIds.flatMap((warehouseId) => Array.from({ length: WAREHOUSE_SEED[warehouseId].metrics.incidents }, (_, index) => ({
    id: `${warehouseId}-INC-${index + 1}`,
    breach_id: `${warehouseId}-BR-${index + 1}`,
    zone_id: WAREHOUSE_SEED[warehouseId].zones[index % WAREHOUSE_SEED[warehouseId].zones.length],
    severity: index === 0 ? "critical" : "medium",
    title: index === 0 ? "Unauthorized Entry" : "Capacity Warning",
    description: `${WAREHOUSE_SEED[warehouseId].name} scoped incident ${index + 1}`,
    escalation_level: index === 0 ? 2 : 1,
    escalation_deadline: null,
    escalated_to: index === 0 ? "Regional Manager" : null,
    status: "open",
    acknowledged_at: null,
    acknowledged_by: null,
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    video_archive_ref: index === 0 ? "Perimeter_Detection.mp4" : "Theft Camera .mp4",
    created_at: now,
  })));
}

function scopedBreakdown(warehouseIds: DepotWarehouseId[], key: SeedMetricKey) {
  return warehouseIds.map((id) => `${id.replace("WH_", "")}: ${WAREHOUSE_SEED[id].metrics[key]}`).join(" | ");
}

function buildCommandSnapshot(source: Omit<UnifiedDepotSource, "commandSnapshot">): CommandCenterSnapshot {
  const now = source.generatedAt;
  const cameras = source.warehouseIds.flatMap((warehouseId) => WAREHOUSE_SEED[warehouseId].cameras.map((cameraId, index) => ({
    id: cameraId,
    name: cameraId,
    zone: WAREHOUSE_SEED[warehouseId].zones[Math.floor(index / 2)] ?? null,
    status: "active",
    protocol: "rtsp",
    warehouse_id: warehouseId,
    region_id: WAREHOUSE_SEED[warehouseId].regionId,
    last_seen: now,
  })));

  return {
    generated_at: now,
    health_score: avgSeed(source.warehouseIds, "health"),
    kpis: [
      { key: "bags_in",            label: "Bags In (Weekly)",    value: String(source.kpis.bagsIn),                   detail: scopedBreakdown(source.warehouseIds, "bagsIn"),   tone: "healthy" },
      { key: "bags_out",           label: "Bags Out (Weekly)",   value: String(source.kpis.bagsOut),                  detail: scopedBreakdown(source.warehouseIds, "bagsOut"),  tone: "healthy" },
      { key: "total_capacity",     label: "Total Capacity",      value: String(source.kpis.totalCapacityUnits), detail: "Total storage capacity in assigned scope", tone: "healthy" },
      { key: "capacity_remaining", label: "Capacity Remaining",  value: String(source.kpis.capacityRemainingUnits),   detail: "Free storage units in assigned scope",           tone: source.kpis.occupancyPct >= 80 ? "warning" : "healthy" },
      { key: "vehicles",           label: "Vehicles (Today)",    value: String(source.kpis.vehicles),                 detail: scopedBreakdown(source.warehouseIds, "vehicles"), tone: "normal" },
      { key: "avg_unload",         label: "Avg Unload (Today)",  value: `${source.kpis.avgUnloadMinutes}m`,           detail: "Average across assigned warehouses",             tone: "normal" },
      { key: "incidents",          label: "Incidents (Today)",   value: String(source.kpis.incidentsToday),           detail: "Open backend incidents in current scope",        tone: source.kpis.incidentsToday > 3 ? "critical" : "warning" },
      { key: "occupancy",          label: "Occupancy %",         value: `${source.kpis.occupancyPct}%`,               detail: "Scoped zone utilization",                        tone: source.kpis.occupancyPct >= 80 ? "warning" : "healthy" },
      { key: "workers",            label: "Workers (Today)",     value: String(source.kpis.workers),                  detail: scopedBreakdown(source.warehouseIds, "workers"),  tone: "healthy" },
      { key: "cameras",            label: "Active Cameras",      value: `${source.kpis.activeCameras}/${source.kpis.totalCameras}`, detail: `${source.warehouseIds.length} authorized warehouse group(s)`, tone: "healthy" },
    ],
    gates: source.warehouseIds.flatMap((warehouseId) => GATE_SEED.map((gate, index) => ({
      id: `${warehouseId}-GATE-${gate.suffix}`,
      gate_code: `GATE-${gate.suffix}`,
      name: gate.name,
      gate_type: gate.gateType,
      status: gate.status,
      total_entries_today: 14 + index * 4,
      warehouse_id: warehouseId,
      region_id: WAREHOUSE_SEED[warehouseId].regionId,
      last_activity_at: now,
    }))),
    cameras,
    zones: source.zones.map((zone) => ({
      zone_code: zone.zone_code,
      name: zone.name,
      utilization_pct: zone.utilization_pct,
      current_occupancy: zone.current_occupancy,
      max_capacity_units: zone.max_capacity_units,
      status: zone.status,
    })),
    exceptions: source.incidents.filter((incident) => incident.status !== "resolved").map((incident) => ({
      id: incident.id,
      source: "Incident",
      title: incident.title,
      detail: incident.description || incident.title,
      priority: incident.severity === "critical" ? "P1" : "P3",
      zone: incident.zone_id,
      created_at: incident.created_at,
    })),
    timeline: source.incidents.map((incident) => ({
      id: `${incident.id}-timeline`,
      type: "incident",
      title: incident.title,
      detail: incident.status,
      status: incident.status,
      occurred_at: incident.created_at,
    })),
    recent_actions: [],
  };
}

export async function getUnifiedDepotSource(params: {
  role?: string;
  email?: string;
  location?: string;
}): Promise<UnifiedDepotSource> {
  const warehouseIds = scopedWarehouseIdsForUser(params.role, params.email, params.location);
  const [zonesResult, densityResult, incidentsResult, batchesResult] = await Promise.allSettled([
    getZones(),
    getDensityAnalytics(),
    getIncidents(),
    getBatches({ status: "active" }),
  ]);

  const backendZones = zonesResult.status === "fulfilled" ? scopeZones(zonesResult.value, warehouseIds) : [];
  const zones = fallbackZones(warehouseIds);
  const zoneCodes = new Set(zones.map((zone) => normalizeZoneCode(zone.zone_code)));
  const backendBatches = batchesResult.status === "fulfilled" ? scopeBatches(batchesResult.value, zoneCodes) : [];
  const batches = backendBatches.length > 0 ? backendBatches : fallbackBatches(zones);
  const incidents = incidentsResult.status === "fulfilled" ? incidentsResult.value : fallbackIncidents(warehouseIds);
  const density = densityResult.status === "fulfilled" ? scopeDensity(densityResult.value, zoneCodes) : [];

  const capacityTotals = zoneCapacityTotals(zones);
  const occupancyPct = capacityTotals.occupancyPct || avgSeed(warehouseIds, "occupancy");
  const activeIncidents = incidents.filter((incident) => incident.status !== "resolved");
  const seededCameraCount = warehouseIds.reduce((total, id) => total + WAREHOUSE_SEED[id].cameras.length, 0);
  const activeCameras = seededCameraCount;
  const totalCameras = seededCameraCount;

  const kpis = {
    bagsIn: sumSeed(warehouseIds, "bagsIn"),
    bagsOut: sumSeed(warehouseIds, "bagsOut"),
    vehicles: sumSeed(warehouseIds, "vehicles"),
    avgUnloadMinutes: avgSeed(warehouseIds, "unload"),
    incidentsToday: activeIncidents.length,
    occupancyPct,
    totalCapacityUnits: capacityTotals.totalCapacity,
    capacityRemainingUnits: capacityTotals.capacityRemainingUnits,
    workers: sumSeed(warehouseIds, "workers"),
    activeCameras,
    totalCameras,
  };

  const base = {
    generatedAt: new Date().toISOString(),
    source: backendZones.length > 0 ? "mixed" as const : "fallback" as const,
    warehouseIds,
    kpis,
    weeklyThroughput: distributeWeekly(kpis.bagsIn, kpis.bagsOut),
    zones,
    batches,
    incidents,
    density,
  };

  return {
    ...base,
    commandSnapshot: buildCommandSnapshot(base),
  };
}
