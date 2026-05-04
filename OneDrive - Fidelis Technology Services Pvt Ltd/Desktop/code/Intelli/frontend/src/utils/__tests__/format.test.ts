import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatPercent,
  formatDelta,
  formatPercentChange,
  formatCompact,
  sentimentColor,
  riskTierColor,
  concentrationColor,
} from '../format';

describe('formatCurrency', () => {
  it('formats millions compactly', () => {
    expect(formatCurrency(500)).toBe('$500.0M');
  });

  it('converts to billions when >= 1000M', () => {
    expect(formatCurrency(1500)).toBe('$1.5B');
  });

  it('handles negative values', () => {
    expect(formatCurrency(-250)).toBe('-$250.0M');
  });

  it('handles small values as K', () => {
    expect(formatCurrency(0.5)).toBe('$500K');
  });
});

describe('formatPercent', () => {
  it('converts decimal to percentage string', () => {
    expect(formatPercent(0.256)).toBe('25.6%');
  });

  it('handles zero', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('handles negative', () => {
    expect(formatPercent(-0.05)).toBe('-5.0%');
  });
});

describe('formatDelta', () => {
  it('positive delta is green with + prefix', () => {
    const result = formatDelta(50);
    expect(result.color).toBe('green');
    expect(result.text).toMatch(/^\+/);
  });

  it('negative delta is red', () => {
    const result = formatDelta(-30);
    expect(result.color).toBe('red');
  });

  it('zero delta is neutral', () => {
    const result = formatDelta(0);
    expect(result.color).toBe('neutral');
  });
});

describe('formatPercentChange', () => {
  it('positive shows up arrow', () => {
    expect(formatPercentChange(0.15)).toContain('▲');
    expect(formatPercentChange(0.15)).toContain('15.0%');
  });

  it('negative shows down arrow', () => {
    expect(formatPercentChange(-0.08)).toContain('▼');
    expect(formatPercentChange(-0.08)).toContain('8.0%');
  });
});

describe('formatCompact', () => {
  it('formats billions', () => {
    expect(formatCompact(2500000000)).toBe('2.5B');
  });

  it('formats millions', () => {
    expect(formatCompact(1500000)).toBe('1.5M');
  });

  it('formats thousands', () => {
    expect(formatCompact(42000)).toBe('42.0K');
  });
});

describe('color helpers', () => {
  it('sentimentColor returns appropriate classes', () => {
    expect(sentimentColor(0.5)).toContain('green');
    expect(sentimentColor(-0.5)).toContain('red');
    expect(sentimentColor(0)).toContain('gray');
  });

  it('riskTierColor returns appropriate classes', () => {
    expect(riskTierColor('low')).toContain('green');
    expect(riskTierColor('high')).toContain('red');
  });

  it('concentrationColor returns appropriate classes', () => {
    expect(concentrationColor('diversified')).toContain('green');
    expect(concentrationColor('concentrated')).toContain('red');
  });
});
