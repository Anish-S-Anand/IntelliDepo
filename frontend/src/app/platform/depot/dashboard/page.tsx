import dynamic from "next/dynamic";

const DashboardLivePage = dynamic(
  () => import("@/app/depot/dashboard/DashboardLivePage"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    ),
  }
);

export default function DashboardRoute() {
  return <DashboardLivePage />;
}
