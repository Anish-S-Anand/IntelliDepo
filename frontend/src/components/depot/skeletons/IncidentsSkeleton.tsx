"use client";

/**
 * IncidentsSkeleton Component
 * 
 * Instant loading skeleton for Incidents page that matches the incident cards and timeline layout.
 * Shows immediately (<16ms) while data loads to improve perceived performance.
 * 
 * Layout Structure:
 * - Header section (title + action buttons)
 * - Filter bar (search, status filters)
 * - Incident cards (detailed incident records with severity indicators)
 * - Timeline view (chronological incident history)
 * 
 * Uses CSS variables for theme compatibility:
 * - var(--bg-card) - card backgrounds
 * - var(--border-card) - card borders
 * - var(--text-secondary) - text colors
 * - var(--bg-surface-2) - skeleton bar backgrounds
 * 
 * Validates: Requirements 2.1, 2.4, 2.5
 */

export default function IncidentsSkeleton() {
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

      {/* Incident cards skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`incident-${i}`}
            className="rounded-[14px] p-4"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-card)",
              borderLeft: "3px solid var(--text-secondary)",
            }}
          >
            {/* Incident header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
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
                <div 
                  className="h-3 w-64 rounded" 
                  style={{ 
                    backgroundColor: "var(--bg-surface-2)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
              </div>
              <div 
                className="h-8 w-24 rounded-lg" 
                style={{ 
                  backgroundColor: "var(--bg-surface-2)",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                }} 
              />
            </div>

            {/* Incident details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={`detail-${j}`} className="space-y-1">
                  <div 
                    className="h-2 w-16 rounded" 
                    style={{ 
                      backgroundColor: "var(--bg-surface-2)",
                      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                    }} 
                  />
                  <div 
                    className="h-3 w-20 rounded" 
                    style={{ 
                      backgroundColor: "var(--bg-surface-2)",
                      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                    }} 
                  />
                </div>
              ))}
            </div>

            {/* Timeline indicator */}
            <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border-card)" }}>
              <div className="flex items-center gap-2">
                <div 
                  className="h-2 w-2 rounded-full" 
                  style={{ 
                    backgroundColor: "var(--bg-surface-2)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
                <div 
                  className="h-2 w-32 rounded" 
                  style={{ 
                    backgroundColor: "var(--bg-surface-2)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
