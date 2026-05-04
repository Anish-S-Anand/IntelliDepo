import { describe, it, expect } from 'vitest';
import {
  computeHHI,
  classifyConcentration,
  computeConcentrationMetrics,
  buildRevenueSlices,
  computeRiskBreakdown,
} from '../concentration';
import type { ClientRevenue } from '@/types/financial';

const SAMPLE_CLIENTS: ClientRevenue[] = [
  { clientName: 'Acme', industry: 'Mfg', region: 'NA', annualRevenue: 4200, contractType: 'Enterprise', riskTier: 'low', relationshipYears: 8 },
  { clientName: 'Global', industry: 'Logistics', region: 'EU', annualRevenue: 3100, contractType: 'Enterprise', riskTier: 'low', relationshipYears: 5 },
  { clientName: 'NexGen', industry: 'Health', region: 'NA', annualRevenue: 2800, contractType: 'Enterprise', riskTier: 'medium', relationshipYears: 4 },
  { clientName: 'Swift', industry: 'Retail', region: 'NA', annualRevenue: 1800, contractType: 'Standard', riskTier: 'medium', relationshipYears: 2 },
  { clientName: 'Bright', industry: 'Edu', region: 'APAC', annualRevenue: 800, contractType: 'Standard', riskTier: 'high', relationshipYears: 1 },
];

describe('computeHHI', () => {
  it('returns 1.0 for a single client', () => {
    expect(computeHHI([1000])).toBeCloseTo(1.0, 4);
  });

  it('returns 1/N for equal revenue split', () => {
    const revenues = [100, 100, 100, 100]; // 4 equal clients
    expect(computeHHI(revenues)).toBeCloseTo(0.25, 4);
  });

  it('returns 0 for empty array', () => {
    expect(computeHHI([])).toBe(0);
  });

  it('higher concentration → higher HHI', () => {
    const equal = computeHHI([100, 100, 100, 100]);
    const skewed = computeHHI([700, 100, 100, 100]);
    expect(skewed).toBeGreaterThan(equal);
  });
});

describe('classifyConcentration', () => {
  it('classifies diversified', () => {
    expect(classifyConcentration(0.10)).toBe('diversified');
  });
  it('classifies moderate', () => {
    expect(classifyConcentration(0.20)).toBe('moderate');
  });
  it('classifies concentrated', () => {
    expect(classifyConcentration(0.30)).toBe('concentrated');
  });
});

describe('computeConcentrationMetrics', () => {
  it('computes metrics for sample clients', () => {
    const metrics = computeConcentrationMetrics(SAMPLE_CLIENTS);
    expect(metrics.totalRevenue).toBe(12700);
    expect(metrics.clientCount).toBe(5);
    expect(metrics.topClientShare).toBeGreaterThan(0);
    expect(metrics.top3Share).toBeGreaterThanOrEqual(metrics.topClientShare);
    expect(metrics.top5Share).toBeGreaterThanOrEqual(metrics.top3Share);
    expect(metrics.herfindahlIndex).toBeGreaterThan(0);
    expect(metrics.herfindahlIndex).toBeLessThan(1);
  });

  it('returns zero metrics for empty array', () => {
    const metrics = computeConcentrationMetrics([]);
    expect(metrics.totalRevenue).toBe(0);
    expect(metrics.herfindahlIndex).toBe(0);
    expect(metrics.concentrationLevel).toBe('diversified');
  });
});

describe('buildRevenueSlices', () => {
  it('returns sorted slices with cumulative shares', () => {
    const slices = buildRevenueSlices(SAMPLE_CLIENTS);
    expect(slices.length).toBe(5);
    // Sorted by revenue desc
    expect(slices[0].revenue).toBeGreaterThanOrEqual(slices[1].revenue);
    // Last cumulative share = 1.0
    expect(slices[slices.length - 1].cumulativeShare).toBeCloseTo(1.0, 3);
  });

  it('each share is correct fraction', () => {
    const slices = buildRevenueSlices(SAMPLE_CLIENTS);
    const total = SAMPLE_CLIENTS.reduce((s, c) => s + c.annualRevenue, 0);
    expect(slices[0].share).toBeCloseTo(4200 / total, 3);
  });
});

describe('computeRiskBreakdown', () => {
  it('groups clients by risk tier', () => {
    const breakdown = computeRiskBreakdown(SAMPLE_CLIENTS);
    expect(breakdown.low.count).toBe(2);
    expect(breakdown.medium.count).toBe(2);
    expect(breakdown.high.count).toBe(1);
    expect(breakdown.low.revenue).toBe(7300);
    const totalShare = breakdown.low.share + breakdown.medium.share + breakdown.high.share;
    expect(totalShare).toBeCloseTo(1.0, 3);
  });
});
