"use client";

import Link from "next/link";
import {
  TrendingUp,
  BarChart3,
  Zap,
  PieChart,
  AlertTriangle,
  Target,
  Eye,
  Network,
  GitBranch,
  Gauge,
} from "lucide-react";

interface StreamModule {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
}

const modules: StreamModule[] = [
  {
    title: "Dashboard",
    description: "Executive overview and KPI monitoring",
    icon: BarChart3,
    href: "/platform/stream/dashboard",
  },
  {
    title: "MacroPulse",
    description: "Real-time macro intelligence and monitoring",
    icon: Zap,
    href: "/platform/stream/macropulse/overview",
    badge: "Live",
  },
  {
    title: "Financial Impact",
    description: "Scenario analysis and financial projections",
    icon: TrendingUp,
    href: "/platform/stream/macropulse/financial",
  },
  {
    title: "Risk Analysis",
    description: "Risk assessment and management",
    icon: AlertTriangle,
    href: "/platform/stream/macropulse/risk",
  },
  {
    title: "Simulation",
    description: "What-if scenario modeling",
    icon: GitBranch,
    href: "/platform/stream/macropulse/simulation",
  },
  {
    title: "Regional View",
    description: "Geographic and regional analytics",
    icon: Network,
    href: "/platform/stream/macropulse/regional",
  },
  {
    title: "Real-time Monitoring",
    description: "Live data feeds and alerts",
    icon: Eye,
    href: "/platform/stream/macropulse/realtime",
  },
  {
    title: "SLA Tracking",
    description: "Service level agreement monitoring",
    icon: Target,
    href: "/platform/stream/macropulse/sla",
  },
  {
    title: "CFO Brief",
    description: "Executive summary for leadership",
    icon: Gauge,
    href: "/platform/stream/macropulse/cfo-brief",
  },
  {
    title: "Applications",
    description: "Integrated applications and tools",
    icon: PieChart,
    href: "/platform/stream/applications",
  },
];

export default function StreamPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-12">
        <Link href="/platform" className="text-sm font-medium text-blue-600 hover:text-blue-700 mb-4 inline-block">
          ← Back to Platform
        </Link>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#0f2356] mb-3">
          Stream Intelligence
        </h2>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl">
          Real-time financial intelligence, macro analysis, and strategic planning tools
        </p>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.href}
              href={module.href}
            >
              <div className="group rounded-xl border-2 border-blue-200 bg-blue-50 p-5 sm:p-6 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className="bg-blue-100 w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700" />
                  </div>
                  {module.badge && (
                    <span className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/60 text-slate-600">
                      {module.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-blue-700 mb-1">
                  {module.title}
                </h3>
                <p className="text-sm sm:text-base text-blue-600 opacity-80">
                  {module.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="mt-16 pt-8 border-t border-slate-200">
        <p className="text-sm text-slate-500 text-center">
          {modules.length} analytics modules available
        </p>
      </div>
    </div>
  );
}
