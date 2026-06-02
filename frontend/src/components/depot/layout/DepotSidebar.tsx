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
  Shield,
  Map,
  ScanLine,
} from "lucide-react";
import { getAllActiveAlerts } from "@/services/depotVision";
import { getPerimeterAlertCount } from "@/services/depotPerimeter";

const NAV_ITEMS = [
  { label: "CMD", fullLabel: "Command Center", href: "/depot/command", icon: Radio, iconColor: "#22D3A1" },
  { label: "OPS", fullLabel: "Depot Mobile", href: "/depot/operations", icon: LayoutDashboard, iconColor: "#5B9BF5" },
  { label: "CAM", fullLabel: "Live Cameras", href: "/depot/vision", icon: Eye, iconColor: "#A78BFA" },
  { label: "GTE", fullLabel: "Gate Entry", href: "/depot/gate", icon: Shield, iconColor: "#60A5FA" },
  { label: "CNT", fullLabel: "Counting", href: "/depot/counting", icon: ScanLine, iconColor: "#34D399" },
  { label: "INC", fullLabel: "Incidents", href: "/depot/incidents", icon: AlertTriangle, iconColor: "#F87171" },
  { label: "INV", fullLabel: "Inventory", href: "/depot/inventory", icon: Package, iconColor: "#F5A623" },
  { label: "MAP", fullLabel: "Heatmap", href: "/depot/heatmap", icon: Map, iconColor: "#FB923C" },
];

export default function DepotSidebar({ open, onClose }: { open: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const [alertCount, setAlertCount] = useState(0);
  const normalizedRole = (user?.role ?? "").toLowerCase().replace(/\s+/g, "_");
  const isWarehouseManager = normalizedRole === "warehouse_manager" || normalizedRole.includes("warehouse");
  const isRegionalManager = normalizedRole === "regional_manager" || normalizedRole.includes("regional");
  const isCentralManager = normalizedRole === "central_manager" || normalizedRole.includes("central");
  const commandHref = isWarehouseManager
    ? "/depot/command/warehouse"
    : isRegionalManager
      ? "/depot/command/regional"
      : isCentralManager
        ? "/depot/command/central"
        : normalizedRole.includes("admin")
          ? "/depot/command/admin"
          : "/depot/command";

  const visibleNavItems = NAV_ITEMS.map((item) => (
    item.label === "CMD" ? { ...item, href: commandHref } : item
  ));

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
      {/* Nav items â€” fill available space */}
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

    </aside>
  );
}
