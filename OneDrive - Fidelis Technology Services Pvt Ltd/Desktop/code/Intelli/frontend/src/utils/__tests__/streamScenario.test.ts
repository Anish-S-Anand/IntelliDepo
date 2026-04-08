import { describe, expect, it } from "vitest";

import { buildSimulationSnapshot, getDefaultSimulationSnapshot } from "../streamScenario";
import type { Scenario } from "@/types/stream";

describe("streamScenario", () => {
  it("builds a stable default snapshot", () => {
    const snapshot = getDefaultSimulationSnapshot();

    expect(snapshot.sliders).toHaveLength(3);
    expect(snapshot.adjustedInputs.revenue).toBe(10_000_000);
    expect(snapshot.computedResults.net_income).toBeGreaterThan(0);
    expect(snapshot.results[0].variance).toBe("+0%");
  });

  it("derives sliders from backend-style adjusted inputs", () => {
    const scenario: Scenario = {
      id: "1",
      user_id: "u1",
      name: "Scenario",
      description: null,
      is_baseline: false,
      base_inputs: {
        revenue: 10_000_000,
        cogs: 4_000_000,
        opex: 3_500_000,
        depreciation: 500_000,
        interest_expense: 300_000,
        tax_rate_pct: 25,
      },
      adjusted_inputs: {
        revenue: 11_000_000,
        cogs: 4_180_000,
        opex: 3_300_000,
      },
      computed_results: null,
      tags: null,
      sensitivity_configs: [],
      created_at: null,
      updated_at: null,
    };

    const snapshot = buildSimulationSnapshot(scenario);

    expect(snapshot.sliders[0].value).toBe(10);
    expect(snapshot.sliders[1].value).toBe(38);
    expect(snapshot.sliders[2].value).toBe(30);
    expect(snapshot.adjustedInputs.revenue).toBe(11_000_000);
    expect(snapshot.adjustedInputs.cogs).toBe(4_180_000);
    expect(snapshot.adjustedInputs.opex).toBe(3_300_000);
  });
});
