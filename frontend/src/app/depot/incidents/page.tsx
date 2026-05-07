import dynamic from "next/dynamic";
import IncidentsSkeleton from "@/components/depot/skeletons/IncidentsSkeleton";

const IncidentsPage = dynamic(
  () => import("@/components/depot/operations/IncidentsPage"),
  { ssr: false, loading: () => <IncidentsSkeleton /> },
);

export default function IncidentsRoute() {
  return <IncidentsPage />;
}
