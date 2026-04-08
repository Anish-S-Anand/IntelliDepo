/**
 * Intelli Stream — Financial Formatting Utilities
 *
 * Display formatters for currency, percentages, deltas, and KPIs.
 */

/**
 * Format a number as currency (USD) with abbreviated suffix.
 * e.g. 1500 → "$1.5B" (if unit is 'M'), 1500 → "$1,500M"
 */
export function formatCurrency(
  value: number,
  options?: { decimals?: number; compact?: boolean; unit?: 'raw' | 'K' | 'M' | 'B' },
): string {
  const { decimals = 1, compact = true, unit = 'M' } = options ?? {};

  if (!compact) {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${unit !== 'raw' ? unit : ''}`;
  }

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (unit === 'M') {
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(decimals)}B`;
    if (abs >= 1) return `${sign}$${abs.toFixed(decimals)}M`;
    if (abs >= 0.001) return `${sign}$${(abs * 1000).toFixed(0)}K`;
    return `${sign}$0`;
  }

  if (unit === 'B') {
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(decimals)}T`;
    if (abs >= 1) return `${sign}$${abs.toFixed(decimals)}B`;
    return `${sign}$${(abs * 1000).toFixed(decimals)}M`;
  }

  return `${sign}$${abs.toLocaleString('en-US', { maximumFractionDigits: decimals })}`;
}

/**
 * Format a decimal as a percentage string.
 * e.g. 0.256 → "25.6%"
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a delta value with + or - prefix and color hint.
 */
export function formatDelta(
  value: number,
  format: 'currency' | 'percent' | 'number' = 'currency',
): { text: string; color: 'green' | 'red' | 'neutral' } {
  const color = value > 0 ? 'green' : value < 0 ? 'red' : 'neutral';
  const prefix = value > 0 ? '+' : '';

  let text: string;
  switch (format) {
    case 'currency':
      text = `${prefix}${formatCurrency(value)}`;
      break;
    case 'percent':
      text = `${prefix}${formatPercent(value)}`;
      break;
    default:
      text = `${prefix}${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}`;
  }

  return { text, color };
}

/**
 * Format a percent change with arrow indicator.
 * e.g. 0.15 → "▲ 15.0%", -0.08 → "▼ 8.0%"
 */
export function formatPercentChange(value: number, decimals: number = 1): string {
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '—';
  const abs = Math.abs(value * 100).toFixed(decimals);
  return `${arrow} ${abs}%`;
}

/**
 * Format a large number with K/M/B suffix.
 */
export function formatCompact(value: number, decimals: number = 1): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(decimals)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(decimals)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(decimals)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(decimals)}K`;
  return `${sign}${abs.toFixed(decimals)}`;
}

/**
 * Get a CSS-friendly color class for a sentiment score (-1 to 1).
 */
export function sentimentColor(score: number): string {
  if (score >= 0.3) return 'text-green-600';
  if (score >= 0.1) return 'text-green-400';
  if (score >= -0.1) return 'text-gray-500';
  if (score >= -0.3) return 'text-red-400';
  return 'text-red-600';
}

/**
 * Get a color class for a risk tier.
 */
export function riskTierColor(tier: 'low' | 'medium' | 'high'): string {
  switch (tier) {
    case 'low': return 'text-green-600 bg-green-50';
    case 'medium': return 'text-yellow-600 bg-yellow-50';
    case 'high': return 'text-red-600 bg-red-50';
  }
}

/**
 * Get a color class for HHI concentration level.
 */
export function concentrationColor(level: 'diversified' | 'moderate' | 'concentrated'): string {
  switch (level) {
    case 'diversified': return 'text-green-600';
    case 'moderate': return 'text-yellow-600';
    case 'concentrated': return 'text-red-600';
  }
}
