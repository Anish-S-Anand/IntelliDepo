"use client";

import DepotSidebar from "./DepotSidebar";

export default function DepotLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#eef1f5] lg:h-screen lg:overflow-hidden">
      <DepotSidebar />
      <main className="ml-56 min-w-0 flex-1 lg:h-screen lg:overflow-auto">
        {children}
      </main>
    </div>
  );
}
