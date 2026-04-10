"use client";

import { useState } from "react";
import {
  ZONE_DETAILS,
  ZONE_HISTORY,
  ZONE_HISTORY_MONTHS,
  CAPACITY_THRESHOLDS,
  statusColor,
  type ZoneDetail,
} from "@/lib/depot-data";
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
} from "lucide-react";

export default function ZoneConfigPage() {
  const [selectedZone, setSelectedZone] = useState<string>("A");
  const [warningThreshold, setWarningThreshold] = useState(CAPACITY_THRESHOLDS.warning);
  const [criticalThreshold, setCriticalThreshold] = useState(CAPACITY_THRESHOLDS.critical);
  const [editingThreshold, setEditingThreshold] = useState(false);

  const zone = ZONE_DETAILS.find((z) => z.code === selectedZone)!;
  const history = ZONE_HISTORY[selectedZone] || [];
  const maxUtil = Math.max(...history.map((h) => h.utilization), 100);

  // Trend calculation
  const lastMonth = history[history.length - 1]?.utilization ?? 0;
  const prevMonth = history[history.length - 2]?.utilization ?? 0;
  const trend = lastMonth - prevMonth;
  const avgUtil = history.length > 0 ? (history.reduce((a, h) => a + h.utilization, 0) / history.length).toFixed(1) : "0";
  const peakUtil = Math.max(...history.map((h) => h.utilization));
  const minUtil = Math.min(...history.map((h) => h.utilization));

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[11px] text-[#E5521A] font-bold tracking-[0.1em] uppercase mb-1">
            Zone Configuration
          </div>
          <h2 className="text-xl font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
            Zone Config & Historical Trends
          </h2>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            Zone boundary editor · Capacity thresholds · 12-month utilization archive
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#E5521A]/10 border border-[#E5521A]/25 rounded-xl text-[#E5521A] text-[12px] font-bold hover:bg-[#E5521A]/20 transition-colors">
          <Download className="w-3.5 h-3.5" />
          Export PDF
        </button>
      </div>

      {/* Zone Selector Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {ZONE_DETAILS.map((z) => (
          <button
            key={z.code}
            onClick={() => setSelectedZone(z.code)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[11px] font-bold transition-all whitespace-nowrap ${
              selectedZone === z.code
                ? "bg-[#E5521A]/12 text-[#E5521A] border-[#E5521A]/25"
                : "bg-[#14203A] text-[#4E6090] border-[#1E2F50] hover:text-[#8A9BBF] hover:border-[#1E2F50]"
            }`}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: statusColor(z.status) }} />
            Zone {z.code}
            <span className="text-[9px] opacity-70">{z.utilizationPct}%</span>
          </button>
        ))}
      </div>

      {/* Zone Overview + Threshold Config */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 mb-5">
        {/* Zone Properties */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#E5521A]" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                Zone {zone.code} — Properties
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
              { l: "Type", v: zone.type.charAt(0).toUpperCase() + zone.type.slice(1) },
              { l: "Floor", v: zone.floor.charAt(0).toUpperCase() + zone.floor.slice(1) },
              { l: "Area", v: `${zone.areaSqm.toLocaleString()} m²` },
              { l: "Max Capacity", v: `${zone.maxCapacity.toLocaleString()} units` },
              { l: "Current Occupancy", v: `${zone.currentOccupancy.toLocaleString()} units` },
              { l: "Utilization", v: `${zone.utilizationPct}%` },
              { l: "Density", v: `${zone.densityPerSqm} objects/m²` },
            ].map((prop) => (
              <div key={prop.l} className="bg-[#0F1A30] rounded-lg p-3 border border-[#1E2F50]/50">
                <div className="text-[8px] text-[#4E6090] font-bold uppercase tracking-wide mb-0.5">{prop.l}</div>
                <div className="text-[12px] font-bold text-[#E8EDF8]">{prop.v}</div>
              </div>
            ))}
          </div>

          {/* Polygon Coordinates */}
          <div className="mt-3 bg-[#0F1A30] rounded-lg p-3 border border-[#1E2F50]/50">
            <div className="flex justify-between items-center mb-1.5">
              <div className="text-[8px] text-[#4E6090] font-bold uppercase tracking-wide">Boundary Coordinates</div>
              <button className="flex items-center gap-1 text-[9px] text-[#5B9BF5] hover:text-[#7BB5FF]">
                <Edit3 className="w-3 h-3" />
                Edit
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {zone.polygon.map((coord, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-[#14203A] text-[#8A9BBF] border border-[#1E2F50]/50 font-mono">
                  [{coord[0]}, {coord[1]}]
                </span>
              ))}
            </div>
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
              {editingThreshold ? "Save" : "Edit"}
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
              onChange={(e) => setWarningThreshold(Number(e.target.value))}
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
              onChange={(e) => setCriticalThreshold(Number(e.target.value))}
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
                style={{ left: `${zone.utilizationPct}%` }}
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] text-[#E8EDF8] font-bold whitespace-nowrap">
                  {zone.utilizationPct}%
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

      <div className="h-px bg-gradient-to-r from-transparent via-[#E5521A]/40 to-transparent mb-5" />

      {/* Historical Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* Trend Chart */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#5B9BF5]" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                12-Month Utilization — Zone {selectedZone}
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
                const barH = (h.utilization / 100) * 100;
                const isAboveWarning = h.utilization >= warningThreshold;
                const isAboveCritical = h.utilization >= criticalThreshold;
                const barColor = isAboveCritical ? "#F04A4A" : isAboveWarning ? "#F5A623" : "#5B9BF5";
                const isLast = i === history.length - 1;

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group/bar relative">
                    <span className="text-[8px] text-[#8A9BBF] opacity-0 group-hover/bar:opacity-100 transition-opacity">
                      {h.utilization}%
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
                    <span className="text-[8px] text-[#4E6090]">{h.timestamp}</span>
                  </div>
                );
              })}
            </div>
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
              {ZONE_DETAILS.filter((z) => ZONE_HISTORY[z.code]).map((z) => {
                const hist = ZONE_HISTORY[z.code];
                const current = hist[hist.length - 1]?.utilization ?? 0;
                const prev = hist[hist.length - 2]?.utilization ?? 0;
                const delta = current - prev;

                return (
                  <div
                    key={z.code}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedZone === z.code ? "bg-[#E5521A]/10" : "hover:bg-[#0F1A30]"
                    }`}
                    onClick={() => setSelectedZone(z.code)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: statusColor(z.status) }} />
                      <span className="text-[11px] font-bold text-[#E8EDF8]">Zone {z.code}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-1.5 bg-[#0F1A30] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${current}%`, background: statusColor(z.status) }}
                        />
                      </div>
                      <span className="text-[10px] font-bold w-8 text-right" style={{ color: statusColor(z.status) }}>
                        {current}%
                      </span>
                      <span
                        className="text-[9px] font-bold w-8 text-right"
                        style={{ color: delta > 0 ? "#F5A623" : delta < 0 ? "#22D3A1" : "#4E6090" }}
                      >
                        {delta >= 0 ? "+" : ""}{delta}
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
