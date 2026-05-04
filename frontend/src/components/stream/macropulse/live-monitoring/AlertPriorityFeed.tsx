"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AlertTriangle, CheckCircle2, Clock, Info, ShieldAlert, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
export type AlertStatus = "active" | "acknowledged" | "escalated" | "resolved";

export interface OpsAlert {
  id: string;
  alert_type: string;
  severity: AlertSeverity;
  priority_score: number;
  source_name?: string;
  zone?: string;
  title: string;
  message?: string;
  status: AlertStatus;
  acknowledged_by?: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SEV: Record<AlertSeverity, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: "CRITICAL", color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)" },
  high:     { label: "HIGH",     color: "#f97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.25)" },
  medium:   { label: "MEDIUM",   color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)" },
  low:      { label: "LOW",      color: "#22d3ee", bg: "rgba(34,211,238,0.08)",  border: "rgba(34,211,238,0.25)" },
  info:     { label: "INFO",     color: "#94a3b8", bg: "rgba(148,163,184,0.06)", border: "rgba(148,163,184,0.15)" },
};

const STATUS_COLOR: Record<AlertStatus, string> = {
  active:       "#ef4444",
  acknowledged: "#f59e0b",
  escalated:    "#f97316",
  resolved:     "#22d3a1",
};

function SeverityIcon({ s }: { s: AlertSeverity }) {
  if (s === "critical" || s === "high") return <ShieldAlert className="w-3.5 h-3.5" />;
  if (s === "medium") return <AlertTriangle className="w-3.5 h-3.5" />;
  if (s === "low")    return <Clock className="w-3.5 h-3.5" />;
  return <Info className="w-3.5 h-3.5" />;
}

// ---------------------------------------------------------------------------
// Fallback mock data
// ---------------------------------------------------------------------------
const MOCK_ALERTS: OpsAlert[] = [
  { id: "a1", alert_type: "camera_motion", severity: "critical", priority_score: 100, source_name: "CAM-01", zone: "Inbound Gate",  title: "Unauthorized vehicle detected",    message: "LPR mismatch at inbound gate. Plate not in approved list.", status: "active",       timestamp: new Date(Date.now() - 90000).toISOString() },
  { id: "a2", alert_type: "sla_breach",    severity: "high",     priority_score: 80,  source_name: "SLA-07", zone: "Staging Area",  title: "SLA breach imminent — Shipment #4421", message: "Predicted breach in 12 min. Compliance window closing.", status: "active",       timestamp: new Date(Date.now() - 180000).toISOString() },
  { id: "a3", alert_type: "sensor_temp",   severity: "critical", priority_score: 95,  source_name: "TEMP-A01", zone: "Cold Storage", title: "Temperature threshold exceeded",  message: "Cold storage dropped to -2°C. Threshold: 0°C.",           status: "acknowledged", timestamp: new Date(Date.now() - 300000).toISOString() },
  { id: "a4", alert_type: "dwell_time",    severity: "medium",   priority_score: 55,  source_name: "YARD-03", zone: "Yard / Parking", title: "Dwell time exceeded — Truck #T-88", message: "Vehicle in yard for 4h 22m. SLA threshold: 3h.",          status: "active",       timestamp: new Date(Date.now() - 600000).toISOString() },
  { id: "a5", alert_type: "equipment",     severity: "low",      priority_score: 25,  source_name: "FORK-02", zone: "Dispatch Bay",  title: "Forklift battery low",             message: "Battery at 12%. Return to charging station.",             status: "active",       timestamp: new Date(Date.now() - 900000).toISOString() },
];

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface Props {
  maxItems?: number;
}

export default function AlertPriorityFeed({ maxItems = 20 }: Props) {
  const [alerts, setAlerts] = useState<OpsAlert[]>(MOCK_ALERTS);
  const [filter, setFilter] = useState<AlertSeverity | "all">("all");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch alerts from backend API
  const fetchAlerts = useCallback(async () => {
    try {
      const { getActiveAlerts } = await import("@/services/depotOps");
      const data = await getActiveAlerts();
      if (data.length > 0) { setAlerts(data as unknown as OpsAlert[]); return; }
    } catch {
      // backend unavailable — keep existing state
    }
  }, []);

  // Connect WebSocket for live updates, fallback to polling
  useEffect(() => {
    fetchAlerts();

    // Try WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/v1/ops/monitoring/ws/live-feed`;
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "alert" && data.payload) {
            setAlerts((prev) => {
              const exists = prev.find((a) => a.id === data.payload.id);
              if (exists) {
                return prev.map((a) => a.id === data.payload.id ? { ...a, ...data.payload } : a);
              }
              return [data.payload, ...prev].slice(0, 50);
            });
          }
        } catch { /* ignore parse errors */ }
      };
      ws.onerror = () => ws.close();
    } catch {
      // WebSocket not available
    }

    // Polling fallback every 15s
    const interval = setInterval(fetchAlerts, 15000);
    return () => {
      clearInterval(interval);
      wsRef.current?.close();
    };
  }, [fetchAlerts]);

  const handleAcknowledge = useCallback(async (id: string) => {
    // Try backend first
    try {
      const { acknowledgeAlert } = await import("@/services/depotOps");
      const updated = await acknowledgeAlert(id);
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: updated.status as AlertStatus } : a));
      return;
    } catch { /* fall through to local update */ }
    setAlerts((prev) =>
      prev.map((a) => a.id === id ? { ...a, status: "acknowledged" as AlertStatus } : a)
    );
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  }, []);

  const visible = alerts
    .filter((a) => !dismissedIds.has(a.id))
    .filter((a) => filter === "all" || a.severity === filter)
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, maxItems);

  const activeCritical = alerts.filter((a) => a.severity === "critical" && a.status === "active").length;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#E5521A]" />
          <span className="text-[13px] font-bold text-white">Alert Priority Feed</span>
          {activeCritical > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 animate-pulse">
              {activeCritical} CRITICAL
            </span>
          )}
        </div>
        <span className="text-[11px] text-[#4E6090]">{visible.length} alerts</span>
      </div>

      {/* Severity filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {(["all", "critical", "high", "medium", "low"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors"
            style={
              filter === s
                ? s === "all"
                  ? { background: "rgba(229,82,26,0.15)", color: "#E5521A", borderColor: "rgba(229,82,26,0.35)" }
                  : { background: SEV[s].bg, color: SEV[s].color, borderColor: SEV[s].border }
                : { background: "transparent", color: "#4E6090", borderColor: "#1E2F50" }
            }
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-[#4E6090]">
            <CheckCircle2 className="w-8 h-8 mb-2 text-[#22D3A1]" />
            <span className="text-[12px]">No active alerts</span>
          </div>
        )}
        {visible.map((alert) => {
          const sev = SEV[alert.severity];
          return (
            <div
              key={alert.id}
              className="rounded-xl border p-3 transition-all"
              style={{ background: sev.bg, borderColor: sev.border }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span style={{ color: sev.color }} className="mt-0.5 shrink-0">
                    <SeverityIcon s={alert.severity} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold" style={{ color: sev.color }}>
                        {sev.label}
                      </span>
                      <span className="text-[11px] font-semibold text-white truncate">{alert.title}</span>
                    </div>
                    {alert.message && (
                      <p className="text-[10px] text-[#8A9BBF] mt-0.5 leading-relaxed">{alert.message}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {alert.zone && (
                        <span className="text-[10px] text-[#4E6090]">Zone: {alert.zone}</span>
                      )}
                      {alert.source_name && (
                        <span className="text-[10px] text-[#4E6090]">{alert.source_name}</span>
                      )}
                      <span className="text-[10px] text-[#4E6090]">{timeAgo(alert.timestamp)}</span>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                        style={{ color: STATUS_COLOR[alert.status], borderColor: STATUS_COLOR[alert.status] + "40", background: STATUS_COLOR[alert.status] + "10" }}
                      >
                        {alert.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {alert.status === "active" && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold border border-[#1E2F50] text-[#8A9BBF] hover:text-[#22D3A1] hover:border-[#22D3A1]/40 transition"
                    >
                      ACK
                    </button>
                  )}
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="p-1 rounded-lg text-[#4E6090] hover:text-[#8A9BBF] transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
