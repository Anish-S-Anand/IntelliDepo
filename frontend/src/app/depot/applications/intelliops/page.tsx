"use client";

import { Users } from "lucide-react";
import LayerDashboard from "@/components/depot/LayerDashboard";
import type { LayerConfig } from "@/components/depot/LayerDashboard";

const config: LayerConfig = {
  layer: 2,
  name: "IntelliOps\u2122",
  subtitle: "Workforce & Space Management",
  color: "#2d6a4f",
  icon: Users,
  modules: [
    { name: "Task Assignment", description: "Smart assignment agent with skills-based worker matching, load balancing, priority queuing, and geo-proximity scoring.", status: "active", kpis: [{ label: "Tasks Today", value: "189" }, { label: "On Time", value: "92%" }, { label: "Workers Active", value: "34" }, { label: "Reassigned", value: "6" }] },
    { name: "Guided Checklists", description: "SOP compliance agent with checklist definition engine, photo/signature capture, and auto-escalation.", status: "active", kpis: [{ label: "Checklists Done", value: "78" }, { label: "Compliance", value: "96%" }, { label: "Photos Captured", value: "124" }, { label: "Escalations", value: "3" }] },
    { name: "Cluster Allocation", description: "Dynamic zone assignment engine with demand-based reallocation and seasonal configuration support.", status: "active", kpis: [{ label: "Zones", value: "24" }, { label: "Reallocations", value: "5" }, { label: "Efficiency", value: "87%" }, { label: "Travel Time Saved", value: "18min" }] },
    { name: "Space Optimization", description: "Space utilization ML model with real-time occupancy tracking and SKU density scoring.", status: "syncing", kpis: [{ label: "Utilization", value: "78%" }, { label: "SKUs Tracked", value: "1,240" }, { label: "Reorder Alerts", value: "4" }, { label: "Capacity Free", value: "22%" }] },
    { name: "Exception Handling", description: "Exception detection rules engine with SLA timer per exception type and priority escalation matrix.", status: "active", kpis: [{ label: "Open Exceptions", value: "7" }, { label: "Resolved Today", value: "12" }, { label: "Avg Resolution", value: "23min" }, { label: "Escalated", value: "2" }] },
  ],
};

export default function IntelliOpsPage() {
  return <LayerDashboard config={config} />;
}
