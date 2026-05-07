"use client";

/**
 * PerimeterSkeleton Component
 * 
 * Instant loading skeleton for Perimeter page that matches the zone map and breach list layout.
 * Shows immediately (<16ms) while data loads to improve perceived performance.
 * 
 * Layout Structure:
 * - Header section (title + action buttons)
 * - Zone map visualization (grid of zone status cards)
 * - Breach list (active security breaches)
 * 
 * Uses CSS variables for theme compatibility:
 * - var(--bg-card) - card backgrounds
 * - var(--border-card) - card borders
 * - var(--text-secondary) - text colors
 * - var(--bg-surface-2) - skeleton bar backgrounds
 * 
 * Validates: Requirements 2.1, 2.4, 2.5
 */

export default function PerimeterSkeleton() {
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

      {/* Zone map skeleton - 8 zone cards */}
      <div className="mb-5">
        <div 
          className="h-5 w-32 rounded mb-3" 
          style={{ 
            backgroundColor: "var(--bg-surface-2)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
          }} 
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`zone-${i}`}
              className="rounded-[14px] p-4 text-center"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-card)",
              }}
            >
              <div 
                className="h-4 w-20 rounded mx-auto mb-2" 
                style={{ 
                  backgroundColor: "var(--bg-surface-2)",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                }} 
              />
              <div 
                className="h-12 w-12 rounded-full mx-auto mb-2" 
                style={{ 
                  backgroundColor: "var(--bg-surface-2)",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                }} 
              />
              <div 
                className="h-3 w-16 rounded mx-auto" 
                style={{ 
                  backgroundColor: "var(--bg-surface-2)",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                }} 
              />
            </div>
          ))}
        </div>
      </div>

      {/* Breach list skeleton */}
      <div>
        <div 
          className="h-5 w-32 rounded mb-3" 
          style={{ 
            backgroundColor: "var(--bg-surface-2)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
          }} 
        />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`breach-${i}`}
              className="rounded-[14px] p-4"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-card)",
                borderLeft: "3px solid var(--text-secondary)",
              }}
            >
              <div className="flex justify-between items-start mb-2">
                <div 
                  className="h-4 w-32 rounded" 
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
              <div className="space-y-1.5">
                <div 
                  className="h-3 w-48 rounded" 
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
      </div>
    </div>
  );
}
