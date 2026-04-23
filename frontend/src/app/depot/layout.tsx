"use client";

import { useState } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import DepotTopBar from "@/components/depot/layout/DepotTopBar";
import DepotSidebar from "@/components/depot/layout/DepotSidebar";

export default function DepotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthGuard>
      {/* Top Navigation */}
      <DepotTopBar
        toggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />

      {/* Sidebar */}
      <DepotSidebar open={sidebarOpen} />

      {/* Main Content */}
      <main className="pt-[52px] md:ml-16 transition-all duration-300">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          {children}
        </div>
      </main>
    </AuthGuard>
  );
}