/**
 * Intelli Stream — Revenue Concentration Calculations
 *
 * Herfindahl-Hirschman Index (HHI), concentration metrics, and revenue slicing.
 * Used by STR-RC (Revenue Concentration) feature.
 */
import type {
  ClientRevenue,
  ConcentrationMetrics,
  RevenueSlice,
} from '@/types/financial';

// ── Herfindahl-Hirschman Index ──────────────────────────

/**
 * Compute the Herfindahl-Hirschman Index from revenue values.
 *
 * HHI = sum of squared market shares (each share as a fraction 0–1).
 *   - < 0.15  → diversified
 *   - 0.15–0.25 → moderate concentration
 *   - > 0.25  → concentrated
 *
 * For a perfectly equal split among N clients, HHI = 1/N.
 * For a single client with 100%, HHI = 1.0.
 */
export function computeHHI(revenues: number[]): number {
  const total = revenues.reduce((sum, r) => sum + r, 0);
  if (total <= 0) return 0;
  return revenues.reduce((hhi, r) => hhi + (r / total) ** 2, 0);
}

/**
 * Classify HHI into a human-readable concentration level.
 */
export function classifyConcentration(
  hhi: number,
): 'diversified' | 'moderate' | 'concentrated' {
  if (hhi < 0.15) return 'diversified';
  if (hhi <= 0.25) return 'moderate';
  return 'concentrated';
}

// ── Concentration Metrics ───────────────────────────────

/**
 * Compute full concentration metrics from a client portfolio.
 */
export function computeConcentrationMetrics(
  clients: ClientRevenue[],
): ConcentrationMetrics {
  if (clients.length === 0) {
    return {
      totalRevenue: 0,
      herfindahlIndex: 0,
      topClientShare: 0,
      top3Share: 0,
      top5Share: 0,
      clientCount: 0,
      concentrationLevel: 'diversified',
    };
  }

  const sorted = [...clients].sort((a, b) => b.annualRevenue - a.annualRevenue);
  const revenues = sorted.map((c) => c.annualRevenue);
  const totalRevenue = revenues.reduce((sum, r) => sum + r, 0);
  const hhi = computeHHI(revenues);

  const topN = (n: number) =>
    totalRevenue > 0
      ? revenues.slice(0, n).reduce((sum, r) => sum + r, 0) / totalRevenue
      : 0;

  return {
    totalRevenue,
    herfindahlIndex: round(hhi, 4),
    topClientShare: round(topN(1), 4),
    top3Share: round(topN(3), 4),
    top5Share: round(topN(5), 4),
    clientCount: clients.length,
    concentrationLevel: classifyConcentration(hhi),
  };
}

// ── Revenue Slices (for pie/donut charts) ───────────────

/**
 * Build revenue slices sorted by revenue descending, with cumulative shares.
 * Useful for donut/pie charts and the Lorenz curve.
 */
export function buildRevenueSlices(clients: ClientRevenue[]): RevenueSlice[] {
  const sorted = [...clients].sort((a, b) => b.annualRevenue - a.annualRevenue);
  const total = sorted.reduce((sum, c) => sum + c.annualRevenue, 0);
  if (total <= 0) return [];

  let cumulative = 0;
  return sorted.map((c) => {
    const share = c.annualRevenue / total;
    cumulative += share;
    return {
      clientName: c.clientName,
      revenue: c.annualRevenue,
      share: round(share, 4),
      cumulativeShare: round(cumulative, 4),
    };
  });
}

// ── Risk Breakdown ──────────────────────────────────────

/**
 * Group clients by risk tier and compute revenue share per tier.
 */
export function computeRiskBreakdown(
  clients: ClientRevenue[],
): Record<'low' | 'medium' | 'high', { count: number; revenue: number; share: number }> {
  const total = clients.reduce((sum, c) => sum + c.annualRevenue, 0);
  const tiers = { low: { count: 0, revenue: 0, share: 0 }, medium: { count: 0, revenue: 0, share: 0 }, high: { count: 0, revenue: 0, share: 0 } };

  for (const c of clients) {
    const tier = tiers[c.riskTier];
    if (tier) {
      tier.count++;
      tier.revenue += c.annualRevenue;
    }
  }

  for (const tier of Object.values(tiers)) {
    tier.share = total > 0 ? round(tier.revenue / total, 4) : 0;
  }

  return tiers;
}

// ── Helpers ─────────────────────────────────────────────

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
