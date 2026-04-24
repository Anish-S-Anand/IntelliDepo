"use client";

import { useEffect, useRef, useState } from "react";
import { useDetection } from "@/hooks/useDetection";

interface VideoFeedProps {
  name: string;
  cameraId: string;
  cameraIndex: number;
  onDetectionUpdate?: (vehicles: Array<{ bbox: [number, number, number, number]; class: string; score: number }>) => void;
}

function getBackendBase(): string {
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

export function VideoFeed({ name, cameraId, cameraIndex, onDetectionUpdate }: VideoFeedProps) {
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");

  useDetection(sourceCanvasRef, overlayCanvasRef, cameraIndex, status === "live", onDetectionUpdate);

  const snapshotUrl = `${getBackendBase()}/depot/vision/cameras/${cameraId}/snapshot`;

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
      img.src = snapshotUrl + "?t=" + Date.now();
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
  }, [snapshotUrl]);

  const statusColor =
    status === "live" ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-gray-500";
  const statusText =
    status === "live" ? "LIVE" : status === "error" ? "OFFLINE" : "CONNECTING";

  return (
    <div className="relative h-[180px] overflow-hidden rounded-md bg-black">
      <canvas
        ref={sourceCanvasRef}
        style={{
          width: "100%",
          height: "100%",
        }}
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
        <span className="text-[10px] font-semibold text-white/90 drop-shadow">{name}</span>
        <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold text-white ${statusColor}`}>
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          {statusText}
        </span>
      </div>
    </div>
  );
}
