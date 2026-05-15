import dynamic from "next/dynamic";
import DashboardSkeleton from "@/components/depot/skeletons/DashboardSkeleton";

const CommandPage = dynamic(
  () => import("@/components/depot/operations/CommandPage"),
  { ssr: false, loading: () => <DashboardSkeleton /> },
);

export default function CommandRoute() {
  return <CommandPage />;
}
