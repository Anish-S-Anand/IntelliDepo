"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Hls from "hls.js";
import { useDetection } from "@/hooks/useDetection";

interface TflCamera {
  id: string;
  commonName: string;
  jpegUrl: string;
}

interface VideoFeedProps {
  name: string;
  streamUrl: string;
  cameraIndex: number;
  onDetectionUpdate?: (vehicles: Array<{ bbox: [number, number, number, number]; class: string; score: number }>) => void;
}

// Fetch TfL JamCam list once and cache it
let tflCamerasCache: TflCamera[] | null = null;
async function getTflCameras(): Promise<TflCamera[]> {
  if (tflCamerasCache) return tflCamerasCache;
  const res = await fetch("https://api.tfl.gov.uk/Place/Type/JamCam");
  const data = await res.json();
  const cameras: TflCamera[] = [];
  for (const place of data) {
    const availProp = place.additionalProperties?.find(
      (p: { key: string; value: string }) => p.key === "available",
    );
    const jpegProp = place.additionalProperties?.find(
      (p: { key: string; value: string }) => p.key === "imageUrl",
    );
    if (availProp?.value === "true" && jpegProp?.value) {
      cameras.push({
        id: place.id,
        commonName: place.commonName || place.id,
        jpegUrl: jpegProp.value,
      });
    }
    if (cameras.length >= 6) break;
  }
  tflCamerasCache = cameras;
  return cameras;
}

export function VideoFeed({ name, streamUrl, cameraIndex, onDetectionUpdate }: VideoFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mode, setMode] = useState<"hls" | "fallback">("hls");
  const [status, setStatus] = useState<"connecting" | "live" | "fallback">("connecting");

  // Detection runs on whichever source is active
  const sourceRef = mode === "hls" ? videoRef : canvasRef;
  useDetection(sourceRef, canvasRef, cameraIndex, status !== "connecting", onDetectionUpdate);

  const startFallback = useCallback(async () => {
    setMode("fallback");
    setStatus("fallback");

    // Hide video, show canvas
    if (videoRef.current) videoRef.current.style.display = "none";
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.position = "relative";
    canvas.style.pointerEvents = "none";

    try {
      const cameras = await getTflCameras();
      const cam = cameras[cameraIndex % cameras.length];
      if (!cam) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      pollRef.current = setInterval(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = cam.jpegUrl + "?t=" + Date.now();
        img.onload = () => {
          canvas.width = canvas.offsetWidth;
          canvas.height = canvas.offsetHeight;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
      }, 800);
    } catch {
      // TfL API unavailable
    }
  }, [cameraIndex]);

  // HLS setup
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || mode !== "hls") return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 1 });
      hls.loadSource(streamUrl);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus("live");
        videoEl.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          hls?.destroy();
          startFallback();
        }
      });

      // Timeout: if no manifest in 8 seconds, fall back
      const timeout = setTimeout(() => {
        if (status === "connecting") {
          hls?.destroy();
          startFallback();
        }
      }, 8000);

      return () => {
        clearTimeout(timeout);
        hls?.destroy();
      };
    } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS (Safari)
      videoEl.src = streamUrl;
      videoEl.addEventListener("loadedmetadata", () => {
        setStatus("live");
        videoEl.play().catch(() => {});
      });
      videoEl.addEventListener("error", () => startFallback());
    } else {
      startFallback();
    }
  }, [streamUrl, mode, startFallback]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const statusColor =
    status === "live" ? "bg-green-500" : status === "fallback" ? "bg-amber-500" : "bg-gray-500";
  const statusText =
    status === "live" ? "LIVE" : status === "fallback" ? "TfL CAM" : "CONNECTING";

  return (
    <div className="relative h-[180px] overflow-hidden rounded-md bg-black">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: mode === "fallback" ? "none" : "block",
        }}
      />
      <canvas
        ref={canvasRef}
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
