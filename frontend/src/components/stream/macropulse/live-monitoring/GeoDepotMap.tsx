"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Info, ZoomIn, ZoomOut } from "lucide-react";

export type EventSeverity = "critical" | "warning" | "info" | "ok";

export interface DepotEvent {
  id: string;
  zone: string;
  title: string;
  description: string;
  severity: EventSeverity;
  timestamp: string;
  camera_feed?: string;
  operator_id?: string;
  status: "open" | "acknowledged" | "escalated";
}

interface Zone {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

const ZONES: Zone[] = [
  { id: "Z1", label: "Inbound Gate",    x: 40,  y: 40,  w: 160, h: 100, color: "#dbeafe" },
  { id: "Z2", label: "Staging Area",    x: 240, y: 40,  w: 180, h: 100, color: "#fef9c3" },
  { id: "Z3", label: "Cold Storage",    x: 460, y: 40,  w: 140, h: 100, color: "#dcfce7" },
  { id: "Z4", label: "Dispatch Bay",    x: 40,  y: 180, w: 160, h: 110, color: "#fce7f3" },
  { id: "Z5", label: "Yard / Parking",  x: 240, y: 180, w: 180, h: 110, color: "#ede9fe" },
  { id: "Z6", label: "Outbound Gate",   x: 460, y: 180, w: 140, h: 110, color: "#ffedd5" },
];

const MOCK_EVENTS: DepotEvent[] = [
  { id: "E1", zone: "Z1", title: "Unauthorized vehicle detected", description: "LPR mismatch at inbound gate. Vehicle plate not in approved list.", severity: "critical", timestamp: new Date(Date.now() - 120000).toISOString(), camera_feed: "CAM-01", status: "open" },
  { id: "E2", zone: "Z2", title: "Dwell time exceeded", description: "Pallet in staging area for 4h 22m — SLA threshold is 3h.", severity: "warning", timestamp: new Date(Date.now() - 300000).toISOString(), camera_feed: "CAM-03", status: "open" },
  { id: "E3", zone: "Z3", title: "Temperature alert", description: "Cold storage zone dropped below -2°C. Threshold: 0°C.", severity: "critical", timestamp: new Date(Date.now() - 60000).toISOString(), camera_feed: "CAM-05", status: "acknowledged" },
  { id: "E4", zone: "Z5", title: "Overcapacity warning", description: "Yard occupancy at 94%. Max capacity: 120 vehicles.", severity: "warning", timestamp: new Date(Date.now() - 600000).toISOString(), camera_feed: "CAM-07", status: "open" },
  { id: "E5", zone: "Z6", title: "Dispatch cleared", description: "All outbound shipments dispatched on schedule.", severity: "ok", timestamp: new Date(Date.now() - 900000).toISOString(), camera_feed: "CAM-09", status: "acknowledged" },
];

const SEVERITY_COLOR: Record<EventSeverity, string> = {
  critical: "#ef4444",
  warning:  "#f59e0b",
  info:     "#3b82f6",
  ok:       "#22c55e",
};

function severityIcon(s: EventSeverity) {
  if (s === "critical") return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
  if (s === "warning")  return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
  if (s === "ok")       return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
  return <Info className="h-3.5 w-3.5 text-blue-500" />;
}

function relTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function GeoDepotMap({ onEventClick }: { onEventClick: (e: DepotEvent) => void }) {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [events] = useState<DepotEvent[]>(MOCK_EVENTS);

  const eventsPerZone = (zoneId: string) => events.filter((e) => e.zone === zoneId);

  const worstSeverity = (zoneId: string): EventSeverity | null => {
    const zEvents = eventsPerZone(zoneId);
    if (zEvents.some((e) => e.severity === "critical")) return "critical";
    if (zEvents.some((e) => e.severity === "warning"))  return "warning";
    if (zEvents.some((e) => e.severity === "info"))     return "info";
    if (zEvents.some((e) => e.severity === "ok"))       return "ok";
    return null;
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <div>
          <p className="text-sm font-bold text-gray-900">Depot Floor Plan — Live View</p>
          <p className="text-[11px] text-gray-400">{events.length} active events · color-coded by severity</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom((z) => Math.min(z + 0.2, 2))} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50">
            <ZoomIn className="h-4 w-4 text-gray-500" />
          </button>
          <button onClick={() => setZoom((z) => Math.max(z - 0.2, 0.6))} className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50">
            <ZoomOut className="h-4 w-4 text-gray-500" />
          </button>
          <span className="text-xs text-gray-400">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* SVG Map */}
      <div className="overflow-auto p-4">
        <svg
          width={660 * zoom}
          height={340 * zoom}
          viewBox="0 0 660 340"
          style={{ transition: "width 0.2s, height 0.2s" }}
        >
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="660" height="340" fill="url(#grid)" />

          {ZONES.map((zone) => {
            const severity = worstSeverity(zone.id);
            const isHovered = hoveredZone === zone.id;
            const borderColor = severity ? SEVERITY_COLOR[severity] : "#e2e8f0";
            const zoneEvents = eventsPerZone(zone.id);

            return (
              <g key={zone.id}>
                <rect
                  x={zone.x} y={zone.y} width={zone.w} height={zone.h}
                  rx={10}
                  fill={zone.color}
                  stroke={borderColor}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  style={{ cursor: "pointer", transition: "stroke-width 0.15s" }}
                  onMouseEnter={() => setHoveredZone(zone.id)}
                  onMouseLeave={() => setHoveredZone(null)}
                  onClick={() => {
                    const first = zoneEvents[0];
                    if (first) onEventClick(first);
                  }}
                />
                {/* Zone label */}
                <text x={zone.x + zone.w / 2} y={zone.y + 22} textAnchor="middle"
                  fontSize="11" fontWeight="600" fill="#374151">
                  {zone.id}
                </text>
                <text x={zone.x + zone.w / 2} y={zone.y + 38} textAnchor="middle"
                  fontSize="9" fill="#6b7280">
                  {zone.label}
                </text>

                {/* Event markers */}
                {zoneEvents.map((ev, idx) => {
                  const mx = zone.x + 16 + idx * 22;
                  const my = zone.y + zone.h - 20;
                  return (
                    <g key={ev.id} style={{ cursor: "pointer" }} onClick={() => onEventClick(ev)}>
                      <circle cx={mx} cy={my} r={8}
                        fill={SEVERITY_COLOR[ev.severity]}
                        opacity={0.9}
                      />
                      {ev.severity === "critical" && (
                        <circle cx={mx} cy={my} r={8}
                          fill="none"
                          stroke={SEVERITY_COLOR[ev.severity]}
                          strokeWidth={2}
                          opacity={0.5}
                          style={{ animation: "pulse 1.5s infinite" }}
                        />
                      )}
                      <text x={mx} y={my + 4} textAnchor="middle"
                        fontSize="8" fill="white" fontWeight="bold">
                        {idx + 1}
                      </text>
                    </g>
                  );
                })}

                {/* Event count badge */}
                {zoneEvents.length > 0 && (
                  <g>
                    <circle cx={zone.x + zone.w - 12} cy={zone.y + 12} r={10}
                      fill={SEVERITY_COLOR[worstSeverity(zone.id)!]} />
                    <text x={zone.x + zone.w - 12} y={zone.y + 16}
                      textAnchor="middle" fontSize="9" fill="white" fontWeight="bold">
                      {zoneEvents.length}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t border-gray-100 px-5 py-3">
        {(["critical", "warning", "info", "ok"] as EventSeverity[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SEVERITY_COLOR[s] }} />
            <span className="text-[11px] capitalize text-gray-500">{s}</span>
          </div>
        ))}
      </div>

      {/* Event list */}
      <div className="border-t border-gray-100">
        <div className="px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Active Events</p>
        </div>
        <div className="divide-y divide-gray-50">
          {events.map((ev) => (
            <button
              key={ev.id}
              onClick={() => onEventClick(ev)}
              className="flex w-full items-start gap-3 px-5 py-3 text-left transition hover:bg-gray-50"
            >
              {severityIcon(ev.severity)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{ev.title}</p>
                <p className="text-[11px] text-gray-400">Zone {ev.zone} · {relTime(ev.timestamp)}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                ev.status === "open" ? "bg-red-50 text-red-600" :
                ev.status === "acknowledged" ? "bg-amber-50 text-amber-600" :
                "bg-blue-50 text-blue-600"
              }`}>
                {ev.status}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
