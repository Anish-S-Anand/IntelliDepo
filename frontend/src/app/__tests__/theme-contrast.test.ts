/**
 * Theme Contrast Ratio Tests
 * 
 * Validates that all theme colors meet WCAG AA contrast requirements:
 * - Normal text (< 18px): 4.5:1 minimum
 * - Large text (≥ 18px): 3:1 minimum
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 1.11, 1.12
 */

import { describe, test, expect } from 'vitest';

describe('Theme Contrast Ratios - WCAG AA Compliance', () => {
  /**
   * Calculate relative luminance of an RGB color
   * Formula from WCAG 2.1: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
   */
  function getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      const val = c / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Calculate contrast ratio between two colors
   * Formula from WCAG 2.1: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
   */
  function getContrastRatio(hex1: string, hex2: string): number {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    
    const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Convert hex color to RGB
   */
  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) throw new Error(`Invalid hex color: ${hex}`);
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }

  describe('Light Theme Contrast Ratios', () => {
    const lightTheme = {
      bgPage: '#F0F4FA',
      bgSurface: '#FFFFFF',
      textPrimary: '#0D1117',
      textSecondary: '#1F2937',
      textMuted: '#4B5563',
      borderDefault: '#E5E7EB',
      borderStrong: '#D1D5DB',
      accent: '#E5521A',
    };

    test('Primary text on page background meets WCAG AA (4.5:1)', () => {
      const ratio = getContrastRatio(lightTheme.textPrimary, lightTheme.bgPage);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Light: textPrimary on bgPage = ${ratio.toFixed(2)}:1`);
    });

    test('Primary text on surface background meets WCAG AA (4.5:1)', () => {
      const ratio = getContrastRatio(lightTheme.textPrimary, lightTheme.bgSurface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Light: textPrimary on bgSurface = ${ratio.toFixed(2)}:1`);
    });

    test('Secondary text on page background meets WCAG AA (4.5:1)', () => {
      const ratio = getContrastRatio(lightTheme.textSecondary, lightTheme.bgPage);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Light: textSecondary on bgPage = ${ratio.toFixed(2)}:1`);
    });

    test('Secondary text on surface background meets WCAG AA (4.5:1)', () => {
      const ratio = getContrastRatio(lightTheme.textSecondary, lightTheme.bgSurface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Light: textSecondary on bgSurface = ${ratio.toFixed(2)}:1`);
    });

    test('Muted text on page background meets WCAG AA (4.5:1)', () => {
      const ratio = getContrastRatio(lightTheme.textMuted, lightTheme.bgPage);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Light: textMuted on bgPage = ${ratio.toFixed(2)}:1`);
    });

    test('Muted text on surface background meets WCAG AA (4.5:1)', () => {
      const ratio = getContrastRatio(lightTheme.textMuted, lightTheme.bgSurface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Light: textMuted on bgSurface = ${ratio.toFixed(2)}:1`);
    });

    test('Accent color on white background meets WCAG AA for large text (3:1)', () => {
      const ratio = getContrastRatio(lightTheme.accent, lightTheme.bgSurface);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
      console.log(`Light: accent on bgSurface = ${ratio.toFixed(2)}:1`);
    });
  });

  describe('Dark Theme Contrast Ratios', () => {
    const darkTheme = {
      bgPage: '#080E1C',
      bgSurface: '#0D1526',
      textPrimary: '#FFFFFF',
      textSecondary: '#E2E8F8',
      textMuted: '#A0B0D0',
      borderDefault: '#1E2F50',
      borderStrong: '#2A3F68',
      accent: '#E5521A',
    };

    test('Primary text on page background meets WCAG AA (4.5:1)', () => {
      const ratio = getContrastRatio(darkTheme.textPrimary, darkTheme.bgPage);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Dark: textPrimary on bgPage = ${ratio.toFixed(2)}:1`);
    });

    test('Primary text on surface background meets WCAG AA (4.5:1)', () => {
      const ratio = getContrastRatio(darkTheme.textPrimary, darkTheme.bgSurface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Dark: textPrimary on bgSurface = ${ratio.toFixed(2)}:1`);
    });

    test('Secondary text on page background meets WCAG AA (4.5:1)', () => {
      const ratio = getContrastRatio(darkTheme.textSecondary, darkTheme.bgPage);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Dark: textSecondary on bgPage = ${ratio.toFixed(2)}:1`);
    });

    test('Secondary text on surface background meets WCAG AA (4.5:1)', () => {
      const ratio = getContrastRatio(darkTheme.textSecondary, darkTheme.bgSurface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Dark: textSecondary on bgSurface = ${ratio.toFixed(2)}:1`);
    });

    test('Muted text on page background meets WCAG AA (4.5:1)', () => {
      const ratio = getContrastRatio(darkTheme.textMuted, darkTheme.bgPage);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Dark: textMuted on bgPage = ${ratio.toFixed(2)}:1`);
    });

    test('Muted text on surface background meets WCAG AA (4.5:1)', () => {
      const ratio = getContrastRatio(darkTheme.textMuted, darkTheme.bgSurface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
      console.log(`Dark: textMuted on bgSurface = ${ratio.toFixed(2)}:1`);
    });

    test('Accent color on dark background meets WCAG AA for large text (3:1)', () => {
      const ratio = getContrastRatio(darkTheme.accent, darkTheme.bgSurface);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
      console.log(`Dark: accent on bgSurface = ${ratio.toFixed(2)}:1`);
    });
  });

  describe('Border Visibility', () => {
    const lightTheme = {
      bgSurface: '#FFFFFF',
      borderDefault: '#E5E7EB',
      borderStrong: '#D1D5DB',
    };

    const darkTheme = {
      bgSurface: '#0D1526',
      borderDefault: '#1E2F50',
      borderStrong: '#2A3F68',
    };

    test('Light theme default border is visible against surface (1.2:1 minimum)', () => {
      const ratio = getContrastRatio(lightTheme.borderDefault, lightTheme.bgSurface);
      expect(ratio).toBeGreaterThanOrEqual(1.2);
      console.log(`Light: borderDefault on bgSurface = ${ratio.toFixed(2)}:1`);
    });

    test('Light theme strong border is visible against surface (1.4:1 minimum)', () => {
      const ratio = getContrastRatio(lightTheme.borderStrong, lightTheme.bgSurface);
      expect(ratio).toBeGreaterThanOrEqual(1.4);
      console.log(`Light: borderStrong on bgSurface = ${ratio.toFixed(2)}:1`);
    });

    test('Dark theme default border is visible against surface (1.2:1 minimum)', () => {
      const ratio = getContrastRatio(darkTheme.borderDefault, darkTheme.bgSurface);
      expect(ratio).toBeGreaterThanOrEqual(1.2);
      console.log(`Dark: borderDefault on bgSurface = ${ratio.toFixed(2)}:1`);
    });

    test('Dark theme strong border is visible against surface (1.5:1 minimum)', () => {
      const ratio = getContrastRatio(darkTheme.borderStrong, darkTheme.bgSurface);
      expect(ratio).toBeGreaterThanOrEqual(1.5);
      console.log(`Dark: borderStrong on bgSurface = ${ratio.toFixed(2)}:1`);
    });
  });
});
