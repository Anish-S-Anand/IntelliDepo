"use client";

/**
 * InventorySkeleton Component
 * 
 * Instant loading skeleton for InventoryPage that matches the actual layout structure.
 * Shows immediately (<16ms) while data loads to improve perceived performance.
 * 
 * Layout Structure:
 * - Header section (title + action buttons)
 * - Zone bars (4 horizontal bars with labels and percentages)
 * - View tabs (Clusters/Batches toggle)
 * - Search and filter bar
 * - Cluster cards grid (8 cards in responsive grid)
 * 
 * Uses CSS variables for theme compatibility:
 * - var(--bg-card) - card backgrounds
 * - var(--border-card) - card borders
 * - var(--text-secondary) - text colors
 * - var(--bg-surface-2) - skeleton bar backgrounds
 * 
 * Validates: Requirements 2.1, 2.4, 2.5, 3.4
 */

export default function InventorySkeleton() {
  return (
    <div className="p-5" style={{ color: "var(--text-primary)" }}>
      {/* Header skeleton */}
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div className="space-y-2">
          <div 
            className="h-6 w-48 rounded" 
            style={{ 
              backgroundColor: "var(--bg-surface-2)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
            }} 
          />
          <div 
            className="h-3 w-64 rounded" 
            style={{ 
              backgroundColor: "var(--bg-surface-2)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
            }} 
          />
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="h-9 w-24 rounded-lg" 
            style={{ 
              backgroundColor: "var(--bg-surface-2)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
            }} 
          />
          <div 
            className="h-9 w-28 rounded-lg" 
            style={{ 
              backgroundColor: "var(--bg-surface-2)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
            }} 
          />
        </div>
      </div>

      {/* Zone bars skeleton - 4 bars */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`zone-${i}`}
            className="rounded-[14px] p-4 text-center relative overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-card)",
            }}
          >
            <div 
              className="h-3 w-16 rounded mx-auto mb-2" 
              style={{ 
                backgroundColor: "var(--bg-surface-2)",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }} 
            />
            <div 
              className="h-8 w-20 rounded mx-auto mb-2" 
              style={{ 
                backgroundColor: "var(--bg-surface-2)",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }} 
            />
            <div 
              className="w-full h-1 rounded-full mb-2" 
              style={{ 
                backgroundColor: "var(--bg-surface-2)",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }} 
            />
            <div 
              className="h-2 w-24 rounded mx-auto" 
              style={{ 
                backgroundColor: "var(--bg-surface-2)",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }} 
            />
          </div>
        ))}
      </div>

      {/* View tabs skeleton */}
      <div className="flex gap-1 mb-4 w-fit rounded-xl p-1" style={{ backgroundColor: "var(--bg-surface-2)" }}>
        <div 
          className="h-9 w-24 rounded-lg" 
          style={{ 
            backgroundColor: "var(--bg-surface-3)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
          }} 
        />
        <div 
          className="h-9 w-24 rounded-lg" 
          style={{ 
            backgroundColor: "var(--bg-surface-3)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
          }} 
        />
      </div>

      {/* Search and filter bar skeleton */}
      <div className="flex gap-1.5 mb-4 flex-wrap items-center">
        <div 
          className="flex-1 min-w-[180px] h-10 rounded-[9px]" 
          style={{ 
            backgroundColor: "var(--bg-surface-2)",
            border: "1px solid var(--border-card)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
          }} 
        />
        <div 
          className="h-10 w-48 rounded-[9px]" 
          style={{ 
            backgroundColor: "var(--bg-surface-2)",
            border: "1px solid var(--border-card)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
          }} 
        />
        {Array.from({ length: 4 }).map((_, i) => (
          <div 
            key={`filter-${i}`}
            className="h-8 w-20 rounded-lg" 
            style={{ 
              backgroundColor: "var(--bg-surface-2)",
              border: "1px solid var(--border-card)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
            }} 
          />
        ))}
      </div>

      {/* Cluster cards grid skeleton - 8 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`cluster-${i}`}
            className="rounded-[14px] p-[15px]"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-card)",
            }}
          >
            {/* Card header */}
            <div className="flex justify-between mb-2.5">
              <div className="space-y-1.5">
                <div 
                  className="h-4 w-24 rounded" 
                  style={{ 
                    backgroundColor: "var(--bg-surface-2)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
                <div 
                  className="h-3 w-32 rounded" 
                  style={{ 
                    backgroundColor: "var(--bg-surface-2)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
              </div>
              <div className="flex flex-col gap-1 items-end">
                <div 
                  className="h-5 w-12 rounded-full" 
                  style={{ 
                    backgroundColor: "var(--bg-surface-2)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
                <div 
                  className="h-5 w-16 rounded-full" 
                  style={{ 
                    backgroundColor: "var(--bg-surface-2)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
              </div>
            </div>

            {/* Progress bar */}
            <div 
              className="w-full h-1 rounded-full mb-2.5" 
              style={{ 
                backgroundColor: "var(--bg-surface-2)",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }} 
            />

            {/* Card details */}
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-1">
              {Array.from({ length: 8 }).map((_, j) => (
                <div 
                  key={`detail-${j}`}
                  className="h-2.5 rounded" 
                  style={{ 
                    backgroundColor: "var(--bg-surface-2)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
