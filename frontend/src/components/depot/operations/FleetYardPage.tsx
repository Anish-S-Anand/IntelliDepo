"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Truck,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Anchor,
  Package,
  ArrowUpRight,
  RefreshCw,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Vehicle {
  vehicle_id: string;
  vehicle_type: string;
  driver_name: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number;
  current_zone: string | null;
  assigned_dock: string | null;
  entered_yard_at: string | null;
  dwell_minutes?: number;
}

interface DockSlot {
  dock_id: string;
  dock_name: string | null;
  zone: string | null;
  status: string;
  assigned_vehicle_id: string | null;
  dock_type: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface QueueRecommendation {
  vehicle_id: string;
  vehicle_type: string | null;
  wait_minutes: number;
  recommended_dock: string;
  dock_type: string;
  priority_score: number;
  reason: string;
}

interface DwellHeatmapEntry {
  zone: string;
  avg_dwell_minutes: number;
  total_vehicles: number;
  over_threshold_count: number;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const MOCK_VEHICLES: Vehicle[] = [
  { vehicle_id: "TRK-1001", vehicle_type: "truck", driver_name: "Rajesh K", status: "at_dock", latitude: 12.985, longitude: 77.589, speed_kmh: 0, current_zone: "dock_area", assigned_dock: "DOCK-A1", entered_yard_at: "2026-04-13T04:30:00Z" },
  { vehicle_id: "TRK-1002", vehicle_type: "truck", driver_name: "Suresh M", status: "in_yard", latitude: 12.972, longitude: 77.565, speed_kmh: 0, current_zone: "staging_area", assigned_dock: null, entered_yard_at: "2026-04-13T06:15:00Z" },
  { vehicle_id: "TRK-1003", vehicle_type: "refrigerated", driver_name: "Anil P", status: "at_gate", latitude: 12.955, longitude: 77.560, speed_kmh: 5, current_zone: "inbound_gate", assigned_dock: null, entered_yard_at: "2026-04-13T08:45:00Z" },
  { vehicle_id: "VAN-2001", vehicle_type: "van", driver_name: "Priya S", status: "in_yard", latitude: 13.005, longitude: 77.575, speed_kmh: 0, current_zone: "parking_yard", assigned_dock: null, entered_yard_at: "2026-04-13T02:10:00Z" },
  { vehicle_id: "TRK-1004", vehicle_type: "truck", driver_name: "Deepak R", status: "at_dock", latitude: 12.990, longitude: 77.595, speed_kmh: 0, current_zone: "dock_area", assigned_dock: "DOCK-B2", entered_yard_at: "2026-04-13T05:00:00Z" },
  { vehicle_id: "TRL-3001", vehicle_type: "trailer", driver_name: "Vijay N", status: "in_transit", latitude: 12.940, longitude: 77.550, speed_kmh: 45, current_zone: null, assigned_dock: null, entered_yard_at: null },
  { vehicle_id: "TRK-1005", vehicle_type: "truck", driver_name: "Kumar L", status: "in_yard", latitude: 12.975, longitude: 77.580, speed_kmh: 0, current_zone: "staging_area", assigned_dock: null, entered_yard_at: "2026-04-13T07:30:00Z" },
  { vehicle_id: "TRK-1006", vehicle_type: "refrigerated", driver_name: "Meera D", status: "at_dock", latitude: 12.988, longitude: 77.600, speed_kmh: 0, current_zone: "dock_area", assigned_dock: "DOCK-C1", entered_yard_at: "2026-04-13T03:45:00Z" },
];

const MOCK_DOCKS: DockSlot[] = [
  { dock_id: "DOCK-A1", dock_name: "Bay A1", zone: "dock_area", status: "occupied", assigned_vehicle_id: "TRK-1001", dock_type: "standard", x: 40, y: 30, w: 90, h: 50 },
  { dock_id: "DOCK-A2", dock_name: "Bay A2", zone: "dock_area", status: "free", assigned_vehicle_id: null, dock_type: "standard", x: 150, y: 30, w: 90, h: 50 },
  { dock_id: "DOCK-B1", dock_name: "Bay B1", zone: "dock_area", status: "free", assigned_vehicle_id: null, dock_type: "standard", x: 260, y: 30, w: 90, h: 50 },
  { dock_id: "DOCK-B2", dock_name: "Bay B2", zone: "dock_area", status: "occupied", assigned_vehicle_id: "TRK-1004", dock_type: "standard", x: 370, y: 30, w: 90, h: 50 },
  { dock_id: "DOCK-C1", dock_name: "Cold Bay 1", zone: "cold_storage", status: "occupied", assigned_vehicle_id: "TRK-1006", dock_type: "refrigerated", x: 480, y: 30, w: 90, h: 50 },
  { dock_id: "DOCK-C2", dock_name: "Cold Bay 2", zone: "cold_storage", status: "reserved", assigned_vehicle_id: null, dock_type: "refrigerated", x: 40, y: 100, w: 90, h: 50 },
  { dock_id: "DOCK-D1", dock_name: "Hazmat Bay", zone: "dock_area", status: "maintenance", assigned_vehicle_id: null, dock_type: "hazmat", x: 150, y: 100, w: 90, h: 50 },
  { dock_id: "DOCK-D2", dock_name: "Bay D2", zone: "dock_area", status: "free", assigned_vehicle_id: null, dock_type: "standard", x: 260, y: 100, w: 90, h: 50 },
];

const MOCK_RECOMMENDATIONS: QueueRecommendation[] = [
  { vehicle_id: "VAN-2001", vehicle_type: "van", wait_minutes: 345, recommended_dock: "DOCK-A2", dock_type: "standard", priority_score: 100, reason: "Longest wait (345min)" },
  { vehicle_id: "TRK-1002", vehicle_type: "truck", wait_minutes: 190, recommended_dock: "DOCK-B1", dock_type: "standard", priority_score: 95, reason: "Longest wait (190min)" },
  { vehicle_id: "TRK-1005", vehicle_type: "truck", wait_minutes: 95, recommended_dock: "DOCK-D2", dock_type: "standard", priority_score: 47.5, reason: "Longest wait (95min)" },
  { vehicle_id: "TRK-1003", vehicle_type: "refrigerated", wait_minutes: 40, recommended_dock: "DOCK-C2", dock_type: "refrigerated", priority_score: 20, reason: "Longest wait (40min) + type-matched dock" },
];

const MOCK_HEATMAP: DwellHeatmapEntry[] = [
  { zone: "dock_area", avg_dwell_minutes: 142, total_vehicles: 3, over_threshold_count: 2 },
  { zone: "staging_area", avg_dwell_minutes: 98, total_vehicles: 2, over_threshold_count: 1 },
  { zone: "parking_yard", avg_dwell_minutes: 345, total_vehicles: 1, over_threshold_count: 1 },
  { zone: "cold_storage", avg_dwell_minutes: 210, total_vehicles: 1, over_threshold_count: 1 },
  { zone: "inbound_gate", avg_dwell_minutes: 25, total_vehicles: 1, over_threshold_count: 0 },
  { zone: "outbound_gate", avg_dwell_minutes: 8, total_vehicles: 0, over_threshold_count: 0 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COL: Record<string, string> = {
  at_dock: "bg-blue-500",
  in_yard: "bg-amber-500",
  at_gate: "bg-purple-500",
  in_transit: "bg-emerald-500",
  idle: "bg-gray-400",
  departed: "bg-gray-600",
};

const DOCK_COL: Record<string, { bg: string; border: string; label: string }> = {
  free:        { bg: "#22c55e20", border: "#22c55e", label: "Free" },
  occupied:    { bg: "#3b82f620", border: "#3b82f6", label: "Occupied" },
  reserved:    { bg: "#f59e0b20", border: "#f59e0b", label: "Reserved" },
  maintenance: { bg: "#ef444420", border: "#ef4444", label: "Maintenance" },
};

function dwellMinutes(enteredAt: string | null): number {
  if (!enteredAt) return 0;
  return Math.round((Date.now() - new Date(enteredAt).getTime()) / 60000);
}

function formatDwell(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

function heatmapColor(avg: number): string {
  if (avg >= 180) return "#ef4444";
  if (avg >= 120) return "#f59e0b";
  if (avg >= 60) return "#3b82f6";
  return "#22c55e";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const TABS = ["Yard Map", "Vehicle List", "Queue Optimizer", "Dwell Heatmap"] as const;
type Tab = (typeof TABS)[number];

function KPICard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] p-4 flex items-center gap-3">
      <div className={`rounded-lg p-2 ${accent}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG Yard Map (F-065)
// ---------------------------------------------------------------------------

function YardMapSVG({ docks, vehicles, selectedVehicle, onSelectVehicle }: {
  docks: DockSlot[];
  vehicles: Vehicle[];
  selectedVehicle: string | null;
  onSelectVehicle: (id: string | null) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [hoveredDock, setHoveredDock] = useState<string | null>(null);

  const ZONES = [
    { id: "inbound_gate", label: "Inbound Gate", x: 10, y: 180, w: 120, h: 60, color: "#7c3aed20" },
    { id: "staging_area", label: "Staging Area", x: 140, y: 180, w: 180, h: 60, color: "#f59e0b15" },
    { id: "dock_area", label: "Dock Area", x: 10, y: 10, w: 560, h: 160, color: "#3b82f610" },
    { id: "cold_storage", label: "Cold Storage", x: 330, y: 180, w: 120, h: 60, color: "#06b6d415" },
    { id: "parking_yard", label: "Parking Yard", x: 460, y: 180, w: 120, h: 60, color: "#84cc1615" },
    { id: "outbound_gate", label: "Outbound Gate", x: 460, y: 250, w: 120, h: 50, color: "#22c55e15" },
  ];

  // Map vehicles to SVG positions in their zones
  const vehiclePositions = vehicles
    .filter((v) => v.current_zone)
    .map((v) => {
      const zone = ZONES.find((z) => z.id === v.current_zone);
      if (!zone) return null;
      // Spread vehicles within the zone
      const idx = vehicles.filter((vv) => vv.current_zone === v.current_zone).indexOf(v);
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      return {
        ...v,
        svgX: zone.x + 20 + col * 30,
        svgY: zone.y + 20 + row * 20,
        dwell: dwellMinutes(v.entered_yard_at),
      };
    })
    .filter(Boolean) as (Vehicle & { svgX: number; svgY: number; dwell: number })[];

  return (
    <div className="relative">
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        <button onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))} className="w-7 h-7 rounded bg-[#1E2F50] text-white text-sm font-bold hover:bg-[#2A3D66]">+</button>
        <button onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))} className="w-7 h-7 rounded bg-[#1E2F50] text-white text-sm font-bold hover:bg-[#2A3D66]">-</button>
      </div>

      <svg
        viewBox="0 0 600 310"
        width={600 * zoom}
        height={310 * zoom}
        className="rounded-lg border border-[#1E2F50] bg-[#0D1526]"
        style={{ transition: "width 0.2s, height 0.2s" }}
      >
        {/* Grid */}
        <defs>
          <pattern id="yardGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1E2F50" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="600" height="310" fill="url(#yardGrid)" />

        {/* Zones */}
        {ZONES.map((z) => (
          <g key={z.id}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={6} fill={z.color} stroke="#1E2F50" strokeWidth={1} />
            <text x={z.x + 6} y={z.y + 14} fontSize={9} fontWeight={600} fill="#94a3b8">{z.label}</text>
          </g>
        ))}

        {/* Dock bays */}
        {docks.map((d) => {
          const col = DOCK_COL[d.status] || DOCK_COL.free;
          const isHovered = hoveredDock === d.dock_id;
          return (
            <g
              key={d.dock_id}
              onMouseEnter={() => setHoveredDock(d.dock_id)}
              onMouseLeave={() => setHoveredDock(null)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={d.x} y={d.y} width={d.w} height={d.h}
                rx={5} fill={col.bg} stroke={col.border}
                strokeWidth={isHovered ? 2 : 1}
                style={{ transition: "stroke-width 0.15s" }}
              />
              <text x={d.x + d.w / 2} y={d.y + 18} textAnchor="middle" fontSize={10} fontWeight={700} fill={col.border}>
                {d.dock_id}
              </text>
              <text x={d.x + d.w / 2} y={d.y + 30} textAnchor="middle" fontSize={8} fill="#94a3b8">
                {d.dock_type === "refrigerated" ? "Cold" : d.dock_type === "hazmat" ? "Hazmat" : "Std"}
              </text>
              <text x={d.x + d.w / 2} y={d.y + 42} textAnchor="middle" fontSize={8} fill="#cbd5e1">
                {d.assigned_vehicle_id || col.label}
              </text>
            </g>
          );
        })}

        {/* Vehicle markers */}
        {vehiclePositions.map((v) => {
          const isSelected = selectedVehicle === v.vehicle_id;
          const isDwellCritical = v.dwell >= 120;
          const isDwellWarning = v.dwell >= 60;
          const markerColor = isDwellCritical ? "#ef4444" : isDwellWarning ? "#f59e0b" : "#22c55e";
          return (
            <g
              key={v.vehicle_id}
              onClick={() => onSelectVehicle(isSelected ? null : v.vehicle_id)}
              style={{ cursor: "pointer" }}
            >
              {isSelected && (
                <circle cx={v.svgX} cy={v.svgY} r={12} fill="none" stroke="#E5521A" strokeWidth={2} style={{ animation: "pulse 1.5s infinite" }} />
              )}
              <circle cx={v.svgX} cy={v.svgY} r={7} fill={markerColor} stroke="#0D1526" strokeWidth={1.5} />
              <text x={v.svgX} y={v.svgY + 3} textAnchor="middle" fontSize={6} fontWeight={700} fill="white">
                {v.vehicle_type === "refrigerated" ? "R" : v.vehicle_type === "van" ? "V" : "T"}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-400">
        {Object.entries(DOCK_COL).map(([status, { border, label }]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: border }} />
            {label}
          </span>
        ))}
        <span className="ml-4 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Dwell &lt;1h</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Dwell 1-2h</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Dwell &gt;2h</span>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function FleetYardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Yard Map");
  const [vehicles, setVehicles] = useState<Vehicle[]>(MOCK_VEHICLES);
  const [docks, setDocks] = useState<DockSlot[]>(MOCK_DOCKS);
  const [recommendations, setRecommendations] = useState<QueueRecommendation[]>(MOCK_RECOMMENDATIONS);
  const [heatmap, setHeatmap] = useState<DwellHeatmapEntry[]>(MOCK_HEATMAP);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // --- Fetch vehicles from backend (F-064) ---
  const fetchVehicles = useCallback(async () => {
    try {
      const { getVehicles } = await import("@/services/depotOps");
      const data = await getVehicles();
      if (data.length > 0) { setVehicles(data as Vehicle[]); return; }
    } catch { /* fallback to mock */ }
  }, []);

  // --- Fetch docks from backend (F-065) ---
  const fetchDocks = useCallback(async () => {
    try {
      const { getDocks } = await import("@/services/depotOps");
      const data = await getDocks();
      if (data.length > 0) {
        setDocks(data.map((d, i) => ({
          dock_id: d.dock_id,
          dock_name: d.dock_name,
          zone: d.zone,
          status: d.status,
          assigned_vehicle_id: d.assigned_vehicle_id,
          dock_type: d.dock_type,
          x: 40 + (i % 2) * 110,
          y: 30 + Math.floor(i / 2) * 70,
          w: 90,
          h: 50,
        })));
        return;
      }
    } catch { /* fallback to mock */ }
  }, []);

  // --- Fetch queue recommendations from backend (F-068) ---
  const fetchRecommendations = useCallback(async () => {
    try {
      const { getQueueOptimization } = await import("@/services/depotOps");
      const result = await getQueueOptimization();
      if (result.recommendations.length > 0) {
        setRecommendations(result.recommendations);
        return;
      }
    } catch { /* fallback to mock */ }
  }, []);

  // --- Fetch dwell heatmap from backend (F-066) ---
  const fetchHeatmap = useCallback(async () => {
    try {
      const { getDwellHeatmap } = await import("@/services/depotOps");
      const data = await getDwellHeatmap();
      if (data.length > 0) { setHeatmap(data); return; }
    } catch { /* fallback to mock */ }
  }, []);

  // Fetch all data on mount + refresh every 10s
  const fetchAll = useCallback(async () => {
    await Promise.allSettled([fetchVehicles(), fetchDocks(), fetchRecommendations(), fetchHeatmap()]);
  }, [fetchVehicles, fetchDocks, fetchRecommendations, fetchHeatmap]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Enrich vehicles with computed dwell
  const enriched = vehicles.map((v) => ({
    ...v,
    dwell_minutes: dwellMinutes(v.entered_yard_at),
  }));

  // KPIs
  const inYard = enriched.filter((v) => ["in_yard", "at_dock", "at_gate"].includes(v.status)).length;
  const atDock = enriched.filter((v) => v.status === "at_dock").length;
  const freeDocks = docks.filter((d) => d.status === "free").length;
  const dwellAlerts = enriched.filter((v) => (v.dwell_minutes ?? 0) >= 120).length;

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll().then(() => setRefreshing(false));
  }, [fetchAll]);

  const selected = selectedVehicle ? enriched.find((v) => v.vehicle_id === selectedVehicle) : null;

  return (
    <div className="min-h-screen bg-[#0D1526] text-white px-6 py-5 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fleet & Yard View</h1>
          <p className="text-sm text-gray-400 mt-0.5">F-064 to F-068 — GPS tracking, yard map, dwell analytics, dock scheduling, queue optimization</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 rounded-lg border border-[#1E2F50] bg-[#14203A] px-3 py-2 text-sm hover:bg-[#1E2F50] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard icon={Truck} label="Vehicles in Yard" value={inYard} accent="bg-blue-500/20 text-blue-400" />
        <KPICard icon={Anchor} label="At Dock" value={atDock} accent="bg-emerald-500/20 text-emerald-400" />
        <KPICard icon={Package} label="Free Docks" value={`${freeDocks}/${docks.length}`} accent="bg-amber-500/20 text-amber-400" />
        <KPICard icon={AlertTriangle} label="Dwell Alerts (>2h)" value={dwellAlerts} accent="bg-red-500/20 text-red-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[#1E2F50] bg-[#14203A] p-1 w-fit mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-[#E5521A] text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "Yard Map" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Yard Map — Live Vehicle Overlays (F-065)</h3>
              <YardMapSVG
                docks={docks}
                vehicles={enriched}
                selectedVehicle={selectedVehicle}
                onSelectVehicle={setSelectedVehicle}
              />
            </div>
          </div>

          {/* Selected vehicle detail or dock summary */}
          <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] p-5">
            {selected ? (
              <>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Vehicle Detail</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">ID</span><span className="font-mono">{selected.vehicle_id}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Type</span><span className="capitalize">{selected.vehicle_type}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Driver</span><span>{selected.driver_name || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Status</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_COL[selected.status] || "bg-gray-500"} text-white`}>{selected.status.replace("_", " ")}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-gray-400">Zone</span><span className="capitalize">{selected.current_zone?.replace("_", " ") || "In transit"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Dock</span><span>{selected.assigned_dock || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Dwell</span>
                    <span className={`font-bold ${(selected.dwell_minutes ?? 0) >= 120 ? "text-red-400" : (selected.dwell_minutes ?? 0) >= 60 ? "text-amber-400" : "text-emerald-400"}`}>
                      {formatDwell(selected.dwell_minutes ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between"><span className="text-gray-400">Speed</span><span>{selected.speed_kmh} km/h</span></div>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Dock Status Summary</h3>
                <div className="space-y-2">
                  {docks.map((d) => {
                    const col = DOCK_COL[d.status] || DOCK_COL.free;
                    return (
                      <div key={d.dock_id} className="flex items-center justify-between py-1.5 border-b border-[#1E2F50] last:border-0">
                        <div>
                          <span className="font-mono text-sm">{d.dock_id}</span>
                          <span className="text-xs text-gray-500 ml-2">{d.dock_type}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ background: col.bg, color: col.border, border: `1px solid ${col.border}` }}>
                          {col.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "Vehicle List" && (
        <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E2F50] text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Vehicle</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Driver</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Zone</th>
                <th className="px-4 py-3 text-left">Dock</th>
                <th className="px-4 py-3 text-left">Dwell</th>
                <th className="px-4 py-3 text-left">Speed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2F50]">
              {enriched.map((v) => (
                <tr
                  key={v.vehicle_id}
                  className="hover:bg-[#1E2F50]/40 cursor-pointer transition-colors"
                  onClick={() => { setSelectedVehicle(v.vehicle_id); setActiveTab("Yard Map"); }}
                >
                  <td className="px-4 py-3 font-mono font-medium">{v.vehicle_id}</td>
                  <td className="px-4 py-3 capitalize">{v.vehicle_type}</td>
                  <td className="px-4 py-3">{v.driver_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_COL[v.status] || "bg-gray-500"} text-white`}>
                      {v.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize">{v.current_zone?.replace("_", " ") || "—"}</td>
                  <td className="px-4 py-3 font-mono">{v.assigned_dock || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${(v.dwell_minutes ?? 0) >= 120 ? "text-red-400" : (v.dwell_minutes ?? 0) >= 60 ? "text-amber-400" : "text-emerald-400"}`}>
                      {formatDwell(v.dwell_minutes ?? 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{v.speed_kmh} km/h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "Queue Optimizer" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-300">Queue Optimization Recommendations (F-068)</h3>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Zap className="w-3.5 h-3.5 text-[#E5521A]" />
                Dwell Time Optimization Agent
              </div>
            </div>
            <div className="space-y-3">
              {recommendations.map((r) => (
                <div
                  key={r.vehicle_id}
                  className="flex items-center justify-between rounded-lg border border-[#1E2F50] bg-[#0D1526] p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-bold text-[#E5521A]">{r.priority_score.toFixed(0)}</span>
                      <span className="text-[9px] text-gray-500 uppercase">Score</span>
                    </div>
                    <div>
                      <p className="font-mono font-medium">{r.vehicle_id} <span className="text-xs text-gray-500 capitalize">({r.vehicle_type})</span></p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-amber-400">{formatDwell(r.wait_minutes)}</p>
                      <p className="text-[10px] text-gray-500">waiting</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-gray-500" />
                    <div className="text-right">
                      <p className="text-sm font-mono font-medium text-blue-400">{r.recommended_dock}</p>
                      <p className="text-[10px] text-gray-500">{r.dock_type}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "Dwell Heatmap" && (
        <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Dwell Time Heatmap by Zone (F-066)</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {heatmap.map((h) => (
              <div key={h.zone} className="rounded-lg border border-[#1E2F50] bg-[#0D1526] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium capitalize">{h.zone.replace("_", " ")}</span>
                  <span className="w-3 h-3 rounded-full" style={{ background: heatmapColor(h.avg_dwell_minutes) }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: heatmapColor(h.avg_dwell_minutes) }}>
                  {formatDwell(Math.round(h.avg_dwell_minutes))}
                </p>
                <p className="text-xs text-gray-500 mt-1">avg dwell time</p>
                <div className="flex justify-between mt-3 pt-2 border-t border-[#1E2F50] text-xs text-gray-400">
                  <span>{h.total_vehicles} vehicles</span>
                  <span className={h.over_threshold_count > 0 ? "text-red-400 font-medium" : ""}>
                    {h.over_threshold_count} over threshold
                  </span>
                </div>
                {/* Mini bar */}
                <div className="mt-2 h-1.5 rounded-full bg-[#1E2F50] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (h.avg_dwell_minutes / 300) * 100)}%`,
                      background: heatmapColor(h.avg_dwell_minutes),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
