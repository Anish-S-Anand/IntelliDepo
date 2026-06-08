"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Camera, AlertTriangle } from "lucide-react";
import CameraListView from "./CameraListView";
import CameraDetailView from "./CameraDetailView";

interface AnalysisSectionProps {
  // No props - reads state from URL and manages internal state
}

type ViewMode = "list" | "detail";

export default function AnalysisSection({}: AnalysisSectionProps) {
  return (
    <Suspense fallback={<AnalysisSectionSkeleton />}>
      <AnalysisSectionContent />
    </Suspense>
  );
}

function AnalysisSectionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [selectedCameraName, setSelectedCameraName] = useState<string>("");
  const [view, setView] = useState<ViewMode>("list");
  const [error, setError] = useState<Error | null>(null);

  // Read camera from URL on mount
  useEffect(() => {
    const cameraParam = searchParams.get("camera");
    if (cameraParam) {
      setSelectedCameraId(cameraParam);
      setView("detail");
    }
  }, [searchParams]);

  const handleCameraSelect = useCallback((cameraId: string, cameraName?: string) => {
    setSelectedCameraId(cameraId);
    setSelectedCameraName(cameraName || cameraId);
    setView("detail");
    setError(null);
    
    // Update URL with camera parameter
    const params = new URLSearchParams(searchParams.toString());
    params.set("camera", cameraId);
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handleBackToList = useCallback(() => {
    setSelectedCameraId(null);
    setSelectedCameraName("");
    setView("list");
    setError(null);
    
    // Remove camera parameter from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete("camera");
    router.push(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handleRetry = useCallback(() => {
    setError(null);
    // Retry logic will be implemented when we add data fetching
  }, []);

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-[#F04A4A] mb-4" />
        <h3 className="text-[16px] font-bold text-[#E8EDF8] mb-2">
          Something went wrong
        </h3>
        <p className="text-[12px] text-[#8A9BBF] mb-4">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={handleRetry}
          className="px-4 py-2 rounded-lg theme-bg-accent text-white text-[11px] font-bold hover:bg-[var(--accent-hover)] transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  // List view - show camera list
  if (view === "list") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Camera className="w-4 h-4 text-[#5B9BF5]" />
          <span className="text-[13px] font-bold text-[#E8EDF8]">Camera Detection Analysis</span>
          <span className="text-[10px] text-[#8A9BBF]">— Select a camera to review detections</span>
        </div>
        <CameraListView onCameraSelect={(id, name) => handleCameraSelect(id, name)} />
      </div>
    );
  }

  // Detail view - show detection list and video player
  if (!selectedCameraId) {
    return (
      <div className="text-center py-16">
        <Camera className="w-10 h-10 text-[#5B9BF5] mx-auto mb-3 opacity-50" />
        <div className="text-[#5B9BF5] text-[14px] font-bold">No Camera Selected</div>
        <div className="text-[#4E6090] text-[12px] mt-1">
          Please select a camera from the list
        </div>
      </div>
    );
  }

  return (
    <CameraDetailView
      cameraId={selectedCameraId}
      cameraName={selectedCameraName || selectedCameraId}
      onBack={handleBackToList}
    />
  );
}

function AnalysisSectionSkeleton() {
  return (
    <div className="p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="route-skeleton-bar h-4 w-4 rounded" />
        <div className="route-skeleton-bar h-4 w-48 rounded" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="route-skeleton-bar h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}