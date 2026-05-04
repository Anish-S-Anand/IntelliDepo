"use client";

import { Shield } from "lucide-react";
import LayerDashboard from "@/components/depot/LayerDashboard";
import type { LayerConfig } from "@/components/depot/LayerDashboard";

const config: LayerConfig = {
  layer: 6,
  name: "Industry / Risk",
  subtitle: "Compliance, Batch Monitoring & Governance",
  color: "#4a6741",
  icon: Shield,
  modules: [
    { name: "Compliance Monitoring", description: "Regulatory rule repository with compliance check scheduler, violation detection, and audit evidence packaging.", status: "active", kpis: [{ label: "Regulations", value: "14" }, { label: "Compliance", value: "96%" }, { label: "Violations", value: "2" }, { label: "Audits Due", value: "1" }] },
    { name: "Batch/Expiry Monitoring", description: "Batch registry with expiry date tracking, FEFO enforcement logic, and configurable lead time alerts.", status: "active", kpis: [{ label: "Batches Tracked", value: "842" }, { label: "Near Expiry", value: "18" }, { label: "FEFO Compliance", value: "100%" }, { label: "Expired", value: "0" }] },
    { name: "RBAC & Audit Logs", description: "Role and permission matrix engine with JWT-based access control and immutable audit log writer.", status: "active", kpis: [{ label: "Roles", value: "8" }, { label: "Users", value: "52" }, { label: "Log Entries Today", value: "3,420" }, { label: "Access Denied", value: "4" }] },
  ],
};

export default function RiskPage() {
  return <LayerDashboard config={config} />;
}
