"use client";

import { useState } from "react";
import SLAComplianceGauge from "@/components/stream/macropulse/sla/SLAComplianceGauge";
import SLAAtRiskList from "@/components/stream/macropulse/sla/SLAAtRiskList";
import SLAScorecardTab from "@/components/stream/macropulse/sla/SLAScorecardTab";

const TABS = ["Overview", "At-Risk SLAs", "Scorecard"] as const;
type Tab = (typeof TABS)[number];

export default function SLATrackingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");

  return (
    <div className="flex flex-col gap-5 px-6 py-5 lg:px-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900">SLA Tracking</h2>
        <p className="mt-1 text-xs text-slate-500">
          Compliance rate · at-risk SLA list · breach countdown · scorecard
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Overview" && <SLAComplianceGauge />}
      {activeTab === "At-Risk SLAs" && <SLAAtRiskList />}
      {activeTab === "Scorecard" && <SLAScorecardTab />}
    </div>
  );
}
