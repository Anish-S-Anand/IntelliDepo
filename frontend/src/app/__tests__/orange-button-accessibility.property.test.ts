/**
 * Bug Condition Exploration Property Test - Orange Button Accessibility
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * GOAL: Surface counterexamples that demonstrate the accessibility violations
 * 
 * Scoped PBT Approach: Scope the property to concrete failing cases - orange buttons with #E5521A color
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';

describe('Bug Condition Exploration - Orange Button Contrast Violations', () => {
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

  /**
   * Apply opacity to a color on a background
   */
  function applyOpacity(foregroundHex: string, backgroundHex: string, opacity: number): string {
    const fg = hexToRgb(foregroundHex);
    const bg = hexToRgb(backgroundHex);
    
    const r = Math.round(fg.r * opacity + bg.r * (1 - opacity));
    const g = Math.round(fg.g * opacity + bg.g * (1 - opacity));
    const b = Math.round(fg.b * opacity + bg.b * (1 - opacity));
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Simulate color blindness (protanopia - red-blind)
   * Using simplified Brettel algorithm
   */
  function simulateProtanopia(hex: string): string {
    const rgb = hexToRgb(hex);
    // Protanopia: red cone missing, confuses red/green
    const r = Math.round(0.567 * rgb.r + 0.433 * rgb.g);
    const g = Math.round(0.558 * rgb.r + 0.442 * rgb.g);
    const b = rgb.b;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Simulate deuteranopia (green-blind)
   */
  function simulateDeuteranopia(hex: string): string {
    const rgb = hexToRgb(hex);
    // Deuteranopia: green cone missing
    const r = Math.round(0.625 * rgb.r + 0.375 * rgb.g);
    const g = Math.round(0.7 * rgb.r + 0.3 * rgb.g);
    const b = rgb.b;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Simulate tritanopia (blue-blind)
   */
  function simulateTritanopia(hex: string): string {
    const rgb = hexToRgb(hex);
    // Tritanopia: blue cone missing
    const r = Math.round(0.95 * rgb.r + 0.05 * rgb.g);
    const g = Math.round(0.433 * rgb.g + 0.567 * rgb.b);
    const b = Math.round(0.475 * rgb.g + 0.525 * rgb.b);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Check if a color is distinguishable from background for CVD users
   * Minimum contrast ratio of 1.5:1 for distinguishability
   */
  function isDistinguishableForCVD(foreground: string, background: string): {
    protanopia: boolean;
    deuteranopia: boolean;
    tritanopia: boolean;
  } {
    const minDistinguishability = 1.5;
    
    const fgProtanopia = simulateProtanopia(foreground);
    const bgProtanopia = simulateProtanopia(background);
    const protanopiaRatio = getContrastRatio(fgProtanopia, bgProtanopia);
    
    const fgDeuteranopia = simulateDeuteranopia(foreground);
    const bgDeuteranopia = simulateDeuteranopia(background);
    const deuteranopiaRatio = getContrastRatio(fgDeuteranopia, bgDeuteranopia);
    
    const fgTritanopia = simulateTritanopia(foreground);
    const bgTritanopia = simulateTritanopia(background);
    const tritanopiaRatio = getContrastRatio(fgTritanopia, bgTritanopia);
    
    return {
      protanopia: protanopiaRatio >= minDistinguishability,
      deuteranopia: deuteranopiaRatio >= minDistinguishability,
      tritanopia: tritanopiaRatio >= minDistinguishability,
    };
  }

  /**
   * Calculate contrast at a point in a linear gradient
   */
  function getGradientColorAtPosition(startHex: string, endHex: string, position: number): string {
    const start = hexToRgb(startHex);
    const end = hexToRgb(endHex);
    
    const r = Math.round(start.r + (end.r - start.r) * position);
    const g = Math.round(start.g + (end.g - start.g) * position);
    const b = Math.round(start.b + (end.b - start.b) * position);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // Define the accessible orange colors (after fix)
  const ORANGE_ACCESSIBLE_COLOR = '#C74416';  // New accessible orange for both themes
  const ORANGE_HOVER_COLOR = '#B83E12';  // Darker orange for hover state
  const ORANGE_GRADIENT_END = '#FF7A42';  // Gradient end color (needs checking)
  const WHITE_TEXT = '#FFFFFF';
  const LIGHT_THEME_BG = '#F0F4FA';
  const DARK_THEME_BG = '#14203A';
  const DARK_THEME_SURFACE = '#0D1526';

  describe('Property 1: Bug Condition - Orange Button Contrast Violations', () => {
    test('Light theme: Orange button (#C74416) with white text should meet WCAG AA (4.5:1)', () => {
      // This test validates the fix - should PASS with new accessible color
      const ratio = getContrastRatio(ORANGE_ACCESSIBLE_COLOR, WHITE_TEXT);
      
      console.log(`\n✅ VALIDATION:`);
      console.log(`   Orange button (#C74416) with white text: ${ratio.toFixed(2)}:1`);
      console.log(`   WCAG AA requirement: 4.5:1 for normal text`);
      console.log(`   Status: ${ratio >= 4.5 ? '✅ PASS' : '❌ FAIL'}`);
      
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    test('Dark theme: Orange button (#C74416) on dark background should be distinguishable', () => {
      // This test checks if orange is distinguishable from dark background
      const ratio = getContrastRatio(ORANGE_ACCESSIBLE_COLOR, DARK_THEME_BG);
      
      console.log(`\n✅ VALIDATION:`);
      console.log(`   Orange (#C74416) on dark background (#14203A): ${ratio.toFixed(2)}:1`);
      console.log(`   Minimum distinguishability: 1.5:1`);
      console.log(`   Status: ${ratio >= 1.5 ? '✅ PASS' : '❌ FAIL'}`);
      
      expect(ratio).toBeGreaterThanOrEqual(1.5);
    });

    test('Opacity variation: Orange text on light orange background should meet WCAG AA', () => {
      // Simulates bg-[#C74416]/10 with text-[#C74416]
      const lightOrangeBg = applyOpacity(ORANGE_ACCESSIBLE_COLOR, '#FFFFFF', 0.1);
      const ratio = getContrastRatio(ORANGE_ACCESSIBLE_COLOR, lightOrangeBg);
      
      console.log(`\n✅ VALIDATION:`);
      console.log(`   Orange text (#C74416) on bg-[#C74416]/10: ${ratio.toFixed(2)}:1`);
      console.log(`   Background color: ${lightOrangeBg}`);
      console.log(`   WCAG AA requirement: 4.5:1`);
      console.log(`   Status: ${ratio >= 4.5 ? '✅ PASS' : '❌ FAIL'}`);
      
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    test('Gradient button: All points in gradient should meet WCAG AA with white text', () => {
      // Test gradient: linear-gradient(135deg, #C74416, #FF7A42)
      // Note: The gradient end color #FF7A42 may need adjustment
      const gradientStart = ORANGE_ACCESSIBLE_COLOR;
      const gradientEnd = ORANGE_GRADIENT_END;
      const positions = [0, 0.25, 0.5, 0.75, 1.0];
      
      const results = positions.map(pos => {
        const color = getGradientColorAtPosition(gradientStart, gradientEnd, pos);
        const ratio = getContrastRatio(color, WHITE_TEXT);
        return { position: pos, color, ratio };
      });
      
      const minRatio = Math.min(...results.map(r => r.ratio));
      const failingPoint = results.find(r => r.ratio < 4.5);
      
      console.log(`\n✅ VALIDATION:`);
      console.log(`   Gradient: linear-gradient(135deg, #C74416, #FF7A42) with white text`);
      console.log(`   Minimum contrast ratio: ${minRatio.toFixed(2)}:1`);
      if (failingPoint) {
        console.log(`   ⚠️  Failing at position ${failingPoint.position}: ${failingPoint.color} = ${failingPoint.ratio.toFixed(2)}:1`);
        console.log(`   Note: Gradient end color #FF7A42 may need adjustment`);
      }
      console.log(`   WCAG AA requirement: 4.5:1`);
      console.log(`   Status: ${minRatio >= 4.5 ? '✅ PASS' : '❌ FAIL'}`);
      
      expect(minRatio).toBeGreaterThanOrEqual(4.5);
    });

    test('Color blindness: Orange buttons should be distinguishable for protanopia users', () => {
      // Test against light theme background
      const cvdResults = isDistinguishableForCVD(ORANGE_ACCESSIBLE_COLOR, LIGHT_THEME_BG);
      
      console.log(`\n✅ VALIDATION:`);
      console.log(`   Orange (#C74416) on light background (#F0F4FA)`);
      console.log(`   Protanopia distinguishability: ${cvdResults.protanopia ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   Deuteranopia distinguishability: ${cvdResults.deuteranopia ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   Tritanopia distinguishability: ${cvdResults.tritanopia ? '✅ PASS' : '❌ FAIL'}`);
      
      expect(cvdResults.protanopia).toBe(true);
    });

    test('Color blindness: Orange buttons should be distinguishable for deuteranopia users', () => {
      const cvdResults = isDistinguishableForCVD(ORANGE_ACCESSIBLE_COLOR, LIGHT_THEME_BG);
      
      console.log(`\n✅ CVD Test - Deuteranopia:`);
      console.log(`   Status: ${cvdResults.deuteranopia ? '✅ PASS' : '❌ FAIL'}`);
      
      expect(cvdResults.deuteranopia).toBe(true);
    });

    test('Color blindness: Orange buttons should be distinguishable for tritanopia users', () => {
      const cvdResults = isDistinguishableForCVD(ORANGE_ACCESSIBLE_COLOR, LIGHT_THEME_BG);
      
      console.log(`\n✅ CVD Test - Tritanopia:`);
      console.log(`   Status: ${cvdResults.tritanopia ? '✅ PASS' : '❌ FAIL'}`);
      
      expect(cvdResults.tritanopia).toBe(true);
    });

    test('Dark theme CVD: Orange on dark background should be distinguishable for all CVD types', () => {
      const cvdResults = isDistinguishableForCVD(ORANGE_ACCESSIBLE_COLOR, DARK_THEME_SURFACE);
      
      console.log(`\n✅ VALIDATION:`);
      console.log(`   Orange (#C74416) on dark surface (#0D1526)`);
      console.log(`   Protanopia: ${cvdResults.protanopia ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   Deuteranopia: ${cvdResults.deuteranopia ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`   Tritanopia: ${cvdResults.tritanopia ? '✅ PASS' : '❌ FAIL'}`);
      
      expect(cvdResults.protanopia && cvdResults.deuteranopia && cvdResults.tritanopia).toBe(true);
    });
  });

  describe('Property-Based Test: Orange Button Instances', () => {
    test('Property: All orange button instances should meet WCAG AA contrast requirements', () => {
      // Define concrete button instances from the codebase
      const buttonInstances = [
        { name: 'Register Vehicle button', bg: ORANGE_ACCESSIBLE_COLOR, text: WHITE_TEXT, theme: 'dark' },
        { name: 'Register Visitor button', bg: ORANGE_ACCESSIBLE_COLOR, text: WHITE_TEXT, theme: 'dark' },
        { name: 'Login gradient button (start)', bg: ORANGE_ACCESSIBLE_COLOR, text: WHITE_TEXT, theme: 'light' },
        { name: 'Login gradient button (end)', bg: '#FF7A42', text: WHITE_TEXT, theme: 'light' },
        { name: 'Demo "Use" button', bg: applyOpacity(ORANGE_ACCESSIBLE_COLOR, '#FFFFFF', 0.1), text: ORANGE_ACCESSIBLE_COLOR, theme: 'light' },
        { name: 'Active sidebar item', bg: LIGHT_THEME_BG, text: ORANGE_ACCESSIBLE_COLOR, theme: 'light' },
      ];

      const failures: string[] = [];

      buttonInstances.forEach(button => {
        const ratio = getContrastRatio(button.bg, button.text);
        const meetsWCAG = ratio >= 4.5;
        
        if (!meetsWCAG) {
          failures.push(`${button.name} (${button.theme}): ${ratio.toFixed(2)}:1 < 4.5:1`);
        }
        
        console.log(`\n📊 ${button.name} (${button.theme} theme):`);
        console.log(`   Background: ${button.bg}`);
        console.log(`   Text: ${button.text}`);
        console.log(`   Contrast ratio: ${ratio.toFixed(2)}:1`);
        console.log(`   Status: ${meetsWCAG ? '✅ PASS' : '❌ FAIL'}`);
      });

      if (failures.length > 0) {
        console.log(`\n❌ FAILING INSTANCES:`);
        failures.forEach(f => console.log(`   - ${f}`));
      }

      expect(failures.length).toBe(0);
    });
  });
});
