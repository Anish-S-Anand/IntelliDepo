"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Calendar, Package, Layers, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";

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
type SortOrder = "newest" | "oldest";

const CEMENT_COMPANIES = ["UltraTech Cement", "ACC Cement", "JSW Cement", "Ambuja Cement"];

// ---------------------------------------------------------------------------
// Add Cluster Modal
// ---------------------------------------------------------------------------

interface AddClusterModalProps {
  onClose: () => void;
  onAdd: (batch: BatchData) => void;
  onRefresh: () => void;
}

function AddClusterModal({ onClose, onAdd, onRefresh }: AddClusterModalProps) {
  const [form, setForm] = useState({
    zone: "A",
    product: CEMENT_COMPANIES[0],
    batch: "",
    quantity: "500",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product || !form.batch) return;
    setSubmitting(true);
    setError("");
    try {
      // POST new batch to backend
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch("/backend/depot/vision/sequencing/batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          batch_code: form.batch,
          sku_code: `SKU-${form.zone}-${Date.now()}`,
          product_name: form.product,
          zone: form.zone,
          quantity: parseInt(form.quantity) || 500,
          sequencing_rule: "FIFO",
        }),
      });

      if (res.ok) {
        const createdBatch: BatchData = await res.json();
        onAdd(createdBatch);
        onRefresh();
        onClose();
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || `Failed (HTTP ${res.status})`);
      }
    } catch {
      setError("Network error — could not reach server");
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#1E2F50] bg-[#14203A] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-bold text-[#E8EDF8]">Add New Batch</h3>
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
              className="w-full px-3 py-2 bg-[#0F1A30] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[var(--accent-border)]"
            >
              {["A", "B", "C", "D"].map((z) => (
                <option key={z} value={z}>Zone {z}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#4E6090] font-semibold uppercase tracking-wider block mb-1.5">Product Name *</label>
            <select
              required
              value={form.product}
              onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
              className="w-full px-3 py-2 bg-[#0F1A30] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[var(--accent-border)]"
            >
              {CEMENT_COMPANIES.map((company) => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[#4E6090] font-semibold uppercase tracking-wider block mb-1.5">Batch Code *</label>
            <input
              required
              value={form.batch}
              onChange={(e) => setForm((f) => ({ ...f, batch: e.target.value }))}
              placeholder="e.g. B2025-1024"
              className="w-full px-3 py-2 bg-[#0F1A30] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[var(--accent-border)] placeholder:text-[#4E6090]"
            />
          </div>
          <div>
            <div>
              <label className="text-[10px] text-[#4E6090] font-semibold uppercase tracking-wider block mb-1.5">Quantity</label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="500"
                className="w-full px-3 py-2 bg-[#0F1A30] border border-[#1E2F50] rounded-lg text-[#E8EDF8] text-[12px] outline-none focus:border-[var(--accent-border)] placeholder:text-[#4E6090]"
              />
            </div>
          </div>
          {error && <p className="text-[11px] text-[#F04A4A]">{error}</p>}
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
              disabled={submitting}
              className="px-5 py-2 rounded-lg theme-bg-accent text-white text-[12px] font-bold hover:bg-[var(--accent-hover)] transition disabled:opacity-60"
            >
              {submitting ? "Adding..." : "Add Batch"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
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

function displayZoneName(zone: ZoneData): string {
  return zone.name
    .replace(/\s+[—-]\s+Zone\s+[A-Z0-9]+$/i, "")
    .replace(/^Storage Bay\s+[A-Z0-9]+\s+[—-]\s+/i, "")
    .trim();
}

function matchesSearch(query: string, values: Array<string | number | null | undefined>): boolean {
  if (!query) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(query));
}

function batchCapacity(batch: BatchData): number {
  return batch.original_quantity > 0 ? batch.original_quantity : batch.quantity;
}

function batchOccupied(batch: BatchData): number {
  return Math.min(batch.quantity, batchCapacity(batch));
}

function newestBatchesFirst(batches: BatchData[]): BatchData[] {
  return [...batches].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function sortBatchesByCreatedAt(batches: BatchData[], sortOrder: SortOrder): BatchData[] {
  return [...batches].sort((a, b) => {
    const newestFirst = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return sortOrder === "newest" ? newestFirst : -newestFirst;
  });
}

function isWithinDateRange(value: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  if (from) {
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    if (date < fromDate) return false;
  }

  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    if (date > toDate) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// BatchesTable — paginated table with Bootstrap5-style pagination
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;

function BatchesTable({
  batches,
  batchesFromAPI,
  onDelete,
}: {
  batches: BatchData[];
  batchesFromAPI: BatchData[];
  onDelete: (batch: BatchData) => void;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(batches.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = batches.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset to page 1 when filter changes
  useEffect(() => { setPage(1); }, [batches.length]);

  const pageNums: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNums.push(i);
  } else {
    pageNums.push(1);
    if (safePage > 3) pageNums.push("...");
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pageNums.push(i);
    if (safePage < totalPages - 2) pageNums.push("...");
    pageNums.push(totalPages);
  }

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto rounded-[12px] border border-[#1E2F50]">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#0F1A30] border-b border-[#1E2F50]">
              {["Batch Code", "Product", "Zone", "Stock / Capacity", "Created", "Status", "Expiry", ""].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-[10px] font-bold text-[#4E6090] uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((b, idx) => {
              const expiryStr = b.expiry_date
                ? new Date(b.expiry_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                : "—";
              const createdStr = new Date(b.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
              const isNearExpiry = b.is_near_expiry;
              const capacity = batchCapacity(b);
              const occupied = batchOccupied(b);
              return (
                <tr key={b.id} className={`border-b border-[#1E2F50]/40 transition-colors ${idx % 2 === 0 ? "bg-[#0A0E1A]" : "bg-[#0D1525]"} hover:bg-[#14203A]`}>
                  <td className="py-3 px-4 font-bold text-[#E8EDF8] whitespace-nowrap">{b.batch_code}</td>
                  <td className="py-3 px-4 text-[#8A9BBF]">{b.product_name || b.sku_code}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1E2F50] text-[#5B9BF5]">
                      Zone {b.zone || "—"}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-[#E8EDF8]">{occupied.toLocaleString()}/{capacity.toLocaleString()}</td>
                  <td className="py-3 px-4 text-[#8A9BBF] whitespace-nowrap">{createdStr}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      b.status === "active" ? "bg-[#22D3A1]/15 text-[#22D3A1]" :
                      b.status === "expired" ? "bg-[#F04A4A]/15 text-[#F04A4A]" :
                      "bg-[#4E6090]/20 text-[#4E6090]"
                    }`}>
                      {b.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#8A9BBF] whitespace-nowrap">
                    <span className={isNearExpiry ? "text-[#F04A4A]" : ""}>
                      {expiryStr}
                      {isNearExpiry && <span className="ml-1 text-[9px] bg-[#F04A4A]/15 text-[#F04A4A] px-1.5 py-0.5 rounded-full">Near Expiry</span>}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(b)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E2F50] text-[#8A9BBF] transition hover:border-[#F04A4A]/40 hover:bg-[#F04A4A]/10 hover:text-[#F04A4A]"
                      title={`Delete ${b.batch_code}`}
                      aria-label={`Delete ${b.batch_code}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {paginated.length === 0 && (
          <div className="text-center text-[#4E6090] text-[13px] py-16">
            {batchesFromAPI.length === 0 ? "No batches found. Add a batch to get started." : "No batches match the current filter."}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
          <span className="text-[11px] text-[#4E6090]">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, batches.length)} of {batches.length} batches
          </span>
          <div className="flex items-center gap-1">
            {/* Prev */}
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-[#1E2F50] text-[#8A9BBF] hover:border-[var(--accent-border)] hover:theme-text-nav-active disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              ‹ Prev
            </button>
            {/* Page numbers */}
            {pageNums.map((n, i) =>
              n === "..." ? (
                <span key={`ellipsis-${i}`} className="px-2 text-[#4E6090] text-[11px]">…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n as number)}
                  className={`w-8 h-8 rounded-lg text-[11px] font-bold border transition ${
                    safePage === n
                      ? "theme-bg-accent border-[var(--accent)] text-white"
                      : "border-[#1E2F50] text-[#8A9BBF] hover:border-[var(--accent-border)] hover:theme-text-nav-active"
                  }`}
                >
                  {n}
                </button>
              )
            )}
            {/* Next */}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-[#1E2F50] text-[#8A9BBF] hover:border-[var(--accent-border)] hover:theme-text-nav-active disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InventoryPage() {
  const router = useRouter();
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
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [successMessage, setSuccessMessage] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [zonesRes, batchesRes] = await Promise.allSettled([
        fetch("/backend/depot/vision/cluster/zones"),
        fetch("/backend/depot/vision/sequencing/batches?status=active"),
      ]);

      // Heatmap data (for accurate zone utilization) - removed as it's not being fetched
      let heatmapData: Record<string, { utilization_pct: number; current_occupancy: number; max_capacity_units: number }> = {};
      // Note: heatmapRes was removed since no third fetch was provided

      // Zones
      if (zonesRes.status === "fulfilled" && zonesRes.value.ok) {
        const zData: ZoneData[] = await zonesRes.value.json();
        setZones(zData.sort((a, b) => a.zone_code.localeCompare(b.zone_code)));
      }

      // Batches → cluster cards AND store raw batch data
      if (batchesRes.status === "fulfilled" && batchesRes.value.ok) {
        const bData: BatchData[] = newestBatchesFirst(await batchesRes.value.json());
        setBatchesFromAPI(bData); // Store raw API data
        const cards: ClusterCard[] = bData
          .filter((b) => b.status === "active")
          .map((b) => ({
            id: b.id,
            zone: b.zone || "—",
            product: b.product_name || b.sku_code,
            capacity: batchCapacity(b),
            occupied: batchOccupied(b),
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

  const normalizedSearch = search.trim().toLowerCase();
  const hasActiveFilters = normalizedSearch !== "" || filter !== "all" || dateFrom !== "" || dateTo !== "" || sortOrder !== "newest";

  const resetFilters = () => {
    setSearch("");
    setFilter("all");
    setDateFrom("");
    setDateTo("");
    setSortOrder("newest");
  };

  const deleteBatch = async (batch: BatchData) => {
    const confirmed = window.confirm(`Delete batch ${batch.batch_code}?`);
    if (!confirmed) return;

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`/backend/depot/vision/sequencing/batches/${batch.id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to delete batch (HTTP ${res.status})`);
      }

      setBatchesFromAPI((prev) => prev.filter((b) => b.id !== batch.id));
      setClusters((prev) => prev.filter((c) => c.id !== batch.id));
      setSuccessMessage(`Batch ${batch.batch_code} deleted`);
      window.setTimeout(() => setSuccessMessage(""), 3500);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not delete batch");
    }
  };

  // Filter zones using backend-synchronized capacity totals.
  const displayZones = zones.filter(z => {
    if (filter === "full" && z.utilization_pct < 70) return false;
    if (filter === "empty" && z.current_occupancy !== 0) return false;
    // For search, check if any clusters in this zone match
    if (normalizedSearch) {
      const zoneClusters = clusters.filter(c => c.zone === z.zone_code);
      const hasMatch = zoneClusters.some(c => 
        matchesSearch(normalizedSearch, [c.product, c.id, c.zone, `zone ${c.zone}`, c.batch, c.rack])
      ) || matchesSearch(normalizedSearch, ["zone", z.zone_code, `zone ${z.zone_code}`, z.name, z.zone_type, z.status]);
      if (!hasMatch) return false;
    }
    if ((dateFrom || dateTo) && !clusters.some((c) => c.zone === z.zone_code && isWithinDateRange(c.lastActivity, dateFrom, dateTo))) return false;
    return true;
  });

  // Filter batches using real API data
  const filteredBatches = sortBatchesByCreatedAt(batchesFromAPI.filter((b) => {
    const capacity = batchCapacity(b);
    const occupied = batchOccupied(b);
    const pct = capacity > 0 ? occupied / capacity : 0;
    if (filter === "full" && pct < 0.70) return false; // Changed to 70% threshold
    if (filter === "empty" && occupied !== 0) return false; // Fixed: empty means occupied = 0
    if (!matchesSearch(normalizedSearch, [b.batch_code, b.product_name, b.sku_code, b.zone, b.rack, b.bin_location, b.status])) return false;
    if (!isWithinDateRange(b.created_at, dateFrom, dateTo)) return false;
    return true;
  }), sortOrder);

  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Near Full", value: "full" },
    { label: "Empty", value: "empty" },
  ];

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      {successMessage && (
        <div className="fixed right-5 top-5 z-[10000] rounded-xl border border-[#22D3A1]/30 bg-[#0F1A30] px-4 py-3 text-[12px] font-bold text-[#22D3A1] shadow-2xl">
          {successMessage}
        </div>
      )}

      {/* Add Cluster Modal */}
      {showAddModal && (
        <AddClusterModal
          onClose={() => setShowAddModal(false)}
          onAdd={(newBatch) => {
            setBatchesFromAPI((prev) => newestBatchesFirst([newBatch, ...prev]));
            setClusters((prev) => [
              {
                id: newBatch.id,
                zone: newBatch.zone || "—",
                product: newBatch.product_name || newBatch.sku_code,
                capacity: batchCapacity(newBatch),
                occupied: batchOccupied(newBatch),
                batch: newBatch.batch_code,
                fifo: newBatch.sequencing_rule === "FIFO",
                lastActivity: newBatch.created_at,
                rack: newBatch.rack || "—",
              },
              ...prev,
            ]);
            setSuccessMessage(`Batch ${newBatch.batch_code} created`);
            window.setTimeout(() => setSuccessMessage(""), 3500);
          }}
          onRefresh={() => { fetchData(); setViewTab("batches"); }}
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
            onClick={() => {
              // Build CSV from zones + batches
              const rows = [
                ["Zone", "Product", "Batch", "Occupied", "Capacity", "Utilization %", "Status", "Rack", "Expiry Date"],
                ...batchesFromAPI.map((b) => {
                  const capacity = batchCapacity(b);
                  const occupied = batchOccupied(b);
                  return [
                    b.zone ?? "",
                    b.product_name ?? b.sku_code,
                    b.batch_code,
                    occupied,
                    capacity,
                    capacity > 0 ? ((occupied / capacity) * 100).toFixed(1) + "%" : "",
                    b.status,
                    b.rack ?? "",
                    b.expiry_date ?? "",
                  ];
                }),
              ];
              const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-semibold hover:border-[#2A3F68] hover:text-[#E8EDF8] transition"
          >
            Export CSV
          </button>
          {/* Export PDF Report Button */}
          <button
            onClick={() => {
              const now = new Date().toLocaleString();
              const rows = batchesFromAPI.map((b) => {
                const capacity = batchCapacity(b);
                const occupied = batchOccupied(b);
                return `<tr>
                  <td>${b.zone ?? ""}</td>
                  <td>${b.product_name ?? b.sku_code}</td>
                  <td>${b.batch_code}</td>
                  <td>${occupied}</td>
                  <td>${capacity}</td>
                  <td>${capacity > 0 ? ((occupied / capacity) * 100).toFixed(1) + "%" : ""}</td>
                  <td>${b.status}</td>
                  <td>${b.rack ?? ""}</td>
                  <td>${b.expiry_date ?? ""}</td>
                </tr>`;
              }).join("");

              const html = `<!DOCTYPE html><html><head><title>Inventory Report</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
                h1 { font-size: 20px; margin-bottom: 4px; }
                p { font-size: 12px; color: #666; margin-bottom: 16px; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; }
                th { background: #f0f0f0; padding: 8px; text-align: left; border: 1px solid #ddd; }
                td { padding: 7px 8px; border: 1px solid #eee; }
                tr:nth-child(even) { background: #fafafa; }
              </style></head><body>
              <h1>IntelliDepo — Inventory Report</h1>
              <p>Generated: ${now}</p>
              <table>
                <thead><tr>
                  <th>Zone</th><th>Product</th><th>Batch</th><th>Qty</th>
                  <th>Capacity</th><th>Utilization</th><th>Status</th><th>Rack</th><th>Expiry</th>
                </tr></thead>
                <tbody>${rows}</tbody>
              </table>
              </body></html>`;

              const win = window.open("", "_blank");
              if (win) {
                win.document.write(html);
                win.document.close();
                win.print();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#1E2F50] text-[#8A9BBF] text-[11px] font-semibold hover:border-[#2A3F68] hover:text-[#E8EDF8] transition"
          >
            Export PDF Report
          </button>
          {/* Dynamic Add Button - changes based on active tab */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg theme-bg-accent text-white text-[11px] font-bold hover:bg-[var(--accent-hover)] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            {viewTab === "clusters" ? "Add Batch" : "Add Batch"}
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
              onClick={() => router.push(`/depot/heatmap?zone=${z.zone_code}`)}
              className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 text-center relative overflow-hidden transition-all hover:border-[var(--accent-border)] hover:shadow-[0_6px_24px_rgba(229,82,26,0.08)] cursor-pointer"
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
              ? "theme-bg-accent text-white"
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
              ? "theme-bg-accent text-white"
              : "text-[#8A9BBF] hover:text-[#E8EDF8]"
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          Batches
        </button>
      </div>

      {/* ── Search + Filters + Date Range ── */}
      <div className="bg-[#0F1A30] border border-[#1E2F50] rounded-[14px] p-3 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px] px-3 py-2 bg-[#14203A] border border-[#1E2F50] rounded-[10px] focus-within:border-[var(--accent-border)]">
            <svg className="w-3.5 h-3.5 text-[#4E6090] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, zone, batch…"
              className="flex-1 bg-transparent text-[#E8EDF8] text-[12px] outline-none placeholder:text-[#4E6090]"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-[#4E6090] hover:text-[#E8EDF8]">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[#14203A] border border-[#1E2F50] rounded-[10px] focus-within:border-[var(--accent-border)]">
            <Calendar className="w-3.5 h-3.5 text-[#4E6090] shrink-0" />
            <span className="text-[10px] text-[#4E6090] font-semibold uppercase tracking-wide">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo || undefined}
              className="bg-transparent text-[#E8EDF8] text-[11px] outline-none w-[120px]"
            />
            <span className="text-[#1E2F50]">|</span>
            <span className="text-[10px] text-[#4E6090] font-semibold uppercase tracking-wide">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              className="bg-transparent text-[#E8EDF8] text-[11px] outline-none w-[120px]"
            />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-[#4E6090] hover:text-[#E8EDF8] ml-1">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Status filters */}
          <div className="flex items-center gap-1 bg-[#14203A] border border-[#1E2F50] rounded-[10px] p-1">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-[8px] text-[11px] font-bold transition-all ${
                  filter === f.value
                    ? "theme-bg-accent text-white shadow-sm"
                    : "text-[#8A9BBF] hover:text-[#E8EDF8] hover:bg-[#1E2F50]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <label className="flex items-center gap-2 px-3 py-2 bg-[#14203A] border border-[#1E2F50] rounded-[10px]">
            <span className="text-[10px] text-[#4E6090] font-semibold uppercase tracking-wide">Sort</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="bg-transparent text-[#E8EDF8] text-[11px] font-semibold outline-none"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>

          {/* Clear all */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="px-3 py-2 rounded-[10px] border border-[var(--accent-border)] theme-text-nav-active text-[11px] font-bold hover:theme-bg-accent-subtle transition"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Active filter summary */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#1E2F50]">
            <span className="text-[10px] text-[#4E6090]">Active filters:</span>
            {search && <span className="text-[10px] theme-bg-accent-subtle theme-text-nav-active px-2 py-0.5 rounded-full border border-[var(--accent-border)]">Search: &quot;{search}&quot;</span>}
            {filter !== "all" && <span className="text-[10px] bg-[#5B9BF5]/10 text-[#5B9BF5] px-2 py-0.5 rounded-full border border-[#5B9BF5]/20">{filter === "full" ? "Near Full" : "Empty"}</span>}
            {(dateFrom || dateTo) && <span className="text-[10px] bg-[#22D3A1]/10 text-[#22D3A1] px-2 py-0.5 rounded-full border border-[#22D3A1]/20">{dateFrom || "…"} → {dateTo || "…"}</span>}
          </div>
        )}
      </div>

      {/* ── Clusters View ── */}
      {viewTab === "clusters" && (
        <>
          {displayZones.length === 0 ? (
            <div className="text-center text-[#4E6090] text-[13px] py-16">
              {zones.length === 0
                ? "No inventory zones found. Click \"Add Zone\" to register one."
                : "No zones match the current filter."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {displayZones.map((z) => {
                const pct = Math.round(z.utilization_pct);
                const col = zoneColor(pct);
                return (
                  <div
                    key={z.id}
                    onClick={() => router.push(`/depot/heatmap?zone=${z.zone_code}`)}
                    className="bg-[#14203A] border rounded-[14px] p-[15px] transition-all hover:border-[var(--accent-border)] hover:-translate-y-px cursor-pointer"
                    style={{ borderColor: "#1E2F50" }}
                  >
                    <div className="flex justify-between mb-2.5">
                      <div>
                        <div className="text-[15px] font-bold text-[#E8EDF8]">Zone {z.zone_code}</div>
                        <div className="text-[11px] text-[#8A9BBF] mt-0.5">{displayZoneName(z)}</div>
                        <div className="text-[10px] text-[#4E6090] mt-0.5">{z.zone_type}</div>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <span
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                          style={{ background: `${col}22`, color: col, borderColor: `${col}44` }}
                        >
                          {pct}%
                        </span>
                        <span className="text-[9px] text-[#4E6090] mt-0.5">View map →</span>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-[#1E2F50] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 text-[10px] mt-2.5">
                      <span className="text-[#4E6090]">Capacity</span>
                      <span className="font-semibold text-[#E8EDF8]">{z.max_capacity_units.toLocaleString()} bags</span>
                      <span className="text-[#4E6090]">Occupied</span>
                      <span className="font-semibold text-[#E8EDF8]">{z.current_occupancy.toLocaleString()} bags</span>
                      <span className="text-[#4E6090]">Status</span>
                      <span className="font-semibold text-[#E8EDF8]">{z.status}</span>
                      <span className="text-[#4E6090]">Utilization</span>
                      <span className="font-semibold text-[#E8EDF8]">{z.utilization_pct.toFixed(1)}%</span>
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
        <BatchesTable batches={filteredBatches} batchesFromAPI={batchesFromAPI} onDelete={deleteBatch} />
      )}
    </div>
  );
}
