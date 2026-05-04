"use client";

import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScorecardRow {
  group_name: string;
  total_slas: number;
  compliant: number;
  at_risk: number;
  breached: number;
  compliance_pct: number;
  penalty_amount: number;
}

interface ScorecardSummary {
  overall_compliance_pct: number;
  total_slas: number;
  total_compliant: number;
  total_at_risk: number;
  total_breached: number;
  total_penalty: number;
  currency: string;
  by_group: ScorecardRow[];
}

// ---------------------------------------------------------------------------
// Default / fallback data
// ---------------------------------------------------------------------------

const FALLBACK: ScorecardSummary = {
  overall_compliance_pct: 80,
  total_slas: 55,
  total_compliant: 44,
  total_at_risk: 6,
  total_breached: 5,
  total_penalty: 6700,
  currency: "USD",
  by_group: [
    { group_name: "Live Monitoring", total_slas: 12, compliant: 12, at_risk: 0, breached: 0, compliance_pct: 100, penalty_amount: 0 },
    { group_name: "SLA Tracking", total_slas: 18, compliant: 11, at_risk: 4, breached: 3, compliance_pct: 61.1, penalty_amount: 4500 },
  ],
};

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const VIEW_TABS = ["By Module", "By Client", "By Team"] as const;
type ViewTab = (typeof VIEW_TABS)[number];

const GROUP_TYPE_MAP: Record<ViewTab, string> = {
  "By Module": "module",
  "By Client": "client",
  "By Team": "team",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SLAScorecardTab() {
  const [activeView, setActiveView] = useState<ViewTab>("By Module");
  const [data, setData] = useState<ScorecardSummary>(FALLBACK);

  useEffect(() => {
    const groupType = GROUP_TYPE_MAP[activeView];
    import("@/services/depotOps")
      .then(({ getScorecardSummary }) => getScorecardSummary(groupType))
      .then((d) => setData(d as unknown as ScorecardSummary))
      .catch(() => setData(FALLBACK));
  }, [activeView]);

  const rows = data.by_group;

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard label="Overall Compliance" value={`${data.overall_compliance_pct}%`} color={data.overall_compliance_pct >= 90 ? "emerald" : data.overall_compliance_pct >= 70 ? "amber" : "red"} />
        <SummaryCard label="Total SLAs" value={data.total_slas} color="blue" />
        <SummaryCard label="Compliant" value={data.total_compliant} color="emerald" />
        <SummaryCard label="At Risk" value={data.total_at_risk} color="amber" />
        <SummaryCard label="Penalty Forecast" value={`$${data.total_penalty.toLocaleString()}`} color="red" />
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1 w-fit">
        {VIEW_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveView(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeView === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Scorecard Table */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <p className="text-sm font-bold text-gray-900">Performance Scorecard</p>
          <p className="text-xs text-gray-400">Compliance %, breach count, and penalty forecast — {activeView.toLowerCase()}</p>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "Total SLAs", "Compliant", "At Risk", "Breached", "Penalty", "Score"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => (
              <tr key={row.group_name} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-semibold text-gray-900">{row.group_name}</td>
                <td className="px-5 py-3 text-gray-600">{row.total_slas}</td>
                <td className="px-5 py-3 text-emerald-600 font-semibold">{row.compliant}</td>
                <td className="px-5 py-3 text-amber-600 font-semibold">{row.at_risk}</td>
                <td className="px-5 py-3 text-red-600 font-semibold">{row.breached}</td>
                <td className="px-5 py-3 text-gray-700 font-medium">
                  {row.penalty_amount > 0 ? `$${row.penalty_amount.toLocaleString()}` : "—"}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-gray-100">
                      <div
                        className={`h-2 rounded-full ${row.compliance_pct >= 90 ? "bg-emerald-500" : row.compliance_pct >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${row.compliance_pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-700">{row.compliance_pct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Card
// ---------------------------------------------------------------------------

function SummaryCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const COLORS: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${COLORS[color] || COLORS.blue}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
