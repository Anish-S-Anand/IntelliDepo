import dynamic from "next/dynamic";
import DashboardSkeleton from "@/components/depot/skeletons/DashboardSkeleton";

const ExecutiveDashboard = dynamic(
  () => import("@/components/depot/operations/ExecutiveDashboard"),
  { ssr: false, loading: () => <DashboardSkeleton /> },
);

export default function OperationsPage() {
  return <ExecutiveDashboard />;
}
