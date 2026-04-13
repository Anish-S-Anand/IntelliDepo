"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getZones,
  getHeatmap,
  getDensityAnalytics,
  getDensityHistory,
  getThresholds,
  getCapacityAlerts,
  type ZoneResponse,
  type DensityEntry,
  type DensityHistoryEntry,
  type CapacityAlertResponse,
  type ThresholdResponse,
} from "@/services/depotCluster";
import {
  MapPin,
  Layers,
  AlertTriangle,
  Thermometer,
  Eye,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Helper functions                                                    */
/* ------------------------------------------------------------------ */

function statusColor(status: string): string {
  if (status === "critical") return "#F04A4A";
  if (status === "warning") return "#F5A623";
  return "#22D3A1";
}

function densityColor(density: number): string {
  if (density >= 0.35) return "#F04A4A";
  if (density >= 0.25) return "#F5A623";
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

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function HeatmapPage() {
  const [zones, setZones] = useState<MergedZone[]>([]);
  const [alerts, setAlerts] = useState<CapacityAlertResponse[]>([]);
  const [thresholds, setThresholds] = useState<{ warning: number; critical: number }>({ warning: 80, critical: 95 });
  const [loading, setLoading] = useState(true);

  const [selectedZone, setSelectedZone] = useState<MergedZone | null>(null);
  const [viewMode, setViewMode] = useState<"density" | "utilization">("utilization");
  const [historyRange, setHistoryRange] = useState(0); // 0 = live, 1-30 = days ago
  const [historyData, setHistoryData] = useState<DensityHistoryEntry[]>([]);

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

      setZones(merged);
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

  /* ---- fetch density history when slider moves away from live ---- */
  useEffect(() => {
    if (historyRange === 0) {
      setHistoryData([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getDensityHistory(undefined, 500);
        if (!cancelled) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - historyRange);
          const filtered = data.filter((d) => new Date(d.recorded_at) >= cutoff);
          setHistoryData(filtered);
        }
      } catch (err) {
        console.error("HeatmapPage: failed to fetch density history", err);
      }
    })();
    return () => { cancelled = true; };
  }, [historyRange]);

  /* ---- apply historical overlay when slider > 0 ---- */
  const displayZones: MergedZone[] = historyRange > 0 && historyData.length > 0
    ? zones.map((z) => {
        // Average historical occupancy for this zone
        const entries = historyData.filter((h) => h.zone_id === z.id);
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

  const getZoneColor = (zone: MergedZone) => {
    if (viewMode === "density") return densityColor(zone.densityPerSqm);
    return statusColor(zone.status);
  };

  const getZoneOpacity = (zone: MergedZone) => {
    if (viewMode === "utilization") {
      return 0.15 + (zone.utilizationPct / 100) * 0.55;
    }
    return 0.15 + Math.min(zone.densityPerSqm / 0.5, 1) * 0.55;
  };

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
            Zone density visualization · Capacity alerts · Real-time occupancy
          </p>
        </div>
        <div className="flex gap-2">
          {(["utilization", "density"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                viewMode === mode
                  ? "bg-[#E5521A]/12 text-[#E5521A] border-[#E5521A]/25"
                  : "bg-transparent text-[#4E6090] border-[#1E2F50] hover:text-[#8A9BBF]"
              }`}
            >
              {mode === "utilization" ? "Utilization" : "Density"}
            </button>
          ))}
        </div>
      </div>

      {/* Historical Time-Range Slider */}
      <div className="flex items-center gap-4 mb-5 bg-[#14203A] border border-[#1E2F50] rounded-[14px] px-5 py-3">
        <span className="text-[11px] font-bold text-[#E8EDF8] whitespace-nowrap" style={{ fontFamily: "'Syne', sans-serif" }}>
          {historyRange === 0 ? "Live" : `${historyRange} day${historyRange > 1 ? "s" : ""} ago`}
        </span>
        <input
          type="range"
          min={0}
          max={30}
          value={historyRange}
          onChange={(e) => setHistoryRange(Number(e.target.value))}
          className="flex-1 h-1.5 accent-[#E5521A] cursor-pointer"
        />
        <div className="flex justify-between text-[9px] text-[#4E6090] gap-4">
          <span>Live</span>
          <span>30 days ago</span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Overall Utilization", value: `${overallUtil}%`, color: parseFloat(overallUtil) >= 80 ? "#F5A623" : "#22D3A1", icon: Layers },
          { label: "Total Capacity", value: `${totalOcc.toLocaleString()} / ${totalCap.toLocaleString()}`, color: "#5B9BF5", icon: MapPin },
          { label: "Critical Zones", value: criticalZones.toString(), color: criticalZones > 0 ? "#F04A4A" : "#22D3A1", icon: AlertTriangle },
          { label: "Warning Zones", value: warningZones.toString(), color: warningZones > 0 ? "#F5A623" : "#22D3A1", icon: Thermometer },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 relative overflow-hidden">
            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full opacity-[0.06]" style={{ background: kpi.color }} />
            <kpi.icon className="w-4 h-4 mb-2" style={{ color: kpi.color }} />
            <div className="text-[9px] font-bold tracking-[0.08em] text-[#4E6090] uppercase mb-1">{kpi.label}</div>
            <div className="text-[22px] font-extrabold leading-none" style={{ color: kpi.color, fontFamily: "'Syne', sans-serif" }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#E5521A]/40 to-transparent mb-5" />

      {/* Map + Zone Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-5">
        {/* Floor Plan Map */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#E5521A]" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                Warehouse Floor Plan
              </span>
            </div>
            <div className="flex gap-3">
              {[
                { label: "Normal", color: "#22D3A1" },
                { label: "Warning", color: "#F5A623" },
                { label: "Critical", color: "#F04A4A" },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1 text-[9px] text-[#8A9BBF]">
                  <span className="w-2 h-2 rounded-sm" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>

          {/* SVG Floor Plan */}
          <div className="relative bg-[#0A0E1A] rounded-xl border border-[#1E2F50]/50 overflow-hidden">
            <svg viewBox="0 0 1000 560" className="w-full h-auto">
              {/* Grid lines */}
              {Array.from({ length: 21 }).map((_, i) => (
                <line key={`vg-${i}`} x1={i * 50} y1={0} x2={i * 50} y2={560} stroke="#1E2F50" strokeWidth={0.5} opacity={0.3} />
              ))}
              {Array.from({ length: 12 }).map((_, i) => (
                <line key={`hg-${i}`} x1={0} y1={i * 50} x2={1000} y2={560 > i * 50 ? i * 50 : 560} stroke="#1E2F50" strokeWidth={0.5} opacity={0.3} />
              ))}

              {/* Zone rectangles */}
              {displayZones.map((zone) => {
                // polygon_coords: [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] — use corners 0 and 2 for bounding rect
                if (zone.polygon.length < 3) return null;
                const [[x1, y1], , [x2, y2]] = [zone.polygon[0], zone.polygon[1], zone.polygon[2]];
                const color = getZoneColor(zone);
                const opacity = getZoneOpacity(zone);
                const isSelected = selectedZone?.id === zone.id;
                const w = x2 - x1;
                const h = y2 - y1;
                const cx = x1 + w / 2;
                const cy = y1 + h / 2;

                return (
                  <g
                    key={zone.id}
                    onClick={() => setSelectedZone(selectedZone?.id === zone.id ? null : zone)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={x1}
                      y={y1}
                      width={w}
                      height={h}
                      rx={8}
                      fill={color}
                      fillOpacity={opacity}
                      stroke={isSelected ? "#E5521A" : color}
                      strokeWidth={isSelected ? 3 : 1.5}
                      strokeOpacity={isSelected ? 1 : 0.4}
                    />
                    {/* Zone label */}
                    <text x={cx} y={cy - 18} textAnchor="middle" fill="#E8EDF8" fontSize={14} fontWeight={700}>
                      {zone.name.split("—")[0].trim()}
                    </text>
                    <text x={cx} y={cy + 2} textAnchor="middle" fill={color} fontSize={22} fontWeight={800}>
                      {zone.utilizationPct}%
                    </text>
                    <text x={cx} y={cy + 20} textAnchor="middle" fill="#8A9BBF" fontSize={10}>
                      {zone.currentOccupancy} / {zone.maxCapacity} units
                    </text>
                    {/* Status badge */}
                    <rect x={cx - 28} y={cy + 28} width={56} height={16} rx={8} fill={color} fillOpacity={0.2} />
                    <text x={cx} y={cy + 40} textAnchor="middle" fill={color} fontSize={8} fontWeight={700}>
                      {STATUS_LABEL[zone.status] ?? zone.status.toUpperCase()}
                    </text>
                  </g>
                );
              })}

              {/* Warehouse outline */}
              <rect x={20} y={20} width={960} height={520} rx={12} fill="none" stroke="#1E2F50" strokeWidth={2} strokeDasharray="8 4" />

              {/* Entry/Exit labels */}
              <text x={500} y={15} textAnchor="middle" fill="#4E6090" fontSize={10} fontWeight={600}>NORTH GATE — ENTRY</text>
              <text x={500} y={555} textAnchor="middle" fill="#4E6090" fontSize={10} fontWeight={600}>SOUTH GATE — EXIT</text>
            </svg>
          </div>

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
            <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
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
                    style={{
                      width: `${selectedZone.utilizationPct}%`,
                      background: statusColor(selectedZone.status),
                    }}
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
            </div>
          ) : (
            <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px] flex flex-col items-center justify-center h-[200px]">
              <Eye className="w-8 h-8 text-[#1E2F50] mb-3" />
              <span className="text-[12px] text-[#4E6090]">Click a zone on the map to view details</span>
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
                <div className="text-center text-[11px] text-[#4E6090] py-4">No capacity alerts</div>
              )}
            </div>
          </div>

          {/* Zone List */}
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
            <div className="flex items-center gap-2 mb-3.5">
              <Layers className="w-4 h-4 text-[#5B9BF5]" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                All Zones
              </span>
            </div>
            <div className="space-y-1.5">
              {displayZones.map((z) => (
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
                    <div className="w-16 h-1.5 bg-[#0F1A30] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${z.utilizationPct}%`, background: statusColor(z.status) }}
                      />
                    </div>
                    <span className="text-[10px] font-bold w-10 text-right" style={{ color: statusColor(z.status) }}>
                      {z.utilizationPct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
