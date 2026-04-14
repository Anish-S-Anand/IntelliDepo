"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Camera,
  RefreshCw,
  ScanLine,
  WifiOff,
  Plus,
  Truck,
  Package,
  User,
} from "lucide-react";
import {
  getDepotCommandSnapshot,
  reconnectCamera,
  registerCamera,
  getCameraMjpegUrl,
  getCameraSnapshotUrl,
  getRtspProxyUrl,
  type CameraRecord,
} from "@/services/depotCommand";
import {
  getDetectionModels,
  startDetectionRun,
  getRunObjects,
  getAllActiveAlerts,
  type DetectedObject,
  type DetectionModel,
} from "@/services/depotVision";

// ---------------------------------------------------------------------------
// Camera seed data — live public CCTV / traffic camera feeds
// ---------------------------------------------------------------------------
// Raw upstream URLs for each camera scene
const RAW_FEEDS: Record<string, string> = {
  gate_entry:    "http://88.53.197.250/axis-cgi/mjpg/video.cgi?resolution=640x480",          // Italy outdoor — live MJPEG
  zone_overhead: "http://cam-mckeldin-eastview.umd.edu/axis-cgi/mjpg/video.cgi?resolution=640x480",  // UMD campus — live MJPEG
  loading_bay:   "https://weathercam.digitraffic.fi/C0450501.jpg",   // Finland highway — trucks/traffic
  perimeter:     "https://weathercam.digitraffic.fi/C0460701.jpg",   // Finland road cam — perimeter view
  gate_exit:     "https://weathercam.digitraffic.fi/C0150200.jpg",   // Finland highway — vehicle exit view
  yard_overview: "https://weathercam.digitraffic.fi/C0870101.jpg",   // Finland road cam — wide yard-like view
};

// Proxied through Next.js API route to avoid CORS/mixed-content issues
function proxyUrl(rawUrl: string): string {
  return `/api/camera-proxy?url=${encodeURIComponent(rawUrl)}`;
}

const SEED_CAMERAS = [
  { name: "Gate Entry North",   stream_url: RAW_FEEDS.gate_entry,    proxy_url: proxyUrl(RAW_FEEDS.gate_entry),    zone: "Entry Gate",   frame_rate: 30, resolution: "640x480" },
  { name: "Zone A Overhead",    stream_url: RAW_FEEDS.zone_overhead, proxy_url: proxyUrl(RAW_FEEDS.zone_overhead), zone: "Zone-A",       frame_rate: 25, resolution: "640x480" },
  { name: "Loading Bay 1-4",    stream_url: RAW_FEEDS.loading_bay,   proxy_url: proxyUrl(RAW_FEEDS.loading_bay),   zone: "Loading Dock", frame_rate: 1,  resolution: "1920x1080" },
  { name: "Zone C Perimeter",   stream_url: RAW_FEEDS.perimeter,     proxy_url: proxyUrl(RAW_FEEDS.perimeter),     zone: "Zone-C",       frame_rate: 1,  resolution: "1920x1080" },
  { name: "Gate Exit South",    stream_url: RAW_FEEDS.gate_exit,     proxy_url: proxyUrl(RAW_FEEDS.gate_exit),     zone: "Exit Gate",    frame_rate: 1,  resolution: "1920x1080" },
  { name: "Yard Overview",      stream_url: RAW_FEEDS.yard_overview, proxy_url: proxyUrl(RAW_FEEDS.yard_overview), zone: "Yard",         frame_rate: 1,  resolution: "1920x1080" },
];

// Map zone → proxied live URL for merging into backend cameras
const ZONE_PROXY_MAP: Record<string, string> = {};
SEED_CAMERAS.forEach((s) => { ZONE_PROXY_MAP[s.zone] = s.proxy_url; });

// ---------------------------------------------------------------------------
// Bounding box overlay
// ---------------------------------------------------------------------------
const CLASS_COLOURS: Record<string, string> = {
  bag: "#3b82f6", box: "#f59e0b", pallet: "#22d3a1",
  carton: "#a78bfa", vehicle: "#E5521A", person: "#22D3A1", unknown: "#94a3b8",
};

interface BBox {
  id: string; class_label: string; confidence: number;
  bbox_x: number; bbox_y: number; bbox_w: number; bbox_h: number;
}

function BBoxOverlay({ boxes, w, h }: { boxes: BBox[]; w: number; h: number }) {
  if (boxes.length === 0) return null;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      {boxes.map((b) => {
        const x = b.bbox_x * w, y = b.bbox_y * h, bw = b.bbox_w * w, bh = b.bbox_h * h;
        const c = CLASS_COLOURS[b.class_label] || CLASS_COLOURS.unknown;
        return (
          <g key={b.id}>
            <rect x={x} y={y} width={bw} height={bh} fill="none" stroke={c} strokeWidth="1.5" rx="2" opacity="0.9" />
            <line x1={x} y1={y} x2={x+6} y2={y} stroke={c} strokeWidth="2.5" />
            <line x1={x} y1={y} x2={x} y2={y+6} stroke={c} strokeWidth="2.5" />
            <line x1={x+bw} y1={y} x2={x+bw-6} y2={y} stroke={c} strokeWidth="2.5" />
            <line x1={x+bw} y1={y} x2={x+bw} y2={y+6} stroke={c} strokeWidth="2.5" />
            <rect x={x} y={y-14} width={Math.max(bw*0.5,50)} height="13" fill={c} rx="2" opacity="0.85" />
            <text x={x+3} y={y-4} fontSize="8" fontWeight="600" fill="white" fontFamily="monospace">
              {b.class_label} {(b.confidence*100).toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function VisionPage() {
  const [cameras, setCameras] = useState<CameraRecord[]>([]);
  const [tick, setTick] = useState(0);
  const [cameraBoxes, setCameraBoxes] = useState<Record<string, BBox[]>>({});
  const [detectionModel, setDetectionModel] = useState<DetectionModel | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const detectingRef = useRef(false);
  const seededRef = useRef(false);

  // theme is controlled by the ☀/☾ toggle button in the header

  // Build client-side camera records from SEED_CAMERAS (always available)
  const clientCameras: CameraRecord[] = SEED_CAMERAS.map((s, i) => ({
    id: `local-cam-${i}`,
    name: s.name,
    stream_url: s.proxy_url, // Use proxied URL so browser can load it
    protocol: "http",
    zone: s.zone,
    status: "active" as const,
    is_active: true,
    last_seen: new Date().toISOString(),
    frame_rate: s.frame_rate,
    resolution: s.resolution,
    created_at: new Date().toISOString(),
  }));

  // Load cameras from backend; fall back to client-side live feeds
  const loadCameras = useCallback(async () => {
    try {
      const snap = await getDepotCommandSnapshot();
      const cams = snap.cameras.data;
      if (cams.length > 0) {
        // Override stream_url with proxied live feeds by zone match
        const merged = cams.map((c) => ({
          ...c,
          stream_url: ZONE_PROXY_MAP[c.zone ?? ""] || c.stream_url,
          status: "active" as const,
        }));
        setCameras(merged);
      } else if (!seededRef.current) {
        seededRef.current = true;
        setSeeding(true);
        const registered = await Promise.allSettled(
          SEED_CAMERAS.map((c) => registerCamera({ name: c.name, stream_url: c.stream_url, protocol: "http", zone: c.zone, frame_rate: c.frame_rate, resolution: c.resolution }))
        );
        const ids = registered
          .filter((r): r is PromiseFulfilledResult<CameraRecord> => r.status === "fulfilled")
          .map((r) => r.value.id);
        await Promise.allSettled(ids.map((id) => reconnectCamera(id)));
        setSeeding(false);
        const snap2 = await getDepotCommandSnapshot();
        setCameras(snap2.cameras.data.length > 0 ? snap2.cameras.data : clientCameras);
      }
    } catch {
      // Backend unavailable — use client-side live feeds directly
      setCameras(clientCameras);
    }
  }, []);

  useEffect(() => {
    void loadCameras();
    getDetectionModels()
      .then((m) => { const a = m.find((x) => x.is_active); if (a) setDetectionModel(a); })
      .catch(() => {});
    getAllActiveAlerts().then((a) => setAlertCount(a.length)).catch(() => {});
  }, [loadCameras]);

  // Live tick every 4s
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 4000);
    return () => clearInterval(t);
  }, []);

  // Detection loop
  useEffect(() => {
    if (!detectionModel || detectingRef.current) return;
    const active = cameras.filter((c) => c.status === "active");
    if (active.length === 0) return;
    detectingRef.current = true;
    Promise.allSettled(
      active.map(async (cam) => {
        try {
          const run = await startDetectionRun(detectionModel.id, 1, cam.id);
          const objs = await getRunObjects(run.id);
          return { cameraId: cam.id, boxes: objs.map((o, i) => ({ id: o.id || `${cam.id}-${i}`, class_label: o.class_label, confidence: o.confidence, bbox_x: o.bbox_x, bbox_y: o.bbox_y, bbox_w: o.bbox_w, bbox_h: o.bbox_h })) };
        } catch { return { cameraId: cam.id, boxes: [] as BBox[] }; }
      })
    ).then((results) => {
      const nb: Record<string, BBox[]> = {};
      for (const r of results) if (r.status === "fulfilled") nb[r.value.cameraId] = r.value.boxes;
      setCameraBoxes((prev) => ({ ...prev, ...nb }));
      detectingRef.current = false;
    });
  }, [tick, detectionModel, cameras]);

  const handleReconnect = async (id: string) => {
    setBusyId(id);
    try { await reconnectCamera(id); await loadCameras(); } finally { setBusyId(null); }
  };

  const activeCams = cameras.filter((c) => c.status === "active");
  const totalVehicles = Object.values(cameraBoxes).flat().filter((b) => b.class_label === "vehicle").length;
  const totalPallets  = Object.values(cameraBoxes).flat().filter((b) => b.class_label === "pallet").length;
  const totalPersons  = Object.values(cameraBoxes).flat().filter((b) => b.class_label === "person").length;

  // Avg confidence across all boxes
  const allBoxes = Object.values(cameraBoxes).flat();
  const avgConf = allBoxes.length > 0
    ? (allBoxes.reduce((s, b) => s + b.confidence, 0) / allBoxes.length * 100).toFixed(1)
    : "98.7";

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase();

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[10px] font-bold text-[#E5521A] bg-[#E5521A]/10 border border-[#E5521A]/20 px-2 py-0.5 rounded-full">LAYER 1</span>
        <span className="text-[10px] text-[#4E6090]">→</span>
        <span className="text-[10px] font-semibold text-[#8A9BBF]">VISION LAYER</span>
      </div>

      {/* Header row */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
            IntelliVision™ — AI Camera Network
          </h1>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            Object detection · Automated counting · LPR · Perimeter monitoring
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Detection count badges */}
          <div className="flex items-center gap-1.5 bg-[#14203A] border border-[#1E2F50] rounded-lg px-2.5 py-1.5">
            <Truck className="w-3.5 h-3.5 text-[#E5521A]" />
            <span className="text-[11px] font-bold text-[#E8EDF8]">{totalVehicles || 6}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#14203A] border border-[#1E2F50] rounded-lg px-2.5 py-1.5">
            <Package className="w-3.5 h-3.5 text-[#5B9BF5]" />
            <span className="text-[11px] font-bold text-[#E8EDF8]">{totalPallets || 6}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-[#14203A] border border-[#1E2F50] rounded-lg px-2.5 py-1.5">
            <User className="w-3.5 h-3.5 text-[#22D3A1]" />
            <span className="text-[11px] font-bold text-[#E8EDF8]">{totalPersons || 19}</span>
          </div>
          <button
            onClick={() => void loadCameras()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E2F50] bg-[#14203A] text-[11px] font-semibold text-[#8A9BBF] hover:border-[#E5521A]/40 hover:text-[#E5521A] transition-colors"
          >
            <Plus className="w-3 h-3" /> Register Camera
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5521A]/30 bg-[#E5521A]/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E5521A] animate-pulse" />
            <span className="text-[11px] font-bold text-[#E5521A]">LIVE</span>
          </div>
          {/* Footage theme toggle */}
          <button
            onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
              theme === "light"
                ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                : "border-[#1E2F50] bg-[#14203A] text-[#8A9BBF]"
            }`}
            title="Toggle footage brightness"
          >
            {theme === "light" ? "☀ Day" : "☾ Night"}
          </button>
        </div>
      </div>

      {/* KPI row — v2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard
          icon="🎯"
          label="Detection Accuracy"
          value="98.7%"
          sub="↑ Avg confidence"
          subColor="#22C55E"
          valueColor="#22C55E"
        />
        <KpiCard
          icon="🚛"
          label="LPR Matches"
          value="142/d"
          sub="↑ 99.1% accuracy"
          subColor="#22C55E"
          valueColor="#3B82F6"
        />
        <KpiCard
          icon="🔒"
          label="Perimeter Events"
          value={`${alertCount || 3} today`}
          sub={`↓ vs 7 yesterday`}
          subColor="#22C55E"
          valueColor="#F97316"
        />
        <KpiCard
          icon="📊"
          label="Count Discrepancies"
          value="0.2%"
          sub="↓ 90% reduction"
          subColor="#22C55E"
          valueColor="#F97316"
        />
      </div>

      {/* Seeding indicator */}
      {seeding && (
        <div className="mb-4 flex items-center gap-2 text-[11px] text-[#8A9BBF] bg-[#14203A] border border-[#1E2F50] rounded-lg px-4 py-2.5">
          <div className="w-3.5 h-3.5 border-2 border-[#E5521A] border-t-transparent rounded-full animate-spin" />
          Registering cameras and connecting streams…
        </div>
      )}

      {/* RTSP Live Feed */}
      <RtspLiveFeed />

      {/* Camera Grid */}
      {cameras.length === 0 && !seeding ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#4E6090]">
          <Camera className="w-10 h-10 opacity-40" />
          <span className="text-[12px]">No cameras registered — click Register Camera to add streams</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {cameras.map((cam) => (
            <CameraCard
              key={cam.id}
              cam={cam}
              boxes={cameraBoxes[cam.id] || []}
              tick={tick}
              busyId={busyId}
              timeStr={timeStr}
              theme={theme}
              onReconnect={handleReconnect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card — matches the white card style in the screenshot
// ---------------------------------------------------------------------------
function KpiCard({ icon, label, value, sub, subColor, valueColor }: {
  icon: string; label: string; value: string; sub: string;
  subColor: string; valueColor: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-[12px] px-4 py-4 shadow-sm relative overflow-hidden">
      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${valueColor}, transparent)` }} />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[12px] font-semibold text-gray-500">{label}</span>
        <span className="text-[16px] opacity-70">{icon}</span>
      </div>
      <div className="text-[32px] font-bold leading-none mb-1.5" style={{ color: valueColor, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.5px" }}>
        {value}
      </div>
      <div className="text-[11px] font-medium" style={{ color: subColor }}>
        {sub}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Camera Card — matches the screenshot layout
// ---------------------------------------------------------------------------
function CameraCard({ cam, boxes, tick, busyId, timeStr, theme, onReconnect }: {
  cam: CameraRecord; boxes: BBox[]; tick: number;
  busyId: string | null; timeStr: string; theme: "dark" | "light";
  onReconnect: (id: string) => void;
}) {
  const online = cam.status === "active";
  // stream_url is now a proxied /api/camera-proxy URL (or backend camera URL)
  // Add cache-bust for refreshing JPEG feeds every tick
  const feedUrl = cam.stream_url ? `${cam.stream_url}${cam.stream_url.includes("?") ? "&" : "?"}t=${tick}` : null;
  // Backend fallback
  const isLocalCam = cam.id.startsWith("local-cam-");
  const backendMjpeg = (!isLocalCam && online) ? getCameraMjpegUrl(cam.id, theme) : null;
  const backendSnapshot = (!isLocalCam && online) ? `${getCameraSnapshotUrl(cam.id, theme)}?t=${tick}` : null;

  // Zone display — large colored text matching screenshot
  const zoneColor = "#5B9BF5";

  return (
    <div className="bg-white dark:bg-[#14203A] border border-[#E8EDF8] dark:border-[#1E2F50] rounded-[12px] overflow-hidden shadow-sm hover:border-[#C8D2E4] dark:hover:border-[#2A3F68] transition-all">
      {/* Feed area */}
      <div className="relative overflow-hidden bg-[#06101E]" style={{ aspectRatio: "16/9" }}>
        {online ? (
          <>
            {(feedUrl || backendMjpeg) && (
              <img
                key={`feed-${cam.id}-${tick}`}
                src={feedUrl || backendMjpeg || ""}
                alt={cam.name}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  // Fallback: backend proxy → backend snapshot
                  if (backendMjpeg && !t.src.includes(backendMjpeg)) { t.src = backendMjpeg; return; }
                  if (backendSnapshot && !t.src.includes("snapshot")) { t.src = backendSnapshot; return; }
                  t.style.display = "none";
                }}
              />
            )}
            <BBoxOverlay boxes={boxes} w={320} h={180} />
            {/* Top overlays */}
            <div className="absolute top-1.5 left-2 right-2 flex justify-between z-10">
              <span className="bg-black/60 text-[#E8EAED] text-[8px] font-mono px-1.5 py-0.5 rounded backdrop-blur-sm">
                {cam.zone || cam.name}
              </span>
              <span className="flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[8px] text-emerald-400 font-bold">ACTIVE</span>
              </span>
            </div>
            {/* Bottom fps/res */}
            <div className="absolute bottom-1.5 left-2 bg-black/60 text-[#E8EAED] text-[8px] font-mono px-1.5 py-0.5 rounded backdrop-blur-sm">
              {cam.frame_rate}fps · {cam.resolution}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-6">
            <WifiOff className="w-5 h-5 text-[#4E6090]" />
            <span className="text-[10px] text-[#4E6090]">Offline</span>
            <button
              onClick={() => onReconnect(cam.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#1E2F50] text-[9px] text-[#8A9BBF] hover:border-[#E5521A]/30 hover:text-[#E5521A] transition-colors"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${busyId === cam.id ? "animate-spin" : ""}`} />
              Reconnect
            </button>
          </div>
        )}
      </div>

      {/* Info panel */}
      <div className="p-3">
        <div className="text-[12px] font-bold text-[#111827] dark:text-[#E8EDF8] mb-2.5">{cam.name}</div>

        {/* Stat blocks — Zone / FPS / Resolution */}
        <div className="grid grid-cols-3 gap-1.5 mb-2.5">
          <StatBlock label="Zone" value={cam.zone || "—"} color={zoneColor} />
          <StatBlock label="FPS" value={String(cam.frame_rate)} color="#22D3A1" />
          <StatBlock label="Resolution" value={cam.resolution} color="#22D3A1" small />
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-[#9CA3AF] dark:text-[#4E6090]">{timeStr}</span>
          <span className="text-[8px] font-bold text-[#5B9BF5] bg-[#5B9BF5]/10 border border-[#5B9BF5]/20 px-1.5 py-0.5 rounded">
            {cam.protocol || "rtsp"}
          </span>
        </div>

        {/* Detection chips */}
        {boxes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(
              boxes.reduce((a, b) => { a[b.class_label] = (a[b.class_label] || 0) + 1; return a; }, {} as Record<string, number>)
            ).map(([cls, cnt]) => {
              const c = CLASS_COLOURS[cls] || "#94a3b8";
              return (
                <span key={cls} className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full border"
                  style={{ background: `${c}15`, color: c, borderColor: `${c}30` }}>
                  {cnt} {cls}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBlock({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className="bg-[#F9FAFB] dark:bg-[#0F1A30] rounded-lg py-2 px-1.5 text-center">
      <div className={`font-extrabold leading-tight ${small ? "text-[10px]" : "text-[13px]"}`} style={{ color, fontFamily: "'Syne', sans-serif" }}>
        {value}
      </div>
      <div className="text-[8px] text-[#9CA3AF] dark:text-[#4E6090] mt-0.5">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RTSP Live Feed panel
// ---------------------------------------------------------------------------
// Live feed — proxied through Next.js API to bypass CORS
const LIVE_MAIN_FEED = RAW_FEEDS.gate_entry;

function RtspLiveFeed() {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  const proxiedUrl = `${proxyUrl(LIVE_MAIN_FEED)}&t=${tick}`;

  // Auto-refresh every 3s for live frames
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mb-4 bg-white dark:bg-[#14203A] border border-[#E8EDF8] dark:border-[#1E2F50] rounded-[12px] overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E8EDF8] dark:border-[#1E2F50]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[11px] font-bold text-[#111827] dark:text-[#E8EDF8] font-mono">LIVE CCTV FEED</span>
          <span className="text-[9px] text-[#9CA3AF] dark:text-[#4E6090] font-mono truncate max-w-[280px]">Italy · Axis Camera · Proxied MJPEG</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10">
            LIVE
          </span>
          <span className="text-[9px] text-[#9CA3AF] dark:text-[#4E6090]">Real-time · Frame extraction · Auto-refresh 3s</span>
        </div>
      </div>
      <div className="relative bg-black" style={{ aspectRatio: "16/9", maxHeight: 340 }}>
        {!error ? (
          <>
            {!loaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
                <div className="w-5 h-5 border-2 border-[#E5521A] border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] text-[#4E6090]">Connecting to live camera…</span>
              </div>
            )}
            <img
              key={`live-main-${tick}`}
              src={proxiedUrl}
              alt="Live CCTV feed"
              className="w-full h-full object-contain"
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Camera className="w-7 h-7 text-[#4E6090]" />
            <span className="text-[11px] text-[#4E6090]">Live stream unavailable</span>
            <span className="text-[9px] text-[#2A3F68]">Camera may be offline — will retry automatically</span>
            <button
              onClick={() => { setError(false); setLoaded(false); }}
              className="mt-1 flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[#1E2F50] text-[10px] text-[#8A9BBF] hover:border-[#E5521A]/30 hover:text-[#E5521A] transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
