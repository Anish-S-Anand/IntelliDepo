// Depot operations mock data and types — ported from the HTML reference UI

export interface Depot {
  id: string;
  name: string;
  loc: string;
  health: number;
  util: number;
  trucks: number;
  cams: number;
  fifo: number;
  load: number;
}

export interface Cluster {
  id: string;
  zone: string;
  cap: number;
  occ: number;
  prod: string;
  fifo: boolean;
  act: string;
  batch: string;
}

export interface Incident {
  id: string;
  type: string;
  sev: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  loc: string;
  t: string;
  status: "open" | "acknowledged" | "resolved";
  cam: string;
  desc: string;
  assignee: string;
}

export interface CameraFeed {
  id: string;
  name: string;
  status: "active" | "alert" | "inactive";
  v: number;
  p: number;
  per: number;
  conf: number;
  fps: number;
  res: string;
  act: "HIGH" | "MEDIUM" | "LOW" | "NONE";
}

export const DEPOTS: Depot[] = [
  { id: "MUM-001", name: "Mumbai Central", loc: "Mumbai, India", health: 94, util: 84, trucks: 8, cams: 12, fifo: 98.2, load: 22 },
  { id: "DEL-002", name: "Delhi North Hub", loc: "Delhi, India", health: 87, util: 71, trucks: 5, cams: 8, fifo: 95.1, load: 28 },
  { id: "DXB-001", name: "Dubai South", loc: "Dubai, UAE", health: 96, util: 91, trucks: 14, cams: 20, fifo: 99.1, load: 18 },
];

export const CLUSTERS: Cluster[] = [
  { id: "A1", zone: "A", cap: 500, occ: 490, prod: "OPC Cement 53", fifo: true, act: "2m ago", batch: "B2025-1022" },
  { id: "A2", zone: "A", cap: 500, occ: 320, prod: "PPC Cement 33", fifo: true, act: "15m ago", batch: "B2025-1019" },
  { id: "B1", zone: "B", cap: 500, occ: 0, prod: "Empty", fifo: true, act: "2h ago", batch: "—" },
  { id: "B2", zone: "B", cap: 500, occ: 450, prod: "Fertilizer Grade A", fifo: false, act: "5m ago", batch: "B2025-1021" },
  { id: "C1", zone: "C", cap: 400, occ: 395, prod: "Chemicals HAZ-3", fifo: true, act: "8m ago", batch: "B2025-1018" },
  { id: "C2", zone: "C", cap: 400, occ: 200, prod: "OPC Cement 43", fifo: true, act: "30m ago", batch: "B2025-1015" },
  { id: "D1", zone: "D", cap: 600, occ: 580, prod: "Steel Coils Grade 2", fifo: true, act: "1m ago", batch: "B2025-1023" },
  { id: "D2", zone: "D", cap: 600, occ: 150, prod: "Staging Area", fifo: true, act: "45m ago", batch: "—" },
];

export const INCIDENTS: Incident[] = [
  { id: "INC-001", type: "Damaged Bags", sev: "HIGH", loc: "Zone C · Bay 4", t: "2m ago", status: "open", cam: "CAM-04", desc: "5 bags torn during unloading from Truck TN-04-AB-1234.", assignee: "—" },
  { id: "INC-002", type: "Security Breach", sev: "CRITICAL", loc: "Gate 4 Perimeter", t: "8m ago", status: "acknowledged", cam: "CAM-042", desc: "Unauthorized entry detected at Gate 4.", assignee: "Guard Unit 2" },
  { id: "INC-003", type: "SLA Risk", sev: "MEDIUM", loc: "Dock B", t: "15m ago", status: "open", cam: "—", desc: "Truck queue exceeded 30-minute SLA threshold at Dock B.", assignee: "—" },
  { id: "INC-004", type: "Temp Warning", sev: "LOW", loc: "Cold Storage Zone A", t: "32m ago", status: "resolved", cam: "CAM-12", desc: "Temperature exceeded 4°C threshold briefly.", assignee: "Ops Team" },
  { id: "INC-005", type: "Count Mismatch", sev: "HIGH", loc: "Cluster B-09", t: "1h ago", status: "open", cam: "CAM-08", desc: "Physical count shows -5 bags vs ERP record.", assignee: "—" },
];

export const CAMERAS: CameraFeed[] = [
  { id: "CAM-01", name: "Gate Entry North", status: "active", v: 12, p: 48, per: 6, conf: 97.2, fps: 30, res: "4K", act: "HIGH" },
  { id: "CAM-02", name: "Zone A Overhead", status: "active", v: 0, p: 124, per: 3, conf: 99.1, fps: 25, res: "4K", act: "MEDIUM" },
  { id: "CAM-03", name: "Loading Bay 1-4", status: "active", v: 4, p: 67, per: 8, conf: 98.5, fps: 30, res: "1080p", act: "HIGH" },
  { id: "CAM-04", name: "Zone C Perimeter", status: "alert", v: 1, p: 22, per: 2, conf: 94.3, fps: 25, res: "1080p", act: "LOW" },
  { id: "CAM-05", name: "Gate Exit South", status: "active", v: 8, p: 0, per: 4, conf: 96.8, fps: 30, res: "4K", act: "HIGH" },
  { id: "CAM-06", name: "Yard Overview", status: "inactive", v: 0, p: 0, per: 0, conf: 0, fps: 0, res: "4K", act: "NONE" },
];

export const THROUGHPUT = [1200, 1350, 980, 1420, 1580, 1280, 850];
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const SEV_COL: Record<string, string> = {
  CRITICAL: "#F04A4A",
  HIGH: "#F97316",
  MEDIUM: "#F5A623",
  LOW: "#22D3A1",
};

export const STA_COL: Record<string, string> = {
  open: "#F5A623",
  acknowledged: "#5B9BF5",
  resolved: "#22D3A1",
};

export const CAM_COL: Record<string, string> = {
  active: "#22D3A1",
  alert: "#F04A4A",
  inactive: "#4E6090",
};

export function occColor(pct: number) {
  if (pct >= 95) return "#F04A4A";
  if (pct >= 80) return "#F5A623";
  return "#22D3A1";
}

export const ZONES = [
  { name: "ZONE A", pct: 81, bags: 810, cap: 1000, color: "#F59E0B" },
  { name: "ZONE B", pct: 62, bags: 450, cap: 1000, color: "#22D3A1" },
  { name: "ZONE C", pct: 74, bags: 595, cap: 800, color: "#F59E0B" },
  { name: "ZONE D", pct: 91, bags: 1092, cap: 1200, color: "#F04A4A" },
];

// ---------------------------------------------------------------------------
// Day 2 — Counting & Cluster Mapping mock data
// ---------------------------------------------------------------------------

export interface CountingSession {
  id: string;
  manifestCode: string;
  vehicleNumber: string;
  expectedBags: number;
  expectedBoxes: number;
  countedBags: number;
  countedBoxes: number;
  totalExpected: number;
  totalCounted: number;
  discrepancy: number;
  confidenceAvg: number;
  status: "matched" | "mismatch" | "pending";
  zone: string;
  camera: string;
  timestamp: string;
}

export interface BatchTally {
  id: string;
  batchCode: string;
  product: string;
  expected: number;
  counted: number;
  variance: number;
  variancePct: number;
  status: "matched" | "mismatch" | "pending";
  timestamp: string;
}

export interface CountTimeSeries {
  time: string;
  bags: number;
  boxes: number;
  pallets: number;
  total: number;
  cumulative: number;
}

export interface ZoneDetail {
  id: string;
  code: string;
  name: string;
  type: string;
  floor: string;
  areaSqm: number;
  maxCapacity: number;
  currentOccupancy: number;
  utilizationPct: number;
  status: "normal" | "warning" | "critical";
  polygon: number[][];
  densityPerSqm: number;
  products: string[];
  lastUpdated: string;
}

export interface ZoneHistory {
  timestamp: string;
  utilization: number;
  occupancy: number;
}

export const COUNTING_SESSIONS: CountingSession[] = [
  { id: "CS-001", manifestCode: "MF-2026-0412", vehicleNumber: "TN-04-AB-1234", expectedBags: 500, expectedBoxes: 50, countedBags: 498, countedBoxes: 50, totalExpected: 550, totalCounted: 548, discrepancy: -2, confidenceAvg: 97.8, status: "mismatch", zone: "Zone A", camera: "CAM-02", timestamp: "10:24 AM" },
  { id: "CS-002", manifestCode: "MF-2026-0413", vehicleNumber: "MH-12-CD-5678", expectedBags: 300, expectedBoxes: 0, countedBags: 300, countedBoxes: 0, totalExpected: 300, totalCounted: 300, discrepancy: 0, confidenceAvg: 99.1, status: "matched", zone: "Zone B", camera: "CAM-03", timestamp: "09:45 AM" },
  { id: "CS-003", manifestCode: "MF-2026-0414", vehicleNumber: "GJ-05-EF-9012", expectedBags: 200, expectedBoxes: 100, countedBags: 195, countedBoxes: 98, totalExpected: 300, totalCounted: 293, discrepancy: -7, confidenceAvg: 94.3, status: "mismatch", zone: "Zone C", camera: "CAM-04", timestamp: "08:30 AM" },
  { id: "CS-004", manifestCode: "MF-2026-0415", vehicleNumber: "DL-03-GH-3456", expectedBags: 450, expectedBoxes: 25, countedBags: 450, countedBoxes: 25, totalExpected: 475, totalCounted: 475, discrepancy: 0, confidenceAvg: 98.5, status: "matched", zone: "Zone A", camera: "CAM-01", timestamp: "07:15 AM" },
  { id: "CS-005", manifestCode: "MF-2026-0416", vehicleNumber: "RJ-14-IJ-7890", expectedBags: 150, expectedBoxes: 75, countedBags: 148, countedBoxes: 73, totalExpected: 225, totalCounted: 221, discrepancy: -4, confidenceAvg: 96.2, status: "mismatch", zone: "Zone D", camera: "CAM-05", timestamp: "06:50 AM" },
  { id: "CS-006", manifestCode: "MF-2026-0417", vehicleNumber: "KA-01-KL-2345", expectedBags: 600, expectedBoxes: 0, countedBags: 600, countedBoxes: 0, totalExpected: 600, totalCounted: 600, discrepancy: 0, confidenceAvg: 99.4, status: "matched", zone: "Zone B", camera: "CAM-02", timestamp: "06:20 AM" },
];

export const BATCH_TALLIES: BatchTally[] = [
  { id: "BT-001", batchCode: "B2025-1022", product: "OPC Cement 53", expected: 500, counted: 498, variance: -2, variancePct: -0.4, status: "mismatch", timestamp: "10:24 AM" },
  { id: "BT-002", batchCode: "B2025-1023", product: "Steel Coils Grade 2", expected: 200, counted: 200, variance: 0, variancePct: 0, status: "matched", timestamp: "09:45 AM" },
  { id: "BT-003", batchCode: "B2025-1019", product: "PPC Cement 33", expected: 300, counted: 293, variance: -7, variancePct: -2.3, status: "mismatch", timestamp: "08:30 AM" },
  { id: "BT-004", batchCode: "B2025-1021", product: "Fertilizer Grade A", expected: 450, counted: 450, variance: 0, variancePct: 0, status: "matched", timestamp: "07:15 AM" },
  { id: "BT-005", batchCode: "B2025-1018", product: "Chemicals HAZ-3", expected: 150, counted: 148, variance: -2, variancePct: -1.3, status: "mismatch", timestamp: "06:50 AM" },
];

export const COUNT_TIMESERIES: CountTimeSeries[] = [
  { time: "06:00", bags: 0, boxes: 0, pallets: 0, total: 0, cumulative: 0 },
  { time: "07:00", bags: 120, boxes: 15, pallets: 2, total: 137, cumulative: 137 },
  { time: "08:00", bags: 285, boxes: 38, pallets: 5, total: 328, cumulative: 465 },
  { time: "09:00", bags: 410, boxes: 52, pallets: 8, total: 470, cumulative: 935 },
  { time: "10:00", bags: 580, boxes: 70, pallets: 12, total: 662, cumulative: 1597 },
  { time: "11:00", bags: 720, boxes: 85, pallets: 15, total: 820, cumulative: 2417 },
  { time: "12:00", bags: 810, boxes: 95, pallets: 18, total: 923, cumulative: 3340 },
  { time: "13:00", bags: 780, boxes: 88, pallets: 14, total: 882, cumulative: 4222 },
  { time: "14:00", bags: 850, boxes: 102, pallets: 16, total: 968, cumulative: 5190 },
  { time: "15:00", bags: 920, boxes: 110, pallets: 20, total: 1050, cumulative: 6240 },
  { time: "16:00", bags: 680, boxes: 78, pallets: 10, total: 768, cumulative: 7008 },
  { time: "17:00", bags: 420, boxes: 45, pallets: 6, total: 471, cumulative: 7479 },
];

export const ZONE_DETAILS: ZoneDetail[] = [
  { id: "Z-A01", code: "A", name: "Storage Bay A — Cement", type: "storage", floor: "ground", areaSqm: 2400, maxCapacity: 1000, currentOccupancy: 810, utilizationPct: 81, status: "warning", polygon: [[50, 50], [350, 50], [350, 250], [50, 250]], densityPerSqm: 0.34, products: ["OPC Cement 53", "PPC Cement 33"], lastUpdated: "2m ago" },
  { id: "Z-B01", code: "B", name: "Storage Bay B — Fertilizers", type: "storage", floor: "ground", areaSqm: 2800, maxCapacity: 1000, currentOccupancy: 450, utilizationPct: 45, status: "normal", polygon: [[400, 50], [700, 50], [700, 250], [400, 250]], densityPerSqm: 0.16, products: ["Fertilizer Grade A", "Fertilizer Grade B"], lastUpdated: "15m ago" },
  { id: "Z-C01", code: "C", name: "Hazmat Storage C", type: "hazmat", floor: "ground", areaSqm: 1600, maxCapacity: 800, currentOccupancy: 595, utilizationPct: 74.4, status: "normal", polygon: [[50, 300], [350, 300], [350, 500], [50, 500]], densityPerSqm: 0.37, products: ["Chemicals HAZ-3", "OPC Cement 43"], lastUpdated: "8m ago" },
  { id: "Z-D01", code: "D", name: "Heavy Materials D", type: "storage", floor: "ground", areaSqm: 3200, maxCapacity: 1200, currentOccupancy: 1092, utilizationPct: 91, status: "critical", polygon: [[400, 300], [700, 300], [700, 500], [400, 500]], densityPerSqm: 0.34, products: ["Steel Coils Grade 2", "Staging"], lastUpdated: "1m ago" },
  { id: "Z-L01", code: "L", name: "Loading Dock", type: "loading", floor: "ground", areaSqm: 1200, maxCapacity: 200, currentOccupancy: 45, utilizationPct: 22.5, status: "normal", polygon: [[750, 50], [950, 50], [950, 250], [750, 250]], densityPerSqm: 0.04, products: [], lastUpdated: "5m ago" },
  { id: "Z-S01", code: "S", name: "Staging Area", type: "staging", floor: "ground", areaSqm: 1800, maxCapacity: 400, currentOccupancy: 150, utilizationPct: 37.5, status: "normal", polygon: [[750, 300], [950, 300], [950, 500], [750, 500]], densityPerSqm: 0.08, products: [], lastUpdated: "45m ago" },
];

export const ZONE_HISTORY_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

export const ZONE_HISTORY: Record<string, ZoneHistory[]> = {
  A: [
    { timestamp: "Apr", utilization: 72, occupancy: 720 },
    { timestamp: "May", utilization: 68, occupancy: 680 },
    { timestamp: "Jun", utilization: 75, occupancy: 750 },
    { timestamp: "Jul", utilization: 80, occupancy: 800 },
    { timestamp: "Aug", utilization: 85, occupancy: 850 },
    { timestamp: "Sep", utilization: 78, occupancy: 780 },
    { timestamp: "Oct", utilization: 82, occupancy: 820 },
    { timestamp: "Nov", utilization: 88, occupancy: 880 },
    { timestamp: "Dec", utilization: 90, occupancy: 900 },
    { timestamp: "Jan", utilization: 79, occupancy: 790 },
    { timestamp: "Feb", utilization: 76, occupancy: 760 },
    { timestamp: "Mar", utilization: 81, occupancy: 810 },
  ],
  B: [
    { timestamp: "Apr", utilization: 55, occupancy: 550 },
    { timestamp: "May", utilization: 48, occupancy: 480 },
    { timestamp: "Jun", utilization: 52, occupancy: 520 },
    { timestamp: "Jul", utilization: 60, occupancy: 600 },
    { timestamp: "Aug", utilization: 58, occupancy: 580 },
    { timestamp: "Sep", utilization: 50, occupancy: 500 },
    { timestamp: "Oct", utilization: 45, occupancy: 450 },
    { timestamp: "Nov", utilization: 42, occupancy: 420 },
    { timestamp: "Dec", utilization: 55, occupancy: 550 },
    { timestamp: "Jan", utilization: 48, occupancy: 480 },
    { timestamp: "Feb", utilization: 50, occupancy: 500 },
    { timestamp: "Mar", utilization: 45, occupancy: 450 },
  ],
  C: [
    { timestamp: "Apr", utilization: 65, occupancy: 520 },
    { timestamp: "May", utilization: 70, occupancy: 560 },
    { timestamp: "Jun", utilization: 68, occupancy: 544 },
    { timestamp: "Jul", utilization: 72, occupancy: 576 },
    { timestamp: "Aug", utilization: 78, occupancy: 624 },
    { timestamp: "Sep", utilization: 74, occupancy: 592 },
    { timestamp: "Oct", utilization: 80, occupancy: 640 },
    { timestamp: "Nov", utilization: 76, occupancy: 608 },
    { timestamp: "Dec", utilization: 82, occupancy: 656 },
    { timestamp: "Jan", utilization: 71, occupancy: 568 },
    { timestamp: "Feb", utilization: 69, occupancy: 552 },
    { timestamp: "Mar", utilization: 74, occupancy: 595 },
  ],
  D: [
    { timestamp: "Apr", utilization: 82, occupancy: 984 },
    { timestamp: "May", utilization: 78, occupancy: 936 },
    { timestamp: "Jun", utilization: 85, occupancy: 1020 },
    { timestamp: "Jul", utilization: 88, occupancy: 1056 },
    { timestamp: "Aug", utilization: 92, occupancy: 1104 },
    { timestamp: "Sep", utilization: 86, occupancy: 1032 },
    { timestamp: "Oct", utilization: 89, occupancy: 1068 },
    { timestamp: "Nov", utilization: 94, occupancy: 1128 },
    { timestamp: "Dec", utilization: 96, occupancy: 1152 },
    { timestamp: "Jan", utilization: 88, occupancy: 1056 },
    { timestamp: "Feb", utilization: 85, occupancy: 1020 },
    { timestamp: "Mar", utilization: 91, occupancy: 1092 },
  ],
};

export const CAPACITY_THRESHOLDS = {
  warning: 80,
  critical: 95,
};

export function densityColor(density: number): string {
  if (density >= 0.35) return "#F04A4A";
  if (density >= 0.25) return "#F5A623";
  return "#22D3A1";
}

export function statusColor(status: string): string {
  if (status === "critical") return "#F04A4A";
  if (status === "warning") return "#F5A623";
  return "#22D3A1";
}

export function reconciliationColor(status: string): string {
  if (status === "mismatch") return "#F04A4A";
  if (status === "pending") return "#F5A623";
  return "#22D3A1";
}
