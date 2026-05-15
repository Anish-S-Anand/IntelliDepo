"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Calendar, Package, Layers } from "lucide-react";
import { occColor } from "@/lib/depot-data";
import InventorySkeleton from "@/components/depot/skeletons/InventorySkeleton";

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
  expiry_date?: string;
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
    product: "",
    batch: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product || !form.batch) return;
    const newCluster: ClusterCard = {
      id: `${form.zone}-${form.batch}`,
      zone: form.zone,
      product: form.product,
      capacity: 500, // Default capacity
      occupied: 0,
      batch: form.batch,
      fifo: true, // Default to FIFO
      lastActivity: new Date().toISOString(),
      rack: "—",
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
          <h3 className="text-[16px] font-bold text-[#E8EDF8]">Register New Zone</h3>
          <button onClick={onClose} className="text-[#4E6090] hover:text-[#E8EDF8] transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-[10px] text-[#4E6090] font-semibold uppercase tracking-wider block mb-1.5">Zone *</label>
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
            <label className="text-[10px] text-[#4E6090] font-semibold uppercase tracking-wider block mb-1.5">Product Name *</label>
            <input
              required
              value={form.product}
              onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
              placeholder="e.g. UltraTech Cement"
              className="w-full px-3 py-2 bg-[#0F1A30] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[#E5521A]/40 placeholder:text-[#4E6090]"
            />
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
              Register Zone
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
  const [batchesFromAPI, setBatchesFromAPI] = useState<BatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [viewTab, setViewTab] = useState<ViewTab>("clusters");
  const [showAddModal, setShowAddModal] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

      // Batches → cluster cards AND store raw batch data
      if (batchesRes.status === "fulfilled" && batchesRes.value.ok) {
        const bData: BatchData[] = await batchesRes.value.json();
        setBatchesFromAPI(bData); // Store raw API data
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

  // Filter clusters (for zones view - individual batches)
  const filtered = clusters.filter((c) => {
    const pct = c.capacity > 0 ? c.occupied / c.capacity : 0;
    if (filter === "full" && pct < 0.70) return false; // 70% threshold for Near Full
    if (filter === "empty" && c.occupied !== 0) return false; // Empty means occupied = 0
    if (
      search &&
      !c.product.toLowerCase().includes(search.toLowerCase()) &&
      !c.id.toLowerCase().includes(search.toLowerCase()) &&
      !c.batch.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    // Date range filter on lastActivity
    if (dateFrom) {
      const activityDate = new Date(c.lastActivity);
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (activityDate < fromDate) return false;
    }
    if (dateTo) {
      const activityDate = new Date(c.lastActivity);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (activityDate > toDate) return false;
    }
    return true;
  });

  // Filter zones based on zone-level utilization (not individual cluster occupancy)
  const displayZones = zones.filter(z => {
    // Apply filter to zones based on their overall utilization_pct
    if (filter === "full" && z.utilization_pct < 70) return false;
    if (filter === "empty" && z.current_occupancy !== 0) return false;
    // For search, check if any clusters in this zone match
    if (search) {
      const zoneClusters = clusters.filter(c => c.zone === z.zone_code);
      const hasMatch = zoneClusters.some(c => 
        c.product.toLowerCase().includes(search.toLowerCase()) ||
        c.id.toLowerCase().includes(search.toLowerCase()) ||
        c.batch.toLowerCase().includes(search.toLowerCase())
      );
      if (!hasMatch) return false;
    }
    return true;
  });

  // Filter batches using real API data
  const filteredBatches = batchesFromAPI.filter((b) => {
    const pct = b.original_quantity > 0 ? b.quantity / b.original_quantity : 0;
    if (filter === "full" && pct < 0.70) return false; // Changed to 70% threshold
    if (filter === "empty" && b.quantity !== 0) return false; // Fixed: empty means quantity = 0
    if (
      search &&
      !b.batch_code.toLowerCase().includes(search.toLowerCase()) &&
      !(b.product_name || "").toLowerCase().includes(search.toLowerCase()) &&
      !(b.zone || "").toLowerCase().includes(search.toLowerCase())
    )
      return false;
    // Date range filter on created_at
    if (dateFrom) {
      const createdDate = new Date(b.created_at);
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (createdDate < fromDate) return false;
    }
    if (dateTo) {
      const createdDate = new Date(b.created_at);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (createdDate > toDate) return false;
    }
    return true;
  });

  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Near Full", value: "full" },
    { label: "Empty", value: "empty" },
  ];

  if (loading) {
    return <InventorySkeleton />;
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
        </div>
        <div className="flex items-center gap-2">
          {/* Export CSV Button */}
          <button
            onClick={() => {/* Export CSV logic */}}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-semibold hover:border-[#2A3F68] hover:text-[#E8EDF8] transition"
          >
            Export CSV
          </button>
          {/* Export PDF Report Button */}
          <button
            onClick={() => {/* Export PDF logic */}}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-semibold hover:border-[#2A3F68] hover:text-[#E8EDF8] transition"
          >
            Export PDF Report
          </button>
          {/* Dynamic Add Button - changes based on active tab */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#E5521A] text-white text-[11px] font-bold hover:bg-[#FF7A42] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            {viewTab === "clusters" ? "Add Zone" : "Add Batch"}
          </button>
        </div>
      </div>

      {/* ── Zone Bars ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {displayZones.map((z) => {
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
          Zones
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
          placeholder="Search product, zone, batch…"
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
                ? "No inventory batches found. Click \"Add Zone\" to register one."
                : "No zones match the current filter."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {filtered.slice(0, 5).map((c) => {
                const pct = c.capacity > 0 ? Math.round((c.occupied / c.capacity) * 100) : 0;
                const col = occColor(pct);
                return (
                  <div
                    key={c.id + c.batch}
                    className="bg-[#14203A] border rounded-[14px] p-[15px] transition-all hover:border-[#2A3F68] hover:-translate-y-px"
                    style={{ borderColor: "#1E2F50" }}
                  >
                    <div className="flex justify-between mb-2.5">
                      <div>
                        <div className="text-[15px] font-bold text-[#E8EDF8]">Zone {c.id}</div>
                        <div className="text-[11px] text-[#8A9BBF] mt-0.5">{c.product}</div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <span
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                          style={{ background: `${col}22`, color: col, borderColor: `${col}44` }}
                        >
                          {pct}%
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
                {["Batch Code", "Product", "Zone", "Qty", "Expiry", "Status", "Created"].map((h) => (
                  <th key={h} className="text-left py-2.5 px-3 text-[10px] font-bold text-[#4E6090] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map((b) => {
                // Format expiry date from API
                const expiryStr = b.expiry_date 
                  ? new Date(b.expiry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—';
                
                return (
                  <tr key={b.id} className="border-b border-[#1E2F50]/50 hover:bg-[#14203A] transition-colors">
                    <td className="py-2.5 px-3 font-bold text-[#E8EDF8]">{b.batch_code}</td>
                    <td className="py-2.5 px-3 text-[#8A9BBF]">{b.product_name || b.sku_code}</td>
                    <td className="py-2.5 px-3 text-[#8A9BBF]">{b.zone || "—"}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#E8EDF8]">{b.quantity.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-[#8A9BBF]">{expiryStr}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] font-semibold text-[#E8EDF8]">
                        {b.quantity.toLocaleString()}/{b.original_quantity.toLocaleString()} bags
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#4E6090]">{timeAgo(b.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredBatches.length === 0 && (
            <div className="text-center text-[#4E6090] text-[13px] py-16">
              {batchesFromAPI.length === 0
                ? "No batches found. Add zones to see batch data."
                : "No batches match the current filter."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
