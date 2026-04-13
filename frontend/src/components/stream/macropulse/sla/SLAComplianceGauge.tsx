"use client";

import { AlertTriangle, CheckCircle, Clock, TrendingDown } from "lucide-react";

const MOCK_SLAS = [
  { name: "Alert Dispatch Latency", compliance: 94, threshold: "< 500ms", status: "ok" },
  { name: "Ingestion Rate SLA",     compliance: 78, threshold: "> 100 events/min", status: "at_risk" },
  { name: "HITL Review Window",     compliance: 61, threshold: "< 30 min", status: "breached" },
  { name: "Dashboard Refresh",      compliance: 99, threshold: "< 60s", status: "ok" },
];

function GaugeArc({ pct }: { pct: number }) {
  const r = 52;
  const cx = 64;
  const cy = 64;
  const circumference = Math.PI * r; // half circle
  const offset = circumference * (1 - pct / 100);
  const color = pct >= 90 ? "#22c55e" : pct >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={128} height={80} viewBox="0 0 128 80">
      <path
        d={`M 12 64 A ${r} ${r} 0 0 1 116 64`}
        fill="none" stroke="#f1f5f9" strokeWidth={12} strokeLinecap="round"
      />
      <path
        d={`M 12 64 A ${r} ${r} 0 0 1 116 64`}
        fill="none" stroke={color} strokeWidth={12} strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <text x={64} y={62} textAnchor="middle" fontSize="18" fontWeight="800" fill="#111827">
        {pct}%
      </text>
    </svg>
  );
}

export default function SLAComplianceGauge() {
  const overall = Math.round(MOCK_SLAS.reduce((s, x) => s + x.compliance, 0) / MOCK_SLAS.length);

  return (
    <div className="space-y-4">
      {/* Overall gauge */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-8">
          <div className="text-center">
            <GaugeArc pct={overall} />
            <p className="mt-1 text-xs font-semibold text-gray-500">Overall Compliance</p>
          </div>
          <div className="flex-1 grid grid-cols-3 gap-4">
            {[
              { label: "Compliant", value: MOCK_SLAS.filter((s) => s.status === "ok").length, icon: CheckCircle, color: "text-emerald-600 bg-emerald-50" },
              { label: "At Risk",   value: MOCK_SLAS.filter((s) => s.status === "at_risk").length, icon: AlertTriangle, color: "text-amber-600 bg-amber-50" },
              { label: "Breached",  value: MOCK_SLAS.filter((s) => s.status === "breached").length, icon: TrendingDown, color: "text-red-600 bg-red-50" },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-xl p-4 ${stat.color.split(" ")[1]}`}>
                <stat.icon className={`h-5 w-5 ${stat.color.split(" ")[0]}`} />
                <p className="mt-2 text-2xl font-black text-gray-900">{stat.value}</p>
                <p className="text-xs font-semibold text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SLA list */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <p className="text-sm font-bold text-gray-900">SLA Definitions</p>
        </div>
        <div className="divide-y divide-gray-50">
          {MOCK_SLAS.map((sla) => (
            <div key={sla.name} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{sla.name}</p>
                <p className="text-xs text-gray-400">Threshold: {sla.threshold}</p>
              </div>
              <div className="w-32">
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      sla.compliance >= 90 ? "bg-emerald-500" :
                      sla.compliance >= 70 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${sla.compliance}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs font-bold text-gray-700">{sla.compliance}%</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                sla.status === "ok" ? "bg-emerald-50 text-emerald-600" :
                sla.status === "at_risk" ? "bg-amber-50 text-amber-600" :
                "bg-red-50 text-red-600"
              }`}>
                {sla.status.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
