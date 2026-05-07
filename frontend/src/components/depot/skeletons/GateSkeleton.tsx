"use client";

/**
 * GateSkeleton Component
 * 
 * Instant loading skeleton for Gate page that matches the access log table and filter bar layout.
 * Shows immediately (<16ms) while data loads to improve perceived performance.
 * 
 * Layout Structure:
 * - Header section (title + action buttons)
 * - Filter bar (search, date range, status filters)
 * - Access log table (detailed gate access records)
 * 
 * Uses CSS variables for theme compatibility:
 * - var(--bg-card) - card backgrounds
 * - var(--border-card) - card borders
 * - var(--text-secondary) - text colors
 * - var(--bg-surface-2) - skeleton bar backgrounds
 * 
 * Validates: Requirements 2.1, 2.4, 2.5
 */

export default function GateSkeleton() {
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
            className="h-9 w-28 rounded-lg" 
            style={{ 
              backgroundColor: "var(--bg-surface-2)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
            }} 
          />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div 
          className="flex-1 min-w-[200px] h-10 rounded-[9px]" 
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
        {Array.from({ length: 3 }).map((_, i) => (
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

      {/* Access log table skeleton */}
      <div 
        className="rounded-[14px] overflow-hidden" 
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
        }}
      >
        {/* Table header */}
        <div className="grid grid-cols-7 gap-4 p-4 border-b" style={{ borderColor: "var(--border-card)" }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div 
              key={`header-${i}`}
              className="h-3 rounded" 
              style={{ 
                backgroundColor: "var(--bg-surface-2)",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }} 
            />
          ))}
        </div>

        {/* Table rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div 
            key={`row-${i}`}
            className="grid grid-cols-7 gap-4 p-4 border-b" 
            style={{ borderColor: "var(--border-card)" }}
          >
            {Array.from({ length: 7 }).map((_, j) => (
              <div 
                key={`cell-${j}`}
                className="h-3 rounded" 
                style={{ 
                  backgroundColor: "var(--bg-surface-2)",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                }} 
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
