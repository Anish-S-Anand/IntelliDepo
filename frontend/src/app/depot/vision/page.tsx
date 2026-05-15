"use client";

import dynamic from "next/dynamic";
import VisionSkeleton from "@/components/depot/skeletons/VisionSkeleton";

// CameraGrid pulls in TensorFlow + COCO-SSD (~8 MB) — lazy-load it so it
// never blocks the initial navigation to this page.
const CameraGrid = dynamic(
  () => import("@/components/depot/cameras/CameraGrid"),
  {
    ssr: false,
    loading: () => <VisionSkeleton />,
  },
);

export default function VisionRoute() {
  return <CameraGrid />;
}
