"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock, TrendingUp } from "lucide-react";

interface AtRiskSLA {
  id: string;
  name: string;
  metric_key: string;
  breach_probability: number;
  predicted_breach_at: string | null;
  time_to_breach_minutes: number | null;
  escalation_status: "at_risk" | "breached";
  current_value: number;
  threshold_value: number;
}

const MOCK_AT_RISK: AtRiskSLA[] = [
  { id: "s1", name: "Ingestion Rate SLA", metric_key: "events_per_minute", breach_probability: 0.82, predicted_breach_at: new Date(Date.now() + 18 * 60000).toISOString(), time_to_breach_minutes: 18, escalation_status: "at_risk", current_value: 87, threshold_value: 100 },
  { id: "s2", name: "HITL Review Window", metric_key: "hitl_review_latency_min", breach_probability: 0.97, predicted_breach_at: new Date(Date.now() + 4 * 60000).toISOString(), time_to_breach_minutes: 4, escalation_status: "breached", current_value: 34, threshold_value: 30 },
  { id: "s3", name: "Alert P1 Dispatch", metric_key: "p1_dispatch_latency_ms", breach_probability: 0.76, predicted_breach_at: new Date(Date.now() + 42 * 60000).toISOString(), time_to_breach_minutes: 42, escalation_status: "at_risk", current_value: 420, threshold_value: 500 },
];

function Countdown({ minutes }: { minutes: number | null }) {
  const [remaining, setRemaining] = useState(minutes ?? 0);

  useEffect(() => {
    if (!minutes) return;
    setRemaining(minutes);
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1 / 60)), 1000);
    return () => clearInterval(id);
  }, [minutes]);

  const mins = Math.floor(remaining);
  const secs = Math.floor((remaining - mins) * 60);

  return (
    <span className={`font-mono text-sm font-bold ${remaining < 10 ? "text-red-600" : remaining < 30 ? "text-amber-600" : "text-gray-700"}`}>
      {mins}m {String(secs).padStart(2, "0")}s
    </span>
  );
}

export default function SLAAtRiskList() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <p className="text-sm font-semibold text-amber-700">
          {MOCK_AT_RISK.length} SLAs at risk or breached — real-time breach countdown active
        </p>
      </div>

      {MOCK_AT_RISK.map((sla) => (
        <div key={sla.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900">{sla.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  sla.escalation_status === "breached"
                    ? "bg-red-50 text-red-600"
                    : "bg-amber-50 text-amber-600"
                }`}>
                  {sla.escalation_status.replace("_", " ")}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-400">{sla.metric_key}</p>
            </div>

            {/* Breach probability badge */}
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Breach Prob.</p>
              <p className={`text-lg font-black ${sla.breach_probability >= 0.9 ? "text-red-600" : "text-amber-600"}`}>
                {Math.round(sla.breach_probability * 100)}%
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>Current: {sla.current_value}</span>
              <span>Threshold: {sla.threshold_value}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100">
              <div
                className={`h-2 rounded-full transition-all ${
                  sla.current_value >= sla.threshold_value ? "bg-red-500" : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(100, (sla.current_value / sla.threshold_value) * 100)}%` }}
              />
            </div>
          </div>

          {/* Countdown */}
          {sla.time_to_breach_minutes !== null && sla.escalation_status !== "breached" && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">Predicted breach in:</span>
              <Countdown minutes={sla.time_to_breach_minutes} />
            </div>
          )}

          {sla.escalation_status === "breached" && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <TrendingUp className="h-3.5 w-3.5 text-red-500" />
              <span className="text-xs font-semibold text-red-600">SLA breached — immediate action required</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
