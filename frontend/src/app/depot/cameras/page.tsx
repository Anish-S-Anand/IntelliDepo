"use client";

import VisionPage from "@/components/depot/operations/VisionPage";
export default function DepotCamerasPage() {
  return <VisionPage />;
}

// ---------------------------------------------------------------------------
// Legacy camera console kept below for reference
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Check,
  Gauge,
  Plus,
  Radar,
  RefreshCw,
  ShieldAlert,
  Truck,
  Video,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  getCameraFrame,
  getCameraMjpegUrl,
  getCameraSnapshotUrl,
  getDepotCommandSnapshot,
  reconnectCamera,
  registerCamera,
  type CameraRegisterPayload,
  type DepotCommandSnapshot,
  type IntegrationState,
} from "@/services/depotCommand";

const stateStyles: Record<IntegrationState, string> = {
  live: "border-emerald-200 bg-emerald-50 text-emerald-700",
  auth: "border-amber-200 bg-amber-50 text-amber-700",
  offline: "border-rose-200 bg-rose-50 text-rose-700",
};

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

function labelForState(state: IntegrationState, message?: string) {
  if (state === "live") {
    return "Live";
  }
  if (state === "auth") {
    return message ?? "Auth required";
  }
  return message ?? "Offline";
}

// ---------------------------------------------------------------------------
// Camera Registration Modal
// ---------------------------------------------------------------------------

function RegisterCameraModal({
  onClose,
  onRegistered,
}: {
  onClose: () => void;
  onRegistered: () => void;
}) {
  const [form, setForm] = useState<CameraRegisterPayload>({
    name: "",
    stream_url: "",
    protocol: "rtsp",
    zone: "",
    frame_rate: 25,
    resolution: "1920x1080",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.stream_url.trim()) {
      setError("Name and Stream URL are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await registerCamera({
        ...form,
        zone: form.zone || undefined,
      });
      onRegistered();
      onClose();
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err !== null && "response" in err
          ? ((err as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Registration failed")
          : "Registration failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <Camera className="h-5 w-5 text-cyan-600" />
          <h3 className="text-lg font-black tracking-tight text-[#0f172a]">Register Camera</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Gate Entry North"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-[#0f172a] placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Stream URL *</label>
            <input
              type="text"
              value={form.stream_url}
              onChange={(e) => setForm({ ...form, stream_url: e.target.value })}
              placeholder="rtsp://192.168.1.101:554/stream1"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-mono text-[#0f172a] placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Protocol</label>
              <select
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value as "rtsp" | "http" | "https" })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-[#0f172a] focus:border-cyan-400 focus:outline-none"
              >
                <option value="rtsp">RTSP</option>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Zone</label>
              <input
                type="text"
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
                placeholder="e.g. Entry Gate"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-[#0f172a] placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Frame Rate</label>
              <input
                type="number"
                min={1}
                max={60}
                value={form.frame_rate}
                onChange={(e) => setForm({ ...form, frame_rate: parseInt(e.target.value) || 25 })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-[#0f172a] focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Resolution</label>
              <select
                value={form.resolution}
                onChange={(e) => setForm({ ...form, resolution: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-[#0f172a] focus:border-cyan-400 focus:outline-none"
              >
                <option value="1280x720">1280x720 (720p)</option>
                <option value="1920x1080">1920x1080 (1080p)</option>
                <option value="2560x1440">2560x1440 (2K)</option>
                <option value="3840x2160">3840x2160 (4K)</option>
              </select>
            </div>
          </div>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-rose-600">{error}</p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-cyan-600 px-5 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Register
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function DepotCamerasPageLegacy() {
  const router = useRouter();
  const [cameraFromUrl, setCameraFromUrl] = useState<string | null>(null);

  const [snapshot, setSnapshot] = useState<DepotCommandSnapshot | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyCameraId, setBusyCameraId] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [viewMode, setViewMode] = useState<"metadata" | "stream">("stream");
  const [frameState, setFrameState] = useState<{
    state: IntegrationState;
    frame: Awaited<ReturnType<typeof getCameraFrame>>["data"];
    message?: string;
  }>({
    state: "offline",
    frame: null,
    message: "Choose a camera from the left rail to inspect its feed metadata.",
  });

  async function loadConsole(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const next = await getDepotCommandSnapshot();
      setSnapshot(next);
      const preferredId =
        cameraFromUrl && next.cameras.data.some((camera) => camera.id === cameraFromUrl)
          ? cameraFromUrl
          : selectedCameraId && next.cameras.data.some((camera) => camera.id === selectedCameraId)
            ? selectedCameraId
            : next.cameras.data[0]?.id ?? null;
      setSelectedCameraId(preferredId);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCameraFromUrl(params.get("camera"));
  }, []);

  useEffect(() => {
    void loadConsole();
    const intervalId = window.setInterval(() => {
      void loadConsole(true);
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [cameraFromUrl]);

  useEffect(() => {
    async function loadFrame() {
      if (!selectedCameraId) {
        setFrameState({
          state: "offline",
          frame: null,
          message: "No registered camera is available yet.",
        });
        return;
      }

      const frame = await getCameraFrame(selectedCameraId);
      setFrameState({ state: frame.state, frame: frame.data, message: frame.message });
    }

    void loadFrame();
  }, [selectedCameraId, snapshot?.generatedAt]);

  const selectedCamera = useMemo(
    () => snapshot?.cameras.data.find((camera) => camera.id === selectedCameraId) ?? null,
    [selectedCameraId, snapshot?.cameras.data],
  );

  const relatedBreaches = useMemo(
    () => snapshot?.breaches.data.filter((breach) => breach.camera_id === selectedCameraId).slice(0, 4) ?? [],
    [selectedCameraId, snapshot?.breaches.data],
  );

  const relatedGates = useMemo(
    () => snapshot?.gates.data.filter((gate) => gate.camera_id === selectedCameraId) ?? [],
    [selectedCameraId, snapshot?.gates.data],
  );

  const relatedAccessLogs = useMemo(
    () =>
      relatedGates.length === 0
        ? []
        : snapshot?.accessLogs.data
            .filter((log) => relatedGates.some((gate) => gate.id === log.gate_id))
            .slice(0, 4) ?? [],
    [relatedGates, snapshot?.accessLogs.data],
  );

  const isOnline = selectedCamera?.status === "active";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#081120_0%,#0f172a_28%,#eaf1f5_28.1%,#edf4f7_100%)] px-6 py-6 md:px-8">
      <div className="mx-auto max-w-[1560px]">
        <section className="rounded-[34px] border border-white/10 bg-white/[0.04] p-6 text-white backdrop-blur-xl shadow-[0_24px_80px_rgba(8,15,35,0.35)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <button
                type="button"
                onClick={() => router.push("/depot/dashboard")}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to command center
              </button>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100">
                <Camera className="h-3.5 w-3.5" />
                Camera Console
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-white md:text-5xl">
                Open the camera layer as a real operations workspace.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-[15px]">
                This console is the natural place to inspect feeds, reconnect cameras, and cross-check security and gate
                events without overloading the dashboard.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Registered</p>
                <p className="mt-2 text-3xl font-black">{snapshot?.cameras.data.length ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Active streams</p>
                <p className="mt-2 text-3xl font-black">{snapshot?.activeStreams.data.active_count ?? 0}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Refresh</p>
                <button
                  type="button"
                  onClick={() => void loadConsole(true)}
                  className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Update
                </button>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Add Camera</p>
                <button
                  type="button"
                  onClick={() => setShowRegister(true)}
                  className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
                >
                  <Plus className="h-4 w-4" />
                  Register
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.5fr_0.95fr]">
          <aside className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Fleet Rail</p>
                <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#0f172a]">Cameras</h2>
              </div>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${stateStyles[snapshot?.cameras.state ?? "offline"]}`}>
                {labelForState(snapshot?.cameras.state ?? "offline", snapshot?.cameras.message)}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {(snapshot?.cameras.data ?? []).map((camera) => {
                const active = camera.id === selectedCameraId;
                const online = camera.status === "active";

                return (
                  <button
                    key={camera.id}
                    type="button"
                    onClick={() => {
                      setSelectedCameraId(camera.id);
                      router.replace(`/depot/cameras?camera=${camera.id}`);
                    }}
                    className={`w-full rounded-[24px] border p-4 text-left transition ${
                      active
                        ? "border-cyan-300 bg-cyan-50 shadow-[0_16px_40px_rgba(8,145,178,0.12)]"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#0f172a]">{camera.name}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{camera.zone ?? "Unassigned zone"}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${online ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                        {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                        {camera.status}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>{camera.resolution}</span>
                      <span>{camera.frame_rate} fps</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-slate-400">{formatShortTime(camera.last_seen)}</span>
                      {!online ? (
                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            setBusyCameraId(camera.id);
                            void reconnectCamera(camera.id)
                              .then(() => loadConsole(true))
                              .finally(() => setBusyCameraId(null));
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${busyCameraId === camera.id ? "animate-spin" : ""}`} />
                          Reconnect
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}

              {/* Add camera button in sidebar */}
              <button
                type="button"
                onClick={() => setShowRegister(true)}
                className="w-full rounded-[24px] border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-500 transition hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-700"
              >
                <Plus className="mx-auto mb-1 h-5 w-5" />
                Register new camera
              </button>

              {!loading && (snapshot?.cameras.data.length ?? 0) === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
                  No cameras are registered yet, so there is nothing to open in the console.
                </div>
              ) : null}
            </div>
          </aside>

          <main className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Inspector</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#0f172a]">
                  {selectedCamera?.name ?? "Camera feed"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {/* View mode toggle */}
                {selectedCamera ? (
                  <div className="flex rounded-full border border-slate-200 bg-slate-100 p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode("stream")}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                        viewMode === "stream" ? "bg-white text-[#0f172a] shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <Video className="h-3 w-3" />
                      Live
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("metadata")}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                        viewMode === "metadata" ? "bg-white text-[#0f172a] shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <Gauge className="h-3 w-3" />
                      Metadata
                    </button>
                  </div>
                ) : null}
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${stateStyles[frameState.state]}`}>
                  {labelForState(frameState.state, frameState.message)}
                </span>
              </div>
            </div>

            {/* MJPEG Live Stream View */}
            {viewMode === "stream" && selectedCamera ? (
              <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-[#0f172a]">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                  <div className="flex items-center gap-3 text-white">
                    <Video className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm font-bold">{selectedCamera.zone ?? "No zone"}</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400">{selectedCamera.protocol} feed</span>
                  </div>
                  {isOnline ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-500">OFFLINE</span>
                  )}
                </div>

                <div className="relative aspect-video bg-black">
                  {isOnline ? (
                    <>
                      <img
                        key={selectedCameraId}
                        src={getCameraMjpegUrl(selectedCamera.id)}
                        alt={`${selectedCamera.name} live feed`}
                        className="absolute inset-0 w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const fallback = `${getCameraSnapshotUrl(selectedCamera.id)}?t=${Date.now()}`;
                          if (!target.src.includes("/snapshot")) {
                            target.src = fallback;
                          }
                        }}
                      />
                      {/* Scanline overlay */}
                      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]" />
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
                      <WifiOff className="h-8 w-8" />
                      <p className="text-sm">Camera is offline. Reconnect to see the live feed.</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 text-white">
                  <div className="flex gap-4 text-[11px] text-slate-400">
                    <span>{selectedCamera.resolution}</span>
                    <span>{selectedCamera.frame_rate} fps</span>
                    <span>Frame #{frameState.frame?.frame_number ?? "--"}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {formatShortTime(frameState.frame?.timestamp ?? selectedCamera.last_seen)}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Metadata View (original) */}
            {viewMode === "metadata" || !selectedCamera ? (
              <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,#183b56_0%,#10273b_42%,#0f172a_100%)] p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xl font-bold">{selectedCamera?.zone ?? "No zone selected"}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                      {selectedCamera?.protocol ?? "No protocol"} feed
                    </p>
                  </div>
                  <Gauge className="h-5 w-5 text-cyan-200" />
                </div>

                <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                  <div className="aspect-[16/9] rounded-[20px] border border-dashed border-white/10 bg-black/15 p-5">
                    <div className="flex h-full flex-col justify-between">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white/[0.06] p-3">
                          <p className="text-lg font-black">{frameState.frame?.frame_number ?? "--"}</p>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Latest frame</p>
                        </div>
                        <div className="rounded-2xl bg-white/[0.06] p-3">
                          <p className="text-lg font-black">
                            {frameState.frame ? `${frameState.frame.width}x${frameState.frame.height}` : selectedCamera?.resolution ?? "--"}
                          </p>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Capture window</p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-white/[0.06] p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Last seen</p>
                          <p className="mt-2 text-sm font-semibold">{formatShortTime(frameState.frame?.timestamp ?? selectedCamera?.last_seen)}</p>
                        </div>
                        <div className="rounded-2xl bg-white/[0.06] p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Stream URL</p>
                          <p className="mt-2 line-clamp-2 text-sm font-semibold">{selectedCamera?.stream_url ?? "Not configured"}</p>
                        </div>
                        <div className="rounded-2xl bg-white/[0.06] p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Frame rate</p>
                          <p className="mt-2 text-sm font-semibold">{selectedCamera?.frame_rate ?? "--"} fps</p>
                        </div>
                      </div>

                      <p className="text-xs leading-5 text-slate-300">
                        {frameState.message ?? "Frame metadata is coming directly from the camera feed endpoint."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </main>

          <aside className="space-y-6">
            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-4.5 w-4.5 text-rose-500" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Security Context</p>
                  <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#0f172a]">Related breaches</h3>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {relatedBreaches.map((breach) => (
                  <div key={breach.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-[#0f172a]">{breach.breach_type.replaceAll("_", " ")}</p>
                      <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700">
                        {breach.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{formatShortTime(breach.detected_at)}</p>
                  </div>
                ))}
                {relatedBreaches.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                    No breach records are currently attached to this camera.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
              <div className="flex items-center gap-3">
                <Truck className="h-4.5 w-4.5 text-blue-500" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Gate Context</p>
                  <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#0f172a]">Vehicle activity</h3>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {relatedAccessLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-[#0f172a]">{log.plate_number}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                        {log.decision}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{log.gate_code ?? "Gate"} · {formatShortTime(log.processed_at)}</p>
                  </div>
                ))}
                {relatedAccessLogs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                    No gate access logs are currently linked to this camera.
                  </div>
                ) : null}
              </div>
            </section>
          </aside>
        </section>

        <div className="mt-6">
          <Link
            href="/depot/applications/intellivision"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Radar className="h-4 w-4" />
            Open IntelliVision overview
          </Link>
        </div>
      </div>

      {/* Registration modal */}
      {showRegister ? (
        <RegisterCameraModal
          onClose={() => setShowRegister(false)}
          onRegistered={() => void loadConsole(true)}
        />
      ) : null}
    </div>
  );
}
