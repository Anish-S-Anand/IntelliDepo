"use client";

import DepotSidebar from "./DepotSidebar";
import DepotTopBar from "./DepotTopBar";

export default function DepotLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0E1A]" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <DepotTopBar />
      <DepotSidebar />
      <main className="ml-16 mt-[52px] min-h-[calc(100vh-52px)] overflow-auto relative">
        {children}
        {/* Footer */}
        <footer className="border-t border-[#1E2F50] px-5 py-3 flex justify-between items-center flex-wrap gap-2 text-[10px] text-[#4E6090] bg-[#0D1526] relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-[18px] h-[18px] rounded bg-gradient-to-br from-[#C43A08] to-[#E5521A] flex items-center justify-center opacity-70">
              <span className="text-white text-[8px] font-bold">F</span>
            </div>
            <span>Fidelis IntelliDepot™ — AI-Powered Depot Intelligence Platform</span>
          </div>
          <div className="flex gap-3.5">
            <span>v2.4.1</span>
            <span>India · UAE · Saudi Arabia</span>
            <span className="text-[#22D3A1]">● All Systems Operational</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
