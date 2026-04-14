/**
 * IntelliOps™ — AI Agent Smoke Tests (Day 5)
 *
 * Verifies severity classification, breach prediction, dwell time optimization,
 * and queue optimizer under edge cases. Tests graceful degradation.
 *
 * Run: k6 run backend/k6/smoke_test_agents.js
 */

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const HEADERS = { "Content-Type": "application/json", "x-user-id": "k6-agent-smoke" };

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ["rate==1.0"],   // all checks must pass
  },
};

export default function () {
  // -----------------------------------------------------------------------
  // 1. Severity Classification Agent (F-070)
  // -----------------------------------------------------------------------

  // P1 — fire/emergency keywords
  let res = http.post(
    `${BASE_URL}/ops/incidents/classify?title=Fire+detected+in+warehouse&description=Smoke+alarm+and+sprinklers+activated&source=sensor`,
    null, { headers: HEADERS },
  );
  check(res, {
    "classify P1 fire": (r) => r.status === 200 && JSON.parse(r.body).priority === "P1",
    "classify fire keyword": (r) => JSON.parse(r.body).keywords_matched.includes("fire"),
  });

  // P2 — SLA breach
  res = http.post(
    `${BASE_URL}/ops/incidents/classify?title=SLA+breach+on+delivery+window&description=Exceeded+threshold&source=sla_breach`,
    null, { headers: HEADERS },
  );
  check(res, {
    "classify P2 sla": (r) => r.status === 200 && JSON.parse(r.body).priority === "P2",
  });

  // P4 — low/info keywords
  res = http.post(
    `${BASE_URL}/ops/incidents/classify?title=Battery+low+on+sensor+unit&description=Routine+battery+replacement+needed&source=manual`,
    null, { headers: HEADERS },
  );
  check(res, {
    "classify P4 low": (r) => r.status === 200 && JSON.parse(r.body).priority === "P4",
  });

  // Edge case: empty description
  res = http.post(
    `${BASE_URL}/ops/incidents/classify?title=Unknown+event&source=manual`,
    null, { headers: HEADERS },
  );
  check(res, {
    "classify default P3": (r) => r.status === 200 && ["P3", "P4"].includes(JSON.parse(r.body).priority),
  });

  sleep(0.5);

  // -----------------------------------------------------------------------
  // 2. Breach Prediction (F-060) — graceful degradation
  // -----------------------------------------------------------------------

  // Create SLA for prediction test
  res = http.post(
    `${BASE_URL}/api/v1/sla`,
    JSON.stringify({
      tenant_id: "smoke-test",
      name: "Smoke Test SLA",
      metric_key: "test_metric",
      threshold_value: 100,
      threshold_unit: "units",
      window_minutes: 60,
    }),
    { headers: HEADERS },
  );
  if (res.status === 201) {
    const slaId = JSON.parse(res.body).id;

    const predRes = http.get(`${BASE_URL}/api/v1/sla/${slaId}/breach-prediction`, { headers: HEADERS });
    check(predRes, {
      "breach prediction 200": (r) => r.status === 200,
      "breach prediction has probability": (r) => JSON.parse(r.body).breach_probability >= 0,
      "breach prediction has status": (r) => ["ok", "at_risk", "breached"].includes(JSON.parse(r.body).escalation_status),
    });

    // Cleanup
    http.del(`${BASE_URL}/api/v1/sla/${slaId}`, null, { headers: HEADERS });
  }

  sleep(0.5);

  // -----------------------------------------------------------------------
  // 3. Queue Optimization Agent (F-068) — empty yard edge case
  // -----------------------------------------------------------------------

  res = http.get(`${BASE_URL}/ops/fleet/queue/optimize`, { headers: HEADERS });
  check(res, {
    "queue optimize 200": (r) => r.status === 200,
    "queue has recommendations": (r) => JSON.parse(r.body).recommendations !== undefined,
    "queue handles empty": (r) => JSON.parse(r.body).total_vehicles_waiting >= 0,
  });

  sleep(0.5);

  // -----------------------------------------------------------------------
  // 4. Dwell Time Alert Evaluation (F-066) — no active dwells
  // -----------------------------------------------------------------------

  res = http.post(`${BASE_URL}/ops/fleet/dwell/evaluate-alerts`, null, { headers: HEADERS });
  check(res, {
    "dwell eval 200": (r) => r.status === 200,
    "dwell eval no crash": (r) => JSON.parse(r.body).evaluated_at !== undefined,
  });

  // -----------------------------------------------------------------------
  // 5. Auto-Escalation Evaluation (F-069) — no overdue incidents
  // -----------------------------------------------------------------------

  res = http.post(`${BASE_URL}/ops/incidents/evaluate-escalations`, null, { headers: HEADERS });
  check(res, {
    "escalation eval 200": (r) => r.status === 200,
    "escalation eval graceful": (r) => JSON.parse(r.body).auto_escalated >= 0,
  });

  // -----------------------------------------------------------------------
  // 6. Scorecards (F-063) — fallback to defaults
  // -----------------------------------------------------------------------

  res = http.get(`${BASE_URL}/ops/scorecards/summary?group_type=module`, { headers: HEADERS });
  check(res, {
    "scorecards 200": (r) => r.status === 200,
    "scorecards has compliance": (r) => JSON.parse(r.body).overall_compliance_pct > 0,
  });
}
