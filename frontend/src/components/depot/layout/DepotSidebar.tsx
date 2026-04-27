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
  Camera,
  AlertTriangle,
  BarChart3,
  Radio,
  Settings,
  Hash,
  Map,
  Sliders,
  Layers,
  Shield,
  Radar,
} from "lucide-react";
import { getAllActiveAlerts } from "@/services/depotVision";
import { getPerimeterAlertCount } from "@/services/depotPerimeter";

const NAV_ITEMS = [
  { label: "CMD", fullLabel: "Command", href: "/depot/command", icon: Radio },
  { label: "DASH", fullLabel: "Dashboard", href: "/depot/operations", icon: LayoutDashboard },
  { label: "INV", fullLabel: "Inventory", href: "/depot/inventory", icon: Package },
  { label: "VIS", fullLabel: "Vision AI", href: "/depot/vision", icon: Eye },
  { label: "CNT", fullLabel: "Counting", href: "/depot/counting", icon: Hash },
  { label: "MAP", fullLabel: "Heatmap", href: "/depot/heatmap", icon: Map },
  { label: "ZNE", fullLabel: "Zones", href: "/depot/zones", icon: Sliders },
  { label: "SEQ", fullLabel: "Sequencing", href: "/depot/sequencing", icon: Layers },
  { label: "GTE", fullLabel: "Gate & LPR", href: "/depot/gate", icon: Shield },
  { label: "SEC", fullLabel: "Perimeter", href: "/depot/perimeter", icon: Radar, hasPulse: true },
  { label: "INC", fullLabel: "Incidents", href: "/depot/incidents", icon: AlertTriangle },
  { label: "ANL", fullLabel: "Analytics", href: "/depot/analytics", icon: BarChart3 },
];

const BOTTOM_ITEMS = [
  { label: "SET", fullLabel: "Settings", href: "/depot/settings", icon: Settings },
];

export default function DepotSidebar({ open }: { open: boolean }) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const [alertCount, setAlertCount] = useState(0);
  const normalizedRole = (user?.role ?? "").toLowerCase().replace(/\s+/g, "_");
  const isWarehouseManager =
    normalizedRole === "warehouse_manager" || normalizedRole.includes("warehouse");
  const isRegionalManager =
    normalizedRole === "regional_manager" || normalizedRole.includes("regional");

  const warehouseManagerNavItems = [
    { label: "DASH", fullLabel: "Dashboard", href: "/depot/operations", icon: LayoutDashboard },
    { label: "CAM", fullLabel: "Cameras", href: "/depot/cameras", icon: Camera },
    { label: "ANL", fullLabel: "Analytics", href: "/depot/analytics", icon: BarChart3 },
    { label: "GTE", fullLabel: "Gate & LPR", href: "/depot/gate", icon: Shield },
    { label: "SEC", fullLabel: "Perimeter", href: "/depot/perimeter", icon: Radar, hasPulse: true },
    { label: "INC", fullLabel: "Incidents", href: "/depot/incidents", icon: AlertTriangle },
    { label: "INV", fullLabel: "Inventory", href: "/depot/inventory", icon: Package },
    { label: "ZNE", fullLabel: "Zones", href: "/depot/zones", icon: Sliders },
  ];

  const regionalManagerNavItems = [
    { label: "DASH", fullLabel: "Dashboard", href: "/depot/operations", icon: LayoutDashboard },
    { label: "CAM", fullLabel: "Cameras", href: "/depot/cameras", icon: Camera },
    { label: "CMD", fullLabel: "Command", href: "/depot/command", icon: Radio },
    { label: "ANL", fullLabel: "Analytics", href: "/depot/analytics", icon: BarChart3 },
    { label: "GTE", fullLabel: "Gate & LPR", href: "/depot/gate", icon: Shield },
    { label: "SEC", fullLabel: "Perimeter", href: "/depot/perimeter", icon: Radar, hasPulse: true },
    { label: "INC", fullLabel: "Incidents", href: "/depot/incidents", icon: AlertTriangle },
    { label: "INV", fullLabel: "Inventory", href: "/depot/inventory", icon: Package },
    { label: "ZNE", fullLabel: "Zones", href: "/depot/zones", icon: Sliders },
  ];

  const visibleNavItems = isWarehouseManager
    ? warehouseManagerNavItems
    : isRegionalManager
      ? regionalManagerNavItems
      : NAV_ITEMS;
  const visibleBottomItems = BOTTOM_ITEMS;

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

    void fetchAlerts();
    const interval = setInterval(() => void fetchAlerts(), 20000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <aside
      className={`fixed md:static left-0 top-[52px] bottom-0 w-16 bg-[#0D1526] border-r border-[#1E2F50] flex flex-col items-center py-3 gap-1 z-40 transition-transform duration-300 ${
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      {visibleNavItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href || pathname?.startsWith(item.href + "/");

        const badgeCount = (item as any).hasPulse ? alertCount : 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.fullLabel}
            className={cn(
              "relative w-11 h-11 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-colors text-[16px]",
              isActive
                ? "bg-[#E5521A]/12 text-[#E5521A] border-[#E5521A]/25"
                : "border-transparent text-[#4E6090] hover:bg-[#E5521A]/5 hover:text-[#8A9BBF] hover:border-[#1E2F50]"
            )}
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

      <div className="mt-auto">
        {visibleBottomItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="w-11 h-11 flex items-center justify-center">
              <Icon className="w-4 h-4" />
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
