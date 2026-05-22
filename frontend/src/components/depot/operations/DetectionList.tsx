"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, XCircle, Clock, Shield } from "lucide-react";
import { getDetectionsForCamera, type LPRDetection } from "@/services/depotVision";

interface DetectionListProps {
  cameraId: string;
  onDetectionSelect: (detectionId: string) => void;
  selectedDetectionId: string | null;
}

const DECISION_COLORS = {
  granted: "#22D3A1",
  denied: "#F04A4A",
  pending: "#F5A623",
  blacklisted: "#8B0000",
};

const DECISION_ICONS = {
  granted: CheckCircle,
  denied: XCircle,
  pending: Clock,
  blacklisted: Shield,
};

export default function DetectionList({
  cameraId,
  onDetectionSelect,
  selectedDetectionId,
}: DetectionListProps) {
  const [detections, setDetections] = useState<LPRDetection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetections() {
      try {
        setLoading(true);
        setError(null);
        const data = await getDetectionsForCamera(cameraId);
        setDetections(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load detections");
      } finally {
        setLoading(false);
      }
    }

    fetchDetections();
  }, [cameraId]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-3 animate-pulse"
          >
            <div className="h-4 bg-[#1E2F50] rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-[#1E2F50] rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-[#F04A4A] mb-2" />
        <div className="text-[#F04A4A] text-[12px] font-bold mb-1">Failed to Load Detections</div>
        <div className="text-[#8A9BBF] text-[10px]">{error}</div>
      </div>
    );
  }

  // Empty state
  if (detections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Shield className="w-8 h-8 text-[#4E6090] mb-2 opacity-50" />
        <div className="text-[#8A9BBF] text-[12px]">No detections found for this camera</div>
      </div>
    );
  }

  // Detection list
  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto">
      {detections.map((detection) => {
        const color = DECISION_COLORS[detection.decision];
        const Icon = DECISION_ICONS[detection.decision];
        const isSelected = detection.id === selectedDetectionId;

        return (
          <button
            key={detection.id}
            onClick={() => onDetectionSelect(detection.id)}
            className={`w-full bg-[#14203A] border rounded-[14px] p-3 text-left transition-all hover:border-[#2A3F68] hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)] focus:outline-none ${
              isSelected
                ? "border-[var(--accent)] shadow-[0_4px_20px_rgba(229,82,26,0.3)]"
                : "border-[#1E2F50]"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="text-[14px] font-bold text-[#E8EDF8] mb-1">
                  {detection.plateNumber}
                </div>
                <div className="text-[10px] text-[#4E6090]">
                  {new Date(detection.timestamp).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                style={{
                  background: `${color}22`,
                  color: color,
                  borderColor: `${color}44`,
                }}
              >
                {detection.decision.toUpperCase()}
              </span>
              <span className="text-[9px] text-[#8A9BBF]">
                {Math.round(detection.confidence * 100)}% confidence
              </span>
              {detection.deniedReason && (
                <span className="text-[9px] text-[#F04A4A]">
                  {detection.deniedReason}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
