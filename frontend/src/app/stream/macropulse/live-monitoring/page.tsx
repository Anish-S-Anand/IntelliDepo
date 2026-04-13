"use client";

import { useState } from "react";
import GeoDepotMap from "@/components/stream/macropulse/live-monitoring/GeoDepotMap";
import IncidentDetailModal from "@/components/stream/macropulse/live-monitoring/IncidentDetailModal";
import type { DepotEvent } from "@/components/stream/macropulse/live-monitoring/GeoDepotMap";

export default function LiveMonitoringPage() {
  const [selectedEvent, setSelectedEvent] = useState<DepotEvent | null>(null);

  return (
    <div className="flex flex-col gap-5 px-6 py-5 lg:px-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Live Monitoring</h2>
        <p className="mt-1 text-xs text-slate-500">
          Geo-view depot floor plan · live event markers · click any zone to drill in
        </p>
      </div>

      <GeoDepotMap onEventClick={setSelectedEvent} />

      {selectedEvent && (
        <IncidentDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
