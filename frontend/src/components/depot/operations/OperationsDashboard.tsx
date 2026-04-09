"use client";

import { DEPOTS, INCIDENTS, SEV_COL, THROUGHPUT, DAYS } from "@/lib/depot-data";

const KPI_DATA = [
  { label: "Bag Count Accuracy", value: "99.8%", trend: "▲ +12.5% vs manual", trendColor: "#22D3A1", glow: "#22D3A1" },
  { label: "FIFO Compliance", value: "96.4%", trend: "▲ +8.2% MoM", trendColor: "#22D3A1", glow: "#22D3A1" },
  { label: "Avg Loading Time", value: "22 min", trend: "▲ 35% faster", trendColor: "#22D3A1", glow: "#5B9BF5" },
  { label: "Depot Occupancy", value: "84.5%", trend: "Optimal range", trendColor: "#8A9BBF", glow: "#E5521A" },
  { label: "Throughput", value: "850 t/day", trend: "▲ +15% capacity", trendColor: "#22D3A1", glow: "#22D3A1" },
  { label: "Loss Prevention", value: "₹42K/mo", trend: "▲ +₹8K gain", trendColor: "#22D3A1", glow: "#F5A623" },
];

const HEALTH_METRICS = [
  { label: "Active Trucks", value: "8 / 15", pct: 53, color: "#5B9BF5" },
  { label: "Active Cameras", value: "12 / 14", pct: 86, color: "#22D3A1" },
  { label: "Depot Health", value: "94%", pct: 94, color: "#22D3A1" },
  { label: "Cluster Utilization", value: "91.2%", pct: 91.2, color: "#E5521A" },
];

export default function OperationsDashboard() {
  const depot = DEPOTS[0];
  const activeAlerts = INCIDENTS.filter((i) => i.status !== "resolved").slice(0, 4);
  const maxThroughput = Math.max(...THROUGHPUT);

  return (
    <div className="p-5">
      {/* Hero Section */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#162040] to-[#1a0f05] border border-[#1E2F50] p-6 mb-5 grid grid-cols-1 lg:grid-cols-2 gap-5 items-center">
        <div>
          <div className="text-[11px] text-[#E5521A] font-bold tracking-[0.1em] uppercase mb-1.5">
            Live Operations
          </div>
          <h2 className="text-xl font-extrabold text-[#E8EDF8] mb-1" style={{ fontFamily: "'Syne', sans-serif" }}>
            {depot.name}
          </h2>
          <p className="text-[11px] text-[#8A9BBF] mb-5">
            {depot.loc} · Live sync active
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { v: `${depot.health}%`, l: "Depot Health", c: "#E5521A" },
              { v: `${depot.trucks}/15`, l: "Active Trucks", c: "#22D3A1" },
              { v: `${depot.cams}/14`, l: "Active Cameras", c: "#5B9BF5" },
              { v: "91.2%", l: "Cluster Util.", c: "#F5A623" },
            ].map((s) => (
              <div key={s.l} className="bg-[#E5521A]/6 border border-[#E5521A]/15 rounded-xl p-3.5">
                <div className="text-2xl font-extrabold" style={{ color: s.c, fontFamily: "'Syne', sans-serif" }}>
                  {s.v}
                </div>
                <div className="text-[10px] text-[#8A9BBF] mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Animated hero visual placeholder */}
        <div className="relative h-[200px] flex items-center justify-center">
          <div className="absolute w-24 h-24 rounded-full bg-[#E5521A]/20 animate-ping" style={{ animationDuration: "3s" }} />
          <div className="absolute w-32 h-32 rounded-full border-2 border-[#E5521A]/30 animate-spin" style={{ animationDuration: "8s" }} />
          <div className="absolute w-20 h-20 rounded-full border border-[#E5521A]/50 animate-pulse" />
          <div className="relative text-[#E5521A] font-extrabold text-lg">⚡</div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {KPI_DATA.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 relative overflow-hidden transition-all hover:border-[#E5521A]/30 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(229,82,26,0.1)] group"
          >
            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full opacity-[0.06]" style={{ background: kpi.glow }} />
            <div className="text-[9px] font-bold tracking-[0.08em] text-[#4E6090] uppercase mb-2">
              {kpi.label}
            </div>
            <div className="text-[28px] font-extrabold leading-none" style={{ color: kpi.glow, fontFamily: "'Syne', sans-serif" }}>
              {kpi.value}
            </div>
            <div className="text-[10px] mt-1" style={{ color: kpi.trendColor }}>
              {kpi.trend}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#E5521A] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>

      {/* Glow divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#E5521A]/40 to-transparent mb-5" />

      {/* Chart + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-5">
        {/* Throughput chart */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-3.5" style={{ fontFamily: "'Syne', sans-serif" }}>
            <span className="text-[13px] font-bold text-[#E8EDF8]">Daily Throughput (Bags)</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#E5521A]/10 text-[#E5521A] border border-[#E5521A]/20">
              THIS WEEK
            </span>
          </div>
          <div className="flex items-end gap-2 h-[170px] px-2">
            {THROUGHPUT.map((v, i) => {
              const h = Math.round((v / maxThroughput) * 150);
              const isHighlight = i === 4;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[8px] text-[#8A9BBF]">{(v / 1000).toFixed(1)}k</span>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: h,
                      background: isHighlight
                        ? "linear-gradient(to bottom, #FF7A42, rgba(255,122,66,0.4))"
                        : "linear-gradient(to bottom, rgba(229,82,26,0.9), rgba(229,82,26,0.3))",
                      filter: isHighlight ? "drop-shadow(0 0 4px rgba(229,82,26,0.5))" : undefined,
                    }}
                  />
                  <span className="text-[9px] text-[#4E6090]">{DAYS[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Alerts */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-3.5" style={{ fontFamily: "'Syne', sans-serif" }}>
            <span className="text-[13px] font-bold text-[#E8EDF8]">Live Alerts</span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F5A623]/12 text-[#F5A623] border border-[#F5A623]/25">
              {activeAlerts.length} Active
            </span>
          </div>
          <div className="space-y-2">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-2.5 rounded-[10px] bg-[#0F1A30] hover:bg-[#E5521A]/5 transition-colors"
                style={{ borderLeft: `3px solid ${SEV_COL[alert.sev]}` }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold" style={{ color: SEV_COL[alert.sev] }}>
                    {alert.type}
                  </span>
                  <span className="text-[9px] text-[#4E6090]">{alert.t}</span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-[10px] text-[#8A9BBF]">{alert.loc}</span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                    style={{
                      background: `${SEV_COL[alert.sev]}22`,
                      color: SEV_COL[alert.sev],
                      borderColor: `${SEV_COL[alert.sev]}33`,
                    }}
                  >
                    {alert.sev}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Health Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {HEALTH_METRICS.map((m) => (
          <div key={m.label} className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4">
            <div className="flex justify-between mb-2 text-[11px]">
              <span className="text-[#8A9BBF]">{m.label}</span>
              <span className="font-bold text-[#E8EDF8]">{m.value}</span>
            </div>
            <div className="w-full h-1 bg-[#1E2F50] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-600"
                style={{ width: `${m.pct}%`, background: m.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
