"use client";

import { useEffect, useRef, useState } from "react";
import { useDetection } from "@/hooks/useDetection";

interface VideoFeedProps {
  name: string;
  cameraId: string;
  videoFile?: string;
  cameraIndex: number;
  offline?: boolean; // NEW: Mark camera as offline
  onDetectionUpdate?: (vehicles: Array<{ bbox: [number, number, number, number]; class: string; score: number }>) => void;
}

export function VideoFeed({ name, cameraId, videoFile, cameraIndex, offline = false, onDetectionUpdate }: VideoFeedProps) {
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");

  // If offline, set status immediately and skip all video/detection logic
  useEffect(() => {
    if (offline) {
      setStatus("error");
    }
  }, [offline]);

  useDetection(sourceCanvasRef, overlayCanvasRef, cameraIndex, status === "live" && !offline, onDetectionUpdate);

  useEffect(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;

    // Skip video loading if offline
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

    // Use HTML5 video element with Next.js proxy for better compatibility
    // Use the /backend proxy to avoid CORS issues
    const videoSrc = videoFile 
      ? `/backend/depot/vision/cameras/video-library/${encodeURIComponent(videoFile)}/stream`
      : null;

    if (videoSrc) {
      // Create a video element
      video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      
      // Set up error handling
      video.onerror = (e) => {
        console.error(`Video stream error for ${name}:`, e, videoSrc);
        if (cancelled) return;
        setStatus("error");
      };

      // Set up loaded handler
      video.onloadeddata = () => {
        if (cancelled) return;
        console.log(`Video loaded successfully for ${name}`);
        setStatus("live");
        video?.play().catch(err => {
          console.error(`Play error for ${name}:`, err);
          setStatus("error");
        });
      };

      // Additional event listeners for debugging
      video.onloadstart = () => {
        console.log(`Video load started for ${name}`);
      };

      video.oncanplay = () => {
        if (cancelled) return;
        console.log(`Video can play for ${name}`);
        setStatus("live");
      };

      // Set the video source
      console.log(`Setting video source for ${name}:`, videoSrc);
      video.src = videoSrc;
      video.load();

      // Draw video frames to canvas
      const drawLoop = () => {
        if (cancelled || !video) return;
        
        const ctx = canvas.getContext("2d", { alpha: false });
        if (ctx && video.readyState >= video.HAVE_CURRENT_DATA) {
          initSize();
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          } catch {
            // Ignore drawing errors
          }
        }
        
        animationFrameRef.current = requestAnimationFrame(drawLoop);
      };

      // Start drawing loop
      drawLoop();
    } else {
      console.warn(`No video file specified for ${name}`);
      setStatus("error");
    }

    return () => {
      cancelled = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (video) {
        video.pause();
        video.src = "";
        video = null;
      }
    };
  }, [videoFile, cameraId, offline, name]);

  const statusColor =
    status === "live" ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-gray-500";
  const statusText =
    status === "live" ? "LIVE" : status === "error" ? "OFFLINE" : "CONNECTING";

  return (
    <div className="relative h-[280px] overflow-hidden rounded-md bg-black">
      <canvas
        ref={sourceCanvasRef}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
