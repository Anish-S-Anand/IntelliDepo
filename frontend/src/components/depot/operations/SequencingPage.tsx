"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Layers, ShieldCheck, PackageCheck, ClipboardList, Plus, Check, RotateCcw,
  AlertTriangle, ChevronDown, X, Filter, RefreshCw, Clock, ArrowUpDown,
} from "lucide-react";
import {
  getBatches, getSequencingConfigs, createSequencingConfig, getPickOrders,
  confirmPick, overridePick, getPickLogs,
  type BatchResponse, type ConfigResponse, type PickOrderResponse, type PickLogResponse,
} from "@/services/depotSequencing";

/* ── constants ── */
const RULE_COLORS: Record<string, string> = {
  FIFO: "#3b82f6", FILO: "#a78bfa", LIFO: "#f59e0b", FEFO: "#22d3a1",
};
const COMPLIANCE_COLORS: Record<string, string> = {
  compliant: "#22D3A1", override: "#F5A623", violation: "#F04A4A",
};
const REFRESH_MS = 30_000;

const syne: React.CSSProperties = { fontFamily: "'Syne', sans-serif" };

/* ── tiny helpers ── */
function ruleBadge(rule: string | null) {
  const r = (rule ?? "FIFO").toUpperCase();
  const c = RULE_COLORS[r] ?? "#3b82f6";
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider" style={{ background: `${c}20`, color: c }}>
      {r}
    </span>
  );
}
function complianceBadge(status: string) {
  const c = COMPLIANCE_COLORS[status] ?? "#8A9BBF";
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-semibold capitalize" style={{ background: `${c}18`, color: c }}>
      {status}
    </span>
  );
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ═══════════════════════════════════════════════════════ */
export default function SequencingPage() {
  /* ── state ── */
  const [configs, setConfigs] = useState<ConfigResponse[]>([]);
  const [pickOrders, setPickOrders] = useState<PickOrderResponse[]>([]);
  const [batches, setBatches] = useState<BatchResponse[]>([]);
  const [pickLogs, setPickLogs] = useState<PickLogResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [batchZone, setBatchZone] = useState("");
  const [batchStatus, setBatchStatus] = useState("");

  // add-rule form
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ zone: "", sku_pattern: "*", rule: "FIFO", near_expiry_days: 30, enforce_strict: true });

  // override modal
  const [overrideTarget, setOverrideTarget] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  /* ── data fetching ── */
  const fetchAll = useCallback(async () => {
    try {
      const [c, p, b, l] = await Promise.all([
        getSequencingConfigs(),
        getPickOrders({ picked: false }),
        getBatches({ status: "active", ...(batchZone ? { zone: batchZone } : {}) }),
        getPickLogs(),
      ]);
      setConfigs(c); setPickOrders(p); setBatches(b); setPickLogs(l);
    } catch (err) {
      console.error("Sequencing fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [batchZone]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const iv = setInterval(fetchAll, REFRESH_MS);
    return () => clearInterval(iv);
  }, [fetchAll]);

  /* ── actions ── */
  async function handleAddRule() {
    try {
      await createSequencingConfig({
        zone: newRule.zone,
        sku_pattern: newRule.sku_pattern,
        rule: newRule.rule,
        near_expiry_days: newRule.near_expiry_days,
        enforce_strict: newRule.enforce_strict,
      });
      setShowAddRule(false);
      setNewRule({ zone: "", sku_pattern: "*", rule: "FIFO", near_expiry_days: 30, enforce_strict: true });
      fetchAll();
    } catch (err) { console.error("Add rule error:", err); }
  }

  async function handleConfirmPick(id: string) {
    try { await confirmPick(id); fetchAll(); } catch (err) { console.error(err); }
  }

  async function handleOverride() {
    if (!overrideTarget || !overrideReason.trim()) return;
    try {
      await overridePick(overrideTarget, { reason_code: "MANUAL_OVERRIDE", reason_detail: overrideReason });
      setOverrideTarget(null); setOverrideReason("");
      fetchAll();
    } catch (err) { console.error(err); }
  }

  /* ── unique zones from batches for filter ── */
  const zones = Array.from(new Set(batches.map((b) => b.zone).filter(Boolean))) as string[];

  /* ── expiry helpers ── */
  function expiryRowClass(b: BatchResponse) {
    if (b.days_to_expiry !== null && b.days_to_expiry <= 0) return "bg-[#F04A4A]/8";
    if (b.is_near_expiry) return "bg-[#F5A623]/8";
    return "";
  }
  function expiryText(d: number | null) {
    if (d === null) return <span className="text-[#4E6090]">N/A</span>;
    if (d <= 0) return <span className="text-[#F04A4A] font-bold">Expired</span>;
    if (d <= 14) return <span className="text-[#F04A4A] font-semibold">{d}d</span>;
    if (d <= 30) return <span className="text-[#F5A623] font-semibold">{d}d</span>;
    return <span className="text-[#22D3A1]">{d}d</span>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-[#8A9BBF] gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading sequencing data...
      </div>
    );
  }

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease] space-y-5">
      {/* ════════ Header ════════ */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#E8EDF8]" style={syne}>
            Inventory Sequencing
          </h1>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            FIFO / FILO / LIFO / FEFO rule management, pick queues and audit trail
          </p>
        </div>
        <button onClick={() => fetchAll()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[11px] text-[#8A9BBF] hover:border-[#E5521A]/40 hover:text-[#E5521A] transition-colors">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* ════════ 1. Rule Configuration Panel ════════ */}
      <section className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#E5521A]" />
            <h2 className="text-[14px] font-bold text-[#E8EDF8]" style={syne}>Rule Configuration</h2>
            <span className="text-[10px] text-[#4E6090]">{configs.length} rules</span>
          </div>
          <button onClick={() => setShowAddRule(true)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E5521A]/10 border border-[#E5521A]/30 text-[#E5521A] text-[11px] font-semibold hover:bg-[#E5521A]/20 transition-colors">
            <Plus className="w-3 h-3" /> Add Rule
          </button>
        </div>

        {configs.length === 0 ? (
          <p className="text-[12px] text-[#4E6090] py-4 text-center">No rules configured yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {configs.map((cfg) => (
              <div key={cfg.id} className="bg-[#0D1526] border border-[#1E2F50] rounded-xl p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[#E8EDF8]">{cfg.zone || "All Zones"}</span>
                  {ruleBadge(cfg.rule)}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-[#8A9BBF]">
                  <span>SKU: <span className="text-[#E8EDF8]">{cfg.sku_pattern}</span></span>
                  <span>Near-expiry: <span className="text-[#F5A623]">{cfg.near_expiry_days}d</span></span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${cfg.enforce_strict ? "text-[#F04A4A]" : "text-[#22D3A1]"}`}>
                    <ShieldCheck className="w-3 h-3" /> {cfg.enforce_strict ? "Strict" : "Advisory"}
                  </span>
                  <span className={`text-[10px] ${cfg.is_active ? "text-[#22D3A1]" : "text-[#4E6090]"}`}>
                    {cfg.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Add Rule Modal ── */}
        {showAddRule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-5 w-full max-w-md space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-[#E8EDF8]" style={syne}>New Sequencing Rule</h3>
                <button onClick={() => setShowAddRule(false)} className="text-[#4E6090] hover:text-[#E8EDF8]"><X className="w-4 h-4" /></button>
              </div>
              <label className="block text-[11px] text-[#8A9BBF]">Zone
                <input value={newRule.zone} onChange={(e) => setNewRule({ ...newRule, zone: e.target.value })} placeholder="e.g. Zone A" className="mt-1 w-full px-3 py-1.5 bg-[#0D1526] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[#E5521A]/40 placeholder:text-[#4E6090]" />
              </label>
              <label className="block text-[11px] text-[#8A9BBF]">Rule Type
                <select value={newRule.rule} onChange={(e) => setNewRule({ ...newRule, rule: e.target.value })} className="mt-1 w-full px-3 py-1.5 bg-[#0D1526] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[#E5521A]/40">
                  {Object.keys(RULE_COLORS).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="block text-[11px] text-[#8A9BBF]">SKU Pattern
                <input value={newRule.sku_pattern} onChange={(e) => setNewRule({ ...newRule, sku_pattern: e.target.value })} className="mt-1 w-full px-3 py-1.5 bg-[#0D1526] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[#E5521A]/40" />
              </label>
              <label className="block text-[11px] text-[#8A9BBF]">Near-Expiry Days
                <input type="number" value={newRule.near_expiry_days} onChange={(e) => setNewRule({ ...newRule, near_expiry_days: +e.target.value })} className="mt-1 w-full px-3 py-1.5 bg-[#0D1526] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[#E5521A]/40" />
              </label>
              <label className="flex items-center gap-2 text-[11px] text-[#8A9BBF] cursor-pointer">
                <input type="checkbox" checked={newRule.enforce_strict} onChange={(e) => setNewRule({ ...newRule, enforce_strict: e.target.checked })} className="accent-[#E5521A]" />
                Enforce strict compliance
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowAddRule(false)} className="px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[11px] text-[#8A9BBF] hover:text-[#E8EDF8]">Cancel</button>
                <button onClick={handleAddRule} disabled={!newRule.zone.trim()} className="px-3 py-1.5 rounded-lg bg-[#E5521A] text-white text-[11px] font-semibold hover:bg-[#E5521A]/90 disabled:opacity-40 disabled:cursor-not-allowed">Create Rule</button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ════════ Middle row: Pick Queue + Batch Viewer ════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* ──── 2. Pick Queue ──── */}
        <section className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4">
          <div className="flex items-center gap-2 mb-3">
            <PackageCheck className="w-4 h-4 text-[#E5521A]" />
            <h2 className="text-[14px] font-bold text-[#E8EDF8]" style={syne}>Pick Queue</h2>
            <span className="text-[10px] text-[#4E6090]">{pickOrders.length} pending</span>
          </div>

          {pickOrders.length === 0 ? (
            <p className="text-[12px] text-[#4E6090] py-6 text-center">No pending pick orders.</p>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
              {pickOrders.map((po) => (
                <div key={po.id} className="bg-[#0D1526] border border-[#1E2F50] rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[18px] font-extrabold text-[#E5521A]" style={syne}>#{po.pick_sequence}</span>
                      {ruleBadge(po.sequencing_rule)}
                      {complianceBadge(po.compliance_status)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[#8A9BBF] mb-2">
                    <span>Batch: <span className="text-[#E8EDF8] font-mono">{po.batch_code ?? "—"}</span></span>
                    <span>SKU: <span className="text-[#E8EDF8]">{po.sku_code}</span></span>
                    <span>Zone: <span className="text-[#E8EDF8]">{po.zone ?? "—"}</span></span>
                    <span>Qty: <span className="text-[#E8EDF8] font-semibold">{po.pick_quantity}</span></span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleConfirmPick(po.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#22D3A1]/10 border border-[#22D3A1]/30 text-[#22D3A1] text-[10px] font-semibold hover:bg-[#22D3A1]/20 transition-colors">
                      <Check className="w-3 h-3" /> Confirm Pick
                    </button>
                    <button onClick={() => { setOverrideTarget(po.id); setOverrideReason(""); }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F5A623]/10 border border-[#F5A623]/30 text-[#F5A623] text-[10px] font-semibold hover:bg-[#F5A623]/20 transition-colors">
                      <AlertTriangle className="w-3 h-3" /> Override
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ──── 3. Batch Inventory Viewer ──── */}
        <section className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-[#E5521A]" />
              <h2 className="text-[14px] font-bold text-[#E8EDF8]" style={syne}>Batch Inventory</h2>
              <span className="text-[10px] text-[#4E6090]">{batches.length} batches</span>
            </div>
            <div className="flex items-center gap-1.5">
              <select value={batchZone} onChange={(e) => setBatchZone(e.target.value)} className="px-2 py-1 bg-[#0D1526] border border-[#1E2F50] rounded-lg text-[10px] text-[#8A9BBF] outline-none focus:border-[#E5521A]/40">
                <option value="">All Zones</option>
                {zones.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
              <select value={batchStatus} onChange={(e) => setBatchStatus(e.target.value)} className="px-2 py-1 bg-[#0D1526] border border-[#1E2F50] rounded-lg text-[10px] text-[#8A9BBF] outline-none focus:border-[#E5521A]/40">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="quarantined">Quarantined</option>
                <option value="depleted">Depleted</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[380px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[#4E6090] text-left border-b border-[#1E2F50]">
                  <th className="pb-2 pr-2 font-semibold">Batch</th>
                  <th className="pb-2 pr-2 font-semibold">SKU</th>
                  <th className="pb-2 pr-2 font-semibold">Product</th>
                  <th className="pb-2 pr-2 font-semibold">Zone</th>
                  <th className="pb-2 pr-2 font-semibold text-right">Qty</th>
                  <th className="pb-2 pr-2 font-semibold">Expiry</th>
                  <th className="pb-2 pr-2 font-semibold text-center">Days</th>
                  <th className="pb-2 pr-2 font-semibold">Rule</th>
                  <th className="pb-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {batches
                  .filter((b) => !batchStatus || b.status === batchStatus)
                  .map((b) => (
                  <tr key={b.id} className={`border-b border-[#1E2F50]/50 hover:bg-[#1E2F50]/20 transition-colors ${expiryRowClass(b)}`}>
                    <td className="py-1.5 pr-2 font-mono text-[#E8EDF8]">{b.batch_code}</td>
                    <td className="py-1.5 pr-2 text-[#8A9BBF]">{b.sku_code}</td>
                    <td className="py-1.5 pr-2 text-[#E8EDF8] max-w-[100px] truncate">{b.product_name ?? "—"}</td>
                    <td className="py-1.5 pr-2 text-[#8A9BBF]">{b.zone ?? "—"}</td>
                    <td className="py-1.5 pr-2 text-right text-[#E8EDF8] font-semibold">{b.quantity}</td>
                    <td className="py-1.5 pr-2 text-[#8A9BBF]">{fmtDate(b.expiry_date)}</td>
                    <td className="py-1.5 pr-2 text-center">{expiryText(b.days_to_expiry)}</td>
                    <td className="py-1.5 pr-2">{ruleBadge(b.sequencing_rule)}</td>
                    <td className="py-1.5">
                      <span className={`capitalize text-[10px] font-semibold ${b.status === "active" ? "text-[#22D3A1]" : b.status === "quarantined" ? "text-[#F04A4A]" : "text-[#4E6090]"}`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-[#4E6090] py-6">No active batches found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ════════ 4. Pick Log / Audit Trail ════════ */}
      <section className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-[#E5521A]" />
          <h2 className="text-[14px] font-bold text-[#E8EDF8]" style={syne}>Pick Log / Audit Trail</h2>
          <span className="text-[10px] text-[#4E6090]">{pickLogs.length} entries</span>
        </div>

        <div className="overflow-x-auto max-h-[320px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[#4E6090] text-left border-b border-[#1E2F50]">
                <th className="pb-2 pr-3 font-semibold">Time</th>
                <th className="pb-2 pr-3 font-semibold">Batch</th>
                <th className="pb-2 pr-3 font-semibold">SKU</th>
                <th className="pb-2 pr-3 font-semibold text-right">Qty</th>
                <th className="pb-2 pr-3 font-semibold">Rule Applied</th>
                <th className="pb-2 pr-3 font-semibold">Compliance</th>
                <th className="pb-2 pr-3 font-semibold">Scan</th>
                <th className="pb-2 font-semibold">Override Reason</th>
              </tr>
            </thead>
            <tbody>
              {pickLogs.map((log) => (
                <tr key={log.id} className={`border-b border-[#1E2F50]/50 hover:bg-[#1E2F50]/20 transition-colors ${log.compliance_status === "override" ? "bg-[#F5A623]/6" : ""}`}>
                  <td className="py-1.5 pr-3 text-[#8A9BBF] whitespace-nowrap">
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{fmtTime(log.picked_at)}</span>
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-[#E8EDF8]">{log.batch_code ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-[#8A9BBF]">{log.sku_code}</td>
                  <td className="py-1.5 pr-3 text-right text-[#E8EDF8] font-semibold">{log.quantity_picked}</td>
                  <td className="py-1.5 pr-3">{ruleBadge(log.sequencing_rule_applied)}</td>
                  <td className="py-1.5 pr-3">{complianceBadge(log.compliance_status)}</td>
                  <td className="py-1.5 pr-3 text-[#8A9BBF] capitalize">{log.scan_method ?? "—"}</td>
                  <td className="py-1.5 text-[#F5A623] text-[10px] italic max-w-[180px] truncate">{log.override_reason ?? "—"}</td>
                </tr>
              ))}
              {pickLogs.length === 0 && (
                <tr><td colSpan={8} className="text-center text-[#4E6090] py-6">No pick logs recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ════════ Override Reason Modal ════════ */}
      {overrideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-5 w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#E8EDF8]" style={syne}>Override Reason</h3>
              <button onClick={() => setOverrideTarget(null)} className="text-[#4E6090] hover:text-[#E8EDF8]"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[11px] text-[#8A9BBF]">Provide a reason for overriding the sequencing rule. This will be logged in the audit trail.</p>
            <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={3} placeholder="e.g. Customer priority request, quality hold release..." className="w-full px-3 py-2 bg-[#0D1526] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none resize-none focus:border-[#E5521A]/40 placeholder:text-[#4E6090]" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setOverrideTarget(null)} className="px-3 py-1.5 rounded-lg border border-[#1E2F50] text-[11px] text-[#8A9BBF] hover:text-[#E8EDF8]">Cancel</button>
              <button onClick={handleOverride} disabled={!overrideReason.trim()} className="px-3 py-1.5 rounded-lg bg-[#F5A623] text-[#0D1526] text-[11px] font-semibold hover:bg-[#F5A623]/90 disabled:opacity-40 disabled:cursor-not-allowed">Submit Override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
