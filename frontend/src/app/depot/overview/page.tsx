"use client";

import { Warehouse } from "lucide-react";

const stats = [
  { label: "Architectural Layers", value: "7", sub: "Vision, Ops, Command, Connect, Analytics, Risk, AI Brain" },
  { label: "Sub-Modules", value: "28", sub: "End-to-end depot coverage" },
  { label: "AI Agents", value: "6+", sub: "Detection, SLA, optimization & more" },
  { label: "Integrations", value: "10+", sub: "ERP, IoT, weather, fleet GPS" },
];

export default function DepotOverviewPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#6BCB9E_0%,#a8e6cf_40%,#edf9f2_100%)] px-10 py-14">
      <div className="h-full w-full">
        <div className="inline-flex rounded-full border border-white/70 bg-white/50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#1a6b4a] backdrop-blur-sm">
          Overview
        </div>

        <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:items-start">
          <div>
            <h1 className="text-[2.6rem] font-black leading-tight tracking-[-0.04em] text-[#0d1b3d] lg:text-[3.2rem]">
              Intelligent Warehouse Operations<br />
              <span className="text-[#1a6b4a]">Powered by AI.</span>
            </h1>
            <p className="mt-5 text-[1.05rem] leading-8 text-slate-600">
              Intelli Depot is Fidelis&apos;s AI-native warehouse management platform built for depot managers, operations teams, and logistics leaders who need more than visibility — they need autonomous optimization.
            </p>
            <p className="mt-4 text-[1.05rem] leading-8 text-slate-600">
              It combines computer vision, real-time command & control, predictive analytics, and an AI orchestration brain into a single operational surface. Every detection is verified, every SLA is tracked, every decision is explainable.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {["Computer Vision", "Real-Time Ops", "AI Agents", "SLA Tracking", "ERP Sync"].map((tag) => (
                <span key={tag} className="rounded-full border border-[#1a6b4a]/20 bg-white/60 px-4 py-1.5 text-sm font-semibold text-[#1a6b4a] backdrop-blur-sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/80 bg-white/50 p-8 shadow-[0_20px_60px_rgba(67,153,107,0.12)] backdrop-blur-xl">
            <Warehouse className="h-10 w-10 text-[#1a6b4a]" />
            <h3 className="mt-4 text-xl font-bold text-[#0d1b3d]">Built for the modern depot</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Intelli Depot surfaces the signals that matter — from bag/box detection to SLA breach prediction to revenue leakage — so operations leaders can move from reactive firefighting to proactive optimization.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              {stats.map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/80 bg-white/60 px-4 py-4">
                  <p className="text-2xl font-black text-[#1a6b4a]">{s.value}</p>
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
