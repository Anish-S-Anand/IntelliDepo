import dynamic from "next/dynamic";
import GateSkeleton from "@/components/depot/skeletons/GateSkeleton";

const GateConsolePage = dynamic(
  () => import("@/components/depot/operations/GateConsolePage"),
  { ssr: false, loading: () => <GateSkeleton /> },
);

export default function GateRoute() {
  return <GateConsolePage />;
}
