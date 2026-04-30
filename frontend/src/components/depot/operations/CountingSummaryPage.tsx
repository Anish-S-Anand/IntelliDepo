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
  Package,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Download,
  Search,
  ChevronDown,
  FileText,
  BarChart3,
  Clock,
  Target,
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
const COUNTING_FEED_URL = `/backend/depot/vision/cameras/video-library/${encodeURIComponent(COUNTING_VIDEO_FILE)}/mjpeg?theme=dark&seek=18`;

function classCount(camera: { by_class: RealtimeCountsResponse["cameras"][string]["by_class"] }, label: string): number {
  const value = camera.by_class[label];
  if (typeof value === "number") return value;
  return value?.net ?? ((value?.in ?? 0) - (value?.out ?? 0));
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);

  // API data
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [batchTallies, setBatchTallies] = useState<BatchTally[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
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

    const sessionTallies = buildBatchTallies(sessionsRaw, manifests);
    const liveTallies: BatchTally[] = liveCameras.slice(0, 8).map((camera, index) => {
      const detections = camera.detections ?? [];
      const counted = camera.total || detections.length;
      return {
        id: camera.camera_id,
        batchCode: camera.camera_id.slice(0, 8),
        product: `Live Camera ${index + 1}`,
        expected: 0,
        counted,
        variance: counted,
        variancePct: 0,
        status: counted > 0 ? "pending" : "matched",
      };
    });

    const series = buildTimeSeries(sessionsRaw);
    const liveTotal = liveCameras.reduce((sum, camera) => sum + (camera.total || camera.detections?.length || 0), 0);
    const liveSeries = realtimeData
      ? [{
          time: new Date(realtimeData.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
          bags: liveCameras.reduce((sum, camera) => sum + classCount(camera, "bag"), 0),
          boxes: liveCameras.reduce((sum, camera) => sum + classCount(camera, "box"), 0),
          cumulative: liveTotal,
        }]
      : series;

    setSessions(rows);
    setBatchTallies(liveTallies.length > 0 ? [...liveTallies, ...sessionTallies] : sessionTallies);
    if (liveSeries.length > 0) {
      setTimeSeries((prev) => {
        const next = [...prev, liveSeries[0]];
        return next.slice(-18);
      });
    } else if (series.length > 0) {
      setTimeSeries(series);
    } else {
      setTimeSeries([]);
    }
    setLoading(false);
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
  const totalDisc = totalCounted - totalExpected;
  const matchedCount = liveDetected > 0 ? 0 : hasReportSessions ? report!.matched_sessions : sessions.filter((s) => s.status === "matched").length;
  const totalSessions = liveDetected > 0 ? liveCameras.length : hasReportSessions ? report!.total_sessions : sessions.length;
  const mismatchCount = liveDetected > 0 ? liveCameras.filter((camera) => camera.out_count > 0).length : hasReportSessions ? report!.mismatch_sessions : sessions.filter((s) => s.status === "mismatch").length;
  const avgConf = sessions.some((s) => s.confidenceAvg > 0)
    ? (sessions.reduce((a, s) => a + s.confidenceAvg, 0) / sessions.length).toFixed(1)
    : "0.0";
  const primaryDetections = primaryLiveCamera?.detections ?? [];
  const primaryConfidence = primaryDetections.length > 0
    ? (primaryDetections.reduce((sum, det) => sum + det.confidence, 0) / primaryDetections.length * 100).toFixed(1)
    : avgConf;

  const filtered = sessions.filter((s) => {
    const matchSearch =
      s.manifestCode.toLowerCase().includes(search.toLowerCase()) ||
      s.vehicleNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const maxCumulative = timeSeries.length > 0 ? Math.max(...timeSeries.map((t) => t.cumulative)) : 0;

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
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            DeepSORT MOT tracking · Batch tallies · Manifest cross-verification
          </p>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {[
          { label: "Total Expected", value: totalExpected.toLocaleString(), icon: Target, color: "#5B9BF5" },
          { label: "Total Counted", value: totalCounted.toLocaleString(), icon: Package, color: "#22D3A1" },
          { label: "Discrepancy", value: `${totalDisc >= 0 ? "+" : ""}${totalDisc}`, icon: AlertTriangle, color: totalDisc === 0 ? "#22D3A1" : "#F04A4A" },
          { label: "Matched", value: `${matchedCount}/${totalSessions}`, icon: CheckCircle2, color: "#22D3A1" },
          { label: "Mismatches", value: mismatchCount.toString(), icon: AlertTriangle, color: mismatchCount > 0 ? "#F04A4A" : "#22D3A1" },
          { label: "Avg Confidence", value: `${avgConf}%`, icon: TrendingUp, color: "#5B9BF5" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 relative overflow-hidden hover:border-[#E5521A]/30 transition-all group"
          >
            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full opacity-[0.06]" style={{ background: kpi.color }} />
            <kpi.icon className="w-4 h-4 mb-2" style={{ color: kpi.color }} />
            <div className="text-[9px] font-bold tracking-[0.08em] text-[#4E6090] uppercase mb-1">{kpi.label}</div>
            <div className="text-[24px] font-extrabold leading-none" style={{ color: kpi.color, fontFamily: "'Syne', sans-serif" }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Glow divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#E5521A]/40 to-transparent mb-5" />

      {/* Live Counting Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-4 mb-5">
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
              src={COUNTING_FEED_URL}
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
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A9BBF]">
                  {primaryLiveCamera?.zone ?? "Loading Bay 1-4"}
                </div>
                <div className="text-[18px] font-black text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
                  {primaryLiveCamera?.scene ?? "Live bag movement"}
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

        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-[#22D3A1]" />
            <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
              Real-Time Counter
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Live Bags", value: classCount(primaryLiveCamera ?? { by_class: {} }, "bag"), color: "#22D3A1" },
              { label: "Live Boxes", value: classCount(primaryLiveCamera ?? { by_class: {} }, "box"), color: "#E5521A" },
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
          <div className="mt-4 rounded-[12px] bg-[#0F1A30] border border-[#1E2F50] p-3">
            <div className="text-[9px] font-bold uppercase tracking-wide text-[#4E6090] mb-2">Reference Profile</div>
            <div className="text-[12px] font-bold text-[#E8EDF8]">{primaryLiveCamera?.reference_video ?? "Recording 2025-08-04 164626.mp4"}</div>
            <div className="mt-1 text-[10px] leading-relaxed text-[#8A9BBF]">
              The count stream follows the reference scene flow: inward unloading raises the bag stock, hold/reject scenes reduce it, and the next batch resumes from the live footage.
            </div>
          </div>
        </div>
      </div>

      {/* Count Time-Series Chart + Batch Tallies */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-5">
        {/* Time-Series Chart */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#E5521A]" />
              <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                Cumulative Count — Today
              </span>
            </div>
            <div className="flex gap-2">
              {[
                { label: "Bags", color: "#5B9BF5" },
                { label: "Boxes", color: "#E5521A" },
                { label: "Cumulative", color: "#22D3A1" },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1 text-[9px] text-[#8A9BBF]">
                  <span className="w-2 h-2 rounded-sm" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          {/* Chart */}
          <div className="relative h-[200px]">
            {/* Y-axis guide lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <div
                key={pct}
                className="absolute left-0 right-0 border-t border-[#1E2F50]/50"
                style={{ bottom: `${pct * 100}%` }}
              >
                <span className="absolute -left-1 -top-2 text-[8px] text-[#4E6090]">
                  {Math.round(maxCumulative * pct).toLocaleString()}
                </span>
              </div>
            ))}
            {/* Bars */}
            <div className="flex items-end gap-1.5 h-full pl-8">
              {timeSeries.map((t, i) => {
                const bagH = maxCumulative > 0 ? (t.bags / maxCumulative) * 100 : 0;
                const boxH = maxCumulative > 0 ? (t.boxes / maxCumulative) * 100 : 0;
                const cumH = maxCumulative > 0 ? (t.cumulative / maxCumulative) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 relative group/bar">
                    {/* Cumulative line dot */}
                    <div
                      className="absolute w-2 h-2 rounded-full bg-[#22D3A1] z-10 border border-[#0A0E1A]"
                      style={{ bottom: `${cumH}%`, left: "50%", transform: "translateX(-50%)" }}
                    />
                    {/* Stacked bars */}
                    <div className="w-full flex flex-col-reverse items-center" style={{ height: `${bagH + boxH}%` }}>
                      <div className="w-full rounded-b" style={{ height: `${(bagH / (bagH + boxH || 1)) * 100}%`, background: "rgba(91,155,245,0.7)", minHeight: t.bags > 0 ? 2 : 0 }} />
                      <div className="w-full rounded-t" style={{ height: `${(boxH / (bagH + boxH || 1)) * 100}%`, background: "rgba(229,82,26,0.7)", minHeight: t.boxes > 0 ? 2 : 0 }} />
                    </div>
                    <span className="text-[8px] text-[#4E6090] mt-auto">{t.time}</span>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover/bar:block bg-[#0D1526] border border-[#1E2F50] rounded-lg p-2 text-[9px] text-[#E8EDF8] z-20 whitespace-nowrap">
                      <div>Bags: {t.bags} · Boxes: {t.boxes}</div>
                      <div className="text-[#22D3A1]">Cumulative: {t.cumulative.toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Batch Tallies */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-center mb-3.5">
            <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
              Batch Tallies
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#5B9BF5]/12 text-[#5B9BF5] border border-[#5B9BF5]/25">
              {batchTallies.length} Batches
            </span>
          </div>
          <div className="space-y-2">
            {batchTallies.map((b) => (
              <div
                key={b.id}
                className="p-2.5 rounded-[10px] bg-[#0F1A30] hover:bg-[#E5521A]/5 transition-colors"
                style={{ borderLeft: `3px solid ${reconciliationColor(b.status)}` }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-[#E8EDF8]">{b.product}</span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                    style={{
                      background: `${reconciliationColor(b.status)}22`,
                      color: reconciliationColor(b.status),
                      borderColor: `${reconciliationColor(b.status)}33`,
                    }}
                  >
                    {b.variance >= 0 ? "+" : ""}{b.variance} ({b.variancePct >= 0 ? "+" : ""}{b.variancePct}%)
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] text-[#8A9BBF]">{b.batchCode}</span>
                  <span className="text-[9px] text-[#4E6090]">{b.expected} → {b.counted}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Session Table */}
      <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#E5521A]" />
            <span className="text-[13px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
              Counting Sessions
            </span>
          </div>
          <div className="flex gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4E6090]" />
              <input
                type="text"
                placeholder="Search manifest or vehicle..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#0F1A30] border border-[#1E2F50] rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-[#E8EDF8] placeholder:text-[#4E6090] w-[200px] focus:outline-none focus:border-[#E5521A]/40"
              />
            </div>
            {/* Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-[#0F1A30] border border-[#1E2F50] rounded-lg px-3 py-1.5 pr-7 text-[11px] text-[#E8EDF8] focus:outline-none focus:border-[#E5521A]/40 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="matched">Matched</option>
                <option value="mismatch">Mismatch</option>
                <option value="pending">Pending</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#4E6090] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-[#4E6090] text-[9px] font-bold tracking-[0.06em] uppercase border-b border-[#1E2F50]">
                <th className="pb-2.5 pr-3">Manifest</th>
                <th className="pb-2.5 pr-3">Vehicle</th>
                <th className="pb-2.5 pr-3">Zone</th>
                <th className="pb-2.5 pr-3 text-right">Expected</th>
                <th className="pb-2.5 pr-3 text-right">Counted</th>
                <th className="pb-2.5 pr-3 text-right">Variance</th>
                <th className="pb-2.5 pr-3 text-right">Confidence</th>
                <th className="pb-2.5 pr-3">Status</th>
                <th className="pb-2.5 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const col = reconciliationColor(s.status);
                return (
                  <tr
                    key={s.id}
                    className="border-b border-[#1E2F50]/50 hover:bg-[#E5521A]/5 transition-colors cursor-pointer"
                    onClick={() => setSelectedSession(selectedSession?.id === s.id ? null : s)}
                  >
                    <td className="py-2.5 pr-3 font-bold text-[#E8EDF8]">{s.manifestCode}</td>
                    <td className="py-2.5 pr-3 text-[#8A9BBF]">{s.vehicleNumber}</td>
                    <td className="py-2.5 pr-3 text-[#8A9BBF]">{s.zone}</td>
                    <td className="py-2.5 pr-3 text-right text-[#8A9BBF]">{s.totalExpected}</td>
                    <td className="py-2.5 pr-3 text-right text-[#E8EDF8] font-bold">{s.totalCounted}</td>
                    <td className="py-2.5 pr-3 text-right font-bold" style={{ color: col }}>
                      {s.discrepancy >= 0 ? "+" : ""}{s.discrepancy}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-[#5B9BF5]">{s.confidenceAvg}%</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                        style={{
                          background: `${col}22`,
                          color: col,
                          borderColor: `${col}33`,
                        }}
                      >
                        {STATUS_LABEL[s.status]}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-[#4E6090]">{s.timestamp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
    </div>
  );
}
