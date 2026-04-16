"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Camera,
  Eye,
  Maximize2,
  Pause,
  Play,
  RefreshCw,
  ScanLine,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  getDepotCommandSnapshot,
  reconnectCamera,
  getCameraMjpegUrl,
  getCameraSnapshotUrl,
  type CameraRecord,
  type DepotCommandSnapshot,
} from "@/services/depotCommand";
import {
  getDetectionModels,
  startDetectionRun,
  getRunObjects,
  type DetectedObject,
  type DetectionModel,
} from "@/services/depotVision";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BoundingBox {
  id: string;
  class_label: string;
  confidence: number;
  bbox_x: number; // 0-1 normalised
  bbox_y: number;
  bbox_w: number;
  bbox_h: number;
  colour?: string;
}

const CLASS_COLOURS: Record<string, string> = {
  bag: "#3b82f6",
  box: "#f59e0b",
  pallet: "#22d3a1",
  carton: "#a78bfa",
  unknown: "#94a3b8",
};

// ---------------------------------------------------------------------------
// Convert backend DetectedObject to BoundingBox
// ---------------------------------------------------------------------------

function detectedObjectsToBoxes(objects: DetectedObject[], cameraId: string): BoundingBox[] {
  return objects.map((obj, i) => ({
    id: obj.id || `${cameraId}-det-${i}`,
    class_label: obj.class_label,
    confidence: obj.confidence,
    bbox_x: obj.bbox_x,
    bbox_y: obj.bbox_y,
    bbox_w: obj.bbox_w,
    bbox_h: obj.bbox_h,
    colour: CLASS_COLOURS[obj.class_label] || CLASS_COLOURS.unknown,
  }));
}

// ---------------------------------------------------------------------------
// BoundingBoxOverlay SVG component
// ---------------------------------------------------------------------------

function BoundingBoxOverlay({
  boxes,
  width,
  height,
}: {
  boxes: BoundingBox[];
  width: number;
  height: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
    >
      {boxes.map((box) => {
        const x = box.bbox_x * width;
        const y = box.bbox_y * height;
        const w = box.bbox_w * width;
        const h = box.bbox_h * height;
        const color = box.colour || CLASS_COLOURS[box.class_label] || CLASS_COLOURS.unknown;
        const conf = (box.confidence * 100).toFixed(1);

        return (
          <g key={box.id}>
            {/* Bounding box */}
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill="none"
              stroke={color}
              strokeWidth="2"
              rx="2"
              opacity="0.9"
            />
            {/* Corner marks for emphasis */}
            <line x1={x} y1={y} x2={x + 8} y2={y} stroke={color} strokeWidth="3" />
            <line x1={x} y1={y} x2={x} y2={y + 8} stroke={color} strokeWidth="3" />
            <line x1={x + w} y1={y} x2={x + w - 8} y2={y} stroke={color} strokeWidth="3" />
            <line x1={x + w} y1={y} x2={x + w} y2={y + 8} stroke={color} strokeWidth="3" />
            <line x1={x} y1={y + h} x2={x + 8} y2={y + h} stroke={color} strokeWidth="3" />
            <line x1={x} y1={y + h} x2={x} y2={y + h - 8} stroke={color} strokeWidth="3" />
            <line x1={x + w} y1={y + h} x2={x + w - 8} y2={y + h} stroke={color} strokeWidth="3" />
            <line x1={x + w} y1={y + h} x2={x + w} y2={y + h - 8} stroke={color} strokeWidth="3" />
            {/* Label background */}
            <rect
              x={x}
              y={y - 18}
              width={Math.max(w * 0.6, 60)}
              height="16"
              fill={color}
              rx="2"
              opacity="0.85"
            />
            {/* Label text */}
            <text
              x={x + 3}
              y={y - 6}
              fontSize="10"
              fontWeight="600"
              fill="white"
              fontFamily="monospace"
            >
              {box.class_label} {conf}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// CameraCard component
// ---------------------------------------------------------------------------

function CameraCard({
  camera,
  boxes,
  isSelected,
  onSelect,
  onReconnect,
  isReconnecting,
  snapshotTick,
}: {
  camera: CameraRecord;
  boxes: BoundingBox[];
  isSelected: boolean;
  onSelect: () => void;
  onReconnect: () => void;
  isReconnecting: boolean;
  snapshotTick: number;
}) {
  const online = camera.status === "active";
  const detectionCount = boxes.length;
  const mjpegUrl = online ? getCameraMjpegUrl(camera.id) : null;
  const snapshotUrl = online
    ? `${getCameraSnapshotUrl(camera.id)}?t=${snapshotTick}`
    : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-[16px] border overflow-hidden transition-all ${
        isSelected
          ? "border-[#E5521A]/50 bg-[#14203A] shadow-[0_0_20px_rgba(229,82,26,0.15)]"
          : "border-[#1E2F50] bg-[#14203A] hover:border-[#2A3F68]"
      }`}
    >
      {/* Feed area with bounding boxes */}
      <div className="relative aspect-video overflow-hidden bg-[#0A1628]">
        {online ? (
          <>
            {/* Real camera snapshot (refreshed on tick) */}
            {mjpegUrl && (
              <img
                src={mjpegUrl}
                alt={`${camera.name} feed`}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (snapshotUrl && target.src !== snapshotUrl) {
                    target.src = snapshotUrl;
                    return;
                  }
                  target.style.display = "none";
                }}
              />
            )}
            {/* Fallback pattern behind snapshot */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800" />
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />
            </div>

            {/* Bounding box overlay */}
            <BoundingBoxOverlay boxes={boxes} width={384} height={216} />

            {/* Camera ID and status */}
            <div className="absolute top-2 left-2 right-2 flex justify-between z-10">
              <span className="bg-black/60 text-white text-[9px] font-mono px-2 py-0.5 rounded backdrop-blur-sm">
                {camera.name}
              </span>
              <span className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] text-emerald-400 font-semibold">LIVE</span>
              </span>
            </div>

            {/* Detection count badge */}
            {detectionCount > 0 && (
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded backdrop-blur-sm z-10">
                <ScanLine className="w-3 h-3 text-[#E5521A]" />
                <span className="text-[10px] font-bold text-white">
                  {detectionCount} objects
                </span>
              </div>
            )}

            {/* Confidence badge */}
            {boxes.length > 0 && (
              <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 rounded backdrop-blur-sm z-10">
                <span className="text-[10px] text-cyan-300 font-mono">
                  {(
                    (boxes.reduce((sum, b) => sum + b.confidence, 0) / boxes.length) *
                    100
                  ).toFixed(1)}
                  % avg
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <WifiOff className="w-5 h-5 text-[#4E6090]" />
            <span className="text-[11px] text-[#4E6090]">Camera Offline</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReconnect();
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[#1E2F50] bg-[#0F1A30] text-[10px] text-[#8A9BBF] hover:border-[#E5521A]/30 hover:text-[#E5521A] transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isReconnecting ? "animate-spin" : ""}`} />
              Reconnect
            </button>
          </div>
        )}
      </div>

      {/* Camera info footer */}
      <div className="p-3 border-t border-[#1E2F50]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-bold text-[#E8EDF8]">{camera.name}</span>
          <span
            className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              online
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
            }`}
          >
            {online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {camera.status}
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] text-[#4E6090]">
          <span>{camera.zone || "Unassigned"}</span>
          <span>{camera.resolution} | {camera.frame_rate}fps</span>
        </div>

        {/* Detection summary chips */}
        {boxes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {Object.entries(
              boxes.reduce(
                (acc, b) => {
                  acc[b.class_label] = (acc[b.class_label] || 0) + 1;
                  return acc;
                },
                {} as Record<string, number>,
              ),
            ).map(([cls, count]) => {
              const c = CLASS_COLOURS[cls] || "#94a3b8";
              return (
                <span
                  key={cls}
                  className="text-[9px] font-semibold px-2 py-0.5 rounded-full border"
                  style={{
                    background: `${c}15`,
                    color: c,
                    borderColor: `${c}30`,
                  }}
                >
                  {count} {cls}{count > 1 ? "s" : ""}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Expanded Camera View
// ---------------------------------------------------------------------------

function ExpandedCameraView({
  camera,
  boxes,
  onClose,
  snapshotTick,
}: {
  camera: CameraRecord;
  boxes: BoundingBox[];
  onClose: () => void;
  snapshotTick: number;
}) {
  const snapshotUrl = `${getCameraSnapshotUrl(camera.id)}?t=${snapshotTick}`;
  const mjpegUrl = getCameraMjpegUrl(camera.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl mx-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="rounded-[20px] border border-[#1E2F50] bg-[#0A0E1A] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#1E2F50]">
            <div className="flex items-center gap-3">
              <Camera className="w-4 h-4 text-[#E5521A]" />
              <span className="text-sm font-bold text-white">{camera.name}</span>
              <span className="text-[10px] text-[#4E6090]">{camera.zone}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
              <span className="text-[10px] text-[#4E6090]">
                {camera.resolution} | {camera.frame_rate}fps
              </span>
            </div>
          </div>
          <div className="relative aspect-video bg-[#0A1628]">
            {/* Real camera snapshot */}
            <img
              src={mjpegUrl}
              alt={`${camera.name} expanded feed`}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src !== snapshotUrl) {
                  target.src = snapshotUrl;
                  return;
                }
                target.style.display = "none";
              }}
            />
            <div className="absolute inset-0 opacity-15">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
                  backgroundSize: "30px 30px",
                }}
              />
            </div>
            <BoundingBoxOverlay boxes={boxes} width={960} height={540} />
          </div>
          {/* Detection details table */}
          <div className="px-5 py-3 border-t border-[#1E2F50]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#4E6090] mb-2">
              Detected Objects
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {boxes.map((box) => {
                const c = CLASS_COLOURS[box.class_label] || "#94a3b8";
                return (
                  <div
                    key={box.id}
                    className="rounded-lg border p-2"
                    style={{
                      borderColor: `${c}30`,
                      background: `${c}08`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold capitalize" style={{ color: c }}>
                        {box.class_label}
                      </span>
                      <span className="text-[9px] font-mono text-[#8A9BBF]">
                        {(box.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    {/* Confidence bar */}
                    <div className="w-full h-1 rounded-full bg-[#1E2F50] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${box.confidence * 100}%`,
                          background: c,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {boxes.length === 0 && (
                <p className="text-[11px] text-[#4E6090] col-span-full">
                  No objects currently detected
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main LiveFeedViewer component
// ---------------------------------------------------------------------------

export default function LiveFeedViewer() {
  const [snapshot, setSnapshot] = useState<DepotCommandSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [expandedCameraId, setExpandedCameraId] = useState<string | null>(null);
  const [busyCameraId, setBusyCameraId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [cameraBoxes, setCameraBoxes] = useState<Record<string, BoundingBox[]>>({});
  const [detectionModel, setDetectionModel] = useState<DetectionModel | null>(null);
  const detectingRef = useRef(false);

  // Load available YOLO detection models on mount
  useEffect(() => {
    getDetectionModels()
      .then((models) => {
        const active = models.find((m) => m.is_active);
        if (active) setDetectionModel(active);
      })
      .catch(() => {
        // Model list unavailable — detection will use backend defaults
      });
  }, []);

  const loadData = useCallback(async () => {
    try {
      const data = await getDepotCommandSnapshot();
      setSnapshot(data);
      if (!selectedCameraId && data.cameras.data.length > 0) {
        setSelectedCameraId(data.cameras.data[0].id);
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(false);
    }
  }, [selectedCameraId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Live update tick — refreshes snapshots and triggers detection
  useEffect(() => {
    if (!live) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, [live]);

  // Run detection on active cameras via backend API
  const cameras = (() => {
    const all = snapshot?.cameras.data ?? [];
    // Deduplicate by name, preferring cameras with tfl: stream URLs (working feeds)
    const byName = new Map<string, CameraRecord>();
    for (const c of all) {
      const hasTfl = c.stream_url?.startsWith("tfl:");
      if (!byName.has(c.name) || hasTfl) byName.set(c.name, c);
    }
    return Array.from(byName.values()).slice(0, 6);
  })();

  useEffect(() => {
    if (!live || !detectionModel || detectingRef.current) return;
    const activeCams = cameras.filter((c) => c.status === "active");
    if (activeCams.length === 0) return;

    detectingRef.current = true;

    Promise.allSettled(
      activeCams.map(async (cam) => {
        try {
          const run = await startDetectionRun(detectionModel.id, 1, cam.id);
          const objects = await getRunObjects(run.id);
          return { cameraId: cam.id, boxes: detectedObjectsToBoxes(objects, cam.id) };
        } catch {
          return { cameraId: cam.id, boxes: [] as BoundingBox[] };
        }
      })
    ).then((results) => {
      const newBoxes: Record<string, BoundingBox[]> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          newBoxes[result.value.cameraId] = result.value.boxes;
        }
      }
      setCameraBoxes((prev) => ({ ...prev, ...newBoxes }));
      detectingRef.current = false;
    });
  }, [tick, live, detectionModel, cameras]);

  // Refresh camera list periodically
  useEffect(() => {
    if (!live) return;
    const interval = setInterval(() => {
      void loadData();
    }, 30000);
    return () => clearInterval(interval);
  }, [live, loadData]);

  const totalDetections = Object.values(cameraBoxes).reduce(
    (sum, boxes) => sum + boxes.length,
    0,
  );
  const activeCameras = cameras.filter((c) => c.status === "active").length;

  // Detection summary across all cameras
  const globalCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const boxes of Object.values(cameraBoxes)) {
      for (const box of boxes) {
        counts[box.class_label] = (counts[box.class_label] || 0) + 1;
      }
    }
    return counts;
  }, [cameraBoxes]);

  const expandedCamera = expandedCameraId
    ? cameras.find((c) => c.id === expandedCameraId) ?? null
    : null;

  const handleReconnect = async (cameraId: string) => {
    setBusyCameraId(cameraId);
    try {
      await reconnectCamera(cameraId);
      await loadData();
    } finally {
      setBusyCameraId(null);
    }
  };

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      {/* Header */}
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Eye className="w-5 h-5 text-[#E5521A]" />
            <h1
              className="text-[22px] font-extrabold text-[#E8EDF8]"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              IntelliVision -- Live Feed Viewer
            </h1>
          </div>
          <p className="text-[11px] text-[#8A9BBF]">
            Real-time YOLO object detection with bounding box overlays | 85%
            confidence threshold
            {detectionModel && (
              <span className="ml-2 text-emerald-400">
                Model: {detectionModel.model_name} {detectionModel.model_version}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {/* Stats chips */}
          <div className="flex gap-3 text-[12px]">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#1E2F50] bg-[#14203A]">
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-extrabold text-emerald-400">{activeCameras}</span>
              <span className="text-[#4E6090]">live</span>
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#1E2F50] bg-[#14203A]">
              <ScanLine className="w-3.5 h-3.5 text-[#E5521A]" />
              <span className="font-extrabold text-[#E5521A]">{totalDetections}</span>
              <span className="text-[#4E6090]">objects</span>
            </span>
          </div>

          {/* Global detection counts */}
          <div className="flex gap-2 text-[11px]">
            {Object.entries(globalCounts).map(([cls, count]) => (
              <span
                key={cls}
                className="px-2 py-0.5 rounded-full border"
                style={{
                  color: CLASS_COLOURS[cls] || "#94a3b8",
                  borderColor: `${CLASS_COLOURS[cls] || "#94a3b8"}30`,
                  background: `${CLASS_COLOURS[cls] || "#94a3b8"}10`,
                }}
              >
                <span className="font-bold">{count}</span> {cls}s
              </span>
            ))}
          </div>

          {/* Live toggle */}
          <button
            type="button"
            onClick={() => setLive(!live)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
              live
                ? "border-[#E5521A] bg-[#E5521A]/10 text-[#E5521A]"
                : "border-[#1E2F50] text-[#8A9BBF] hover:border-[#2A3F68]"
            }`}
          >
            {live ? (
              <>
                <Pause className="w-3 h-3" /> LIVE
              </>
            ) : (
              <>
                <Play className="w-3 h-3" /> PAUSED
              </>
            )}
          </button>
        </div>
      </div>

      {/* Camera grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-[#4E6090] text-sm">
          Loading camera feeds...
        </div>
      ) : cameras.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-[#4E6090]">
          <Camera className="w-8 h-8" />
          <p className="text-sm">No cameras registered yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cameras.map((camera) => (
            <div key={camera.id} className="relative group">
              <CameraCard
                camera={camera}
                boxes={cameraBoxes[camera.id] || []}
                isSelected={selectedCameraId === camera.id}
                onSelect={() => setSelectedCameraId(camera.id)}
                onReconnect={() => void handleReconnect(camera.id)}
                isReconnecting={busyCameraId === camera.id}
                snapshotTick={tick}
              />
              {/* Expand button */}
              {camera.status === "active" && (
                <button
                  type="button"
                  onClick={() => setExpandedCameraId(camera.id)}
                  className="absolute top-2 right-12 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 p-1 rounded backdrop-blur-sm"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-white/70" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Expanded camera modal */}
      {expandedCamera && (
        <ExpandedCameraView
          camera={expandedCamera}
          boxes={cameraBoxes[expandedCamera.id] || []}
          onClose={() => setExpandedCameraId(null)}
          snapshotTick={tick}
        />
      )}
    </div>
  );
}
