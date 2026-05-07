"use client";

import dynamic from "next/dynamic";
import PerimeterSkeleton from "@/components/depot/skeletons/PerimeterSkeleton";

const PerimeterSecurityPage = dynamic(
  () => import("@/components/depot/operations/PerimeterSecurityPage"),
  { loading: () => <PerimeterSkeleton /> }
);

export default function PerimeterPage() {
  return <PerimeterSecurityPage />;
}
