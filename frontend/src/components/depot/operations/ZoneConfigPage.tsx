"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getZones,
  getZoneHistory,
  getThresholds,
  configureThreshold,
  getCapacityStatus,
  updateZoneBoundary,
  type ZoneResponse,
  type ZoneHistoryEntry,
  type ThresholdResponse,
  type CapacityStatusEntry,
} from "@/services/depotCluster";
import {
  Settings,
  TrendingUp,
  Download,
  Edit3,
  Save,
  Sliders,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertTriangle,
  MapPin,
  Clock,
  Loader2,
} from "lucide-react";

function statusColor(status: string): string {
  if (status === "critical") return "#F04A4A";
  if (status === "warning") return "#F5A623";
  return "#22D3A1";
}

export default function ZoneConfigPage() {
  // --- Data state ---
  const [zones, setZones] = useState<ZoneResponse[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [history, setHistory] = useState<ZoneHistoryEntry[]>([]);
  const [thresholds, setThresholds] = useState<ThresholdResponse[]>([]);
  const [capacityStatus, setCapacityStatus] = useState<CapacityStatusEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  // --- Boundary editing state ---
  const [editingBoundary, setEditingBoundary] = useState(false);
  const [editPoints, setEditPoints] = useState<number[][]>([]);

  // --- Threshold editing state ---
  const [warningThreshold, setWarningThreshold] = useState(75);
  const [criticalThreshold, setCriticalThreshold] = useState(90);
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [saving, setSaving] = useState(false);

  // Debounce ref for threshold save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived zone
  const zone = zones.find((z) => z.id === selectedZoneId) ?? null;

  // --- Load zones, thresholds, capacity status on mount ---
  useEffect(() => {
    async function load() {
      try {
        const [z, t, cs] = await Promise.all([getZones(), getThresholds(), getCapacityStatus()]);
        setZones(z);
        setThresholds(t);
        setCapacityStatus(cs);
        if (z.length > 0) {
          setSelectedZoneId(z[0].id);
        }
      } catch (err) {
        console.error("Failed to load zone config data", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // --- When selected zone changes, load its history + apply matching threshold ---
  useEffect(() => {
    if (!selectedZoneId) return;
    let cancelled = false;
    setHistoryLoading(true);
    getZoneHistory(selectedZoneId, 12)
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .catch((err) => console.error("Failed to load zone history", err))
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    // Apply zone-specific or global threshold
    const zoneThreshold = thresholds.find((t) => t.zone_id === selectedZoneId);
    const globalThreshold = thresholds.find((t) => t.is_global);
    const active = zoneThreshold ?? globalThreshold;
    if (active) {
      setWarningThreshold(active.warning_pct);
      setCriticalThreshold(active.critical_pct);
    } else {
      setWarningThreshold(75);
      setCriticalThreshold(90);
    }

    return () => { cancelled = true; };
  }, [selectedZoneId, thresholds]);

  // --- Debounced threshold save ---
  const debouncedSaveThreshold = useCallback(
    (warning: number, critical: number) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        if (!zone) return;
        setSaving(true);
        try {
          const result = await configureThreshold({
            zone_id: zone.id,
            zone_code: zone.zone_code,
            warning_pct: warning,
            critical_pct: critical,
            is_global: false,
          });
          // Update local thresholds cache
          setThresholds((prev) => {
            const idx = prev.findIndex((t) => t.zone_id === zone.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = result;
              return next;
            }
            return [...prev, result];
          });
        } catch (err) {
          console.error("Failed to save threshold", err);
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [zone],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleWarningChange = (val: number) => {
    setWarningThreshold(val);
    if (editingThreshold) debouncedSaveThreshold(val, criticalThreshold);
  };

  const handleCriticalChange = (val: number) => {
    setCriticalThreshold(val);
    if (editingThreshold) debouncedSaveThreshold(warningThreshold, val);
  };

  // --- Trend calculations from history ---
  const lastMonth = history[history.length - 1]?.utilization_pct ?? 0;
  const prevMonth = history[history.length - 2]?.utilization_pct ?? 0;
  const trend = lastMonth - prevMonth;
  const avgUtil =
    history.length > 0 ? (history.reduce((a, h) => a + h.utilization_pct, 0) / history.length).toFixed(1) : "0";
  const peakUtil = history.length > 0 ? Math.max(...history.map((h) => h.utilization_pct)) : 0;
  const minUtil = history.length > 0 ? Math.min(...history.map((h) => h.utilization_pct)) : 0;

  // Format timestamp to short month label
  function fmtMonth(ts: string): string {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    } catch {
      return ts;
    }
  }

  if (loading) {
    return (
      <div className="p-5 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 theme-text-nav-active animate-spin" />
        <span className="ml-2 text-[12px] text-[#8A9BBF]">Loading zone configuration...</span>
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="p-5 text-center text-[#8A9BBF] text-[12px]">No zones found.</div>
    );
  }

  const utilizationPct = zone.utilization_pct;
  const densityPerSqm =
    zone.area_sqm && zone.area_sqm > 0 ? (zone.current_occupancy / zone.area_sqm).toFixed(2) : "N/A";

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[11px] theme-text-nav-active font-bold tracking-[0.1em] uppercase mb-1">
            Zone Configuration
          </div>
          <h2 className="text-xl font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
            Zone Config & Historical Trends
          </h2>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            Zone boundary editor · Capacity thresholds · 12-month utilization archive
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 theme-bg-accent-subtle border border-[var(--accent-border)] rounded-xl theme-text-nav-active text-[12px] font-bold hover:bg-[var(--accent-subtle-bg)] transition-colors">
          <Download className="w-3.5 h-3.5" />
          Export PDF
        </button>
      </div>

      {/* Zone Selector Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {zones.map((z) => (
          <button
            key={z.id}
            onClick={() => setSelectedZoneId(z.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[11px] font-bold transition-all whitespace-nowrap ${
              selectedZoneId === z.id
                ? "theme-bg-accent-subtle theme-text-nav-active border-[var(--accent-border)]"
                : "bg-[#14203A] text-[#4E6090] border-[#1E2F50] hover:text-[#8A9BBF] hover:border-[#1E2F50]"
            }`}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: statusColor(z.status) }} />
            Zone {z.zone_code}
            <span className="text-[9px] opacity-70">{z.utilization_pct}%</span>
          </button>
        ))}
      </div>

      {/* Zone Overview + Threshold Config */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 mb-5">
        {/* Zone Properties */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 theme-text-nav-active" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                Zone {zone.zone_code} — Properties
              </span>
            </div>
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
              style={{
                background: `${statusColor(zone.status)}15`,
                color: statusColor(zone.status),
                borderColor: `${statusColor(zone.status)}30`,
              }}
            >
              {zone.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { l: "Name", v: zone.name },
              { l: "Type", v: zone.zone_type.charAt(0).toUpperCase() + zone.zone_type.slice(1) },
              { l: "Floor", v: zone.floor.charAt(0).toUpperCase() + zone.floor.slice(1) },
              { l: "Area", v: zone.area_sqm ? `${zone.area_sqm.toLocaleString()} m²` : "N/A" },
              { l: "Max Capacity", v: `${zone.max_capacity_units.toLocaleString()} units` },
              { l: "Current Occupancy", v: `${zone.current_occupancy.toLocaleString()} units` },
              { l: "Utilization", v: `${utilizationPct}%` },
              { l: "Density", v: `${densityPerSqm} objects/m²` },
            ].map((prop) => (
              <div key={prop.l} className="bg-[#0F1A30] rounded-lg p-3 border border-[#1E2F50]/50">
                <div className="text-[8px] text-[#4E6090] font-bold uppercase tracking-wide mb-0.5">{prop.l}</div>
                <div className="text-[12px] font-bold text-[#E8EDF8]">{prop.v}</div>
              </div>
            ))}
          </div>

          {/* Polygon Boundary Editor */}
          <div className="mt-3 bg-[#0F1A30] rounded-lg p-3 border border-[#1E2F50]/50">
            <div className="flex justify-between items-center mb-2">
              <div className="text-[8px] text-[#4E6090] font-bold uppercase tracking-wide">Boundary Coordinates</div>
              <div className="flex items-center gap-2">
                {editingBoundary && (
                  <>
                    <button
                      className="flex items-center gap-1 text-[9px] text-[#F04A4A] hover:text-[#F04A4A]/80 font-semibold"
                      onClick={() => setEditPoints([])}
                    >
                      Clear
                    </button>
                    <button
                      className="flex items-center gap-1 text-[9px] text-[#22D3A1] hover:text-[#22D3A1]/80 font-semibold"
                      onClick={async () => {
                        if (editPoints.length < 3) return;
                        try {
                          const updated = await updateZoneBoundary(zone.id, editPoints);
                          setZones((prev) => prev.map((z) => (z.id === updated.id ? updated : z)));
                          setEditingBoundary(false);
                        } catch (err) {
                          console.error("Failed to save boundary", err);
                        }
                      }}
                    >
                      <Save className="w-3 h-3" />
                      Save Boundary
                    </button>
                  </>
                )}
                <button
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold border transition-colors ${
                    editingBoundary
                      ? "bg-[#22D3A1]/12 text-[#22D3A1] border-[#22D3A1]/25"
                      : "text-[#5B9BF5] hover:text-[#7BB5FF] border-[#5B9BF5]/25"
                  }`}
                  onClick={() => {
                    if (!editingBoundary) {
                      setEditPoints(zone.polygon_coords ?? []);
                    }
                    setEditingBoundary(!editingBoundary);
                  }}
                >
                  <Edit3 className="w-3 h-3" />
                  {editingBoundary ? "Cancel" : "Edit Boundary"}
                </button>
              </div>
            </div>

            {/* SVG Polygon Canvas */}
            {(() => {
              const displayPoints = editingBoundary ? editPoints : (zone.polygon_coords ?? []);
              const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
                if (!editingBoundary) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000);
                const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000);
                setEditPoints(prev => [...prev, [x, y]]);
              };

              return (
                <div>
                  <svg
                    width="300"
                    height="200"
                    viewBox="0 0 1000 1000"
                    className={`w-full max-w-[300px] h-[200px] rounded-lg border ${
                      editingBoundary
                        ? "border-[#5B9BF5]/40 cursor-crosshair bg-[#0A1628]"
                        : "border-[#1E2F50]/50 bg-[#0D1526]"
                    }`}
                    onClick={handleSvgClick}
                  >
                    {/* Grid lines for reference */}
                    {[200, 400, 600, 800].map((v) => (
                      <g key={v}>
                        <line x1={v} y1={0} x2={v} y2={1000} stroke="#1E2F50" strokeWidth={1} strokeDasharray="8,8" />
                        <line x1={0} y1={v} x2={1000} y2={v} stroke="#1E2F50" strokeWidth={1} strokeDasharray="8,8" />
                      </g>
                    ))}
                    {/* Polygon fill */}
                    {displayPoints.length >= 3 && (
                      <polygon
                        points={displayPoints.map((p) => `${p[0]},${p[1]}`).join(" ")}
                        fill={editingBoundary ? "rgba(91,155,245,0.12)" : "var(--accent-subtle)"}
                        stroke={editingBoundary ? "#5B9BF5" : "var(--accent)"}
                        strokeWidth={3}
                        strokeLinejoin="round"
                      />
                    )}
                    {/* Edge lines when fewer than 3 points */}
                    {displayPoints.length >= 2 && displayPoints.length < 3 && (
                      <polyline
                        points={displayPoints.map((p) => `${p[0]},${p[1]}`).join(" ")}
                        fill="none"
                        stroke={editingBoundary ? "#5B9BF5" : "var(--accent)"}
                        strokeWidth={3}
                      />
                    )}
                    {/* Vertex markers */}
                    {displayPoints.map((p, i) => (
                      <g key={i}>
                        <circle cx={p[0]} cy={p[1]} r={editingBoundary ? 18 : 14} fill={editingBoundary ? "#5B9BF5" : "var(--accent)"} opacity={0.9} />
                        <text x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={editingBoundary ? 22 : 18} fontWeight="bold">
                          {i + 1}
                        </text>
                      </g>
                    ))}
                  </svg>

                  {/* Coordinate list below SVG */}
                  {displayPoints.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {displayPoints.map((coord, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-[#14203A] text-[#8A9BBF] border border-[#1E2F50]/50 font-mono">
                          {i + 1}: [{coord[0]}, {coord[1]}]
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-[#4E6090] mt-2">
                      {editingBoundary ? "Click on the canvas to add boundary points." : "No boundary coordinates defined."}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Threshold Config */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#F5A623]" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                Capacity Thresholds
              </span>
              {saving && (
                <span className="flex items-center gap-1 text-[9px] text-[#F5A623]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </span>
              )}
            </div>
            <button
              onClick={() => setEditingThreshold(!editingThreshold)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                editingThreshold
                  ? "bg-[#22D3A1]/12 text-[#22D3A1] border-[#22D3A1]/25"
                  : "bg-[#5B9BF5]/12 text-[#5B9BF5] border-[#5B9BF5]/25"
              }`}
            >
              {editingThreshold ? <Save className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
              {editingThreshold ? "Done" : "Edit"}
            </button>
          </div>

          {/* Warning threshold */}
          <div className="mb-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] text-[#F5A623] font-bold">Warning Threshold</span>
              <span className="text-[14px] font-extrabold text-[#F5A623]">{warningThreshold}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={95}
              value={warningThreshold}
              onChange={(e) => handleWarningChange(Number(e.target.value))}
              disabled={!editingThreshold}
              className="w-full h-2 bg-[#0F1A30] rounded-full appearance-none cursor-pointer accent-[#F5A623] disabled:opacity-50"
            />
            <div className="flex justify-between text-[9px] text-[#4E6090] mt-1">
              <span>50%</span>
              <span>Triggers capacity warning alert</span>
              <span>95%</span>
            </div>
          </div>

          {/* Critical threshold */}
          <div className="mb-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[11px] text-[#F04A4A] font-bold">Critical Threshold</span>
              <span className="text-[14px] font-extrabold text-[#F04A4A]">{criticalThreshold}%</span>
            </div>
            <input
              type="range"
              min={70}
              max={100}
              value={criticalThreshold}
              onChange={(e) => handleCriticalChange(Number(e.target.value))}
              disabled={!editingThreshold}
              className="w-full h-2 bg-[#0F1A30] rounded-full appearance-none cursor-pointer accent-[#F04A4A] disabled:opacity-50"
            />
            <div className="flex justify-between text-[9px] text-[#4E6090] mt-1">
              <span>70%</span>
              <span>Triggers critical escalation</span>
              <span>100%</span>
            </div>
          </div>

          {/* Visual threshold preview */}
          <div className="bg-[#0F1A30] rounded-xl p-3 border border-[#1E2F50]/50">
            <div className="text-[9px] text-[#4E6090] font-bold uppercase tracking-wide mb-2">Threshold Preview</div>
            <div className="relative h-6 bg-[#0A0E1A] rounded-full overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 bg-[#22D3A1]/20 rounded-l-full" style={{ width: `${warningThreshold}%` }} />
              <div className="absolute top-0 bottom-0 bg-[#F5A623]/25" style={{ left: `${warningThreshold}%`, width: `${criticalThreshold - warningThreshold}%` }} />
              <div className="absolute top-0 bottom-0 bg-[#F04A4A]/25 rounded-r-full" style={{ left: `${criticalThreshold}%`, width: `${100 - criticalThreshold}%` }} />
              {/* Current utilization marker */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-[#E8EDF8] rounded-full z-10"
                style={{ left: `${utilizationPct}%` }}
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] text-[#E8EDF8] font-bold whitespace-nowrap">
                  {utilizationPct}%
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-2 text-[9px]">
              <span className="text-[#22D3A1]">Normal (0–{warningThreshold}%)</span>
              <span className="text-[#F5A623]">Warning ({warningThreshold}–{criticalThreshold}%)</span>
              <span className="text-[#F04A4A]">Critical ({criticalThreshold}%+)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[var(--accent-border)] to-transparent mb-5" />

      {/* Historical Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* Trend Chart */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#5B9BF5]" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                12-Month Utilization — Zone {zone.zone_code}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-[9px] text-[#8A9BBF]">
                <span className="w-2 h-2 rounded-sm bg-[#5B9BF5]" />
                Utilization %
              </span>
              <span className="flex items-center gap-1 text-[9px] text-[#8A9BBF]">
                <span className="w-8 h-px bg-[#F5A623]" style={{ borderTop: "2px dashed #F5A623" }} />
                Warning
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="relative h-[220px]">
            {historyLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-5 h-5 text-[#5B9BF5] animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[11px] text-[#4E6090]">
                No history data available for this zone.
              </div>
            ) : (
              <>
                {/* Y-axis guides */}
                {[0, 25, 50, 75, 100].map((v) => (
                  <div
                    key={v}
                    className="absolute left-0 right-0 border-t border-[#1E2F50]/40"
                    style={{ bottom: `${v}%` }}
                  >
                    <span className="absolute -left-1 -top-2 text-[8px] text-[#4E6090]">{v}%</span>
                  </div>
                ))}

                {/* Warning threshold line */}
                <div
                  className="absolute left-8 right-0 border-t-2 border-dashed border-[#F5A623]/40 z-10"
                  style={{ bottom: `${warningThreshold}%` }}
                />

                {/* Critical threshold line */}
                <div
                  className="absolute left-8 right-0 border-t-2 border-dashed border-[#F04A4A]/30 z-10"
                  style={{ bottom: `${criticalThreshold}%` }}
                />

                {/* Bar chart */}
                <div className="flex items-end gap-2 h-full pl-8">
                  {history.map((h, i) => {
                    const barH = (h.utilization_pct / 100) * 100;
                    const isAboveWarning = h.utilization_pct >= warningThreshold;
                    const isAboveCritical = h.utilization_pct >= criticalThreshold;
                    const barColor = isAboveCritical ? "#F04A4A" : isAboveWarning ? "#F5A623" : "#5B9BF5";
                    const isLast = i === history.length - 1;

                    return (
                      <div key={h.id ?? i} className="flex-1 flex flex-col items-center gap-0.5 group/bar relative">
                        <span className="text-[8px] text-[#8A9BBF] opacity-0 group-hover/bar:opacity-100 transition-opacity">
                          {h.utilization_pct}%
                        </span>
                        <div
                          className="w-full rounded-t transition-all"
                          style={{
                            height: `${barH}%`,
                            background: isLast
                              ? `linear-gradient(to bottom, ${barColor}, ${barColor}66)`
                              : `linear-gradient(to bottom, ${barColor}cc, ${barColor}44)`,
                            filter: isLast ? `drop-shadow(0 0 4px ${barColor}88)` : undefined,
                          }}
                        />
                        <span className="text-[8px] text-[#4E6090]">{fmtMonth(h.timestamp)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Trend Stats */}
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-[#22D3A1]" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                Trend Summary
              </span>
            </div>

            <div className="space-y-3">
              {[
                {
                  l: "Month-over-Month",
                  v: `${trend >= 0 ? "+" : ""}${trend}%`,
                  icon: trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus,
                  color: trend > 5 ? "#F04A4A" : trend < -5 ? "#22D3A1" : "#F5A623",
                },
                { l: "12-Month Average", v: `${avgUtil}%`, icon: TrendingUp, color: "#5B9BF5" },
                { l: "Peak Utilization", v: `${peakUtil}%`, icon: ArrowUpRight, color: peakUtil >= 90 ? "#F04A4A" : "#F5A623" },
                { l: "Minimum Utilization", v: `${minUtil}%`, icon: ArrowDownRight, color: "#22D3A1" },
                { l: "Current", v: `${lastMonth}%`, icon: Clock, color: statusColor(zone.status) },
              ].map((stat) => (
                <div key={stat.l} className="flex items-center justify-between p-2.5 bg-[#0F1A30] rounded-lg">
                  <div className="flex items-center gap-2">
                    <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                    <span className="text-[11px] text-[#8A9BBF]">{stat.l}</span>
                  </div>
                  <span className="text-[13px] font-extrabold" style={{ color: stat.color }}>
                    {stat.v}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Zone Comparison */}
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
            <div className="flex items-center gap-2 mb-3.5">
              <AlertTriangle className="w-4 h-4 text-[#F5A623]" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                Zone Comparison
              </span>
            </div>
            <div className="space-y-2">
              {capacityStatus.map((cs) => {
                const matchZone = zones.find((z) => z.zone_code === cs.zone_code);
                const zoneId = matchZone?.id ?? null;

                return (
                  <div
                    key={cs.zone_code}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedZoneId === zoneId ? "theme-bg-accent-subtle" : "hover:bg-[#0F1A30]"
                    }`}
                    onClick={() => { if (zoneId) setSelectedZoneId(zoneId); }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: statusColor(cs.status) }} />
                      <span className="text-[11px] font-bold text-[#E8EDF8]">Zone {cs.zone_code}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-1.5 bg-[#0F1A30] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${cs.utilization_pct}%`, background: statusColor(cs.status) }}
                        />
                      </div>
                      <span className="text-[10px] font-bold w-8 text-right" style={{ color: statusColor(cs.status) }}>
                        {cs.utilization_pct}%
                      </span>
                      <span
                        className="text-[9px] font-bold w-8 text-right"
                        style={{
                          color: cs.exceeds_critical ? "#F04A4A" : cs.exceeds_warning ? "#F5A623" : "#22D3A1",
                        }}
                      >
                        {cs.exceeds_critical ? "CRIT" : cs.exceeds_warning ? "WARN" : "OK"}
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
