"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, RefreshCw } from "lucide-react";
import { DEPOTS } from "@/lib/depot-data";

export default function DepotTopBar({
  toggleSidebar,
}: {
  toggleSidebar: () => void;
}) {
  const router = useRouter();
  const [depot, setDepot] = useState("MUM-001");

  return (
    <header className="fixed top-0 left-0 right-0 h-[52px] bg-[#0D1526] border-b border-[#1E2F50] flex items-center px-3 sm:px-4 gap-2 sm:gap-3 z-50">
      
      {/* 🔥 Mobile Hamburger */}
      <button
        onClick={toggleSidebar}
        className="md:hidden w-8 h-8 flex items-center justify-center text-white text-lg"
      >
        ☰
      </button>

      {/* Logo */}
      <button
        onClick={() => router.push("/depot")}
        className="flex items-center gap-2 flex-shrink-0"
      >
        <div className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-[#C43A08] to-[#E5521A] flex items-center justify-center shadow-[0_0_8px_rgba(229,82,26,0.5)]">
          <span className="text-white text-xs font-extrabold">F</span>
        </div>
        <div className="flex flex-col leading-none">
          <span
            className="text-[#E5521A] font-extrabold text-[14px] sm:text-[16px] tracking-tight"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            Fidelis
          </span>
          <span className="text-[7px] sm:text-[8px] text-[#8A9BBF] font-semibold tracking-[0.12em] uppercase">
            IntelliDepot™
          </span>
        </div>
      </button>

      {/* Divider */}
      <div className="hidden sm:block w-px h-7 bg-[#1E2F50] flex-shrink-0" />

      {/* Depot selector */}
      <select
        value={depot}
        onChange={(e) => setDepot(e.target.value)}
        className="px-2 py-1.5 bg-[#0F1A30] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[10px] sm:text-[11px] font-semibold cursor-pointer outline-none focus:border-[#E5521A]"
      >
        {DEPOTS.map((d) => (
          <option key={d.id} value={d.id}>
            📍 {d.name}
          </option>
        ))}
      </select>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Live pill (hidden on very small screens) */}
      <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#22D3A1]/8 border border-[#22D3A1]/20 text-[10px] font-bold text-[#22D3A1]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#22D3A1] animate-pulse" />
        LIVE
      </div>

      {/* Refresh */}
      <button className="w-8 h-8 rounded-lg border border-[#1E2F50] text-[#8A9BBF] hover:border-[#E5521A] hover:text-[#E5521A] flex items-center justify-center transition">
        <RefreshCw className="w-3.5 h-3.5" />
      </button>

      {/* Alerts */}
      <button
        onClick={() => router.push("/depot/incidents")}
        className="relative w-8 h-8 rounded-lg border border-[#1E2F50] text-[#8A9BBF] hover:border-[#E5521A] hover:text-[#E5521A] flex items-center justify-center transition"
      >
        <Bell className="w-3.5 h-3.5" />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#F04A4A] text-white text-[8px] font-extrabold flex items-center justify-center">
          3
        </span>
      </button>

      {/* User */}
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C43A08] to-[#E5521A] flex items-center justify-center text-[12px] sm:text-[13px] font-extrabold text-white cursor-pointer flex-shrink-0">
        OP
      </div>
    </header>
  );
}