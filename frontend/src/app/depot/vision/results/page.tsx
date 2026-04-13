"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Box,
  Camera,
  ChevronDown,
  Eye,
  Fingerprint,
  Minus,
  Play,
  RefreshCw,
  ScanLine,
  Target,
} from "lucide-react";
import {
  getDetectionModels,
  getDetectionRuns,
  getRunSummary,
  getRunObjects,
  startDetectionRun,
  type DetectionModel,
  type DetectionRunResponse,
  type DetectedObject,
  type RunSummary,
} from "@/services/depotVision";
import {
  startTrackingRun,
  getTrackingSessions,
  getTrackingSession,
  type TrackingSession,
  type TrackingSummary,
  type TrackedObject,
} from "@/services/depotTracking";
import {
  getDepotCommandSnapshot,
  type CameraRecord,
} from "@/services/depotCommand";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLASS_COLOURS: Record<string, string> = {
  bag: "#3b82f6",
  box: "#f59e0b",
  pallet: "#22d3a1",
  carton: "#a78bfa",
  person: "#ec4899",
  vehicle: "#06b6d4",
  unknown: "#94a3b8",
};

function formatTime(value: string | null | undefined) {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function directionIcon(direction: string) {
  if (direction === "inbound") return <ArrowDown className="h-3.5 w-3.5 text-emerald-500" />;
  if (direction === "outbound") return <ArrowUp className="h-3.5 w-3.5 text-rose-500" />;
  return <Minus className="h-3.5 w-3.5 text-slate-400" />;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function VisionResultsPage() {
  const [cameras, setCameras] = useState<CameraRecord[]>([]);
  const [models, setModels] = useState<DetectionModel[]>([]);
  const [runs, setRuns] = useState<DetectionRunResponse[]>([]);
  const [sessions, setSessions] = useState<TrackingSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected state
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [runObjects, setRunObjects] = useState<DetectedObject[]>([]);
  const [trackingSummary, setTrackingSummary] = useState<TrackingSummary | null>(null);

  // New run form
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [frameCount, setFrameCount] = useState(5);
  const [running, setRunning] = useState(false);
  const [trackingRunning, setTrackingRunning] = useState(false);

  // Tab
  const [tab, setTab] = useState<"detections" | "tracking">("detections");

  // Load initial data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [snap, modelList, runList, sessionList] = await Promise.allSettled([
          getDepotCommandSnapshot(),
          getDetectionModels(),
          getDetectionRuns(),
          getTrackingSessions(),
        ]);
        if (snap.status === "fulfilled") setCameras(snap.value.cameras.data);
        if (modelList.status === "fulfilled") {
          setModels(modelList.value);
          const active = modelList.value.find((m) => m.is_active);
          if (active) setSelectedModelId(active.id);
        }
        if (runList.status === "fulfilled") setRuns(runList.value);
        if (sessionList.status === "fulfilled") setSessions(sessionList.value);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  // Load run details when selected
  useEffect(() => {
    if (!selectedRunId) {
      setRunSummary(null);
      setRunObjects([]);
      setTrackingSummary(null);
      return;
    }
    async function loadRun() {
      try {
        const [summary, objects] = await Promise.all([
          getRunSummary(selectedRunId!),
          getRunObjects(selectedRunId!),
        ]);
        setRunSummary(summary);
        setRunObjects(objects);

        // Check if there's a tracking session for this run
        const matchingSession = sessions.find((s) => s.detection_run_id === selectedRunId);
        if (matchingSession) {
          const ts = await getTrackingSession(matchingSession.id);
          setTrackingSummary(ts);
        } else {
          setTrackingSummary(null);
        }
      } catch {
        // Run details unavailable
      }
    }
    void loadRun();
  }, [selectedRunId, sessions]);

  // Start a new detection run
  async function handleStartRun() {
    if (!selectedModelId) return;
    setRunning(true);
    try {
      const run = await startDetectionRun(selectedModelId, frameCount, selectedCameraId || undefined);
      setRuns((prev) => [run, ...prev]);
      setSelectedRunId(run.id);
    } finally {
      setRunning(false);
    }
  }

  // Start tracking on current detection run
  async function handleStartTracking() {
    if (!selectedRunId) return;
    setTrackingRunning(true);
    try {
      const ts = await startTrackingRun(selectedRunId);
      setTrackingSummary(ts);
      setSessions((prev) => [ts.session, ...prev]);
      setTab("tracking");
    } finally {
      setTrackingRunning(false);
    }
  }

  // Detection class distribution
  const classDistribution = useMemo(() => {
    if (!runSummary) return {};
    return runSummary.detections_by_class;
  }, [runSummary]);

  const activeCameras = cameras.filter((c) => c.status === "active");
  const selectedRun = runs.find((r) => r.id === selectedRunId);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#081120_0%,#0f172a_28%,#eaf1f5_28.1%,#edf4f7_100%)] px-6 py-6 md:px-8">
      <div className="mx-auto max-w-[1560px]">
        {/* Header */}
        <section className="rounded-[34px] border border-white/10 bg-white/[0.04] p-6 text-white backdrop-blur-xl shadow-[0_24px_80px_rgba(8,15,35,0.35)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Link
                href="/depot/vision"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/[0.1]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to live feed
              </Link>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-400/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-100">
                <Target className="h-3.5 w-3.5" />
                Detection & Tracking Results
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] text-white md:text-4xl">
                Run detections, track objects, review results.
              </h1>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Detection runs</p>
                <p className="mt-2 text-3xl font-black">{runs.length}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tracking sessions</p>
                <p className="mt-2 text-3xl font-black">{sessions.length}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Models</p>
                <p className="mt-2 text-3xl font-black">{models.length}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_2fr]">
          {/* Left Panel: New Run + Run List */}
          <div className="space-y-6">
            {/* New Detection Run */}
            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
              <div className="flex items-center gap-2 mb-4">
                <Play className="h-4 w-4 text-cyan-600" />
                <h2 className="text-lg font-black tracking-tight text-[#0f172a]">New Detection Run</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Camera (optional)</label>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-[#0f172a] focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="">Any active camera</option>
                    {activeCameras.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.zone})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Model</label>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-[#0f172a] focus:border-cyan-400 focus:outline-none"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.model_name} {m.model_version}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Frames to capture</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={frameCount}
                    onChange={(e) => setFrameCount(parseInt(e.target.value) || 5)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-[#0f172a] focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleStartRun}
                  disabled={running || !selectedModelId}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 transition"
                >
                  {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                  {running ? "Running..." : "Start Detection"}
                </button>
              </div>
            </section>

            {/* Run History */}
            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-slate-600" />
                <h2 className="text-lg font-black tracking-tight text-[#0f172a]">Run History</h2>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {runs.length === 0 && !loading ? (
                  <p className="text-sm text-slate-500 text-center py-6">No detection runs yet. Start one above.</p>
                ) : null}
                {runs.map((run) => {
                  const isSelected = run.id === selectedRunId;
                  const cam = cameras.find((c) => c.id === run.camera_id);
                  return (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => setSelectedRunId(run.id)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        isSelected
                          ? "border-cyan-300 bg-cyan-50 shadow-sm"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-[#0f172a]">
                          {cam?.name ?? "Unknown camera"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          run.status === "completed"
                            ? "bg-emerald-100 text-emerald-700"
                            : run.status === "running"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-200 text-slate-600"
                        }`}>
                          {run.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{run.total_detections} detections / {run.frame_count} frames</span>
                        <span>{formatTime(run.started_at)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right Panel: Results */}
          <div className="space-y-6">
            {!selectedRunId ? (
              <div className="rounded-[30px] border border-slate-200 bg-white p-12 shadow-[0_18px_50px_rgba(15,23,42,0.07)] text-center">
                <Eye className="mx-auto h-10 w-10 text-slate-300 mb-4" />
                <h3 className="text-xl font-black text-[#0f172a] mb-2">Select a detection run</h3>
                <p className="text-sm text-slate-500">Choose a run from the left to view detection results, or start a new run.</p>
              </div>
            ) : (
              <>
                {/* Run Summary */}
                <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ScanLine className="h-4 w-4 text-orange-500" />
                      <h2 className="text-lg font-black tracking-tight text-[#0f172a]">Run Summary</h2>
                    </div>
                    {!trackingSummary && selectedRun?.status === "completed" ? (
                      <button
                        type="button"
                        onClick={handleStartTracking}
                        disabled={trackingRunning}
                        className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                      >
                        {trackingRunning ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Fingerprint className="h-3 w-3" />}
                        {trackingRunning ? "Tracking..." : "Run Tracking"}
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-2xl font-black text-[#0f172a]">{runSummary?.run.total_detections ?? "--"}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Total detections</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-2xl font-black text-[#0f172a]">{runSummary?.run.frame_count ?? "--"}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Frames</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-2xl font-black text-[#0f172a]">
                        {runSummary ? `${(runSummary.average_confidence * 100).toFixed(1)}%` : "--"}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Avg confidence</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-2xl font-black text-[#0f172a]">
                        {Object.keys(classDistribution).length}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Classes found</p>
                    </div>
                  </div>

                  {/* Class distribution bars */}
                  <div className="space-y-2">
                    {Object.entries(classDistribution).map(([cls, count]) => {
                      const maxCount = Math.max(...Object.values(classDistribution));
                      const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      const color = CLASS_COLOURS[cls] || CLASS_COLOURS.unknown;
                      return (
                        <div key={cls} className="flex items-center gap-3">
                          <span className="w-16 text-xs font-semibold capitalize text-[#0f172a]">{cls}</span>
                          <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="w-8 text-right text-xs font-bold" style={{ color }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Tabs: Detections / Tracking */}
                <div className="flex rounded-full border border-slate-200 bg-slate-100 p-0.5 w-fit">
                  <button
                    type="button"
                    onClick={() => setTab("detections")}
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                      tab === "detections" ? "bg-white text-[#0f172a] shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Box className="h-3 w-3" />
                    Detections ({runObjects.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("tracking")}
                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                      tab === "tracking" ? "bg-white text-[#0f172a] shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <Fingerprint className="h-3 w-3" />
                    Tracking {trackingSummary ? `(${trackingSummary.tracked_objects.length})` : ""}
                  </button>
                </div>

                {/* Detections Table */}
                {tab === "detections" ? (
                  <section className="rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.07)] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Frame</th>
                            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Class</th>
                            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Confidence</th>
                            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Bbox</th>
                            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Size (cm2)</th>
                            <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runObjects.slice(0, 50).map((obj) => {
                            const color = CLASS_COLOURS[obj.class_label] || CLASS_COLOURS.unknown;
                            return (
                              <tr key={obj.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-5 py-2.5 text-xs font-mono text-slate-600">#{obj.frame_number}</td>
                                <td className="px-5 py-2.5">
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize border"
                                    style={{ color, borderColor: `${color}30`, background: `${color}10` }}
                                  >
                                    {obj.class_label}
                                  </span>
                                </td>
                                <td className="px-5 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                      <div
                                        className="h-full rounded-full"
                                        style={{ width: `${obj.confidence * 100}%`, backgroundColor: color }}
                                      />
                                    </div>
                                    <span className="text-xs font-mono text-slate-600">{(obj.confidence * 100).toFixed(1)}%</span>
                                  </div>
                                </td>
                                <td className="px-5 py-2.5 text-[10px] font-mono text-slate-500">
                                  ({obj.bbox_x.toFixed(2)}, {obj.bbox_y.toFixed(2)}) {obj.bbox_w.toFixed(2)}x{obj.bbox_h.toFixed(2)}
                                </td>
                                <td className="px-5 py-2.5 text-xs text-slate-600">
                                  {obj.size_estimate_cm2 ? `${obj.size_estimate_cm2.toFixed(0)} cm2` : "--"}
                                </td>
                                <td className="px-5 py-2.5 text-xs font-bold text-[#0f172a]">{obj.count_in_frame}</td>
                              </tr>
                            );
                          })}
                          {runObjects.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                                No detected objects in this run.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                      {runObjects.length > 50 ? (
                        <div className="px-5 py-3 text-xs text-slate-500 border-t border-slate-100">
                          Showing first 50 of {runObjects.length} detections.
                        </div>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                {/* Tracking Results */}
                {tab === "tracking" ? (
                  trackingSummary ? (
                    <section className="space-y-4">
                      {/* Tracking KPIs */}
                      <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
                        <div className="flex items-center gap-2 mb-4">
                          <Fingerprint className="h-4 w-4 text-violet-600" />
                          <h2 className="text-lg font-black tracking-tight text-[#0f172a]">Tracking Summary</h2>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                            <p className="text-2xl font-black text-[#0f172a]">{trackingSummary.tracked_objects.length}</p>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">Unique objects</p>
                          </div>
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                            <p className="text-2xl font-black text-emerald-700">{trackingSummary.inbound_count}</p>
                            <p className="text-[10px] uppercase tracking-wider text-emerald-600">Inbound</p>
                          </div>
                          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-center">
                            <p className="text-2xl font-black text-rose-700">{trackingSummary.outbound_count}</p>
                            <p className="text-[10px] uppercase tracking-wider text-rose-600">Outbound</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                            <p className="text-2xl font-black text-[#0f172a]">{trackingSummary.session.total_frames}</p>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">Frames processed</p>
                          </div>
                        </div>

                        {/* Counts by class */}
                        {trackingSummary.session.counts_by_class ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {Object.entries(trackingSummary.session.counts_by_class).map(([cls, count]) => {
                              const color = CLASS_COLOURS[cls] || CLASS_COLOURS.unknown;
                              return (
                                <span
                                  key={cls}
                                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold capitalize border"
                                  style={{ color, borderColor: `${color}30`, background: `${color}10` }}
                                >
                                  {count} {cls}{Number(count) !== 1 ? "s" : ""}
                                </span>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>

                      {/* Tracked Objects Table */}
                      <div className="rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.07)] overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Track ID</th>
                                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Class</th>
                                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Direction</th>
                                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Confidence</th>
                                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Frames</th>
                                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Speed</th>
                                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">Counted</th>
                              </tr>
                            </thead>
                            <tbody>
                              {trackingSummary.tracked_objects.map((obj) => {
                                const color = CLASS_COLOURS[obj.class_label] || CLASS_COLOURS.unknown;
                                return (
                                  <tr key={obj.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="px-5 py-2.5 text-xs font-mono font-bold text-[#0f172a]">#{obj.track_id}</td>
                                    <td className="px-5 py-2.5">
                                      <span
                                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize border"
                                        style={{ color, borderColor: `${color}30`, background: `${color}10` }}
                                      >
                                        {obj.class_label}
                                      </span>
                                    </td>
                                    <td className="px-5 py-2.5">
                                      <span className="inline-flex items-center gap-1 text-xs font-semibold capitalize text-slate-700">
                                        {directionIcon(obj.direction)}
                                        {obj.direction}
                                      </span>
                                    </td>
                                    <td className="px-5 py-2.5">
                                      <div className="flex items-center gap-2">
                                        <div className="w-12 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                          <div
                                            className="h-full rounded-full"
                                            style={{ width: `${obj.avg_confidence * 100}%`, backgroundColor: color }}
                                          />
                                        </div>
                                        <span className="text-xs font-mono text-slate-600">{(obj.avg_confidence * 100).toFixed(1)}%</span>
                                      </div>
                                    </td>
                                    <td className="px-5 py-2.5 text-xs text-slate-600">
                                      {obj.first_seen_frame}--{obj.last_seen_frame} ({obj.total_frames})
                                    </td>
                                    <td className="px-5 py-2.5 text-xs text-slate-600">
                                      {obj.speed_estimate != null ? `${obj.speed_estimate.toFixed(1)} cm/s` : "--"}
                                    </td>
                                    <td className="px-5 py-2.5">
                                      {obj.is_counted ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                          Yes
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-slate-400">No</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <div className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.07)] text-center">
                      <Fingerprint className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                      <p className="text-sm text-slate-500 mb-3">No tracking data for this run yet.</p>
                      {selectedRun?.status === "completed" ? (
                        <button
                          type="button"
                          onClick={handleStartTracking}
                          disabled={trackingRunning}
                          className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                          {trackingRunning ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Fingerprint className="h-3 w-3" />}
                          Run DeepSORT Tracking
                        </button>
                      ) : null}
                    </div>
                  )
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
