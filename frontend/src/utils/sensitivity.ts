/**
 * Intelli Stream — Sensitivity Analysis Math
 *
 * Computes driver impact rankings and tornado chart data.
 * Used by STR-ISM (Impact Sensitivity Mapping) feature.
 */
import type {
  SensitivityDriver,
  SensitivityResult,
  TornadoBar,
} from '@/types/financial';
import { buildFinancialModel, type DEFAULT_BASE_INPUTS } from './whatif';

type BaseInputs = typeof DEFAULT_BASE_INPUTS;
type MetricKey = 'revenue' | 'grossProfit' | 'ebitda' | 'ebit' | 'netIncome';

// ── Driver Definitions ──────────────────────────────────

interface DriverDef {
  key: string;
  label: string;
  inputKey: keyof BaseInputs;
}

const DRIVERS: DriverDef[] = [
  { key: 'revenue', label: 'Revenue', inputKey: 'revenue' },
  { key: 'cogs', label: 'COGS', inputKey: 'cogs' },
  { key: 'opex', label: 'Operating Expenses', inputKey: 'operatingExpenses' },
  { key: 'depreciation', label: 'Depreciation & Amortization', inputKey: 'depreciation' },
  { key: 'interest', label: 'Interest Expense', inputKey: 'interestExpense' },
  { key: 'taxRate', label: 'Tax Rate', inputKey: 'taxRate' },
];

const METRIC_LABELS: Record<MetricKey, string> = {
  revenue: 'Revenue',
  grossProfit: 'Gross Profit',
  ebitda: 'EBITDA',
  ebit: 'EBIT',
  netIncome: 'Net Income',
};

// ── Core Sensitivity Computation ────────────────────────

/**
 * For each driver, perturb by ±swingPct and measure impact on targetMetric.
 *
 * @param baseInputs  - The base financial model inputs
 * @param targetMetric - Which output metric to measure sensitivity against
 * @param swingPct    - How much to swing each driver (e.g. 0.10 = ±10%)
 * @returns Sorted drivers by absolute impact (most impactful first) + tornado data
 */
export function computeSensitivity(
  baseInputs: BaseInputs,
  targetMetric: MetricKey = 'netIncome',
  swingPct: number = 0.10,
): SensitivityResult {
  const baseModel = buildFinancialModel(baseInputs);
  const baseValue = baseModel[targetMetric] as number;

  const drivers: SensitivityDriver[] = [];
  const tornado: TornadoBar[] = [];

  for (const driver of DRIVERS) {
    // Swing UP
    const upInputs = { ...baseInputs };
    (upInputs as Record<string, number>)[driver.inputKey] =
      (baseInputs as Record<string, number>)[driver.inputKey] * (1 + swingPct);
    const upModel = buildFinancialModel(upInputs);
    const upValue = upModel[targetMetric] as number;

    // Swing DOWN
    const downInputs = { ...baseInputs };
    (downInputs as Record<string, number>)[driver.inputKey] =
      (baseInputs as Record<string, number>)[driver.inputKey] * (1 - swingPct);
    const downModel = buildFinancialModel(downInputs);
    const downValue = downModel[targetMetric] as number;

    // Impact per 1% change
    const impactPerPercent = (upValue - downValue) / (2 * swingPct * 100);
    const absoluteImpact = Math.abs(upValue - downValue);

    // Direction: does increasing this driver increase the target metric?
    const direction: 'positive' | 'negative' = upValue >= downValue ? 'positive' : 'negative';

    drivers.push({
      key: driver.key,
      label: driver.label,
      impactPerPercent: round(impactPerPercent, 2),
      absoluteImpact: round(absoluteImpact, 2),
      direction,
    });

    // Tornado bar: low end = value when driver moves in unfavorable direction
    const lowValue = Math.min(upValue, downValue);
    const highValue = Math.max(upValue, downValue);
    const pctStr = `${(swingPct * 100).toFixed(0)}%`;

    tornado.push({
      driver: driver.key,
      label: driver.label,
      lowValue: round(lowValue, 2),
      highValue: round(highValue, 2),
      baseValue: round(baseValue, 2),
      lowLabel: `-${pctStr}`,
      highLabel: `+${pctStr}`,
    });
  }

  // Sort by absolute impact descending
  drivers.sort((a, b) => b.absoluteImpact - a.absoluteImpact);
  tornado.sort(
    (a, b) => (b.highValue - b.lowValue) - (a.highValue - a.lowValue),
  );

  return {
    targetMetric,
    targetLabel: METRIC_LABELS[targetMetric],
    baseValue: round(baseValue, 2),
    drivers,
    tornado,
  };
}

/**
 * Compute sensitivity for multiple target metrics at once.
 */
export function computeMultiMetricSensitivity(
  baseInputs: BaseInputs,
  metrics: MetricKey[] = ['netIncome', 'ebitda', 'grossProfit'],
  swingPct: number = 0.10,
): Record<MetricKey, SensitivityResult> {
  const results = {} as Record<MetricKey, SensitivityResult>;
  for (const metric of metrics) {
    results[metric] = computeSensitivity(baseInputs, metric, swingPct);
  }
  return results;
}

/**
 * Find threshold: at what % change does a driver push the target below a threshold?
 */
export function findBreakpoint(
  baseInputs: BaseInputs,
  driverKey: keyof BaseInputs,
  targetMetric: MetricKey,
  threshold: number,
  maxSwing: number = 0.5,
  precision: number = 0.001,
): number | null {
  const baseModel = buildFinancialModel(baseInputs);
  const baseValue = baseModel[targetMetric] as number;

  if (baseValue <= threshold) return 0;

  // Binary search for the breakpoint
  let lo = 0;
  let hi = maxSwing;

  // Check if breakpoint exists within range
  const testInputs = { ...baseInputs };
  (testInputs as Record<string, number>)[driverKey] =
    (baseInputs as Record<string, number>)[driverKey] * (1 + maxSwing);
  const edgeModel = buildFinancialModel(testInputs);
  const edgeValue = edgeModel[targetMetric] as number;

  // Try negative direction too
  const testInputsNeg = { ...baseInputs };
  (testInputsNeg as Record<string, number>)[driverKey] =
    (baseInputs as Record<string, number>)[driverKey] * (1 - maxSwing);
  const edgeModelNeg = buildFinancialModel(testInputsNeg);
  const edgeValueNeg = edgeModelNeg[targetMetric] as number;

  const useNegative = edgeValueNeg < threshold;
  const usePositive = edgeValue < threshold;

  if (!useNegative && !usePositive) return null;

  const sign = useNegative ? -1 : 1;

  while (hi - lo > precision) {
    const mid = (lo + hi) / 2;
    const midInputs = { ...baseInputs };
    (midInputs as Record<string, number>)[driverKey] =
      (baseInputs as Record<string, number>)[driverKey] * (1 + sign * mid);
    const midModel = buildFinancialModel(midInputs);
    const midValue = midModel[targetMetric] as number;

    if (midValue <= threshold) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  return round(sign * (lo + hi) / 2, 4);
}

// ── Helpers ─────────────────────────────────────────────

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
