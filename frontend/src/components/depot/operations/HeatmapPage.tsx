"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { getUnifiedDepotSource } from "@/services/depotUnifiedSource";
import {
  getZones,
  getDensityAnalytics,
  getDensityHistory,
  getThresholds,
  type DensityEntry,
  type DensityHistoryEntry,
  type ThresholdResponse,
} from "@/services/depotCluster";
import {
  MapPin,
  Layers,
  AlertTriangle,
  Thermometer,
  Eye,
  Loader2,
  Calendar,
} from "lucide-react";

import dynamic from "next/dynamic";

const Warehouse3DMap = dynamic(() => import("./Warehouse3DMap"), { ssr: false });

function statusColor(status: string): string {
  if (status === "critical") return "#F04A4A";
  if (status === "warning") return "#F5A623";
  return "#22D3A1";
}

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


function normalizeZoneCode(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/^zone[\s-]*/i, "")
    .toUpperCase();
}

function getStatusForUtilization(utilizationPct: number, thresholds: { warning: number; critical: number }) {
  if (utilizationPct >= thresholds.critical) return "critical";
  if (utilizationPct >= thresholds.warning) return "warning";
  return "normal";
}

function roundedStorageLevel(utilizationPct: number): number {
  return Math.round(utilizationPct);
}

function storageBarWidth(utilizationPct: number): string {
  return `${Math.min(100, Math.max(0, roundedStorageLevel(utilizationPct)))}%`;
}

function getLiveThresholds(thresholds: ThresholdResponse[]): { warning: number; critical: number } {
  if (thresholds.length === 0) return { warning: 80, critical: 95 };
  const global = thresholds.find((t) => t.is_global) ?? thresholds[0];
  return { warning: global.warning_pct, critical: global.critical_pct };
}

function getHistoryTimestamp(entry: DensityHistoryEntry) {
  const timestamp = new Date(entry.recorded_at).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getStartOfDate(value: string): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.NEGATIVE_INFINITY;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getEndOfDate(value: string): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Date.now();
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

function findReplayEntryInRange(
  entries: DensityHistoryEntry[],
  startDate: string,
  endDate: string,
): DensityHistoryEntry | null {
  if (entries.length === 0) return null;

  const startTime = startDate ? getStartOfDate(startDate) : Number.NEGATIVE_INFINITY;
  const endTime = endDate ? getEndOfDate(endDate) : Date.now();
  const inRange = entries
    .filter((entry) => {
      const timestamp = getHistoryTimestamp(entry);
      return timestamp >= startTime && timestamp <= endTime;
    })
    .sort((a, b) => getHistoryTimestamp(a) - getHistoryTimestamp(b));

  return inRange[inRange.length - 1] ?? null;
}

export default function HeatmapPage() {
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const zoneParam = searchParams.get("zone");
  const [zones, setZones] = useState<MergedZone[]>([]);
  const [thresholds, setThresholds] = useState<{ warning: number; critical: number }>({ warning: 80, critical: 95 });
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<MergedZone | null>(null);
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [historyData, setHistoryData] = useState<DensityHistoryEntry[]>([]);
  const hasHistoryRange = historyStartDate !== "" || historyEndDate !== "";

  const fetchData = useCallback(async () => {
    try {
      const source = await getUnifiedDepotSource({
        role: user?.role,
        email: user?.email,
        location: user?.location,
      });
      const densityMap = new Map<string, DensityEntry>();
      source.density.forEach((d) => densityMap.set(normalizeZoneCode(d.zone_code), d));
      const merged: MergedZone[] = source.zones.filter((z) => z.is_active).map((z) => {
        const zoneCode = normalizeZoneCode(z.zone_code);
        const den = densityMap.get(zoneCode);
        return {
          id: z.id,
          code: zoneCode,
          name: z.name || `Zone ${zoneCode}`,
          type: z.zone_type,
          floor: z.floor,
          areaSqm: z.area_sqm ?? 0,
          maxCapacity: z.max_capacity_units,
          currentOccupancy: z.current_occupancy,
          utilizationPct: z.utilization_pct,
          status: z.status,
          polygon: z.polygon_coords ?? [],
          densityPerSqm: den?.objects_per_sqm ?? (z.area_sqm ? z.current_occupancy / z.area_sqm : 0),
        };
      });
      setZones(merged);
      setThresholds({ warning: 80, critical: 95 });
      setSelectedZone((prev) => {
        if (!prev && zoneParam) {
          const normalized = normalizeZoneCode(zoneParam);
          return merged.find((z) => z.code === normalized) ?? null;
        }
        if (!prev) return null;
        return merged.find((z) => z.id === prev.id) ?? null;
      });
      return;

      {
      const [zonesResult, densityResult, thresholdResult] = await Promise.allSettled([
        getZones(),
        getDensityAnalytics(),
        getThresholds(),
      ]);

      if (zonesResult.status !== "fulfilled") {
        throw (zonesResult as PromiseRejectedResult).reason;
      }

      const zonesRes = (zonesResult as PromiseFulfilledResult<Awaited<ReturnType<typeof getZones>>>).value;
      const densityRes = densityResult.status === "fulfilled" ? (densityResult as PromiseFulfilledResult<DensityEntry[]>).value : [];
      const nextThresholds = thresholdResult.status === "fulfilled"
        ? getLiveThresholds((thresholdResult as PromiseFulfilledResult<ThresholdResponse[]>).value)
        : { warning: 80, critical: 95 };

      const densityMap = new Map<string, DensityEntry>();
      densityRes.forEach((d) => densityMap.set(normalizeZoneCode(d.zone_code), d));
      const merged: MergedZone[] = zonesRes.filter((z) => z.is_active).map((z) => {
        const zoneCode = normalizeZoneCode(z.zone_code);
        const den = densityMap.get(zoneCode);
        return {
          id: z.id, code: zoneCode, name: z.name || `Zone ${zoneCode}`, type: z.zone_type, floor: z.floor,
          areaSqm: z.area_sqm ?? 0, maxCapacity: z.max_capacity_units,
          currentOccupancy: z.current_occupancy, utilizationPct: z.utilization_pct,
          status: z.status, polygon: z.polygon_coords ?? [], densityPerSqm: den?.objects_per_sqm ?? 0,
        };
      });
      setZones(merged);
      setThresholds(nextThresholds);
      setSelectedZone((prev) => {
        // If navigated from inventory with a zone param, auto-select it (only on first load)
        if (!prev && zoneParam) {
          const normalized = normalizeZoneCode(zoneParam);
          return merged.find((z) => z.code === normalized) ?? null;
        }
        if (!prev) return null;
        return merged.find((z) => z.id === prev.id) ?? null;
      });
      }
    } catch (error) {
      console.error("HeatmapPage: failed to load live inventory zones", error);
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?.location, user?.role, zoneParam]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!hasHistoryRange) { setHistoryData([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await getDensityHistory(undefined, 2000);
        if (!cancelled) setHistoryData(data);
      } catch { if (!cancelled) setHistoryData([]); }
    })();
    return () => { cancelled = true; };
  }, [hasHistoryRange]);

  const displayZones: MergedZone[] = hasHistoryRange
    ? zones.map((z) => {
        const entries = historyData.filter((h) => h.zone_id === z.id || h.zone_code === z.code);
        const replayEntry = findReplayEntryInRange(entries, historyStartDate, historyEndDate);
        if (!replayEntry) return z;
        const maxCapacity = z.maxCapacity;
        const utilizationPct = maxCapacity > 0 ? Number(((replayEntry.occupancy / maxCapacity) * 100).toFixed(1)) : replayEntry.utilization_pct;
        return { ...z, maxCapacity, currentOccupancy: replayEntry.occupancy, utilizationPct, status: replayEntry.status ?? getStatusForUtilization(utilizationPct, thresholds), densityPerSqm: z.areaSqm > 0 ? replayEntry.occupancy / z.areaSqm : z.densityPerSqm };
      })
    : zones;

  const selectedDisplayZone = selectedZone ? displayZones.find((z) => z.id === selectedZone.id) ?? null : null;
  const totalCap = displayZones.reduce((a, z) => a + z.maxCapacity, 0);
  const totalOcc = displayZones.reduce((a, z) => a + z.currentOccupancy, 0);
  const overallUtil = totalCap > 0 ? ((totalOcc / totalCap) * 100).toFixed(1) : "0";
  const criticalZones = displayZones.filter((z) => z.status === "critical").length;
  const warningZones = displayZones.filter((z) => z.status === "warning").length;
  const capacityAlerts = displayZones.filter((z) => z.utilizationPct >= thresholds.warning || z.status === "warning" || z.status === "critical").sort((a, b) => b.utilizationPct - a.utilizationPct);

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
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[11px] text-[#E5521A] font-bold tracking-[0.1em] uppercase mb-1">Cluster Mapping</div>
          <h2 className="text-xl font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>Warehouse Heatmap</h2>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">Zone density visualization · Capacity alerts · Real-time occupancy</p>
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
            <div className="text-[22px] font-extrabold leading-none" style={{ color: kpi.color, fontFamily: "'Syne', sans-serif" }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-5">
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] px-5 py-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[11px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
              {hasHistoryRange ? "Historical occupancy" : "Live occupancy"}
            </span>
            <span className="text-[9px] text-[#4E6090]">Select dates to replay historical occupancy</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
            <label className="flex items-center gap-2 rounded-[10px] border border-[#1E2F50] bg-[#0F1A30] px-3 py-2">
              <Calendar className="h-3.5 w-3.5 text-[#E5521A]" />
              <span className="text-[9px] font-bold uppercase tracking-wide text-[#4E6090]">From</span>
              <input
                type="date"
                value={historyStartDate}
                max={historyEndDate || undefined}
                onChange={(e) => setHistoryStartDate(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-[#E8EDF8] outline-none"
              />
            </label>
            <label className="flex items-center gap-2 rounded-[10px] border border-[#1E2F50] bg-[#0F1A30] px-3 py-2">
              <Calendar className="h-3.5 w-3.5 text-[#E5521A]" />
              <span className="text-[9px] font-bold uppercase tracking-wide text-[#4E6090]">To</span>
              <input
                type="date"
                value={historyEndDate}
                min={historyStartDate || undefined}
                onChange={(e) => setHistoryEndDate(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-[#E8EDF8] outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => { setHistoryStartDate(""); setHistoryEndDate(""); }}
              className="rounded-[10px] border border-[#1E2F50] px-4 py-2 text-[11px] font-bold text-[#8A9BBF] transition-colors hover:border-[#E5521A]/40 hover:text-[#E5521A]"
            >
              Live
            </button>
          </div>
        </div>
        <div className="hidden lg:block" />
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-[#E5521A]/40 to-transparent mb-5" />

      {/* Map + Zone Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-5">
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#E5521A]" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>Warehouse Floor Plan</span>
            </div>
            <div className="flex gap-3">
              {[{ label: "Normal", color: "#22D3A1" }, { label: "Warning", color: "#F5A623" }, { label: "Critical", color: "#F04A4A" }].map((l) => (
                <span key={l.label} className="flex items-center gap-1 text-[9px] text-[#8A9BBF]">
                  <span className="w-2 h-2 rounded-sm" style={{ background: l.color }} />{l.label}
                </span>
              ))}
            </div>
          </div>
          <Warehouse3DMap zones={displayZones} selectedZone={selectedDisplayZone?.code ?? null} onZoneClick={(code) => { const match = displayZones.find((z) => z.code === code); setSelectedZone(match && selectedZone?.id === match.id ? null : match ?? null); }} />
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

        <div className="space-y-4">
          {selectedDisplayZone ? (
            <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>{selectedDisplayZone.name}</div>
                  <div className="text-[10px] text-[#8A9BBF] mt-0.5">{selectedDisplayZone.type.toUpperCase()} · {selectedDisplayZone.floor} · {selectedDisplayZone.areaSqm} m²</div>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border" style={{ background: `${statusColor(selectedDisplayZone.status)}15`, color: statusColor(selectedDisplayZone.status), borderColor: `${statusColor(selectedDisplayZone.status)}30` }}>
                  {STATUS_LABEL[selectedDisplayZone.status] ?? selectedDisplayZone.status.toUpperCase()}
                </span>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-[#8A9BBF]">Utilization</span>
                  <span className="font-bold" style={{ color: statusColor(selectedDisplayZone.status) }}>{roundedStorageLevel(selectedDisplayZone.utilizationPct)}%</span>
                </div>
                <div className="w-full h-2 bg-[#0F1A30] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: storageBarWidth(selectedDisplayZone.utilizationPct), background: statusColor(selectedDisplayZone.status) }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: "Capacity", v: `${selectedDisplayZone.currentOccupancy} / ${selectedDisplayZone.maxCapacity}` },
                  { l: "Density", v: `${selectedDisplayZone.densityPerSqm.toFixed(2)} /m²` },
                  { l: "Area", v: `${selectedDisplayZone.areaSqm} m²` },
                  { l: "Type", v: selectedDisplayZone.type },
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

          <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
            <div className="flex justify-between items-center mb-3.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#F5A623]" />
                <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>Capacity Alerts</span>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F04A4A]/12 text-[#F04A4A] border border-[#F04A4A]/25">{capacityAlerts.length} Active</span>
            </div>
            <div className="space-y-2">
              {capacityAlerts.map((zone) => {
                const isCritical = zone.status === "critical" || zone.utilizationPct >= thresholds.critical;
                const sevColor = isCritical ? "#F04A4A" : "#F5A623";
                return (
                  <div key={zone.id} className="p-2.5 rounded-[10px] bg-[#0F1A30] hover:bg-[#E5521A]/5 transition-colors cursor-pointer" style={{ borderLeft: `3px solid ${sevColor}` }} onClick={() => setSelectedZone(zone)}>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold" style={{ color: sevColor }}>Zone {zone.code}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border" style={{ background: `${sevColor}22`, color: sevColor, borderColor: `${sevColor}33` }}>{roundedStorageLevel(zone.utilizationPct)}%</span>
                    </div>
                    <div className="text-[10px] text-[#8A9BBF] mt-0.5">{zone.name} — {zone.currentOccupancy.toLocaleString()} / {zone.maxCapacity.toLocaleString()} bags</div>
                  </div>
                );
              })}
              {capacityAlerts.length === 0 && <div className="text-center text-[11px] text-[#4E6090] py-4">No capacity alerts</div>}
            </div>
          </div>

          <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
            <div className="flex items-center gap-2 mb-3.5">
              <Layers className="w-4 h-4 text-[#5B9BF5]" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>All Zones</span>
            </div>
            <div className="space-y-1.5">
              {displayZones.map((z) => {
                const storageLevel = roundedStorageLevel(z.utilizationPct);
                return (
                  <div key={z.id} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${selectedDisplayZone?.id === z.id ? "bg-[#E5521A]/10" : "hover:bg-[#0F1A30]"}`} onClick={() => setSelectedZone(z)}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: statusColor(z.status) }} />
                      <span className="text-[11px] font-bold text-[#E8EDF8]">{z.code}</span>
                      <span className="text-[10px] text-[#8A9BBF]">{z.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[#0F1A30] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: storageBarWidth(z.utilizationPct), background: statusColor(z.status) }} />
                      </div>
                      <span className="text-[10px] font-bold w-10 text-right" style={{ color: statusColor(z.status) }}>{storageLevel}%</span>
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
