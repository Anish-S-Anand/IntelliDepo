"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDetection } from "@/hooks/useDetection";

interface VideoFeedProps {
  name: string;
  cameraId: string;
  videoFile?: string;
  cameraIndex: number;
  onDetectionUpdate?: (vehicles: Array<{ bbox: [number, number, number, number]; class: string; score: number }>) => void;
  onPlateDetected?: (plate: string) => void;
}

function getBackendBase(): string {
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

/**
 * Simulates LPR detection by generating a plausible license plate string.
 * In production this would call a real LPR API or Tesseract.js OCR on the vehicle ROI.
 */
function simulateLPR(): string {
  const states = ["MH", "DL", "KA", "TN", "GJ", "RJ", "UP", "WB"];
  const state = states[Math.floor(Math.random() * states.length)];
  const num1 = String(Math.floor(Math.random() * 99) + 1).padStart(2, "0");
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const letter1 = letters[Math.floor(Math.random() * letters.length)];
  const letter2 = letters[Math.floor(Math.random() * letters.length)];
  const num2 = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `${state} ${num1} ${letter1}${letter2} ${num2}`;
}

export function VideoFeed({ name, cameraId, videoFile, cameraIndex, onDetectionUpdate, onPlateDetected }: VideoFeedProps) {
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lprTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");

  useDetection(sourceCanvasRef, overlayCanvasRef, cameraIndex, status === "live", onDetectionUpdate);

  // Each camera seeks to a different position in its video so feeds look distinct.
  // Index 0 = start, 1 = 30s in, 2 = 60s in, etc.
  const seekSeconds = cameraIndex * 30;

  const snapshotUrl = videoFile
    ? `/backend/depot/vision/cameras/video-library/${encodeURIComponent(videoFile)}/snapshot?seek=${seekSeconds}`
    : `${getBackendBase()}/depot/vision/cameras/${cameraId}/snapshot?seek=${seekSeconds}`;
  const streamUrl = videoFile
    ? `/backend/depot/vision/cameras/video-library/${encodeURIComponent(videoFile)}/mjpeg?theme=dark&seek=${seekSeconds}`
    : null;
  const withCacheBuster = useCallback((url: string) => {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}t=${Date.now()}`;
  }, []);

  // LPR simulation: periodically "detect" a plate when camera is live
  const triggerLPR = useCallback(() => {
    if (onPlateDetected && status === "live") {
      // Only trigger occasionally (simulate real detection rate)
      if (Math.random() < 0.15) {
        onPlateDetected(simulateLPR());
      }
    }
  }, [onPlateDetected, status]);

  useEffect(() => {
    lprTimerRef.current = setInterval(triggerLPR, 5000);
    return () => {
      if (lprTimerRef.current) clearInterval(lprTimerRef.current);
    };
  }, [triggerLPR]);

  useEffect(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    let consecutiveErrors = 0;
    const img = new window.Image();
    img.crossOrigin = "anonymous";

    const initSize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    initSize();

    const loadFrame = () => {
      if (cancelled) return;
      img.src = withCacheBuster(snapshotUrl);
    };

    img.onload = () => {
      if (cancelled) return;
      consecutiveErrors = 0;
      initSize();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setStatus("live");
      if (!cancelled) {
        pollRef.current = setTimeout(loadFrame, 1000);
      }
    };

    img.onerror = () => {
      if (cancelled) return;
      consecutiveErrors++;
      setStatus("error");
      const delay = Math.min(1000 * Math.pow(2, consecutiveErrors), 10000);
      if (!cancelled) {
        pollRef.current = setTimeout(loadFrame, delay);
      }
    };

    loadFrame();

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
      img.src = "";
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [snapshotUrl, withCacheBuster]);

  const statusColor =
    status === "live" ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-gray-500";
  const statusText =
    status === "live" ? "LIVE" : status === "error" ? "OFFLINE" : "CONNECTING";

  return (
    <div className="relative h-[180px] overflow-hidden rounded-md bg-black">
      {streamUrl && (
        <img
          src={streamUrl}
          alt={`${name} live feed`}
          className="absolute inset-0 h-full w-full object-cover"
          onLoad={() => setStatus("live")}
          onError={() => setStatus("error")}
        />
      )}
      <canvas
        ref={sourceCanvasRef}
        style={{ width: "100%", height: "100%", opacity: streamUrl ? 0 : 1 }}
      />
      <canvas
        ref={overlayCanvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
      {/* Camera label */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4">
        <span className="text-[10px] font-bold text-white/90 drop-shadow">{name}</span>
        <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold text-white ${statusColor}`}>
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          {statusText}
        </span>
      </div>
    </div>
  );
}
