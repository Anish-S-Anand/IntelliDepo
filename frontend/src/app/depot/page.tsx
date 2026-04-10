import dynamic from "next/dynamic";

const LegacyDepotHtmlMount = dynamic(
  () => import("@/components/depot/professional/LegacyDepotHtmlMount").then((m) => m.LegacyDepotHtmlMount),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-[#080d18]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e5521a] border-t-transparent" />
          <span className="text-xs text-[#4E6090]">Loading IntelliDepot...</span>
        </div>
      </div>
    ),
  },
);

export default function DepotPage() {
  return <LegacyDepotHtmlMount />;
}
