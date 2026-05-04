"use client";

import { useState, useCallback, useEffect } from "react";

import { useAuthStore, useScenarioStore } from "@/stores";
import {
  buildSimulationSnapshot,
  buildSimulationSnapshotFromSliders,
  getDefaultSimulationSnapshot,
  type SimulationSnapshot,
} from "@/utils";

export default function SimulationPanel() {
  const { isAuthenticated } = useAuthStore();
  const {
    activeScenario,
    scenarios,
    fetchScenarios,
    seedBaseline,
    saveAdjustments,
    setActiveScenario,
  } = useScenarioStore();

  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(
    () => getDefaultSimulationSnapshot(),
  );
  const [saving, setSaving] = useState(false);

  // Load baseline scenario on mount
  useEffect(() => {
    if (!isAuthenticated) {
      setSnapshot(getDefaultSimulationSnapshot());
      return;
    }

    if (scenarios.length === 0) {
      fetchScenarios().then(() => {
        const { scenarios: loaded } = useScenarioStore.getState();
        const baseline = loaded.find((s) => s.is_baseline);
        if (baseline) {
          setActiveScenario(baseline);
        } else {
          seedBaseline().catch(() => undefined);
        }
      });
    } else if (!activeScenario) {
      const baseline = scenarios.find((s) => s.is_baseline);
      if (baseline) {
        setActiveScenario(baseline);
      } else {
        seedBaseline().catch(() => undefined);
      }
    }
  }, [activeScenario, fetchScenarios, isAuthenticated, scenarios, seedBaseline, setActiveScenario]);

  useEffect(() => {
    if (isAuthenticated && activeScenario) {
      setSnapshot(buildSimulationSnapshot(activeScenario));
      return;
    }
    setSnapshot(getDefaultSimulationSnapshot());
  }, [activeScenario, isAuthenticated]);

  const handleSliderChange = useCallback(
    (key: string, value: number) => {
      setSnapshot((prev) => {
        const sliders = prev.sliders.map((slider) =>
          slider.key === key ? { ...slider, value } : slider,
        );
        return buildSimulationSnapshotFromSliders(sliders, activeScenario);
      });
    },
    [activeScenario],
  );

  const runSimulation = useCallback(async () => {
    const nextSnapshot = buildSimulationSnapshotFromSliders(snapshot.sliders, activeScenario);
    setSnapshot(nextSnapshot);

    if (activeScenario && isAuthenticated) {
      setSaving(true);
      try {
        await saveAdjustments(nextSnapshot.adjustedInputs, nextSnapshot.computedResults);
      } finally {
        setSaving(false);
      }
    }
  }, [activeScenario, isAuthenticated, saveAdjustments, snapshot]);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Simulation Panel</h3>
          <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase mt-0.5">
            Adjust variables to forecast P&L variances
          </p>
        </div>
        <button
          onClick={runSimulation}
          disabled={saving}
          className="px-6 py-2.5 bg-[#1a2332] text-white text-sm font-bold tracking-wider uppercase rounded-full hover:bg-[#243044] transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : isAuthenticated ? "Run Simulation" : "Run Preview"}
        </button>
      </div>

      {!isAuthenticated && (
        <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Preview mode is using local sample calculations. Sign in to load and save scenarios.
        </p>
      )}

      <hr className="my-4 border-gray-100" />

      <div className="grid grid-cols-2">
        {/* Sliders */}
        <div className="space-y-6 pr-8">
          {snapshot.sliders.map((slider) => (
            <div key={slider.key}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  {slider.label}
                </label>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {slider.value.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step}
                value={slider.value}
                onChange={(e) => handleSliderChange(slider.key, parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-md"
              />
            </div>
          ))}
        </div>

        {/* Results Table */}
        <div className="pl-8 border-l border-gray-100">
          <table className="w-full">
            <thead>
              <tr className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
                <th className="text-left pb-3">Metric</th>
                <th className="text-right pb-3">Current</th>
                <th className="text-right pb-3">Simulated</th>
                <th className="text-right pb-3">Var %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {snapshot.results.map((row) => (
                <tr key={row.metric}>
                  <td className="py-3 text-sm font-bold text-gray-800 uppercase">{row.metric}</td>
                  <td className="py-3 text-sm text-gray-500 text-right">{row.current}</td>
                  <td className={`py-3 text-sm font-bold text-right ${row.positive ? "text-blue-600" : "text-red-500"}`}>
                    {row.simulated}
                  </td>
                  <td className={`py-3 text-sm font-semibold text-right ${row.positive ? "text-emerald-500" : "text-red-500"}`}>
                    {row.variance}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
