"use client";

/**
 * CountingSkeleton Component
 * 
 * Instant loading skeleton for Counting page that matches the session cards and count table layout.
 * Shows immediately (<16ms) while data loads to improve perceived performance.
 * 
 * Layout Structure:
 * - Header section (title + action buttons)
 * - Session cards (3-4 cards showing counting sessions)
 * - Count table (detailed count records)
 * 
 * Uses CSS variables for theme compatibility:
 * - var(--bg-card) - card backgrounds
 * - var(--border-card) - card borders
 * - var(--text-secondary) - text colors
 * - var(--bg-surface-2) - skeleton bar backgrounds
 * 
 * Validates: Requirements 2.1, 2.4, 2.5
 */

export default function CountingSkeleton() {
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
            className="h-9 w-32 rounded-lg" 
            style={{ 
              backgroundColor: "var(--bg-surface-2)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
            }} 
          />
        </div>
      </div>

      {/* Session cards skeleton - 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`session-${i}`}
            className="rounded-[14px] p-4"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-card)",
            }}
          >
            <div className="flex justify-between items-start mb-3">
              <div 
                className="h-4 w-24 rounded" 
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
            <div className="space-y-2">
              <div 
                className="h-3 w-32 rounded" 
                style={{ 
                  backgroundColor: "var(--bg-surface-2)",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                }} 
              />
              <div 
                className="h-3 w-28 rounded" 
                style={{ 
                  backgroundColor: "var(--bg-surface-2)",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                }} 
              />
              <div 
                className="h-3 w-36 rounded" 
                style={{ 
                  backgroundColor: "var(--bg-surface-2)",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                }} 
              />
            </div>
          </div>
        ))}
      </div>

      {/* Count table skeleton */}
      <div 
        className="rounded-[14px] overflow-hidden" 
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
        }}
      >
        {/* Table header */}
        <div className="flex gap-4 p-4 border-b" style={{ borderColor: "var(--border-card)" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div 
              key={`header-${i}`}
              className="h-3 w-20 rounded" 
              style={{ 
                backgroundColor: "var(--bg-surface-2)",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }} 
            />
          ))}
        </div>

        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div 
            key={`row-${i}`}
            className="flex gap-4 p-4 border-b" 
            style={{ borderColor: "var(--border-card)" }}
          >
            {Array.from({ length: 6 }).map((_, j) => (
              <div 
                key={`cell-${j}`}
                className="h-3 w-20 rounded" 
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
