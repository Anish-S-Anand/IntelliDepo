"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useDetection } from "@/hooks/useDetection";
import api from "@/services/api";

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
  const lprTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");

  useDetection(sourceCanvasRef, overlayCanvasRef, cameraIndex, status === "live", onDetectionUpdate);

  // All cameras start from the beginning of their respective videos
  // This ensures consistent playback and avoids seek issues
  const seekSeconds = 0;

  const snapshotUrl = videoFile
    ? `/depot/vision/cameras/video-library/${encodeURIComponent(videoFile)}/snapshot?seek=${seekSeconds}`
    : `/depot/vision/cameras/${cameraId}/snapshot?seek=${seekSeconds}`;
  
  // For MJPEG streams, we'll use the snapshot polling approach since <img> tags can't have custom headers
  const streamUrl = null; // Disable MJPEG for now, use snapshot polling instead
  
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

    const initSize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    initSize();

    const loadFrame = async () => {
      if (cancelled) return;
      
      try {
        // For video-library endpoints, use direct fetch (no auth required)
        // For camera endpoints, use api service with auth
        const isVideoLibrary = snapshotUrl.includes('/video-library/');
        
        let blob: Blob;
        if (isVideoLibrary) {
          // Direct fetch for video-library (public endpoints)
          const backendBase = getBackendBase();
          const fullUrl = `${backendBase}${snapshotUrl}&t=${Date.now()}`;
          const response = await fetch(fullUrl);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          blob = await response.blob();
        } else {
          // Use axios with auth for regular camera endpoints
          const response = await api.get(snapshotUrl, {
            responseType: 'blob',
            params: { t: Date.now() },
            validateStatus: (status) => status < 500
          });
          
          if (response.status >= 400) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          blob = response.data;
        }
        
        const imageUrl = URL.createObjectURL(blob);
        
        const img = new window.Image();
        img.onload = () => {
          if (cancelled) {
            URL.revokeObjectURL(imageUrl);
            return;
          }
          consecutiveErrors = 0;
          initSize();
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setStatus("live");
          URL.revokeObjectURL(imageUrl);
          
          if (!cancelled) {
            setTimeout(loadFrame, 1000);
          }
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(imageUrl);
          if (cancelled) return;
          consecutiveErrors++;
          setStatus("error");
          const delay = Math.min(1000 * Math.pow(2, consecutiveErrors), 10000);
          if (!cancelled) {
            setTimeout(loadFrame, delay);
          }
        };
        
        img.src = imageUrl;
      } catch (error) {
        console.error('VideoFeed error:', error);
        if (cancelled) return;
        consecutiveErrors++;
        setStatus("error");
        const delay = Math.min(1000 * Math.pow(2, consecutiveErrors), 10000);
        if (!cancelled) {
          setTimeout(loadFrame, delay);
        }
      }
    };

    loadFrame();

    return () => {
      cancelled = true;
    };
  }, [snapshotUrl]);

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
