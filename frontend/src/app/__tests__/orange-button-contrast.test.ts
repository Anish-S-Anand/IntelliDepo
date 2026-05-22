/**
 * Orange Button Accessibility - Contrast Ratio Tests
 * 
 * Validates that the updated CSS custom properties for orange colors
 * meet WCAG AA contrast ratio requirements (≥4.5:1 for normal text, ≥3.0:1 for large text)
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 */

import { describe, it, expect } from 'vitest';

/**
 * Calculate relative luminance of a color
 * Formula from WCAG 2.0: https://www.w3.org/TR/WCAG20/#relativeluminancedef
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
 * Formula from WCAG 2.0: (L1 + 0.05) / (L2 + 0.05)
 * where L1 is the lighter color and L2 is the darker color
 */
function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
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
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGBA to RGB by blending with background
 */
function rgbaToRgb(
  r: number,
  g: number,
  b: number,
  a: number,
  bgR: number,
  bgG: number,
  bgB: number
): { r: number; g: number; b: number } {
  return {
    r: Math.round((1 - a) * bgR + a * r),
    g: Math.round((1 - a) * bgG + a * g),
    b: Math.round((1 - a) * bgB + a * b),
  };
}

/**
 * Calculate contrast ratio for RGBA color on a background
 */
function getContrastRatioRGBA(
  fgHex: string,
  fgAlpha: number,
  bgHex: string,
  textHex: string
): number {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  
  // Blend foreground with background
  const blended = rgbaToRgb(fg.r, fg.g, fg.b, fgAlpha, bg.r, bg.g, bg.b);
  const blendedHex = `#${blended.r.toString(16).padStart(2, '0')}${blended.g.toString(16).padStart(2, '0')}${blended.b.toString(16).padStart(2, '0')}`;
  
  return getContrastRatio(blendedHex, textHex);
}

describe('Orange Button Contrast - Light Theme', () => {
  const LIGHT_THEME_ACCENT = '#C74416';
  const LIGHT_THEME_ACCENT_HOVER = '#B83E12';
  const LIGHT_THEME_ACCENT_TEXT = '#B83E12';
  const WHITE_TEXT = '#FFFFFF';
  const LIGHT_BG = '#F0F4FA';
  
  const WCAG_AA_NORMAL = 4.5;
  const WCAG_AA_LARGE = 3.0;

  it('should meet WCAG AA for --accent button background with white text (≥4.5:1)', () => {
    const ratio = getContrastRatio(LIGHT_THEME_ACCENT, WHITE_TEXT);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    console.log(`Light theme --accent (#C74416) with white text: ${ratio.toFixed(2)}:1`);
  });

  it('should meet WCAG AA for --accent-hover button background with white text (≥4.5:1)', () => {
    const ratio = getContrastRatio(LIGHT_THEME_ACCENT_HOVER, WHITE_TEXT);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    console.log(`Light theme --accent-hover (#B83E12) with white text: ${ratio.toFixed(2)}:1`);
  });

  it('should meet WCAG AA for --accent-button-bg with white text (≥4.5:1)', () => {
    const ratio = getContrastRatio(LIGHT_THEME_ACCENT, WHITE_TEXT);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    console.log(`Light theme --accent-button-bg (#C74416) with white text: ${ratio.toFixed(2)}:1`);
  });

  it('should meet WCAG AA for --accent-text on light background (≥4.5:1)', () => {
    const ratio = getContrastRatio(LIGHT_THEME_ACCENT_TEXT, LIGHT_BG);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    console.log(`Light theme --accent-text (#B83E12) on light bg: ${ratio.toFixed(2)}:1`);
  });

  it('should meet WCAG AA for --accent-subtle-bg (10% opacity) with orange text', () => {
    // rgba(199,68,22,0.10) on #F0F4FA background with #B83E12 text
    const ratio = getContrastRatioRGBA('#C74416', 0.10, LIGHT_BG, LIGHT_THEME_ACCENT_TEXT);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    console.log(`Light theme --accent-subtle-bg with orange text: ${ratio.toFixed(2)}:1`);
  });

  it('should have better contrast than original #E5521A', () => {
    const originalRatio = getContrastRatio('#E5521A', WHITE_TEXT);
    const newRatio = getContrastRatio(LIGHT_THEME_ACCENT, WHITE_TEXT);
    expect(newRatio).toBeGreaterThan(originalRatio);
    console.log(`Original #E5521A: ${originalRatio.toFixed(2)}:1, New #C74416: ${newRatio.toFixed(2)}:1`);
  });
});

describe('Orange Button Contrast - Dark Theme', () => {
  const DARK_THEME_ACCENT = '#F06030';
  const DARK_THEME_ACCENT_HOVER = '#FF7A42';
  const DARK_THEME_ACCENT_TEXT = '#FF7A42';
  const WHITE_TEXT = '#FFFFFF';
  const DARK_BG = '#080e1c';
  const DARK_SURFACE = '#0D1526';
  
  const WCAG_AA_NORMAL = 4.5;
  const WCAG_AA_LARGE = 3.0;

  it('should meet WCAG AA for --accent button background with white text (≥4.5:1)', () => {
    const ratio = getContrastRatio(DARK_THEME_ACCENT, WHITE_TEXT);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    console.log(`Dark theme --accent (#F06030) with white text: ${ratio.toFixed(2)}:1`);
  });

  it('should meet WCAG AA for --accent-hover button background with white text (≥4.5:1)', () => {
    const ratio = getContrastRatio(DARK_THEME_ACCENT_HOVER, WHITE_TEXT);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    console.log(`Dark theme --accent-hover (#FF7A42) with white text: ${ratio.toFixed(2)}:1`);
  });

  it('should meet WCAG AA for --accent-button-bg with white text (≥4.5:1)', () => {
    const ratio = getContrastRatio(DARK_THEME_ACCENT, WHITE_TEXT);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    console.log(`Dark theme --accent-button-bg (#F06030) with white text: ${ratio.toFixed(2)}:1`);
  });

  it('should meet WCAG AA for --accent-text on dark background (≥4.5:1)', () => {
    const ratio = getContrastRatio(DARK_THEME_ACCENT_TEXT, DARK_BG);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    console.log(`Dark theme --accent-text (#FF7A42) on dark bg: ${ratio.toFixed(2)}:1`);
  });

  it('should meet WCAG AA for --accent on dark surface background (≥4.5:1)', () => {
    const ratio = getContrastRatio(DARK_THEME_ACCENT, DARK_SURFACE);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    console.log(`Dark theme --accent (#F06030) on dark surface: ${ratio.toFixed(2)}:1`);
  });

  it('should meet WCAG AA for --accent-subtle-bg (12% opacity) with orange text', () => {
    // rgba(240,96,48,0.12) on #0D1526 background with #FF7A42 text
    const ratio = getContrastRatioRGBA('#F06030', 0.12, DARK_SURFACE, DARK_THEME_ACCENT_TEXT);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    console.log(`Dark theme --accent-subtle-bg with orange text: ${ratio.toFixed(2)}:1`);
  });

  it('should be distinguishable from dark background', () => {
    const ratio = getContrastRatio(DARK_THEME_ACCENT, DARK_BG);
    // Should have strong contrast with dark background
    expect(ratio).toBeGreaterThan(8.0);
    console.log(`Dark theme --accent (#F06030) vs dark bg: ${ratio.toFixed(2)}:1`);
  });
});

describe('Orange Button Contrast - Large Text (≥18pt or ≥14pt bold)', () => {
  const LIGHT_THEME_ACCENT = '#C74416';
  const DARK_THEME_ACCENT = '#F06030';
  const WHITE_TEXT = '#FFFFFF';
  
  const WCAG_AA_LARGE = 3.0;

  it('should meet WCAG AA large text for light theme (≥3.0:1)', () => {
    const ratio = getContrastRatio(LIGHT_THEME_ACCENT, WHITE_TEXT);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    console.log(`Light theme large text: ${ratio.toFixed(2)}:1`);
  });

  it('should meet WCAG AA large text for dark theme (≥3.0:1)', () => {
    const ratio = getContrastRatio(DARK_THEME_ACCENT, WHITE_TEXT);
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    console.log(`Dark theme large text: ${ratio.toFixed(2)}:1`);
  });
});

describe('Orange Button Contrast - Edge Cases', () => {
  const LIGHT_THEME_ACCENT = '#C74416';
  const DARK_THEME_ACCENT = '#F06030';
  const WHITE_TEXT = '#FFFFFF';
  
  const WCAG_AA_NORMAL = 4.5;

  it('should maintain contrast with disabled state (50% opacity)', () => {
    // Disabled buttons typically use 50% opacity
    const lightRatio = getContrastRatioRGBA(LIGHT_THEME_ACCENT, 0.5, '#F0F4FA', WHITE_TEXT);
    const darkRatio = getContrastRatioRGBA(DARK_THEME_ACCENT, 0.5, '#080e1c', WHITE_TEXT);
    
    // Disabled buttons should still meet WCAG AA large text (3.0:1)
    expect(lightRatio).toBeGreaterThanOrEqual(3.0);
    expect(darkRatio).toBeGreaterThanOrEqual(3.0);
    
    console.log(`Disabled light theme: ${lightRatio.toFixed(2)}:1`);
    console.log(`Disabled dark theme: ${darkRatio.toFixed(2)}:1`);
  });

  it('should verify gradient endpoints meet contrast requirements', () => {
    // Original gradient: linear-gradient(135deg, #E5521A, #FF7A42)
    // New gradient should use CSS variables, but verify both endpoints
    const startRatio = getContrastRatio(LIGHT_THEME_ACCENT, WHITE_TEXT);
    const endRatio = getContrastRatio('#FF7A42', WHITE_TEXT);
    
    expect(startRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    expect(endRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    
    console.log(`Gradient start (#C74416): ${startRatio.toFixed(2)}:1`);
    console.log(`Gradient end (#FF7A42): ${endRatio.toFixed(2)}:1`);
  });
});

describe('Color Vision Deficiency (CVD) Simulation', () => {
  it('should document CVD testing requirements', () => {
    // This test documents the manual testing requirements for CVD
    // Automated CVD testing requires specialized libraries or browser extensions
    
    const cvdTestingNotes = {
      protanopia: 'Red-blind - Test with Color Oracle or Coblis simulator',
      deuteranopia: 'Green-blind - Test with Color Oracle or Coblis simulator',
      tritanopia: 'Blue-blind - Test with Color Oracle or Coblis simulator',
      tools: [
        'Color Oracle (desktop app)',
        'Coblis (web-based)',
        'Chrome DevTools Vision Deficiency Emulator',
      ],
      requirements: [
        'Orange buttons should be distinguishable from gray/neutral buttons',
        'Orange buttons should be distinguishable from dark backgrounds',
        'Orange buttons should maintain visual hierarchy',
      ],
    };
    
    expect(cvdTestingNotes).toBeDefined();
    console.log('CVD Testing Requirements:', JSON.stringify(cvdTestingNotes, null, 2));
  });

  it('should verify luminance difference for CVD users', () => {
    const LIGHT_THEME_ACCENT = '#C74416';
    const DARK_THEME_ACCENT = '#F06030';
    const LIGHT_BG = '#F0F4FA';
    const DARK_BG = '#080e1c';
    
    // Calculate luminance values
    const lightAccentRgb = hexToRgb(LIGHT_THEME_ACCENT);
    const darkAccentRgb = hexToRgb(DARK_THEME_ACCENT);
    const lightBgRgb = hexToRgb(LIGHT_BG);
    const darkBgRgb = hexToRgb(DARK_BG);
    
    const lightAccentLum = getLuminance(lightAccentRgb.r, lightAccentRgb.g, lightAccentRgb.b);
    const darkAccentLum = getLuminance(darkAccentRgb.r, darkAccentRgb.g, darkAccentRgb.b);
    const lightBgLum = getLuminance(lightBgRgb.r, lightBgRgb.g, lightBgRgb.b);
    const darkBgLum = getLuminance(darkBgRgb.r, darkBgRgb.g, darkBgRgb.b);
    
    // Verify significant luminance difference (helps with CVD)
    expect(Math.abs(lightAccentLum - lightBgLum)).toBeGreaterThan(0.3);
    expect(Math.abs(darkAccentLum - darkBgLum)).toBeGreaterThan(0.3);
    
    console.log(`Light accent luminance: ${lightAccentLum.toFixed(3)}`);
    console.log(`Light bg luminance: ${lightBgLum.toFixed(3)}`);
    console.log(`Dark accent luminance: ${darkAccentLum.toFixed(3)}`);
    console.log(`Dark bg luminance: ${darkBgLum.toFixed(3)}`);
  });
});
