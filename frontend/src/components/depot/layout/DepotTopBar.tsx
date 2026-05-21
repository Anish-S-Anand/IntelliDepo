"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Bell, RefreshCw, Settings, User, Clock, LogOut, ChevronDown, Shield, MapPin } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { getAllActiveAlerts } from "@/services/depotVision";
import { getPerimeterAlertCount } from "@/services/depotPerimeter";

export default function DepotTopBar({ toggleSidebar }: { toggleSidebar: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);

  // Fetch live alert count for the bell badge — deferred so it doesn't compete
  // with the page's own data fetching on navigation
  useEffect(() => {
    let cancelled = false;
    const fetchAlerts = async () => {
      try {
        const [vision, perimeter] = await Promise.allSettled([
          getAllActiveAlerts(),
          getPerimeterAlertCount(),
        ]);
        if (!cancelled) {
          let total = 0;
          if (vision.status === "fulfilled") total += vision.value.length;
          if (perimeter.status === "fulfilled") total += perimeter.value;
          setAlertCount(total);
        }
      } catch { /* silent */ }
    };
    // Defer by 3s so page content loads first
    const initialTimer = window.setTimeout(() => void fetchAlerts(), 3000);
    const interval = setInterval(() => void fetchAlerts(), 60000);
    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "OP";

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header
      className="depot-topbar fixed top-0 left-0 right-0 h-[64px] flex items-center px-3 sm:px-4 gap-2 sm:gap-3 z-50 theme-transition"
      style={{
        backgroundColor: "var(--bg-nav)",
        borderBottom: "1px solid var(--bg-nav-border)",
      }}
    >
      {/* Mobile Hamburger */}
      <button
        onClick={toggleSidebar}
        className="md:hidden w-8 h-8 flex items-center justify-center text-lg theme-transition"
        style={{ color: "var(--text-primary)" }}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>

      {/* Logo */}
      <button
        onClick={() => router.push("/depot/operations")}
        className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0"
        aria-label="Go to depot home"
      >
        <div className="w-[44px] h-[44px] sm:w-[48px] sm:h-[48px] rounded-xl bg-white flex items-center justify-center shadow-[0_0_10px_rgba(229,82,26,0.3)] overflow-hidden flex-shrink-0">
          <Image
            src="/fidelis-logo.png"
            alt="Fidelis"
            width={48}
            height={48}
            className="w-8 h-8 sm:w-9 sm:h-9 object-contain"
            priority
          />
        </div>
        <div className="hidden xs:flex flex-col leading-none gap-0.5">
          <span className="text-[#E5521A] font-extrabold text-[17px] sm:text-[19px] tracking-tight">
            Intelli
          </span>
          <span
            className="text-[8px] sm:text-[9px] font-semibold tracking-[0.12em] uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            IntelliDepot™
          </span>
        </div>
      </button>

      {/* Divider */}
      <div
        className="hidden sm:block w-px h-7 flex-shrink-0"
        style={{ backgroundColor: "var(--border-default)" }}
      />

      {/* Depot location — shows warehouse location from logged-in account */}
      <div
        className="hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold theme-transition"
        style={{
          backgroundColor: "var(--bg-input)",
          border: "1px solid var(--border-input)",
          color: "var(--text-input)",
        }}
      >
        <MapPin className="w-3 h-3 text-[#E5521A] flex-shrink-0" />
        {(() => {
          if (user?.location) return user.location;
          // Derive from full_name e.g. "Warehouse Manager - Bengaluru" → "Bengaluru"
          if (user?.full_name) {
            const parts = user.full_name.split(/[-–—]/);
            if (parts.length > 1) return parts[parts.length - 1].trim();
          }
          return user?.email?.split("@")[0] ?? "Depot";
        })()}
      </div>

      <div className="flex-1" />

      {/* Live pill */}
      <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold text-[#22D3A1]"
        style={{ backgroundColor: "rgba(34,211,161,0.08)", border: "1px solid rgba(34,211,161,0.2)" }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#22D3A1] animate-pulse" />
        LIVE
      </div>

      {/* Theme Toggle */}
      <ThemeToggle />

      {/* Refresh */}
      <button
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors theme-transition"
        style={{
          border: "1px solid var(--border-default)",
          color: "var(--text-muted)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "#E5521A";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(229,82,26,0.5)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)";
        }}
        aria-label="Refresh"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>

      {/* Alerts */}
      <button
        onClick={() => router.push("/depot/incidents")}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors theme-transition"
        style={{
          border: "1px solid var(--border-default)",
          color: "var(--text-muted)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "#E5521A";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(229,82,26,0.5)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)";
        }}
        aria-label="View alerts"
      >
        <Bell className="w-3.5 h-3.5" />
        {alertCount > 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#F04A4A] text-white text-[8px] font-extrabold flex items-center justify-center">
            {alertCount > 9 ? "9+" : alertCount}
          </span>
        )}
      </button>

      {/* Profile dropdown */}
      <div className="relative flex-shrink-0" ref={profileRef}>
        <button
          onClick={() => setProfileOpen((prev) => !prev)}
          className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors theme-transition"
          style={{ color: "var(--text-muted)" }}
          aria-label="Profile menu"
          aria-expanded={profileOpen}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#C43A08] to-[#E5521A] flex items-center justify-center text-[11px] font-extrabold text-white">
            {initials}
          </div>
          <ChevronDown
            className={`w-3 h-3 transition-transform ${profileOpen ? "rotate-180" : ""}`}
            style={{ color: "var(--text-muted)" }}
          />
        </button>

        {profileOpen && (
          <div
            className="absolute right-0 top-[calc(100%+6px)] w-64 rounded-xl shadow-2xl z-[100] overflow-hidden theme-transition"
            style={{
              backgroundColor: "var(--bg-surface-2)",
              border: "1px solid var(--border-default)",
            }}
          >
            {/* User info */}
            <div
              className="px-4 py-3 theme-transition"
              style={{
                borderBottom: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-surface-3)",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C43A08] to-[#E5521A] flex items-center justify-center text-[14px] font-extrabold text-white">
                  {initials}
                </div>
                <div>
                  <div className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {user?.full_name || "Operator"}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {user?.email || "operator@intelli.com"}
                  </div>
                  <div className="text-[9px] text-[#E5521A] font-semibold uppercase mt-0.5">
                    {user?.role || "Admin"}
                  </div>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              {[
                { icon: Settings, color: "#E5521A", label: "Settings", sub: "Account, alerts, integrations", href: "/depot/settings" },
                { icon: User, color: "#5B9BF5", label: "Account Profile", sub: "Edit your profile details", href: "/depot/settings?tab=account" },
                { icon: Clock, color: "#22D3A1", label: "Activity & Time Spent", sub: "Session history and usage", href: "/depot/settings?tab=activity" },
                { icon: Shield, color: "#F5A623", label: "Security & Privacy", sub: "Password, 2FA, permissions", href: "/depot/settings?tab=security" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    onClick={() => { setProfileOpen(false); router.push(item.href); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] transition-colors text-left theme-transition"
                    style={{ color: "var(--text-muted)" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-surface-3)";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                    }}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: item.color }} />
                    <div>
                      <div className="font-semibold">{item.label}</div>
                      <div className="text-[10px]" style={{ color: "var(--text-faint)" }}>{item.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Logout */}
            <div style={{ borderTop: "1px solid var(--border-default)" }} className="py-1.5">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-[#F04A4A] transition-colors text-left"
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(240,74,74,0.08)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
              >
                <LogOut className="w-4 h-4" />
                <span className="font-semibold">Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
