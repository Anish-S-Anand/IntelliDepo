import api from "./api";

export interface ZoneResponse {
  id: string;
  zone_code: string;
  name: string;
  zone_type: string;
  floor: string;
  area_sqm: number | null;
  max_capacity_units: number;
  current_occupancy: number;
  utilization_pct: number;
  status: string;
  polygon_coords: number[][] | null;
  is_active: boolean;
  created_at: string;
}

export interface HeatmapEntry {
  zone_code: string;
  name: string;
  utilization_pct: number;
  status: string;
  current_occupancy: number;
  max_capacity_units: number;
}

export interface DensityEntry {
  zone_code: string;
  name: string;
  area_sqm: number | null;
  current_occupancy: number;
  objects_per_sqm: number;
  density_level: string;
}

export interface CapacityStatusEntry {
  zone_code: string;
  name: string;
  utilization_pct: number;
  status: string;
  current_occupancy: number;
  max_capacity_units: number;
  warning_threshold: number;
  critical_threshold: number;
  exceeds_warning: boolean;
  exceeds_critical: boolean;
}

export interface ZoneHistoryEntry {
  id: string;
  zone_id: string;
  zone_code: string | null;
  utilization_pct: number;
  occupancy: number;
  max_capacity: number;
  timestamp: string;
  created_at: string;
}

export interface DensityHistoryEntry {
  id: string;
  zone_id: string;
  zone_code: string | null;
  occupancy: number;
  capacity: number;
  utilization_pct: number;
  status: string | null;
  recorded_at: string;
}

export interface ThresholdResponse {
  id: string;
  zone_id: string | null;
  zone_code: string | null;
  warning_pct: number;
  critical_pct: number;
  is_global: boolean;
  updated_by: string | null;
  created_at: string;
}

export interface CapacityAlertResponse {
  id: string;
  zone_id: string;
  zone_code: string | null;
  threshold_pct: number;
  current_pct: number;
  severity: string;
  message: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

// API functions

export async function getZones(zoneType?: string): Promise<ZoneResponse[]> {
  const params = zoneType ? `?zone_type=${zoneType}` : "";
  const res = await api.get<ZoneResponse[]>(`/depot/vision/cluster/zones${params}`);
  return res.data;
}

export async function getZone(zoneId: string): Promise<ZoneResponse> {
  const res = await api.get<ZoneResponse>(`/depot/vision/cluster/zones/${zoneId}`);
  return res.data;
}

export async function updateZoneBoundary(zoneId: string, polygonCoords: number[][]): Promise<ZoneResponse> {
  const res = await api.patch<ZoneResponse>(`/depot/vision/cluster/zones/${zoneId}/boundary`, { polygon_coords: polygonCoords });
  return res.data;
}

export async function updateZoneOccupancy(zoneId: string, occupancy: number): Promise<ZoneResponse> {
  const res = await api.patch<ZoneResponse>(`/depot/vision/cluster/zones/${zoneId}/occupancy`, { current_occupancy: occupancy });
  return res.data;
}

export async function getHeatmap(): Promise<HeatmapEntry[]> {
  const res = await api.get<HeatmapEntry[]>("/depot/vision/cluster/heatmap");
  return res.data;
}

export async function getDensityAnalytics(): Promise<DensityEntry[]> {
  const res = await api.get<DensityEntry[]>("/depot/vision/cluster/density");
  return res.data;
}

export async function getCapacityStatus(): Promise<CapacityStatusEntry[]> {
  const res = await api.get<CapacityStatusEntry[]>("/depot/vision/cluster/capacity/status");
  return res.data;
}

export async function getZoneHistory(zoneId: string, limit?: number): Promise<ZoneHistoryEntry[]> {
  const params = limit ? `?limit=${limit}` : "";
  const res = await api.get<ZoneHistoryEntry[]>(`/depot/vision/cluster/zones/${zoneId}/history${params}`);
  return res.data;
}

export async function getDensityHistory(zoneId?: string, limit?: number): Promise<DensityHistoryEntry[]> {
  const params = new URLSearchParams();
  if (zoneId) params.set("zone_id", zoneId);
  if (limit) params.set("limit", String(limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await api.get<DensityHistoryEntry[]>(`/depot/vision/cluster/density/history${query}`);
  return res.data;
}

export async function getThresholds(): Promise<ThresholdResponse[]> {
  const res = await api.get<ThresholdResponse[]>("/depot/vision/cluster/threshold");
  return res.data;
}

export async function configureThreshold(data: {
  zone_id?: string;
  zone_code?: string;
  warning_pct: number;
  critical_pct: number;
  is_global: boolean;
}): Promise<ThresholdResponse> {
  const res = await api.post<ThresholdResponse>("/depot/vision/cluster/threshold", data);
  return res.data;
}

export async function getCapacityAlerts(resolved?: boolean): Promise<CapacityAlertResponse[]> {
  const params = resolved !== undefined ? `?resolved=${resolved}` : "";
  const res = await api.get<CapacityAlertResponse[]>(`/depot/vision/cluster/alerts${params}`);
  return res.data;
}

export async function resolveCapacityAlert(alertId: string): Promise<CapacityAlertResponse> {
  const res = await api.patch<CapacityAlertResponse>(`/depot/vision/cluster/alerts/${alertId}/resolve`);
  return res.data;
}
