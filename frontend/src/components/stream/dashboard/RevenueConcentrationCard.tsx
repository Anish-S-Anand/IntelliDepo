"use client";

import { useEffect, useMemo } from "react";
import { useSampleDataStore } from "@/stores";

const CHART_COLORS = ["#1a2332", "#3b82f6", "#93c5fd", "#e2e8f0"];

function DonutChart({
  slices,
  centerLabel,
  size = 160,
  strokeWidth = 28,
}: {
  slices: { label: string; share: number; color: string }[];
  centerLabel: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {slices.map((slice, i) => {
          const segmentLength = (slice.share / 100) * circumference;
          const dashOffset = circumference - cumulativeOffset;
          cumulativeOffset += segmentLength;

          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-gray-700">{centerLabel}</span>
      </div>
    </div>
  );
}

export default function RevenueConcentrationCard() {
  const { clients, top3Share, fetchClients, isLoading } = useSampleDataStore();

  useEffect(() => {
    if (clients.length === 0) fetchClients();
  }, [clients.length, fetchClients]);

  // Build slices from real client data
  const slices = useMemo(() => {
    if (clients.length === 0) {
      return [
        { label: "Global Corp", share: 35, color: CHART_COLORS[0] },
        { label: "Nova Tech", share: 22, color: CHART_COLORS[1] },
        { label: "Apex Fin", share: 15, color: CHART_COLORS[2] },
        { label: "Others", share: 28, color: CHART_COLORS[3] },
      ];
    }

    const totalRev = clients.reduce((sum, c) => sum + c.annual_revenue, 0);
    if (totalRev === 0) return [];

    // Sort by revenue descending, take top 3, group the rest as "Others"
    const sorted = [...clients].sort((a, b) => b.annual_revenue - a.annual_revenue);
    const top3 = sorted.slice(0, 3);
    const othersRev = sorted.slice(3).reduce((sum, c) => sum + c.annual_revenue, 0);

    const result = top3.map((c, i) => ({
      label: c.client_name,
      share: Math.round((c.annual_revenue / totalRev) * 100),
      color: CHART_COLORS[i] ?? CHART_COLORS[2],
    }));

    if (othersRev > 0) {
      result.push({
        label: "Others",
        share: Math.round((othersRev / totalRev) * 100),
        color: CHART_COLORS[3],
      });
    }

    // Adjust rounding so total is 100
    const total = result.reduce((s, r) => s + r.share, 0);
    if (total !== 100 && result.length > 0) {
      result[result.length - 1].share += 100 - total;
    }

    return result;
  }, [clients]);

  const displayTop3 = top3Share > 0 ? Math.round(top3Share * 100) : 72;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold tracking-wider text-gray-800 uppercase">Revenue Concentration</h3>
        </div>
        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
          TOP 3: {displayTop3}%
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="flex items-center gap-8">
          <DonutChart slices={slices} centerLabel={`${displayTop3}%`} />
          <div className="flex-1 space-y-3">
            {slices.map((slice) => (
              <div key={slice.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: slice.color }} />
                  <span className="text-sm text-gray-600">{slice.label}</span>
                </div>
                <span className="text-sm font-semibold text-gray-700">{slice.share}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
