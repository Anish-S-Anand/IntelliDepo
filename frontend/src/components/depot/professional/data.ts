export type DepotRecord = {
  id: string;
  name: string;
  location: string;
  health: number;
  utilization: number;
  trucks: number;
  cameras: number;
  fifo: number;
  loadMinutes: number;
};

export type ClusterRecord = {
  id: string;
  zone: string;
  capacity: number;
  occupied: number;
  product: string;
  fifoOk: boolean;
  batch: string;
  expiry: string;
  activity: string;
};

export type IncidentSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type IncidentStatus = "open" | "acknowledged" | "resolved";

export type IncidentRecord = {
  id: string;
  type: string;
  severity: IncidentSeverity;
  location: string;
  timeAgo: string;
  status: IncidentStatus;
  camera: string;
  description: string;
  assignee: string;
};

export type CameraRecord = {
  id: string;
  name: string;
  status: "active" | "alert" | "inactive";
  vehicles: number;
  pallets: number;
  people: number;
  confidence: number;
  fps: number;
  resolution: string;
  activity: "HIGH" | "MEDIUM" | "LOW" | "NONE";
};

export const depots: DepotRecord[] = [
  { id: "MUM-001", name: "Mumbai Central", location: "Mumbai, India", health: 94, utilization: 84, trucks: 8, cameras: 12, fifo: 98.2, loadMinutes: 22 },
  { id: "DEL-002", name: "Delhi North Hub", location: "Delhi, India", health: 87, utilization: 71, trucks: 5, cameras: 8, fifo: 95.1, loadMinutes: 28 },
  { id: "DXB-001", name: "Dubai South", location: "Dubai, UAE", health: 96, utilization: 91, trucks: 14, cameras: 20, fifo: 99.1, loadMinutes: 18 },
];

export const throughput = [1200, 1350, 980, 1420, 1580, 1280, 850];

export const clusters: ClusterRecord[] = [
  { id: "A1", zone: "A", capacity: 500, occupied: 490, product: "OPC Cement 53", fifoOk: true, batch: "B2025-1022", expiry: "2025-08-14", activity: "2m ago" },
  { id: "A2", zone: "A", capacity: 500, occupied: 320, product: "PPC Cement 33", fifoOk: true, batch: "B2025-1019", expiry: "2025-09-01", activity: "15m ago" },
  { id: "B1", zone: "B", capacity: 500, occupied: 0, product: "Empty", fifoOk: true, batch: "-", expiry: "-", activity: "2h ago" },
  { id: "B2", zone: "B", capacity: 500, occupied: 450, product: "Fertilizer Grade A", fifoOk: false, batch: "B2025-1021", expiry: "2025-07-30", activity: "5m ago" },
  { id: "C1", zone: "C", capacity: 400, occupied: 395, product: "Chemicals HAZ-3", fifoOk: true, batch: "B2025-1018", expiry: "2025-12-31", activity: "8m ago" },
  { id: "C2", zone: "C", capacity: 400, occupied: 200, product: "OPC Cement 43", fifoOk: true, batch: "B2025-1015", expiry: "2025-08-10", activity: "30m ago" },
  { id: "D1", zone: "D", capacity: 600, occupied: 580, product: "Steel Coils Grade 2", fifoOk: true, batch: "B2025-1023", expiry: "N/A", activity: "1m ago" },
  { id: "D2", zone: "D", capacity: 600, occupied: 150, product: "Staging Area", fifoOk: true, batch: "-", expiry: "-", activity: "45m ago" },
];

export const incidentsSeed: IncidentRecord[] = [
  { id: "INC-001", type: "Security Breach", severity: "CRITICAL", location: "Gate 4 Perimeter", timeAgo: "8m ago", status: "acknowledged", camera: "CAM-042", description: "Unauthorized entry detected at Gate 4. Guard Unit 2 dispatched for perimeter sweep.", assignee: "Guard Unit 2" },
  { id: "INC-002", type: "Damaged Bags", severity: "HIGH", location: "Zone C Bay 4", timeAgo: "2m ago", status: "open", camera: "CAM-04", description: "Five bags torn during unloading. Estimated loss: INR 4,200.", assignee: "-" },
  { id: "INC-003", type: "Count Mismatch", severity: "HIGH", location: "Cluster B-09", timeAgo: "1h ago", status: "open", camera: "CAM-08", description: "Physical count shows minus five bags versus ERP record. Investigation pending.", assignee: "-" },
  { id: "INC-004", type: "SLA Risk", severity: "MEDIUM", location: "Dock B", timeAgo: "15m ago", status: "open", camera: "-", description: "Truck queue exceeded 30-minute dwell threshold at Dock B.", assignee: "-" },
  { id: "INC-005", type: "Temp Warning", severity: "LOW", location: "Cold Storage Zone A", timeAgo: "32m ago", status: "resolved", camera: "CAM-12", description: "Temperature breached threshold briefly and auto-corrected without product damage.", assignee: "Ops Team" },
];

export const cameras: CameraRecord[] = [
  { id: "CAM-01", name: "Gate Entry North", status: "active", vehicles: 12, pallets: 48, people: 6, confidence: 97.2, fps: 30, resolution: "4K", activity: "HIGH" },
  { id: "CAM-02", name: "Zone A Overhead", status: "active", vehicles: 0, pallets: 124, people: 3, confidence: 99.1, fps: 25, resolution: "4K", activity: "MEDIUM" },
  { id: "CAM-03", name: "Loading Bay 1-4", status: "active", vehicles: 4, pallets: 67, people: 8, confidence: 98.5, fps: 30, resolution: "1080p", activity: "HIGH" },
  { id: "CAM-04", name: "Zone C Perimeter", status: "alert", vehicles: 1, pallets: 22, people: 2, confidence: 94.3, fps: 25, resolution: "1080p", activity: "LOW" },
  { id: "CAM-05", name: "Gate Exit South", status: "active", vehicles: 8, pallets: 0, people: 4, confidence: 96.8, fps: 30, resolution: "4K", activity: "HIGH" },
  { id: "CAM-06", name: "Yard Overview", status: "inactive", vehicles: 0, pallets: 0, people: 0, confidence: 0, fps: 0, resolution: "4K", activity: "NONE" },
];

export const commandFeed = [
  "AI routed overflow trucks from Dock B to Dock D to protect 30-minute SLA.",
  "Vision pipeline reconciled 1,280 bags from today's outbound wave with 99.8% confidence.",
  "Warehouse staffing recommendation issued for the evening peak between 18:00 and 20:00.",
  "Revenue leakage signal raised in Zone D billing reconciliation for supervisor review.",
];

export const operationsTasks = [
  { title: "Verify damaged bag count at Zone C Bay 4", owner: "Ops Team", priority: "HIGH" },
  { title: "Close ERP mismatch for Cluster B-09", owner: "Inventory Control", priority: "HIGH" },
  { title: "Review forklift battery rotation checklist", owner: "Shift Lead", priority: "MEDIUM" },
  { title: "Complete outbound staging audit", owner: "Dispatch", priority: "LOW" },
];

export const operationsChecklists = ["Inbound bay inspection", "Pallet seal verification", "Forklift maintenance check", "Supervisor handoff sign-off"];
export const operationsExceptions = ["Dock B dwell time trending above target", "Zone D billing reconciliation variance", "Camera CAM-06 remains offline"];
export const fleetRows = [
  { truck: "MH-04-AX-1921", dock: "Dock A", dwell: 18, status: "loading" },
  { truck: "TN-04-AB-1234", dock: "Dock C", dwell: 27, status: "inspection" },
  { truck: "DL-08-HQ-4401", dock: "Dock B", dwell: 35, status: "queued" },
  { truck: "DXB-22-K-9012", dock: "Dock D", dwell: 14, status: "departing" },
];

export const analyticsPoints = [57, 68, 75, 64, 86, 77, 82];
export const anomalies = [
  { title: "Zone D billing variance", score: 88, detail: "Mismatch between scanned bags and invoiced volume." },
  { title: "Dock B dwell pressure", score: 74, detail: "Queue duration exceeded daily baseline for two hours." },
  { title: "Night shift camera blind spot", score: 69, detail: "Offline yard feed reduced perimeter confidence window." },
];

export const aiRecommendations = [
  "Move 2 trucks from Dock B to Dock D for the next two hours.",
  "Trigger recount workflow for Cluster B-09 and hold dispatch release.",
  "Escalate CAM-06 replacement to infra team before the night shift.",
];

export const leakages = [
  { title: "Zone D billing reconciliation", status: "Open", impact: "INR 42K / month" },
  { title: "Manual unload exception approvals", status: "Investigating", impact: "INR 18K / month" },
  { title: "Cold storage idle power drift", status: "Mitigated", impact: "INR 7K / month" },
];

export const scenarios = [
  { title: "Peak outbound surge", impact: "Positive", summary: "Add one temporary dock crew and recover SLA by 11%." },
  { title: "Camera downtime persists", impact: "Risk", summary: "Security confidence drops below 92% during night shift." },
  { title: "Dock balancing active", impact: "Positive", summary: "Average dwell time falls from 35 to 24 minutes." },
];

export const apiHealth = [
  { name: "ERP Connector", status: "Connected", latency: "220 ms" },
  { name: "Vision Engine", status: "Connected", latency: "180 ms" },
  { name: "Dispatch API", status: "Connected", latency: "260 ms" },
  { name: "Billing Reconciliation", status: "Degraded", latency: "1.4 s" },
];

export const iotDevices = [
  { name: "Dock B sensor rack", status: "Alert", detail: "Queue sensor crossed threshold." },
  { name: "Zone C temperature probe", status: "Normal", detail: "Stable after brief warning." },
  { name: "Yard camera relay", status: "Warning", detail: "Packet loss detected on CAM-06 uplink." },
];

export const complianceRows = [
  { title: "Depot safety compliance", score: 97 },
  { title: "Hazmat handling readiness", score: 89 },
  { title: "Audit evidence completeness", score: 93 },
];

export const certificateExpiry = [
  { title: "Forklift operator certification", daysLeft: 18 },
  { title: "Hazmat supervisor permit", daysLeft: 31 },
  { title: "Fire systems inspection", daysLeft: 42 },
];

export const auditLog = [
  "13:42 Supervisor approved count mismatch investigation on Cluster B-09",
  "13:18 AI routing engine reassigned 2 trucks to Dock D",
  "12:56 Security team acknowledged Gate 4 perimeter incident",
];

export const settingsIntegrations = ["ERP and dispatch sync", "Camera ingestion and edge AI", "Billing reconciliation service", "WhatsApp and SMS escalation"];
