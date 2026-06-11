"use client";

import { useState, useEffect } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import DepotTopBar from "@/components/depot/layout/DepotTopBar";
import DepotSidebar from "@/components/depot/layout/DepotSidebar";
import BroadcastBanner from "@/components/depot/layout/BroadcastBanner";
import { IncidentNotificationProvider } from "@/components/notifications/IncidentNotificationProvider";

export default function DepotLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <AuthGuard>
      <IncidentNotificationProvider>
        <div
          className="min-h-screen theme-transition"
          style={{ backgroundColor: "var(--bg-page)", color: "var(--text-primary)" }}
        >
          {/* Top Navigation — fixed, full width */}
          <DepotTopBar toggleSidebar={() => setSidebarOpen((prev) => !prev)} />

          {/* Sidebar overlay for mobile */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-30 md:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Sidebar */}
          <DepotSidebar
            open={sidebarOpen}
            collapsed={sidebarCollapsed}
            onClose={() => setSidebarOpen(false)}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          />

          {/* Global broadcast banner — shows on all depot pages when a broadcast is sent */}
          <BroadcastBanner />

          {/* Main Content */}
          <main
            className={`pt-[64px] min-h-[100vh] theme-transition depot-page-transition ${sidebarCollapsed ? "md:ml-[72px]" : "md:ml-[204px]"}`}
            style={{ backgroundColor: "var(--bg-page)" }}
          >
            {/* Responsive padding: tight on mobile, comfortable on desktop */}
            <div className="px-2 sm:px-3 md:px-4 lg:px-4 xl:px-5 py-3 sm:py-4">
              {children}
            </div>
          </main>
        </div>
      </IncidentNotificationProvider>
    </AuthGuard>
  );
}
