import { describe, it, expect } from 'vitest';
import {
  computeIncomeStatement,
  computeMargins,
  buildFinancialModel,
  getDefaultBaseModel,
  applyAdjustments,
  computeScenario,
  createDefaultVariables,
  DEFAULT_BASE_INPUTS,
} from '../whatif';

describe('computeIncomeStatement', () => {
  it('computes derived fields correctly', () => {
    const stmt = computeIncomeStatement({
      revenue: 1000,
      cogs: 400,
      operatingExpenses: 250,
      depreciation: 50,
      interestExpense: 30,
      taxRate: 0.25,
    });
    expect(stmt.grossProfit).toBe(600);
    expect(stmt.ebitda).toBe(350);
    expect(stmt.ebit).toBe(300);
    expect(stmt.taxes).toBe((300 - 30) * 0.25);
    expect(stmt.netIncome).toBe(270 - 67.5);
  });

  it('handles zero revenue', () => {
    const stmt = computeIncomeStatement({
      revenue: 0, cogs: 0, operatingExpenses: 0,
      depreciation: 0, interestExpense: 0, taxRate: 0.25,
    });
    expect(stmt.netIncome).toBe(0);
    expect(stmt.taxes).toBe(0);
  });

  it('taxes are zero when EBT is negative', () => {
    const stmt = computeIncomeStatement({
      revenue: 100, cogs: 80, operatingExpenses: 50,
      depreciation: 10, interestExpense: 5, taxRate: 0.30,
    });
    expect(stmt.taxes).toBe(0);
    expect(stmt.netIncome).toBeLessThan(0);
  });
});

describe('computeMargins', () => {
  it('returns correct margin percentages', () => {
    const stmt = computeIncomeStatement({
      revenue: 1000, cogs: 400, operatingExpenses: 250,
      depreciation: 50, interestExpense: 30, taxRate: 0.25,
    });
    const margins = computeMargins(stmt);
    expect(margins.grossMargin).toBeCloseTo(0.6, 4);
    expect(margins.ebitdaMargin).toBeCloseTo(0.35, 4);
  });
});

describe('getDefaultBaseModel', () => {
  it('returns a complete model', () => {
    const model = getDefaultBaseModel();
    expect(model.revenue).toBe(1000);
    expect(model.margins.grossMargin).toBeGreaterThan(0);
    expect(model.margins.netMargin).toBeGreaterThan(0);
  });
});

describe('applyAdjustments', () => {
  it('applies percentage adjustments', () => {
    const adjusted = applyAdjustments(DEFAULT_BASE_INPUTS, { revenue: 0.10 });
    expect(adjusted.revenue).toBe(1100);
  });

  it('negative adjustments reduce values', () => {
    const adjusted = applyAdjustments(DEFAULT_BASE_INPUTS, { cogs: -0.20 });
    expect(adjusted.cogs).toBe(320);
    // Lower COGS → higher net income
    const base = buildFinancialModel(DEFAULT_BASE_INPUTS);
    expect(adjusted.netIncome).toBeGreaterThan(base.netIncome);
  });

  it('zero adjustment returns base model', () => {
    const adjusted = applyAdjustments(DEFAULT_BASE_INPUTS, {});
    const base = buildFinancialModel(DEFAULT_BASE_INPUTS);
    expect(adjusted.netIncome).toBeCloseTo(base.netIncome, 4);
  });
});

describe('computeScenario', () => {
  it('returns base, adjusted, and deltas', () => {
    const result = computeScenario(DEFAULT_BASE_INPUTS, { revenue: 0.15 });
    expect(result.base.revenue).toBe(1000);
    expect(result.adjusted.revenue).toBe(1150);
    expect(result.deltas.length).toBeGreaterThan(0);

    const revDelta = result.deltas.find(d => d.field === 'revenue');
    expect(revDelta?.absoluteChange).toBe(150);
    expect(revDelta?.percentChange).toBeCloseTo(0.15, 4);
  });

  it('net income delta reflects cascading impact', () => {
    const result = computeScenario(DEFAULT_BASE_INPUTS, { revenue: 0.10 });
    const niDelta = result.deltas.find(d => d.field === 'netIncome');
    // Revenue +10% should increase net income
    expect(niDelta?.absoluteChange).toBeGreaterThan(0);
  });
});

describe('createDefaultVariables', () => {
  it('creates variables for all input drivers', () => {
    const vars = createDefaultVariables();
    expect(vars.length).toBe(6);
    expect(vars.map(v => v.key)).toContain('revenue');
    expect(vars.map(v => v.key)).toContain('cogs');
    expect(vars.every(v => v.changePct === 0)).toBe(true);
  });
});
