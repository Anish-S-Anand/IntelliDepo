"use client";

import { Plug } from "lucide-react";
import LayerDashboard from "@/components/depot/LayerDashboard";
import type { LayerConfig } from "@/components/depot/LayerDashboard";

const config: LayerConfig = {
  layer: 4,
  name: "IntelliConnect\u2122",
  subtitle: "ERP, IoT & API Integration",
  color: "#5b4a8a",
  icon: Plug,
  modules: [
    { name: "ERP Sync (SAP/Oracle)", description: "Bidirectional ERP connector with inventory record sync, order status push, and field mapping configuration.", status: "syncing", kpis: [{ label: "Records Synced", value: "8,420" }, { label: "Last Sync", value: "2min ago" }, { label: "Errors", value: "3" }, { label: "Retry Queue", value: "1" }] },
    { name: "IoT & Weather Feeds", description: "MQTT/HTTP IoT broker adapter with weather API integration, sensor normalization, and threshold alerts.", status: "active", kpis: [{ label: "Sensors Active", value: "48" }, { label: "Data Points/min", value: "2,400" }, { label: "Weather Alerts", value: "0" }, { label: "Temp Alerts", value: "1" }] },
    { name: "API Health Monitoring", description: "API heartbeat scheduler with response time logging, degradation detection, and downtime alerts.", status: "active", kpis: [{ label: "APIs Monitored", value: "18" }, { label: "Avg Response", value: "124ms" }, { label: "Uptime", value: "99.7%" }, { label: "Degraded", value: "1" }] },
  ],
};

export default function IntelliConnectPage() {
  return <LayerDashboard config={config} />;
}
