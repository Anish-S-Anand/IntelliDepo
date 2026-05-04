export default function DepotLoading() {
  return (
    <div
      className="min-h-[80vh] p-4 sm:p-5"
      style={{ backgroundColor: "var(--bg-page)" }}
    >
      {/* Top header skeleton */}
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div className="space-y-2">
          <div className="route-skeleton-bar h-3 w-20" />
          <div className="route-skeleton-bar h-7 w-52" />
          <div className="route-skeleton-bar h-3 w-40" />
        </div>
        <div className="route-skeleton-bar h-9 w-32 rounded-xl" />
      </div>

      {/* KPI strip skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="route-skeleton-bar h-[76px] rounded-[14px]"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>

      {/* Divider */}
      <div
        className="h-px mb-5"
        style={{ background: "var(--border-default)" }}
      />

      {/* Section label */}
      <div className="route-skeleton-bar h-5 w-36 mb-3" />

      {/* Module grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="route-skeleton-bar h-[76px] rounded-[14px]"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <div className="route-skeleton-bar h-[220px] rounded-[14px]" />
        <div className="route-skeleton-bar h-[220px] rounded-[14px]" />
      </div>
    </div>
  );
}
