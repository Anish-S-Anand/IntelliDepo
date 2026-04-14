"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  Truck,
  AlertTriangle,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduleEntry {
  id: string;
  dock_id: string;
  vehicle_id: string | null;
  client_name: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  delay_risk: boolean;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Mock Data — one week of dock schedules
// ---------------------------------------------------------------------------

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

const DOCKS = ["DOCK-A1", "DOCK-A2", "DOCK-B1", "DOCK-B2", "DOCK-C1", "DOCK-C2", "DOCK-D1", "DOCK-D2"];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const SLOT_H = 36; // px per hour

function baseDate(dayOffset: number, hour: number, min = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1 + dayOffset); // Monday = 0
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

const MOCK_SCHEDULES: ScheduleEntry[] = [
  { id: genId(), dock_id: "DOCK-A1", vehicle_id: "TRK-1001", client_name: "Acme Corp", scheduled_start: baseDate(0, 6), scheduled_end: baseDate(0, 10), status: "completed", delay_risk: false, notes: null },
  { id: genId(), dock_id: "DOCK-A1", vehicle_id: "TRK-1004", client_name: "Global Logistics", scheduled_start: baseDate(0, 12), scheduled_end: baseDate(0, 16), status: "active", delay_risk: false, notes: null },
  { id: genId(), dock_id: "DOCK-A2", vehicle_id: "TRK-1002", client_name: "FreshCo", scheduled_start: baseDate(0, 8), scheduled_end: baseDate(0, 12), status: "active", delay_risk: true, notes: "Running 45 min behind" },
  { id: genId(), dock_id: "DOCK-B1", vehicle_id: "VAN-2001", client_name: "QuickShip", scheduled_start: baseDate(0, 14), scheduled_end: baseDate(0, 17), status: "scheduled", delay_risk: false, notes: null },
  { id: genId(), dock_id: "DOCK-B2", vehicle_id: "TRK-1005", client_name: "Metro Supply", scheduled_start: baseDate(0, 7), scheduled_end: baseDate(0, 11), status: "completed", delay_risk: false, notes: null },
  { id: genId(), dock_id: "DOCK-C1", vehicle_id: "TRK-1006", client_name: "ColdChain Inc", scheduled_start: baseDate(0, 5), scheduled_end: baseDate(0, 13), status: "active", delay_risk: true, notes: "Extended loading — refrigerated cargo" },
  { id: genId(), dock_id: "DOCK-C2", vehicle_id: "TRK-1003", client_name: "FreshCo", scheduled_start: baseDate(0, 16), scheduled_end: baseDate(0, 20), status: "scheduled", delay_risk: false, notes: null },
  { id: genId(), dock_id: "DOCK-A1", vehicle_id: "TRL-3001", client_name: "BigHaul", scheduled_start: baseDate(1, 6), scheduled_end: baseDate(1, 14), status: "scheduled", delay_risk: false, notes: null },
  { id: genId(), dock_id: "DOCK-B1", vehicle_id: "TRK-1002", client_name: "Metro Supply", scheduled_start: baseDate(1, 9), scheduled_end: baseDate(1, 13), status: "scheduled", delay_risk: false, notes: null },
  { id: genId(), dock_id: "DOCK-B2", vehicle_id: null, client_name: "PeakHour Reserve", scheduled_start: baseDate(1, 11), scheduled_end: baseDate(1, 14), status: "scheduled", delay_risk: false, notes: "Peak-hour advance booking" },
  { id: genId(), dock_id: "DOCK-A2", vehicle_id: "TRK-1004", client_name: "Global Logistics", scheduled_start: baseDate(2, 7), scheduled_end: baseDate(2, 12), status: "scheduled", delay_risk: false, notes: null },
  { id: genId(), dock_id: "DOCK-C1", vehicle_id: "TRK-1003", client_name: "ColdChain Inc", scheduled_start: baseDate(2, 14), scheduled_end: baseDate(2, 20), status: "scheduled", delay_risk: false, notes: null },
  { id: genId(), dock_id: "DOCK-D2", vehicle_id: "VAN-2001", client_name: "QuickShip", scheduled_start: baseDate(3, 8), scheduled_end: baseDate(3, 11), status: "scheduled", delay_risk: false, notes: null },
  { id: genId(), dock_id: "DOCK-A1", vehicle_id: "TRK-1001", client_name: "Acme Corp", scheduled_start: baseDate(4, 6), scheduled_end: baseDate(4, 10), status: "scheduled", delay_risk: false, notes: null },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: "bg-blue-500/20", text: "text-blue-400" },
  active:    { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  completed: { bg: "bg-gray-600/30", text: "text-gray-400" },
  cancelled: { bg: "bg-red-500/20", text: "text-red-400" },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function dayIndex(iso: string): number {
  const d = new Date(iso).getDay(); // 0=Sun
  return d === 0 ? 6 : d - 1; // convert to Mon=0
}

// ---------------------------------------------------------------------------
// Booking Modal
// ---------------------------------------------------------------------------

function BookingModal({ docks, onClose, onBook }: {
  docks: string[];
  onClose: () => void;
  onBook: (entry: ScheduleEntry) => void;
}) {
  const [dock, setDock] = useState(docks[0]);
  const [vehicleId, setVehicleId] = useState("");
  const [client, setClient] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startHour, setStartHour] = useState(9);
  const [duration, setDuration] = useState(4);

  const handleSubmit = async () => {
    const start = new Date(`${date}T${String(startHour).padStart(2, "0")}:00:00`);
    const end = new Date(start.getTime() + duration * 3600000);
    const payload = {
      dock_id: dock,
      vehicle_id: vehicleId || null,
      client_name: client || null,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      notes: null,
    };

    // Try backend first
    try {
      const { createDockSchedule } = await import("@/services/depotOps");
      const created = await createDockSchedule(payload);
      onBook({
        id: created.id,
        dock_id: created.dock_id,
        vehicle_id: created.vehicle_id,
        client_name: created.client_name,
        scheduled_start: created.scheduled_start,
        scheduled_end: created.scheduled_end,
        status: created.status,
        delay_risk: created.delay_risk,
        notes: created.notes,
      });
      onClose();
      return;
    } catch { /* fall through to local */ }

    // Fallback: local-only booking
    onBook({
      id: genId(),
      dock_id: dock,
      vehicle_id: vehicleId || null,
      client_name: client || null,
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      status: "scheduled",
      delay_risk: false,
      notes: null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-[#1E2F50] bg-[#14203A] p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white">Book Dock Slot</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <label className="block text-gray-400 mb-1">Dock</label>
            <select value={dock} onChange={(e) => setDock(e.target.value)} className="w-full rounded-lg bg-[#0D1526] border border-[#1E2F50] px-3 py-2 text-white">
              {docks.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Vehicle ID</label>
            <input value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} placeholder="e.g. TRK-1001" className="w-full rounded-lg bg-[#0D1526] border border-[#1E2F50] px-3 py-2 text-white placeholder:text-gray-600" />
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Client</label>
            <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g. Acme Corp" className="w-full rounded-lg bg-[#0D1526] border border-[#1E2F50] px-3 py-2 text-white placeholder:text-gray-600" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-gray-400 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg bg-[#0D1526] border border-[#1E2F50] px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Start Hour</label>
              <select value={startHour} onChange={(e) => setStartHour(+e.target.value)} className="w-full rounded-lg bg-[#0D1526] border border-[#1E2F50] px-3 py-2 text-white">
                {HOURS.filter((h) => h >= 5 && h <= 22).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Duration (h)</label>
              <select value={duration} onChange={(e) => setDuration(+e.target.value)} className="w-full rounded-lg bg-[#0D1526] border border-[#1E2F50] px-3 py-2 text-white">
                {[1, 2, 3, 4, 6, 8].map((d) => <option key={d} value={d}>{d}h</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[#1E2F50] text-gray-400 hover:text-white text-sm">Cancel</button>
          <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-[#E5521A] text-white text-sm font-medium hover:bg-[#c74516]">Book Slot</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DockSchedulePage() {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>(MOCK_SCHEDULES);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0); // Mon=0
  const [showBooking, setShowBooking] = useState(false);

  // Fetch schedules from backend (F-067)
  const fetchSchedules = useCallback(async (offset: number) => {
    try {
      const { getDockSchedules } = await import("@/services/depotOps");
      const data = await getDockSchedules(offset);
      if (data.length > 0) {
        setSchedules((prev) => {
          const backendIds = new Set(data.map((s) => s.id));
          const localOnly = prev.filter((s) => !backendIds.has(s.id) && s.id.length < 20);
          return [...data.map((s) => ({
            id: s.id,
            dock_id: s.dock_id,
            vehicle_id: s.vehicle_id,
            client_name: s.client_name,
            scheduled_start: s.scheduled_start,
            scheduled_end: s.scheduled_end,
            status: s.status,
            delay_risk: s.delay_risk,
            notes: s.notes,
          })), ...localOnly];
        });
        return;
      }
    } catch { /* fallback to mock */ }
  }, []);

  useEffect(() => {
    fetchSchedules(weekOffset);
  }, [weekOffset, fetchSchedules]);

  const weekDates = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7);
    return DAYS.map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  const daySchedules = useMemo(() => {
    return schedules.filter((s) => {
      const d = new Date(s.scheduled_start);
      const wd = weekDates[selectedDay];
      return d.getFullYear() === wd.getFullYear() && d.getMonth() === wd.getMonth() && d.getDate() === wd.getDate();
    });
  }, [schedules, selectedDay, weekDates]);

  // Group by dock
  const byDock = useMemo(() => {
    const map: Record<string, ScheduleEntry[]> = {};
    for (const d of DOCKS) map[d] = [];
    for (const s of daySchedules) {
      if (!map[s.dock_id]) map[s.dock_id] = [];
      map[s.dock_id].push(s);
    }
    return map;
  }, [daySchedules]);

  const isPeakHour = (h: number) => h >= 10 && h <= 14;

  const addBooking = (entry: ScheduleEntry) => {
    setSchedules((prev) => [...prev, entry]);
  };

  const totalBookings = daySchedules.length;
  const delayRisks = daySchedules.filter((s) => s.delay_risk).length;
  const utilizationPct = Math.round((daySchedules.length / (DOCKS.length * 3)) * 100); // rough est

  return (
    <div className="min-h-screen bg-[#0D1526] text-white px-6 py-5 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dock Scheduling</h1>
          <p className="text-sm text-gray-400 mt-0.5">F-067 — Weekly dock schedule grid, advance booking, delay risk flags</p>
        </div>
        <button
          onClick={() => setShowBooking(true)}
          className="flex items-center gap-2 rounded-lg bg-[#E5521A] px-4 py-2 text-sm font-medium hover:bg-[#c74516] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Book Slot
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-blue-500/20 text-blue-400"><Calendar className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Bookings Today</p>
            <p className="text-xl font-bold">{totalBookings}</p>
          </div>
        </div>
        <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-amber-500/20 text-amber-400"><AlertTriangle className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Delay Risks</p>
            <p className="text-xl font-bold">{delayRisks}</p>
          </div>
        </div>
        <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] p-4 flex items-center gap-3">
          <div className="rounded-lg p-2 bg-emerald-500/20 text-emerald-400"><Truck className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Dock Utilization</p>
            <p className="text-xl font-bold">{utilizationPct}%</p>
          </div>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => setWeekOffset((w) => w - 1)} className="p-1.5 rounded-lg border border-[#1E2F50] hover:bg-[#1E2F50]">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex gap-1 rounded-xl border border-[#1E2F50] bg-[#14203A] p-1">
          {DAYS.map((day, i) => {
            const d = weekDates[i];
            const isToday = new Date().toDateString() === d.toDateString();
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(i)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedDay === i
                    ? "bg-[#E5521A] text-white"
                    : isToday
                    ? "text-[#E5521A] font-bold"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {day} {d.getDate()}
              </button>
            );
          })}
        </div>
        <button onClick={() => setWeekOffset((w) => w + 1)} className="p-1.5 rounded-lg border border-[#1E2F50] hover:bg-[#1E2F50]">
          <ChevronRight className="w-4 h-4" />
        </button>
        {weekOffset !== 0 && (
          <button onClick={() => { setWeekOffset(0); setSelectedDay(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1); }} className="text-xs text-[#E5521A] hover:underline">
            Today
          </button>
        )}
      </div>

      {/* Schedule Grid */}
      <div className="rounded-xl border border-[#1E2F50] bg-[#14203A] overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header row */}
          <div className="grid border-b border-[#1E2F50]" style={{ gridTemplateColumns: "80px repeat(8, 1fr)" }}>
            <div className="px-3 py-2 text-xs text-gray-500 font-medium">Hour</div>
            {DOCKS.map((d) => (
              <div key={d} className="px-2 py-2 text-xs text-gray-400 font-mono font-medium text-center border-l border-[#1E2F50]">
                {d}
              </div>
            ))}
          </div>

          {/* Time slots */}
          <div className="relative">
            {HOURS.filter((h) => h >= 5 && h <= 22).map((h) => (
              <div key={h} className="grid border-b border-[#1E2F50]/50" style={{ gridTemplateColumns: "80px repeat(8, 1fr)", height: SLOT_H }}>
                <div className={`px-3 flex items-center text-xs font-mono ${isPeakHour(h) ? "text-[#E5521A] font-bold" : "text-gray-500"}`}>
                  {String(h).padStart(2, "0")}:00
                  {isPeakHour(h) && <span className="ml-1 text-[8px] text-[#E5521A]/60">PEAK</span>}
                </div>
                {DOCKS.map((d) => {
                  const slot = byDock[d]?.find((s) => {
                    const sh = new Date(s.scheduled_start).getHours();
                    const eh = new Date(s.scheduled_end).getHours();
                    return h >= sh && h < eh;
                  });
                  const isStart = slot && new Date(slot.scheduled_start).getHours() === h;
                  const style = slot ? STATUS_STYLE[slot.status] || STATUS_STYLE.scheduled : null;

                  return (
                    <div key={d} className={`border-l border-[#1E2F50]/30 px-1 ${isPeakHour(h) ? "bg-[#E5521A]/5" : ""}`}>
                      {isStart && slot && (
                        <div className={`rounded px-1.5 py-0.5 text-[10px] leading-tight ${style?.bg} ${style?.text} border border-current/20 relative`}>
                          <div className="font-medium truncate">{slot.vehicle_id || "Reserved"}</div>
                          <div className="truncate opacity-70">{slot.client_name}</div>
                          {slot.delay_risk && (
                            <AlertTriangle className="w-3 h-3 text-amber-400 absolute top-0.5 right-0.5" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delay Risk entries */}
      {delayRisks > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Delay Risk Entries
          </h3>
          <div className="space-y-2">
            {daySchedules.filter((s) => s.delay_risk).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-amber-400">{s.dock_id}</span>
                  <span>{s.vehicle_id}</span>
                  <span className="text-gray-500">{s.client_name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{formatTime(s.scheduled_start)} — {formatTime(s.scheduled_end)}</span>
                  {s.notes && <span className="text-amber-400/70 italic">{s.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showBooking && (
        <BookingModal docks={DOCKS} onClose={() => setShowBooking(false)} onBook={addBooking} />
      )}
    </div>
  );
}
