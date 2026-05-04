"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Camera,
  Gauge,
  Package,
  Radar,
  RefreshCw,
  Shield,
  Truck,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import {
  getCameraFrame,
  getDepotCommandSnapshot,
  reconnectCamera,
  type DepotCommandSnapshot,
  type IntegrationState,
} from "@/services/depotCommand";

const accentByState: Record<IntegrationState, string> = {
  live: "text-emerald-700 bg-emerald-50 border-emerald-200",
  auth: "text-amber-700 bg-amber-50 border-amber-200",
  offline: "text-rose-700 bg-rose-50 border-rose-200",
};

const moduleRail = [
  { label: "Vision", href: "/depot", tone: "#12808f" },
  { label: "Ops", href: "/depot/applications/intelliops", tone: "#2f6a4f" },
  { label: "Command", href: "/depot/applications/intellicommand", tone: "#234b78" },
  { label: "Risk", href: "/depot/applications/risk", tone: "#6f5f27" },
  { label: "AI Brain", href: "/depot/applications/ai-brain", tone: "#5f3dc4" },
];

function formatShortTime(value: string | null | undefined) {
  if (!value) {
    return "No signal yet";
  }

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeStatus(state: IntegrationState, message?: string) {
  if (state === "live") {
    return "Live";
  }
  if (state === "auth") {
    return message ?? "Auth required";
  }
  return message ?? "Offline";
}

export default function DashboardLivePage() {
  const [snapshot, setSnapshot] = useState<DepotCommandSnapshot | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cameraBusyId, setCameraBusyId] = useState<string | null>(null);
  const [frameState, setFrameState] = useState<{
    state: IntegrationState;
    frame: Awaited<ReturnType<typeof getCameraFrame>>["data"];
    message?: string;
  }>({
    state: "offline",
    frame: null,
    message: "Select a camera to inspect its latest frame metadata.",
  });

  async function loadDashboard(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const next = await getDepotCommandSnapshot();
      setSnapshot(next);
      const nextSelected =
        selectedCameraId && next.cameras.data.some((camera) => camera.id === selectedCameraId)
          ? selectedCameraId
          : next.cameras.data[0]?.id ?? null;
      setSelectedCameraId(nextSelected);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
    const intervalId = window.setInterval(() => {
      void loadDashboard(true);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    async function loadFrame() {
      if (!selectedCameraId) {
        setFrameState({
          state: "offline",
          frame: null,
          message: "No registered camera is available yet. Add or reconnect a camera to inspect live metadata.",
        });
        return;
      }

      const result = await getCameraFrame(selectedCameraId);
      setFrameState({ state: result.state, frame: result.data, message: result.message });
    }

    void loadFrame();
  }, [selectedCameraId, snapshot?.generatedAt]);

  const selectedCamera = useMemo(
    () => snapshot?.cameras.data.find((camera) => camera.id === selectedCameraId) ?? null,
    [selectedCameraId, snapshot?.cameras.data],
  );

  const onlineCameraCount = snapshot?.cameras.data.filter((camera) => camera.status === "active").length ?? 0;
  const offlineCameraCount = (snapshot?.cameras.data.length ?? 0) - onlineCameraCount;
  const openBreachCount = snapshot?.breaches.data.length ?? 0;
  const gateVolume = snapshot?.gates.data.reduce((total, gate) => total + gate.total_entries_today, 0) ?? 0;
  const lowStockCount = snapshot?.lowStock.data.length ?? 0;
  const requestCount = snapshot?.observability.data?.metrics?.total_requests ?? 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#164e63_0%,#0f172a_24%,#09111f_52%,#edf3f7_52.1%,#edf3f7_100%)] px-6 py-6 md:px-8">
      <div className="mx-auto max-w-[1520px]">
        <section className="rounded-[36px] border border-white/10 bg-white/[0.04] p-6 text-white backdrop-blur-xl shadow-[0_24px_80px_rgba(8,15,35,0.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                <Radar className="h-3.5 w-3.5" />
                Depot Command Mesh
              </div>
              <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-[-0.05em] text-white md:text-5xl">
                Cameras, gates, risk events, and stock pressure in one operational surface.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-[15px]">
                This is intentionally not a clone of the reference UI. It leans into an industrial command-center feel,
                keeps the camera layer central, and brings the real Depot backend online where it already exists.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Signal Health</p>
                <p className="mt-3 text-3xl font-black">{snapshot?.observability.data?.status ?? "warming"}</p>
                <p className="mt-1 text-xs text-slate-300">
                  DB {snapshot?.observability.data?.database?.status ?? "unknown"} · {requestCount} requests observed
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Last Refresh</p>
                <p className="mt-3 text-3xl font-black">{formatShortTime(snapshot?.generatedAt)}</p>
                <button
                  type="button"
                  onClick={() => void loadDashboard(true)}
                  className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-cyan-200"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh dashboard
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {moduleRail.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1]"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.tone }} />
                {item.label}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Online Cameras", value: onlineCameraCount, icon: Camera, note: `${offlineCameraCount} offline or idle`, color: "#0f766e" },
            { label: "Open Breaches", value: openBreachCount, icon: Shield, note: formatRelativeStatus(snapshot?.breaches.state ?? "offline", snapshot?.breaches.message), color: "#b91c1c" },
            { label: "Gate Entries", value: gateVolume, icon: Truck, note: `${snapshot?.gates.data.length ?? 0} gates active`, color: "#1d4ed8" },
            { label: "Low Stock Flags", value: lowStockCount, icon: Package, note: formatRelativeStatus(snapshot?.lowStock.state ?? "offline", snapshot?.lowStock.message), color: "#b45309" },
            { label: "Stream Topics", value: snapshot?.activeStreams.data.active_count ?? 0, icon: Wifi, note: `${snapshot?.activeStreams.data.streams.length ?? 0} connected feeds`, color: "#7c3aed" },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between">
                  <div className="rounded-2xl p-3" style={{ backgroundColor: `${card.color}15` }}>
                    <Icon className="h-5 w-5" style={{ color: card.color }} />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Live</span>
                </div>
                <p className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#0f172a]">{card.value}</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{card.label}</p>
                <p className="mt-1 text-xs text-slate-500">{card.note}</p>
              </article>
            );
          })}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Vision Ops</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#0f172a]">Camera fleet with live backend state</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Registered camera feeds come directly from the Depot backend. Inactive feeds can be reconnected here.
                </p>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${accentByState[snapshot?.cameras.state ?? "offline"]}`}>
                {formatRelativeStatus(snapshot?.cameras.state ?? "offline", snapshot?.cameras.message)}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {(snapshot?.cameras.data ?? []).map((camera) => {
                const isSelected = camera.id === selectedCameraId;
                const isOnline = camera.status === "active";

                return (
                  <button
                    key={camera.id}
                    type="button"
                    onClick={() => setSelectedCameraId(camera.id)}
                    className={`rounded-[26px] border p-5 text-left transition ${
                      isSelected
                        ? "border-cyan-300 bg-cyan-50 shadow-[0_16px_40px_rgba(8,145,178,0.12)]"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold tracking-[-0.03em] text-[#0f172a]">{camera.name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{camera.zone ?? "Unassigned zone"}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isOnline ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                        {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                        {camera.status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-xl font-black text-[#0f172a]">{camera.resolution}</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Capture size</p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-xl font-black text-[#0f172a]">{camera.frame_rate} fps</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Frame rate</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-xs text-slate-500">Last seen {formatShortTime(camera.last_seen)}</p>
                      {!isOnline ? (
                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            setCameraBusyId(camera.id);
                            void reconnectCamera(camera.id)
                              .then(() => loadDashboard(true))
                              .finally(() => setCameraBusyId(null));
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${cameraBusyId === camera.id ? "animate-spin" : ""}`} />
                          Reconnect
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}

              {!loading && (snapshot?.cameras.data.length ?? 0) === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-6 md:col-span-2">
                  <p className="text-lg font-bold text-[#0f172a]">No cameras registered yet</p>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    The backend camera service is wired in. Once a feed is registered, this board will turn into a live
                    fleet rail with status, reconnect actions, and frame inspection.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Selected Camera</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#0f172a]">Inspector</h2>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${accentByState[frameState.state]}`}>
                {formatRelativeStatus(frameState.state, frameState.message)}
              </span>
            </div>

            <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,#183b56_0%,#10273b_42%,#0f172a_100%)] p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold">{selectedCamera?.name ?? "No feed selected"}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                    {selectedCamera?.zone ?? "Waiting for camera registration"}
                  </p>
                </div>
                <Gauge className="h-5 w-5 text-cyan-200" />
              </div>

              <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                <div className="aspect-[16/10] rounded-[20px] border border-dashed border-white/10 bg-black/15 p-5">
                  <div className="flex h-full flex-col justify-between">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white/[0.06] p-3">
                        <p className="text-lg font-black">{frameState.frame?.frame_number ?? "--"}</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Latest frame</p>
                      </div>
                      <div className="rounded-2xl bg-white/[0.06] p-3">
                        <p className="text-lg font-black">
                          {frameState.frame ? `${frameState.frame.width}×${frameState.frame.height}` : selectedCamera?.resolution ?? "--"}
                        </p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Capture window</p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white/[0.06] p-4">
                      <p className="text-sm font-semibold text-cyan-100">Feed metadata</p>
                      <div className="mt-2 space-y-1.5 text-sm text-slate-200">
                        <p>Protocol: {selectedCamera?.protocol ?? "--"}</p>
                        <p>Last frame timestamp: {formatShortTime(frameState.frame?.timestamp ?? selectedCamera?.last_seen)}</p>
                        <p>Stream URL: {selectedCamera?.stream_url ?? "No stream configured yet"}</p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Link
                        href="/depot"
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-white/[0.1]"
                      >
                        Open camera console
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>

                    <p className="text-xs leading-5 text-slate-300">
                      {frameState.message ?? "Frame metadata is coming directly from the camera feed endpoint."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_1fr_0.9fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Security Feed</p>
                <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#0f172a]">Perimeter and risk queue</h3>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${accentByState[snapshot?.breaches.state ?? "offline"]}`}>
                {formatRelativeStatus(snapshot?.breaches.state ?? "offline", snapshot?.breaches.message)}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {(snapshot?.breaches.data ?? []).slice(0, 5).map((breach) => (
                <div key={breach.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-[#0f172a]">{breach.breach_type.replaceAll("_", " ")}</p>
                    <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                      {breach.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{breach.notes ?? "No additional notes provided."}</p>
                  <p className="mt-2 text-xs text-slate-400">Detected {formatShortTime(breach.detected_at)}</p>
                </div>
              ))}

              {!loading && (snapshot?.breaches.data.length ?? 0) === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                  No active breaches are visible right now.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Yard Gate</p>
                <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#0f172a]">Vehicle access decisions</h3>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${accentByState[snapshot?.accessLogs.state ?? "offline"]}`}>
                {formatRelativeStatus(snapshot?.accessLogs.state ?? "offline", snapshot?.accessLogs.message)}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {(snapshot?.accessLogs.data ?? []).slice(0, 5).map((log) => (
                <div key={log.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-[#0f172a]">{log.plate_number}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      log.decision === "granted"
                        ? "bg-emerald-100 text-emerald-700"
                        : log.decision === "pending"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700"
                    }`}>
                      {log.decision}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{log.gate_code ?? "Unmapped gate"} · {log.direction}</span>
                    <span>{Math.round(log.plate_confidence * 100)}%</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{formatShortTime(log.processed_at)}</p>
                </div>
              ))}

              {!loading && (snapshot?.accessLogs.data.length ?? 0) === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                  Gate access logs will appear here once LPR events are processed.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Pressure Points</p>
                <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#0f172a]">Stock and service watchlist</h3>
              </div>
              <Activity className="h-4.5 w-4.5 text-slate-400" />
            </div>

            <div className="mt-5 space-y-3">
              {(snapshot?.lowStock.data ?? []).slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-[#0f172a]">{item.zone}</p>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Qty {item.quantity} · Reorder {item.reorder_level}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.rack ?? "No rack"} {item.bin_location ? `· ${item.bin_location}` : ""}
                  </p>
                </div>
              ))}

              <div className="rounded-2xl border border-slate-200 bg-[#0f172a] p-4 text-white">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4.5 w-4.5 text-amber-300" />
                  <p className="text-sm font-semibold">Observability pulse</p>
                </div>
                <p className="mt-3 text-2xl font-black">
                  {snapshot?.observability.data?.metrics?.avg_latency_ms ?? 0} ms
                </p>
                <p className="mt-1 text-xs text-slate-300">Average backend latency across observed requests</p>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">
            Loading Depot command data...
          </div>
        ) : null}
      </div>
    </div>
  );
}
