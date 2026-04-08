import type { Scenario } from "@/types/stream";

export type SimulationSliderKey = "revenueGrowth" | "cogsRate" | "opexRate";

export interface SimulationSlider {
  key: SimulationSliderKey;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

export interface SimulationRow {
  metric: string;
  current: string;
  simulated: string;
  variance: string;
  positive: boolean;
}

export interface SimulationDriver {
  label: string;
  value: number;
  pct: number;
  color: string;
  prefix: string;
}

export interface SimulationSnapshot {
  sliders: SimulationSlider[];
  results: SimulationRow[];
  adjustedInputs: Record<string, number>;
  computedResults: Record<string, number>;
  drivers: SimulationDriver[];
}

const DEFAULT_BASE_INPUTS = {
  revenue: 10_000_000,
  cogs: 4_000_000,
  opex: 3_500_000,
  depreciation: 500_000,
  interest_expense: 300_000,
  tax_rate_pct: 25,
};

const DEFAULT_SLIDERS: SimulationSlider[] = [
  { key: "revenueGrowth", label: "Revenue Growth", value: 0, min: -30, max: 50, step: 0.5 },
  { key: "cogsRate", label: "COGS", value: 40, min: 0, max: 60, step: 0.5 },
  { key: "opexRate", label: "OpEx", value: 35, min: 0, max: 50, step: 0.5 },
];

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatMillions(value: number): string {
  return `$${(value / 1_000_000).toFixed(1)}M`;
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${round(value, 0)}`;
}

function getBaseInputs(scenario?: Scenario | null): Record<string, number> {
  return {
    ...DEFAULT_BASE_INPUTS,
    ...(scenario?.base_inputs ?? {}),
  };
}

function getRevenueGrowthPct(baseRevenue: number, adjustedRevenue: number): number {
  if (!baseRevenue) return 0;
  return ((adjustedRevenue - baseRevenue) / baseRevenue) * 100;
}

function buildScenarioValues(
  baseInputs: Record<string, number>,
  sliders: SimulationSlider[],
): Pick<SimulationSnapshot, "adjustedInputs" | "computedResults" | "results" | "drivers"> {
  const revenueGrowth = sliders.find((slider) => slider.key === "revenueGrowth")?.value ?? 0;
  const cogsRate = sliders.find((slider) => slider.key === "cogsRate")?.value ?? 40;
  const opexRate = sliders.find((slider) => slider.key === "opexRate")?.value ?? 35;

  const revenue = baseInputs.revenue * (1 + revenueGrowth / 100);
  const cogs = revenue * (cogsRate / 100);
  const opex = revenue * (opexRate / 100);
  const depreciation = baseInputs.depreciation ?? DEFAULT_BASE_INPUTS.depreciation;
  const interestExpense =
    baseInputs.interest_expense ?? DEFAULT_BASE_INPUTS.interest_expense;
  const taxRatePct = baseInputs.tax_rate_pct ?? DEFAULT_BASE_INPUTS.tax_rate_pct;

  const grossProfit = revenue - cogs;
  const ebitda = grossProfit - opex;
  const ebit = ebitda - depreciation;
  const preTaxIncome = ebit - interestExpense;
  const netIncome = preTaxIncome * (1 - taxRatePct / 100);
  const grossMarginPct = revenue === 0 ? 0 : (grossProfit / revenue) * 100;
  const ebitdaMarginPct = revenue === 0 ? 0 : (ebitda / revenue) * 100;
  const netMarginPct = revenue === 0 ? 0 : (netIncome / revenue) * 100;

  const baseGrossProfit = baseInputs.revenue - baseInputs.cogs;
  const baseEbitda = baseGrossProfit - baseInputs.opex;
  const baseEbit = baseEbitda - depreciation;
  const baseNetIncome = (baseEbit - interestExpense) * (1 - taxRatePct / 100);
  const baseGrossMarginPct = (baseGrossProfit / baseInputs.revenue) * 100;

  const adjustedInputs = {
    ...baseInputs,
    revenue: round(revenue, 2),
    cogs: round(cogs, 2),
    gross_profit: round(grossProfit, 2),
    opex: round(opex, 2),
    ebitda: round(ebitda, 2),
    ebit: round(ebit, 2),
    net_income: round(netIncome, 2),
    gross_margin_pct: round(grossMarginPct, 2),
    ebitda_margin_pct: round(ebitdaMarginPct, 2),
    net_margin_pct: round(netMarginPct, 2),
  };

  const computedResults = {
    revenue: round(revenue, 2),
    gross_profit: round(grossProfit, 2),
    ebitda: round(ebitda, 2),
    ebit: round(ebit, 2),
    net_income: round(netIncome, 2),
    gross_margin_pct: round(grossMarginPct, 2),
    ebitda_margin_pct: round(ebitdaMarginPct, 2),
    net_margin_pct: round(netMarginPct, 2),
    revenue_delta_pct: round(getRevenueGrowthPct(baseInputs.revenue, revenue), 2),
    net_income_delta_pct: round(
      baseNetIncome === 0 ? 0 : ((netIncome - baseNetIncome) / Math.abs(baseNetIncome)) * 100,
      2,
    ),
  };

  const results: SimulationRow[] = [
    {
      metric: "Revenue",
      current: formatMillions(baseInputs.revenue),
      simulated: formatMillions(revenue),
      variance: `${revenueGrowth >= 0 ? "+" : ""}${round(revenueGrowth, 1)}%`,
      positive: revenueGrowth >= 0,
    },
    {
      metric: "Margin",
      current: `${round(baseGrossMarginPct, 1)}%`,
      simulated: `${round(grossMarginPct, 1)}%`,
      variance: `${grossMarginPct - baseGrossMarginPct >= 0 ? "+" : ""}${round(grossMarginPct - baseGrossMarginPct, 1)}%`,
      positive: grossMarginPct >= baseGrossMarginPct,
    },
    {
      metric: "Income",
      current: formatMillions(baseNetIncome),
      simulated: formatMillions(netIncome),
      variance: `${netIncome - baseNetIncome >= 0 ? "+" : ""}${round(baseNetIncome === 0 ? 0 : ((netIncome - baseNetIncome) / Math.abs(baseNetIncome)) * 100, 0)}%`,
      positive: netIncome >= baseNetIncome,
    },
  ];

  const rawDrivers = [
    {
      label: "Revenue Growth",
      value: revenue - baseInputs.revenue,
    },
    {
      label: "COGS",
      value: baseInputs.cogs - cogs,
    },
    {
      label: "OpEx",
      value: baseInputs.opex - opex,
    },
  ];
  const maxAbs = Math.max(...rawDrivers.map((driver) => Math.abs(driver.value)), 1);
  const drivers = rawDrivers.map((driver) => ({
    label: driver.label,
    value: round(driver.value, 2),
    pct: round((Math.abs(driver.value) / maxAbs) * 100, 0),
    color: driver.value >= 0 ? "bg-blue-500" : "bg-red-500",
    prefix: driver.value >= 0 ? "+" : "",
  }));

  return { adjustedInputs, computedResults, results, drivers };
}

export function buildSimulationSnapshotFromSliders(
  sliders: SimulationSlider[],
  scenario?: Scenario | null,
): SimulationSnapshot {
  const baseInputs = getBaseInputs(scenario);
  const normalizedSliders = DEFAULT_SLIDERS.map((defaultSlider) => {
    const match = sliders.find((slider) => slider.key === defaultSlider.key);
    return {
      ...defaultSlider,
      value: match?.value ?? defaultSlider.value,
    };
  });
  const derived = buildScenarioValues(baseInputs, normalizedSliders);
  return {
    sliders: normalizedSliders,
    ...derived,
  };
}

export function getDefaultSimulationSnapshot(): SimulationSnapshot {
  const sliders = DEFAULT_SLIDERS.map((slider) => ({ ...slider }));
  return buildSimulationSnapshotFromSliders(sliders);
}

export function buildSimulationSnapshot(scenario?: Scenario | null): SimulationSnapshot {
  const baseInputs = getBaseInputs(scenario);
  const adjustedInputs = {
    ...baseInputs,
    ...(scenario?.adjusted_inputs ?? {}),
  };
  const adjustedRevenue = adjustedInputs.revenue ?? baseInputs.revenue;
  const cogsRate = adjustedRevenue === 0 ? 0 : ((adjustedInputs.cogs ?? baseInputs.cogs) / adjustedRevenue) * 100;
  const opexRate = adjustedRevenue === 0 ? 0 : ((adjustedInputs.opex ?? baseInputs.opex) / adjustedRevenue) * 100;
  const sliders = [
    {
      ...DEFAULT_SLIDERS[0],
      value: round(getRevenueGrowthPct(baseInputs.revenue, adjustedRevenue), 1),
    },
    {
      ...DEFAULT_SLIDERS[1],
      value: round(cogsRate, 1),
    },
    {
      ...DEFAULT_SLIDERS[2],
      value: round(opexRate, 1),
    },
  ];
  return buildSimulationSnapshotFromSliders(sliders, scenario);
}

export function formatSimulationDriverValue(value: number): string {
  return formatCompact(value);
}
