"use client";

import React from "react";
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
  Shield,
} from "lucide-react";
import { getAllActiveAlerts } from "@/services/depotVision";
import { getPerimeterAlertCount } from "@/services/depotPerimeter";

const NAV_ITEMS = [
  { label: "OPS", fullLabel: "Operations Hub", href: "/depot/operations", icon: LayoutDashboard, iconColor: "#5B9BF5" },
  { label: "CMD", fullLabel: "Command Center", href: "/depot/command", icon: Radio, iconColor: "#22D3A1" },
  { label: "INV", fullLabel: "Inventory", href: "/depot/inventory", icon: Package, iconColor: "#F5A623" },
  { label: "CAM", fullLabel: "Live Cameras", href: "/depot/vision", icon: Eye, iconColor: "#A78BFA" },
  { label: "CNT", fullLabel: "Counting", href: "/depot/counting", icon: Hash, iconColor: "#34D399" },
  { label: "MAP", fullLabel: "Heatmap", href: "/depot/heatmap", icon: Map, iconColor: "#FB923C" },
  // Hidden temporarily - can be restored later
  // { label: "ZNE", fullLabel: "Zones", href: "/depot/zones", icon: Sliders },
  // { label: "SEQ", fullLabel: "Sequencing", href: "/depot/sequencing", icon: Layers },
  { label: "GTE", fullLabel: "Gate Entry", href: "/depot/gate", icon: Shield, iconColor: "#60A5FA" },
  { label: "INC", fullLabel: "Incidents", href: "/depot/incidents", icon: AlertTriangle, iconColor: "#F87171" },
];

export default function DepotSidebar({ open, onClose }: { open: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const [alertCount, setAlertCount] = useState(0);
  const normalizedRole = (user?.role ?? "").toLowerCase().replace(/\s+/g, "_");
  const isWarehouseManager = normalizedRole === "warehouse_manager" || normalizedRole.includes("warehouse");
  const isRegionalManager = normalizedRole === "regional_manager" || normalizedRole.includes("regional");

  const warehouseManagerNavItems = [
    { label: "OPS", fullLabel: "Operations Hub", href: "/depot/operations", icon: LayoutDashboard, iconColor: "#5B9BF5" },
    { label: "CAM", fullLabel: "Live Cameras", href: "/depot/vision", icon: Eye, iconColor: "#A78BFA" },
    { label: "GTE", fullLabel: "Gate Entry", href: "/depot/gate", icon: Shield, iconColor: "#60A5FA" },
    { label: "INC", fullLabel: "Incidents", href: "/depot/incidents", icon: AlertTriangle, iconColor: "#F87171" },
    { label: "INV", fullLabel: "Inventory", href: "/depot/inventory", icon: Package, iconColor: "#F5A623" },
    // Hidden temporarily - can be restored later
    // { label: "ZNE", fullLabel: "Zones", href: "/depot/zones", icon: Sliders },
  ];

  const regionalManagerNavItems = [
    { label: "OPS", fullLabel: "Operations Hub", href: "/depot/operations", icon: LayoutDashboard, iconColor: "#5B9BF5" },
    { label: "CAM", fullLabel: "Live Cameras", href: "/depot/vision", icon: Eye, iconColor: "#A78BFA" },
    { label: "CMD", fullLabel: "Command Center", href: "/depot/command", icon: Radio, iconColor: "#22D3A1" },
    { label: "GTE", fullLabel: "Gate Entry", href: "/depot/gate", icon: Shield, iconColor: "#60A5FA" },
    { label: "INC", fullLabel: "Incidents", href: "/depot/incidents", icon: AlertTriangle, iconColor: "#F87171" },
    { label: "INV", fullLabel: "Inventory", href: "/depot/inventory", icon: Package, iconColor: "#F5A623" },
    // Hidden temporarily - can be restored later
    // { label: "ZNE", fullLabel: "Zones", href: "/depot/zones", icon: Sliders },
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
      className={`depot-sidebar fixed left-0 top-[64px] bottom-0 w-[204px] flex flex-col items-stretch py-[10px] px-2 z-40 transition-all duration-300 ${
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
      style={{
        backgroundColor: "var(--bg-nav)",
        borderRight: "1px solid var(--bg-nav-border)",
      }}
    >
      {/* Nav items — fill available space */}
      <div className="flex flex-col gap-[2px] flex-1">
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
            aria-label={item.fullLabel}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "depot-sidebar-item relative w-auto min-h-[50px] rounded-xl inline-flex flex-row items-center justify-start gap-[10px] px-[13px] text-[16px]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2",
              isActive ? "active" : ""
            )}
            style={{
              backgroundColor: isActive ? "var(--accent-subtle)" : "transparent",
              color: isActive ? "var(--accent)" : "var(--text-nav)",
              border: isActive ? "1px solid var(--accent-border)" : "1px solid transparent",
              transition: "background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease",
            }}
          >
            <span
              className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
              style={{
                background: isActive ? "rgba(229,82,26,0.18)" : `${item.iconColor}22`,
              }}
            >
              <Icon
                className="w-4 h-4"
                aria-hidden="true"
                style={{ color: isActive ? "#E5521A" : item.iconColor }}
              />
            </span>
            <span className="text-[13.5px] font-bold tracking-[0.01em] leading-tight">
              {item.fullLabel || item.label}
            </span>

            {badgeCount > 0 && (
              <span 
                className="absolute top-[6px] right-[10px] min-w-[13px] h-[13px] px-1 rounded-full bg-[#F04A4A] text-white text-[7px] flex items-center justify-center"
                aria-label={`${badgeCount} active ${badgeCount === 1 ? 'alert' : 'alerts'}`}
              >
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            )}
          </Link>
        );
      })}
      </div>

      {/* Bottom — version / branding pinned to bottom */}
      <div
        className="px-3 py-3 text-[9px] font-semibold tracking-[0.1em] uppercase"
        style={{ color: "var(--text-faint)", borderTop: "1px solid var(--bg-nav-border)" }}
      >
        IntelliDepot™ v1.0
      </div>
    </aside>
  );
}
