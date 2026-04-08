"use client";

import { BarChart3 } from "lucide-react";
import LayerDashboard from "@/components/depot/LayerDashboard";
import type { LayerConfig } from "@/components/depot/LayerDashboard";

const config: LayerConfig = {
  layer: 5,
  name: "Analytics & Insights",
  subtitle: "KPIs, Forecasting & Executive Intelligence",
  color: "#6c5b3a",
  icon: BarChart3,
  modules: [
    { name: "Operational KPIs", description: "KPI calculation engine for dispatch delay, throughput, and accuracy rates with scheduled aggregation jobs.", status: "active", kpis: [{ label: "KPIs Tracked", value: "42" }, { label: "Throughput", value: "1,240/hr" }, { label: "Dispatch Delay", value: "4.2min" }, { label: "Accuracy", value: "98.6%" }] },
    { name: "Predictive Forecasting", description: "Time-series demand forecasting with stock depletion prediction and inbound volume forecast.", status: "active", kpis: [{ label: "Forecasts Active", value: "12" }, { label: "Confidence", value: "91%" }, { label: "Stock Alerts", value: "3" }, { label: "Next Restock", value: "2 days" }] },
    { name: "Anomaly Detection", description: "Statistical anomaly detection with threshold auto-calibration and cross-module anomaly correlation.", status: "active", kpis: [{ label: "Anomalies Today", value: "5" }, { label: "Auto-resolved", value: "3" }, { label: "Suppressed", value: "8" }, { label: "Avg Detection", value: "12s" }] },
    { name: "Executive Dashboard", description: "Cross-depot aggregation with role-based scoping and scheduled PDF report generation.", status: "active", kpis: [{ label: "Depots", value: "4" }, { label: "Reports Generated", value: "8" }, { label: "Benchmark Score", value: "94" }, { label: "Users", value: "12" }] },
  ],
};

export default function AnalyticsPage() {
  return <LayerDashboard config={config} />;
}
