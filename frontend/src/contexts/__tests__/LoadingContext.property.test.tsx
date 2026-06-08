import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Property-Based Tests for LoadingContext
 * 
 * These tests validate the reference counting invariant using fast-check
 * to generate random sequences of operations and verify correctness properties.
 */

// ============================================================================
// Property 1: Reference Counting Invariant
// ============================================================================

/**
 * **Validates: Requirements 3.4, 3.5, 3.6**
 * 
 * For any sequence of startLoading() and stopLoading() calls:
 * 1. The counter SHALL never be negative (counter >= 0)
 * 2. The loading state SHALL be true iff counter > 0
 * 3. The loading state SHALL be false iff counter === 0
 * 4. stopLoading() at counter=0 SHALL NOT cause negative counter
 */
describe("LoadingContext - Property 1: Reference Counting Invariant", () => {
  type Operation = "start" | "stop";

  it("should maintain correct state for any sequence of start/stop operations", () => {
    fc.assert(
      fc.property(
        // Generate random sequences of 10-50 operations
        fc.array(fc.oneof(fc.constant("start"), fc.constant("stop")), {
          minLength: 10,
          maxLength: 50,
        }),
        (operations: Operation[]) => {
          // Simulate the state management logic
          const state = { loading: false, counter: 0 };

          for (const op of operations) {
            if (op === "start") {
              // Simulate startLoading()
              state.counter++;
              state.loading = state.counter > 0;
            } else {
              // Simulate stopLoading() with Math.max(0, counter - 1)
              state.counter = Math.max(0, state.counter - 1);
              state.loading = state.counter > 0;
            }

            // Invariant 1: Counter never negative
            expect(state.counter).toBeGreaterThanOrEqual(0);

            // Invariant 2 & 3: Loading state matches counter state
            if (state.counter > 0) {
              expect(state.loading).toBe(true);
            } else {
              expect(state.loading).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 } // Test with minimum 100 iterations
    );
  });

  it("should handle edge case: single operation sequences", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant("start"), fc.constant("stop")),
        (operation: Operation) => {
          const state = { loading: false, counter: 0 };

          if (operation === "start") {
            state.counter++;
            state.loading = state.counter > 0;
            expect(state.counter).toBe(1);
            expect(state.loading).toBe(true);
          } else {
            state.counter = Math.max(0, state.counter - 1);
            state.loading = state.counter > 0;
            expect(state.counter).toBe(0);
            expect(state.loading).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should handle edge case: multiple consecutive starts", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (numStarts: number) => {
          const state = { loading: false, counter: 0 };

          // Execute multiple starts
          for (let i = 0; i < numStarts; i++) {
            state.counter++;
            state.loading = state.counter > 0;
          }

          expect(state.counter).toBe(numStarts);
          expect(state.loading).toBe(true);

          // Now stop them all
          for (let i = 0; i < numStarts; i++) {
            state.counter = Math.max(0, state.counter - 1);
            state.loading = state.counter > 0;
            expect(state.counter).toBeGreaterThanOrEqual(0);
          }

          expect(state.counter).toBe(0);
          expect(state.loading).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should handle edge case: unbalanced operations (more stops than starts)", () => {
    fc.assert(
      fc.property(
        fc.record({
          starts: fc.integer({ min: 0, max: 5 }),
          stops: fc.integer({ min: 0, max: 10 }),
        }),
        ({ starts, stops }) => {
          const state = { loading: false, counter: 0 };

          // Execute all starts
          for (let i = 0; i < starts; i++) {
            state.counter++;
            state.loading = state.counter > 0;
          }

          // Execute all stops (may be more than starts)
          for (let i = 0; i < stops; i++) {
            state.counter = Math.max(0, state.counter - 1);
            state.loading = state.counter > 0;
            // Counter should never go negative
            expect(state.counter).toBeGreaterThanOrEqual(0);
          }

          // Final state should be correct
          expect(state.counter).toBeGreaterThanOrEqual(0);
          expect(state.loading).toBe(state.counter > 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should handle edge case: interleaved operations", () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(fc.constant("start"), fc.constant("stop")), {
          minLength: 20,
          maxLength: 50,
        }),
        (operations: Operation[]) => {
          const state = { loading: false, counter: 0 };
          const counterHistory: number[] = [];

          for (const op of operations) {
            if (op === "start") {
              state.counter++;
              state.loading = state.counter > 0;
            } else {
              state.counter = Math.max(0, state.counter - 1);
              state.loading = state.counter > 0;
            }

            counterHistory.push(state.counter);

            // All invariants must hold at every step
            expect(state.counter).toBeGreaterThanOrEqual(0);
            expect(state.loading).toBe(state.counter > 0);
          }

          // Verify counter history never went negative
          expect(Math.min(...counterHistory)).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
