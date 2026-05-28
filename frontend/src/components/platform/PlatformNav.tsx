"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Loader2,
  LogOut,
  Menu,
  X,
  User,
  Bell,
  RefreshCw,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function PlatformNav() {
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const normalizedRole = (user?.role ?? "").toLowerCase().replace(/\s+/g, "_");
  const location = user?.location?.trim();

  const userScopeLabel = (() => {
    if (normalizedRole.includes("warehouse") && location) return `Warehouse: ${location}`;
    if (normalizedRole.includes("regional") && location) return `Region: ${location}`;
    if (location) return location;
    return null;
  })();

  const userInitials = (() => {
    const email = user?.email ?? "";
    const name =
  user && "name" in user && typeof user.name === "string"
    ? user.name
    : "";
    if (name) {
      const parts = name.trim().split(" ");
      return parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : parts[0][0].toUpperCase();
    }
    return email ? email[0].toUpperCase() : "AD";
  })();

  const handleLogout = () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    logout();
    router.push("/login");
  };

  return (
    <>
      {/* ══ TOPBAR — matches reference HTML (fidelis_chart_updated) ══ */}
      <header
        className="depot-topbar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 16px 0 14px",
          height: 60,
          position: "sticky",
          top: 0,
          zIndex: 300,
          boxShadow: "0 1px 0 var(--border-default)",
        }}
      >
        {/* Logo + Brand */}
        <button
          onClick={() => router.push("/platform")}
          aria-label="Home"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            flexShrink: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              src="/fidelis-logo.png"
              alt="Fidelis"
              width={28}
              height={28}
              className="object-contain"
              style={{ filter: "drop-shadow(0 0 6px rgba(229,82,26,0.5))" }}
              priority
            />
          </div>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#E5521A",
                letterSpacing: "-0.4px",
                lineHeight: 1.1,
              }}
            >
              Fidelis
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              IntelliDepot™
            </div>
          </div>
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User scope label */}
        {userScopeLabel && (
          <span
            className="hidden md:block"
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text-muted)",
              padding: "4px 10px",
              borderRadius: 6,
              background: "var(--bg-nav-item)",
              border: "1px solid var(--border-default)",
              whiteSpace: "nowrap",
            }}
          >
            {userScopeLabel}
          </span>
        )}

        {/* LIVE badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 14px",
            borderRadius: 99,
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.2)",
            fontSize: 14,
            fontWeight: 700,
            color: "#22C55E",
            letterSpacing: "0.04em",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#22C55E",
              display: "inline-block",
              animation: "blink-dot 1.4s ease-in-out infinite",
            }}
          />
          LIVE
        </div>

        {/* Theme toggle */}
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>

        {/* Refresh */}
        <button
          title="Refresh page"
          onClick={() => window.location.reload()}
          style={{
            width: 34,
            height: 34,
            borderRadius: 7,
            border: "1px solid var(--border-default)",
            background: "transparent",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#E5521A";
            (e.currentTarget as HTMLButtonElement).style.color = "#E5521A";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
          }}
        >
          <RefreshCw size={16} />
        </button>

        {/* Alerts bell */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            title="Alerts & Incidents"
            style={{
              width: 34,
              height: 34,
              borderRadius: 7,
              border: "1px solid var(--border-default)",
              background: "transparent",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#E5521A";
              (e.currentTarget as HTMLButtonElement).style.color = "#E5521A";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
          >
            <Bell size={16} />
          </button>
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              width: 16,
              height: 16,
              borderRadius: 99,
              background: "#991B1B",
              color: "#fff",
              fontSize: 9,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--bg-nav)",
            }}
          >
            3
          </span>
        </div>

        {/* Desktop: User info + Logout */}
        <div className="hidden md:flex items-center gap-2">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 12px",
              borderRadius: 8,
              background: "var(--bg-nav-item)",
              border: "1px solid var(--border-default)",
            }}
          >
            <User size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-primary)",
                maxWidth: 160,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user?.email || "User"}
            </span>
          </div>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            title="Sign out"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 8,
              border: "1px solid rgba(220,38,38,0.25)",
              background: "rgba(220,38,38,0.06)",
              color: "#DC2626",
              fontSize: 14,
              fontWeight: 700,
              cursor: isLoggingOut ? "not-allowed" : "pointer",
              opacity: isLoggingOut ? 0.7 : 1,
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {isLoggingOut ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <LogOut size={14} />
            )}
            {isLoggingOut ? "Signing out…" : "Logout"}
          </button>
        </div>

        {/* Avatar (mobile) */}
        <div
          className="md:hidden"
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: "linear-gradient(135deg, #C43A08, #E5521A)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: "1px solid rgba(229,82,26,0.3)",
            cursor: "pointer",
          }}
          title={user?.email ?? "User"}
        >
          {userInitials}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden"
          style={{
            width: 34,
            height: 34,
            borderRadius: 7,
            border: "1px solid var(--border-default)",
            background: "transparent",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {/* ══ Mobile Menu ══ */}
      {mobileMenuOpen && (
        <div
          className="md:hidden"
          style={{
            background: "var(--bg-nav)",
            borderBottom: "1px solid var(--border-default)",
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 8,
              background: "var(--bg-nav-item)",
              border: "1px solid var(--border-default)",
              marginBottom: 10,
            }}
          >
            <User size={16} style={{ color: "var(--text-muted)" }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                {user?.email || "User"}
              </div>
              {userScopeLabel && (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{userScopeLabel}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <ThemeToggle />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Switch Theme</span>
          </div>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px",
              borderRadius: 9,
              border: "1px solid rgba(220,38,38,0.25)",
              background: "rgba(220,38,38,0.08)",
              color: "#DC2626",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
            {isLoggingOut ? "Signing out…" : "Logout"}
          </button>
        </div>
      )}

      {/* Blink animation */}
      <style>{`
        @keyframes blink-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}
