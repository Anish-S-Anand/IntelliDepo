"use client";

import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Radio, Hash, Map, Eye, Shield, AlertTriangle,
  Package, Sliders, Layers, ArrowUpRight, Building2,
} from "lucide-react";

const MODULES = [
  {
    name: "Analytics & Dashboard",
    description: "Live operational overview, KPIs, throughput charts, counting sessions, and detailed analytics reporting.",
    icon: LayoutDashboard,
    href: "/depot/operations",
    color: "#C74416",
    badge: "LIVE",
  },
  {
    name: "Command",
    description: "Operational command center for real-time control, SLA monitoring, and depot-wide coordination.",
    icon: Radio,
    href: "/depot/command",
    color: "#8B5CF6",
  },
  {
    name: "Counting",
    description: "Automated inventory counting with manifest reconciliation and discrepancy detection.",
    icon: Hash,
    href: "/depot/counting",
    color: "#22C55E",
  },
  {
    name: "Heatmap",
    description: "Activity heatmap visualization showing zone density, traffic patterns, and utilization.",
    icon: Map,
    href: "/depot/heatmap",
    color: "#F59E0B",
  },
  {
    name: "Vision AI",
    description: "Computer vision and object detection — YOLO-class models for bags, vehicles, and anomalies.",
    icon: Eye,
    href: "/depot/vision",
    color: "#06B6D4",
  },
  {
    name: "Gate & LPR",
    description: "Gate access management with license plate recognition, vehicle registry, and visitor tracking.",
    icon: Shield,
    href: "/depot/gate",
    color: "#10B981",
  },
  {
    name: "Incidents",
    description: "Incident tracking, escalation workflows, and perimeter breach monitoring in one unified view.",
    icon: AlertTriangle,
    href: "/depot/incidents",
    color: "#EF4444",
    badge: "ALERTS",
  },
  {
    name: "Inventory",
    description: "Cluster management, batch tracking, FIFO/FEFO compliance, and real-time stock levels.",
    icon: Package,
    href: "/depot/inventory",
    color: "#F97316",
  },
  {
    name: "Zones",
    description: "Zone configuration, capacity management, and spatial organization of the depot floor.",
    icon: Sliders,
    href: "/depot/zones",
    color: "#A855F7",
  },
  {
    name: "Sequencing",
    description: "Batch sequencing rules, pick order generation, and FIFO/FEFO/LIFO enforcement.",
    icon: Layers,
    href: "/depot/sequencing",
    color: "#64748B",
  },
];

function ModuleCard({ mod }: { mod: typeof MODULES[0] }) {
  const router = useRouter();
  const Icon = mod.icon;

  return (
    <button
      onClick={() => router.push(mod.href)}
      className="group relative text-left p-5 rounded-2xl border border-[#1E2F50] bg-[#14203A] hover:border-[#2A3F68] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-200"
    >
      {mod.badge && (
        <span
          className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full border"
          style={{
            background: `${mod.color}15`,
            color: mod.color,
            borderColor: `${mod.color}30`,
          }}
        >
          {mod.badge}
        </span>
      )}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${mod.color}15`, border: `1px solid ${mod.color}30` }}
        >
          <Icon className="w-5 h-5" style={{ color: mod.color }} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="text-[14px] font-bold text-[#E8EDF8]">{mod.name}</h3>
        </div>
      </div>
      <p className="text-[11px] text-[#4E6090] leading-relaxed">{mod.description}</p>
      <div
        className="flex items-center gap-1 mt-3 text-[11px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: mod.color }}
      >
        Open
        <ArrowUpRight className="w-3 h-3" />
      </div>
    </button>
  );
}

export default function DepotApplicationsPage() {
  const router = useRouter();

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#B83E12] to-[#C74416] flex items-center justify-center">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-[20px] font-extrabold text-[#E8EDF8]">IntelliDepot Modules</h1>
          <p className="text-[11px] text-[#8A9BBF]">Select a module to get started</p>
        </div>
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {MODULES.map((mod) => (
          <ModuleCard key={mod.name} mod={mod} />
        ))}
      </div>

      {/* Quick nav */}
      <div className="mt-6 p-4 bg-[#14203A] border border-[#1E2F50] rounded-2xl">
        <p className="text-[11px] text-[#4E6090] mb-3 font-semibold uppercase tracking-wider">Quick Access</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Depot Mobile", href: "/depot/operations" },
            { label: "Live Vision", href: "/depot/vision" },
            { label: "Incidents", href: "/depot/incidents" },
            { label: "Inventory", href: "/depot/inventory" },
            { label: "Gate & LPR", href: "/depot/gate" },
          ].map((link) => (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className="px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-semibold hover:border-[var(--accent-border)] hover:theme-text-nav-active transition"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
