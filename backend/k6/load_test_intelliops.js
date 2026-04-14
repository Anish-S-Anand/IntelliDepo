/**
 * IntelliOps™ — Load & Performance Tests (Day 5)
 *
 * k6 scripts: 500 concurrent WebSocket clients, 1000 events/min ingestion.
 * Confirms <5s dashboard refresh SLA.
 *
 * Run: k6 run --vus 500 --duration 5m backend/k6/load_test_intelliops.js
 */

import http from "k6/http";
import ws from "k6/ws";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const dashboardLatency = new Trend("dashboard_latency_ms", true);
const eventIngestionRate = new Rate("event_ingestion_success");
const alertFetchLatency = new Trend("alert_fetch_latency_ms", true);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const WS_URL = __ENV.WS_URL || "ws://localhost:8000/ops/monitoring/ws/live-feed";
const HEADERS = { "Content-Type": "application/json", "x-user-id": "k6-load-test" };

export const options = {
  scenarios: {
    // Scenario 1: Dashboard refresh — confirm <5s SLA
    dashboard_refresh: {
      executor: "constant-vus",
      vus: 50,
      duration: "3m",
      exec: "dashboardRefresh",
    },
    // Scenario 2: Event ingestion — 1000 events/min target
    event_ingestion: {
      executor: "constant-arrival-rate",
      rate: 1000,
      timeUnit: "1m",
      duration: "3m",
      preAllocatedVUs: 100,
      maxVUs: 200,
      exec: "ingestEvent",
    },
    // Scenario 3: WebSocket connections — 500 concurrent
    websocket_clients: {
      executor: "constant-vus",
      vus: 500,
      duration: "2m",
      exec: "websocketClient",
      startTime: "30s",
    },
    // Scenario 4: Alert feed polling
    alert_polling: {
      executor: "constant-vus",
      vus: 30,
      duration: "3m",
      exec: "alertPolling",
    },
    // Scenario 5: Fleet GPS batch ingestion
    gps_ingestion: {
      executor: "constant-arrival-rate",
      rate: 100,
      timeUnit: "1m",
      duration: "2m",
      preAllocatedVUs: 20,
      maxVUs: 50,
      exec: "gpsIngestion",
    },
  },
  thresholds: {
    dashboard_latency_ms: ["p(95)<5000"],        // <5s dashboard refresh SLA
    alert_fetch_latency_ms: ["p(95)<2000"],       // <2s alert fetch
    event_ingestion_success: ["rate>0.95"],        // >95% success rate
    http_req_duration: ["p(99)<10000"],            // <10s p99
    http_req_failed: ["rate<0.05"],                // <5% failure rate
  },
};

// ---------------------------------------------------------------------------
// Scenario functions
// ---------------------------------------------------------------------------

export function dashboardRefresh() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/ops/monitoring/dashboard/kpis`, { headers: HEADERS });
  const latency = Date.now() - start;
  dashboardLatency.add(latency);

  check(res, {
    "dashboard status 200": (r) => r.status === 200,
    "dashboard <5s SLA": () => latency < 5000,
    "kpis has total_events": (r) => {
      try { return JSON.parse(r.body).total_events_today !== undefined; }
      catch { return false; }
    },
  });

  sleep(1 + Math.random() * 2);
}

export function ingestEvent() {
  const severities = ["critical", "high", "medium", "low", "info"];
  const payload = JSON.stringify({
    event_type: "sensor",
    source_id: `K6-SENSOR-${Math.floor(Math.random() * 100)}`,
    source_name: "k6 Load Test Sensor",
    zone: "Cold Storage",
    severity: severities[Math.floor(Math.random() * severities.length)],
    value: 20 + Math.random() * 30,
    unit: "°C",
    message: "k6 load test event",
  });

  const res = http.post(`${BASE_URL}/ops/monitoring/events`, payload, { headers: HEADERS });
  eventIngestionRate.add(res.status === 201);

  check(res, {
    "event ingested 201": (r) => r.status === 201,
  });
}

export function websocketClient() {
  const res = ws.connect(WS_URL, {}, function (socket) {
    socket.on("open", function () {
      socket.send(JSON.stringify({ type: "subscribe", channels: ["alerts", "events"] }));
    });

    socket.on("message", function (msg) {
      check(msg, {
        "ws message received": (m) => m.length > 0,
      });
    });

    socket.on("error", function (e) {
      // Connection error — expected under load
    });

    // Keep connection alive for 30s
    sleep(30);
    socket.close();
  });

  check(res, {
    "ws connected": (r) => r && r.status === 101,
  });
}

export function alertPolling() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/ops/monitoring/alerts/active`, { headers: HEADERS });
  const latency = Date.now() - start;
  alertFetchLatency.add(latency);

  check(res, {
    "alerts status 200": (r) => r.status === 200,
    "alerts <2s": () => latency < 2000,
  });

  sleep(2 + Math.random() * 3);
}

export function gpsIngestion() {
  const updates = [];
  for (let i = 0; i < 10; i++) {
    updates.push({
      vehicle_id: `K6-TRK-${Math.floor(Math.random() * 200)}`,
      latitude: 12.95 + Math.random() * 0.1,
      longitude: 77.55 + Math.random() * 0.1,
      speed_kmh: Math.random() * 60,
      heading: Math.random() * 360,
    });
  }

  const res = http.post(
    `${BASE_URL}/ops/fleet/gps/batch`,
    JSON.stringify({ updates }),
    { headers: HEADERS },
  );

  check(res, {
    "gps batch success": (r) => r.status === 200 || r.status === 201,
    "gps batch ingested": (r) => {
      try { return JSON.parse(r.body).ingested === 10; }
      catch { return false; }
    },
  });
}

// ---------------------------------------------------------------------------
// Default function (runs if no scenario specified)
// ---------------------------------------------------------------------------
export default function () {
  dashboardRefresh();
}
