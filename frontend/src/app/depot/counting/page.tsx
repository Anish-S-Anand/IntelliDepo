import dynamic from "next/dynamic";
import CountingSkeleton from "@/components/depot/skeletons/CountingSkeleton";

const CountingSummaryPage = dynamic(
  () => import("@/components/depot/operations/CountingSummaryPage"),
  { ssr: false, loading: () => <CountingSkeleton /> },
);

export default function CountingPage() {
  return <CountingSummaryPage />;
}
