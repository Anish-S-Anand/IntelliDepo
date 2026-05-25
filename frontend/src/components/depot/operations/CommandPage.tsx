"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Camera,
  ChevronDown,
  DoorClosed,
  DoorOpen,
  Gauge,
  Layers,
  PackageCheck,
  Phone,
  Radio,
  RefreshCw,
  Send,
  Shield,
  Truck,
  X,
} from "lucide-react";
import {
  closeCommandGate,
  contactCommandOperator,
  getCommandCenterSnapshot,
  openCommandGate,
  triggerCommandAlert,
  type CommandActionResponse,
  type CommandCenterSnapshot,
  type CommandGateSummary,
  type CommandKpi,
} from "@/services/depotCommand";
import { useDepotCommandEvents } from "@/hooks/useDepotCommandEvents";

const TONE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  healthy: { color: "#22D3A1", bg: "rgba(34,211,161,0.12)", border: "rgba(34,211,161,0.28)" },
  warning: { color: "#F5A623", bg: "rgba(245,166,35,0.12)", border: "rgba(245,166,35,0.28)" },
  critical: { color: "#F04A4A", bg: "rgba(240,74,74,0.12)", border: "rgba(240,74,74,0.28)" },
  normal: { color: "#5B9BF5", bg: "rgba(91,155,245,0.12)", border: "rgba(91,155,245,0.28)" },
};

const KPI_ICONS: Record<string, typeof Camera> = {
  cameras: Camera,
  gates: Shield,
  incidents: AlertTriangle,
  inventory: PackageCheck,
  zones: Layers,
  access: Truck,
};

function fmtTime(value?: string | null) {
  if (!value) return "No activity";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function healthTone(score: number) {
  if (score >= 85) return TONE_STYLES.healthy;
  if (score >= 65) return TONE_STYLES.warning;
  return TONE_STYLES.critical;
}

function KpiCard({ kpi }: { kpi: CommandKpi }) {
  const tone = TONE_STYLES[kpi.tone] ?? TONE_STYLES.normal;
  const Icon = KPI_ICONS[kpi.key] ?? Activity;

  return (
    <div className="rounded-[12px] border border-[#1E2F50] bg-[#14203A] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4E6090]">{kpi.label}</div>
          <div className="mt-2 text-[26px] font-extrabold leading-none text-[#E8EDF8]">{kpi.value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border" style={{ background: tone.bg, borderColor: tone.border }}>
          <Icon className="h-4 w-4" style={{ color: tone.color }} />
        </div>
      </div>
      <div className="mt-3 text-[11px] font-semibold text-[#8A9BBF]">{kpi.detail}</div>
    </div>
  );
}

function GateSelector({
  gates,
  selectedGateId,
  disabled,
  onChange,
}: {
  gates: CommandGateSummary[];
  selectedGateId: string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  const selected = gates.find((gate) => gate.id === selectedGateId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4E6090]">Gate</span>
      <div className="relative">
        <select
          value={selectedGateId}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || gates.length === 0}
          className="appearance-none rounded-[10px] border border-[#1E2F50] bg-[#0D1526] py-2 pl-3 pr-8 text-[11px] font-bold text-[#E8EDF8] outline-none transition-colors hover:border-[#2A3F68] disabled:opacity-50"
        >
          {gates.map((gate) => (
            <option key={gate.id} value={gate.id}>
              {gate.gate_code} - {gate.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#4E6090]" />
      </div>
      {selected && (
        <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold ${selected.status === "open" ? "bg-[#F5A623]/15 text-[#F5A623]" : "bg-[#22D3A1]/15 text-[#22D3A1]"}`}>
          {selected.status.toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default function CommandPage() {
  const [snapshot, setSnapshot] = useState<CommandCenterSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [selectedGateId, setSelectedGateId] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastPriority, setBroadcastPriority] = useState("P2");
  const [contactOpen, setContactOpen] = useState(false);
  const [contactMsg, setContactMsg] = useState("");
  const [contactChannel, setContactChannel] = useState("in_app");

  const showFeedback = (msg: string, ok = true) => {
    setFeedback({ msg, ok });
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const fetchSnapshot = useCallback(async () => {
    try {
      const data = await getCommandCenterSnapshot();
      setSnapshot(data);
      setSelectedGateId((previous) => previous || data.gates[0]?.id || "");
    } catch {
      showFeedback("Command snapshot is unavailable", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSnapshot();
    const interval = window.setInterval(() => void fetchSnapshot(), 30000);
    return () => window.clearInterval(interval);
  }, [fetchSnapshot]);

  useDepotCommandEvents(() => {
    void fetchSnapshot();
  });

  const selectedGate = useMemo(
    () => snapshot?.gates.find((gate) => gate.id === selectedGateId),
    [snapshot?.gates, selectedGateId],
  );

  const updateGateStatus = (gateId: string, status: "open" | "closed") => {
    setSnapshot((current) => {
      if (!current) return current;
      return {
        ...current,
        gates: current.gates.map((gate) => gate.id === gateId ? { ...gate, status } : gate),
      };
    });
  };

  const runAction = async (key: string, fn: () => Promise<CommandActionResponse>, successMsg: string) => {
    setActionLoading(key);
    if (key === "open-gate" && selectedGateId) updateGateStatus(selectedGateId, "open");
    if (key === "close-gate" && selectedGateId) updateGateStatus(selectedGateId, "closed");
    try {
      await fn();
      showFeedback(successMsg, true);
      void fetchSnapshot();
    } catch {
      if (key === "open-gate" && selectedGateId) updateGateStatus(selectedGateId, "closed");
      if (key === "close-gate" && selectedGateId) updateGateStatus(selectedGateId, "open");
      showFeedback("Action failed. Check backend connection.", false);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || !snapshot) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5521a] border-t-transparent" />
      </div>
    );
  }

  const tone = healthTone(snapshot.health_score);

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#E8EDF8]">Command Center</h1>
          <p className="mt-1 text-[11px] text-[#8A9BBF]">
            Live warehouse control room from gates, cameras, inventory, zones, incidents, and command actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {feedback && (
            <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${feedback.ok ? "bg-[#22D3A1]/15 text-[#22D3A1]" : "bg-[#F04A4A]/15 text-[#F04A4A]"}`}>
              {feedback.msg}
            </span>
          )}
          <button
            type="button"
            onClick={() => void fetchSnapshot()}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#1E2F50] bg-[#14203A] text-[#8A9BBF] transition hover:border-[#2A3F68] hover:text-[#E8EDF8]"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
        <section className="rounded-[14px] border border-[#1E2F50] bg-[#14203A] p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#4E6090]">Depot Health</div>
              <div className="mt-2 text-[46px] font-extrabold leading-none" style={{ color: tone.color }}>
                {snapshot.health_score}
              </div>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2" style={{ background: tone.bg, borderColor: tone.border }}>
              <Gauge className="h-7 w-7" style={{ color: tone.color }} />
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#0D1526]">
            <div className="h-full rounded-full" style={{ width: `${snapshot.health_score}%`, background: tone.color }} />
          </div>
          <p className="mt-3 text-[11px] font-semibold text-[#8A9BBF]">
            Score is reduced by open incidents, active breaches, stock exceptions, capacity risk, and access denials.
          </p>
        </section>

        <section className="rounded-[14px] border border-[#1E2F50] bg-[#14203A] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-[#E5521A]" />
              <span className="text-[13px] font-extrabold text-[#E8EDF8]">Quick Actions</span>
            </div>
            <GateSelector
              gates={snapshot.gates}
              selectedGateId={selectedGateId}
              disabled={!!actionLoading}
              onChange={setSelectedGateId}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              {
                key: "open-gate",
                icon: DoorOpen,
                label: "Open Gate",
                sub: selectedGate?.name ?? "No gate selected",
                color: "#22D3A1",
                fn: () => openCommandGate(selectedGateId || undefined),
                success: `${selectedGate?.name ?? "Gate"} opened`,
              },
              {
                key: "close-gate",
                icon: DoorClosed,
                label: "Close Gate",
                sub: selectedGate?.name ?? "No gate selected",
                color: "#F5A623",
                fn: () => closeCommandGate(selectedGateId || undefined),
                success: `${selectedGate?.name ?? "Gate"} closed`,
              },
              {
                key: "broadcast",
                icon: Radio,
                label: "Broadcast",
                sub: "Create incident alert",
                color: "#E5521A",
                onClick: () => setBroadcastOpen(true),
              },
              {
                key: "contact",
                icon: Phone,
                label: "Contact",
                sub: "Page supervisor",
                color: "#5B9BF5",
                onClick: () => setContactOpen(true),
              },
            ].map((action) => {
              const Icon = action.icon;
              const isLoading = actionLoading === action.key;
              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => {
                    if ("onClick" in action && action.onClick) action.onClick();
                    else if ("fn" in action && action.fn) void runAction(action.key, action.fn, action.success);
                  }}
                  disabled={!!actionLoading || (action.key.includes("gate") && !selectedGateId)}
                  className="flex min-h-[108px] flex-col items-center justify-center gap-2 rounded-[12px] border border-[#33476C] bg-[#101D34] px-3 py-4 text-center transition hover:border-[#4A628E] hover:bg-[#1A2A45] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border" style={{ background: `${action.color}20`, borderColor: `${action.color}55` }}>
                    {isLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: action.color, borderTopColor: "transparent" }} />
                    ) : (
                      <Icon className="h-5 w-5" style={{ color: action.color }} />
                    )}
                  </div>
                  <div className="text-[12px] font-extrabold" style={{ color: action.color }}>{action.label}</div>
                  <div className="max-w-full truncate text-[10px] font-bold text-[#8B9BC1]">{action.sub}</div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {snapshot.kpis.map((kpi) => <KpiCard key={kpi.key} kpi={kpi} />)}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <section className="rounded-[14px] border border-[#1E2F50] bg-[#14203A] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#5B9BF5]" />
            <h2 className="text-[13px] font-extrabold text-[#E8EDF8]">Recent Activity</h2>
          </div>
          <div className="space-y-2">
            {snapshot.timeline.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex gap-3 rounded-[10px] border border-[#1E2F50] bg-[#0D1526] p-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-[#5B9BF5]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate text-[12px] font-bold text-[#E8EDF8]">{item.title}</div>
                    <div className="whitespace-nowrap text-[10px] text-[#4E6090]">{fmtTime(item.occurred_at)}</div>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#8A9BBF]">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-[14px] border border-[#1E2F50] bg-[#14203A] p-4">
          <h2 className="mb-3 text-[13px] font-extrabold text-[#E8EDF8]">Gate Status</h2>
          <div className="space-y-2">
            {snapshot.gates.map((gate) => (
              <div key={gate.id} className="flex items-center justify-between rounded-[10px] border border-[#1E2F50] bg-[#0D1526] p-3">
                <div>
                  <div className="text-[12px] font-bold text-[#E8EDF8]">{gate.gate_code}</div>
                  <div className="text-[10px] text-[#8A9BBF]">{gate.name}</div>
                </div>
                <div className="text-right">
                  <div className={gate.status === "open" ? "text-[11px] font-extrabold text-[#F5A623]" : "text-[11px] font-extrabold text-[#22D3A1]"}>
                    {gate.status.toUpperCase()}
                  </div>
                  <div className="text-[10px] text-[#4E6090]">{gate.total_entries_today} entries</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[14px] border border-[#1E2F50] bg-[#14203A] p-4">
          <h2 className="mb-3 text-[13px] font-extrabold text-[#E8EDF8]">Camera Coverage</h2>
          <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
            {snapshot.cameras.map((camera) => (
              <div key={camera.id} className="flex items-center justify-between rounded-[10px] border border-[#1E2F50] bg-[#0D1526] p-3">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-bold text-[#E8EDF8]">{camera.name}</div>
                  <div className="text-[10px] text-[#8A9BBF]">{camera.zone || "Unassigned"} - {camera.protocol.toUpperCase()}</div>
                </div>
                <span className={camera.status === "active" ? "text-[10px] font-extrabold text-[#22D3A1]" : "text-[10px] font-extrabold text-[#F5A623]"}>
                  {camera.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {broadcastOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setBroadcastOpen(false)}>
          <div className="w-full max-w-md rounded-[16px] border border-[#1E2F50] bg-[#14203A] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-[#E5521A]" />
                <h3 className="text-[15px] font-extrabold text-[#E8EDF8]">Broadcast Message</h3>
              </div>
              <button type="button" onClick={() => setBroadcastOpen(false)} className="text-[#4E6090] hover:text-[#E8EDF8]"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <input value={broadcastTitle} onChange={(event) => setBroadcastTitle(event.target.value)} placeholder="Alert title" className="w-full rounded-[10px] border border-[#1E2F50] bg-[#0D1526] px-3 py-2 text-[12px] text-[#E8EDF8] outline-none placeholder:text-[#4E6090]" />
              <textarea value={broadcastMsg} onChange={(event) => setBroadcastMsg(event.target.value)} placeholder="Describe the required action..." rows={3} className="w-full resize-none rounded-[10px] border border-[#1E2F50] bg-[#0D1526] px-3 py-2 text-[12px] text-[#E8EDF8] outline-none placeholder:text-[#4E6090]" />
              <div className="grid grid-cols-3 gap-2">
                {["P1", "P2", "P3"].map((priority) => (
                  <button key={priority} type="button" onClick={() => setBroadcastPriority(priority)} className={`rounded-[10px] border py-2 text-[11px] font-bold ${broadcastPriority === priority ? "border-[#E5521A] bg-[#E5521A]/15 text-[#E5521A]" : "border-[#1E2F50] text-[#8A9BBF]"}`}>
                    {priority}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setBroadcastOpen(false)} className="flex-1 rounded-[10px] border border-[#1E2F50] py-2 text-[12px] font-bold text-[#8A9BBF]">Cancel</button>
              <button
                type="button"
                disabled={!broadcastMsg.trim()}
                onClick={async () => {
                  setBroadcastOpen(false);
                  await runAction("broadcast", () => triggerCommandAlert({
                    title: broadcastTitle.trim() || "Command Center alert",
                    message: broadcastMsg.trim(),
                    priority: broadcastPriority,
                  }), "Broadcast sent and incident created");
                  setBroadcastTitle("");
                  setBroadcastMsg("");
                  setBroadcastPriority("P2");
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#E5521A] py-2 text-[12px] font-bold text-white disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" /> Send
              </button>
            </div>
          </div>
        </div>
      )}

      {contactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setContactOpen(false)}>
          <div className="w-full max-w-md rounded-[16px] border border-[#1E2F50] bg-[#14203A] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#5B9BF5]" />
                <h3 className="text-[15px] font-extrabold text-[#E8EDF8]">Contact Operator</h3>
              </div>
              <button type="button" onClick={() => setContactOpen(false)} className="text-[#4E6090] hover:text-[#E8EDF8]"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {["in_app", "intercom", "radio"].map((channel) => (
                  <button key={channel} type="button" onClick={() => setContactChannel(channel)} className={`rounded-[10px] border py-2 text-[11px] font-bold ${contactChannel === channel ? "border-[#5B9BF5] bg-[#5B9BF5]/15 text-[#5B9BF5]" : "border-[#1E2F50] text-[#8A9BBF]"}`}>
                    {channel.replace("_", "-")}
                  </button>
                ))}
              </div>
              <textarea value={contactMsg} onChange={(event) => setContactMsg(event.target.value)} placeholder="Message for Shift Supervisor..." rows={3} className="w-full resize-none rounded-[10px] border border-[#1E2F50] bg-[#0D1526] px-3 py-2 text-[12px] text-[#E8EDF8] outline-none placeholder:text-[#4E6090]" />
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setContactOpen(false)} className="flex-1 rounded-[10px] border border-[#1E2F50] py-2 text-[12px] font-bold text-[#8A9BBF]">Cancel</button>
              <button
                type="button"
                disabled={!contactMsg.trim()}
                onClick={async () => {
                  setContactOpen(false);
                  await runAction("contact", () => contactCommandOperator({
                    operator: "Shift Supervisor",
                    channel: contactChannel,
                    message: contactMsg.trim(),
                  }), "Shift Supervisor paged");
                  setContactMsg("");
                  setContactChannel("in_app");
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#5B9BF5] py-2 text-[12px] font-bold text-white disabled:opacity-40"
              >
                <Phone className="h-3.5 w-3.5" /> Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
