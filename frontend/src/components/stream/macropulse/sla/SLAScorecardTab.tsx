"use client";

const SCORECARD = [
  { module: "Live Monitoring",    slas: 4, compliant: 4, at_risk: 0, breached: 0, score: 100 },
  { module: "SLA Tracking",       slas: 4, compliant: 2, at_risk: 1, breached: 1, score: 61  },
  { module: "Fleet & Yard View",  slas: 3, compliant: 3, at_risk: 0, breached: 0, score: 98  },
  { module: "Incident Escalation",slas: 5, compliant: 3, at_risk: 2, breached: 0, score: 74  },
];

export default function SLAScorecardTab() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-3">
        <p className="text-sm font-bold text-gray-900">Module Scorecard</p>
        <p className="text-xs text-gray-400">SLA compliance by sub-module — hooked to mock data</p>
      </div>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {["Module", "Total SLAs", "Compliant", "At Risk", "Breached", "Score"].map((h) => (
              <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {SCORECARD.map((row) => (
            <tr key={row.module} className="hover:bg-gray-50">
              <td className="px-5 py-3 font-semibold text-gray-900">{row.module}</td>
              <td className="px-5 py-3 text-gray-600">{row.slas}</td>
              <td className="px-5 py-3 text-emerald-600 font-semibold">{row.compliant}</td>
              <td className="px-5 py-3 text-amber-600 font-semibold">{row.at_risk}</td>
              <td className="px-5 py-3 text-red-600 font-semibold">{row.breached}</td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full ${row.score >= 90 ? "bg-emerald-500" : row.score >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${row.score}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700">{row.score}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
