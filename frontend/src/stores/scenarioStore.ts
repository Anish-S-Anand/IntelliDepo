/**
 * Scenario Store — What-if simulations & sensitivity configs
 *
 * Manages scenario CRUD, the active scenario being edited,
 * and adjusted financial variables for the What-If Simulator.
 */
import { create } from "zustand";
import type {
  Scenario,
  ScenarioCreate,
  ScenarioUpdate,
  SensitivityConfigCreate,
  SensitivityConfigUpdate,
} from "@/types/stream";
import * as scenarioApi from "@/services/scenarios";

interface ScenarioState {
  scenarios: Scenario[];
  activeScenario: Scenario | null;
  isLoading: boolean;
  error: string | null;

  // Scenario CRUD
  fetchScenarios: () => Promise<void>;
  fetchScenario: (id: string) => Promise<void>;
  createScenario: (body: ScenarioCreate) => Promise<Scenario>;
  updateScenario: (id: string, body: ScenarioUpdate) => Promise<void>;
  deleteScenario: (id: string) => Promise<void>;
  cloneScenario: (id: string) => Promise<Scenario>;
  seedBaseline: () => Promise<Scenario>;

  // Active scenario helpers
  setActiveScenario: (scenario: Scenario | null) => void;
  updateAdjustedInput: (key: string, value: number) => void;
  saveAdjustments: (
    adjustedInputs?: Record<string, number>,
    computedResults?: Record<string, number>,
  ) => Promise<void>;

  // Sensitivity configs
  addSensitivityConfig: (scenarioId: string, body: SensitivityConfigCreate) => Promise<void>;
  updateSensitivityConfig: (scenarioId: string, configId: string, body: SensitivityConfigUpdate) => Promise<void>;
  deleteSensitivityConfig: (scenarioId: string, configId: string) => Promise<void>;

  clearError: () => void;
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  scenarios: [],
  activeScenario: null,
  isLoading: false,
  error: null,

  // ── Scenario CRUD ──────────────────────────────────────────────

  fetchScenarios: async () => {
    set({ isLoading: true, error: null });
    try {
      const { scenarios } = await scenarioApi.listScenarios();
      set({ scenarios, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchScenario: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const scenario = await scenarioApi.getScenario(id);
      set({ activeScenario: scenario, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createScenario: async (body) => {
    set({ isLoading: true, error: null });
    try {
      const scenario = await scenarioApi.createScenario(body);
      set((state) => ({
        scenarios: [scenario, ...state.scenarios],
        activeScenario: scenario,
        isLoading: false,
      }));
      return scenario;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  updateScenario: async (id, body) => {
    set({ error: null });
    try {
      const updated = await scenarioApi.updateScenario(id, body);
      set((state) => ({
        scenarios: state.scenarios.map((s) => (s.id === id ? updated : s)),
        activeScenario: state.activeScenario?.id === id ? updated : state.activeScenario,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteScenario: async (id) => {
    set({ error: null });
    try {
      await scenarioApi.deleteScenario(id);
      set((state) => ({
        scenarios: state.scenarios.filter((s) => s.id !== id),
        activeScenario: state.activeScenario?.id === id ? null : state.activeScenario,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  cloneScenario: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const cloned = await scenarioApi.cloneScenario(id);
      set((state) => ({
        scenarios: [cloned, ...state.scenarios],
        activeScenario: cloned,
        isLoading: false,
      }));
      return cloned;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  seedBaseline: async () => {
    set({ isLoading: true, error: null });
    try {
      const baseline = await scenarioApi.seedBaseline();
      set((state) => {
        const exists = state.scenarios.some((s) => s.id === baseline.id);
        return {
          scenarios: exists ? state.scenarios : [baseline, ...state.scenarios],
          activeScenario: baseline,
          isLoading: false,
        };
      });
      return baseline;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  // ── Active Scenario Helpers ────────────────────────────────────

  setActiveScenario: (scenario) => set({ activeScenario: scenario }),

  updateAdjustedInput: (key, value) => {
    const { activeScenario } = get();
    if (!activeScenario) return;
    set({
      activeScenario: {
        ...activeScenario,
        adjusted_inputs: { ...activeScenario.adjusted_inputs, [key]: value },
      },
    });
  },

  saveAdjustments: async (adjustedInputs, computedResults) => {
    const { activeScenario } = get();
    if (!activeScenario) return;
    await get().updateScenario(activeScenario.id, {
      adjusted_inputs: adjustedInputs ?? activeScenario.adjusted_inputs,
      computed_results: computedResults ?? activeScenario.computed_results ?? undefined,
    });
  },

  // ── Sensitivity Configs ────────────────────────────────────────

  addSensitivityConfig: async (scenarioId, body) => {
    try {
      const config = await scenarioApi.addSensitivityConfig(scenarioId, body);
      set((state) => {
        if (state.activeScenario?.id === scenarioId) {
          return {
            activeScenario: {
              ...state.activeScenario,
              sensitivity_configs: [...state.activeScenario.sensitivity_configs, config],
            },
          };
        }
        return {};
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  updateSensitivityConfig: async (scenarioId, configId, body) => {
    try {
      const updated = await scenarioApi.updateSensitivityConfig(scenarioId, configId, body);
      set((state) => {
        if (state.activeScenario?.id === scenarioId) {
          return {
            activeScenario: {
              ...state.activeScenario,
              sensitivity_configs: state.activeScenario.sensitivity_configs.map((c) =>
                c.id === configId ? updated : c
              ),
            },
          };
        }
        return {};
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteSensitivityConfig: async (scenarioId, configId) => {
    try {
      await scenarioApi.deleteSensitivityConfig(scenarioId, configId);
      set((state) => {
        if (state.activeScenario?.id === scenarioId) {
          return {
            activeScenario: {
              ...state.activeScenario,
              sensitivity_configs: state.activeScenario.sensitivity_configs.filter(
                (c) => c.id !== configId
              ),
            },
          };
        }
        return {};
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  clearError: () => set({ error: null }),
}));
