"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, AlertTriangle, Camera, Shield, BellRing, DoorOpen, DoorClosed, Phone } from "lucide-react";
import { getActiveIncidents, type IncidentResponse } from "@/services/depotPerimeter";
import {
  getDepotCommandSnapshot,
  openCommandGate,
  closeCommandGate,
  triggerCommandAlert,
  contactCommandOperator,
  type CameraRecord,
  type GateRecord,
  type CommandActionResponse,
} from "@/services/depotCommand";

export default function CommandPage() {
  const [incidents, setIncidents] = useState<IncidentResponse[]>([]);
  const [cameras, setCameras] = useState<CameraRecord[]>([]);
  const [gates, setGates] = useState<GateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);

  const showFeedback = (msg: string, ok = true) => {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 3000);
  };

  const runAction = async (key: string, fn: () => Promise<CommandActionResponse>, successMsg: string) => {
    setActionLoading(key);
    try {
      await fn();
      showFeedback(successMsg, true);
    } catch {
      showFeedback("Action failed — check connection", false);
    } finally {
      setActionLoading(null);
    }
  };

  const fetchAll = useCallback(async () => {
    const [incRes, snapRes] = await Promise.allSettled([
      getActiveIncidents(),
      getDepotCommandSnapshot(),
    ]);
    if (incRes.status === "fulfilled") setIncidents(incRes.value);
    if (snapRes.status === "fulfilled") {
      setCameras(snapRes.value.cameras.data);
      setGates(snapRes.value.gates.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchAll();
    const interval = setInterval(() => void fetchAll(), 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const activeCameras = cameras.filter((c) => c.status === "active");
  const openGates = gates.filter((g) => g.status === "open");
  const openIncidents = incidents.filter((i) => i.status === "open" || i.status === "escalated");
  const criticalIncidents = incidents.filter((i) => i.severity === "critical");

  // Group cameras by zone for the depot overview cards
  const zoneMap = new Map<string, CameraRecord[]>();
  for (const cam of cameras) {
    const zone = cam.zone || "Unassigned";
    if (!zoneMap.has(zone)) zoneMap.set(zone, []);
    zoneMap.get(zone)!.push(cam);
  }
  const zones = Array.from(zoneMap.entries()).slice(0, 6);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5521a] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      <div className="mb-5">
        <h1 className="text-[22px] font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
          Command Center
        </h1>
        <p className="text-[11px] text-[#8A9BBF] mt-0.5">
          Live depot overview — cameras, gates, and incident feed
        </p>
      </div>

      {/* Quick Actions */}
      <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-[#E5521A]" />
            <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>Quick Actions</span>
          </div>
          {feedback && (
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${feedback.ok ? "bg-[#22D3A1]/15 text-[#22D3A1]" : "bg-[#F04A4A]/15 text-[#F04A4A]"}`}>
              {feedback.msg}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              key: "open-gate",
              icon: DoorOpen,
              label: "Open Gate",
              sub: gates.find((g) => g.status !== "open")?.name ?? gates[0]?.name ?? "No gates",
              color: "#22D3A1",
              fn: () => openCommandGate(gates.find((g) => g.status !== "open")?.id),
              successMsg: `${gates.find((g) => g.status !== "open")?.name ?? "Gate"} opened`,
            },
            {
              key: "close-gate",
              icon: DoorClosed,
              label: "Close Gate",
              sub: gates.find((g) => g.status === "open")?.name ?? "All closed",
              color: "#F5A623",
              fn: () => closeCommandGate(gates.find((g) => g.status === "open")?.id),
              successMsg: `${gates.find((g) => g.status === "open")?.name ?? "Gate"} closed`,
            },
            {
<<<<<<< HEAD
=======
              key: "lock-zone",
              icon: Lock,
              label: "Lock Zone",
              sub: "Initiate lockdown",
              color: "#F04A4A",
              fn: () => lockCommandZone(openIncidents[0]?.zone_id ?? "Depot perimeter"),
              successMsg: "Zone lockdown initiated",
            },
            {
>>>>>>> e424b85a2d0a280b5c3ec0f0a7eb1c465f2fcf25
              key: "trigger-alert",
              icon: BellRing,
              label: "Trigger Alert",
              sub: "Broadcast to all",
              color: "#E5521A",
              fn: triggerCommandAlert,
              successMsg: "Manual alert triggered",
            },
            {
              key: "contact",
              icon: Phone,
              label: "Contact Operator",
              sub: "Page via intercom",
              color: "#5B9BF5",
              fn: contactCommandOperator,
              successMsg: "Operator paged via intercom",
            },
          ].map((action) => {
            const Icon = action.icon;
            const isLoading = actionLoading === action.key;
            return (
              <button
                key={action.key}
                onClick={() => runAction(action.key, action.fn, action.successMsg)}
                disabled={!!actionLoading}
                className="flex min-h-[112px] flex-col items-center justify-center gap-2.5 rounded-[12px] border-2 border-[#33476C] bg-[#101D34] px-4 py-5 shadow-[0_8px_22px_rgba(2,8,23,0.18)] transition-all hover:border-[#4A628E] hover:bg-[#1A2A45] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${action.color}20`, border: `1.5px solid ${action.color}55` }}>
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: action.color, borderTopColor: "transparent" }} />
                  ) : (
                    <Icon className="h-5 w-5 stroke-[2.75]" style={{ color: action.color }} />
                  )}
                </div>
                <div className="text-center">
                  <div className="text-[12px] font-extrabold" style={{ color: action.color }}>{action.label}</div>
                  <div className="mt-1 text-[10px] font-bold text-[#8B9BC1]">{action.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { icon: Camera, label: "Active Cameras", value: `${activeCameras.length}/${cameras.length}`, color: "#22D3A1" },
          { icon: Shield, label: "Open Gates", value: String(openGates.length), color: openGates.length > 0 ? "#F5A623" : "#22D3A1" },
          { icon: AlertTriangle, label: "Open Incidents", value: String(openIncidents.length), color: openIncidents.length > 0 ? "#F04A4A" : "#22D3A1" },
          { icon: Activity, label: "Critical", value: String(criticalIncidents.length), color: criticalIncidents.length > 0 ? "#F04A4A" : "#22D3A1" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${s.color}15`, border: `1px solid ${s.color}30` }}>
                <Icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-[22px] font-extrabold leading-none" style={{ color: s.color, fontFamily: "'Syne', sans-serif" }}>{s.value}</div>
                <div className="text-[10px] text-[#8A9BBF] mt-0.5">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Zone / Camera Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 mb-5">
        {zones.map(([zoneName, cams]) => {
          const activeCams = cams.filter((c) => c.status === "active").length;
          const health = cams.length > 0 ? Math.round((activeCams / cams.length) * 100) : 0;
          const col = health >= 90 ? "#22D3A1" : health >= 60 ? "#F5A623" : "#F04A4A";
          return (
            <div
              key={zoneName}
              className="bg-[#14203A] border-[1.5px] border-[#1E2F50] rounded-[14px] p-[18px] transition-all hover:bg-[#E5521A]/3 hover:border-[#2A3F68]"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-[15px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                    {zoneName}
                  </div>
                  <div className="text-[10px] text-[#8A9BBF] mt-0.5">{cams.length} camera{cams.length !== 1 ? "s" : ""}</div>
                </div>
                <div
                  className="w-[42px] h-[42px] rounded-full flex items-center justify-center border-2 text-[10px] font-extrabold flex-shrink-0"
                  style={{ borderColor: col, color: col, fontFamily: "'Syne', sans-serif" }}
                >
                  {health}%
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] mb-2.5">
                <span className="text-[#4E6090]">Active</span>
                <span className="font-bold text-[#E8EDF8]">{activeCams}/{cams.length}</span>
                <span className="text-[#4E6090]">Protocol</span>
                <span className="font-bold text-[#E8EDF8]">{cams[0]?.protocol?.toUpperCase() || "—"}</span>
              </div>
              <div className="w-full h-1 bg-[#1E2F50] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${health}%`, background: col }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Gate Status */}
      {gates.length > 0 && (
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px] mb-5">
          <div className="text-[13px] font-bold text-[#E8EDF8] mb-3.5">Gate Status</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {gates.map((g) => {
              const col = g.status === "open" ? "#F5A623" : g.status === "closed" ? "#22D3A1" : "#F04A4A";
              return (
                <div key={g.id} className="bg-[#0F1A30] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-[#E8EDF8]">{g.name}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${col}20`, color: col }}>
                      {g.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#4E6090]">{g.total_entries_today} entries today</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      </div>
  );
}
