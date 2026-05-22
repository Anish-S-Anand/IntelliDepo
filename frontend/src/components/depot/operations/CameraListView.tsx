"use client";

import { useState, useEffect } from "react";
import { Camera, AlertTriangle } from "lucide-react";
import { getCamerasWithDetections, type CameraWithDetections } from "@/services/depotVision";

interface CameraListViewProps {
  onCameraSelect: (cameraId: string, cameraName: string) => void;
}

export default function CameraListView({ onCameraSelect }: CameraListViewProps) {
  const [cameras, setCameras] = useState<CameraWithDetections[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCameras() {
      try {
        setLoading(true);
        setError(null);
        const data = await getCamerasWithDetections();
        setCameras(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cameras");
      } finally {
        setLoading(false);
      }
    }

    fetchCameras();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 animate-pulse"
          >
            <div className="h-4 bg-[#1E2F50] rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-[#1E2F50] rounded w-1/2 mb-3"></div>
            <div className="h-8 bg-[#1E2F50] rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-[#F04A4A] mb-3" />
        <div className="text-[#F04A4A] text-[14px] font-bold mb-2">Failed to Load Cameras</div>
        <div className="text-[#8A9BBF] text-[12px]">{error}</div>
      </div>
    );
  }

  // Empty state
  if (cameras.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <Camera className="w-10 h-10 text-[#4E6090] mb-3 opacity-50" />
        <div className="text-[#8A9BBF] text-[14px]">No cameras with detection data available</div>
      </div>
    );
  }

  // Camera grid
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {cameras.map((camera) => (
        <button
          key={camera.id}
          onClick={() => onCameraSelect(camera.id, camera.name)}
          className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 text-left transition-all hover:border-[#2A3F68] hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)] focus:outline-none focus:border-[var(--accent)]"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="text-[14px] font-bold text-[#E8EDF8] mb-1">
                {camera.name}
              </div>
              <div className="text-[10px] text-[#4E6090]">
                ID: {camera.cameraId}
              </div>
            </div>
            <Camera className="w-4 h-4 text-[#5B9BF5]" />
          </div>

          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1">
              <div className="text-[10px] text-[#8A9BBF] mb-0.5">Detections</div>
              <div className="text-[20px] font-bold text-[#5B9BF5]">
                {camera.detectionCount}
              </div>
            </div>
            {camera.lastDetectionAt && (
              <div className="text-[9px] text-[#4E6090]">
                Last: {new Date(camera.lastDetectionAt).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
