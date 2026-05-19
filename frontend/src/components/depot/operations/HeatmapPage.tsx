"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getZones,
  getHeatmap,
  getDensityAnalytics,
  getDensityHistory,
  getThresholds,
  getCapacityAlerts,
  getZoneHistory,
  seedDemoHistory,
  type DensityEntry,
  type DensityHistoryEntry,
  type CapacityAlertResponse,
  type ZoneHistoryEntry,
} from "@/services/depotCluster";
import {
  MapPin,
  Layers,
  AlertTriangle,
  ShieldCheck,
  SortAsc,
  Loader2,
} from "lucide-react";
import dynamic from "next/dynamic";

const Warehouse3DMap = dynamic(() => import("./Warehouse3DMap"), { ssr: false });

/* ------------------------------------------------------------------ */
/* Generate synthetic 30-day history for demo zones                   */
/* ------------------------------------------------------------------ */
function generateDemoHistory(zones: MergedZone[]): DensityHistoryEntry[] {
  const entries: DensityHistoryEntry[] = [];
  const now = new Date();
  const baseUtil: Record<string, number> = { A: 81, B: 45, C: 74, D: 91 };

  zones.forEach((z) => {
    const base = (baseUtil[z.code] ?? 60) / 100;
    for (let day = 30; day >= 0; day--) {
      const dow = new Date(now.getTime() - day * 86400000).getDay();
      const weeklyFactor = 1 + 0.08 * (2 - Math.abs(dow - 3)) / 2;
      const noise = (Math.random() - 0.5) * 0.12;
      const util = Math.min(100, Math.max(5, (base * weeklyFactor + noise) * 100));
      const occ = Math.round((util / 100) * z.maxCapacity);
      entries.push({
        id: `demo-${z.code}-${day}`,
        zone_id: z.id,
        zone_code: z.code,
        occupancy: occ,
        capacity: z.maxCapacity,
        utilization_pct: Math.round(util * 10) / 10,
        status: util >= 95 ? "critical" : util >= 80 ? "warning" : "normal",
        recorded_at: new Date(now.getTime() - day * 86400000).toISOString(),
      });
    }
  });
  return entries;
}
const DEMO_ZONES: MergedZone[] = [
  { id: "demo-a", code: "A", name: "Storage Bay A — Cement",      type: "storage", floor: "ground", areaSqm: 2400, maxCapacity: 1000, currentOccupancy: 810, utilizationPct: 81, status: "warning",  polygon: [], densityPerSqm: 0.34 },
  { id: "demo-b", code: "B", name: "Storage Bay B — Fertilizers", type: "storage", floor: "ground", areaSqm: 2800, maxCapacity: 1000, currentOccupancy: 450, utilizationPct: 45, status: "normal",   polygon: [], densityPerSqm: 0.16 },
  { id: "demo-c", code: "C", name: "Hazmat Storage C",            type: "hazmat",  floor: "ground", areaSqm: 1600, maxCapacity: 800,  currentOccupancy: 595, utilizationPct: 74, status: "normal",   polygon: [], densityPerSqm: 0.37 },
  { id: "demo-d", code: "D", name: "Heavy Materials D",           type: "storage", floor: "ground", areaSqm: 3200, maxCapacity: 1200, currentOccupancy: 1092, utilizationPct: 91, status: "critical", polygon: [], densityPerSqm: 0.34 },
];

/* ------------------------------------------------------------------ */
/* Helper functions                                                    */
/* ------------------------------------------------------------------ */

function statusColor(status: string): string {
  if (status === "critical") return "#F04A4A";
  if (status === "warning") return "#F5A623";
  return "#22D3A1";
}

/* ------------------------------------------------------------------ */
/* Merged zone type used internally to drive the UI                    */
/* ------------------------------------------------------------------ */

interface MergedZone {
  id: string;
  code: string;
  name: string;
  type: string;
  floor: string;
  areaSqm: number;
  maxCapacity: number;
  currentOccupancy: number;
  utilizationPct: number;
  status: string;
  polygon: number[][];
  densityPerSqm: number;
}

const STATUS_LABEL: Record<string, string> = { normal: "NORMAL", warning: "WARNING", critical: "CRITICAL" };

export default function HeatmapPage() {
  const [zones, setZones] = useState<MergedZone[]>([]);
  const [alerts, setAlerts] = useState<CapacityAlertResponse[]>([]);
  const [thresholds, setThresholds] = useState<{ warning: number; critical: number }>({ warning: 80, critical: 95 });
  const [loading, setLoading] = useState(true);
  const [flashedZones, setFlashedZones] = useState<Set<string>>(new Set());

  const [selectedZone, setSelectedZone] = useState<MergedZone | null>(null);
  const [zoneHistory, setZoneHistory] = useState<ZoneHistoryEntry[]>([]);
  const [sortMode, setSortMode] = useState<"util" | "name" | "status">("util");
  const [historyRange, setHistoryRange] = useState(0);
  const [historyData, setHistoryData] = useState<DensityHistoryEntry[]>([]);
  const [allHistory, setAllHistory] = useState<DensityHistoryEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  /* ---- data fetcher ---- */
  const fetchData = useCallback(async () => {
    try {
      const [zonesRes, _heatmap, densityRes, thresholdRes, alertsRes] = await Promise.all([
        getZones(),
        getHeatmap(),
        getDensityAnalytics(),
        getThresholds(),
        getCapacityAlerts(false),
      ]);

      // Build a density lookup by zone_code
      const densityMap = new Map<string, DensityEntry>();
      densityRes.forEach((d) => densityMap.set(d.zone_code, d));

      // Merge zones + density into our internal MergedZone[]
      const merged: MergedZone[] = zonesRes
        .filter((z) => z.is_active)
        .map((z) => {
          const den = densityMap.get(z.zone_code);
          return {
            id: z.id,
            code: z.zone_code,
            name: z.name,
            type: z.zone_type,
            floor: z.floor,
            areaSqm: z.area_sqm ?? 0,
            maxCapacity: z.max_capacity_units,
            currentOccupancy: z.current_occupancy,
            utilizationPct: z.utilization_pct,
            status: z.status,
            polygon: z.polygon_coords ?? [],
            densityPerSqm: den?.objects_per_sqm ?? 0,
          };
        });

      setZones(merged.length > 0 ? merged : DEMO_ZONES);
      setAlerts(alertsRes);

      // Use first global threshold found, else default 80/95
      if (thresholdRes.length > 0) {
        const global = thresholdRes.find((t) => t.is_global) ?? thresholdRes[0];
        setThresholds({ warning: global.warning_pct, critical: global.critical_pct });
      }

      // If we had a selected zone, refresh its data
      setSelectedZone((prev) => {
        if (!prev) return null;
        return merged.find((z) => z.id === prev.id) ?? null;
      });
    } catch (err) {
      console.error("HeatmapPage: failed to fetch data", err);
      setZones(DEMO_ZONES);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- initial load + 30s refresh ---- */
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  /* ---- seed + load full 30-day history once zones are known ---- */
  useEffect(() => {
    if (zones.length === 0) return;
    const isDemoData = zones[0].id.startsWith("demo-");

    if (isDemoData) {
      // Generate synthetic history for demo zones
      setAllHistory(generateDemoHistory(zones));
    } else {
      // Try to seed backend history, then fetch it
      seedDemoHistory()
        .catch(() => {}) // ignore if already seeded or fails
        .finally(() => {
          getDensityHistory(undefined, 1000, 30)
            .then(setAllHistory)
            .catch(() => setAllHistory(generateDemoHistory(zones)));
        });
    }
  }, [zones]);

  /* ---- WebSocket: subscribe to depot.alerts for live zone flash ---- */
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || token.startsWith("demo-")) return;

    const wsUrl = `ws://localhost:8000/api/v1/realtime/ws/depot.alerts?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event_type === "capacity_alert" && msg.payload?.zone_code) {
          const code = msg.payload.zone_code;
          // Flash the zone block
          setFlashedZones((prev) => new Set(prev).add(code));
          setTimeout(() => setFlashedZones((prev) => { const n = new Set(prev); n.delete(code); return n; }), 800);
          // Refresh data
          fetchData();
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => ws.close();

    return () => { ws.close(); wsRef.current = null; };
  }, [fetchData]);

  /* ---- fetch zone history when a zone is selected ---- */
  useEffect(() => {
    if (!selectedZone || selectedZone.id.startsWith("demo-")) {
      setZoneHistory([]);
      return;
    }
    getZoneHistory(selectedZone.id, 24).then(setZoneHistory).catch(() => setZoneHistory([]));
  }, [selectedZone]);

  /* ---- apply history filter when slider moves ---- */
  useEffect(() => {
    if (historyRange === 0 || allHistory.length === 0) {
      setHistoryData([]);
      return;
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - historyRange);
    // Get the snapshot closest to `historyRange` days ago for each zone
    const filtered = allHistory.filter((d) => {
      const recordedAt = new Date(d.recorded_at);
      const daysAgo = (Date.now() - recordedAt.getTime()) / 86400000;
      return Math.abs(daysAgo - historyRange) < 1; // within 1 day of target
    });
    setHistoryData(filtered.length > 0 ? filtered : allHistory.filter((d) => new Date(d.recorded_at) >= cutoff));
  }, [historyRange, allHistory]);

  /* ---- apply historical overlay when slider > 0 ---- */
  const displayZones: MergedZone[] = historyRange > 0 && historyData.length > 0
    ? zones.map((z) => {
        const entries = historyData.filter((h) => h.zone_id === z.id || h.zone_code === z.code);
        if (entries.length === 0) return z;
        const avgOcc = Math.round(entries.reduce((a, e) => a + e.occupancy, 0) / entries.length);
        const util = z.maxCapacity > 0 ? Math.round((avgOcc / z.maxCapacity) * 100) : 0;
        const status = util >= 95 ? "critical" : util >= 80 ? "warning" : "normal";
        return { ...z, currentOccupancy: avgOcc, utilizationPct: util, status };
      })
    : zones;

  /* ---- derived KPIs ---- */
  const totalCap = displayZones.reduce((a, z) => a + z.maxCapacity, 0);
  const totalOcc = displayZones.reduce((a, z) => a + z.currentOccupancy, 0);
  const overallUtil = totalCap > 0 ? ((totalOcc / totalCap) * 100).toFixed(1) : "0";
  const criticalZones = displayZones.filter((z) => z.status === "critical").length;
  const warningZones = displayZones.filter((z) => z.status === "warning").length;

  const sortedZones = [...displayZones].sort((a, b) => {
    if (sortMode === "util") return b.utilizationPct - a.utilizationPct;
    if (sortMode === "name") return a.name.localeCompare(b.name);
    const order = { critical: 0, warning: 1, normal: 2 };
    return (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
  });

  /* ---- loading state ---- */
  if (loading) {
    return (
      <div className="p-5 flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#E5521A] animate-spin mb-3" />
        <span className="text-[13px] text-[#8A9BBF]">Loading heatmap data...</span>
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[11px] text-[#E5521A] font-bold tracking-[0.1em] uppercase mb-1">
            Cluster Mapping
          </div>
          <h2 className="text-xl font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
            Warehouse Heatmap
          </h2>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            Zone capacity &nbsp;·&nbsp; Real-time occupancy &nbsp;·&nbsp; Capacity alerts
          </p>
        </div>
      </div>

      {/* KPI Row — above the slider */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Overall Utilization", value: `${overallUtil}%`, color: parseFloat(overallUtil) >= 80 ? "#F5A623" : "#22D3A1", icon: Layers, pulse: false },
          { label: "Total Capacity", value: `${totalOcc.toLocaleString()} / ${totalCap.toLocaleString()}`, color: "#5B9BF5", icon: MapPin, pulse: false },
          { label: "Critical Zones", value: criticalZones.toString(), color: criticalZones > 0 ? "#F04A4A" : "#22D3A1", icon: AlertTriangle, pulse: criticalZones > 0 },
          { label: "Warning Zones", value: warningZones.toString(), color: warningZones > 0 ? "#F5A623" : "#22D3A1", icon: AlertTriangle, pulse: false },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 relative overflow-hidden" style={{ borderLeft: `3px solid ${kpi.color}` }}>
            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full opacity-[0.06]" style={{ background: kpi.color }} />
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              {kpi.pulse && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: kpi.color }} />}
            </div>
            <div className="text-[9px] font-bold tracking-[0.08em] text-[#4E6090] uppercase mb-1">{kpi.label}</div>
            <div className="text-[22px] font-extrabold leading-none" style={{ color: kpi.color, fontFamily: "'Syne', sans-serif" }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Historical Time-Range Slider — constrained to heatmap column width (2/3) */}
      <div className="mb-5 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
              {historyRange === 0 ? "🔴 Live" : `${historyRange} day${historyRange > 1 ? "s" : ""} ago`}
            </span>
            <span className="text-[9px] text-[#4E6090]">Scrub to replay historical occupancy</span>
          </div>
          <input
            type="range"
            min={0}
            max={30}
            value={historyRange}
            onChange={(e) => setHistoryRange(Number(e.target.value))}
            className="w-full h-1.5 accent-[#E5521A] cursor-pointer"
          />
          <div className="flex justify-between mt-1.5">
            {["Live", "7d", "14d", "21d", "30d"].map((label, i) => {
              const val = [0, 7, 14, 21, 30][i];
              return (
                <button
                  key={label}
                  onClick={() => setHistoryRange(val)}
                  className="text-[9px] font-bold transition-colors"
                  style={{ color: historyRange === val ? "#E5521A" : "#4E6090" }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {/* Empty right column spacer to align slider with heatmap */}
        <div className="hidden lg:block" />
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#E5521A]/40 to-transparent mb-5" />

      {/* Map + Zone Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-5">
        {/* 3D Warehouse Map */}
        <div className="bg-[#14203A] rounded-[14px] p-[18px]" style={{ border: "1px solid rgba(91,155,245,0.25)", boxShadow: "0 0 0 1px rgba(91,155,245,0.08), inset 0 0 40px rgba(10,14,26,0.4)" }}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#E5521A]" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                Warehouse Floor Plan
              </span>
            </div>
          </div>

          <Warehouse3DMap
            zones={displayZones}
            selectedZone={selectedZone?.code ?? null}
            flashedZones={flashedZones}
            onZoneClick={(code) => {
              const match = displayZones.find((z) => z.code === code);
              setSelectedZone(match && selectedZone?.id === match.id ? null : match ?? null);
            }}
          />

          {/* Threshold bar */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-[9px] text-[#4E6090] font-bold uppercase tracking-wide">Threshold:</span>
            <div className="flex-1 h-2 bg-[#0F1A30] rounded-full overflow-hidden relative">
              <div className="absolute left-0 top-0 bottom-0 bg-[#22D3A1] rounded-l-full" style={{ width: `${thresholds.warning}%` }} />
              <div className="absolute top-0 bottom-0 bg-[#F5A623]" style={{ left: `${thresholds.warning}%`, width: `${thresholds.critical - thresholds.warning}%` }} />
              <div className="absolute top-0 bottom-0 bg-[#F04A4A] rounded-r-full" style={{ left: `${thresholds.critical}%`, width: `${100 - thresholds.critical}%` }} />
            </div>
            <div className="flex gap-2 text-[9px]">
              <span className="text-[#22D3A1]">0-{thresholds.warning}%</span>
              <span className="text-[#F5A623]">{thresholds.warning}-{thresholds.critical}%</span>
              <span className="text-[#F04A4A]">{thresholds.critical}%+</span>
            </div>
          </div>
        </div>

        {/* Zone Detail + Capacity Alerts */}
        <div className="space-y-4">
          {/* Selected zone detail */}
          {selectedZone ? (
            <div
              className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]"
              style={{ animation: "slideInRight 150ms ease-out" }}
            >
              <style>{`@keyframes slideInRight { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }`}</style>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                    {selectedZone.name}
                  </div>
                  <div className="text-[10px] text-[#8A9BBF] mt-0.5">
                    {selectedZone.type.toUpperCase()} · {selectedZone.floor} · {selectedZone.areaSqm} m²
                  </div>
                </div>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                  style={{
                    background: `${statusColor(selectedZone.status)}15`,
                    color: statusColor(selectedZone.status),
                    borderColor: `${statusColor(selectedZone.status)}30`,
                  }}
                >
                  {STATUS_LABEL[selectedZone.status] ?? selectedZone.status.toUpperCase()}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-[#8A9BBF]">Utilization</span>
                  <span className="font-bold" style={{ color: statusColor(selectedZone.status) }}>
                    {selectedZone.utilizationPct}%
                  </span>
                </div>
                <div className="w-full h-2 bg-[#0F1A30] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${selectedZone.utilizationPct}%`, background: statusColor(selectedZone.status) }}
                  />
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { l: "Capacity", v: `${selectedZone.currentOccupancy} / ${selectedZone.maxCapacity}` },
                  { l: "Density", v: `${selectedZone.densityPerSqm.toFixed(2)} /m²` },
                  { l: "Area", v: `${selectedZone.areaSqm} m²` },
                  { l: "Type", v: selectedZone.type },
                ].map((s) => (
                  <div key={s.l} className="bg-[#0F1A30] rounded-lg p-2.5">
                    <div className="text-[8px] text-[#4E6090] font-bold uppercase tracking-wide">{s.l}</div>
                    <div className="text-[12px] font-bold text-[#E8EDF8] mt-0.5">{s.v}</div>
                  </div>
                ))}
              </div>

              {/* Mini bar chart — zone history */}
              {zoneHistory.length > 0 && (
                <div>
                  <div className="text-[9px] text-[#4E6090] font-bold uppercase tracking-wide mb-1.5">Occupancy Trend</div>
                  <div className="flex items-end gap-0.5 h-10">
                    {zoneHistory.slice(-20).map((h, i) => {
                      const pct = h.max_capacity > 0 ? (h.occupancy / h.max_capacity) * 100 : 0;
                      const barColor = pct >= 95 ? "#F04A4A" : pct >= 80 ? "#F5A623" : "#22D3A1";
                      return (
                        <div
                          key={i}
                          className="flex-1 rounded-sm transition-all"
                          style={{ height: `${Math.max(4, pct)}%`, background: barColor, opacity: 0.8 }}
                          title={`${Math.round(pct)}%`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Animated idle state */
            <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px] flex flex-col items-center justify-center h-[200px] relative overflow-hidden">
              <style>{`
                @keyframes radarSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes radarPulse { 0%,100% { opacity:0.15; transform:scale(1); } 50% { opacity:0.35; transform:scale(1.15); } }
              `}</style>
              {/* Radar rings */}
              {[1, 1.6, 2.2].map((scale, i) => (
                <div key={i} className="absolute rounded-full border border-[#E5521A]"
                  style={{ width: 40 * scale, height: 40 * scale, opacity: 0.12 - i * 0.03, animation: `radarPulse ${1.5 + i * 0.4}s ease-in-out infinite`, animationDelay: `${i * 0.3}s` }}
                />
              ))}
              {/* Spinning sweep */}
              <div className="absolute w-10 h-10 rounded-full" style={{ animation: "radarSpin 3s linear infinite" }}>
                <div className="absolute top-1/2 left-1/2 w-5 h-0.5 origin-left rounded-full" style={{ background: "linear-gradient(90deg, #E5521A, transparent)" }} />
              </div>
              <div className="w-2 h-2 rounded-full bg-[#E5521A] mb-3 relative z-10" style={{ boxShadow: "0 0 8px #E5521A" }} />
              <span className="text-[11px] text-[#4E6090] relative z-10">Click a zone to inspect</span>
            </div>
          )}

          {/* Capacity Alerts */}
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
            <div className="flex justify-between items-center mb-3.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#F5A623]" />
                <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                  Capacity Alerts
                </span>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F04A4A]/12 text-[#F04A4A] border border-[#F04A4A]/25">
                {alerts.length} Active
              </span>
            </div>
            <div className="space-y-2">
              {alerts.map((alert) => {
                const sevColor = alert.severity === "critical" ? "#F04A4A" : "#F5A623";
                return (
                  <div
                    key={alert.id}
                    className="p-2.5 rounded-[10px] bg-[#0F1A30] hover:bg-[#E5521A]/5 transition-colors cursor-pointer"
                    style={{ borderLeft: `3px solid ${sevColor}` }}
                    onClick={() => {
                      const match = displayZones.find((z) => z.id === alert.zone_id);
                      if (match) setSelectedZone(match);
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold" style={{ color: sevColor }}>
                        {alert.zone_code ?? "Zone"}
                      </span>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                        style={{
                          background: `${sevColor}22`,
                          color: sevColor,
                          borderColor: `${sevColor}33`,
                        }}
                      >
                        {alert.current_pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-[#8A9BBF] mt-0.5">
                      {alert.message ?? `${alert.severity.toUpperCase()} — threshold ${alert.threshold_pct}%`}
                    </div>
                  </div>
                );
              })}
              {alerts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-5 gap-2">
                  <ShieldCheck className="w-8 h-8 text-[#22D3A1] opacity-60" />
                  <span className="text-[11px] text-[#4E6090] text-center">All zones within limits</span>
                </div>
              )}
            </div>
          </div>

          {/* Zone List */}
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#5B9BF5]" />
                <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                  All Zones
                </span>
              </div>
              <div className="flex items-center gap-1">
                <SortAsc className="w-3 h-3 text-[#4E6090]" />
                {(["util", "name", "status"] as const).map((m) => (
                  <button key={m} onClick={() => setSortMode(m)}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors"
                    style={{ background: sortMode === m ? "rgba(229,82,26,0.15)" : "transparent", color: sortMode === m ? "#E5521A" : "#4E6090" }}>
                    {m === "util" ? "%" : m === "name" ? "A-Z" : "Status"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              {sortedZones.map((z) => {
                const isNearFull = z.utilizationPct >= 80;
                return (
                  <div
                    key={z.id}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedZone?.id === z.id ? "bg-[#E5521A]/10" : "hover:bg-[#0F1A30]"
                    }`}
                    onClick={() => setSelectedZone(z)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: statusColor(z.status) }} />
                      <span className="text-[11px] font-bold text-[#E8EDF8]">{z.code}</span>
                      <span className="text-[10px] text-[#8A9BBF]">{z.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-[#0F1A30] rounded-full overflow-hidden relative">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${z.utilizationPct}%`,
                            background: statusColor(z.status),
                            animation: isNearFull ? "shimmer 1.5s ease-in-out infinite" : "none",
                          }}
                        />
                        <style>{`@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.6} }`}</style>
                      </div>
                      <span className="text-[10px] font-bold w-10 text-right" style={{ color: statusColor(z.status) }}>
                        {z.utilizationPct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
