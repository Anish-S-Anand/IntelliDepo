"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import DetectionList from "./DetectionList";
import VideoPlayer from "./VideoPlayer";
import { getCamerasWithDetections } from "@/services/depotVision";

interface CameraDetailViewProps {
  cameraId: string;
  cameraName: string;
  onBack: () => void;
}

export default function CameraDetailView({
  cameraId,
  cameraName,
  onBack,
}: CameraDetailViewProps) {
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<string>("LPR_RECOGNITION.mp4");

  // Fetch the camera's video file
  useEffect(() => {
    async function fetchCameraVideo() {
      try {
        const cameras = await getCamerasWithDetections();
        const camera = cameras.find(c => c.id === cameraId);
        if (camera?.videoFile) {
          setVideoFile(camera.videoFile);
        }
      } catch (error) {
        console.error("Error fetching camera video:", error);
      }
    }
    fetchCameraVideo();
  }, [cameraId]);

  return (
    <div className="space-y-3">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-bold hover:theme-text-nav-active hover:border-[var(--accent-border)] transition focus:outline-none focus:border-[var(--accent)]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <div>
          <h2 className="text-[16px] font-bold text-[#E8EDF8]">{cameraName}</h2>
          <p className="text-[10px] text-[#4E6090]">Camera ID: {cameraId}</p>
        </div>
      </div>

      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Detection list */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4">
          <h3 className="text-[13px] font-bold text-[#E8EDF8] mb-3">
            LPR Detections
          </h3>
          <DetectionList
            cameraId={cameraId}
            onDetectionSelect={setSelectedDetectionId}
            selectedDetectionId={selectedDetectionId}
          />
        </div>

        {/* Video player */}
        <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4">
          <h3 className="text-[13px] font-bold text-[#E8EDF8] mb-3">
            Detection Video
          </h3>
          <VideoPlayer
            videoFile={videoFile}
            detectionId={selectedDetectionId || ""}
          />
        </div>
      </div>
    </div>
  );
}
