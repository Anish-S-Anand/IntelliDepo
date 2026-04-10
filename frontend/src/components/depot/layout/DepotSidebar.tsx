"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Eye,
  AlertTriangle,
  BarChart3,
  Radio,
  Settings,
  Hash,
  Map,
  Sliders,
} from "lucide-react";
import { getAllActiveAlerts } from "@/services/depotVision";

const NAV_ITEMS = [
  { label: "CMD", fullLabel: "Command", href: "/depot/command", icon: Radio },
  { label: "DASH", fullLabel: "Dashboard", href: "/depot/operations", icon: LayoutDashboard },
  { label: "INV", fullLabel: "Inventory", href: "/depot/inventory", icon: Package },
  { label: "VIS", fullLabel: "Vision AI", href: "/depot/vision", icon: Eye },
  { label: "CNT", fullLabel: "Counting", href: "/depot/counting", icon: Hash },
  { label: "MAP", fullLabel: "Heatmap", href: "/depot/heatmap", icon: Map },
  { label: "ZNE", fullLabel: "Zones", href: "/depot/zones", icon: Sliders },
  { label: "INC", fullLabel: "Incidents", href: "/depot/incidents", icon: AlertTriangle, hasPulse: true },
  { label: "ANL", fullLabel: "Analytics", href: "/depot/analytics", icon: BarChart3 },
];

const BOTTOM_ITEMS = [
  { label: "SET", fullLabel: "Settings", href: "/depot/settings", icon: Settings },
];

export default function DepotSidebar() {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState(0);

  // Fetch active alert count for incident badge
  useEffect(() => {
    let cancelled = false;
    const fetchAlerts = async () => {
      try {
        const alerts = await getAllActiveAlerts();
        if (!cancelled) setAlertCount(alerts.length);
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
    <aside className="fixed left-0 top-[52px] bottom-0 w-16 bg-[#0D1526] border-r border-[#1E2F50] flex flex-col items-center py-3 gap-1 z-40">
      {NAV_ITEMS.map((item) => {
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
            {isActive && (
              <span className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#E5521A] rounded-r" />
            )}
            <Icon className="w-4 h-4" />
            <span className="text-[7px] font-bold tracking-wide uppercase leading-none">
              {item.label}
            </span>
            {badgeCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#F04A4A] text-white text-[7px] font-extrabold flex items-center justify-center animate-pulse shadow-[0_0_8px_rgba(240,74,74,0.6)]">
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            )}
          </Link>
        );
      })}

      <div className="w-[30px] h-px bg-[#1E2F50] my-1" />

      <div className="mt-auto">
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.fullLabel}
              className={cn(
                "w-11 h-11 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-colors",
                isActive
                  ? "bg-[#E5521A]/12 text-[#E5521A] border-[#E5521A]/25"
                  : "border-transparent text-[#4E6090] hover:bg-[#E5521A]/5 hover:text-[#8A9BBF]"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[7px] font-bold tracking-wide uppercase leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
