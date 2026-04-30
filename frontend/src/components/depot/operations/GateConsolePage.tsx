"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield,
  Car,
  UserPlus,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  DoorOpen,
  DoorClosed,
  ScanLine,
  ArrowDownUp,
  ArrowRightLeft,
  AlertTriangle,
  Plus,
  X,
  LogOut,
  Ban,
  ClipboardList,
  Users,
  Camera,
} from "lucide-react";
import {
  getGates,
  gateAction,
  getVehicles,
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
    gate_id: gates[0]?.id || "",
    pass_valid_hours: 4,
  });
  const [submitting, setSubmitting] = useState(false);

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
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Company</label>
            <input className={inputCls} value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Company name" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Purpose</label>
            <input className={inputCls} value={form.purpose} onChange={(e) => set("purpose", e.target.value)} placeholder="Visit purpose" />
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
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">ID Proof Number</label>
            <input className={inputCls} value={form.id_proof_number} onChange={(e) => set("id_proof_number", e.target.value)} placeholder="ID number" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Vehicle Plate</label>
            <input className={inputCls} value={form.vehicle_plate} onChange={(e) => set("vehicle_plate", e.target.value)} placeholder="KA-01-XX-1234" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Host Name</label>
            <input className={inputCls} value={form.host_name} onChange={(e) => set("host_name", e.target.value)} placeholder="Person to meet" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Gate</label>
            <select className={inputCls} value={form.gate_id} onChange={(e) => set("gate_id", e.target.value)}>
              {gates.map((g) => (
                <option key={g.id} value={g.id}>{g.gate_code} - {g.name}</option>
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
  const [submitting, setSubmitting] = useState(false);

  const set = (key: string, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

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
            <label className="text-[10px] uppercase tracking-wider text-[#4E6090] mb-1 block">Company</label>
            <input className={inputCls} value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Company name" />
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
  const [loading, setLoading] = useState(true);

  // LPR Scanner
  const [scanPlate, setScanPlate] = useState("");
  const [scanGateId, setScanGateId] = useState("");
  const [scanDirection, setScanDirection] = useState<"entry" | "exit">("entry");
  const [scanResult, setScanResult] = useState<AccessLogResponse | null>(null);
  const [scanning, setScanning] = useState(false);

  // Access log filters
  const [logFilter, setLogFilter] = useState<"all" | "granted" | "denied" | "blacklisted">("all");
  const [logSearch, setLogSearch] = useState("");

  // Vehicle blacklist
  const [blacklistTarget, setBlacklistTarget] = useState<string | null>(null);
  const [blacklistReason, setBlacklistReason] = useState("");

  // Modals
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

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
      setGates(data);
      if (!scanGateId && data.length > 0) setScanGateId(data[0].id);
    } catch { /* offline */ }
  }, [scanGateId]);

  const loadLogs = useCallback(async () => {
    try {
      const data = await getAccessLogs({ limit: 20 });
      setAccessLogs(data);
    } catch { /* offline */ }
  }, []);

  const loadVehicles = useCallback(async () => {
    try {
      const data = await getVehicles();
      setVehicles(data);
    } catch { /* offline */ }
  }, []);

  const loadVisitors = useCallback(async () => {
    try {
      const data = await getActiveVisitors();
      setVisitors(data);
    } catch { /* offline */ }
  }, []);

  // Initial load
  useEffect(() => {
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

  const handleScan = async () => {
    if (!scanPlate.trim() || !scanGateId) return;
    setScanning(true);
    setScanResult(null);
    try {
      const result = await processLprScan({
        gate_id: scanGateId,
        plate_number: scanPlate.toUpperCase(),
        confidence: 0.95,
        direction: scanDirection,
      });
      setScanResult(result);
      void loadLogs();
    } catch {
      // scan failed
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
  const filteredLogs = useMemo(() => accessLogs.filter((log) => {
    if (logFilter !== "all" && log.decision.toLowerCase() !== logFilter) return false;
    if (logSearch && !log.plate_number.toLowerCase().includes(logSearch.toLowerCase())) return false;
    return true;
  }), [accessLogs, logFilter, logSearch]);

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
          LPR Gate Control Console
        </h1>
        <span className="text-[11px] text-[#4E6090] ml-2">
          {gates.length} gates | Auto-refresh active
        </span>
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
          <div className="flex flex-wrap gap-2">
            {gates.map((gate) => {
              const isOpen = gate.status === "open";
              const busy = togglingGate === gate.id;
              return (
                <button
                  key={gate.id}
                  type="button"
                  onClick={() => handleGateToggle(gate)}
                  disabled={busy}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left ${
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
                  <div>
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
            })}
            {gates.length === 0 && (
              <p className="text-[11px] text-[#4E6090]">No gates configured</p>
            )}
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
              return (
                <div className="mb-3 flex items-center justify-center aspect-video rounded-xl bg-[#0A1628] border border-[#1E2F50] text-[11px] text-[#4E6090]">
                  <Camera className="w-4 h-4 mr-2 opacity-40" />
                  No camera assigned to this gate
                </div>
              );
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
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
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
                onClick={() => setScanDirection("entry")}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                  scanDirection === "entry"
                    ? "border-[#E5521A] bg-[#E5521A]/10 text-[#E5521A]"
                    : "border-[#1E2F50] text-[#4E6090] hover:border-[#2A3F68]"
                }`}
              >
                <ArrowDownUp className="w-3 h-3 inline mr-1" />Entry
              </button>
              <button
                type="button"
                onClick={() => setScanDirection("exit")}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                  scanDirection === "exit"
                    ? "border-[#E5521A] bg-[#E5521A]/10 text-[#E5521A]"
                    : "border-[#1E2F50] text-[#4E6090] hover:border-[#2A3F68]"
                }`}
              >
                <ArrowRightLeft className="w-3 h-3 inline mr-1" />Exit
              </button>
            </div>
            <button
              type="button"
              onClick={handleScan}
              disabled={!scanPlate.trim() || scanning}
              className="w-full py-2 rounded-lg bg-[#E5521A] text-white text-[12px] font-bold hover:bg-[#E5521A]/90 disabled:opacity-50 transition-colors"
            >
              {scanning ? "Scanning..." : "Scan Plate"}
            </button>
          </div>
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
                ["Time", "Gate", "Plate", "Direction", "Decision", "Confidence", "Reason"],
                accessLogs.map((l) => [
                  new Date(l.processed_at || l.created_at).toLocaleString(),
                  l.gate_code || "—", l.plate_number, l.direction,
                  l.decision, l.plate_confidence, l.denied_reason || "",
                ]),
              )}
              className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-[#1E2F50] text-[#8A9BBF] hover:border-[#22D3A1]/30 hover:text-[#22D3A1] transition-colors"
            >
              CSV
            </button>
            {/* Filter tabs */}
            {(["all", "granted", "denied", "blacklisted"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setLogFilter(tab)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                  logFilter === tab
                    ? "bg-[#E5521A]/10 text-[#E5521A] border border-[#E5521A]/25"
                    : "text-[#4E6090] hover:text-[#8A9BBF] border border-transparent"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
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
                <th className="pb-2 pr-3">Decision</th>
                <th className="pb-2 pr-3">Confidence</th>
                <th className="pb-2">Reason</th>
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
                    <span
                      className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full"
                      style={{
                        color: decisionColor(log.decision),
                        background: `${decisionColor(log.decision)}15`,
                        border: `1px solid ${decisionColor(log.decision)}30`,
                      }}
                    >
                      {log.decision}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-[10px] font-mono text-[#8A9BBF]">
                    {(log.plate_confidence * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 text-[10px] text-[#F04A4A]">
                    {log.denied_reason || "—"}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[11px] text-[#4E6090]">
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
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E5521A]/30 bg-[#E5521A]/10 text-[#E5521A] text-[10px] font-semibold hover:bg-[#E5521A]/20 transition-colors"
            >
              <Plus className="w-3 h-3" /> Register Vehicle
            </button>
          </div>

          <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#14203A]">
                <tr className="text-[9px] uppercase tracking-[0.15em] text-[#4E6090] border-b border-[#1E2F50]">
                  <th className="pb-2 pr-3">Plate</th>
                  <th className="pb-2 pr-3">Type</th>
                  <th className="pb-2 pr-3">Owner</th>
                  <th className="pb-2 pr-3">Company</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => {
                  const st = VEHICLE_STATUS[v.status] || VEHICLE_STATUS.registered;
                  return (
                    <tr key={v.id} className="border-b border-[#1E2F50]/50 hover:bg-[#0D1526]/50">
                      <td className="py-2 pr-3 text-[11px] font-mono font-bold text-[#E8EDF8]">
                        {v.plate_number}
                      </td>
                      <td className="py-2 pr-3 text-[10px] text-[#8A9BBF] capitalize">
                        {v.vehicle_type || "—"}
                      </td>
                      <td className="py-2 pr-3 text-[10px] text-[#8A9BBF]">
                        {v.owner_name || "—"}
                      </td>
                      <td className="py-2 pr-3 text-[10px] text-[#8A9BBF]">
                        {v.company || "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full"
                          style={{
                            color: st.color,
                            background: st.bg,
                            border: `1px solid ${st.border}`,
                          }}
                        >
                          {v.status}
                        </span>
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
                    <td colSpan={6} className="py-6 text-center text-[11px] text-[#4E6090]">
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
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E5521A]/30 bg-[#E5521A]/10 text-[#E5521A] text-[10px] font-semibold hover:bg-[#E5521A]/20 transition-colors"
            >
              <UserPlus className="w-3 h-3" /> Register Visitor
            </button>
          </div>

          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {visitors.map((visitor) => (
              <div
                key={visitor.id}
                className="rounded-xl border border-[#1E2F50] bg-[#0D1526] p-3 hover:border-[#2A3F68] transition-colors"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <span className="text-[12px] font-bold text-[#E8EDF8]">{visitor.name}</span>
                    {visitor.company && (
                      <span className="text-[10px] text-[#8A9BBF] ml-2">{visitor.company}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCheckout(visitor.id)}
                    disabled={checkingOut === visitor.id}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[9px] font-semibold hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                  >
                    <LogOut className="w-3 h-3" />
                    {checkingOut === visitor.id ? "..." : "Check Out"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                  {visitor.purpose && (
                    <div>
                      <span className="text-[#4E6090]">Purpose: </span>
                      <span className="text-[#8A9BBF]">{visitor.purpose}</span>
                    </div>
                  )}
                  {visitor.vehicle_plate && (
                    <div>
                      <span className="text-[#4E6090]">Plate: </span>
                      <span className="text-[#8A9BBF] font-mono">{visitor.vehicle_plate}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[#4E6090]">In: </span>
                    <span className="text-[#8A9BBF]">
                      {new Date(visitor.checked_in_at).toLocaleString("en-IN", {
                        hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short",
                      })}
                    </span>
                  </div>
                  {visitor.pass_valid_until && (
                    <div className="flex items-center gap-1">
                      <span className="text-[#4E6090]">Expires: </span>
                      <ExpiryCountdown expiresAt={visitor.pass_valid_until} tick={tick} />
                    </div>
                  )}
                  {visitor.host_name && (
                    <div>
                      <span className="text-[#4E6090]">Host: </span>
                      <span className="text-[#8A9BBF]">{visitor.host_name}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {visitors.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <p className="text-[11px] text-[#4E6090]">No active visitors</p>
              </div>
            )}
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
    </div>
  );
}
