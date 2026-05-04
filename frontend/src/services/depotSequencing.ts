import api from "./api";

export interface BatchResponse {
  id: string;
  batch_code: string;
  sku_code: string;
  product_name: string | null;
  zone: string | null;
  rack: string | null;
  bin_location: string | null;
  quantity: number;
  original_quantity: number;
  manufacture_date: string | null;
  expiry_date: string | null;
  received_at: string;
  sequencing_rule: string;
  priority_score: number;
  status: string;
  is_near_expiry: boolean;
  days_to_expiry: number | null;
  created_at: string;
}

export interface ConfigResponse {
  id: string;
  zone: string;
  sku_pattern: string;
  rule: string;
  near_expiry_days: number;
  auto_quarantine_on_expiry: boolean;
  enforce_strict: boolean;
  is_active: boolean;
  created_at: string;
}

export interface PickOrderResponse {
  id: string;
  batch_id: string;
  batch_code: string | null;
  sku_code: string;
  zone: string | null;
  pick_quantity: number;
  pick_sequence: number;
  sequencing_rule: string | null;
  compliance_status: string;
  override_reason: string | null;
  picked: boolean;
  picked_at: string | null;
  created_at: string;
}

export interface PickLogResponse {
  id: string;
  pick_order_id: string;
  batch_id: string;
  batch_code: string | null;
  sku_code: string;
  quantity_picked: number;
  sequencing_rule_applied: string | null;
  compliance_status: string;
  override_reason: string | null;
  scan_method: string | null;
  zone: string | null;
  picked_by: string | null;
  picked_at: string;
  created_at: string;
}

// Batches
export async function getBatches(params?: { sku_code?: string; zone?: string; status?: string }): Promise<BatchResponse[]> {
  const query = new URLSearchParams();
  if (params?.sku_code) query.set("sku_code", params.sku_code);
  if (params?.zone) query.set("zone", params.zone);
  if (params?.status) query.set("status", params.status);
  const q = query.toString() ? `?${query.toString()}` : "";
  const res = await api.get<BatchResponse[]>(`/depot/vision/sequencing/batches${q}`);
  return res.data;
}

export async function createBatch(data: {
  batch_code: string; sku_code: string; product_name?: string;
  zone?: string; rack?: string; bin_location?: string;
  quantity: number; manufacture_date?: string; expiry_date?: string;
  sequencing_rule?: string;
}): Promise<BatchResponse> {
  const res = await api.post<BatchResponse>("/depot/vision/sequencing/batches", data);
  return res.data;
}

export async function getNearExpiryBatches(days?: number): Promise<BatchResponse[]> {
  const q = days ? `?days=${days}` : "";
  const res = await api.get<BatchResponse[]>(`/depot/vision/sequencing/batches/near-expiry${q}`);
  return res.data;
}

// Configs
export async function getSequencingConfigs(zone?: string): Promise<ConfigResponse[]> {
  const q = zone ? `?zone=${zone}` : "";
  const res = await api.get<ConfigResponse[]>(`/depot/vision/sequencing/configs${q}`);
  return res.data;
}

export async function createSequencingConfig(data: {
  zone: string; sku_pattern?: string; rule?: string;
  near_expiry_days?: number; auto_quarantine_on_expiry?: boolean; enforce_strict?: boolean;
}): Promise<ConfigResponse> {
  const res = await api.post<ConfigResponse>("/depot/vision/sequencing/configs", data);
  return res.data;
}

// Pick Orders
export async function generatePickOrders(data: { sku_code: string; zone?: string; quantity_needed: number }): Promise<PickOrderResponse[]> {
  const res = await api.post<PickOrderResponse[]>("/depot/vision/sequencing/pick-orders", data);
  return res.data;
}

export async function getPickOrders(params?: { sku_code?: string; picked?: boolean }): Promise<PickOrderResponse[]> {
  const query = new URLSearchParams();
  if (params?.sku_code) query.set("sku_code", params.sku_code);
  if (params?.picked !== undefined) query.set("picked", String(params.picked));
  const q = query.toString() ? `?${query.toString()}` : "";
  const res = await api.get<PickOrderResponse[]>(`/depot/vision/sequencing/pick-orders${q}`);
  return res.data;
}

export async function confirmPick(orderId: string): Promise<PickOrderResponse> {
  const res = await api.patch<PickOrderResponse>(`/depot/vision/sequencing/pick-orders/${orderId}/confirm`);
  return res.data;
}

export async function overridePick(orderId: string, data: { reason_code: string; reason_detail: string }): Promise<PickOrderResponse> {
  const res = await api.patch<PickOrderResponse>(`/depot/vision/sequencing/pick-orders/${orderId}/override`, data);
  return res.data;
}

// Pick Logs
export async function getPickLogs(params?: { sku_code?: string; compliance_status?: string }): Promise<PickLogResponse[]> {
  const query = new URLSearchParams();
  if (params?.sku_code) query.set("sku_code", params.sku_code);
  if (params?.compliance_status) query.set("compliance_status", params.compliance_status);
  const q = query.toString() ? `?${query.toString()}` : "";
  const res = await api.get<PickLogResponse[]>(`/depot/vision/sequencing/pick-logs${q}`);
  return res.data;
}
