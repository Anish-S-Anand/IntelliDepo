"use client";

import { useState, useEffect, useCallback } from "react";
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
    return true;
  });

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
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <h1
            className="text-[22px] font-extrabold text-[#E8EDF8]"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            Inventory Management
          </h1>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            Cluster tracking, FIFO compliance, real-time stock levels
          </p>
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
              <div
                className="text-[11px] font-extrabold text-[#4E6090] tracking-[0.12em]"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                ZONE {z.zone_code}
              </div>
              <div
                className="text-[28px] font-extrabold my-1.5"
                style={{ color: col, fontFamily: "'Syne', sans-serif" }}
              >
                {pct}%
              </div>
              <div className="w-full h-1 bg-[#1E2F50] rounded-full overflow-hidden mt-1.5">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: col }}
                />
              </div>
              <div className="text-[9px] text-[#4E6090] mt-1.5">
                {z.current_occupancy.toLocaleString()} /{" "}
                {z.max_capacity_units.toLocaleString()} bags
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Search + Filters ── */}
      <div className="flex gap-1.5 mb-4 flex-wrap items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product, cluster, batch…"
          className="flex-1 min-w-[180px] px-3 py-2 bg-[#0F1A30] border border-[#1E2F50] rounded-[9px] text-[#E8EDF8] text-[12px] outline-none focus:border-[#E5521A]/40 placeholder:text-[#4E6090]"
        />
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

      {/* ── Cluster Cards ── */}
      {filtered.length === 0 ? (
        <div className="text-center text-[#4E6090] text-[13px] py-16">
          {clusters.length === 0
            ? "No inventory batches found. Seed the database or add batches via the API."
            : "No clusters match the current filter."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {filtered.map((c) => {
            const pct =
              c.capacity > 0 ? Math.round((c.occupied / c.capacity) * 100) : 0;
            const col = occColor(pct);
            return (
              <div
                key={c.id + c.batch}
                className="bg-[#14203A] border rounded-[14px] p-[15px] transition-all hover:border-[#2A3F68] hover:-translate-y-px"
                style={{
                  borderColor: c.fifo
                    ? "#1E2F50"
                    : "rgba(245,166,35,0.35)",
                }}
              >
                <div className="flex justify-between mb-2.5">
                  <div>
                    <div
                      className="text-[15px] font-bold text-[#E8EDF8]"
                      style={{ fontFamily: "'Syne', sans-serif" }}
                    >
                      Cluster {c.id}
                    </div>
                    <div className="text-[11px] text-[#8A9BBF] mt-0.5">
                      {c.product}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                      style={{
                        background: `${col}22`,
                        color: col,
                        borderColor: `${col}44`,
                      }}
                    >
                      {pct}%
                    </span>
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                      style={{
                        background: c.fifo
                          ? "rgba(34,211,161,0.1)"
                          : "rgba(245,166,35,0.1)",
                        color: c.fifo ? "#22D3A1" : "#F5A623",
                        borderColor: c.fifo
                          ? "rgba(34,211,161,0.2)"
                          : "rgba(245,166,35,0.2)",
                      }}
                    >
                      {c.fifo ? "✓ FIFO" : "⚠ FEFO"}
                    </span>
                  </div>
                </div>
                <div className="w-full h-1 bg-[#1E2F50] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: col }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 text-[10px] mt-2.5">
                  <span className="text-[#4E6090]">Capacity</span>
                  <span className="font-semibold text-[#E8EDF8]">
                    {c.capacity.toLocaleString()} bags
                  </span>
                  <span className="text-[#4E6090]">Occupied</span>
                  <span className="font-semibold text-[#E8EDF8]">
                    {c.occupied.toLocaleString()} bags
                  </span>
                  <span className="text-[#4E6090]">Batch</span>
                  <span className="font-semibold text-[#E8EDF8]">
                    {c.batch}
                  </span>
                  <span className="text-[#4E6090]">Last Activity</span>
                  <span className="font-semibold text-[#E8EDF8]">
                    {timeAgo(c.lastActivity)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
