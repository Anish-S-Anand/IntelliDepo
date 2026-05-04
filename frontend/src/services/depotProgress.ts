import api from "./api";

export type IntegrationState = "live" | "auth" | "offline";

export interface ProgressCard {
  id: string;
  title: string;
  area: string;
  state: IntegrationState;
  summary: string;
  details: string[];
}

export interface DayOneTwoProgressSnapshot {
  generatedAt: string;
  liveCount: number;
  authCount: number;
  offlineCount: number;
  cards: ProgressCard[];
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

function toCardState<T>(
  id: string,
  title: string,
  area: string,
  outcome: ApiOutcome<T>,
  onSuccess: (data: T) => { summary: string; details: string[] },
  authSummary: string,
): ProgressCard {
  if (outcome.kind === "success") {
    const resolved = onSuccess(outcome.data);
    return {
      id,
      title,
      area,
      state: "live",
      summary: resolved.summary,
      details: resolved.details,
    };
  }

  if (outcome.kind === "auth") {
    return {
      id,
      title,
      area,
      state: "auth",
      summary: authSummary,
      details: ["Endpoint is reachable and protected by authentication."],
    };
  }

  return {
    id,
    title,
    area,
    state: "offline",
    summary: outcome.message,
    details: ["Frontend could not verify this backend capability from the current session."],
  };
}

interface ObservabilityResponse {
  status: string;
  database?: { status?: string };
  metrics?: {
    total_requests?: number;
    avg_latency_ms?: number;
    error_rate?: number;
  };
}

interface VectorHealthResponse {
  status: string;
  provider: string;
}

interface RealtimeTopic {
  topic: string;
  subscribers: number;
}

interface SecurityKeyResponse {
  algorithm: string;
  key_version: string;
  fingerprint: string;
  rotation_ready: boolean;
}

interface PermissionResponse {
  roles: string[];
  permissions: string[];
}

interface AuditActionSummary {
  action: string;
  count: number;
}

interface StorageFile {
  key: string;
  size: number;
  content_type: string;
}

export async function getDayOneTwoProgressSnapshot(): Promise<DayOneTwoProgressSnapshot> {
  const [
    observability,
    vectorHealth,
    realtimeTopics,
    securityKeys,
    rbacPermissions,
    auditSummary,
    storageFiles,
  ] = await Promise.all([
    safeGet<ObservabilityResponse>("/health/observability"),
    safeGet<VectorHealthResponse>("/api/v1/vector/health"),
    safeGet<RealtimeTopic[]>("/api/v1/realtime/topics"),
    safeGet<SecurityKeyResponse>("/api/v1/security/keys"),
    safeGet<PermissionResponse>("/api/v1/rbac/me/permissions"),
    safeGet<AuditActionSummary[]>("/api/v1/audit/summary/actions"),
    safeGet<StorageFile[]>("/api/v1/storage/list?max_keys=20"),
  ]);

  const cards: ProgressCard[] = [
    toCardState(
      "monitoring",
      "OBS-6.19 Monitoring",
      "Day 2",
      observability,
      (data) => ({
        summary: `${data.status} | DB ${data.database?.status ?? "unknown"}`,
        details: [
          `Requests tracked: ${data.metrics?.total_requests ?? 0}`,
          `Avg latency: ${data.metrics?.avg_latency_ms ?? 0} ms`,
          `Error rate: ${Math.round((data.metrics?.error_rate ?? 0) * 100)}%`,
        ],
      }),
      "Monitoring API is live but requires auth context in this session.",
    ),
    toCardState(
      "audit",
      "OBS-6.18 Audit Trail",
      "Day 2",
      auditSummary,
      (data) => ({
        summary: `${data.length} action groups exposed`,
        details: data.slice(0, 3).map((item) => `${item.action}: ${item.count}`),
      }),
      "Audit API is exposed and waiting for an authenticated viewer.",
    ),
    toCardState(
      "rbac",
      "AUTH-6.2 RBAC",
      "Day 1",
      rbacPermissions,
      (data) => ({
        summary: `${data.roles.length} roles, ${data.permissions.length} permissions`,
        details: [
          `Roles: ${data.roles.join(", ") || "none"}`,
          `Permissions loaded: ${data.permissions.length}`,
        ],
      }),
      "RBAC endpoint is available and gated behind login.",
    ),
    toCardState(
      "security",
      "SEC-6.22 Security",
      "Day 2",
      securityKeys,
      (data) => ({
        summary: `${data.algorithm} | ${data.key_version}`,
        details: [
          `Fingerprint: ${data.fingerprint.slice(0, 12)}...`,
          `Rotation ready: ${data.rotation_ready ? "yes" : "no"}`,
        ],
      }),
      "Encryption service is available and protected by auth.",
    ),
    toCardState(
      "realtime",
      "PLAT-6.26 Realtime",
      "Day 2",
      realtimeTopics,
      (data) => ({
        summary: `${data.length} active topics`,
        details: data.slice(0, 3).map((topic) => `${topic.topic}: ${topic.subscribers} subscribers`),
      }),
      "Realtime engine is reachable and waiting for an authenticated session.",
    ),
    toCardState(
      "vector",
      "DATA-5.2 Vector DB",
      "Day 1",
      vectorHealth,
      (data) => ({
        summary: `${data.status} via ${data.provider}`,
        details: [
          "Embedding store is wired into the backend boot process.",
        ],
      }),
      "Vector health endpoint requires auth.",
    ),
    toCardState(
      "storage",
      "DATA-5.6 File Storage",
      "Day 1",
      storageFiles,
      (data) => ({
        summary: `${data.length} files visible in sample listing`,
        details: data.slice(0, 3).map((file) => `${file.key} (${file.size} bytes)`),
      }),
      "Storage service is available and protected by auth.",
    ),
  ];

  const liveCount = cards.filter((card) => card.state === "live").length;
  const authCount = cards.filter((card) => card.state === "auth").length;
  const offlineCount = cards.filter((card) => card.state === "offline").length;

  return {
    generatedAt: new Date().toISOString(),
    liveCount,
    authCount,
    offlineCount,
    cards,
  };
}
