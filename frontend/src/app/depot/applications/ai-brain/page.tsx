"use client";

import { useEffect, useState } from "react";
import { Activity, AlertCircle, Brain, LockKeyhole, RefreshCw, ServerCrash } from "lucide-react";
import LayerDashboard from "@/components/depot/LayerDashboard";
import type { LayerConfig } from "@/components/depot/LayerDashboard";
import {
  getDayOneTwoProgressSnapshot,
  type DayOneTwoProgressSnapshot,
  type IntegrationState,
} from "@/services/depotProgress";

const config: LayerConfig = {
  layer: 7,
  name: "Depot AI Brain\u2122",
  subtitle: "Cross-Module Orchestration",
  color: "#0d1b3d",
  icon: Brain,
  modules: [
    {
      name: "Cross-Module Optimization",
      description: "AI orchestrator consuming signals from all 6 layers with multi-objective optimization solver.",
      status: "active",
      kpis: [
        { label: "Recommendations", value: "14" },
        { label: "Accepted", value: "9" },
        { label: "Impact Score", value: "87%" },
        { label: "Layers Connected", value: "6" },
      ],
    },
    {
      name: "Scenario Simulation",
      description: "What-if scenario engine with parameter configuration, simulation result storage, and baseline comparison.",
      status: "active",
      kpis: [
        { label: "Simulations Run", value: "23" },
        { label: "Saved Scenarios", value: "8" },
        { label: "Best Outcome", value: "+12%" },
        { label: "Avg Runtime", value: "4.2s" },
      ],
    },
    {
      name: "Revenue Leakage Detection",
      description: "Leakage pattern detection for SLA penalties, shrinkage, and billing discrepancies with financial impact quantification.",
      status: "active",
      kpis: [
        { label: "Leakages Found", value: "6" },
        { label: "Total Impact", value: "\u20b94.2L" },
        { label: "Recovered", value: "\u20b92.8L" },
        { label: "Categories", value: "3" },
      ],
    },
  ],
};

const stateTheme: Record<IntegrationState, { label: string; icon: typeof Activity; chip: string; tone: string }> = {
  live: {
    label: "Live",
    icon: Activity,
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    tone: "text-emerald-700",
  },
  auth: {
    label: "Auth Ready",
    icon: LockKeyhole,
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    tone: "text-amber-700",
  },
  offline: {
    label: "Needs Attention",
    icon: ServerCrash,
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    tone: "text-rose-700",
  },
};

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return "Not refreshed yet";
  }

  return new Date(timestamp).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AIBrainPage() {
  const [snapshot, setSnapshot] = useState<DayOneTwoProgressSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSnapshot(isRefresh = false) {
      if (!active) {
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const nextSnapshot = await getDayOneTwoProgressSnapshot();
        if (!active) {
          return;
        }
        setSnapshot(nextSnapshot);
        setError(null);
      } catch {
        if (!active) {
          return;
        }
        setError("Unable to load Day 1-2 backend progress right now.");
      } finally {
        if (!active) {
          return;
        }
        setLoading(false);
        setRefreshing(false);
      }
    }

    void loadSnapshot();
    const intervalId = window.setInterval(() => {
      void loadSnapshot(true);
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <LayerDashboard config={config}>
      <section className="mb-8 rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Day 1-2 Backend Wiring
            </p>
            <h2 className="mt-2 text-xl font-bold text-[#0d1b3d]">
              Live progress from backend services into the Depot UI
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              This panel now checks the actual Day 1 and Day 2 platform services so you can demo visible progress:
              monitoring, audit exposure, RBAC, security, realtime, vector search, and file storage.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <button
              type="button"
              onClick={async () => {
                setRefreshing(true);
                try {
                  const nextSnapshot = await getDayOneTwoProgressSnapshot();
                  setSnapshot(nextSnapshot);
                  setError(null);
                } catch {
                  setError("Unable to refresh Day 1-2 backend progress.");
                } finally {
                  setRefreshing(false);
                  setLoading(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh status
            </button>
            <p className="text-xs text-slate-400">
              Last updated: {formatTimestamp(snapshot?.generatedAt ?? null)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Services checked</p>
            <p className="mt-2 text-3xl font-bold text-[#0d1b3d]">{snapshot?.cards.length ?? 7}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs text-emerald-700">Live endpoints</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{snapshot?.liveCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-amber-700">Auth-protected</p>
            <p className="mt-2 text-3xl font-bold text-amber-700">{snapshot?.authCount ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-xs text-rose-700">Needs attention</p>
            <p className="mt-2 text-3xl font-bold text-rose-700">{snapshot?.offlineCount ?? 0}</p>
          </div>
        </div>

        {error ? (
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {(snapshot?.cards ?? []).map((card) => {
            const theme = stateTheme[card.state];
            const StateIcon = theme.icon;

            return (
              <article key={card.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {card.area}
                    </p>
                    <h3 className="mt-2 text-sm font-bold text-[#0d1b3d]">{card.title}</h3>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${theme.chip}`}>
                    <StateIcon className="h-3.5 w-3.5" />
                    {theme.label}
                  </span>
                </div>

                <p className={`mt-4 text-sm font-semibold ${theme.tone}`}>{card.summary}</p>
                <div className="mt-4 space-y-2">
                  {card.details.map((detail) => (
                    <div
                      key={detail}
                      className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600"
                    >
                      {detail}
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Loading backend progress snapshot...
          </div>
        ) : null}
      </section>
    </LayerDashboard>
  );
}
