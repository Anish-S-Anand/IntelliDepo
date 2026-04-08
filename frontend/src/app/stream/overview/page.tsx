"use client";

import { LineChart } from "lucide-react";

const stats = [
  { label: "Financial Variables Tracked", value: "40+", sub: "Revenue, COGS, OpEx, EBITDA & more" },
  { label: "Peer Companies", value: "8", sub: "Industry benchmark dataset" },
  { label: "AI Models", value: "3", sub: "LLM routing with fallback" },
  { label: "Client Portfolio", value: "15", sub: "Revenue concentration analysis" },
];

export default function StreamOverviewPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#87D3D4_0%,#b8e7e7_40%,#edf9f8_100%)] px-10 py-14">
      <div className="h-full w-full">
        <div className="inline-flex rounded-full border border-white/70 bg-white/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0b5675] backdrop-blur-sm">
          Overview
        </div>

        <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <h1 className="text-[2.6rem] font-black leading-tight tracking-[-0.04em] text-[#0d1b3d] lg:text-[3.2rem]">
              A Suite of AI Applications<br />
              <span className="text-[#0b6a8e]">Designed for the Modern CFO.</span>
            </h1>
            <p className="mt-5 text-[1.05rem] leading-8 text-slate-600">
              Intelli Stream is Fidelis's AI-native financial intelligence suite built for CFOs, treasury teams, and finance leaders who need more than dashboards — they need decisions.
            </p>
            <p className="mt-4 text-[1.05rem] leading-8 text-slate-600">
              It combines real-time scenario modelling, competitive benchmarking, earnings intelligence, and revenue risk analysis into a single, premium command surface. Every insight is explainable, every signal is actionable.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {["AI-Native", "CFO-Ready", "Real-Time", "Explainable AI"].map((tag) => (
                <span key={tag} className="rounded-full border border-[#0b6a8e]/20 bg-white/60 px-4 py-1.5 text-sm font-semibold text-[#0b5675] backdrop-blur-sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/80 bg-white/50 p-8 shadow-[0_20px_60px_rgba(67,107,153,0.12)] backdrop-blur-xl">
            <LineChart className="h-10 w-10 text-[#0b6a8e]" />
            <h3 className="mt-4 text-xl font-bold text-[#0d1b3d]">Built for the modern CFO</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Intelli Stream surfaces the signals that matter — from what-if scenarios to peer benchmarks to earnings sentiment — so finance leaders can move from data to decision in minutes, not days.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/80 bg-white/60 px-4 py-4">
                  <p className="text-2xl font-black text-[#0b5675]">{s.value}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">{s.label}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
