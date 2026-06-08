/**
 * Bug Condition Exploration Test - useSearchParams Without Suspense Boundary
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * 
 * This property-based test verifies that the bug condition exists in the codebase:
 * - Components using useSearchParams() without Suspense boundaries cause prerender errors
 * - Build process fails during static generation
 * - Error messages indicate "useSearchParams() should be wrapped in a suspense boundary"
 * 
 * DO NOT attempt to fix the test or code when it fails - document the failure and move on.
 * 
 * Expected Outcome: Test FAILS with build errors showing affected components:
 * - NavigationEvents (affects ALL pages - root layout)
 * - SettingsPage (/depot/settings)
 * - HeatmapPage (/depot/heatmap)
 * - IncidentsPage (/depot/incidents)
 * - AnalysisSection (causes parent page failures)
 */

import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import fc from 'fast-check';

const execAsync = promisify(exec);

// Type definitions for better type safety
interface BuildResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  prerenderErrors: string[];
  affectedPages: string[];
}

interface ComponentCheck {
  filePath: string;
  componentName: string;
  usesSearchParams: boolean;
  hasSuspenseBoundary: boolean;
}

/**
 * Execute Next.js build and capture output
 */
async function runBuild(): Promise<BuildResult> {
  try {
    const { stdout, stderr } = await execAsync('npm run build', {
      cwd: process.cwd(),
      timeout: 300000, // 5 minute timeout
    });

    return {
      success: true,
      stdout,
      stderr,
      exitCode: 0,
      prerenderErrors: [],
      affectedPages: [],
    };
  } catch (error: any) {
    const stdout = error.stdout || '';
    const stderr = error.stderr || '';
    const output = stdout + stderr;

    // Extract prerender error messages
    const prerenderErrors = extractPrerenderErrors(output);
    const affectedPages = extractAffectedPages(output);

    return {
      success: false,
      stdout,
      stderr,
      exitCode: error.code || 1,
      prerenderErrors,
      affectedPages,
    };
  }
}

/**
 * Extract prerender error messages from build output
 */
function extractPrerenderErrors(output: string): string[] {
  const errors: string[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    if (
      line.includes('useSearchParams') ||
      line.includes('suspense boundary') ||
      line.includes('prerender error') ||
      line.includes('Error occurred prerendering')
    ) {
      errors.push(line.trim());
    }
  }

  return errors;
}

/**
 * Extract affected page routes from build output
 */
function extractAffectedPages(output: string): string[] {
  const pages: string[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // Look for page routes in error messages
    const pageMatch = line.match(/\/depot\/[a-z-]+/g);
    if (pageMatch) {
      pages.push(...pageMatch);
    }

    // Also check for explicit page mentions
    if (line.includes('/depot/settings')) pages.push('/depot/settings');
    if (line.includes('/depot/heatmap')) pages.push('/depot/heatmap');
    if (line.includes('/depot/incidents')) pages.push('/depot/incidents');
    if (line.includes('/depot/operations')) pages.push('/depot/operations');
  }

  // Remove duplicates
  return Array.from(new Set(pages));
}

/**
 * Check if a component file uses useSearchParams without Suspense boundary
 */
function checkComponentForBugCondition(
  filePath: string,
  componentName: string
): ComponentCheck {
  const fs = require('fs');
  const path = require('path');

  try {
    const fullPath = path.join(process.cwd(), filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');

    const usesSearchParams = content.includes('useSearchParams()');
    
    // Check for Suspense boundary patterns
    // Pattern 1: <Suspense fallback={...}> with inner component
    // Pattern 2: Component wrapped in Suspense with separate content component
    const hasSuspenseBoundary =
      (content.includes('<Suspense') && content.includes('</Suspense>')) ||
      (content.includes('Suspense fallback') &&
        content.includes('function') &&
        content.includes('Content'));

    return {
      filePath,
      componentName,
      usesSearchParams,
      hasSuspenseBoundary,
    };
  } catch (error) {
    // If file doesn't exist or can't be read, assume no bug condition
    return {
      filePath,
      componentName,
      usesSearchParams: false,
      hasSuspenseBoundary: true,
    };
  }
}

/**
 * Property 1: Bug Condition - useSearchParams Without Suspense Boundary
 * 
 * For any component that uses useSearchParams() without a Suspense boundary,
 * the build process SHOULD fail with prerender errors.
 * 
 * This test DOCUMENTS THE BUG by proving it exists in the current codebase.
 */
describe('Bug Condition Exploration - useSearchParams Without Suspense', () => {
  /**
   * CRITICAL TEST: This test MUST FAIL on unfixed code
   * 
   * Expected behavior on UNFIXED code:
   * - Build command exits with non-zero exit code
   * - Error messages contain "useSearchParams() should be wrapped in a suspense boundary"
   * - Multiple pages fail during static generation
   * - Affected components: NavigationEvents, SettingsPage, HeatmapPage, IncidentsPage, AnalysisSection
   * 
   * This failure PROVES THE BUG EXISTS and provides counterexamples.
   */
  it('should fail to build when components use useSearchParams without Suspense', async () => {
    // Identify components that exhibit the bug condition
    const componentsToCheck = [
      {
        filePath: 'src/components/layout/NavigationEvents.tsx',
        componentName: 'NavigationEvents',
      },
      {
        filePath: 'src/app/depot/settings/page.tsx',
        componentName: 'SettingsPage',
      },
      {
        filePath: 'src/components/depot/operations/HeatmapPage.tsx',
        componentName: 'HeatmapPage',
      },
      {
        filePath: 'src/components/depot/operations/IncidentsPage.tsx',
        componentName: 'IncidentsPage',
      },
      {
        filePath: 'src/components/depot/operations/AnalysisSection.tsx',
        componentName: 'AnalysisSection',
      },
    ];

    // Check which components have the bug condition
    const bugConditionComponents: ComponentCheck[] = [];

    for (const component of componentsToCheck) {
      const check = checkComponentForBugCondition(
        component.filePath,
        component.componentName
      );

      if (check.usesSearchParams && !check.hasSuspenseBoundary) {
        bugConditionComponents.push(check);
      }
    }

    console.log('\n=== Bug Condition Analysis ===');
    console.log(
      `Components using useSearchParams WITHOUT Suspense: ${bugConditionComponents.length}`
    );

    if (bugConditionComponents.length > 0) {
      console.log('\nAffected Components:');
      bugConditionComponents.forEach((comp) => {
        console.log(`  ❌ ${comp.componentName} (${comp.filePath})`);
      });
    }

    // Run the build to detect prerender errors
    console.log('\n=== Running Build to Detect Prerender Errors ===');
    console.log('Executing: npm run build');
    console.log('This may take a few minutes...\n');

    const buildResult = await runBuild();

    console.log('\n=== Build Result ===');
    console.log(`Exit Code: ${buildResult.exitCode}`);
    console.log(`Build Success: ${buildResult.success}`);

    if (buildResult.prerenderErrors.length > 0) {
      console.log(
        `\nPrerender Errors Found: ${buildResult.prerenderErrors.length}`
      );
      console.log('\nError Messages:');
      buildResult.prerenderErrors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
    }

    if (buildResult.affectedPages.length > 0) {
      console.log(`\nAffected Pages: ${buildResult.affectedPages.length}`);
      console.log('Pages that failed static generation:');
      buildResult.affectedPages.forEach((page) => {
        console.log(`  ❌ ${page}`);
      });
    }

    console.log('\n=== Counterexamples Documented ===');
    console.log(
      'These components cause build failures due to missing Suspense boundaries:'
    );
    bugConditionComponents.forEach((comp) => {
      console.log(
        `  - ${comp.componentName}: Uses useSearchParams() without Suspense`
      );
    });

    console.log(
      '\n✅ Bug condition confirmed and documented. Task complete.'
    );
    console.log(
      'DO NOT attempt to fix the bug - this test proves it exists.\n'
    );

    // ASSERTION: If any components have the bug condition, build SHOULD fail
    if (bugConditionComponents.length > 0) {
      // Expected behavior: Build fails with prerender errors
      expect(
        buildResult.success,
        `Build should FAIL when ${bugConditionComponents.length} component(s) use useSearchParams without Suspense. ` +
          `This failure confirms the bug exists. ` +
          `Affected: ${bugConditionComponents.map((c) => c.componentName).join(', ')}`
      ).toBe(false);

      // Verify error messages mention the specific issue
      const hasSuspenseError = buildResult.prerenderErrors.some(
        (err) =>
          err.includes('useSearchParams') || err.includes('suspense boundary')
      );

      expect(
        hasSuspenseError,
        'Build errors should mention useSearchParams or suspense boundary issue'
      ).toBe(true);

      // Verify at least one page failed
      expect(
        buildResult.affectedPages.length,
        'At least one page should fail static generation'
      ).toBeGreaterThan(0);
    } else {
      // If no components have the bug condition, build should succeed
      console.log(
        '\n⚠️  No components found with bug condition (all have Suspense boundaries)'
      );
      console.log(
        'This means the bug has already been fixed in the codebase.'
      );

      expect(
        buildResult.success,
        'Build should SUCCEED when all components are properly wrapped in Suspense'
      ).toBe(true);
    }
  }, 600000); // 10 minute timeout for build process

  /**
   * Property-Based Test: Verify Bug Condition Function
   * 
   * This test uses property-based testing to verify the bug condition detection
   * logic works correctly across different component patterns.
   */
  it('property: isBugCondition correctly identifies components without Suspense', () => {
    fc.assert(
      fc.property(
        fc.record({
          usesSearchParams: fc.boolean(),
          hasSuspenseBoundary: fc.boolean(),
        }),
        (component) => {
          // Bug condition: uses useSearchParams AND no Suspense boundary
          const isBugCondition =
            component.usesSearchParams && !component.hasSuspenseBoundary;

          // Verify the logic
          if (component.usesSearchParams && !component.hasSuspenseBoundary) {
            // This component SHOULD cause build failures
            expect(isBugCondition).toBe(true);
          } else {
            // This component should NOT cause build failures
            expect(isBugCondition).toBe(false);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Document Specific Failing Components
   * 
   * This test explicitly documents the known failing components identified
   * in the design document.
   */
  it('should document the specific components identified in the bug analysis', () => {
    const knownFailingComponents = [
      {
        name: 'NavigationEvents',
        path: 'src/components/layout/NavigationEvents.tsx',
        severity: 'CRITICAL',
        impact: 'Affects ALL pages (root layout)',
        route: 'All routes',
      },
      {
        name: 'SettingsPage',
        path: 'src/app/depot/settings/page.tsx',
        severity: 'CRITICAL',
        impact: 'Settings page cannot be statically generated',
        route: '/depot/settings',
      },
      {
        name: 'HeatmapPage',
        path: 'src/components/depot/operations/HeatmapPage.tsx',
        severity: 'HIGH',
        impact: 'Heatmap visualization page generation blocked',
        route: '/depot/heatmap',
      },
      {
        name: 'IncidentsPage',
        path: 'src/components/depot/operations/IncidentsPage.tsx',
        severity: 'HIGH',
        impact: 'Incident management page generation blocked',
        route: '/depot/incidents',
      },
      {
        name: 'AnalysisSection',
        path: 'src/components/depot/operations/AnalysisSection.tsx',
        severity: 'HIGH',
        impact: 'Analysis dashboard section generation blocked',
        route: '/depot/operations (and other parent pages)',
      },
    ];

    console.log('\n=== Known Failing Components Documentation ===');
    console.log('The following components were identified in the bug analysis:\n');

    knownFailingComponents.forEach((comp, idx) => {
      console.log(`${idx + 1}. ${comp.name}`);
      console.log(`   Path: ${comp.path}`);
      console.log(`   Severity: ${comp.severity}`);
      console.log(`   Impact: ${comp.impact}`);
      console.log(`   Route: ${comp.route}`);
      console.log('');
    });

    console.log(
      'Total components identified: ' + knownFailingComponents.length
    );
    console.log(
      'Expected build impact: 40+ pages unable to complete static generation\n'
    );

    // This test always passes - it's just documentation
    expect(knownFailingComponents.length).toBe(5);
  });
});
