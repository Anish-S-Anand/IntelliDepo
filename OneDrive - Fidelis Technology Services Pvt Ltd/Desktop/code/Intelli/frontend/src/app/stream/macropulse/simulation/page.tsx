"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, Play, RefreshCw, Zap } from "lucide-react";
import { formatSigned } from "@/utils/macropulse-format";

// ─── constants ────────────────────────────────────────────────────────────────

const PERIODS = ["Quarterly", "Annual"] as const;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const BASE_BRENT_OIL = 82;
const BASE_INR_TO_USD = 83.5;

const PRESET_SCENARIOS = [
  {
    id: "custom",
    label: "Custom",
    emoji: "⚙️",
    description: "Manually adjust all macro variables",
    interestRate: 1.25,
    fxVolatility: -4.2,
    crudeOil: BASE_BRENT_OIL,
    combinedMacro: 0,
    riskLevel: "LOW" as const,
  },
  {
    id: "2008",
    label: "2008 Credit Crunch",
    emoji: "🏦",
    description: "Lehman-style credit seizure: rate spike, FX collapse, oil shock",
    interestRate: 4.5,
    fxVolatility: -14,
    crudeOil: 145,
    combinedMacro: -8,
    riskLevel: "EXTREME" as const,
  },
  {
    id: "covid",
    label: "COVID-19 Shock",
    emoji: "🦠",
    description: "Demand collapse, emergency rate cuts, oil crash to $20",
    interestRate: -2.5,
    fxVolatility: -9,
    crudeOil: 22,
    combinedMacro: -7,
    riskLevel: "EXTREME" as const,
  },
  {
    id: "oil-crash",
    label: "Oil Price Crash",
    emoji: "🛢️",
    description: "OPEC supply war drives Brent below $35 — freight and petrochemical relief",
    interestRate: 0,
    fxVolatility: -3,
    crudeOil: 32,
    combinedMacro: -4,
    riskLevel: "HIGH" as const,
  },
  {
    id: "taper",
    label: "Fed Taper Tantrum",
    emoji: "📈",
    description: "Rapid rate normalisation; EM currencies sell off",
    interestRate: 3.5,
    fxVolatility: -7,
    crudeOil: 108,
    combinedMacro: -3.5,
    riskLevel: "HIGH" as const,
  },
  {
    id: "iran",
    label: "Middle East Escalation",
    emoji: "⚡",
    description: "Geopolitical supply disruption drives crude to $160+",
    interestRate: 0.75,
    fxVolatility: -5,
    crudeOil: 162,
    combinedMacro: -5,
    riskLevel: "HIGH" as const,
  },
] as const;

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
type PresetId = (typeof PRESET_SCENARIOS)[number]["id"];

const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  EXTREME: "bg-red-100 text-red-800 border-red-200",
};

const RISK_BAR: Record<RiskLevel, string> = {
  LOW: "#10b981",
  MEDIUM: "#f59e0b",
  HIGH: "#f97316",
  EXTREME: "#dc2626",
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function getRiskLevel(combinedMacro: number, crudeOil: number, interestRate: number): RiskLevel {
  const riskScore =
    Math.abs(combinedMacro) * 1.5 +
    (crudeOil > 130 || crudeOil < 40 ? 4 : crudeOil > 110 ? 2 : 0) +
    (Math.abs(interestRate) > 3 ? 3 : Math.abs(interestRate) > 2 ? 1.5 : 0);

  if (riskScore >= 12) return "EXTREME";
  if (riskScore >= 7) return "HIGH";
  if (riskScore >= 3) return "MEDIUM";
  return "LOW";
}

function estimatePnLImpact(
  combinedMacro: number,
  interestRate: number,
  crudeOil: number,
  period: (typeof PERIODS)[number]
): { total: number; components: Array<{ label: string; impact: number }> } {
  const periodFactor = period === "Annual" ? 1 : 0.25;
  const baseRevenue = 500; // ₹ Cr baseline revenue
  const fxImpact = (combinedMacro / 100) * baseRevenue * 0.18 * periodFactor;
  const rateImpact = (interestRate / 100) * 100 * 0.65 * periodFactor; // 100 Cr loan, 65% floating
  const oilImpact = ((crudeOil - BASE_BRENT_OIL) / BASE_BRENT_OIL) * baseRevenue * 0.30 * periodFactor;
  const total = fxImpact + rateImpact + oilImpact;

  return {
    total,
    components: [
      { label: "FX / USD-INR", impact: fxImpact },
      { label: "Interest Rate", impact: rateImpact },
      { label: "Crude Oil / COGS", impact: oilImpact },
    ],
  };
}

// ─── sub-components ───────────────────────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  colorClass,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  colorClass: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{label}</span>
        <span className={`text-sm font-bold ${colorClass}`}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-blue-600 transition-all duration-200"
      />
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function SimulationPage() {
  const [activePreset, setActivePreset] = useState<PresetId>("custom");
  const [interestRate, setInterestRate] = useState(1.25);
  const [fxVolatility, setFxVolatility] = useState(-4.2);
  const [crudeOil, setCrudeOil] = useState(BASE_BRENT_OIL);
  const [combinedMacro, setCombinedMacro] = useState(0);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("Quarterly");
  const [simulationRan, setSimulationRan] = useState(false);
  const [geoRegions, setGeoRegions] = useState<boolean[]>([false, false, false, true]);
  const [toast, setToast] = useState<string | null>(null);

  const riskLevel = useMemo(
    () => getRiskLevel(combinedMacro, crudeOil, interestRate),
    [combinedMacro, crudeOil, interestRate]
  );

  const pnl = useMemo(
    () => estimatePnLImpact(combinedMacro, interestRate, crudeOil, period),
    [combinedMacro, interestRate, crudeOil, period]
  );

  const marginProbability = useMemo(() => {
    return Math.min(97, 60 + Math.round(Math.abs(combinedMacro) * 1.8 + Math.abs(interestRate) * 1.2));
  }, [combinedMacro, interestRate]);

  const barHeights = useMemo(() => {
    const base = [38, 52, 48, 62, 100, 78, 58, 42, 65, 72, 54, 68];
    const periodScale = period === "Annual" ? 1.4 : 1.0;
    const geoCount = geoRegions.filter(Boolean).length;
    const geoScale = 0.5 + geoCount * 0.17; // 0–4 regions: 0.5–1.18×
    return base.map((h) => {
      const shock = Math.abs(combinedMacro) * 2 + Math.abs(interestRate);
      const adjusted = Math.max(10, Math.min(100, h - shock * (h / 80)));
      return Math.min(100, adjusted * periodScale * geoScale);
    });
  }, [combinedMacro, interestRate, period, geoRegions]);

  const applyPreset = (presetId: PresetId) => {
    const p = PRESET_SCENARIOS.find((s) => s.id === presetId);
    if (!p) return;
    setActivePreset(presetId);
    setInterestRate(p.interestRate);
    setFxVolatility(p.fxVolatility);
    setCrudeOil(p.crudeOil);
    setCombinedMacro(p.combinedMacro);
    setSimulationRan(false);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleInterestChange = (v: number) => { setInterestRate(v); setActivePreset("custom"); };
  const handleFxChange = (v: number) => { setFxVolatility(v); setActivePreset("custom"); };
  const handleOilChange = (v: number) => { if (!isNaN(v)) { setCrudeOil(v); setActivePreset("custom"); } };
  const handleCombinedChange = (v: number) => {
    setCombinedMacro(v);
    setActivePreset("custom");
    setCrudeOil(BASE_BRENT_OIL * (1 + (v / 100) * 0.8));
  };

  return (
    <div className="space-y-6 px-6 py-7 lg:px-8 overflow-y-auto h-full">
      {/* Title */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-3xl">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-blue-600">Enterprise Intelligence</p>
          <h2 className="text-3xl font-black text-gray-900">Simulation &amp; Worst-Case Explorer</h2>
          <p className="mt-1 text-sm text-gray-500">
            Select a historical shock scenario or tune variables manually. See cascaded P&amp;L, margin, and supply chain impacts in real time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
            <Download className="h-4 w-4" /> Export
          </button>
          <button
            onClick={() => setSimulationRan(true)}
            className="flex items-center gap-2 rounded-lg bg-[#1a2332] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#243044] transition"
          >
            <Play className="h-4 w-4" /> Run Simulation
          </button>
        </div>
      </div>

      {/* ── Scenario Presets ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-blue-600" />
          <p className="text-sm font-bold text-gray-800">Scenario Presets</p>
          <span className="text-xs text-gray-400 ml-1">Select a historical shock or set custom variables</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PRESET_SCENARIOS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              className={`text-left rounded-2xl border-2 p-4 transition-all duration-200 ${
                activePreset === preset.id
                  ? preset.riskLevel === "EXTREME" ? "border-red-500 bg-red-50"
                    : preset.riskLevel === "HIGH" ? "border-orange-400 bg-orange-50"
                    : "border-blue-500 bg-blue-50"
                  : "border-gray-100 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-lg">{preset.emoji}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full border px-2 py-0.5 ${RISK_COLORS[preset.riskLevel as RiskLevel]}`}>
                  {preset.riskLevel}
                </span>
              </div>
              <p className="text-sm font-bold text-gray-800">{preset.label}</p>
              <p className="mt-1 text-xs text-gray-500 leading-4">{preset.description}</p>
              {activePreset === preset.id && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-semibold bg-white border border-gray-200 rounded px-1.5 py-0.5">
                    Rate {formatSigned(preset.interestRate)}
                  </span>
                  <span className="text-[10px] font-semibold bg-white border border-gray-200 rounded px-1.5 py-0.5">
                    FX {formatSigned(preset.fxVolatility)}
                  </span>
                  <span className="text-[10px] font-semibold bg-white border border-gray-200 rounded px-1.5 py-0.5">
                    Crude ${preset.crudeOil}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Grid: Variables + Chart ──────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">

        {/* Scenario Variables */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Scenario Variables</h3>
              <p className="mt-0.5 text-xs uppercase tracking-[0.24em] text-gray-400">Dynamic Macro Drivers</p>
            </div>
            <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${RISK_COLORS[riskLevel]}`}>
              {riskLevel === "EXTREME" || riskLevel === "HIGH"
                ? <AlertTriangle className="h-3 w-3" />
                : <RefreshCw className="h-3 w-3" />}
              {riskLevel} RISK
            </div>
          </div>

          <Slider
            label="Interest Rate Shock"
            value={interestRate}
            min={-5}
            max={5}
            step={0.25}
            format={(v) => formatSigned(v)}
            colorClass={interestRate >= 0 ? "text-red-500" : "text-emerald-600"}
            onChange={handleInterestChange}
          />

          <Slider
            label="USD/INR FX Volatility"
            value={fxVolatility}
            min={-15}
            max={5}
            step={0.5}
            format={(v) => formatSigned(v)}
            colorClass={fxVolatility >= 0 ? "text-emerald-600" : "text-red-500"}
            onChange={handleFxChange}
          />

          <div>
            <div className="mb-2 flex justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Brent Crude Oil ($/BBL)</span>
              <span className={`text-sm font-bold ${crudeOil > 110 ? "text-red-500" : crudeOil < 50 ? "text-amber-500" : "text-gray-700"}`}>
                ${crudeOil.toFixed(1)}
              </span>
            </div>
            <input
              type="number"
              value={crudeOil}
              onChange={(e) => handleOilChange(parseFloat(e.target.value))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-cyan-50 to-slate-50 p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Combined Macro Impact</p>
                <p className="mt-0.5 text-xs text-gray-600">INR vs USD/AED + Oil Sensitivity</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${combinedMacro < -5 ? "bg-red-100 text-red-700" : combinedMacro < 0 ? "bg-amber-100 text-amber-700" : "bg-white text-blue-600"}`}>
                {formatSigned(combinedMacro)}
              </span>
            </div>
            <input
              type="range"
              min={-10}
              max={5}
              step={0.5}
              value={combinedMacro}
              onChange={(e) => handleCombinedChange(parseFloat(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-blue-100 accent-blue-600 transition-all duration-200"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>-10%</span>
              <span>Neutral</span>
              <span>+5%</span>
            </div>
          </div>

          <div className={`rounded-xl border p-4 ${RISK_COLORS[riskLevel]}`}>
            <p className="text-xs leading-5">
              AI predicts a <span className="font-bold">{marginProbability}% probability</span> of this macro scenario
              materially impacting {period === "Annual" ? "FY" : "Q"} margins.
              {riskLevel === "EXTREME" && " This represents a severe tail-risk event — activate contingency hedges."}
              {riskLevel === "HIGH" && " Consider reviewing FX hedges and crude procurement strategy."}
            </p>
          </div>
        </div>

        {/* Right column: P&L chart + impact summary */}
        <div className="space-y-5">
          {/* P&L Chart */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">P&amp;L Sensitivity Projection</h3>
                <p className="mt-0.5 text-xs text-gray-500">Projected variance vs. Baseline (FY2024) · {activePreset !== "custom" ? PRESET_SCENARIOS.find(p => p.id === activePreset)?.label : "Custom"}</p>
              </div>
              <div className="flex shrink-0 overflow-hidden rounded-lg border border-gray-200">
                {PERIODS.map((value) => (
                  <button
                    key={value}
                    onClick={() => setPeriod(value)}
                    className={`px-4 py-1.5 text-xs font-semibold transition ${period === value ? "bg-[#1a2332] text-white" : "text-gray-500 hover:bg-gray-50"}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="w-full overflow-x-auto [scrollbar-width:thin]">
                <div style={{ width: "900px", minWidth: "800px" }}>
                  <div className="flex h-[280px] items-end gap-4 px-2">
                    {MONTHS.map((month, index) => (
                      <div key={month} className="flex w-[60px] shrink-0 flex-col items-center gap-2">
                        {barHeights[index] === Math.max(...barHeights) && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
                            Peak
                          </span>
                        )}
                        <div
                          className="w-full rounded-t-xl transition-all duration-500"
                          style={{
                            height: `${barHeights[index]}%`,
                            background: riskLevel === "EXTREME"
                              ? "#dc2626"
                              : riskLevel === "HIGH"
                              ? "#f97316"
                              : index === MONTHS.indexOf("MAY")
                              ? "#1a2332"
                              : "#93c5fd",
                          }}
                        />
                        <span className="text-[9px] tracking-[0.15em] text-gray-400">{month}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Geo filters */}
            <div className="mt-5 border-t border-gray-100 pt-5 flex flex-wrap gap-6">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-500">Geographic Filter</p>
                {["North America (AMER)", "Europe & MEA (EMEA)", "Asia Pacific (APAC)", "GCC (India/UAE/SA)"].map((region, i) => (
                  <label key={region} className="mb-1.5 flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={geoRegions[i]}
                      onChange={(e) => {
                        const next = [...geoRegions];
                        next[i] = e.target.checked;
                        setGeoRegions(next);
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">{region}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Impact Summary */}
          {simulationRan && (
            <div className={`rounded-2xl border p-6 ${riskLevel === "EXTREME" ? "bg-red-50 border-red-200" : riskLevel === "HIGH" ? "bg-orange-50 border-orange-200" : "bg-white border-gray-100 shadow-sm"}`}>
              <h3 className="text-base font-bold text-gray-900 mb-4">Simulation Impact Summary</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Total P&amp;L Impact</p>
                  <p className={`text-3xl font-black mt-1 ${pnl.total < 0 ? "text-red-700" : "text-emerald-700"}`}>
                    ₹{Math.abs(pnl.total).toFixed(1)} Cr
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{pnl.total < 0 ? "Loss" : "Gain"} · {period}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Margin Impact Probability</p>
                  <p className={`text-3xl font-black mt-1 ${riskLevel === "EXTREME" ? "text-red-700" : riskLevel === "HIGH" ? "text-orange-700" : "text-gray-900"}`}>
                    {marginProbability}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Risk level: {riskLevel}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {pnl.components.map((c) => (
                  <div key={c.label} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-2.5">
                    <span className="text-sm text-gray-700 font-medium">{c.label}</span>
                    <span className={`text-sm font-bold ${c.impact < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {c.impact < 0 ? "−" : "+"}₹{Math.abs(c.impact).toFixed(1)} Cr
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (Math.abs(pnl.total) / 50) * 100)}%`, backgroundColor: RISK_BAR[riskLevel] }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="flex flex-col gap-4 rounded-2xl bg-[#1a2332] p-6 text-white xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h3 className="text-lg font-bold">Integration Blueprint Ready</h3>
          <p className="mt-1 text-sm text-slate-400">
            Simulation results can be pushed to Treasury Management System (TMS) or shared via secure link.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 xl:shrink-0">
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href).catch(() => null);
              showToast("Report link copied to clipboard");
            }}
            className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-semibold hover:bg-white/5 transition"
          >
            Share Report
          </button>
          <button
            onClick={() => {
              if (!simulationRan) { showToast("Run the simulation first"); return; }
              showToast("Simulation pushed to TMS queue");
            }}
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-[#1a2332] hover:bg-gray-100 transition"
          >
            Push to Production
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-[#1a2332] px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
