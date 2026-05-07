"use client";

/**
 * VisionSkeleton Component
 * 
 * Instant loading skeleton for Vision page that matches the camera grid layout.
 * Shows immediately (<16ms) while data loads to improve perceived performance.
 * 
 * Layout Structure:
 * - Camera grid (4-6 camera feed placeholders)
 * - Floating action buttons (Results + Alerts)
 * 
 * Uses CSS variables for theme compatibility:
 * - var(--bg-card) - card backgrounds
 * - var(--border-card) - card borders
 * - var(--text-secondary) - text colors
 * - var(--bg-surface-2) - skeleton bar backgrounds
 * 
 * Validates: Requirements 2.1, 2.4, 2.5
 */

export default function VisionSkeleton() {
  return (
    <div className="p-5" style={{ color: "var(--text-primary)" }}>
      {/* Header skeleton */}
      <div className="mb-5">
        <div 
          className="h-6 w-48 rounded mb-2" 
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

      {/* Camera grid skeleton - 6 camera feeds */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`camera-${i}`}
            className="rounded-[14px] overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-card)",
              aspectRatio: "16/9",
            }}
          >
            {/* Camera feed placeholder */}
            <div 
              className="w-full h-full flex items-center justify-center" 
              style={{ 
                backgroundColor: "var(--bg-surface-2)",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }}
            >
              <div className="text-center">
                <div 
                  className="h-12 w-12 rounded-full mx-auto mb-2" 
                  style={{ 
                    backgroundColor: "var(--bg-surface-3)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
                <div 
                  className="h-3 w-24 rounded mx-auto" 
                  style={{ 
                    backgroundColor: "var(--bg-surface-3)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Floating buttons skeleton */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
        <div 
          className="h-10 w-28 rounded-full" 
          style={{ 
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
          }} 
        />
        <div 
          className="h-10 w-28 rounded-full" 
          style={{ 
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
          }} 
        />
      </div>
    </div>
  );
}
