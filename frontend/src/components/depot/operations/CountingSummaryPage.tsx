"use client";

import { useState } from "react";
import {
  COUNTING_SESSIONS,
  BATCH_TALLIES,
  COUNT_TIMESERIES,
  reconciliationColor,
  type CountingSession,
} from "@/lib/depot-data";
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Download,
  Search,
  Filter,
  ChevronDown,
  Eye,
  BarChart3,
  Clock,
  Target,
} from "lucide-react";

const STATUS_LABEL: Record<string, string> = { matched: "MATCHED", mismatch: "MISMATCH", pending: "PENDING" };

export default function CountingSummaryPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<CountingSession | null>(null);

  const filtered = COUNTING_SESSIONS.filter((s) => {
    const matchSearch =
      s.manifestCode.toLowerCase().includes(search.toLowerCase()) ||
      s.vehicleNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalExpected = COUNTING_SESSIONS.reduce((a, s) => a + s.totalExpected, 0);
  const totalCounted = COUNTING_SESSIONS.reduce((a, s) => a + s.totalCounted, 0);
  const totalDisc = totalCounted - totalExpected;
  const matchedCount = COUNTING_SESSIONS.filter((s) => s.status === "matched").length;
  const mismatchCount = COUNTING_SESSIONS.filter((s) => s.status === "mismatch").length;
  const avgConf = (COUNTING_SESSIONS.reduce((a, s) => a + s.confidenceAvg, 0) / COUNTING_SESSIONS.length).toFixed(1);

  const maxCumulative = Math.max(...COUNT_TIMESERIES.map((t) => t.cumulative));

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[11px] text-[#E5521A] font-bold tracking-[0.1em] uppercase mb-1">
            Automated Counting
          </div>
          <h2 className="text-xl font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
            Counting Summary
          </h2>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            DeepSORT MOT tracking · Batch tallies · Manifest cross-verification
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#E5521A]/10 border border-[#E5521A]/25 rounded-xl text-[#E5521A] text-[12px] font-bold hover:bg-[#E5521A]/20 transition-colors">
          <Download className="w-3.5 h-3.5" />
          Export Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {[
          { label: "Total Expected", value: totalExpected.toLocaleString(), icon: Target, color: "#5B9BF5" },
          { label: "Total Counted", value: totalCounted.toLocaleString(), icon: Package, color: "#22D3A1" },
          { label: "Discrepancy", value: `${totalDisc >= 0 ? "+" : ""}${totalDisc}`, icon: AlertTriangle, color: totalDisc === 0 ? "#22D3A1" : "#F04A4A" },
          { label: "Matched", value: `${matchedCount}/${COUNTING_SESSIONS.length}`, icon: CheckCircle2, color: "#22D3A1" },
          { label: "Mismatches", value: mismatchCount.toString(), icon: AlertTriangle, color: mismatchCount > 0 ? "#F04A4A" : "#22D3A1" },
          { label: "Avg Confidence", value: `${avgConf}%`, icon: TrendingUp, color: "#5B9BF5" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 relative overflow-hidden hover:border-[#E5521A]/30 transition-all group"
          >
            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full opacity-[0.06]" style={{ background: kpi.color }} />
            <kpi.icon className="w-4 h-4 mb-2" style={{ color: kpi.color }} />
            <div className="text-[9px] font-bold tracking-[0.08em] text-[#4E6090] uppercase mb-1">{kpi.label}</div>
            <div className="text-[24px] font-extrabold leading-none" style={{ color: kpi.color, fontFamily: "'Syne', sans-serif" }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Glow divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#E5521A]/40 to-transparent mb-5" />

      {/* Count Time-Series Chart + Batch Tallies */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-5">
        {/* Time-Series Chart */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#E5521A]" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                Cumulative Count — Today
              </span>
            </div>
            <div className="flex gap-2">
              {[
                { label: "Bags", color: "#5B9BF5" },
                { label: "Boxes", color: "#E5521A" },
                { label: "Cumulative", color: "#22D3A1" },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1 text-[9px] text-[#8A9BBF]">
                  <span className="w-2 h-2 rounded-sm" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          {/* Chart */}
          <div className="relative h-[200px]">
            {/* Y-axis guide lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <div
                key={pct}
                className="absolute left-0 right-0 border-t border-[#1E2F50]/50"
                style={{ bottom: `${pct * 100}%` }}
              >
                <span className="absolute -left-1 -top-2 text-[8px] text-[#4E6090]">
                  {Math.round(maxCumulative * pct).toLocaleString()}
                </span>
              </div>
            ))}
            {/* Bars */}
            <div className="flex items-end gap-1.5 h-full pl-8">
              {COUNT_TIMESERIES.map((t, i) => {
                const bagH = maxCumulative > 0 ? (t.bags / maxCumulative) * 100 : 0;
                const boxH = maxCumulative > 0 ? (t.boxes / maxCumulative) * 100 : 0;
                const cumH = maxCumulative > 0 ? (t.cumulative / maxCumulative) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 relative group/bar">
                    {/* Cumulative line dot */}
                    <div
                      className="absolute w-2 h-2 rounded-full bg-[#22D3A1] z-10 border border-[#0A0E1A]"
                      style={{ bottom: `${cumH}%`, left: "50%", transform: "translateX(-50%)" }}
                    />
                    {/* Stacked bars */}
                    <div className="w-full flex flex-col-reverse items-center" style={{ height: `${bagH + boxH}%` }}>
                      <div className="w-full rounded-b" style={{ height: `${(bagH / (bagH + boxH || 1)) * 100}%`, background: "rgba(91,155,245,0.7)", minHeight: t.bags > 0 ? 2 : 0 }} />
                      <div className="w-full rounded-t" style={{ height: `${(boxH / (bagH + boxH || 1)) * 100}%`, background: "rgba(229,82,26,0.7)", minHeight: t.boxes > 0 ? 2 : 0 }} />
                    </div>
                    <span className="text-[8px] text-[#4E6090] mt-auto">{t.time}</span>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover/bar:block bg-[#0D1526] border border-[#1E2F50] rounded-lg p-2 text-[9px] text-[#E8EDF8] z-20 whitespace-nowrap">
                      <div>Bags: {t.bags} · Boxes: {t.boxes}</div>
                      <div className="text-[#22D3A1]">Cumulative: {t.cumulative.toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Batch Tallies */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
              Batch Tallies
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#5B9BF5]/12 text-[#5B9BF5] border border-[#5B9BF5]/25">
              {BATCH_TALLIES.length} Batches
            </span>
          </div>
          <div className="space-y-2">
            {BATCH_TALLIES.map((b) => (
              <div
                key={b.id}
                className="p-2.5 rounded-[10px] bg-[#0F1A30] hover:bg-[#E5521A]/5 transition-colors"
                style={{ borderLeft: `3px solid ${reconciliationColor(b.status)}` }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-[#E8EDF8]">{b.product}</span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                    style={{
                      background: `${reconciliationColor(b.status)}22`,
                      color: reconciliationColor(b.status),
                      borderColor: `${reconciliationColor(b.status)}33`,
                    }}
                  >
                    {b.variance >= 0 ? "+" : ""}{b.variance} ({b.variancePct >= 0 ? "+" : ""}{b.variancePct}%)
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] text-[#8A9BBF]">{b.batchCode}</span>
                  <span className="text-[9px] text-[#4E6090]">{b.expected} → {b.counted}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Session Table */}
      <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#E5521A]" />
            <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
              Counting Sessions
            </span>
          </div>
          <div className="flex gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4E6090]" />
              <input
                type="text"
                placeholder="Search manifest or vehicle..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#0F1A30] border border-[#1E2F50] rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-[#E8EDF8] placeholder:text-[#4E6090] w-[200px] focus:outline-none focus:border-[#E5521A]/40"
              />
            </div>
            {/* Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-[#0F1A30] border border-[#1E2F50] rounded-lg px-3 py-1.5 pr-7 text-[11px] text-[#E8EDF8] focus:outline-none focus:border-[#E5521A]/40 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="matched">Matched</option>
                <option value="mismatch">Mismatch</option>
                <option value="pending">Pending</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#4E6090] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-[#4E6090] text-[9px] font-bold tracking-[0.06em] uppercase border-b border-[#1E2F50]">
                <th className="pb-2.5 pr-3">Manifest</th>
                <th className="pb-2.5 pr-3">Vehicle</th>
                <th className="pb-2.5 pr-3">Zone</th>
                <th className="pb-2.5 pr-3 text-right">Expected</th>
                <th className="pb-2.5 pr-3 text-right">Counted</th>
                <th className="pb-2.5 pr-3 text-right">Variance</th>
                <th className="pb-2.5 pr-3 text-right">Confidence</th>
                <th className="pb-2.5 pr-3">Status</th>
                <th className="pb-2.5 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const col = reconciliationColor(s.status);
                return (
                  <tr
                    key={s.id}
                    className="border-b border-[#1E2F50]/50 hover:bg-[#E5521A]/5 transition-colors cursor-pointer"
                    onClick={() => setSelectedSession(selectedSession?.id === s.id ? null : s)}
                  >
                    <td className="py-2.5 pr-3 font-bold text-[#E8EDF8]">{s.manifestCode}</td>
                    <td className="py-2.5 pr-3 text-[#8A9BBF]">{s.vehicleNumber}</td>
                    <td className="py-2.5 pr-3 text-[#8A9BBF]">{s.zone}</td>
                    <td className="py-2.5 pr-3 text-right text-[#8A9BBF]">{s.totalExpected}</td>
                    <td className="py-2.5 pr-3 text-right text-[#E8EDF8] font-bold">{s.totalCounted}</td>
                    <td className="py-2.5 pr-3 text-right font-bold" style={{ color: col }}>
                      {s.discrepancy >= 0 ? "+" : ""}{s.discrepancy}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-[#5B9BF5]">{s.confidenceAvg}%</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                        style={{
                          background: `${col}22`,
                          color: col,
                          borderColor: `${col}33`,
                        }}
                      >
                        {STATUS_LABEL[s.status]}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-[#4E6090]">{s.timestamp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expanded detail */}
        {selectedSession && (
          <div className="mt-4 p-4 bg-[#0F1A30] rounded-xl border border-[#1E2F50]">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-[13px] font-bold text-[#E8EDF8]">{selectedSession.manifestCode} — Detail</div>
                <div className="text-[10px] text-[#8A9BBF] mt-0.5">Camera: {selectedSession.camera} · {selectedSession.zone}</div>
              </div>
              <span
                className="text-[10px] font-bold px-2 py-1 rounded-full border"
                style={{
                  background: `${reconciliationColor(selectedSession.status)}15`,
                  color: reconciliationColor(selectedSession.status),
                  borderColor: `${reconciliationColor(selectedSession.status)}30`,
                }}
              >
                {STATUS_LABEL[selectedSession.status]}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { l: "Bags", exp: selectedSession.expectedBags, cnt: selectedSession.countedBags },
                { l: "Boxes", exp: selectedSession.expectedBoxes, cnt: selectedSession.countedBoxes },
                { l: "Total", exp: selectedSession.totalExpected, cnt: selectedSession.totalCounted },
                { l: "Discrepancy", exp: null, cnt: null, val: selectedSession.discrepancy },
              ].map((d) => (
                <div key={d.l} className="bg-[#14203A] rounded-lg p-3 border border-[#1E2F50]">
                  <div className="text-[9px] text-[#4E6090] font-bold uppercase tracking-wide mb-1">{d.l}</div>
                  {d.exp !== null ? (
                    <div className="flex items-end gap-1">
                      <span className="text-[18px] font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>{d.cnt}</span>
                      <span className="text-[10px] text-[#4E6090] mb-0.5">/ {d.exp}</span>
                    </div>
                  ) : (
                    <span
                      className="text-[18px] font-extrabold"
                      style={{ color: reconciliationColor(selectedSession.status), fontFamily: "'Syne', sans-serif" }}
                    >
                      {d.val! >= 0 ? "+" : ""}{d.val}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
