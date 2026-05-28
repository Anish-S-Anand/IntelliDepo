"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield,
  Car,
  UserPlus,
  Clock,
  CheckCircle2,
  Search,
  DoorOpen,
  DoorClosed,
  ScanLine,
  ArrowDownUp,
  ArrowRightLeft,
  Plus,
  X,
  LogOut,
  Ban,
  ClipboardList,
  Users,
  Camera,
  Calendar,
} from "lucide-react";
import {
  getGates,
  gateAction,
  getVehicles,
  getVehicleFootageMap,
  registerVehicle,
  blacklistVehicle,
  processLprScan,
  getAccessLogs,
  getActiveVisitors,
  registerVisitor,
  checkoutVisitor,
  type GateResponse,
  type VehicleResponse,
  type AccessLogResponse,
  type VisitorResponse,
} from "@/services/depotGate";
import { getCameraSnapshotUrl } from "@/services/depotCommand";
import { exportVehicleLog, downloadCsv } from "@/lib/exportUtils";

// ---------------------------------------------------------------------------
// Decision colors
// ---------------------------------------------------------------------------

const DECISION_COLORS: Record<string, string> = {
  granted: "#22D3A1",
  denied: "#F04A4A",
  blacklisted: "#F04A4A",
  pending: "#F5A623",
};

function decisionColor(d: string): string {
  return DECISION_COLORS[d.toLowerCase()] || "#8A9BBF";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isGateConsoleGate(gate: GateResponse): boolean {
  return gate.gate_type === "entry" || gate.gate_type === "exit";
}

function isGateConsoleLog(log: AccessLogResponse): boolean {
  return log.gate_code === "GATE-A" || log.gate_code === "GATE-B";
}

function getBackendBaseUrl(): string {
  if (typeof window === "undefined") return "http://localhost:8000";
  return `${window.location.protocol}//${window.location.hostname}:8000`;
}

// Hardcoded fallback map: normalised plate → filename
const PLATE_FOOTAGE_MAP: Record<string, string> = {
  KA01AB1234: "/vehicles/gate-entry/KA01AB1234.png",
  MH02CD5678: "/vehicles/gate-entry/MH02CD5678.png",
  TN04AB1234: "/vehicles/gate-entry/TN04AB1234.png",
  AP09MN6789: "/vehicles/gate-entry/AP09MN6789.png",
};
function getFootageUrl(plateNumber: string, dynamicMap?: Record<string, string>): string | null {
  const normalized = plateNumber.replace(/[\s\-\.]/g, "").toUpperCase();
  const localAsset = PLATE_FOOTAGE_MAP[normalized];
  if (localAsset) return localAsset;

  // Try dynamic map from backend first
  if (dynamicMap) {
    const key = Object.keys(dynamicMap).find(
      (k) => normalized.includes(k.toUpperCase()) || k.toUpperCase().includes(normalized)
    );
    if (key) return `${getBackendBaseUrl()}${dynamicMap[key]}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Vehicle status badge config
// ---------------------------------------------------------------------------

const VEHICLE_STATUS: Record<string, { color: string; bg: string; border: string }> = {
  registered: { color: "#22D3A1", bg: "rgba(34,211,161,0.08)", border: "rgba(34,211,161,0.25)" },
  blacklisted: { color: "#F04A4A", bg: "rgba(240,74,74,0.08)", border: "rgba(240,74,74,0.25)" },
  temporary: { color: "#3b82f6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)" },
  expired: { color: "#6b7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.25)" },
};

// ---------------------------------------------------------------------------
// Pass expiry countdown
// Uses a shared "tick" prop so the parent drives a single interval instead
// of mounting one setInterval per visitor row.
// ---------------------------------------------------------------------------

function ExpiryCountdown({ expiresAt, tick }: { expiresAt: string; tick: number }) {
  const remaining = useMemo(() => {
    const diff = new Date(expiresAt).getTime() - tick;
    return Math.max(0, Math.floor(diff / 1000));
  }, [expiresAt, tick]);

  if (remaining <= 0) {
    return <span className="text-[10px] text-[#F04A4A] font-semibold">EXPIRED</span>;
  }

  const hrs = Math.floor(remaining / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  const secs = remaining % 60;

  return (
    <span className={`text-[10px] font-mono ${remaining < 600 ? "text-[#F04A4A]" : "text-[#F5A623]"}`}>
      <Clock className="w-3 h-3 inline mr-0.5" />
      {hrs > 0 && `${hrs}h `}{mins}m {secs.toString().padStart(2, "0")}s
    </span>
  );
}

// ---------------------------------------------------------------------------
// Register Visitor Modal
// ---------------------------------------------------------------------------

function RegisterVisitorModal({
  gates,
  onClose,
  onSubmit,
}: {
  gates: GateResponse[];
  onClose: () => void;
  onSubmit: (data: Parameters<typeof registerVisitor>[0]) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    company: "",
    purpose: "",
    contact_number: "",
    id_proof_type: "Aadhaar",
    id_proof_number: "",
    vehicle_plate: "",
    host_name: "",
    gate_id: gates[0]?.id ?? "",
    pass_valid_hours: 4,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!form.gate_id && gates.length > 0) {
      setForm((prev) => ({ ...prev, gate_id: gates[0].id }));
    }
  }, [form.gate_id, gates]);

  const set = (key: string, val: string | number) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handle = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    onSubmit({
      name: form.name,
      company: form.company || undefined,
      purpose: form.purpose || undefined,
      contact_number: form.contact_number || undefined,
      id_proof_type: form.id_proof_type || undefined,
      id_proof_number: form.id_proof_number || undefined,
      vehicle_plate: form.vehicle_plate || undefined,
      host_name: form.host_name || undefined,
      gate_id: form.gate_id || undefined,
      pass_valid_hours: form.pass_valid_hours,
    });
  };

  const inputCls =
    "w-full bg-[#0D1526] border border-[#1E2F50] rounded-lg px-3 py-2 text-[12px] text-[#E8EDF8] placeholder:text-[#4E6090] focus:outline-none focus:border-[#E5521A]/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-[16px] border border-[#1E2F50] bg-[#14203A] shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E2F50]">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#E5521A]" />
            <h3 className="text-[14px] font-bold text-[#E8EDF8]">Register Visitor</h3>
          </div>
          <button type="button" onClick={onClose} className="text-[#4E6090] hover:text-[#E8EDF8]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
          <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Name *</label>
            <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Visitor full name" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Contact Number</label>
            <input className={inputCls} value={form.contact_number} onChange={(e) => set("contact_number", e.target.value)} placeholder="+91 ..." />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">ID Proof Type</label>
            <select className={inputCls} value={form.id_proof_type} onChange={(e) => set("id_proof_type", e.target.value)}>
              <option value="Aadhaar">Aadhaar</option>
              <option value="PAN">PAN</option>
              <option value="Driving License">Driving License</option>
              <option value="Passport">Passport</option>
              <option value="Voter ID">Voter ID</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Vehicle Plate</label>
            <input className={inputCls} value={form.vehicle_plate} onChange={(e) => set("vehicle_plate", e.target.value)} placeholder="KA-01-XX-1234" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Gate</label>
            <select className={inputCls} value={form.gate_id} onChange={(e) => set("gate_id", e.target.value)}>
              {gates.length === 0 ? (
                <option value="">No gates configured</option>
              ) : gates.map((gate) => (
                <option key={gate.id} value={gate.id}>
                  {gate.gate_code} - {gate.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Pass Hours</label>
            <input type="number" min={1} max={72} className={inputCls} value={form.pass_valid_hours} onChange={(e) => set("pass_valid_hours", Number(e.target.value))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#1E2F50]">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[#1E2F50] text-[12px] text-[#8A9BBF] hover:border-[#2A3F68]">Cancel</button>
          <button
            type="button"
            onClick={handle}
            disabled={!form.name.trim() || submitting}
            className="px-4 py-2 rounded-lg bg-[#E5521A] text-white text-[12px] font-semibold hover:bg-[#E5521A]/90 disabled:opacity-50"
          >
            {submitting ? "Registering..." : "Register Visitor"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Register Vehicle Modal
// ---------------------------------------------------------------------------

function RegisterVehicleModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: Parameters<typeof registerVehicle>[0]) => void;
}) {
  const [form, setForm] = useState({
    plate_number: "",
    vehicle_type: "truck",
    owner_name: "",
    company: "",
    status: "registered",
    valid_until: "",
  });
  const [uploadedDocs, setUploadedDocs] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: string, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setUploadedDocs((prev) => [...prev, ...filesArray]);
    }
  };

  const removeDoc = (index: number) => {
    setUploadedDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const inputCls =
    "w-full bg-[#0D1526] border border-[#1E2F50] rounded-lg px-3 py-2 text-[12px] text-[#E8EDF8] placeholder:text-[#4E6090] focus:outline-none focus:border-[#E5521A]/50";

  const handle = async () => {
    if (!form.plate_number.trim()) return;
    setSubmitting(true);
    onSubmit({
      plate_number: form.plate_number,
      vehicle_type: form.vehicle_type || undefined,
      owner_name: form.owner_name || undefined,
      company: form.company || undefined,
      status: form.status || undefined,
      valid_until: form.valid_until || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-[16px] border border-[#1E2F50] bg-[#14203A] shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E2F50]">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-[#E5521A]" />
            <h3 className="text-[14px] font-bold text-[#E8EDF8]">Register Vehicle</h3>
          </div>
          <button type="button" onClick={onClose} className="text-[#4E6090] hover:text-[#E8EDF8]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Plate Number *</label>
            <input className={inputCls} value={form.plate_number} onChange={(e) => set("plate_number", e.target.value.toUpperCase())} placeholder="KA-01-AB-1234" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Type</label>
              <select className={inputCls} value={form.vehicle_type} onChange={(e) => set("vehicle_type", e.target.value)}>
                <option value="truck">Truck</option>
                <option value="van">Van</option>
                <option value="car">Car</option>
                <option value="bike">Bike</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Status</label>
              <select className={inputCls} value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="registered">Registered</option>
                <option value="temporary">Temporary</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Owner Name</label>
            <input className={inputCls} value={form.owner_name} onChange={(e) => set("owner_name", e.target.value)} placeholder="Owner name" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Add Docs</label>
            <div className="space-y-2">
              <label className="flex items-center justify-center gap-2 w-full bg-[#0D1526] border border-dashed border-[#1E2F50] rounded-lg px-3 py-3 text-[12px] text-[#8A9BBF] hover:border-[#E5521A]/50 hover:text-[#E8EDF8] cursor-pointer transition">
                <Plus className="w-4 h-4" />
                <span>Upload Documents (PDF, JPG, PNG)</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {uploadedDocs.length > 0 && (
                <div className="space-y-1">
                  {uploadedDocs.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-[#0D1526] border border-[#1E2F50] rounded-lg px-3 py-2"
                    >
                      <span className="text-[11px] text-[#E8EDF8] truncate flex-1">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeDoc(idx)}
                        className="text-[#F04A4A] hover:text-[#F04A4A]/80 ml-2"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {form.status === "temporary" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Valid Until</label>
              <input type="datetime-local" className={inputCls} value={form.valid_until} onChange={(e) => set("valid_until", e.target.value)} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#1E2F50]">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[#1E2F50] text-[12px] text-[#8A9BBF] hover:border-[#2A3F68]">Cancel</button>
          <button
            type="button"
            onClick={handle}
            disabled={!form.plate_number.trim() || submitting}
            className="px-4 py-2 rounded-lg bg-[#E5521A] text-white text-[12px] font-semibold hover:bg-[#E5521A]/90 disabled:opacity-50"
          >
            {submitting ? "Registering..." : "Register Vehicle"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main GateConsolePage
// ---------------------------------------------------------------------------

export default function GateConsolePage() {
  // --- State ---
  const [gates, setGates] = useState<GateResponse[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLogResponse[]>([]);
  const [vehicles, setVehicles] = useState<VehicleResponse[]>([]);
  const [visitors, setVisitors] = useState<VisitorResponse[]>([]);
  const [footageMap, setFootageMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // LPR Scanner
  const [scanPlate, setScanPlate] = useState("");
  const [scanGateId, setScanGateId] = useState("");
  const [scanDirection, setScanDirection] = useState<"entry" | "exit">("entry");
  const [scanResult, setScanResult] = useState<AccessLogResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");

  // Access log filters
  const [logSearch, setLogSearch] = useState("");
  
  // Visitor date filter
  const [visitorDate, setVisitorDate] = useState("");

  // Vehicle blacklist
  const [blacklistTarget, setBlacklistTarget] = useState<string | null>(null);
  const [blacklistReason, setBlacklistReason] = useState("");

  // Modals
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showAnalysisImage, setShowAnalysisImage] = useState(false);
  const [selectedPlateNumber, setSelectedPlateNumber] = useState<string>("");
  const [footageMissing, setFootageMissing] = useState(false);
  const [showLicenseCard, setShowLicenseCard] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleResponse | null>(null);
  const [showFootageModal, setShowFootageModal] = useState(false);
  const [selectedFootageUrl, setSelectedFootageUrl] = useState<string | null>(null);

  // Gate toggling
  const [togglingGate, setTogglingGate] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  // Shared countdown ticker for ExpiryCountdown — one interval instead of N per visitor row
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // --- Data loading ---
  const loadGates = useCallback(async () => {
    try {
      const data = await getGates();
      if (data.length === 0) {
        // Add dummy gate data as fallback
        const dummyGates: GateResponse[] = [
          {
            id: "gate-a",
            gate_code: "GATE-A",
            name: "Gate A - North Entry",
            gate_type: "entry",
            status: "open",
            is_active: true,
            last_opened: new Date().toISOString(),
            last_closed: null,
            camera_id: null,
            total_entries_today: 2,
            created_at: new Date().toISOString(),
          },
          {
            id: "gate-b",
            gate_code: "GATE-B",
            name: "Gate B - South Exit",
            gate_type: "exit",
            status: "closed",
            is_active: true,
            last_opened: new Date().toISOString(),
            last_closed: null,
            camera_id: null,
            total_entries_today: 0,
            created_at: new Date().toISOString(),
          },
        ];
        setGates(dummyGates);
        if (!scanGateId) setScanGateId(dummyGates[0].id);
      } else {
        const consoleGates = data.filter(isGateConsoleGate);
        setGates(consoleGates);
        if (!scanGateId && consoleGates.length > 0) setScanGateId(consoleGates[0].id);
      }
    } catch {
      // Fallback to dummy data on error
      const dummyGates: GateResponse[] = [
        {
          id: "gate-a",
          gate_code: "GATE-A",
          name: "Gate A - North Entry",
          gate_type: "entry",
          status: "open",
          is_active: true,
          last_opened: new Date().toISOString(),
          last_closed: null,
          camera_id: null,
          total_entries_today: 2,
          created_at: new Date().toISOString(),
        },
        {
          id: "gate-b",
          gate_code: "GATE-B",
          name: "Gate B - South Exit",
          gate_type: "exit",
          status: "closed",
          is_active: true,
          last_opened: new Date().toISOString(),
          last_closed: null,
          camera_id: null,
          total_entries_today: 0,
          created_at: new Date().toISOString(),
        },
      ];
      setGates(dummyGates);
      if (!scanGateId) setScanGateId(dummyGates[0].id);
    }
  }, [scanGateId]);

  const buildGateEntryDemoLogs = (): AccessLogResponse[] => {
    const now = new Date();
    const rows = [
      { id: "log-1", plate: "KA01AB1234", confidence: 0.96, offsetMinutes: 120, vehicleId: "veh-1" },
      { id: "log-2", plate: "MH02CD5678", confidence: 0.92, offsetMinutes: 225, vehicleId: "veh-2" },
      { id: "log-3", plate: "TN-04-AB-1234", confidence: 0.94, offsetMinutes: 315, vehicleId: "veh-3" },
      { id: "log-4", plate: "AP-09-MN-6789", confidence: 0.91, offsetMinutes: 360, vehicleId: "veh-4" },
    ];

    return rows.map((row) => {
      const timestamp = new Date(now.getTime() - row.offsetMinutes * 60000).toISOString();
      return {
        id: row.id,
        gate_id: "gate-a",
        gate_code: "GATE-A",
        plate_number: row.plate,
        direction: "entry",
        decision: "granted",
        plate_confidence: row.confidence,
        vehicle_id: row.vehicleId,
        denied_reason: null,
        processed_at: timestamp,
        created_at: timestamp,
      };
    });
  };

  const loadLogs = useCallback(async () => {
    try {
      const data = await getAccessLogs({ limit: 20 });
      // Filter out the first entry with plate AP02BE1874 or any entry that should be removed
      const filteredData = data.filter(log =>
        isGateConsoleLog(log)
        && log.plate_number !== "AP02BE1874"
        && log.plate_number !== "RJ-14-LJ-7880"
        && log.plate_number !== "RJ-14-IJ-7890"
      );

      if (filteredData.length === 0) {
        setAccessLogs(buildGateEntryDemoLogs());
      } else {
        setAccessLogs(filteredData);
      }
    } catch {
      setAccessLogs(buildGateEntryDemoLogs());
    }
  }, []);

  const loadVehicles = useCallback(async () => {
    try {
      const data = await getVehicles();
      if (data.length === 0) {
        // Add dummy data with new vehicle footage
        const dummyVehicles: VehicleResponse[] = [
          {
            id: "veh-1",
            plate_number: "KA01AB1234",
            vehicle_type: "Truck",
            owner_name: "Rajesh Kumar",
            company: "Cement Logistics",
            status: "registered",
            blacklist_reason: null,
            valid_until: null,
            is_active: true,
            footage_url: getFootageUrl("KA01AB1234"),
            created_at: new Date(Date.now() - 30 * 24 * 60 * 60000).toISOString(),
          },
          {
            id: "veh-2",
            plate_number: "MH02CD5678",
            vehicle_type: "Truck",
            owner_name: "Priya Sharma",
            company: "Logistics Express",
            status: "registered",
            blacklist_reason: null,
            valid_until: null,
            is_active: true,
            footage_url: getFootageUrl("MH02CD5678"),
            created_at: new Date(Date.now() - 45 * 24 * 60 * 60000).toISOString(),
          },
          {
            id: "veh-3",
            plate_number: "TN-04-AB-1234",
            vehicle_type: "Truck",
            owner_name: "Amit Patel",
            company: "Premium Cement Carriers",
            status: "registered",
            blacklist_reason: null,
            valid_until: null,
            is_active: true,
            footage_url: getFootageUrl("TN-04-AB-1234"),
            created_at: new Date(Date.now() - 60 * 24 * 60 * 60000).toISOString(),
          },
          {
            id: "veh-4",
            plate_number: "AP-09-MN-6789",
            vehicle_type: "Truck",
            owner_name: "Sunita Reddy",
            company: "Delivery Services",
            status: "registered",
            blacklist_reason: null,
            valid_until: null,
            is_active: true,
            footage_url: getFootageUrl("AP-09-MN-6789"),
            created_at: new Date(Date.now() - 15 * 24 * 60 * 60000).toISOString(),
          },
        ];
        setVehicles(dummyVehicles);
      } else {
        // Fetch footage map from backend and enrich vehicles
        const map = await getVehicleFootageMap();
        setFootageMap(map);
        setVehicles(data.map((v) => ({
          ...v,
          footage_url: v.footage_url || getFootageUrl(v.plate_number, map),
        })));
      }
    } catch {
      // Fallback to dummy data on error
      const dummyVehicles: VehicleResponse[] = [
        {
          id: "veh-1",
          plate_number: "KA01AB1234",
          vehicle_type: "Truck",
          owner_name: "Rajesh Kumar",
          company: "Cement Logistics",
          status: "registered",
          blacklist_reason: null,
          valid_until: null,
          is_active: true,
          footage_url: getFootageUrl("KA01AB1234"),
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60000).toISOString(),
        },
        {
          id: "veh-2",
          plate_number: "MH02CD5678",
          vehicle_type: "Truck",
          owner_name: "Priya Sharma",
          company: "Logistics Express",
          status: "registered",
          blacklist_reason: null,
          valid_until: null,
          is_active: true,
          footage_url: getFootageUrl("MH02CD5678"),
          created_at: new Date(Date.now() - 45 * 24 * 60 * 60000).toISOString(),
        },
        {
          id: "veh-3",
          plate_number: "TN-04-AB-1234",
          vehicle_type: "Truck",
          owner_name: "Amit Patel",
          company: "Premium Cement Carriers",
          status: "registered",
          blacklist_reason: null,
          valid_until: null,
          is_active: true,
          footage_url: getFootageUrl("TN-04-AB-1234"),
          created_at: new Date(Date.now() - 60 * 24 * 60 * 60000).toISOString(),
        },
        {
          id: "veh-4",
          plate_number: "AP-09-MN-6789",
          vehicle_type: "Truck",
          owner_name: "Sunita Reddy",
          company: "Delivery Services",
          status: "registered",
          blacklist_reason: null,
          valid_until: null,
          is_active: true,
          footage_url: getFootageUrl("AP-09-MN-6789"),
          created_at: new Date(Date.now() - 15 * 24 * 60 * 60000).toISOString(),
        },
      ];
      setVehicles(dummyVehicles);
    }
  }, []);

  const loadVisitors = useCallback(async () => {
    try {
      const data = await getActiveVisitors();
      if (data.length === 0) {
        // Add realistic dummy visitor data
        const now = new Date();
        const dummyVisitors: VisitorResponse[] = [
          {
            id: "vis-1",
            name: "Rajesh Kumar",
            company: "Tech Solutions Pvt Ltd",
            purpose: "Client meeting",
            contact_number: "+91-9876543210",
            id_proof_type: "Aadhaar",
            id_proof_number: "XXXX-XXXX-1234",
            host_name: "Priya Sharma",
            gate_id: null,
            vehicle_plate: "KA01AB1234",
            status: "checked_in",
            checked_in_at: new Date(now.getTime() - 1 * 60 * 60000 - 30 * 60000).toISOString(),
            checked_out_at: null,
            pass_valid_until: new Date(now.getTime() + 2 * 60 * 60000 + 30 * 60000).toISOString(),
            registered_by: "gate-operator",
            created_at: new Date(now.getTime() - 1 * 60 * 60000 - 30 * 60000).toISOString(),
          },
          {
            id: "vis-2",
            name: "Ananya Reddy",
            company: "Logistics Express",
            purpose: "Delivery coordination",
            contact_number: "+91-9123456789",
            id_proof_type: "PAN",
            id_proof_number: "ABCDE1234F",
            host_name: "Amit Patel",
            gate_id: null,
            vehicle_plate: "MH02CD5678",
            status: "checked_in",
            checked_in_at: new Date(now.getTime() - 45 * 60000).toISOString(),
            checked_out_at: null,
            pass_valid_until: new Date(now.getTime() + 3 * 60 * 60000 + 15 * 60000).toISOString(),
            registered_by: "gate-operator",
            created_at: new Date(now.getTime() - 45 * 60000).toISOString(),
          },
          {
            id: "vis-3",
            name: "Vikram Singh",
            company: "Safety Audit Services",
            purpose: "Safety inspection",
            contact_number: "+91-9988776655",
            id_proof_type: "Passport",
            id_proof_number: "P1234567",
            host_name: "Site Manager",
            gate_id: null,
            vehicle_plate: "DL03EF9012",
            status: "checked_in",
            checked_in_at: new Date(now.getTime() - 2 * 60 * 60000 - 15 * 60000).toISOString(),
            checked_out_at: null,
            pass_valid_until: new Date(now.getTime() + 1 * 60 * 60000 + 45 * 60000).toISOString(),
            registered_by: "gate-operator",
            created_at: new Date(now.getTime() - 2 * 60 * 60000 - 15 * 60000).toISOString(),
          },
          {
            id: "vis-4",
            name: "Sunita Joshi",
            company: "Consulting Group",
            purpose: "Business consultation",
            contact_number: "+91-9112233445",
            id_proof_type: "Aadhaar",
            id_proof_number: "XXXX-XXXX-5678",
            host_name: "Operations Director",
            gate_id: null,
            vehicle_plate: "AP06KL2345",
            status: "checked_in",
            checked_in_at: new Date(now.getTime() - 30 * 60000).toISOString(),
            checked_out_at: null,
            pass_valid_until: new Date(now.getTime() + 3 * 60 * 60000 + 30 * 60000).toISOString(),
            registered_by: "gate-operator",
            created_at: new Date(now.getTime() - 30 * 60000).toISOString(),
          },
          {
            id: "vis-5",
            name: "Karthik Menon",
            company: "Equipment Maintenance Co",
            purpose: "Equipment servicing",
            contact_number: "+91-9556677889",
            id_proof_type: "Driving License",
            id_proof_number: "KA0120210012345",
            host_name: "Facility Manager",
            gate_id: null,
            vehicle_plate: "KA05IJ7890",
            status: "checked_in",
            checked_in_at: new Date(now.getTime() - 3 * 60 * 60000).toISOString(),
            checked_out_at: null,
            pass_valid_until: new Date(now.getTime() + 1 * 60 * 60000).toISOString(),
            registered_by: "gate-operator",
            created_at: new Date(now.getTime() - 3 * 60 * 60000).toISOString(),
          },
        ];
        setVisitors(dummyVisitors);
      } else {
        setVisitors(data);
      }
    } catch {
      // Fallback to dummy data
      const now = new Date();
      const dummyVisitors: VisitorResponse[] = [
        {
          id: "vis-1",
          name: "Rajesh Kumar",
          company: "Tech Solutions Pvt Ltd",
          purpose: "Client meeting",
          contact_number: "+91-9876543210",
          id_proof_type: "Aadhaar",
          id_proof_number: "XXXX-XXXX-1234",
          host_name: "Priya Sharma",
          gate_id: null,
          vehicle_plate: "KA01AB1234",
          status: "checked_in",
          checked_in_at: new Date(now.getTime() - 1 * 60 * 60000 - 30 * 60000).toISOString(),
          checked_out_at: null,
          pass_valid_until: new Date(now.getTime() + 2 * 60 * 60000 + 30 * 60000).toISOString(),
          registered_by: "gate-operator",
          created_at: new Date(now.getTime() - 1 * 60 * 60000 - 30 * 60000).toISOString(),
        },
        {
          id: "vis-2",
          name: "Ananya Reddy",
          company: "Logistics Express",
          purpose: "Delivery coordination",
          contact_number: "+91-9123456789",
          id_proof_type: "PAN",
          id_proof_number: "ABCDE1234F",
          host_name: "Amit Patel",
          gate_id: null,
          vehicle_plate: "MH02CD5678",
          status: "checked_in",
          checked_in_at: new Date(now.getTime() - 45 * 60000).toISOString(),
          checked_out_at: null,
          pass_valid_until: new Date(now.getTime() + 3 * 60 * 60000 + 15 * 60000).toISOString(),
          registered_by: "gate-operator",
          created_at: new Date(now.getTime() - 45 * 60000).toISOString(),
        },
        {
          id: "vis-3",
          name: "Vikram Singh",
          company: "Safety Audit Services",
          purpose: "Safety inspection",
          contact_number: "+91-9988776655",
          id_proof_type: "Passport",
          id_proof_number: "P1234567",
          host_name: "Site Manager",
          gate_id: null,
          vehicle_plate: "DL03EF9012",
          status: "checked_in",
          checked_in_at: new Date(now.getTime() - 2 * 60 * 60000 - 15 * 60000).toISOString(),
          checked_out_at: null,
          pass_valid_until: new Date(now.getTime() + 1 * 60 * 60000 + 45 * 60000).toISOString(),
          registered_by: "gate-operator",
          created_at: new Date(now.getTime() - 2 * 60 * 60000 - 15 * 60000).toISOString(),
        },
        {
          id: "vis-4",
          name: "Sunita Joshi",
          company: "Consulting Group",
          purpose: "Business consultation",
          contact_number: "+91-9112233445",
          id_proof_type: "Aadhaar",
          id_proof_number: "XXXX-XXXX-5678",
          host_name: "Operations Director",
          gate_id: null,
          vehicle_plate: "AP06KL2345",
          status: "checked_in",
          checked_in_at: new Date(now.getTime() - 30 * 60000).toISOString(),
          checked_out_at: null,
          pass_valid_until: new Date(now.getTime() + 3 * 60 * 60000 + 30 * 60000).toISOString(),
          registered_by: "gate-operator",
          created_at: new Date(now.getTime() - 30 * 60000).toISOString(),
        },
        {
          id: "vis-5",
          name: "Karthik Menon",
          company: "Equipment Maintenance Co",
          purpose: "Equipment servicing",
          contact_number: "+91-9556677889",
          id_proof_type: "Driving License",
          id_proof_number: "KA0120210012345",
          host_name: "Facility Manager",
          gate_id: null,
          vehicle_plate: "KA05IJ7890",
          status: "checked_in",
          checked_in_at: new Date(now.getTime() - 3 * 60 * 60000).toISOString(),
          checked_out_at: null,
          pass_valid_until: new Date(now.getTime() + 1 * 60 * 60000).toISOString(),
          registered_by: "gate-operator",
          created_at: new Date(now.getTime() - 3 * 60 * 60000).toISOString(),
        },
      ];
      setVisitors(dummyVisitors);
    }
  }, []);

  // Initial load
  useEffect(() => {
    // Load footage map independently so access log footage works even before vehicles load
    getVehicleFootageMap().then((map) => { if (Object.keys(map).length > 0) setFootageMap(map); }).catch(() => {});
    Promise.allSettled([loadGates(), loadLogs(), loadVehicles(), loadVisitors()]).then(() =>
      setLoading(false),
    );
  }, [loadGates, loadLogs, loadVehicles, loadVisitors]);

  // Auto-refresh: logs every 15s, gates+visitors every 30s
  useEffect(() => {
    const logInterval = setInterval(() => void loadLogs(), 15000);
    return () => clearInterval(logInterval);
  }, [loadLogs]);

  useEffect(() => {
    const gvInterval = setInterval(() => {
      void loadGates();
      void loadVisitors();
    }, 30000);
    return () => clearInterval(gvInterval);
  }, [loadGates, loadVisitors]);

  // --- Handlers ---
  const handleGateToggle = async (gate: GateResponse) => {
    setTogglingGate(gate.id);
    try {
      const action = gate.status === "open" ? "close" : "open";
      await gateAction(gate.id, action);
      await loadGates();
    } finally {
      setTogglingGate(null);
    }
  };

  const buildLocalScanResult = (plate: string, direction: "entry" | "exit"): AccessLogResponse => {
    const selectedGate = gates.find((gate) => gate.id === scanGateId);
    const vehicle = vehicles.find((item) => item.plate_number.replace(/[^A-Z0-9]/gi, "").toUpperCase() === plate);
    const isBlacklisted = vehicle?.status === "blacklisted";
    const decision = isBlacklisted ? "blacklisted" : vehicle ? "granted" : "denied";
    const now = new Date().toISOString();

    return {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `local-${Date.now()}`,
      gate_id: scanGateId,
      gate_code: selectedGate?.gate_code ?? null,
      plate_number: plate,
      plate_confidence: 0.95,
      vehicle_id: vehicle?.id ?? null,
      decision,
      direction,
      denied_reason: decision === "denied" ? "Vehicle not registered" : isBlacklisted ? vehicle?.blacklist_reason || "Vehicle blacklisted" : null,
      processed_at: now,
      created_at: now,
    };
  };

  const handleScan = async (direction: "entry" | "exit" = scanDirection) => {
    const plate = scanPlate.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

    setScanDirection(direction);
    setScanError("");

    if (!plate) {
      setScanError("Enter a plate number before scanning.");
      return;
    }
    if (!scanGateId) {
      setScanError("Select a gate before scanning.");
      return;
    }

    setScanning(true);
    setScanResult(null);
    setScanPlate(plate);
    try {
      if (!isUuid(scanGateId)) {
        const localResult = buildLocalScanResult(plate, direction);
        setScanResult(localResult);
        setAccessLogs((prev) => [localResult, ...prev].slice(0, 20));
        return;
      }

      const result = await processLprScan({
        gate_id: scanGateId,
        plate_number: plate,
        confidence: 0.95,
        direction,
      });
      setScanResult(result);
      void loadLogs();
    } catch (error) {
      const localResult = buildLocalScanResult(plate, direction);
      setScanResult(localResult);
      setAccessLogs((prev) => [localResult, ...prev].slice(0, 20));
      setScanError(error instanceof Error ? `Backend scan unavailable, showing demo result. ${error.message}` : "Backend scan unavailable, showing demo result.");
    } finally {
      setScanning(false);
    }
  };

  const handleBlacklist = async (vehicleId: string) => {
    if (!blacklistReason.trim()) return;
    try {
      await blacklistVehicle(vehicleId, blacklistReason);
      setBlacklistTarget(null);
      setBlacklistReason("");
      await loadVehicles();
    } catch { /* failed */ }
  };

  const handleCheckout = async (visitorId: string) => {
    setCheckingOut(visitorId);
    try {
      await checkoutVisitor(visitorId);
      await loadVisitors();
    } finally {
      setCheckingOut(null);
    }
  };

  const handleRegisterVisitor = async (data: Parameters<typeof registerVisitor>[0]) => {
    try {
      await registerVisitor(data);
      setShowVisitorModal(false);
      await loadVisitors();
    } catch { /* failed */ }
  };

  const handleRegisterVehicle = async (data: Parameters<typeof registerVehicle>[0]) => {
    try {
      await registerVehicle(data);
      setShowVehicleModal(false);
      await loadVehicles();
    } catch { /* failed */ }
  };

  // --- Filtered logs ---
  const filteredLogs = useMemo(() => {
    const latestByPlate = new Map<string, AccessLogResponse>();

    for (const log of accessLogs) {
      const normalizedPlate = log.plate_number.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      if (logSearch && !normalizedPlate.includes(logSearch.replace(/[^A-Z0-9]/gi, "").toUpperCase())) {
        continue;
      }

      const current = latestByPlate.get(normalizedPlate);
      const currentTime = current ? new Date(current.processed_at || current.created_at).getTime() : 0;
      const nextTime = new Date(log.processed_at || log.created_at).getTime();
      if (!current || nextTime > currentTime) {
        latestByPlate.set(normalizedPlate, log);
      }
    }

    return Array.from(latestByPlate.values()).sort(
      (a, b) =>
        new Date(b.processed_at || b.created_at).getTime() -
        new Date(a.processed_at || a.created_at).getTime(),
    );
  }, [accessLogs, logSearch]);

  const filteredVisitors = useMemo(() => {
    const latestByVisitor = new Map<string, VisitorResponse>();
    const search = logSearch.trim().toLowerCase();

    for (const visitor of visitors) {
      if (visitorDate) {
        const visitorDateStr = new Date(visitor.checked_in_at).toISOString().split("T")[0];
        if (visitorDateStr !== visitorDate) continue;
      }

      const searchable = [
        visitor.name,
        visitor.company,
        visitor.purpose,
        visitor.vehicle_plate,
        visitor.host_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (search && !searchable.includes(search)) continue;

      const key = [
        visitor.name,
        visitor.company ?? "",
        visitor.purpose ?? "",
        visitor.vehicle_plate ?? "",
      ].join("|").toLowerCase();
      const current = latestByVisitor.get(key);
      const currentTime = current ? new Date(current.checked_in_at).getTime() : 0;
      const nextTime = new Date(visitor.checked_in_at).getTime();
      if (!current || nextTime > currentTime) {
        latestByVisitor.set(key, visitor);
      }
    }

    return Array.from(latestByVisitor.values()).sort(
      (a, b) => new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime(),
    );
  }, [logSearch, visitorDate, visitors]);

  // --- Render ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#4E6090] text-sm">
        Loading Gate Console...
      </div>
    );
  }

  return (
    <div className="p-5 bg-[#0D1526] min-h-screen animate-[fadeIn_0.3s_ease]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Shield className="w-5 h-5 text-[#E5521A]" />
        <h1
          className="text-[22px] font-extrabold text-[#E8EDF8]"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          Gate Control
        </h1>
      </div>

      {/* ================================================================= */}
      {/* ROW 1: Gate Status Bar + Live LPR Scanner                         */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* 1. Gate Status Bar */}
        <div className="xl:col-span-2 rounded-[16px] border border-[#1E2F50] bg-[#14203A] p-4">
          <h2 className="text-[12px] uppercase tracking-[0.15em] text-[#4E6090] mb-3 flex items-center gap-2">
            <DoorOpen className="w-4 h-4" /> Gate Status
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Gate In Column - Based on Access Log */}
            <div>
              <h3 className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-2 font-bold">Gate In</h3>
              <div className="space-y-2">
                {(() => {
                  const displayGates = gates.filter(g => g.gate_type === "entry");
                  
                  if (displayGates.length === 0) {
                    return <p className="text-[11px] text-[#4E6090]">No entry gates configured</p>;
                  }
                  
                  return displayGates.map((gate) => {
                    const isOpen = gate.status === "open";
                    const busy = togglingGate === gate.id;
                    return (
                      <button
                        key={gate.id}
                        type="button"
                        onClick={() => handleGateToggle(gate)}
                        disabled={busy}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left ${
                          isOpen
                            ? "border-emerald-500/30 bg-emerald-500/8 hover:bg-emerald-500/15"
                            : "border-[#1E2F50] bg-[#0D1526] hover:border-[#2A3F68]"
                        } ${busy ? "opacity-50" : ""}`}
                      >
                        {isOpen ? (
                          <DoorOpen className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <DoorClosed className="w-4 h-4 text-[#4E6090] flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-[#E8EDF8]">{gate.gate_code}</span>
                            <span
                              className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                                isOpen
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-slate-500/15 text-slate-400"
                              }`}
                            >
                              {gate.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] text-[#8A9BBF]">{gate.name}</span>
                            <span className="text-[9px] text-[#4E6090]">
                              {gate.total_entries_today} entries
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
            
            {/* Gate Out Column - Based on Access Log */}
            <div>
              <h3 className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-2 font-bold">Gate Out</h3>
              <div className="space-y-2">
                {(() => {
                  const displayGates = gates.filter(g => g.gate_type === "exit");
                  
                  if (displayGates.length === 0) {
                    return <p className="text-[11px] text-[#4E6090]">No exit gates configured</p>;
                  }
                  
                  return displayGates.map((gate) => {
                    const isOpen = gate.status === "open";
                    const busy = togglingGate === gate.id;
                    return (
                      <button
                        key={gate.id}
                        type="button"
                        onClick={() => handleGateToggle(gate)}
                        disabled={busy}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left ${
                          isOpen
                            ? "border-emerald-500/30 bg-emerald-500/8 hover:bg-emerald-500/15"
                            : "border-[#1E2F50] bg-[#0D1526] hover:border-[#2A3F68]"
                        } ${busy ? "opacity-50" : ""}`}
                      >
                        {isOpen ? (
                          <DoorOpen className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <DoorClosed className="w-4 h-4 text-[#4E6090] flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-[#E8EDF8]">{gate.gate_code}</span>
                            <span
                              className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                                isOpen
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-slate-500/15 text-slate-400"
                              }`}
                            >
                              {gate.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] text-[#8A9BBF]">{gate.name}</span>
                            <span className="text-[9px] text-[#4E6090]">
                              {gate.total_entries_today} exits
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Live LPR Scanner */}
        <div className="rounded-[16px] border border-[#1E2F50] bg-[#14203A] p-4">
          <h2 className="text-[12px] uppercase tracking-[0.15em] text-[#4E6090] mb-3 flex items-center gap-2">
            <ScanLine className="w-4 h-4" /> LPR Scanner
          </h2>

          {/* Gate Camera Feed */}
          {(() => {
            const selectedGate = gates.find((g) => g.id === scanGateId);
            if (!selectedGate) return null;

            if (!selectedGate.camera_id) {
              return null;
            }

            return (
              <div className="mb-3">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-[#0A1628] border border-[#1E2F50]">
                  <img
                    src={`${getCameraSnapshotUrl(selectedGate.camera_id)}?t=${Date.now()}`}
                    alt="Gate camera"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-[9px] text-emerald-400 font-mono">
                    {selectedGate.name} · LIVE
                  </div>
                </div>
                {/* Capture & Scan — placeholder for future /lpr/scan-image integration */}
                <button
                  type="button"
                  className="mt-2 w-full py-1.5 rounded-lg border border-[#5B9BF5]/30 bg-[#5B9BF5]/10 text-[#5B9BF5] text-[10px] font-semibold hover:bg-[#5B9BF5]/20 transition-colors flex items-center justify-center gap-1.5"
                  onClick={() => {
                    /* Future: POST snapshot to /lpr/scan-image for automated plate recognition */
                    console.log("Capture & Scan: will integrate with /lpr/scan-image");
                  }}
                >
                  <Camera className="w-3 h-3" />
                  Capture &amp; Scan
                </button>
              </div>
            );
          })()}

          <div className="space-y-2.5">
            <input
              className="w-full bg-[#0D1526] border border-[#1E2F50] rounded-lg px-3 py-2 text-[13px] font-mono text-[#E8EDF8] placeholder:text-[#4E6090] focus:outline-none focus:border-[#E5521A]/50 uppercase tracking-wider"
              placeholder="Enter plate number..."
              value={scanPlate}
              onChange={(e) => setScanPlate(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && void handleScan()}
            />
            <select
              className="w-full bg-[#0D1526] border border-[#1E2F50] rounded-lg px-3 py-2 text-[12px] text-[#E8EDF8] focus:outline-none focus:border-[#E5521A]/50"
              value={scanGateId}
              onChange={(e) => setScanGateId(e.target.value)}
            >
              {gates.map((g) => (
                <option key={g.id} value={g.id}>{g.gate_code} - {g.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleScan("entry")}
                disabled={scanning}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                  scanDirection === "entry"
                    ? "border-[#E5521A] bg-[#E5521A] text-white"
                    : "border-[#1E2F50] text-[#4E6090] hover:border-[#2A3F68]"
                } ${scanning ? "opacity-60 cursor-wait" : ""}`}
              >
                <ArrowDownUp className="w-3 h-3 inline mr-1" />
                {scanning && scanDirection === "entry" ? "Processing..." : "Entry"}
              </button>
              <button
                type="button"
                onClick={() => void handleScan("exit")}
                disabled={scanning}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                  scanDirection === "exit"
                    ? "border-[#E5521A] bg-[#E5521A] text-white"
                    : "border-[#1E2F50] text-[#4E6090] hover:border-[#2A3F68]"
                } ${scanning ? "opacity-60 cursor-wait" : ""}`}
              >
                <ArrowRightLeft className="w-3 h-3 inline mr-1" />
                {scanning && scanDirection === "exit" ? "Processing..." : "Exit"}
              </button>
            </div>
          </div>
          {scanError && (
            <div className="mt-3 rounded-lg border border-[#F04A4A]/25 bg-[#F04A4A]/10 px-3 py-2 text-[11px] font-semibold text-[#F04A4A]">
              {scanError}
            </div>
          )}
          {/* Scan Result */}
          {scanResult && (
            <div
              className="mt-3 p-3 rounded-xl border"
              style={{
                borderColor: `${decisionColor(scanResult.decision)}30`,
                background: `${decisionColor(scanResult.decision)}08`,
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[14px] font-mono font-bold text-[#E8EDF8]">
                  {scanResult.plate_number}
                </span>
                <span
                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                  style={{
                    color: decisionColor(scanResult.decision),
                    background: `${decisionColor(scanResult.decision)}15`,
                    border: `1px solid ${decisionColor(scanResult.decision)}30`,
                  }}
                >
                  {scanResult.decision}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-[#8A9BBF]">
                <span>Conf: {(scanResult.plate_confidence * 100).toFixed(1)}%</span>
                <span>{scanResult.direction}</span>
                {scanResult.denied_reason && (
                  <span className="text-[#F04A4A]">{scanResult.denied_reason}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* ROW 2: Access Log Feed                                            */}
      {/* ================================================================= */}
      <div className="rounded-[16px] border border-[#1E2F50] bg-[#14203A] p-4 mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-[12px] uppercase tracking-[0.15em] text-[#4E6090] flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> Access Log Feed
          </h2>
          <div className="flex items-center gap-2">
            {/* Export buttons */}
            <button
              type="button"
              onClick={() => exportVehicleLog(accessLogs.map((l) => ({ ...l, processed_at: l.processed_at || l.created_at })))}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-[#1E2F50] text-[#8A9BBF] hover:border-[#E5521A]/30 hover:text-[#E5521A] transition-colors"
            >
              PDF
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(
                `access-log-${new Date().toISOString().slice(0, 10)}.csv`,
                ["Time", "Gate", "Plate", "Direction", "Confidence"],
                accessLogs.map((l) => [
                  new Date(l.processed_at || l.created_at).toLocaleString(),
                  l.gate_code || "—", l.plate_number, l.direction,
                  l.plate_confidence,
                ]),
              )}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-[#1E2F50] text-[#8A9BBF] hover:border-[#22D3A1]/30 hover:text-[#22D3A1] transition-colors"
            >
              CSV
            </button>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4E6090]" />
              <input
                className="bg-[#0D1526] border border-[#1E2F50] rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-[#E8EDF8] placeholder:text-[#4E6090] focus:outline-none focus:border-[#E5521A]/50 w-36"
                placeholder="Search plate..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[9px] uppercase tracking-[0.15em] text-[#4E6090] border-b border-[#1E2F50]">
                <th className="pb-2 pr-3">Time</th>
                <th className="pb-2 pr-3">Gate</th>
                <th className="pb-2 pr-3">Plate</th>
                <th className="pb-2 pr-3">Direction</th>
                <th className="pb-2 pr-3">Footage</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-[#1E2F50]/50 hover:bg-[#0D1526]/50">
                  <td className="py-2 pr-3 text-[10px] text-[#8A9BBF] whitespace-nowrap">
                    {new Date(log.processed_at || log.created_at).toLocaleString("en-IN", {
                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
                    })}
                  </td>
                  <td className="py-2 pr-3 text-[11px] font-mono text-[#E8EDF8]">
                    {log.gate_code || "—"}
                  </td>
                  <td className="py-2 pr-3 text-[11px] font-mono font-bold text-[#E8EDF8]">
                    {log.plate_number}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="text-[9px] uppercase font-semibold text-[#8A9BBF] px-1.5 py-0.5 rounded bg-[#0D1526]">
                      {log.direction}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlateNumber(log.plate_number);
                        setFootageMissing(false);
                        setShowAnalysisImage(true);
                      }}
                      className="text-[11px] font-bold px-3 py-1 rounded-full border border-[#5B9BF5] text-[#5B9BF5] hover:bg-[#5B9BF5]/10 transition-colors cursor-pointer"
                    >
                      📊 Footage
                    </button>
                  </td>
                  <td className="hidden">
                    {log.denied_reason || "—"}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[11px] text-[#4E6090]">
                    No access logs matching filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================= */}
      {/* ROW 3: Vehicle Registry + Visitor Management                      */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* 4. Vehicle Registry & Blacklist Panel */}
        <div className="rounded-[16px] border border-[#1E2F50] bg-[#14203A] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] uppercase tracking-[0.15em] text-[#4E6090] flex items-center gap-2">
              <Car className="w-4 h-4" /> Vehicle Registry
            </h2>
            <button
              type="button"
              onClick={() => setShowVehicleModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E5521A] bg-[#E5521A] text-white text-[10px] font-semibold shadow-sm shadow-[#E5521A]/25 hover:bg-[#C94312] hover:border-[#C94312] transition-colors"
            >
              <Plus className="w-3 h-3" /> Register Vehicle
            </button>
          </div>

          <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#14203A]">
                <tr className="text-[9px] uppercase tracking-[0.15em] text-[#4E6090] border-b border-[#1E2F50]">
                  <th className="pb-2 pr-3">Plate</th>
                  <th className="pb-2 pr-3">Owner</th>
                  <th className="pb-2 pr-3">Footage</th>
                  <th className="pb-2 pr-3">Input</th>
                  <th className="pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.filter((v) => !!v.footage_url).map((v) => {
                  return (
                    <tr key={v.id} className="border-b border-[#1E2F50]/50 hover:bg-[#0D1526]/50">
                      <td className="py-2 pr-3 text-[11px] font-mono font-bold text-[#E8EDF8]">
                        {v.plate_number}
                      </td>
                      <td className="py-2 pr-3 text-[10px] text-[#8A9BBF]">
                        {v.owner_name || "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {v.footage_url ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFootageUrl(v.footage_url || null);
                              setShowFootageModal(true);
                            }}
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-[#22D3A1]/30 bg-[#22D3A1]/10 text-[#22D3A1] hover:bg-[#22D3A1]/20 transition-colors cursor-pointer"
                          >
                            📹 View
                          </button>
                        ) : (
                          <span className="text-[9px] text-[#4E6090]">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVehicle(v);
                            setShowLicenseCard(true);
                          }}
                          className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-[#5B9BF5]/30 bg-[#5B9BF5]/10 text-[#5B9BF5] hover:bg-[#5B9BF5]/20 transition-colors cursor-pointer"
                        >
                          📄 View Docs
                        </button>
                      </td>
                      <td className="py-2">
                        {v.status !== "blacklisted" && (
                          <>
                            {blacklistTarget === v.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  className="bg-[#0D1526] border border-[#1E2F50] rounded px-2 py-0.5 text-[10px] text-[#E8EDF8] w-24 focus:outline-none"
                                  placeholder="Reason..."
                                  value={blacklistReason}
                                  onChange={(e) => setBlacklistReason(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && handleBlacklist(v.id)}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleBlacklist(v.id)}
                                  className="text-[#F04A4A] hover:text-[#F04A4A]/80"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setBlacklistTarget(null); setBlacklistReason(""); }}
                                  className="text-[#4E6090] hover:text-[#8A9BBF]"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setBlacklistTarget(v.id)}
                                className="flex items-center gap-1 text-[9px] text-[#F04A4A] hover:text-[#F04A4A]/80 font-semibold"
                              >
                                <Ban className="w-3 h-3" /> Blacklist
                              </button>
                            )}
                          </>
                        )}
                        {v.status === "blacklisted" && (
                          <span className="text-[9px] text-[#4E6090] italic">
                            {v.blacklist_reason || "Blacklisted"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {vehicles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[11px] text-[#4E6090]">
                      No vehicles registered
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Visitor Management Panel */}
        <div className="rounded-[16px] border border-[#1E2F50] bg-[#14203A] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] uppercase tracking-[0.15em] text-[#4E6090] flex items-center gap-2">
              <Users className="w-4 h-4" /> Active Visitors
            </h2>
            <button
              type="button"
              onClick={() => setShowVisitorModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E5521A] bg-[#E5521A] text-white text-[10px] font-semibold shadow-sm shadow-[#E5521A]/25 hover:bg-[#C94312] hover:border-[#C94312] transition-colors"
            >
              <UserPlus className="w-3 h-3" /> Register Visitor
            </button>
          </div>

          {/* Compact Search Bar and Date Picker */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#4E6090]" />
              <input
                className="w-full bg-[#0D1526] border border-[#1E2F50] rounded-lg pl-7 pr-2 py-1.5 text-[10px] text-[#E8EDF8] placeholder:text-[#4E6090] focus:outline-none focus:border-[#E5521A]/50"
                placeholder="Search..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#4E6090] pointer-events-none" />
              <input
                type="date"
                className="bg-[#0D1526] border border-[#1E2F50] rounded-lg pl-7 pr-2 py-1.5 text-[10px] text-[#E8EDF8] focus:outline-none focus:border-[#E5521A]/50"
                value={visitorDate}
                onChange={(e) => setVisitorDate(e.target.value)}
                title="Filter by date"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#14203A]">
                <tr className="text-[9px] uppercase tracking-[0.15em] text-[#4E6090] border-b border-[#1E2F50]">
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisitors.map((visitor) => (
                    <tr key={visitor.id} className="border-b border-[#1E2F50]/50 hover:bg-[#0D1526]/50">
                      <td className="py-2 pr-3">
                        <div className="text-[11px] font-bold text-[#E8EDF8]">{visitor.name}</div>
                      </td>
                      <td className="py-2 pr-3 text-[10px] text-[#8A9BBF] whitespace-nowrap">
                        {new Date(visitor.checked_in_at).toLocaleString("en-IN", {
                          hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short",
                        })}
                      </td>
                      <td className="py-2">
                        <div className="text-[10px] font-mono font-semibold text-[#E8EDF8]">
                          {visitor.vehicle_plate || "—"}
                        </div>
                      </td>
                    </tr>
                  ))}
                {filteredVisitors.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-[11px] text-[#4E6090]">
                      No active visitors
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Modals                                                            */}
      {/* ================================================================= */}
      {showVisitorModal && (
        <RegisterVisitorModal
          gates={gates}
          onClose={() => setShowVisitorModal(false)}
          onSubmit={handleRegisterVisitor}
        />
      )}
      {showVehicleModal && (
        <RegisterVehicleModal
          onClose={() => setShowVehicleModal(false)}
          onSubmit={handleRegisterVehicle}
        />
      )}
      
      {/* Analysis Image Modal */}
      {showAnalysisImage && selectedPlateNumber && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowAnalysisImage(false)}>
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-2xl p-5 w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-[16px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                  📊 LPR Analysis
                </h3>
                <p className="text-[12px] text-[#8A9BBF] mt-1">License Plate: <span className="font-mono font-bold text-[#E8EDF8]">{selectedPlateNumber}</span></p>
              </div>
              <button
                onClick={() => setShowAnalysisImage(false)}
                className="text-[#8A9BBF] hover:text-[#E8EDF8] text-[20px] font-bold"
              >
                ×
              </button>
            </div>
            <div className="bg-[#0F1A30] rounded-lg overflow-hidden">
              {footageMissing ? (
                <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#14203A] border border-[#1E2F50] flex items-center justify-center">
                    <Camera className="h-7 w-7 text-[#4E6090]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[#E8EDF8] mb-1">No footage captured</p>
                    <p className="text-[11px] text-[#4E6090]">
                      Plate: <span className="text-[#5B9BF5] font-mono font-bold">{selectedPlateNumber}</span>
                    </p>
                    <p className="text-[10px] text-[#4E6090] mt-1">LPR image not available for this scan</p>
                  </div>
                </div>
              ) : (
                <img
                  src={getFootageUrl(selectedPlateNumber, footageMap) ?? `${getBackendBaseUrl()}/tmp/${selectedPlateNumber}.png`}
                  alt={`LPR footage for ${selectedPlateNumber}`}
                  className="w-full h-auto"
                  style={{ maxHeight: '75vh', objectFit: 'contain' }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    // Try .jpg fallback if not already tried
                    if (!target.src.includes("vehicle_registry") && target.src.endsWith(".png")) {
                      target.src = `${getBackendBaseUrl()}/tmp/${selectedPlateNumber}.jpg`;
                      return;
                    }
                    setFootageMissing(true);
                  }}
                />
              )}
            </div>
            <div className="mt-3 text-[11px] text-[#8A9BBF]">
              License Plate Recognition analysis with vehicle detection and tracking
            </div>
          </div>
        </div>
      )}

      {/* License Card Modal */}
      {showLicenseCard && selectedVehicle && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowLicenseCard(false)}>
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-2xl p-6 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-[16px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                📄 Driver's License & Vehicle Documents
              </h3>
              <button
                onClick={() => setShowLicenseCard(false)}
                className="text-[#8A9BBF] hover:text-[#E8EDF8] text-[20px] font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="text-center py-8 text-[#8A9BBF]">
              Document information has been removed
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Footage Modal */}
      {showFootageModal && selectedFootageUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowFootageModal(false)}>
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-2xl p-5 w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-[16px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                  🚗 Vehicle Footage
                </h3>
                <p className="text-[12px] text-[#8A9BBF] mt-1">Registered vehicle image</p>
              </div>
              <button
                onClick={() => setShowFootageModal(false)}
                className="text-[#8A9BBF] hover:text-[#E8EDF8] text-[20px] font-bold"
              >
                ×
              </button>
            </div>
            <div className="bg-[#0F1A30] rounded-lg overflow-hidden">
              <img
                src={selectedFootageUrl}
                alt="Vehicle Footage"
                className="w-full h-auto"
                style={{ maxHeight: '70vh', objectFit: 'contain' }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%230D1526' width='400' height='300'/%3E%3Ctext fill='%234E6090' font-family='Arial' font-size='16' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3EImage not available%3C/text%3E%3C/svg%3E";
                }}
              />
            </div>
            <div className="mt-3 text-[11px] text-[#8A9BBF]">
              Vehicle registration footage from gate entry system
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
