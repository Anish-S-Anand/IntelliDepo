"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import {
  LayoutDashboard,
  Package,
  Eye,
  AlertTriangle,
  Radio,
  Hash,
  Map,
  Sliders,
  Layers,
  Shield,
} from "lucide-react";
import { getAllActiveAlerts } from "@/services/depotVision";
import { getPerimeterAlertCount } from "@/services/depotPerimeter";

const NAV_ITEMS = [
  { label: "CMD", fullLabel: "Command", href: "/depot/command", icon: Radio },
  { label: "OPS", fullLabel: "Operations Hub", href: "/depot/operations", icon: LayoutDashboard },
  { label: "INV", fullLabel: "Inventory", href: "/depot/inventory", icon: Package },
  { label: "VIS", fullLabel: "Vision AI", href: "/depot/vision", icon: Eye },
  { label: "CNT", fullLabel: "Counting", href: "/depot/counting", icon: Hash },
  { label: "MAP", fullLabel: "Heatmap", href: "/depot/heatmap", icon: Map },
  { label: "ZNE", fullLabel: "Zones", href: "/depot/zones", icon: Sliders },
  { label: "SEQ", fullLabel: "Sequencing", href: "/depot/sequencing", icon: Layers },
  { label: "GTE", fullLabel: "Gate & LPR", href: "/depot/gate", icon: Shield },
  { label: "INC", fullLabel: "Incidents", href: "/depot/incidents", icon: AlertTriangle },
];

export default function DepotSidebar({ open, onClose }: { open: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const [alertCount, setAlertCount] = useState(0);
  const normalizedRole = (user?.role ?? "").toLowerCase().replace(/\s+/g, "_");
  const isWarehouseManager = normalizedRole === "warehouse_manager" || normalizedRole.includes("warehouse");
  const isRegionalManager = normalizedRole === "regional_manager" || normalizedRole.includes("regional");

  const warehouseManagerNavItems = [
    { label: "OPS", fullLabel: "Operations Hub", href: "/depot/operations", icon: LayoutDashboard },
    { label: "VIS", fullLabel: "Vision AI", href: "/depot/vision", icon: Eye },
    { label: "GTE", fullLabel: "Gate & LPR", href: "/depot/gate", icon: Shield },
    { label: "INC", fullLabel: "Incidents", href: "/depot/incidents", icon: AlertTriangle },
    { label: "INV", fullLabel: "Inventory", href: "/depot/inventory", icon: Package },
    { label: "ZNE", fullLabel: "Zones", href: "/depot/zones", icon: Sliders },
  ];

  const regionalManagerNavItems = [
    { label: "OPS", fullLabel: "Operations Hub", href: "/depot/operations", icon: LayoutDashboard },
    { label: "VIS", fullLabel: "Vision AI", href: "/depot/vision", icon: Eye },
    { label: "CMD", fullLabel: "Command", href: "/depot/command", icon: Radio },
    { label: "GTE", fullLabel: "Gate & LPR", href: "/depot/gate", icon: Shield },
    { label: "INC", fullLabel: "Incidents", href: "/depot/incidents", icon: AlertTriangle },
    { label: "INV", fullLabel: "Inventory", href: "/depot/inventory", icon: Package },
    { label: "ZNE", fullLabel: "Zones", href: "/depot/zones", icon: Sliders },
  ];

  const visibleNavItems = isWarehouseManager
    ? warehouseManagerNavItems
    : isRegionalManager
      ? regionalManagerNavItems
      : NAV_ITEMS;

  useEffect(() => {
    let cancelled = false;
    const fetchAlerts = async () => {
      try {
        const [visionAlerts, perimeterCount] = await Promise.allSettled([
          getAllActiveAlerts(),
          getPerimeterAlertCount(),
        ]);
        if (!cancelled) {
          let total = 0;
          if (visionAlerts.status === "fulfilled") total += visionAlerts.value.length;
          if (perimeterCount.status === "fulfilled") total += perimeterCount.value;
          setAlertCount(total);
        }
      } catch {
        if (!cancelled) setAlertCount(3);
      }
    };
    // Defer initial fetch by 2s so it doesn't compete with the page's own data fetching on load
    const initialTimer = window.setTimeout(() => void fetchAlerts(), 2000);
    const interval = setInterval(() => void fetchAlerts(), 60000);
    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  return (
    <aside
      className={`depot-sidebar fixed left-0 top-[52px] bottom-0 w-16 flex flex-col items-center py-3 gap-1 z-40 transition-all duration-300 ${
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
      style={{
        backgroundColor: "var(--bg-nav)",
        borderRight: "1px solid var(--bg-nav-border)",
      }}
    >
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
        const badgeCount = item.href === "/depot/incidents" ? alertCount : 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.fullLabel}
            prefetch={true}
            scroll={false}
            onClick={() => onClose?.()}
            className={cn(
              "depot-sidebar-item relative w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all text-[16px]",
              isActive ? "active" : ""
            )}
            style={{
              backgroundColor: isActive ? "var(--bg-nav-active)" : "transparent",
              color: isActive ? "#E5521A" : "var(--text-nav)",
              border: isActive ? "1px solid rgba(229,82,26,0.25)" : "1px solid transparent",
            }}
          >
            <Icon className="w-4 h-4" />
            <span className="text-[7px] font-bold uppercase">{item.label}</span>

            {badgeCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#F04A4A] text-white text-[7px] flex items-center justify-center">
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </aside>
  );
}
