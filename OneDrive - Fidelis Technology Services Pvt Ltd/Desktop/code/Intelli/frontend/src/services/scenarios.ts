/**
 * Intelli Stream — Scenario Engine API Service
 * Feature: STR-API-2
 *
 * Axios calls for What-if scenarios and sensitivity configurations.
 */
import api from "./api";
import type {
  Scenario,
  ScenarioCreate,
  ScenarioUpdate,
  ScenarioListResponse,
  SensitivityConfig,
  SensitivityConfigCreate,
  SensitivityConfigUpdate,
} from "@/types/stream";

const BASE = "/api/v1/stream/scenarios";

// ── Scenarios ──────────────────────────────────────────────────────

export async function listScenarios(): Promise<ScenarioListResponse> {
  const { data } = await api.get<ScenarioListResponse>(BASE);
  return data;
}

export async function getScenario(id: string): Promise<Scenario> {
  const { data } = await api.get<Scenario>(`${BASE}/${id}`);
  return data;
}

export async function createScenario(body: ScenarioCreate): Promise<Scenario> {
  const { data } = await api.post<Scenario>(BASE, body);
  return data;
}

export async function updateScenario(
  id: string,
  body: ScenarioUpdate
): Promise<Scenario> {
  const { data } = await api.patch<Scenario>(`${BASE}/${id}`, body);
  return data;
}

export async function deleteScenario(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}

export async function cloneScenario(id: string): Promise<Scenario> {
  const { data } = await api.post<Scenario>(`${BASE}/${id}/clone`);
  return data;
}

export async function seedBaseline(): Promise<Scenario> {
  const { data } = await api.post<Scenario>(`${BASE}/seed-baseline`);
  return data;
}

// ── Sensitivity Configs ────────────────────────────────────────────

export async function addSensitivityConfig(
  scenarioId: string,
  body: SensitivityConfigCreate
): Promise<SensitivityConfig> {
  const { data } = await api.post<SensitivityConfig>(
    `${BASE}/${scenarioId}/sensitivity`,
    body
  );
  return data;
}

export async function updateSensitivityConfig(
  scenarioId: string,
  configId: string,
  body: SensitivityConfigUpdate
): Promise<SensitivityConfig> {
  const { data } = await api.patch<SensitivityConfig>(
    `${BASE}/${scenarioId}/sensitivity/${configId}`,
    body
  );
  return data;
}

export async function deleteSensitivityConfig(
  scenarioId: string,
  configId: string
): Promise<void> {
  await api.delete(`${BASE}/${scenarioId}/sensitivity/${configId}`);
}
