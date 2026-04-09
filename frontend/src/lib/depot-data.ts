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
