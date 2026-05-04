"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Activity, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface LayerModule {
  name: string;
  description: string;
  status: "active" | "syncing" | "pending";
  kpis: { label: string; value: string }[];
}

export interface LayerConfig {
  layer: number;
  name: string;
  subtitle: string;
  color: string;
  icon: LucideIcon;
  modules: LayerModule[];
}

export default function LayerDashboard({
  config,
  children,
}: {
  config: LayerConfig;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const Icon = config.icon;

  const statusColors = {
    active: { bg: "#05966915", text: "#059669", label: "Active" },
    syncing: { bg: "#d9770615", text: "#d97706", label: "Syncing" },
    pending: { bg: "#6b728015", text: "#6b7280", label: "Pending" },
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8] px-8 py-8">
      {/* Back + header */}
      <button
        onClick={() => router.push("/depot/applications")}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Applications
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: config.color + "18" }}
        >
          <Icon className="h-7 w-7" style={{ color: config.color }} />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Layer {config.layer}
          </span>
          <h1 className="text-2xl font-bold text-[#0d1b3d]">{config.name}</h1>
          <p className="text-sm text-slate-500">{config.subtitle}</p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" style={{ color: config.color }} />
            <span className="text-xs text-slate-500">Modules</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-[#0d1b3d]">{config.modules.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-slate-500">Active</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {config.modules.filter((m) => m.status === "active").length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-slate-500">Syncing</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {config.modules.filter((m) => m.status === "syncing").length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-500">Pending</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-500">
            {config.modules.filter((m) => m.status === "pending").length}
          </p>
        </div>
      </div>

      {children}

      {/* Module cards */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {config.modules.map((mod) => {
          const st = statusColors[mod.status];
          return (
            <div
              key={mod.name}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#0d1b3d]">{mod.name}</h3>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                  style={{ backgroundColor: st.bg, color: st.text }}
                >
                  {st.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-5 mb-4">{mod.description}</p>
              <div className="grid grid-cols-2 gap-2">
                {mod.kpis.map((kpi) => (
                  <div
                    key={kpi.label}
                    className="rounded-lg px-3 py-2"
                    style={{ backgroundColor: config.color + "08" }}
                  >
                    <p className="text-lg font-bold" style={{ color: config.color }}>
                      {kpi.value}
                    </p>
                    <p className="text-[10px] text-slate-500">{kpi.label}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
