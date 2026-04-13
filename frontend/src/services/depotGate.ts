import api from "./api";

export interface GateResponse {
  id: string;
  gate_code: string;
  name: string;
  gate_type: string;
  camera_id: string | null;
  status: string;
  is_active: boolean;
  last_opened: string | null;
  last_closed: string | null;
  total_entries_today: number;
  created_at: string;
}

export interface VehicleResponse {
  id: string;
  plate_number: string;
  vehicle_type: string | null;
  owner_name: string | null;
  company: string | null;
  status: string;
  blacklist_reason: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AccessLogResponse {
  id: string;
  gate_id: string;
  gate_code: string | null;
  plate_number: string;
  plate_confidence: number;
  vehicle_id: string | null;
  decision: string;
  direction: string;
  denied_reason: string | null;
  processed_at: string;
  created_at: string;
}

export interface VisitorResponse {
  id: string;
  name: string;
  company: string | null;
  purpose: string | null;
  contact_number: string | null;
  id_proof_type: string | null;
  id_proof_number: string | null;
  vehicle_plate: string | null;
  host_name: string | null;
  gate_id: string | null;
  checked_in_at: string;
  checked_out_at: string | null;
  pass_valid_until: string | null;
  status: string;
  registered_by: string | null;
  created_at: string;
}

// Gates
export async function getGates(): Promise<GateResponse[]> {
  const res = await api.get<GateResponse[]>("/depot/gate/gates");
  return res.data;
}

export async function gateAction(gateId: string, action: "open" | "close"): Promise<GateResponse> {
  const res = await api.post<GateResponse>(`/depot/gate/gates/${gateId}/action`, { action });
  return res.data;
}

// Vehicles
export async function getVehicles(status?: string): Promise<VehicleResponse[]> {
  const q = status ? `?status=${status}` : "";
  const res = await api.get<VehicleResponse[]>(`/depot/gate/vehicles${q}`);
  return res.data;
}

export async function registerVehicle(data: {
  plate_number: string; vehicle_type?: string; owner_name?: string;
  company?: string; status?: string; valid_until?: string;
}): Promise<VehicleResponse> {
  const res = await api.post<VehicleResponse>("/depot/gate/vehicles", data);
  return res.data;
}

export async function blacklistVehicle(vehicleId: string, reason: string): Promise<VehicleResponse> {
  const res = await api.patch<VehicleResponse>(`/depot/gate/vehicles/${vehicleId}/blacklist?reason=${encodeURIComponent(reason)}`);
  return res.data;
}

// LPR
export async function processLprScan(data: {
  gate_id: string; plate_number: string; confidence?: number; direction?: string;
}): Promise<AccessLogResponse> {
  const res = await api.post<AccessLogResponse>("/depot/gate/lpr/scan", data);
  return res.data;
}

export async function getAccessLogs(params?: {
  gate_id?: string; decision?: string; plate_number?: string; limit?: number;
}): Promise<AccessLogResponse[]> {
  const query = new URLSearchParams();
  if (params?.gate_id) query.set("gate_id", params.gate_id);
  if (params?.decision) query.set("decision", params.decision);
  if (params?.plate_number) query.set("plate_number", params.plate_number);
  if (params?.limit) query.set("limit", String(params.limit));
  const q = query.toString() ? `?${query.toString()}` : "";
  const res = await api.get<AccessLogResponse[]>(`/depot/gate/access-logs${q}`);
  return res.data;
}

// Visitors
export async function getVisitors(status?: string): Promise<VisitorResponse[]> {
  const q = status ? `?status=${status}` : "";
  const res = await api.get<VisitorResponse[]>(`/depot/gate/visitors${q}`);
  return res.data;
}

export async function getActiveVisitors(): Promise<VisitorResponse[]> {
  const res = await api.get<VisitorResponse[]>("/depot/gate/visitors/active");
  return res.data;
}

export async function registerVisitor(data: {
  name: string; company?: string; purpose?: string; contact_number?: string;
  id_proof_type?: string; id_proof_number?: string; vehicle_plate?: string;
  host_name?: string; gate_id?: string; pass_valid_hours?: number;
}): Promise<VisitorResponse> {
  const res = await api.post<VisitorResponse>("/depot/gate/visitors", data);
  return res.data;
}

export async function checkoutVisitor(visitorId: string): Promise<VisitorResponse> {
  const res = await api.patch<VisitorResponse>(`/depot/gate/visitors/${visitorId}/checkout`);
  return res.data;
}
