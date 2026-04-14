import dynamic from "next/dynamic";

const FleetYardPage = dynamic(
  () => import("@/components/depot/operations/FleetYardPage"),
  { ssr: false, loading: () => <LoadingShell /> },
);

function LoadingShell() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5521a] border-t-transparent" />
    </div>
  );
}

export default function FleetPage() {
  return <FleetYardPage />;
}
