"use client";

import { Radio } from "lucide-react";
import LayerDashboard from "@/components/depot/LayerDashboard";
import type { LayerConfig } from "@/components/depot/LayerDashboard";

const config: LayerConfig = {
  layer: 3,
  name: "IntelliCommand\u2122",
  subtitle: "Real-Time Control & SLA Management",
  color: "#1a5276",
  icon: Radio,
  modules: [
    { name: "Live Monitoring", description: "WebSocket-based real-time KPI feed with depot-wide sensor aggregation and configurable threshold engine.", status: "active", kpis: [{ label: "KPIs Live", value: "42" }, { label: "Sensors", value: "128" }, { label: "Alerts Active", value: "3" }, { label: "Uptime", value: "100%" }] },
    { name: "SLA Tracking", description: "SLA breach agent with breach prediction model, penalty calculation, and active SLA rule repository.", status: "active", kpis: [{ label: "Active SLAs", value: "34" }, { label: "At Risk", value: "2" }, { label: "Breached Today", value: "0" }, { label: "Compliance", value: "98%" }] },
  ],
};

export default function IntelliCommandPage() {
  return <LayerDashboard config={config} />;
}
