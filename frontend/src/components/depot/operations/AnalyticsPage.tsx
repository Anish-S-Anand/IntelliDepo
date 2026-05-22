"use client";

import { useState } from "react";

const ANALYTICS_KPI = [
  { label: "Supervisor Efficiency", value: "94", unit: "score", delta: "▲ +18% task completion", color: "#22D3A1" },
  { label: "Loadmen Productivity", value: "420", unit: "bags/hr", delta: "▲ +12% output", color: "#22D3A1" },
  { label: "Truck Dwell Time", value: "35", unit: "min", delta: "▲ -25% faster turns", color: "#22D3A1" },
  { label: "Incident Resolution", value: "1.2", unit: "hrs", delta: "▲ -60% response time", color: "#22D3A1" },
  { label: "Loss Prevention", value: "₹42K", unit: "/mo", delta: "▲ +₹8K monthly gain", color: "#22D3A1" },
  { label: "Inventory Accuracy", value: "99.9", unit: "%", delta: "▲ +5.2%", color: "#22D3A1" },
];

const EFFICIENCY_DATA = [
  { day: "Mon", y: 67 },
  { day: "Tue", y: 49 },
  { day: "Wed", y: 40 },
  { day: "Thu", y: 58 },
  { day: "Fri", y: 22 },
  { day: "Sat", y: 40 },
  { day: "Sun", y: 31 },
];

const INSIGHTS = [
  { title: "Efficiency Gain Forecast", detail: "Predicted 15% improvement in truck turnaround next week based on new routing algorithm and lane optimization.", color: "#22D3A1" },
  { title: "Inventory Risk Alert", detail: "Stockout risk for OPC Cement 43 in Zone C predicted within 48 hours. Reorder recommended immediately.", color: "#F04A4A" },
  { title: "Maintenance Schedule", detail: "Conveyor Belt 3 showing irregular vibration patterns. Preventive maintenance recommended before next shift.", color: "#F5A623" },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState("daily");

  const maxY = Math.max(...EFFICIENCY_DATA.map((d) => d.y));
  const svgW = 560;
  const svgH = 170;
  const gap = (svgW - 40) / 7;

  const points = EFFICIENCY_DATA.map((d, i) => ({
    x: 40 + i * gap,
    y: d.y,
    day: d.day,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const polygon = polyline + ` ${points[points.length - 1].x},148 40,148`;

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
            Analytics & Insights
          </h1>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            KPI trends, predictive AI, efficiency benchmarking
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {["daily", "weekly", "monthly"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold capitalize transition-colors ${
                range === r
                  ? "border-[var(--accent)] theme-bg-accent-subtle theme-text-nav-active"
                  : "border-[#1E2F50] text-[#8A9BBF] hover:border-[#2A3F68] hover:text-[#E8EDF8]"
              }`}
            >
              {r}
            </button>
          ))}
          <button className="px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[10px] font-bold hover:theme-text-nav-active hover:border-[var(--accent-border)] transition">
            ↓ PDF
          </button>
          <button className="px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[10px] font-bold hover:theme-text-nav-active hover:border-[var(--accent-border)] transition">
            ↓ CSV
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {ANALYTICS_KPI.map((k) => (
          <div key={k.label} className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[15px]">
            <div className="text-[9px] text-[#4E6090] font-bold uppercase tracking-[0.07em] mb-1.5">{k.label}</div>
            <div className="text-[21px] font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
              {k.value} <span className="text-[13px] text-[#8A9BBF] font-normal">{k.unit}</span>
            </div>
            <div className="text-[11px] mt-1" style={{ color: k.color }}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Efficiency Chart */}
      <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px] mb-4">
        <div className="text-[13px] font-bold text-[#E8EDF8] mb-3.5" style={{ fontFamily: "'Syne', sans-serif" }}>
          Efficiency Score Trend (7 Days)
        </div>
        <svg width="100%" height="170" viewBox={`0 0 ${svgW} ${svgH}`}>
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="40" y1="10" x2="40" y2="148" stroke="#1E2F50" strokeWidth="1" />
          <line x1="40" y1="148" x2="550" y2="148" stroke="#1E2F50" strokeWidth="1" />
          <polygon points={polygon} fill="url(#lineGrad)" />
          <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={i === 4 ? 5 : 4} fill={i === 4 ? "#FF7A42" : "var(--accent)"} stroke="#14203A" strokeWidth="2" />
              <text x={p.x} y="163" fontSize="9" fill="#4E6090" textAnchor="middle">{p.day}</text>
            </g>
          ))}
          <text x="35" y="70" fontSize="8" fill="#4E6090" textAnchor="end">91%</text>
          <text x="35" y="25" fontSize="8" fill="#4E6090" textAnchor="end">96%</text>
        </svg>
      </div>

      {/* AI Insights */}
      <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
        <div className="flex justify-between items-center mb-3.5" style={{ fontFamily: "'Syne', sans-serif" }}>
          <span className="text-[13px] font-bold text-[#E8EDF8]">AI Predictive Insights</span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#5B9BF5]/10 text-[#5B9BF5] border border-[#5B9BF5]/20">
            AI Generated
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {INSIGHTS.map((ins) => (
            <div key={ins.title} className="p-3.5 rounded-xl bg-[#0F1A30]" style={{ borderLeft: `3px solid ${ins.color}` }}>
              <div className="text-[12px] font-bold mb-1.5" style={{ color: ins.color }}>{ins.title}</div>
              <div className="text-[11px] text-[#8A9BBF] leading-relaxed">{ins.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
