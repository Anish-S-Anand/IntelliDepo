/**
 * Test: Inter Font Configuration
 * 
 * Validates that the Inter font is properly configured in the Next.js application
 * according to Requirements 1.1, 1.2, 1.3
 */

import { describe, it, expect } from 'vitest';

describe('Inter Font Configuration', () => {
  it('should have Inter font imported and configured', () => {
    // This test verifies the font configuration exists in layout.tsx
    // The actual font loading is handled by Next.js at build time
    
    // Read the layout.tsx file content
    const fs = require('fs');
    const path = require('path');
    const layoutPath = path.join(__dirname, '..', 'layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
    
    // Verify Inter font is imported from next/font/google
    expect(layoutContent).toContain('import { Inter } from "next/font/google"');
    
    // Verify font configuration includes required properties
    expect(layoutContent).toContain('subsets: ["latin"]');
    expect(layoutContent).toContain('display: "swap"');
    expect(layoutContent).toContain('variable: "--font-inter"');
    
    // Verify font weights include the required range
    expect(layoutContent).toContain('weight:');
    expect(layoutContent).toMatch(/weight:\s*\[.*"500".*\]/); // Body text weight
    expect(layoutContent).toMatch(/weight:\s*\[.*"600".*\]/); // Label weight
    expect(layoutContent).toMatch(/weight:\s*\[.*"700".*\]/); // Button weight
    expect(layoutContent).toMatch(/weight:\s*\[.*"800".*\]/); // Heading weight
  });

  it('should apply Inter font to html element via CSS variable', () => {
    const fs = require('fs');
    const path = require('path');
    const layoutPath = path.join(__dirname, '..', 'layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
    
    // Verify the font variable is applied to the html element
    expect(layoutContent).toContain('className={inter.variable}');
  });

  it('should apply Inter font to body element with antialiasing', () => {
    const fs = require('fs');
    const path = require('path');
    const layoutPath = path.join(__dirname, '..', 'layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
    
    // Verify the font className is applied to body
    expect(layoutContent).toContain('className={`${inter.className} antialiased`}');
  });

  it('should define font-family CSS variable in globals.css', () => {
    const fs = require('fs');
    const path = require('path');
    const globalsPath = path.join(__dirname, '..', 'globals.css');
    const globalsContent = fs.readFileSync(globalsPath, 'utf-8');
    
    // Verify font-family variable includes Inter and fallbacks
    expect(globalsContent).toContain('--font-family:');
    expect(globalsContent).toContain('Inter');
    expect(globalsContent).toContain('Arial');
    expect(globalsContent).toContain('Helvetica');
    expect(globalsContent).toContain('sans-serif');
  });

  it('should apply font-family variable to body element', () => {
    const fs = require('fs');
    const path = require('path');
    const globalsPath = path.join(__dirname, '..', 'globals.css');
    const globalsContent = fs.readFileSync(globalsPath, 'utf-8');
    
    // Verify body uses the font-family variable
    expect(globalsContent).toMatch(/body\s*{[^}]*font-family:\s*var\(--font-family\)/s);
  });

  it('should configure font-display: swap for performance', () => {
    const fs = require('fs');
    const path = require('path');
    const layoutPath = path.join(__dirname, '..', 'layout.tsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
    
    // Verify font-display swap is configured
    expect(layoutContent).toContain('display: "swap"');
  });

  it('should apply -webkit-font-smoothing: antialiased', () => {
    const fs = require('fs');
    const path = require('path');
    const globalsPath = path.join(__dirname, '..', 'globals.css');
    const globalsContent = fs.readFileSync(globalsPath, 'utf-8');
    
    // Verify antialiasing is applied
    expect(globalsContent).toContain('-webkit-font-smoothing: antialiased');
  });
});
