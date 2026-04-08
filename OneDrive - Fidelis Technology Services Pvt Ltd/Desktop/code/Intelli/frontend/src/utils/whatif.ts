/**
 * Intelli Stream — What-if Financial Model
 *
 * Pure functions for computing adjusted income statements from slider inputs.
 * Used by STR-WIF (What-if Simulations) and STR-ISM (Impact Sensitivity Mapping).
 */
import type {
  FinancialMargins,
  FinancialModel,
  IncomeStatement,
  ScenarioDelta,
  ScenarioResult,
  ScenarioVariable,
} from '@/types/financial';

// ── Income Statement Computation ────────────────────────

/**
 * Compute a full income statement from input drivers.
 * Derived fields are calculated, not stored.
 */
export function computeIncomeStatement(inputs: {
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  depreciation: number;
  interestExpense: number;
  taxRate: number;
}): IncomeStatement {
  const { revenue, cogs, operatingExpenses, depreciation, interestExpense, taxRate } = inputs;

  const grossProfit = revenue - cogs;
  const ebitda = grossProfit - operatingExpenses;
  const ebit = ebitda - depreciation;
  const ebt = ebit - interestExpense;
  const taxes = Math.max(0, ebt * taxRate);
  const netIncome = ebt - taxes;

  return {
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    ebitda,
    depreciation,
    ebit,
    interestExpense,
    taxRate,
    taxes,
    netIncome,
  };
}

/**
 * Compute margin percentages from an income statement.
 */
export function computeMargins(stmt: IncomeStatement): FinancialMargins {
  const rev = stmt.revenue || 1; // avoid division by zero
  return {
    grossMargin: stmt.grossProfit / rev,
    ebitdaMargin: stmt.ebitda / rev,
    ebitMargin: stmt.ebit / rev,
    netMargin: stmt.netIncome / rev,
  };
}

/**
 * Build a complete FinancialModel from input drivers.
 */
export function buildFinancialModel(inputs: {
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  depreciation: number;
  interestExpense: number;
  taxRate: number;
}): FinancialModel {
  const stmt = computeIncomeStatement(inputs);
  return { ...stmt, margins: computeMargins(stmt) };
}

// ── Default Base Model ──────────────────────────────────

/** Hardcoded base financial model for demo (values in $M). */
export const DEFAULT_BASE_INPUTS = {
  revenue: 1000,
  cogs: 400,
  operatingExpenses: 250,
  depreciation: 50,
  interestExpense: 30,
  taxRate: 0.25,
} as const;

export function getDefaultBaseModel(): FinancialModel {
  return buildFinancialModel(DEFAULT_BASE_INPUTS);
}

// ── Scenario Variables ──────────────────────────────────

/**
 * Create the default set of adjustable scenario variables.
 */
export function createDefaultVariables(): ScenarioVariable[] {
  const base = getDefaultBaseModel();
  return [
    {
      key: 'revenue',
      label: 'Revenue',
      baseValue: base.revenue,
      adjustedValue: base.revenue,
      changePct: 0,
      min: -0.5,
      max: 0.5,
      step: 0.01,
      format: 'currency',
    },
    {
      key: 'cogs',
      label: 'COGS',
      baseValue: base.cogs,
      adjustedValue: base.cogs,
      changePct: 0,
      min: -0.5,
      max: 0.5,
      step: 0.01,
      format: 'currency',
    },
    {
      key: 'operatingExpenses',
      label: 'Operating Expenses',
      baseValue: base.operatingExpenses,
      adjustedValue: base.operatingExpenses,
      changePct: 0,
      min: -0.5,
      max: 0.5,
      step: 0.01,
      format: 'currency',
    },
    {
      key: 'depreciation',
      label: 'D&A',
      baseValue: base.depreciation,
      adjustedValue: base.depreciation,
      changePct: 0,
      min: -0.5,
      max: 0.5,
      step: 0.01,
      format: 'currency',
    },
    {
      key: 'interestExpense',
      label: 'Interest Expense',
      baseValue: base.interestExpense,
      adjustedValue: base.interestExpense,
      changePct: 0,
      min: -0.5,
      max: 0.5,
      step: 0.01,
      format: 'currency',
    },
    {
      key: 'taxRate',
      label: 'Tax Rate',
      baseValue: base.taxRate,
      adjustedValue: base.taxRate,
      changePct: 0,
      min: -0.5,
      max: 0.5,
      step: 0.01,
      format: 'percent',
    },
  ];
}

// ── Scenario Computation ────────────────────────────────

/**
 * Apply percentage adjustments to input drivers and recompute the model.
 */
export function applyAdjustments(
  baseInputs: typeof DEFAULT_BASE_INPUTS,
  adjustments: Record<string, number>,
): FinancialModel {
  const adjusted = { ...baseInputs };
  for (const [key, pctChange] of Object.entries(adjustments)) {
    if (key in adjusted) {
      (adjusted as Record<string, number>)[key] =
        (baseInputs as Record<string, number>)[key] * (1 + pctChange);
    }
  }
  return buildFinancialModel(adjusted);
}

/**
 * Compute the full scenario result: base model, adjusted model, and deltas.
 */
export function computeScenario(
  baseInputs: typeof DEFAULT_BASE_INPUTS,
  adjustments: Record<string, number>,
): ScenarioResult {
  const base = buildFinancialModel(baseInputs);
  const adjusted = applyAdjustments(baseInputs, adjustments);

  const deltaFields: Array<{ field: keyof FinancialModel; label: string }> = [
    { field: 'revenue', label: 'Revenue' },
    { field: 'grossProfit', label: 'Gross Profit' },
    { field: 'ebitda', label: 'EBITDA' },
    { field: 'ebit', label: 'EBIT' },
    { field: 'netIncome', label: 'Net Income' },
  ];

  const deltas: ScenarioDelta[] = deltaFields.map(({ field, label }) => {
    const baseVal = base[field] as number;
    const newVal = adjusted[field] as number;
    return {
      field,
      label,
      baseValue: baseVal,
      newValue: newVal,
      absoluteChange: newVal - baseVal,
      percentChange: baseVal !== 0 ? (newVal - baseVal) / Math.abs(baseVal) : 0,
    };
  });

  return { base, adjusted, deltas };
}
