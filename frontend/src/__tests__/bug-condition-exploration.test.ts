/**
 * Bug Condition Exploration Test
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * **Property 1: Bug Condition** - useSearchParams Without Suspense Boundary
 * 
 * **CRITICAL**: This test was designed to FAIL on unfixed code to confirm the bug exists.
 * However, it PASSES because the code has already been fixed (Task 4 ran before Task 1).
 * 
 * **EXPECTED OUTCOME ON UNFIXED CODE**: Test FAILS with prerender errors
 * **ACTUAL OUTCOME ON FIXED CODE**: Test PASSES - all components wrapped in Suspense
 * 
 * This test verifies that:
 * 1. `npm run build` completes successfully without prerender errors
 * 2. All pages using `useSearchParams()` are statically generated
 * 3. No error messages about "useSearchParams() should be wrapped in a suspense boundary"
 * 4. Build output shows ✓ for all affected pages
 * 
 * **Components Tested**:
 * - NavigationEvents (affects all pages via root layout)
 * - SettingsPage (/depot/settings)
 * - HeatmapPage (/depot/heatmap)
 * - IncidentsPage (/depot/incidents)
 * - AnalysisSection (affects operations pages)
 */

import { execSync } from 'child_process';
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Bug Condition Exploration: useSearchParams Without Suspense', () => {
  it('should build successfully when all useSearchParams components are wrapped in Suspense', () => {
    /**
     * **NOTE**: This test PASSES on the current (fixed) code.
     * 
     * On UNFIXED code, this test would FAIL with:
     * - Error: "useSearchParams() should be wrapped in a suspense boundary at page"
     * - Build fails with prerender errors
     * - Multiple pages cannot be statically generated
     * 
     * On FIXED code (current state), this test PASSES with:
     * - Build completes successfully
     * - All 57 pages are statically generated
     * - No prerender errors
     */
    
    const frontendRoot = path.resolve(__dirname, '../..');
    
    try {
      // Run the build command
      const buildOutput = execSync('npm run build', {
        cwd: frontendRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 300000, // 5 minutes
      });

      // Verify build succeeded
      expect(buildOutput).toContain('Compiled successfully');
      expect(buildOutput).toContain('Generating static pages');
      expect(buildOutput).not.toContain('Error:');
      expect(buildOutput).not.toContain('useSearchParams() should be wrapped in a suspense boundary');
      
      // Verify specific affected pages were successfully built
      const affectedPages = [
        '/depot/settings',
        '/depot/heatmap',
        '/depot/incidents',
        '/depot/operations',
      ];
      
      // All pages should show success indicator (○ for static)
      affectedPages.forEach(page => {
        const pageRegex = new RegExp(`○.*${page.replace(/\//g, '\\/')}`, 'i');
        expect(buildOutput).toMatch(pageRegex);
      });
      
      // Verify no page shows error indicator (✗)
      expect(buildOutput).not.toContain('✗');
      
      // Document the test result
      console.log('✅ BUILD SUCCEEDED - All components properly wrapped in Suspense');
      console.log('📊 This test PASSES because the bug has been FIXED');
      console.log('🔍 All affected components (NavigationEvents, SettingsPage, HeatmapPage, IncidentsPage, AnalysisSection) are wrapped in Suspense boundaries');
      console.log('✓ NavigationEvents: Wrapped in Suspense with fallback={null}');
      console.log('✓ SettingsPage: Wrapped in Suspense with SettingsPageSkeleton');
      console.log('✓ HeatmapPage: Wrapped in Suspense with HeatmapPageSkeleton');
      console.log('✓ IncidentsPage: Wrapped in Suspense with IncidentsPageSkeleton');
      console.log('✓ AnalysisSection: Wrapped in Suspense with AnalysisSectionSkeleton');
      
    } catch (error: any) {
      // If build fails, this would be the expected behavior on unfixed code
      const errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;
      
      // Check if it's the expected prerender error
      if (errorOutput.includes('useSearchParams() should be wrapped in a suspense boundary')) {
        console.log('❌ BUILD FAILED - Bug condition detected (expected on unfixed code)');
        console.log('🐛 Error: useSearchParams() used without Suspense boundary');
        console.log('📍 Affected components need Suspense wrapping');
        
        // Extract specific error details
        const errorLines = errorOutput.split('\n').filter((line: string) => 
          line.includes('useSearchParams') || line.includes('Error:') || line.includes('at page')
        );
        console.log('Error details:', errorLines.join('\n'));
        
        // This is the expected failure on unfixed code
        // But since code is already fixed, this branch won't execute
        throw new Error('Build failed with prerender errors - bug condition exists');
      } else {
        // Unexpected error
        throw error;
      }
    }
  }, 360000); // 6 minute timeout for build

  it('should verify all affected components have Suspense boundaries in source code', () => {
    /**
     * Secondary verification: Check that the source code actually contains Suspense wrappers
     * This provides additional confirmation that the fix is in place
     */
    
    const componentsToCheck = [
      {
        path: path.resolve(__dirname, '../../src/components/layout/NavigationEvents.tsx'),
        name: 'NavigationEvents',
        expectedPatterns: [
          /<Suspense fallback=\{null\}>/,
          /NavigationEventsContent/,
        ],
      },
      {
        path: path.resolve(__dirname, '../../src/app/depot/settings/page.tsx'),
        name: 'SettingsPage',
        expectedPatterns: [
          /<Suspense fallback=\{<SettingsPageSkeleton \/>\}>/,
          /SettingsPageContent/,
        ],
      },
      {
        path: path.resolve(__dirname, '../../src/components/depot/operations/HeatmapPage.tsx'),
        name: 'HeatmapPage',
        expectedPatterns: [
          /<Suspense fallback=\{<HeatmapPageSkeleton \/>\}>/,
          /HeatmapPageContent/,
        ],
      },
      {
        path: path.resolve(__dirname, '../../src/components/depot/operations/IncidentsPage.tsx'),
        name: 'IncidentsPage',
        expectedPatterns: [
          /<Suspense fallback=\{<IncidentsPageSkeleton \/>\}>/,
          /IncidentsPageContent/,
        ],
      },
      {
        path: path.resolve(__dirname, '../../src/components/depot/operations/AnalysisSection.tsx'),
        name: 'AnalysisSection',
        expectedPatterns: [
          /<Suspense fallback=\{<AnalysisSectionSkeleton \/>\}>/,
          /AnalysisSectionContent/,
        ],
      },
    ];

    componentsToCheck.forEach(({ path: filePath, name, expectedPatterns }) => {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Component file not found: ${filePath}`);
      }

      const sourceCode = fs.readFileSync(filePath, 'utf-8');

      // Verify Suspense import
      expect(sourceCode).toContain('import { Suspense');

      // Verify expected patterns exist
      expectedPatterns.forEach(pattern => {
        expect(sourceCode).toMatch(pattern);
      });

      // Verify the component structure:
      // 1. Main export should return Suspense wrapper
      // 2. useSearchParams should be in the Content component, not the main export
      
      // Check that there's a Content component (pattern: *Content)
      const contentComponentPattern = new RegExp(`${name}Content|\\w+Content`);
      expect(sourceCode).toMatch(contentComponentPattern);
      
      // Verify useSearchParams is called inside a Content component
      const contentFunctionMatch = sourceCode.match(/function\s+\w+Content\s*\(/);
      if (contentFunctionMatch) {
        const contentStart = contentFunctionMatch.index!;
        const nextFunctionOrEnd = sourceCode.indexOf('\nfunction ', contentStart + 1);
        const contentCode = sourceCode.substring(
          contentStart,
          nextFunctionOrEnd > 0 ? nextFunctionOrEnd : sourceCode.length
        );
        
        // Content component should use useSearchParams
        expect(contentCode).toContain('useSearchParams');
      }

      console.log(`✓ ${name}: Suspense boundary verified in source code`);
    });

    console.log('✅ All components have proper Suspense boundaries in source code');
  });
});
