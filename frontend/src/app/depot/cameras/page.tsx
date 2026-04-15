"use client";

import dynamic from "next/dynamic";

const CameraGrid = dynamic(
  () => import("@/components/depot/cameras/CameraGrid"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-[#0a0f1a]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3fb950] border-t-transparent" />
          <span className="text-xs text-[#4E6090]">Loading Camera Feeds...</span>
        </div>
      </div>
    ),
  },
);

export default function DepotCamerasPage() {
  return <CameraGrid />;
}
