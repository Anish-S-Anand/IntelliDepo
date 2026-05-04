"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Palette,
  Package,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  getAllActiveAlerts,
  acknowledgeMismatchAlert,
  acknowledgeColourAlert,
  type UnifiedAlert,
} from "@/services/depotVision";

// ---------------------------------------------------------------------------
// Severity config
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  critical: {
    color: "#F04A4A",
    bg: "rgba(240,74,74,0.08)",
    border: "rgba(240,74,74,0.25)",
    label: "CRITICAL",
  },
  high: {
    color: "#F97316",
    bg: "rgba(249,115,22,0.08)",
    border: "rgba(249,115,22,0.25)",
    label: "HIGH",
  },
  medium: {
    color: "#F5A623",
    bg: "rgba(245,166,35,0.08)",
    border: "rgba(245,166,35,0.25)",
    label: "MEDIUM",
  },
  low: {
    color: "#22D3A1",
    bg: "rgba(34,211,161,0.08)",
    border: "rgba(34,211,161,0.25)",
    label: "LOW",
  },
};

// ---------------------------------------------------------------------------
// Escalation countdown (15-min window)
// Uses a shared "tick" prop so the parent drives a single interval instead
// of mounting one setInterval per alert card.
// ---------------------------------------------------------------------------

function EscalationCountdown({ createdAt, tick }: { createdAt: string; tick: number }) {
  const remaining = useMemo(() => {
    const created = new Date(createdAt).getTime();
    const deadline = created + 15 * 60 * 1000; // 15 minutes
    return Math.max(0, Math.floor((deadline - tick) / 1000));
  }, [createdAt, tick]);

  if (remaining <= 0) {
    return (
      <span className="flex items-center gap-1 text-[10px] text-[#F04A4A] font-semibold animate-pulse">
        <ShieldAlert className="w-3 h-3" />
        ESCALATED
      </span>
    );
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining < 300; // < 5 min

  return (
    <span
      className={`flex items-center gap-1 text-[10px] font-mono ${
        isUrgent ? "text-[#F04A4A]" : "text-[#F5A623]"
      }`}
    >
      <Clock className="w-3 h-3" />
      {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Alert Item
// ---------------------------------------------------------------------------

function AlertItem({
  alert,
  onAcknowledge,
  isAcknowledging,
  tick,
}: {
  alert: UnifiedAlert;
  onAcknowledge: (alert: UnifiedAlert) => void;
  isAcknowledging: boolean;
  tick: number;
}) {
  const severity = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
  const isCountAlert = alert.type === "count_mismatch";

  return (
    <div
      className="rounded-[14px] border p-3.5 transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
      style={{
        borderColor: severity.border,
        background: severity.bg,
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {isCountAlert ? (
            <Package className="w-4 h-4 flex-shrink-0" style={{ color: severity.color }} />
          ) : (
            <Palette className="w-4 h-4 flex-shrink-0" style={{ color: severity.color }} />
          )}
          <div>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.15em] px-1.5 py-0.5 rounded"
              style={{
                color: severity.color,
                background: `${severity.color}15`,
              }}
            >
              {severity.label}
            </span>
            <span className="text-[10px] text-[#4E6090] ml-2">
              {isCountAlert ? "Count Mismatch" : "Colour Mismatch"}
            </span>
          </div>
        </div>
        <EscalationCountdown createdAt={alert.created_at} tick={tick} />
      </div>

      {/* Alert message */}
      <p className="text-[11px] text-[#8A9BBF] leading-relaxed mb-2 line-clamp-2">
        {alert.message}
      </p>

      {/* Manifest code */}
      {alert.manifest_code && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[9px] uppercase tracking-[0.15em] text-[#4E6090]">Manifest:</span>
          <span className="text-[10px] font-mono font-bold text-[#E8EDF8]">
            {alert.manifest_code}
          </span>
        </div>
      )}

      {/* Timestamp and acknowledge */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-[#4E6090]">
          {new Date(alert.created_at).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <button
          type="button"
          onClick={() => onAcknowledge(alert)}
          disabled={isAcknowledging}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
        >
          <CheckCircle2 className="w-3 h-3" />
          {isAcknowledging ? "..." : "Acknowledge"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AlertPanel component
// ---------------------------------------------------------------------------

export default function AlertPanel({
  isOpen,
  onClose,
  onAlertCountChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAlertCountChange?: (count: number) => void;
}) {
  const [alerts, setAlerts] = useState<UnifiedAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "count_mismatch" | "colour_mismatch">("all");
  const [wsConnected, setWsConnected] = useState(false);
  // Single shared tick for all EscalationCountdown instances — one interval instead of N
  const [tick, setTick] = useState(() => Date.now());

  // Shared countdown ticker — replaces per-card setInterval
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Ref to cancel in-flight loadAlerts requests when a newer one starts
  const loadAbortRef = useRef<AbortController | null>(null);

  const loadAlerts = useCallback(async () => {
    // Cancel any previous in-flight request
    loadAbortRef.current?.abort();
    loadAbortRef.current = new AbortController();
    try {
      const data = await getAllActiveAlerts();
      setAlerts(data);
      onAlertCountChange?.(data.length);
    } catch {
      setAlerts([]);
      onAlertCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [onAlertCountChange]);

  useEffect(() => {
    void loadAlerts();
    const interval = setInterval(() => void loadAlerts(), 15000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const wsUrl = useMemo(() => {
    if (typeof window === "undefined") return null;
    const token = window.localStorage.getItem("token");
    if (!token) return null;
    const configured = process.env.NEXT_PUBLIC_WS_URL;
    const base = configured
      ? configured.replace(/\/$/, "")
      : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:8000`;
    return `${base}/api/v1/realtime/ws/depot.alerts?token=${encodeURIComponent(token)}`;
  }, []);

  useEffect(() => {
    if (!isOpen || !wsUrl) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (isOpen) {
          reconnectTimer = window.setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (!msg || typeof msg !== "object") return;

          const eventType = msg.event_type as string | undefined;
          if (!eventType || (eventType !== "count_mismatch" && eventType !== "colour_mismatch")) {
            return;
          }

          void loadAlerts();
        } catch {
          // Ignore malformed realtime payloads
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (ws) {
        ws.close();
      }
      setWsConnected(false);
    };
  }, [isOpen, loadAlerts, wsUrl]);

  const handleAcknowledge = async (alert: UnifiedAlert) => {
    // Prevent double-clicks / concurrent acknowledges
    if (acknowledging !== null) return;
    setAcknowledging(alert.id);
    try {
      if (alert.type === "count_mismatch") {
        await acknowledgeMismatchAlert(alert.id);
      } else {
        await acknowledgeColourAlert(alert.id);
      }
      setAlerts((prev) => {
        const next = prev.filter((a) => a.id !== alert.id);
        onAlertCountChange?.(next.length);
        return next;
      });
    } catch {
      // Optimistic removal even on failure
      setAlerts((prev) => {
        const next = prev.filter((a) => a.id !== alert.id);
        onAlertCountChange?.(next.length);
        return next;
      });
    } finally {
      setAcknowledging(null);
    }
  };

  const filteredAlerts = useMemo(
    () => (filter === "all" ? alerts : alerts.filter((a) => a.type === filter)),
    [alerts, filter],
  );

  const countAlerts = useMemo(
    () => alerts.filter((a) => a.type === "count_mismatch").length,
    [alerts],
  );
  const colourAlerts = useMemo(
    () => alerts.filter((a) => a.type === "colour_mismatch").length,
    [alerts],
  );

  if (!isOpen) return null;

  return (
    <aside className="fixed top-[52px] right-0 bottom-0 w-[380px] bg-[#0D1526] border-l border-[#1E2F50] z-50 flex flex-col shadow-[-8px_0_32px_rgba(0,0,0,0.4)]">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-[#1E2F50] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#F5A623]" />
          <h2 className="text-[14px] font-bold text-[#E8EDF8]">Mismatch Alerts</h2>
          {alerts.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-[#F04A4A] text-white text-[10px] font-bold flex items-center justify-center">
              {alerts.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg border border-[#1E2F50] flex items-center justify-center text-[#4E6090] hover:text-[#E8EDF8] hover:border-[#2A3F68] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="px-4 py-2 flex gap-1.5 border-b border-[#1E2F50] flex-shrink-0">
        {[
          { key: "all" as const, label: "All", count: alerts.length },
          { key: "count_mismatch" as const, label: "Count", count: countAlerts },
          { key: "colour_mismatch" as const, label: "Colour", count: colourAlerts },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
              filter === tab.key
                ? "bg-[#E5521A]/10 text-[#E5521A] border border-[#E5521A]/25"
                : "text-[#4E6090] hover:text-[#8A9BBF] border border-transparent"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-[9px] opacity-70">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[#4E6090] text-[12px]">
            Loading alerts...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <p className="text-[12px] text-[#4E6090]">No active alerts</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              isAcknowledging={acknowledging === alert.id}
              tick={tick}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[#1E2F50] flex-shrink-0">
        <div className="flex items-center justify-between text-[9px] text-[#4E6090]">
          <span>Auto-escalation: 15 min window</span>
          <span className={`flex items-center gap-1 ${wsConnected ? "text-emerald-400" : "text-amber-400"}`}>
            <Bell className="w-3 h-3" />
            {wsConnected ? "WebSocket connected" : "WebSocket reconnecting"}
          </span>
        </div>
      </div>
    </aside>
  );
}
