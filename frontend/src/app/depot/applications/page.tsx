"use client";

import { useRouter } from "next/navigation";
import { Eye, Users, Radio, Plug, BarChart3, Shield, Brain, ArrowUpRight } from "lucide-react";

const layers = [
  { layer: 1, name: "INTELLIVISION\u2122", subtitle: "Computer Vision & Physical Intelligence", description: "YOLO-class object detection, automated counting, cluster mapping, FIFO/LIFO sequencing, LPR gate control, and perimeter security.", icon: Eye, slug: "intellivision", modules: 6 },
  { layer: 2, name: "INTELLIOPS\u2122", subtitle: "Workforce & Space Management", description: "Smart task assignment, SOP checklists, cluster allocation, space optimization, and exception handling.", icon: Users, slug: "intelliops", modules: 5 },
  { layer: 3, name: "INTELLICOMMAND\u2122", subtitle: "Real-Time Control & SLA", description: "Live monitoring, SLA breach prediction, fleet & yard visibility, and incident escalation workflows.", icon: Radio, slug: "intellicommand", modules: 4 },
  { layer: 4, name: "INTELLICONNECT\u2122", subtitle: "ERP, IoT & API Integration", description: "Bidirectional ERP sync, MQTT/IoT broker, weather feeds, and API health monitoring.", icon: Plug, slug: "intelliconnect", modules: 3 },
  { layer: 5, name: "ANALYTICS & INSIGHTS", subtitle: "KPIs & Forecasting", description: "Operational KPIs, time-series forecasting, anomaly detection, and executive dashboards.", icon: BarChart3, slug: "analytics", modules: 4 },
  { layer: 6, name: "INDUSTRY / RISK", subtitle: "Compliance & Governance", description: "Regulatory compliance monitoring, batch/expiry tracking, RBAC, and immutable audit logs.", icon: Shield, slug: "risk", modules: 3 },
  { layer: 7, name: "DEPOT AI BRAIN\u2122", subtitle: "Cross-Module Orchestration", description: "AI orchestrator across all layers with scenario simulation and revenue leakage detection.", icon: Brain, slug: "ai-brain", modules: 3 },
];

const leftColumn = layers.slice(0, 4);
const rightColumn = layers.slice(4, 7);

function LayerCard({ l }: { l: typeof layers[0] }) {
  const router = useRouter();
  const Icon = l.icon;

  return (
    <button
      onClick={() => router.push(`/depot/applications/${l.slug}`)}
      className="group flex items-center gap-6 rounded-3xl border border-white/80 bg-white/50 px-7 py-5 text-left backdrop-blur-xl shadow-[0_8px_32px_rgba(26,107,74,0.06)] transition-all duration-400 hover:bg-white/75 hover:shadow-[0_16px_48px_rgba(26,107,74,0.12)] hover:-translate-y-0.5"
    >
      {/* Icon */}
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#1a6b4a]/[0.07] transition-colors duration-300 group-hover:bg-[#1a6b4a]/[0.12]">
        <Icon className="h-7 w-7 text-[#1a6b4a]/60 transition-colors duration-300 group-hover:text-[#1a6b4a]" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[1.1rem] font-semibold tracking-[-0.02em] text-[#0d1b3d]">
            {l.name}
          </h3>
          <span className="shrink-0 text-[11px] font-semibold text-slate-400">
            {l.modules} modules
          </span>
        </div>
        <p className="mt-1 text-[13px] font-medium text-[#1a6b4a]/70">{l.subtitle}</p>
        <p className="mt-2 text-[12.5px] leading-[1.7] text-slate-400">{l.description}</p>
      </div>

      {/* Arrow */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/60 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:bg-white">
        <ArrowUpRight className="h-4 w-4 text-[#1a6b4a]" />
      </div>
    </button>
  );
}

export default function DepotApplicationsPage() {
  return (
    <div className="h-screen overflow-hidden bg-[linear-gradient(180deg,#6BCB9E_0%,#a8e6cf_35%,#edf9f2_100%)]">
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-8rem] top-10 h-80 w-80 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute right-[-6rem] top-32 h-96 w-96 rounded-full bg-emerald-50/15 blur-3xl" />
      </div>

      <div className="relative mx-auto flex h-full max-w-[1400px] flex-col px-10 py-6">
        {/* Header */}
        <div className="text-center mb-4 shrink-0">
          <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-[#0d1b3d] sm:text-[2.2rem]">
            Choose your layer.
          </h1>
          <p className="mt-1 text-sm text-slate-500">Explore each architectural module.</p>
        </div>

        {/* Two-column layout: 4 left, 3 right — fills remaining height */}
        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left — 4 cards */}
          <div className="flex flex-col gap-3">
            {leftColumn.map((l) => (
              <LayerCard key={l.layer} l={l} />
            ))}
          </div>

          {/* Right — 3 cards */}
          <div className="flex flex-col justify-start gap-3">
            {rightColumn.map((l) => (
              <LayerCard key={l.layer} l={l} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
