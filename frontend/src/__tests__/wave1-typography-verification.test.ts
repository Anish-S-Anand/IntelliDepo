/**
 * Wave 1 Typography System Verification Tests
 * 
 * This test suite verifies that all Wave 1 tasks (1.2, 1.3, 1.4, 3.2) are properly implemented:
 * - Task 1.1: Inter font integration (verified in layout.tsx)
 * - Task 1.2: Base typography CSS variables
 * - Task 1.3: Heading size system (h1-h6)
 * - Task 1.4: Component-specific typography
 * - Task 3.2: ThemeProvider context component
 */

import fs from 'fs';
import path from 'path';

describe('Wave 1: Typography System Implementation', () => {
  let globalsCSS: string;

  beforeAll(() => {
    const cssPath = path.join(process.cwd(), 'src', 'app', 'globals.css');
    globalsCSS = fs.readFileSync(cssPath, 'utf-8');
  });

  describe('Task 1.2: Base Typography CSS Variables', () => {
    test('should define --font-family with Inter and fallbacks', () => {
      expect(globalsCSS).toMatch(/--font-family:.*Inter/);
      expect(globalsCSS).toMatch(/--font-family:.*Arial/);
      expect(globalsCSS).toMatch(/--font-family:.*Helvetica/);
    });

    test('should define --font-size-base as 16px', () => {
      expect(globalsCSS).toMatch(/--font-size-base:\s*16px/);
    });

    test('should define --line-height-base as 1.6', () => {
      expect(globalsCSS).toMatch(/--line-height-base:\s*1\.6/);
    });

    test('should define --line-height-heading as 1.2', () => {
      expect(globalsCSS).toMatch(/--line-height-heading:\s*1\.2/);
    });

    test('should define font weight variables', () => {
      expect(globalsCSS).toMatch(/--font-weight-body:\s*500/);
      expect(globalsCSS).toMatch(/--font-weight-label:\s*600/);
      expect(globalsCSS).toMatch(/--font-weight-button:\s*700/);
      expect(globalsCSS).toMatch(/--font-weight-heading:\s*800/);
    });

    test('should apply font-smoothing antialiased to body', () => {
      expect(globalsCSS).toMatch(/-webkit-font-smoothing:\s*antialiased/);
    });

    test('should set body font-weight to 500', () => {
      expect(globalsCSS).toMatch(/body\s*{[^}]*font-weight:\s*var\(--font-weight-body\)/s);
    });
  });

  describe('Task 1.3: Heading Size System (h1-h6)', () => {
    test('h1 should be 26px, 800 weight, -0.4px letter-spacing', () => {
      expect(globalsCSS).toMatch(/h1\s*{[^}]*font-size:\s*26px/s);
      expect(globalsCSS).toMatch(/h1\s*{[^}]*font-weight:\s*800/s);
      expect(globalsCSS).toMatch(/h1\s*{[^}]*letter-spacing:\s*-0\.4px/s);
    });

    test('h2 should be 22px, 800 weight, -0.3px letter-spacing', () => {
      expect(globalsCSS).toMatch(/h2\s*{[^}]*font-size:\s*22px/s);
      expect(globalsCSS).toMatch(/h2\s*{[^}]*font-weight:\s*800/s);
      expect(globalsCSS).toMatch(/h2\s*{[^}]*letter-spacing:\s*-0\.3px/s);
    });

    test('h3 should be 18px, 800 weight, -0.2px letter-spacing', () => {
      expect(globalsCSS).toMatch(/h3\s*{[^}]*font-size:\s*18px/s);
      expect(globalsCSS).toMatch(/h3\s*{[^}]*font-weight:\s*800/s);
      expect(globalsCSS).toMatch(/h3\s*{[^}]*letter-spacing:\s*-0\.2px/s);
    });

    test('h4 should be 16px, 800 weight, -0.1px letter-spacing', () => {
      expect(globalsCSS).toMatch(/h4\s*{[^}]*font-size:\s*16px/s);
      expect(globalsCSS).toMatch(/h4\s*{[^}]*font-weight:\s*800/s);
      expect(globalsCSS).toMatch(/h4\s*{[^}]*letter-spacing:\s*-0\.1px/s);
    });

    test('h5 should be 14px, 800 weight', () => {
      expect(globalsCSS).toMatch(/h5\s*{[^}]*font-size:\s*14px/s);
      expect(globalsCSS).toMatch(/h5\s*{[^}]*font-weight:\s*800/s);
    });

    test('h6 should be 13px, 800 weight', () => {
      expect(globalsCSS).toMatch(/h6\s*{[^}]*font-size:\s*13px/s);
      expect(globalsCSS).toMatch(/h6\s*{[^}]*font-weight:\s*800/s);
    });

    test('all headings should have line-height 1.2', () => {
      expect(globalsCSS).toMatch(/h1\s*{[^}]*line-height:\s*1\.2/s);
      expect(globalsCSS).toMatch(/h2\s*{[^}]*line-height:\s*1\.2/s);
      expect(globalsCSS).toMatch(/h3\s*{[^}]*line-height:\s*1\.2/s);
      expect(globalsCSS).toMatch(/h4\s*{[^}]*line-height:\s*1\.2/s);
      expect(globalsCSS).toMatch(/h5\s*{[^}]*line-height:\s*1\.2/s);
      expect(globalsCSS).toMatch(/h6\s*{[^}]*line-height:\s*1\.2/s);
    });
  });

  describe('Task 1.4: Component-Specific Typography', () => {
    test('buttons should be 16px (1rem), 700 weight', () => {
      expect(globalsCSS).toMatch(/button\s*{[^}]*font-size:\s*1rem/s);
      expect(globalsCSS).toMatch(/button\s*{[^}]*font-weight:\s*var\(--font-weight-button\)/s);
    });

    test('labels should be 15px (0.95rem), 600 weight', () => {
      expect(globalsCSS).toMatch(/label\s*{[^}]*font-size:\s*0\.95rem/s);
      expect(globalsCSS).toMatch(/label\s*{[^}]*font-weight:\s*var\(--font-weight-label\)/s);
    });

    test('inputs, selects, textareas should be 16px (1rem), 500 weight', () => {
      expect(globalsCSS).toMatch(/input,\s*select,\s*textarea\s*{[^}]*font-size:\s*1rem/s);
      expect(globalsCSS).toMatch(/input,\s*select,\s*textarea\s*{[^}]*font-weight:\s*var\(--font-weight-body\)/s);
    });

    test('table cells (td, th) should be 15px (0.95rem)', () => {
      expect(globalsCSS).toMatch(/td,\s*th\s*{[^}]*font-size:\s*0\.95rem/s);
    });
  });

  describe('Task 3.2: ThemeProvider Context Component', () => {
    test('ThemeProvider file should exist', () => {
      const themeProviderPath = path.join(
        process.cwd(),
        'src',
        'components',
        'layout',
        'ThemeProvider.tsx'
      );
      expect(fs.existsSync(themeProviderPath)).toBe(true);
    });

    test('ThemeProvider should export useTheme hook', () => {
      const themeProviderPath = path.join(
        process.cwd(),
        'src',
        'components',
        'layout',
        'ThemeProvider.tsx'
      );
      const content = fs.readFileSync(themeProviderPath, 'utf-8');
      expect(content).toMatch(/export function useTheme/);
    });

    test('ThemeProvider should implement theme state management', () => {
      const themeProviderPath = path.join(
        process.cwd(),
        'src',
        'components',
        'layout',
        'ThemeProvider.tsx'
      );
      const content = fs.readFileSync(themeProviderPath, 'utf-8');
      expect(content).toMatch(/toggleTheme/);
      expect(content).toMatch(/setTheme/);
      expect(content).toMatch(/localStorage/);
    });

    test('ThemeProvider should apply smooth transitions (0.25s ease)', () => {
      const themeProviderPath = path.join(
        process.cwd(),
        'src',
        'components',
        'layout',
        'ThemeProvider.tsx'
      );
      const content = fs.readFileSync(themeProviderPath, 'utf-8');
      expect(content).toMatch(/0\.25s ease/);
    });
  });

  describe('Integration: Inter Font in Layout', () => {
    test('layout.tsx should import and configure Inter font', () => {
      const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');
      expect(content).toMatch(/import.*Inter.*from.*next\/font\/google/);
      expect(content).toMatch(/const inter = Inter/);
      expect(content).toMatch(/variable:\s*"--font-inter"/);
    });

    test('layout.tsx should apply Inter font to html element', () => {
      const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');
      expect(content).toMatch(/className=.*inter\.variable/);
    });

    test('layout.tsx should include FOUC prevention script', () => {
      const layoutPath = path.join(process.cwd(), 'src', 'app', 'layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');
      expect(content).toMatch(/localStorage\.getItem\('intelli-theme'\)/);
      expect(content).toMatch(/dangerouslySetInnerHTML/);
    });
  });
});
