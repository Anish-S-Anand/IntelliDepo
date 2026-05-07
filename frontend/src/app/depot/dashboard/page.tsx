import dynamic from "next/dynamic";
import DashboardSkeleton from "@/components/depot/skeletons/DashboardSkeleton";

const DashboardLivePage = dynamic(() => import("./DashboardLivePage"), {
  ssr: false,
  loading: () => <DashboardSkeleton />,
});

export default function DashboardRoute() {
  return <DashboardLivePage />;
}
