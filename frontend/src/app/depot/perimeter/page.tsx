"use client";

import dynamic from "next/dynamic";

const PerimeterSecurityPage = dynamic(
  () => import("@/components/depot/operations/PerimeterSecurityPage"),
  { loading: () => <div className="flex items-center justify-center h-64 text-[#4E6090] text-sm">Loading perimeter security...</div> }
);

export default function PerimeterPage() {
  return <PerimeterSecurityPage />;
}
