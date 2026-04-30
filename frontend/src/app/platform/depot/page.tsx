"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import {
  BarChart3,
  Zap,
  RefreshCw,
  Layers,
  Eye,
  Crosshair,
  AlertCircle,
  Box,
  MapPin,
  Cog,
  PieChart,
  Navigation,
  Inbox,
  Loader2,
} from "lucide-react";

interface DepotModule {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
}

const WAREHOUSE_MANAGER_MODULE_TITLES = new Set([
  "Dashboard",
  "Vision",
  "Analytics",
  "Gate",
  "Perimeter",
  "Incidents",
  "Inventory",
  "Zones",
  "Settings",
]);

const REGIONAL_MANAGER_MODULE_TITLES = new Set([
  "Dashboard",
  "Vision",
  "Command",
  "Analytics",
  "Gate",
  "Perimeter",
  "Incidents",
  "Inventory",
  "Zones",
  "Settings",
]);

const modules: DepotModule[] = [
  {
    title: "Dashboard",
    description: "Live operational overview and key metrics",
    icon: BarChart3,
    href: "/platform/depot/dashboard",
  },
  {
    title: "Analytics",
    description: "Detailed analytics and reporting",
    icon: PieChart,
    href: "/platform/depot/analytics",
  },
  {
    title: "Command",
    description: "Operational command center",
    icon: Zap,
    href: "/platform/depot/command",
  },
  {
    title: "Counting",
    description: "Inventory and asset counting",
    icon: Layers,
    href: "/platform/depot/counting",
  },
  {
    title: "Heatmap",
    description: "Activity heatmap visualization",
    icon: RefreshCw,
    href: "/platform/depot/heatmap",
  },
  {
    title: "Vision",
    description: "Computer vision and object detection",
    icon: Eye,
    href: "/platform/depot/vision",
  },
  {
    title: "Gate",
    description: "Gate access and entry management",
    icon: Navigation,
    href: "/platform/depot/gate",
  },
  {
    title: "Perimeter",
    description: "Perimeter security monitoring",
    icon: Crosshair,
    href: "/platform/depot/perimeter",
  },
  {
    title: "Incidents",
    description: "Incident tracking and reporting",
    icon: AlertCircle,
    href: "/platform/depot/incidents",
  },
  {
    title: "Inventory",
    description: "Inventory management",
    icon: Box,
    href: "/platform/depot/inventory",
  },
  {
    title: "Zones",
    description: "Zone configuration and management",
    icon: MapPin,
    href: "/platform/depot/zones",
  },
  {
    title: "Operations",
    description: "Overall operations dashboard",
    icon: Inbox,
    href: "/platform/depot/operations",
  },
  {
    title: "Settings",
    description: "Depot configuration and settings",
    icon: Cog,
    href: "/platform/depot/settings",
  },
];

export default function DepotPage() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const [pendingModuleHref, setPendingModuleHref] = useState<string | null>(null);
  const normalizedRole = (user?.role ?? "").toLowerCase().replace(/\s+/g, "_");
  const isWarehouseManager =
    normalizedRole === "warehouse_manager" || normalizedRole.includes("warehouse");
  const isRegionalManager =
    normalizedRole === "regional_manager" || normalizedRole.includes("regional");

  useEffect(() => {
    setPendingModuleHref(null);
  }, [pathname]);

  const visibleModules = isWarehouseManager
    ? modules.filter((module) => WAREHOUSE_MANAGER_MODULE_TITLES.has(module.title))
    : isRegionalManager
      ? modules.filter((module) => REGIONAL_MANAGER_MODULE_TITLES.has(module.title))
      : modules;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-12">
        <Link href="/platform" className="text-sm font-medium text-blue-600 hover:text-blue-700 mb-4 inline-block">
          {"<-"} Back to Platform
        </Link>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#0f2356] mb-3">
          Depot Operations
        </h2>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl">
          Comprehensive warehouse operations and asset management suite
        </p>
        {pendingModuleHref ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening module...
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {visibleModules.map((module) => {
          const Icon = module.icon;
          const isPending = pendingModuleHref === module.href;
          const isAnyPending = pendingModuleHref !== null;

          return (
            <Link
              key={module.href}
              href={module.href}
              aria-busy={isPending}
              onClick={(event) => {
                if (
                  event.defaultPrevented ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                ) {
                  return;
                }

                if (isAnyPending) {
                  event.preventDefault();
                  return;
                }

                setPendingModuleHref(module.href);
              }}
              className={isAnyPending && !isPending ? "pointer-events-none" : ""}
            >
              <div
                className={`group rounded-xl border-2 border-orange-200 bg-orange-50 p-5 sm:p-6 hover:border-orange-300 hover:shadow-md transition-all cursor-pointer ${isPending ? "ring-2 ring-orange-300" : ""} ${isAnyPending && !isPending ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="bg-orange-100 w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-orange-700" />
                  </div>
                  {isPending ? (
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/80 text-orange-700 inline-flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Opening...
                    </span>
                  ) : module.badge ? (
                    <span className="text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/60 text-slate-600">
                      {module.badge}
                    </span>
                  ) : null}
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-orange-700 mb-1">
                  {module.title}
                </h3>
                <p className="text-sm sm:text-base text-orange-600 opacity-80">
                  {module.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-16 pt-8 border-t border-slate-200">
        <p className="text-sm text-slate-500 text-center">
          {visibleModules.length} operational modules available
        </p>
      </div>
    </div>
  );
}
