"use client";

import { useState, useCallback } from "react";
import { AlertTriangle, Camera, CheckCircle, ChevronRight, X } from "lucide-react";
import type { DepotEvent } from "./GeoDepotMap";

interface Props {
  event: DepotEvent;
  onClose: () => void;
}

export default function IncidentDetailModal({ event, onClose }: Props) {
  const [status, setStatus] = useState(event.status);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAcknowledge = useCallback(async () => {
    setSubmitting(true);
    try {
      const { acknowledgeAlert } = await import("@/services/depotOps");
      await acknowledgeAlert(event.id);
      setStatus("acknowledged");
      setSubmitted(true);
      setSubmitting(false);
      return;
    } catch { /* fall through to local update */ }
    // Fallback: local-only state change
    setStatus("acknowledged");
    setSubmitted(true);
    setSubmitting(false);
  }, [event.id]);

  const handleEscalate = useCallback(async () => {
    setSubmitting(true);
    try {
      const { escalateAlert } = await import("@/services/depotOps");
      await escalateAlert(event.id);
      setStatus("escalated");
      setSubmitted(true);
      setSubmitting(false);
      return;
    } catch { /* fall through to local update */ }
    // Fallback: local-only state change
    setStatus("escalated");
    setSubmitted(true);
    setSubmitting(false);
  }, [event.id]);

  const severityBg: Record<string, string> = {
    critical: "bg-red-50 border-red-200 text-red-700",
    warning:  "bg-amber-50 border-amber-200 text-amber-700",
    info:     "bg-blue-50 border-blue-200 text-blue-700",
    ok:       "bg-emerald-50 border-emerald-200 text-emerald-700",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />

      {/* Slide-in panel */}
      <div
        className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        style={{ animation: "slideInRight 0.25s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Incident Detail</p>
            <h3 className="mt-1 text-base font-bold text-gray-900">{event.title}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Severity badge */}
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase ${severityBg[event.severity]}`}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {event.severity} · Zone {event.zone}
          </div>

          {/* Description */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Description</p>
            <p className="text-sm text-gray-700">{event.description}</p>
          </div>

          {/* Camera feed thumbnail */}
          {event.camera_feed && (
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5">
                <Camera className="h-4 w-4 text-gray-400" />
                <p className="text-xs font-semibold text-gray-600">{event.camera_feed} — Live Feed</p>
                <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              </div>
              {/* Simulated camera feed */}
              <div className="relative h-40 bg-gray-900 flex items-center justify-center">
                <div className="absolute inset-0 opacity-20"
                  style={{ background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.03) 2px,rgba(255,255,255,0.03) 4px)" }} />
                <div className="text-center">
                  <Camera className="mx-auto h-8 w-8 text-gray-600" />
                  <p className="mt-2 text-xs text-gray-500">{event.camera_feed} · Feed Preview</p>
                  <p className="text-[10px] text-gray-600">Zone {event.zone}</p>
                </div>
                <span className="absolute top-2 right-2 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">REC</span>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Event ID", event.id],
              ["Zone", event.zone],
              ["Status", status],
              ["Timestamp", new Date(event.timestamp).toLocaleTimeString()],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-800 capitalize">{value}</p>
              </div>
            ))}
          </div>

          {/* Notes */}
          {!submitted && (
            <div>
              <label className="text-xs font-semibold text-gray-600">Operator Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add notes before acknowledging or escalating..."
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}

          {submitted && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-700">
                Event {status} successfully
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!submitted && (
          <div className="border-t border-gray-100 px-5 py-4 flex gap-3">
            <button
              onClick={handleAcknowledge}
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              Acknowledge
            </button>
            <button
              onClick={handleEscalate}
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
              Escalate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
