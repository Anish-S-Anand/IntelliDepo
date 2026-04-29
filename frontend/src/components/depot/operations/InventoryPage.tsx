"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Calendar, Package, Layers, ChevronDown } from "lucide-react";
import { occColor } from "@/lib/depot-data";

// ---------------------------------------------------------------------------
// Types matching backend responses
// ---------------------------------------------------------------------------

interface ZoneData {
  id: string;
  zone_code: string;
  name: string;
  zone_type: string;
  max_capacity_units: number;
  current_occupancy: number;
  utilization_pct: number;
  status: string;
}

interface BatchData {
  id: string;
  batch_code: string;
  sku_code: string;
  product_name: string | null;
  zone: string | null;
  rack: string | null;
  bin_location: string | null;
  quantity: number;
  original_quantity: number;
  sequencing_rule: string;
  status: string;
  is_near_expiry: boolean;
  days_to_expiry: number | null;
  created_at: string;
  updated_at?: string;
}

// Cluster = a batch mapped to a display card
interface ClusterCard {
  id: string;
  zone: string;
  product: string;
  capacity: number;
  occupied: number;
  batch: string;
  fifo: boolean;
  lastActivity: string;
  rack: string;
}

type FilterType = "all" | "full" | "empty" | "fifo";
type ViewTab = "clusters" | "batches";

// ---------------------------------------------------------------------------
// Add Cluster Modal
// ---------------------------------------------------------------------------

interface AddClusterModalProps {
  onClose: () => void;
  onAdd: (cluster: ClusterCard) => void;
}

function AddClusterModal({ onClose, onAdd }: AddClusterModalProps) {
  const [form, setForm] = useState({
    zone: "A",
    rack: "",
    product: "",
    capacity: "",
    batch: "",
    sequencing: "FIFO",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product || !form.capacity || !form.batch) return;
    const newCluster: ClusterCard = {
      id: `${form.zone}-${form.rack || form.batch}`,
      zone: form.zone,
      product: form.product,
      capacity: parseInt(form.capacity, 10),
      occupied: 0,
      batch: form.batch,
      fifo: form.sequencing === "FIFO",
      lastActivity: new Date().toISOString(),
      rack: form.rack || "—",
    };
    onAdd(newCluster);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#14203A] border border-[#1E2F50] rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-bold text-[#E8EDF8]">Register New Cluster</h3>
          <button onClick={onClose} className="text-[#4E6090] hover:text-[#E8EDF8] transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#4E6090] font-semibold uppercase tracking-wider block mb-1.5">Zone</label>
              <select
                value={form.zone}
                onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0F1A30] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[#E5521A]/40"
              >
                {["A", "B", "C", "D", "E"].map((z) => (
                  <option key={z} value={z}>Zone {z}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#4E6090] font-semibold uppercase tracking-wider block mb-1.5">Rack</label>
              <input
                value={form.rack}
                onChange={(e) => setForm((f) => ({ ...f, rack: e.target.value }))}
                placeholder="e.g. R-01"
                className="w-full px-3 py-2 bg-[#0F1A30] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[#E5521A]/40 placeholder:text-[#4E6090]"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-[#4E6090] font-semibold uppercase tracking-wider block mb-1.5">Product Name *</label>
            <input
              required
              value={form.product}
              onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
              placeholder="e.g. OPC Cement 53"
              className="w-full px-3 py-2 bg-[#0F1A30] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[#E5521A]/40 placeholder:text-[#4E6090]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#4E6090] font-semibold uppercase tracking-wider block mb-1.5">Capacity (bags) *</label>
              <input
                required
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                placeholder="500"
                className="w-full px-3 py-2 bg-[#0F1A30] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[#E5521A]/40 placeholder:text-[#4E6090]"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#4E6090] font-semibold uppercase tracking-wider block mb-1.5">Sequencing Rule</label>
              <select
                value={form.sequencing}
                onChange={(e) => setForm((f) => ({ ...f, sequencing: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0F1A30] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[#E5521A]/40"
              >
                <option value="FIFO">FIFO</option>
                <option value="FEFO">FEFO</option>
                <option value="LIFO">LIFO</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-[#4E6090] font-semibold uppercase tracking-wider block mb-1.5">Batch Code *</label>
            <input
              required
              value={form.batch}
              onChange={(e) => setForm((f) => ({ ...f, batch: e.target.value }))}
              placeholder="e.g. B2025-1024"
              className="w-full px-3 py-2 bg-[#0F1A30] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[#E5521A]/40 placeholder:text-[#4E6090]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[12px] font-semibold hover:border-[#2A3F68] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#E5521A] text-white text-[12px] font-bold hover:bg-[#FF7A42] transition"
            >
              Register Cluster
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function zoneColor(pct: number): string {
  if (pct >= 90) return "#F04A4A";
  if (pct >= 75) return "#F59E0B";
  return "#22D3A1";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InventoryPage() {
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [clusters, setClusters] = useState<ClusterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [viewTab, setViewTab] = useState<ViewTab>("clusters");
  const [showAddModal, setShowAddModal] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exploreOpen, setExploreOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [zonesRes, batchesRes] = await Promise.allSettled([
        fetch("/backend/depot/vision/cluster/zones"),
        fetch("/backend/depot/vision/sequencing/batches"),
      ]);

      // Zones
      if (zonesRes.status === "fulfilled" && zonesRes.value.ok) {
        const zData: ZoneData[] = await zonesRes.value.json();
        setZones(zData.sort((a, b) => a.zone_code.localeCompare(b.zone_code)));
      }

      // Batches → cluster cards
      if (batchesRes.status === "fulfilled" && batchesRes.value.ok) {
        const bData: BatchData[] = await batchesRes.value.json();
        const cards: ClusterCard[] = bData
          .filter((b) => b.status === "active")
          .map((b) => ({
            id: `${b.zone || "?"}-${b.rack || b.batch_code}`,
            zone: b.zone || "—",
            product: b.product_name || b.sku_code,
            capacity: b.original_quantity || b.quantity,
            occupied: b.quantity,
            batch: b.batch_code,
            fifo: b.sequencing_rule === "FIFO",
            lastActivity: b.created_at,
            rack: b.rack || "—",
          }));
        setClusters(cards);
      }
    } catch {
      // silent — UI shows empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filter clusters
  const filtered = clusters.filter((c) => {
    const pct = c.capacity > 0 ? c.occupied / c.capacity : 0;
    if (filter === "full" && pct < 0.85) return false;
    if (filter === "empty" && c.occupied > 0) return false;
    if (filter === "fifo" && c.fifo) return false;
    if (
      search &&
      !c.product.toLowerCase().includes(search.toLowerCase()) &&
      !c.id.toLowerCase().includes(search.toLowerCase()) &&
      !c.batch.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    // Date range filter on lastActivity
    if (dateFrom && new Date(c.lastActivity) < new Date(dateFrom)) return false;
    if (dateTo && new Date(c.lastActivity) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  });

  // Mock batches data
  const BATCHES: BatchData[] = clusters.map((c) => ({
    id: c.id,
    batch_code: c.batch,
    sku_code: c.id,
    product_name: c.product,
    zone: c.zone,
    rack: c.rack,
    bin_location: null,
    quantity: c.occupied,
    original_quantity: c.capacity,
    sequencing_rule: c.fifo ? "FIFO" : "FEFO",
    status: "active",
    is_near_expiry: false,
    days_to_expiry: null,
    created_at: c.lastActivity,
  }));

  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Near Full", value: "full" },
    { label: "Empty", value: "empty" },
    { label: "FIFO Warn", value: "fifo" },
  ];

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5521a] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      {/* Add Cluster Modal */}
      {showAddModal && (
        <AddClusterModal
          onClose={() => setShowAddModal(false)}
          onAdd={(newCluster) => setClusters((prev) => [newCluster, ...prev])}
        />
      )}

      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#E8EDF8]">
            Inventory Management
          </h1>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            Cluster tracking, FIFO compliance, real-time stock levels
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Explore Options */}
          <div className="relative">
            <button
              onClick={() => setExploreOpen((p) => !p)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-semibold hover:border-[#2A3F68] hover:text-[#E8EDF8] transition"
            >
              <Layers className="w-3.5 h-3.5" />
              Explore
              <ChevronDown className={`w-3 h-3 transition-transform ${exploreOpen ? "rotate-180" : ""}`} />
            </button>
            {exploreOpen && (
              <div className="absolute right-0 top-[calc(100%+4px)] w-52 bg-[#0F1A30] border border-[#1E2F50] rounded-xl shadow-2xl z-20 overflow-hidden">
                {[
                  { label: "Export CSV", action: () => {} },
                  { label: "Export PDF Report", action: () => {} },
                  { label: "View Zone Map", action: () => {} },
                  { label: "FIFO Compliance Report", action: () => {} },
                  { label: "Batch History", action: () => setViewTab("batches") },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => { opt.action(); setExploreOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-[12px] text-[#8A9BBF] hover:bg-[#1E2F50] hover:text-[#E8EDF8] transition"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Add Cluster Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#E5521A] text-white text-[11px] font-bold hover:bg-[#FF7A42] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Cluster
          </button>
        </div>
      </div>

      {/* ── Zone Bars ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {zones.map((z) => {
          const pct = Math.round(z.utilization_pct);
          const col = zoneColor(pct);
          return (
            <div
              key={z.id}
              className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 text-center relative overflow-hidden transition-all hover:border-[#E5521A]/30 hover:shadow-[0_6px_24px_rgba(229,82,26,0.08)]"
            >
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{
                  background: `linear-gradient(90deg, transparent, ${col}, transparent)`,
                  opacity: 0.8,
                }}
              />
              <div className="text-[11px] font-extrabold text-[#4E6090] tracking-[0.12em]">
                ZONE {z.zone_code}
              </div>
              <div className="text-[28px] font-extrabold my-1.5" style={{ color: col }}>
                {pct}%
              </div>
              <div className="w-full h-1 bg-[#1E2F50] rounded-full overflow-hidden mt-1.5">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
              </div>
              <div className="text-[9px] text-[#4E6090] mt-1.5">
                {z.current_occupancy.toLocaleString()} / {z.max_capacity_units.toLocaleString()} bags
              </div>
            </div>
          );
        })}
      </div>

      {/* ── View Tabs ── */}
      <div className="flex gap-1 mb-4 bg-[#0F1A30] rounded-xl p-1 w-fit">
        <button
          onClick={() => setViewTab("clusters")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold transition-colors ${
            viewTab === "clusters"
              ? "bg-[#E5521A] text-white"
              : "text-[#8A9BBF] hover:text-[#E8EDF8]"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Clusters
        </button>
        <button
          onClick={() => setViewTab("batches")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold transition-colors ${
            viewTab === "batches"
              ? "bg-[#E5521A] text-white"
              : "text-[#8A9BBF] hover:text-[#E8EDF8]"
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          Batches
        </button>
      </div>

      {/* ── Search + Filters + Date Range ── */}
      <div className="flex gap-1.5 mb-4 flex-wrap items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product, cluster, batch…"
          className="flex-1 min-w-[180px] px-3 py-2 bg-[#0F1A30] border border-[#1E2F50] rounded-[9px] text-[#E8EDF8] text-[12px] outline-none focus:border-[#E5521A]/40 placeholder:text-[#4E6090]"
        />
        {/* Date range */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#0F1A30] border border-[#1E2F50] rounded-[9px]">
          <Calendar className="w-3.5 h-3.5 text-[#4E6090]" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-transparent text-[#E8EDF8] text-[11px] outline-none w-[110px]"
            title="From date"
          />
          <span className="text-[#4E6090] text-[11px]">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-transparent text-[#E8EDF8] text-[11px] outline-none w-[110px]"
            title="To date"
          />
        </div>
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
              filter === f.value
                ? "border-[#E5521A] bg-[#E5521A]/10 text-[#E5521A]"
                : "border-[#1E2F50] text-[#8A9BBF] hover:border-[#2A3F68] hover:text-[#E8EDF8]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Clusters View ── */}
      {viewTab === "clusters" && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center text-[#4E6090] text-[13px] py-16">
              {clusters.length === 0
                ? "No inventory batches found. Click \"Add Cluster\" to register one."
                : "No clusters match the current filter."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {filtered.map((c) => {
                const pct = c.capacity > 0 ? Math.round((c.occupied / c.capacity) * 100) : 0;
                const col = occColor(pct);
                return (
                  <div
                    key={c.id + c.batch}
                    className="bg-[#14203A] border rounded-[14px] p-[15px] transition-all hover:border-[#2A3F68] hover:-translate-y-px"
                    style={{ borderColor: c.fifo ? "#1E2F50" : "rgba(245,166,35,0.35)" }}
                  >
                    <div className="flex justify-between mb-2.5">
                      <div>
                        <div className="text-[15px] font-bold text-[#E8EDF8]">Cluster {c.id}</div>
                        <div className="text-[11px] text-[#8A9BBF] mt-0.5">{c.product}</div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <span
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                          style={{ background: `${col}22`, color: col, borderColor: `${col}44` }}
                        >
                          {pct}%
                        </span>
                        <span
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                          style={{
                            background: c.fifo ? "rgba(34,211,161,0.1)" : "rgba(245,166,35,0.1)",
                            color: c.fifo ? "#22D3A1" : "#F5A623",
                            borderColor: c.fifo ? "rgba(34,211,161,0.2)" : "rgba(245,166,35,0.2)",
                          }}
                        >
                          {c.fifo ? "✓ FIFO" : "⚠ FEFO"}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-[#1E2F50] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 text-[10px] mt-2.5">
                      <span className="text-[#4E6090]">Capacity</span>
                      <span className="font-semibold text-[#E8EDF8]">{c.capacity.toLocaleString()} bags</span>
                      <span className="text-[#4E6090]">Occupied</span>
                      <span className="font-semibold text-[#E8EDF8]">{c.occupied.toLocaleString()} bags</span>
                      <span className="text-[#4E6090]">Batch</span>
                      <span className="font-semibold text-[#E8EDF8]">{c.batch}</span>
                      <span className="text-[#4E6090]">Last Activity</span>
                      <span className="font-semibold text-[#E8EDF8]">{timeAgo(c.lastActivity)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Batches View ── */}
      {viewTab === "batches" && (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#1E2F50]">
                {["Batch Code", "Product", "Zone", "Rack", "Qty", "Original Qty", "Rule", "Status", "Created"].map((h) => (
                  <th key={h} className="text-left py-2.5 px-3 text-[10px] font-bold text-[#4E6090] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BATCHES.filter((b) =>
                !search ||
                b.batch_code.toLowerCase().includes(search.toLowerCase()) ||
                (b.product_name || "").toLowerCase().includes(search.toLowerCase())
              ).map((b) => (
                <tr key={b.id} className="border-b border-[#1E2F50]/50 hover:bg-[#14203A] transition-colors">
                  <td className="py-2.5 px-3 font-bold text-[#E8EDF8]">{b.batch_code}</td>
                  <td className="py-2.5 px-3 text-[#8A9BBF]">{b.product_name || b.sku_code}</td>
                  <td className="py-2.5 px-3 text-[#8A9BBF]">{b.zone || "—"}</td>
                  <td className="py-2.5 px-3 text-[#8A9BBF]">{b.rack || "—"}</td>
                  <td className="py-2.5 px-3 font-semibold text-[#E8EDF8]">{b.quantity.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-[#8A9BBF]">{b.original_quantity.toLocaleString()}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                      style={{
                        background: b.sequencing_rule === "FIFO" ? "rgba(34,211,161,0.1)" : "rgba(245,166,35,0.1)",
                        color: b.sequencing_rule === "FIFO" ? "#22D3A1" : "#F5A623",
                        borderColor: b.sequencing_rule === "FIFO" ? "rgba(34,211,161,0.2)" : "rgba(245,166,35,0.2)",
                      }}
                    >
                      {b.sequencing_rule}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#22D3A1]/10 text-[#22D3A1] border border-[#22D3A1]/20">
                      {b.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#4E6090]">{timeAgo(b.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {BATCHES.length === 0 && (
            <div className="text-center text-[#4E6090] text-[13px] py-16">
              No batches found. Add clusters to see batch data.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
