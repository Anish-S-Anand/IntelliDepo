"use client";

import { useState } from "react";
import Link from "next/link";
import CameraGrid from "@/components/depot/cameras/CameraGrid";
import AlertPanel from "@/components/depot/operations/AlertPanel";
import { AlertTriangle, BarChart3 } from "lucide-react";

export default function VisionRoute() {
  const [alertPanelOpen, setAlertPanelOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  return (
    <>
      <CameraGrid />

      {/* Floating buttons */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
        <Link
          href="/depot/vision/results"
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-cyan-500/30 bg-[#14203A] text-cyan-400 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:bg-[#1A2A4A] transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          <span className="text-[12px] font-semibold">Results</span>
        </Link>
        <button
          type="button"
          onClick={() => setAlertPanelOpen(!alertPanelOpen)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#F5A623]/30 bg-[#14203A] text-[#F5A623] shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:bg-[#1A2A4A] transition-colors"
        >
          <AlertTriangle className="w-4 h-4" />
          <span className="text-[12px] font-semibold">Alerts</span>
          {alertCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-[#F04A4A] text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
              {alertCount}
            </span>
          )}
        </button>
      </div>

      {/* Alert panel sidebar */}
      <AlertPanel
        isOpen={alertPanelOpen}
        onClose={() => setAlertPanelOpen(false)}
        onAlertCountChange={setAlertCount}
      />
    </>
  );
}
