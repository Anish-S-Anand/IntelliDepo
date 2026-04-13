"use client";

import { useState } from "react";
import DashboardKPIStrip from "@/components/stream/macropulse/live-monitoring/DashboardKPIStrip";
import GeoDepotMap from "@/components/stream/macropulse/live-monitoring/GeoDepotMap";
import IncidentDetailModal from "@/components/stream/macropulse/live-monitoring/IncidentDetailModal";
import AlertPriorityFeed from "@/components/stream/macropulse/live-monitoring/AlertPriorityFeed";
import type { DepotEvent } from "@/components/stream/macropulse/live-monitoring/GeoDepotMap";

export default function LiveMonitoringPage() {
  const [selectedEvent, setSelectedEvent] = useState<DepotEvent | null>(null);

  return (
    <div className="flex flex-col gap-5 px-6 py-5 lg:px-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Live Monitoring</h2>
        <p className="mt-1 text-xs text-[#8A9BBF]">
          Multi-feed dashboard · threshold alerts · geo-view depot map · priority alert feed
        </p>
      </div>

      {/* F-054: Multi-feed Dashboard KPI strip */}
      <DashboardKPIStrip />

      {/* F-057 + F-058: Geo-map + incident drill-down */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <GeoDepotMap onEventClick={setSelectedEvent} />
        </div>

        {/* F-056: Alert Priority Feed */}
        <div className="rounded-[16px] border border-[#1E2F50] bg-[#0F1A30] p-4">
          <AlertPriorityFeed maxItems={15} />
        </div>
      </div>

      {/* F-058: Incident detail modal */}
      {selectedEvent && (
        <IncidentDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
