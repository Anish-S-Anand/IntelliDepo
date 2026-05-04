import api from "./api";
import type {
  AgentMetrics,
  AlertResponse,
  CFOBriefPipelineResult,
  CostRoutingStatus,
  EventLogEntry,
  GuardrailViolation,
  HITLPendingAlert,
  MacroPulseAgentQueryResponse,
  MacroPulseDashboard,
  MacroPulseRealtimeResponse,
  SensitivityResponse,
  TenantProfile,
} from "@/types/macropulse";

const BASE = "/api/v1/macropulse";
const BASE_API = "/api";

export async function getMacroPulseRealtime(): Promise<MacroPulseRealtimeResponse> {
  const { data } = await api.get<MacroPulseRealtimeResponse>(`${BASE}/realtime`);
  return data;
}

export function buildDefaultTenantProfile(tenantId: string): TenantProfile {
  return {
    tenant_id: tenantId,
    company_name: "Fidelis Demo Manufacturing",
    primary_region: "IN",
    primary_currency: "INR",
    debt: {
      total_loan_amount_cr: 100,
      rate_type: "Floating",
      current_effective_rate_pct: 9.5,
      floating_proportion_pct: 65,
      short_term_debt_cr: 30,
      long_term_debt_cr: 70,
    },
    fx: {
      net_usd_exposure_m: 45,
      net_aed_exposure_m: 10,
      net_sar_exposure_m: 5,
      hedge_ratio_pct: 65,
      hedge_instrument: "Forward",
    },
    cogs: {
      total_cogs_cr: 100,
      steel_pct: 20,
      petroleum_pct: 30,
      electronics_pct: 15,
      freight_pct: 10,
      other_pct: 25,
    },
    portfolio: {
      gsec_holdings_cr: 50,
      modified_duration: 4,
    },
    logistics: {
      primary_routes: ["Mumbai-Dubai", "Chennai-Jebel Ali"],
      monthly_shipment_value_cr: 10,
      inventory_buffer_days: 30,
    },
    notification_config: {
      email: "cfo@fidelis-demo.com",
      channels: ["email"],
    },
  };
}

export async function getMacroPulseDashboard(tenantId: string): Promise<MacroPulseDashboard> {
  const { data } = await api.get<MacroPulseDashboard>(`${BASE}/dashboard/${tenantId}`);
  return data;
}

export async function getTenantProfile(tenantId: string): Promise<TenantProfile> {
  const { data } = await api.get<TenantProfile>(`${BASE_API}/tenant/profile/${tenantId}`);
  return data;
}

export async function upsertTenantProfile(profile: TenantProfile): Promise<TenantProfile> {
  const { data } = await api.post<TenantProfile>(`${BASE_API}/tenant/profile`, profile, {
    headers: { "X-Write-Region": profile.primary_region === "IN" ? "IN" : "UAE" },
  });
  return data;
}

export async function updateTenantProfile(profile: TenantProfile): Promise<TenantProfile> {
  const { data } = await api.put<TenantProfile>(`${BASE_API}/tenant/profile/${profile.tenant_id}`, profile, {
    headers: { "X-Write-Region": profile.primary_region === "IN" ? "IN" : "UAE" },
  });
  return data;
}

export async function ensureTenantProfile(tenantId: string): Promise<TenantProfile> {
  try {
    return await getTenantProfile(tenantId);
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status !== 404) {
      throw error;
    }
    return upsertTenantProfile(buildDefaultTenantProfile(tenantId));
  }
}

export async function getSensitivity(tenantId: string): Promise<SensitivityResponse> {
  const { data } = await api.get<SensitivityResponse>(`${BASE_API}/tenant/profile/${tenantId}/sensitivity`);
  return data;
}

export async function getHitlPending(tenantId?: string): Promise<HITLPendingAlert[]> {
  const suffix = tenantId ? `/pending/${tenantId}` : "/pending";
  const { data } = await api.get<HITLPendingAlert[]>(`${BASE_API}/hitl${suffix}`);
  return data;
}

export async function approveHitl(alertId: string, reviewer: string, notes: string): Promise<AlertResponse> {
  const { data } = await api.post<AlertResponse>(`${BASE_API}/hitl/${alertId}/approve`, {
    reviewer,
    notes,
  });
  return data;
}

export async function rejectHitl(
  alertId: string,
  reviewer: string,
  notes: string,
  reason: string
): Promise<AlertResponse> {
  const { data } = await api.post<AlertResponse>(`${BASE_API}/hitl/${alertId}/reject`, {
    reviewer,
    notes,
    reason,
  });
  return data;
}

export async function getGuardrailViolations(tenantId: string): Promise<GuardrailViolation[]> {
  const { data } = await api.get<GuardrailViolation[]>(`${BASE_API}/guardrails/violations/${tenantId}`);
  return data;
}

export async function queryMacroPulseAgent(
  text: string,
  tenantId?: string,
  region?: "India" | "UAE" | "Saudi Arabia"
): Promise<MacroPulseAgentQueryResponse> {
  const { data } = await api.post<MacroPulseAgentQueryResponse>(`${BASE}/agent/query`, {
    text,
    tenant_id: tenantId ?? null,
    region: region ?? null,
  });
  return data;
}

export async function streamMacroPulseAgent(
  text: string,
  tenantId: string | undefined,
  region: "India" | "UAE" | "Saudi Arabia" | undefined,
  onToken: (text: string) => void,
  onMeta: (meta: Record<string, unknown>) => void,
  onDone: () => void,
  onError: (err: Error) => void
): Promise<void> {
  try {
    const res = await fetch("/backend/api/v1/macropulse/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        tenant_id: tenantId ?? null,
        region: region ?? null,
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Stream failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") {
          onDone();
          return;
        }
        try {
          const parsed = JSON.parse(payload);
          if (parsed.type === "token") {
            onToken(parsed.content);
          } else if (parsed.type === "meta") {
            onMeta(parsed);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

// ── Day 5 service calls ──────────────────────────────────────────────────────

export async function runCFOBriefPipeline(params: {
  tenant_id?: string;
  upload_to_s3?: boolean;
  notify?: boolean;
  dry_run?: boolean;
}): Promise<CFOBriefPipelineResult> {
  const query = new URLSearchParams({
    tenant_id: params.tenant_id ?? "tenant-india-001",
    upload_to_s3: String(params.upload_to_s3 ?? false),
    notify: String(params.notify ?? false),
    dry_run: String(params.dry_run ?? true),
  });
  const { data } = await api.post<CFOBriefPipelineResult>(`${BASE}/cfo-brief/pipeline?${query}`);
  return data;
}

export async function getCostRoutingStatus(): Promise<CostRoutingStatus> {
  const { data } = await api.get<CostRoutingStatus>(`${BASE}/cost-routing/status`);
  return data;
}

export async function getEventLog(): Promise<EventLogEntry[]> {
  const { data } = await api.get<{ events: EventLogEntry[] }>(`${BASE}/events/log`);
  return data.events ?? [];
}

export async function getEventSchemas(): Promise<Record<string, unknown>> {
  const { data } = await api.get<Record<string, unknown>>(`${BASE}/events/schemas`);
  return data;
}

export async function getAgentMetrics(): Promise<AgentMetrics> {
  const { data } = await api.get<AgentMetrics>(`${BASE}/metrics`);
  return data;
}

export async function classifyAlert(
  tenantId: string,
  agentOutput: Record<string, unknown>
): Promise<AlertResponse | null> {
  const { data } = await api.post<AlertResponse | null>(`${BASE_API}/alerts/classify`, {
    tenant_id: tenantId,
    agent_output: agentOutput,
  });
  return data;
}
