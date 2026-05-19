"use client";

import { useEffect, useRef, useState } from "react";
import { useDetection } from "@/hooks/useDetection";
import { useTheme } from "@/components/layout/ThemeProvider";

interface VideoFeedProps {
  name: string;
  cameraId: string;
  videoFile?: string;
  cameraIndex: number;
  offline?: boolean;
  onDetectionUpdate?: (vehicles: Array<{ bbox: [number, number, number, number]; class: string; score: number }>) => void;
}

export function VideoFeed({ name, cameraId, videoFile, cameraIndex, offline = false, onDetectionUpdate }: VideoFeedProps) {
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    if (offline) setStatus("error");
  }, [offline]);

  useDetection(sourceCanvasRef, overlayCanvasRef, cameraIndex, status === "live" && !offline, onDetectionUpdate);

  useEffect(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;

    if (offline) {
      const ctx = canvas.getContext("2d", { alpha: false });
      if (ctx) {
        ctx.fillStyle = "#1E2F50";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#4E6090";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("OFFLINE", canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    let cancelled = false;
    let video: HTMLVideoElement | null = null;

    const initSize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    initSize();

    const videoSrc = videoFile
      ? `/backend/depot/vision/cameras/video-library/${encodeURIComponent(videoFile)}/stream`
      : null;

    if (videoSrc) {
      video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;

      video.onerror = () => { if (!cancelled) setStatus("error"); };
      video.onloadeddata = () => {
        if (cancelled) return;
        setStatus("live");
        video?.play().catch(() => setStatus("error"));
      };
      video.oncanplay = () => { if (!cancelled) setStatus("live"); };

      video.src = videoSrc;
      video.load();

      const drawLoop = () => {
        if (cancelled || !video) return;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (ctx && video.readyState >= video.HAVE_CURRENT_DATA) {
          initSize();
          try { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); } catch { /* ignore */ }
        }
        animationFrameRef.current = requestAnimationFrame(drawLoop);
      };
      drawLoop();
    } else {
      setStatus("error");
    }

    return () => {
      cancelled = true;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (video) { video.pause(); video.src = ""; video = null; }
    };
  }, [videoFile, cameraId, offline, name]);

  const statusColor = status === "live" ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-gray-500";
  const statusText = status === "live" ? "LIVE" : status === "error" ? "OFFLINE" : "CONNECTING";

  return (
    <div className="relative h-[280px] overflow-hidden rounded-md bg-black">
      {/* Video canvas */}
      <canvas ref={sourceCanvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1 }} />
      {/* Detection overlay */}
      <canvas ref={overlayCanvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 2 }} />
      {/* Label bar — always on top */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px" }}>
        <span className="camera-label-text" style={{ fontSize: 15, fontWeight: 800, background: isDark ? "#000000" : "#ffffff", padding: "6px 12px", borderRadius: 8, letterSpacing: "0.02em", whiteSpace: "nowrap", border: "none", color: isDark ? "#ffffff" : "#000000" }}>
          {name}
        </span>
        <span className="camera-label-text" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: status === "live" ? "#22c55e" : status === "error" ? "#ef4444" : "#6b7280" }}>
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "white" }} />
          {statusText}
        </span>
      </div>
    </div>
  );
}
