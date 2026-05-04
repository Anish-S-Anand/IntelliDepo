"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ScanLine, Shield, CheckCircle2, XCircle, Camera, Wifi, AlertTriangle } from "lucide-react";
import {
  getGates,
  processLprImageScan,
  type GateResponse,
  type LprScanImageResult,
} from "@/services/depotGate";
import { getDepotCommandSnapshot, getCameraMjpegUrl, getCameraSnapshotUrl } from "@/services/depotCommand";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SCAN_INTERVAL_MS = 6000;   // auto-scan every 6s
const CONFIDENCE_WARN = 0.65;    // below this = amber, below 0.40 = red

function confColor(conf: number): string {
  if (conf >= 0.75) return "#22D3A1";
  if (conf >= CONFIDENCE_WARN) return "#F5A623";
  return "#F04A4A";
}

function decisionStyle(decision: string): { color: string; bg: string; icon: React.ReactNode } {
  switch (decision.toLowerCase()) {
    case "granted":
      return { color: "#22D3A1", bg: "rgba(34,211,161,0.12)", icon: <CheckCircle2 className="w-4 h-4" /> };
    case "denied":
    case "blacklisted":
      return { color: "#F04A4A", bg: "rgba(240,74,74,0.12)", icon: <XCircle className="w-4 h-4" /> };
    default:
      return { color: "#F5A623", bg: "rgba(245,166,35,0.12)", icon: <AlertTriangle className="w-4 h-4" /> };
  }
}

// ---------------------------------------------------------------------------
// Plate Number overlay canvas drawing
// ---------------------------------------------------------------------------
function PlateOverlay({ plate, confidence, decision }: {
  plate: string;
  confidence: number;
  decision: string;
}) {
  const { color, bg, icon } = decisionStyle(decision);
  const cColor = confColor(confidence);

  return (
    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none p-3 z-20">
      {/* Top status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-white/10">
          <ScanLine className="w-3 h-3 text-[#E5521A]" />
          <span className="text-[10px] font-bold text-white tracking-wider">LPR ACTIVE</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#E5521A] animate-pulse" />
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg backdrop-blur-sm border text-[10px] font-bold"
          style={{ background: bg, borderColor: `${color}40`, color }}
        >
          {icon}
          {decision.toUpperCase()}
        </div>
      </div>

      {/* Bottom plate result */}
      <div className="flex flex-col gap-2">
        {/* Plate number box */}
        <div className="self-center bg-black/80 backdrop-blur-sm border-2 rounded-xl px-4 py-2.5 flex flex-col items-center gap-1"
          style={{ borderColor: color }}>
          <div className="text-[8px] font-bold text-white/50 tracking-[0.3em] uppercase">Plate Detected</div>
          <div className="text-[22px] font-black tracking-[0.25em] text-white font-mono">{plate}</div>
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${confidence * 100}%`, background: cColor }} />
            </div>
            <span className="text-[9px] font-bold" style={{ color: cColor }}>
              {(confidence * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Scan line animation */}
        <div className="relative h-[2px] overflow-hidden rounded-full mx-2">
          <div
            className="absolute inset-y-0 w-1/3 rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
              animation: "lpr-scan 2.5s linear infinite",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scanning animation (no plate found yet)
// ---------------------------------------------------------------------------
function ScanningOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
      {/* Corner brackets */}
      {[
        "top-6 left-6 border-t-2 border-l-2",
        "top-6 right-6 border-t-2 border-r-2",
        "bottom-6 left-6 border-b-2 border-l-2",
        "bottom-6 right-6 border-b-2 border-r-2",
      ].map((cls, i) => (
        <div key={i} className={`absolute w-5 h-5 border-[#E5521A] ${cls}`} />
      ))}

      {/* Scan beam */}
      <div className="relative w-2/3 h-[2px] overflow-hidden rounded-full">
        <div
          className="absolute inset-y-0 w-1/3 rounded-full"
          style={{
            background: "linear-gradient(90deg, transparent, #E5521A, transparent)",
            animation: "lpr-scan 2.5s linear infinite",
          }}
        />
      </div>

      {/* Label */}
      <div className="mt-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[#E5521A]/30">
        <span className="text-[10px] font-bold text-[#E5521A] tracking-widest">SCANNING...</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main LPR Camera Panel
// ---------------------------------------------------------------------------
export default function LPRCameraPanel() {
  const [gates, setGates] = useState<GateResponse[]>([]);
  const [selectedGate, setSelectedGate] = useState<GateResponse | null>(null);
  const [camera, setCamera] = useState<{ id: string; name: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<LprScanImageResult | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [direction, setDirection] = useState<"entry" | "exit">("entry");

  const imgRef = useRef<HTMLImageElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Load gates + cameras on mount ----
  useEffect(() => {
    (async () => {
      try {
        const [gateList, snapshot] = await Promise.all([
          getGates(),
          getDepotCommandSnapshot().catch(() => null),
        ]);
        setGates(gateList);

        const firstGateWithCam = gateList.find((g) => g.camera_id);
        if (firstGateWithCam) {
          setSelectedGate(firstGateWithCam);
          const camId = firstGateWithCam.camera_id!;
          // Try to find camera name from snapshot
          const camRecord = snapshot?.cameras?.data?.find((c: { id: string; name: string }) => c.id === camId);
          setCamera({ id: camId, name: camRecord?.name ?? "Gate Entry Camera" });
        } else if (gateList.length > 0) {
          setSelectedGate(gateList[0]);
          // Fall back to first active camera from snapshot
          const activeCam = snapshot?.cameras?.data?.find((c: { status: string }) => c.status === "active");
          if (activeCam) setCamera({ id: activeCam.id, name: activeCam.name });
        }
      } catch {
        setError("Could not load gate configuration");
      }
    })();
  }, []);

  // ---- Auto-scan logic ----
  const doScan = useCallback(async () => {
    if (!camera) return;
    if (scanning) return;
    setScanning(true);
    setError(null);

    try {
      // Fetch the snapshot as a blob
      const snapshotUrl = getCameraSnapshotUrl(camera.id);
      const response = await fetch(snapshotUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("Snapshot unavailable");
      const blob = await response.blob();

      const result = await processLprImageScan(blob, selectedGate?.id, direction);
      setLastResult(result);
      setLastScanTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setScanCount((c) => c + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      // Don't surface network errors during normal polling, only show real failures
      if (msg !== "Snapshot unavailable" && msg !== "Failed to fetch") {
        setError(msg);
      }
    } finally {
      setScanning(false);
    }
  }, [camera, scanning, selectedGate, direction]);

  // ---- Interval auto-scan ----
  useEffect(() => {
    if (!camera) return;
    // Initial scan after 2s
    const initial = setTimeout(() => void doScan(), 2000);
    // Periodic scan
    intervalRef.current = setInterval(() => void doScan(), SCAN_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [camera, doScan]);

  const mjpegUrl = camera ? getCameraMjpegUrl(camera.id, "dark", 120) : null;
  const snapshotUrl = camera ? getCameraSnapshotUrl(camera.id) : null;

  const hasResult = lastResult && lastResult.plate_number;
  const { color: decColor } = hasResult ? decisionStyle(lastResult.decision) : { color: "#8A9BBF" };

  return (
    <div className="rounded-[16px] border border-[#1E2F50] bg-[#14203A] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E2F50]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#E5521A]/15 border border-[#E5521A]/30 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#E5521A]" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-[#E8EDF8]">LPR Gate Camera</div>
            <div className="text-[9px] text-[#4E6090] font-semibold tracking-wider">
              {camera?.name ?? "No camera assigned"} · Auto-OCR {SCAN_INTERVAL_MS / 1000}s
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Direction toggle */}
          <div className="flex rounded-lg overflow-hidden border border-[#1E2F50]">
            {(["entry", "exit"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors"
                style={{
                  background: direction === d ? "#E5521A" : "transparent",
                  color: direction === d ? "white" : "#4E6090",
                }}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Gate selector */}
          {gates.length > 1 && (
            <select
              className="bg-[#0F1A30] border border-[#1E2F50] rounded-lg px-2 py-1 text-[10px] text-[#8A9BBF] focus:outline-none"
              value={selectedGate?.id ?? ""}
              onChange={(e) => {
                const g = gates.find((g) => g.id === e.target.value);
                if (g) setSelectedGate(g);
              }}
            >
              {gates.map((g) => (
                <option key={g.id} value={g.id}>{g.gate_code} — {g.name}</option>
              ))}
            </select>
          )}

          {/* Scan count */}
          <span className="text-[9px] font-mono text-[#4E6090]">{scanCount} scans</span>
        </div>
      </div>

      {/* Video Feed */}
      <div className="relative aspect-video bg-[#0A1628] overflow-hidden">
        {/* Camera feed */}
        {mjpegUrl ? (
          <img
            ref={imgRef}
            src={mjpegUrl}
            alt="LPR gate camera"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              const t = e.target as HTMLImageElement;
              if (snapshotUrl && t.src !== snapshotUrl) t.src = snapshotUrl;
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#4E6090]">
            <Camera className="w-8 h-8 opacity-30" />
            <span className="text-[11px]">No camera assigned to gate</span>
          </div>
        )}

        {/* Dark vignette overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(10,14,26,0.6) 100%)" }}
        />

        {/* LPR overlays */}
        {mjpegUrl && (
          hasResult
            ? <PlateOverlay
                plate={lastResult!.plate_number}
                confidence={lastResult!.confidence}
                decision={lastResult!.decision}
              />
            : <ScanningOverlay />
        )}

        {/* Live badge */}
        {mjpegUrl && (
          <div className="absolute top-3 left-3 z-30 flex items-center gap-1 bg-black/60 px-2 py-1 rounded backdrop-blur-sm">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span className="text-[9px] font-bold text-emerald-400">LIVE</span>
          </div>
        )}

        {/* Scanning spinner */}
        {scanning && (
          <div className="absolute top-3 right-3 z-30 w-6 h-6 rounded-full border-2 border-[#E5521A] border-t-transparent animate-spin" />
        )}
      </div>

      {/* Result strip */}
      <div
        className="px-4 py-3 border-t border-[#1E2F50] flex items-center justify-between gap-3"
        style={{ background: hasResult ? `${decColor}06` : "transparent" }}
      >
        {hasResult ? (
          <>
            <div className="flex items-center gap-2.5">
              <div
                className="text-[20px] font-black font-mono tracking-[0.2em]"
                style={{ color: decColor }}
              >
                {lastResult!.plate_number}
              </div>
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                style={{ color: decColor, borderColor: `${decColor}40`, background: `${decColor}15` }}
              >
                {lastResult!.decision.toUpperCase()}
              </span>
            </div>
            <div className="flex flex-col items-end text-right">
              <span className="text-[10px] font-bold" style={{ color: confColor(lastResult!.confidence) }}>
                {(lastResult!.confidence * 100).toFixed(1)}% conf.
              </span>
              <span className="text-[9px] text-[#4E6090]">{lastScanTime}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-[#4E6090]">
            <ScanLine className="w-3.5 h-3.5 text-[#E5521A] animate-pulse" />
            <span className="text-[11px]">
              {error ? <span className="text-[#F04A4A]">{error}</span> : "Awaiting plate detection..."}
            </span>
          </div>
        )}

        {/* Manual scan button */}
        <button
          type="button"
          onClick={() => void doScan()}
          disabled={scanning || !camera}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-colors disabled:opacity-40"
          style={{
            border: "1px solid rgba(229,82,26,0.3)",
            background: "rgba(229,82,26,0.08)",
            color: "#E5521A",
          }}
        >
          <Camera className="w-3 h-3" />
          {scanning ? "Scanning..." : "Scan Now"}
        </button>
      </div>

      {/* Raw OCR candidates (debug strip — collapsed) */}
      {hasResult && lastResult!.raw_candidates?.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          <span className="text-[8px] text-[#4E6090] font-bold tracking-wider">OCR candidates:</span>
          {lastResult!.raw_candidates.slice(0, 5).map((c, i) => (
            <span key={i} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#0F1A30] text-[#8A9BBF] border border-[#1E2F50]">
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Scan animation keyframe */}
      <style jsx>{`
        @keyframes lpr-scan {
          0%   { left: -33%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
