"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getCountSessions,
  getManifests,
  getRealtimeCounts,
  getReconciliationReport,
  type CountSessionResponse,
  type ManifestResponse,
  type RealtimeCountsResponse,
  type ReconciliationReport,
} from "@/services/depotCounting";
import { exportCountingReport } from "@/lib/exportUtils";
import {
  Download,
  FileText,
  Activity,
  ScanLine,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reconciliationColor(status: string): string {
  if (status === "mismatch") return "#F04A4A";
  if (status === "pending") return "#F5A623";
  return "#22D3A1";
}

const STATUS_LABEL: Record<string, string> = { matched: "MATCHED", mismatch: "MISMATCH", pending: "PENDING" };

// ---------------------------------------------------------------------------
// Derived view-model types
// ---------------------------------------------------------------------------

interface SessionRow {
  id: string;
  manifestCode: string;
  vehicleNumber: string;
  expectedBags: number;
  expectedBoxes: number;
  countedBags: number;
  countedBoxes: number;
  totalExpected: number;
  totalCounted: number;
  discrepancy: number;
  confidenceAvg: number;
  status: string;
  zone: string;
  camera: string;
  timestamp: string;
}

interface BatchTally {
  id: string;
  batchCode: string;
  product: string;
  expected: number;
  counted: number;
  variance: number;
  variancePct: number;
  status: string;
}

interface TimeSeriesPoint {
  time: string;
  bags: number;
  boxes: number;
  cumulative: number;
}

const COUNTING_VIDEO_FILE = "Screen Recording 2025-07-30 120512.mp4";

// Point directly to the backend port — bypasses Next.js proxy buffering which
// causes MJPEG streams to play in slow-motion.
function getCountingFeedUrl(): string {
  if (typeof window === "undefined") return "";
  const base = `${window.location.protocol}//${window.location.hostname}:8000`;
  return `${base}/depot/vision/cameras/video-library/${encodeURIComponent(COUNTING_VIDEO_FILE)}/mjpeg?theme=dark&seek=18`;
}

function classCount(camera: { by_class: RealtimeCountsResponse["cameras"][string]["by_class"] }, label: string): number {
  const value = camera.by_class[label];
  if (typeof value === "number") return value;
  return value?.net ?? ((value?.in ?? 0) - (value?.out ?? 0));
}

function activeClassCount(camera: RealtimeCountsResponse["cameras"][string] | undefined, label: string): number {
  const detections = camera?.detections ?? [];
  if (detections.length === 0) return classCount(camera ?? { by_class: {} }, label);
  return detections.filter((det) => det.class.toLowerCase() === label).length;
}

function activeConfidence(camera: RealtimeCountsResponse["cameras"][string] | undefined, fallback: string): string {
  const detections = camera?.detections ?? [];
  if (detections.length === 0) return fallback;
  const avg = detections.reduce((sum, det) => sum + det.confidence, 0) / detections.length;
  return (avg * 100).toFixed(1);
}

// ---------------------------------------------------------------------------
// Data-shaping helpers
// ---------------------------------------------------------------------------

function buildSessionRows(
  sessions: CountSessionResponse[],
  manifests: ManifestResponse[],
): SessionRow[] {
  const manifestMap = new Map<string, ManifestResponse>();
  for (const m of manifests) manifestMap.set(m.id, m);

  return sessions.map((s) => {
    const m = s.manifest_id ? manifestMap.get(s.manifest_id) : undefined;
    return {
      id: s.id,
      manifestCode: m?.manifest_code ?? "—",
      vehicleNumber: m?.vehicle_number ?? "—",
      expectedBags: m?.expected_bags ?? 0,
      expectedBoxes: m?.expected_boxes ?? 0,
      countedBags: s.counted_bags,
      countedBoxes: s.counted_boxes,
      totalExpected: m?.total_expected ?? 0,
      totalCounted: s.total_counted,
      discrepancy: s.discrepancy_total,
      confidenceAvg: s.confidence_avg,
      status: s.reconciliation_status,
      zone: s.zone ?? "—",
      camera: s.camera_id ?? "—",
      timestamp: new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase(),
    };
  });
}

function buildBatchTallies(
  sessions: CountSessionResponse[],
  manifests: ManifestResponse[],
): BatchTally[] {
  const manifestMap = new Map<string, ManifestResponse>();
  for (const m of manifests) manifestMap.set(m.id, m);

  return sessions
    .filter((s) => s.manifest_id)
    .map((s) => {
      const m = manifestMap.get(s.manifest_id!);
      const expected = m?.total_expected ?? 0;
      const counted = s.total_counted;
      const variance = counted - expected;
      const variancePct = expected > 0 ? parseFloat(((variance / expected) * 100).toFixed(1)) : 0;
      return {
        id: s.id,
        batchCode: m?.manifest_code ?? s.id,
        product: m?.shipment_ref ?? m?.manifest_code ?? "—",
        expected,
        counted,
        variance,
        variancePct,
        status: s.reconciliation_status,
      };
    });
}

// Time-series computed client-side by aggregating all sessions by hour.
// Per-session time-series available at /sessions/{id}/timeseries endpoint.
function buildTimeSeries(sessions: CountSessionResponse[]): TimeSeriesPoint[] {
  // Group sessions by hour of created_at
  const hourMap = new Map<number, { bags: number; boxes: number }>();
  for (const s of sessions) {
    const h = new Date(s.created_at).getHours();
    const cur = hourMap.get(h) ?? { bags: 0, boxes: 0 };
    cur.bags += s.counted_bags;
    cur.boxes += s.counted_boxes;
    hourMap.set(h, cur);
  }

  // Build sorted array from earliest to latest hour present
  const hours = Array.from(hourMap.keys()).sort((a, b) => a - b);
  if (hours.length === 0) return [];

  const points: TimeSeriesPoint[] = [];
  let cumulative = 0;
  for (const h of hours) {
    const d = hourMap.get(h)!;
    cumulative += d.bags + d.boxes;
    points.push({
      time: `${h.toString().padStart(2, "0")}:00`,
      bags: d.bags,
      boxes: d.boxes,
      cumulative,
    });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CountingSummaryPage() {
  const [selectedSession] = useState<SessionRow | null>(null);
  const [countingFeedUrl, setCountingFeedUrl] = useState("");

  // API data
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [realtime, setRealtime] = useState<RealtimeCountsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [sessionsResult, manifestsResult, reportResult, realtimeResult] = await Promise.allSettled([
      getCountSessions(),
      getManifests(),
      getReconciliationReport(),
      getRealtimeCounts(),
    ]);

    const sessionsRaw = sessionsResult.status === "fulfilled" ? sessionsResult.value : [];
    const manifests = manifestsResult.status === "fulfilled" ? manifestsResult.value : [];
    const reportData = reportResult.status === "fulfilled" ? reportResult.value : null;
    const realtimeData = realtimeResult.status === "fulfilled" ? realtimeResult.value : null;

    if (sessionsResult.status === "rejected") console.error("CountingSummaryPage: sessions fetch failed", sessionsResult.reason);
    if (manifestsResult.status === "rejected") console.error("CountingSummaryPage: manifests fetch failed", manifestsResult.reason);
    if (reportResult.status === "rejected") console.error("CountingSummaryPage: report fetch failed", reportResult.reason);
    if (realtimeResult.status === "rejected") console.error("CountingSummaryPage: realtime fetch failed", realtimeResult.reason);

    setRealtime(realtimeData);
    setReport(reportData);

    const sessionRows = buildSessionRows(sessionsRaw, manifests);
    const liveCameras = realtimeData ? Object.values(realtimeData.cameras) : [];
    const liveTimestamp = realtimeData?.timestamp ?? new Date().toISOString();
    const liveRows: SessionRow[] = liveCameras.map((camera, index) => {
      const detections = camera.detections ?? [];
      const avgConfidence = detections.length > 0
        ? detections.reduce((sum, det) => sum + det.confidence, 0) / detections.length * 100
        : 0;
      const counted = camera.total || detections.length;
      return {
        id: camera.camera_id,
        manifestCode: "LIVE",
        vehicleNumber: detections.length > 0 ? `${detections.length} active detection${detections.length === 1 ? "" : "s"}` : "No active detections",
        expectedBags: 0,
        expectedBoxes: 0,
        countedBags: classCount(camera, "bag"),
        countedBoxes: classCount(camera, "box"),
        totalExpected: 0,
        totalCounted: counted,
        discrepancy: counted,
        confidenceAvg: Number(avgConfidence.toFixed(1)),
        status: "pending",
        zone: camera.zone ?? `Camera ${index + 1}`,
        camera: camera.camera_id.slice(0, 8),
        timestamp: camera.last_update
          ? new Date(camera.last_update).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase()
          : new Date(liveTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase(),
      };
    });
    const rows = liveRows.length > 0 ? [...liveRows, ...sessionRows] : sessionRows;

    setSessions(rows);
    void buildBatchTallies(sessionsRaw, manifests);
    void buildTimeSeries(sessionsRaw);
    setLoading(false);
  }, []);

  useEffect(() => {
    setCountingFeedUrl(getCountingFeedUrl());
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2_500);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Derived KPI values (from report when available, fallback to local)
  const hasReportSessions = Boolean(report && report.total_sessions > 0);
  const liveCameras = realtime ? Object.values(realtime.cameras) : [];
  const primaryLiveCamera = liveCameras.find((camera) => camera.camera_id === "jsw-counting-line") ?? liveCameras[0];
  const liveDetected = liveCameras.reduce((sum, camera) => sum + (camera.total || camera.detections?.length || 0), 0);
  const totalExpected = hasReportSessions ? report!.total_expected : sessions.reduce((a, s) => a + s.totalExpected, 0);
  const totalCounted = liveDetected || (hasReportSessions ? report!.total_counted : sessions.reduce((a, s) => a + s.totalCounted, 0));
  void totalExpected;
  void totalCounted;
  const avgConf = sessions.some((s) => s.confidenceAvg > 0)
    ? (sessions.reduce((a, s) => a + s.confidenceAvg, 0) / sessions.length).toFixed(1)
    : "0.0";
  const primaryDetections = primaryLiveCamera?.detections ?? [];
  const liveBags = activeClassCount(primaryLiveCamera, "bag");
  const liveBoxes = activeClassCount(primaryLiveCamera, "box");
  const primaryConfidence = activeConfidence(primaryLiveCamera, avgConf);

  const handleExport = useCallback(() => {
    if (sessions.length === 0) return;
    const headers = ["Manifest Code","Vehicle","Expected","Counted","Discrepancy","Confidence","Status","Zone","Camera","Time"];
    const rows = sessions.map(r => [
      r.manifestCode, r.vehicleNumber, r.totalExpected, r.totalCounted,
      r.discrepancy, r.confidenceAvg.toFixed(1) + "%", r.status, r.zone, r.camera,
      r.timestamp,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `counting-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sessions]);

  // Loading state
  if (loading) {
    return (
      <div className="p-5 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#E5521A] border-t-transparent rounded-full animate-spin" />
          <span className="text-[12px] text-[#8A9BBF] font-bold tracking-wide">Loading counting data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[11px] text-[#E5521A] font-bold tracking-[0.1em] uppercase mb-1">
            Automated Counting
          </div>
          <h2 className="text-xl font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
            Counting Summary
          </h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCountingReport(sessions)} className="flex items-center gap-2 px-4 py-2 bg-[#E5521A]/10 border border-[#E5521A]/25 rounded-xl text-[#E5521A] text-[12px] font-bold hover:bg-[#E5521A]/20 transition-colors">
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-[#22D3A1]/10 border border-[#22D3A1]/25 rounded-xl text-[#22D3A1] text-[12px] font-bold hover:bg-[#22D3A1]/20 transition-colors">
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </div>

      {/* Real-Time Counter */}
      <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px] mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-[#22D3A1]" />
          <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
            Real-Time Counter
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Live Bags", value: liveBags, color: "#22D3A1" },
            { label: "Live Boxes", value: liveBoxes, color: "#E5521A" },
            { label: "Active Detections", value: primaryDetections.length, color: "#5B9BF5" },
            { label: "Confidence", value: `${primaryConfidence}%`, color: "#F5A623" },
          ].map((item) => (
            <div key={item.label} className="rounded-[12px] bg-[#0F1A30] border border-[#1E2F50] p-3">
              <div className="text-[9px] font-bold uppercase tracking-wide text-[#4E6090] mb-1">{item.label}</div>
              <div className="text-[24px] font-black" style={{ color: item.color, fontFamily: "'Syne', sans-serif" }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Counting Feed */}
      <div className="mb-5">
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] overflow-hidden">
          <div className="flex items-center justify-between px-[18px] py-3 border-b border-[#1E2F50]">
            <div className="flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-[#E5521A]" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                Live Counting Feed
              </span>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-[#22D3A1]/30 bg-[#22D3A1]/10 px-2 py-0.5 text-[9px] font-bold text-[#22D3A1]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22D3A1] animate-pulse" />
              {realtime?.running ? "COUNTER RUNNING" : "COUNTER SYNCING"}
            </span>
          </div>
          <div className="relative aspect-video bg-black">
            <img
              src={countingFeedUrl}
              alt="JSW counting line footage"
              className="h-full w-full object-cover"
            />
            <div className="absolute left-0 right-0 top-1/2 border-t-2 border-dashed border-[#22D3A1]/80 shadow-[0_0_18px_rgba(34,211,161,0.45)]" />
            <div className="absolute left-4 top-[calc(50%-18px)] rounded-full bg-[#22D3A1] px-2 py-1 text-[9px] font-black text-[#07111F]">
              COUNT LINE
            </div>
            {primaryDetections.slice(0, 5).map((det) => (
              <div
                key={det.track_id}
                className="absolute border-2 border-[#22D3A1] bg-[#22D3A1]/10"
                style={{
                  left: `${det.bbox_x * 100}%`,
                  top: `${det.bbox_y * 100}%`,
                  width: `${det.bbox_w * 100}%`,
                  height: `${det.bbox_h * 100}%`,
                }}
              >
                <span className="absolute -top-5 left-0 rounded bg-[#22D3A1] px-1.5 py-0.5 text-[8px] font-black text-[#07111F]">
                  {det.class.toUpperCase()} {(det.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
            <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between bg-gradient-to-t from-black/85 to-transparent px-4 pb-3 pt-14">
              <div>
                <div style={{ background: "#ffffff", padding: "8px 14px", borderRadius: 10, display: "inline-block" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#000000", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
                    {primaryLiveCamera?.zone ?? "Loading Bay 1-4"}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#444444", whiteSpace: "nowrap", marginTop: 2 }}>
                    {primaryLiveCamera?.scene ?? "Vision verified bag detections"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-right">
                <div>
                  <div className="text-[9px] font-bold text-[#8A9BBF] uppercase">In</div>
                  <div className="text-[20px] font-black text-[#22D3A1]">{primaryLiveCamera?.in_count ?? 0}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-[#8A9BBF] uppercase">Out</div>
                  <div className="text-[20px] font-black text-[#F5A623]">{primaryLiveCamera?.out_count ?? 0}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-[#8A9BBF] uppercase">Net</div>
                  <div className="text-[20px] font-black text-[#5B9BF5]">{primaryLiveCamera?.total ?? 0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


        {/* Expanded detail */}
        {selectedSession && (
          <div className="mt-4 p-4 bg-[#0F1A30] rounded-xl border border-[#1E2F50]">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-[13px] font-bold text-[#E8EDF8]">{selectedSession.manifestCode} — Detail</div>
                <div className="text-[10px] text-[#8A9BBF] mt-0.5">Camera: {selectedSession.camera} · {selectedSession.zone}</div>
              </div>
              <span
                className="text-[10px] font-bold px-2 py-1 rounded-full border"
                style={{
                  background: `${reconciliationColor(selectedSession.status)}15`,
                  color: reconciliationColor(selectedSession.status),
                  borderColor: `${reconciliationColor(selectedSession.status)}30`,
                }}
              >
                {STATUS_LABEL[selectedSession.status]}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { l: "Bags", exp: selectedSession.expectedBags, cnt: selectedSession.countedBags },
                { l: "Boxes", exp: selectedSession.expectedBoxes, cnt: selectedSession.countedBoxes },
                { l: "Total", exp: selectedSession.totalExpected, cnt: selectedSession.totalCounted },
                { l: "Discrepancy", exp: null, cnt: null, val: selectedSession.discrepancy },
              ].map((d) => (
                <div key={d.l} className="bg-[#14203A] rounded-lg p-3 border border-[#1E2F50]">
                  <div className="text-[9px] text-[#4E6090] font-bold uppercase tracking-wide mb-1">{d.l}</div>
                  {d.exp !== null ? (
                    <div className="flex items-end gap-1">
                      <span className="text-[18px] font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>{d.cnt}</span>
                      <span className="text-[10px] text-[#4E6090] mb-0.5">/ {d.exp}</span>
                    </div>
                  ) : (
                    <span
                      className="text-[18px] font-extrabold"
                      style={{ color: reconciliationColor(selectedSession.status), fontFamily: "'Syne', sans-serif" }}
                    >
                      {d.val! >= 0 ? "+" : ""}{d.val}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
  );
}
