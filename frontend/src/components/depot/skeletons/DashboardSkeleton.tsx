"use client";

/**
 * DashboardSkeleton Component
 * 
 * Instant loading skeleton for ExecutiveDashboard that matches the actual layout structure.
 * Shows immediately (<16ms) while data loads to improve perceived performance.
 * 
 * Layout Structure:
 * - Header section (title + status badge)
 * - KPI strip (6 cards in responsive grid)
 * - Module health grid (6 cards in responsive grid)
 * - Charts row (2 sections side by side)
 * - Capacity overview section
 * - Security incidents section (2 columns)
 * 
 * Uses CSS variables for theme compatibility:
 * - var(--bg-card) - card backgrounds
 * - var(--border-card) - card borders
 * - var(--text-secondary) - text colors
 * - var(--bg-surface-2) - skeleton bar backgrounds
 * 
 * Validates: Requirements 2.1, 2.4, 2.5, 3.4
 */

export default function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-5" style={{ color: "var(--text-primary)" }}>
      {/* Header skeleton */}
      <div className="flex justify-between items-start mb-5">
        <div className="space-y-2">
          <div 
            className="h-3 w-24 rounded" 
            style={{ 
              backgroundColor: "var(--bg-surface-2)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
            }} 
          />
          <div 
            className="h-6 w-48 rounded" 
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
        <div 
          className="h-8 w-28 rounded-lg" 
          style={{ 
            backgroundColor: "var(--bg-surface-2)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
          }} 
        />
      </div>

      {/* KPI strip skeleton - 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`kpi-${i}`}
            className="rounded-[14px] p-3 sm:p-4"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-card)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
          >
            <div 
              className="h-3 w-20 rounded mb-2" 
              style={{ 
                backgroundColor: "var(--bg-surface-2)",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }} 
            />
            <div 
              className="h-8 w-16 rounded mb-1" 
              style={{ 
                backgroundColor: "var(--bg-surface-2)",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }} 
            />
            <div 
              className="h-2 w-24 rounded" 
              style={{ 
                backgroundColor: "var(--bg-surface-2)",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }} 
            />
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px mb-5" style={{ background: "linear-gradient(90deg, transparent, rgba(229,82,26,0.4), transparent)" }} />

      {/* Module Health Grid skeleton - 6 cards */}
      <div className="mb-5">
        <div 
          className="h-5 w-32 rounded mb-3" 
          style={{ 
            backgroundColor: "var(--bg-surface-2)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
          }} 
        />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`module-${i}`}
              className="rounded-[14px] p-4"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-card)",
              }}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-9 h-9 rounded-lg" 
                    style={{ 
                      backgroundColor: "var(--bg-surface-2)",
                      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                    }} 
                  />
                  <div className="space-y-1.5">
                    <div 
                      className="h-3 w-24 rounded" 
                      style={{ 
                        backgroundColor: "var(--bg-surface-2)",
                        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                      }} 
                    />
                    <div 
                      className="h-2 w-20 rounded" 
                      style={{ 
                        backgroundColor: "var(--bg-surface-2)",
                        animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                      }} 
                    />
                  </div>
                </div>
                <div 
                  className="h-5 w-16 rounded-full" 
                  style={{ 
                    backgroundColor: "var(--bg-surface-2)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="flex-1 h-1.5 rounded-full" 
                  style={{ 
                    backgroundColor: "var(--bg-surface-2)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
                <div 
                  className="h-3 w-12 rounded" 
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

      {/* Charts Row skeleton - 2 sections */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-5">
        {/* Throughput Chart skeleton */}
        <div 
          className="rounded-[14px] p-4 sm:p-[18px]" 
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
          }}
        >
          <div className="flex justify-between items-center mb-3.5">
            <div 
              className="h-4 w-40 rounded" 
              style={{ 
                backgroundColor: "var(--bg-surface-2)",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }} 
            />
            <div 
              className="h-5 w-20 rounded-full" 
              style={{ 
                backgroundColor: "var(--bg-surface-2)",
                animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              }} 
            />
          </div>
          <div className="flex items-end gap-1.5 sm:gap-2 h-[140px] sm:h-[170px]">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={`bar-${i}`} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className="w-full rounded-t" 
                  style={{ 
                    height: `${Math.random() * 80 + 40}px`,
                    backgroundColor: "var(--bg-surface-2)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
              </div>
            ))}
          </div>
        </div>

        {/* Counting Sessions skeleton */}
        <div 
          className="rounded-[14px] p-4 sm:p-[18px]" 
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
          }}
        >
          <div className="flex justify-between items-center mb-3.5">
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
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div 
                key={`session-${i}`}
                className="p-2.5 rounded-[10px]" 
                style={{
                  backgroundColor: "var(--bg-surface-2)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div className="flex justify-between items-center mb-1">
                  <div 
                    className="h-3 w-20 rounded" 
                    style={{ 
                      backgroundColor: "var(--bg-surface-3)",
                      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                    }} 
                  />
                  <div 
                    className="h-4 w-16 rounded-full" 
                    style={{ 
                      backgroundColor: "var(--bg-surface-3)",
                      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                    }} 
                  />
                </div>
                <div 
                  className="h-2 w-24 rounded" 
                  style={{ 
                    backgroundColor: "var(--bg-surface-3)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Capacity Overview skeleton */}
      <div 
        className="rounded-[14px] p-4 sm:p-[18px] mb-5" 
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
        }}
      >
        <div className="flex justify-between items-center mb-3.5">
          <div 
            className="h-4 w-36 rounded" 
            style={{ 
              backgroundColor: "var(--bg-surface-2)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
            }} 
          />
          <div 
            className="h-5 w-20 rounded-full" 
            style={{ 
              backgroundColor: "var(--bg-surface-2)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
            }} 
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div 
              key={`capacity-${i}`}
              className="rounded-lg p-3" 
              style={{
                backgroundColor: "var(--bg-surface-2)",
                border: "1px solid var(--border-default)",
              }}
            >
              <div 
                className="h-3 w-16 rounded mb-1" 
                style={{ 
                  backgroundColor: "var(--bg-surface-3)",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                }} 
              />
              <div 
                className="w-full h-2 rounded-full mb-1" 
                style={{ 
                  backgroundColor: "var(--bg-surface-3)",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                }} 
              />
              <div 
                className="h-2 w-20 rounded" 
                style={{ 
                  backgroundColor: "var(--bg-surface-3)",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                }} 
              />
            </div>
          ))}
        </div>
      </div>

      {/* Security & Incident Summary skeleton - 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Vision Alerts skeleton */}
        <div 
          className="rounded-[14px] p-4 sm:p-[18px]" 
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
          }}
        >
          <div className="flex justify-between items-center mb-3.5">
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
            {Array.from({ length: 4 }).map((_, i) => (
              <div 
                key={`alert-${i}`}
                className="p-2.5 rounded-[10px]" 
                style={{
                  backgroundColor: "var(--bg-surface-2)",
                  border: "1px solid var(--border-default)",
                  borderLeft: "3px solid var(--text-secondary)",
                }}
              >
                <div className="flex justify-between items-center mb-1">
                  <div 
                    className="h-3 w-24 rounded" 
                    style={{ 
                      backgroundColor: "var(--bg-surface-3)",
                      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                    }} 
                  />
                  <div 
                    className="h-2 w-12 rounded" 
                    style={{ 
                      backgroundColor: "var(--bg-surface-3)",
                      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                    }} 
                  />
                </div>
                <div 
                  className="h-2 w-32 rounded" 
                  style={{ 
                    backgroundColor: "var(--bg-surface-3)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
              </div>
            ))}
          </div>
        </div>

        {/* Security Incidents skeleton */}
        <div 
          className="rounded-[14px] p-4 sm:p-[18px]" 
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
          }}
        >
          <div className="flex justify-between items-center mb-3.5">
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
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div 
                key={`incident-${i}`}
                className="p-2.5 rounded-[10px]" 
                style={{
                  backgroundColor: "var(--bg-surface-2)",
                  border: "1px solid var(--border-default)",
                  borderLeft: "3px solid var(--text-secondary)",
                }}
              >
                <div className="flex justify-between items-center mb-1">
                  <div 
                    className="h-3 w-28 rounded" 
                    style={{ 
                      backgroundColor: "var(--bg-surface-3)",
                      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                    }} 
                  />
                  <div 
                    className="h-4 w-12 rounded-full" 
                    style={{ 
                      backgroundColor: "var(--bg-surface-3)",
                      animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                    }} 
                  />
                </div>
                <div 
                  className="h-2 w-24 rounded" 
                  style={{ 
                    backgroundColor: "var(--bg-surface-3)",
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }} 
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
