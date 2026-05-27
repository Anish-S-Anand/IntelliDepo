import { type CommandCenterSnapshot } from "@/services/depotCommand";
import { getZones, getDensityAnalytics, type DensityEntry, type ZoneResponse } from "@/services/depotCluster";
import { getIncidents, type IncidentResponse } from "@/services/depotPerimeter";
import { getBatches, type BatchResponse } from "@/services/depotSequencing";

export type DepotRole = "warehouse_manager" | "regional_manager" | "central_manager" | "admin";
export type DepotWarehouseId = "WH_HYD" | "WH_BLR" | "WH_MUM";

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

const WAREHOUSE_SEED = {
  WH_HYD: {
    name: "Hyderabad Depot",
    regionId: "REG_SOUTH",
    zones: ["HYD-Z1", "HYD-Z2", "HYD-Z3"],
    cameras: ["CAM-H1", "CAM-H2", "CAM-H3", "CAM-H4", "CAM-H5", "CAM-H6"],
    metrics: { bagsIn: 1260, bagsOut: 1040, vehicles: 38, workers: 82, incidents: 2, occupancy: 74, unload: 34 },
  },
  WH_BLR: {
    name: "Bangalore Depot",
    regionId: "REG_SOUTH",
    zones: ["BLR-Z1", "BLR-Z2", "BLR-Z3"],
    cameras: ["CAM-B1", "CAM-B2", "CAM-B3", "CAM-B4", "CAM-B5", "CAM-B6"],
    metrics: { bagsIn: 1435, bagsOut: 1195, vehicles: 44, workers: 76, incidents: 3, occupancy: 71, unload: 29 },
  },
  WH_MUM: {
    name: "Mumbai Depot",
    regionId: "REG_WEST",
    zones: ["MUM-Z1", "MUM-Z2", "MUM-Z3"],
    cameras: ["CAM-M1", "CAM-M2", "CAM-M3", "CAM-M4", "CAM-M5", "CAM-M6"],
    metrics: { bagsIn: 980, bagsOut: 910, vehicles: 31, workers: 64, incidents: 1, occupancy: 82, unload: 37 },
  },
} as const;

type SeedMetricKey = keyof typeof WAREHOUSE_SEED.WH_HYD.metrics;

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
    return ["WH_HYD", "WH_BLR"];
  }

  return ["WH_HYD", "WH_BLR", "WH_MUM"];
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
    const warehouse = WAREHOUSE_SEED[warehouseId];
    return warehouse.zones.map((zoneCode, index) => {
      const max = 1000 + index * 120;
      const utilization = Math.max(0, Math.min(100, warehouse.metrics.occupancy - index * 4));
      const occupied = Math.round(max * utilization / 100);
      return {
        id: `${warehouseId}-${zoneCode}`,
        zone_code: zoneCode,
        name: `${zoneCode} (Cluster ${index + 1})`,
        zone_type: "storage",
        floor: "Ground",
        area_sqm: 900 + index * 120,
        max_capacity_units: max,
        current_occupancy: occupied,
        utilization_pct: utilization,
        status: utilization >= 90 ? "critical" : utilization >= 80 ? "warning" : "normal",
        polygon_coords: null,
        is_active: true,
        created_at: new Date().toISOString(),
      };
    });
  });
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
  return zones.map((zone, index) => ({
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
    expiry_date: null,
    received_at: new Date().toISOString(),
    sequencing_rule: "FIFO",
    priority_score: 50 + index,
    status: "active",
    is_near_expiry: false,
    days_to_expiry: null,
    created_at: new Date().toISOString(),
  }));
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
    health_score: source.kpis.incidentsToday > 3 ? 84 : 91,
    kpis: [
      { key: "bags_in", label: "Bags In", value: String(source.kpis.bagsIn), detail: scopedBreakdown(source.warehouseIds, "bagsIn"), tone: "healthy" },
      { key: "bags_out", label: "Bags Out", value: String(source.kpis.bagsOut), detail: scopedBreakdown(source.warehouseIds, "bagsOut"), tone: "healthy" },
      { key: "vehicles", label: "Vehicles", value: String(source.kpis.vehicles), detail: scopedBreakdown(source.warehouseIds, "vehicles"), tone: "normal" },
      { key: "avg_unload", label: "Avg Unload Time", value: `${source.kpis.avgUnloadMinutes}m`, detail: "Average across assigned warehouses", tone: "normal" },
      { key: "incidents", label: "Incidents Today", value: String(source.kpis.incidentsToday), detail: "Open backend incidents in current scope", tone: source.kpis.incidentsToday > 3 ? "critical" : "warning" },
      { key: "occupancy", label: "Occupancy %", value: `${source.kpis.occupancyPct}%`, detail: "Scoped zone utilization", tone: source.kpis.occupancyPct >= 80 ? "warning" : "healthy" },
      { key: "capacity_remaining", label: "Capacity Remaining", value: String(source.kpis.capacityRemainingUnits), detail: "Free storage units in assigned scope", tone: source.kpis.occupancyPct >= 80 ? "warning" : "healthy" },
      { key: "workers", label: "Worker Count", value: String(source.kpis.workers), detail: scopedBreakdown(source.warehouseIds, "workers"), tone: "healthy" },
      { key: "cameras", label: "Active Cameras", value: `${source.kpis.activeCameras}/${source.kpis.totalCameras}`, detail: `${source.warehouseIds.length} authorized warehouse group(s)`, tone: "healthy" },
    ],
    gates: source.warehouseIds.flatMap((warehouseId) => WAREHOUSE_SEED[warehouseId].zones.map((zone, index) => ({
      id: `${warehouseId}-G${index + 1}`,
      gate_code: `Gate ${index + 1}`,
      name: `${WAREHOUSE_SEED[warehouseId].name} Gate ${index + 1}`,
      gate_type: "both",
      status: index === 0 ? "open" : "closed",
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

  // Current backend zone, batch, incident, and camera APIs are global and do not
  // yet expose persisted warehouse IDs. Use scoped demo data here so persona
  // dashboards do not show the same storage/utilization figures for BLR/HYD/MUM.
  const zones = fallbackZones(warehouseIds);
  const incidents = fallbackIncidents(warehouseIds);
  const batches = fallbackBatches(zones);
  const density = densityResult.status === "fulfilled" ? densityResult.value : [];

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
    capacityRemainingUnits: capacityTotals.capacityRemainingUnits,
    workers: sumSeed(warehouseIds, "workers"),
    activeCameras,
    totalCameras,
  };

  const base = {
    generatedAt: new Date().toISOString(),
    source: zonesResult.status === "fulfilled" || incidentsResult.status === "fulfilled" || batchesResult.status === "fulfilled" ? "mixed" as const : "fallback" as const,
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
