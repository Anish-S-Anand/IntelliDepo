"use client";

import { useState } from "react";
import { CLUSTERS, ZONES, occColor } from "@/lib/depot-data";

type FilterType = "all" | "full" | "empty" | "fifo";

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const filtered = CLUSTERS.filter((c) => {
    if (filter === "full" && c.occ / c.cap < 0.85) return false;
    if (filter === "empty" && c.occ > 0) return false;
    if (filter === "fifo" && c.fifo) return false;
    if (search && !c.prod.toLowerCase().includes(search.toLowerCase()) && !c.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Near Full", value: "full" },
    { label: "Empty", value: "empty" },
    { label: "FIFO Warn", value: "fifo" },
  ];

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
            Inventory Management
          </h1>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            Cluster tracking, FIFO compliance, real-time stock levels
          </p>
        </div>
      </div>

      {/* Zone Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {ZONES.map((z) => (
          <div key={z.name} className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-4 text-center relative overflow-hidden transition-all hover:border-[#E5521A]/30 hover:shadow-[0_6px_24px_rgba(229,82,26,0.08)]">
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${z.color}, transparent)`, opacity: 0.8 }} />
            <div className="text-[11px] font-extrabold text-[#4E6090] tracking-[0.12em]" style={{ fontFamily: "'Syne', sans-serif" }}>
              {z.name}
            </div>
            <div className="text-[28px] font-extrabold my-1.5" style={{ color: z.color, fontFamily: "'Syne', sans-serif" }}>
              {z.pct}%
            </div>
            <div className="w-full h-1 bg-[#1E2F50] rounded-full overflow-hidden mt-1.5">
              <div className="h-full rounded-full" style={{ width: `${z.pct}%`, background: z.color }} />
            </div>
            <div className="text-[9px] text-[#4E6090] mt-1.5">
              {z.bags.toLocaleString()} / {z.cap.toLocaleString()} bags
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-4 flex-wrap items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product, cluster…"
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

      {/* Cluster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((c) => {
          const pct = Math.round((c.occ / c.cap) * 100);
          const col = occColor(pct);
          return (
            <div
              key={c.id}
              className="bg-[#14203A] border rounded-[14px] p-[15px] transition-all hover:border-[#2A3F68] hover:-translate-y-px"
              style={{ borderColor: c.fifo ? "#1E2F50" : "rgba(245,166,35,0.35)" }}
            >
              <div className="flex justify-between mb-2.5">
                <div>
                  <div className="text-[15px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Cluster {c.id}
                  </div>
                  <div className="text-[11px] text-[#8A9BBF] mt-0.5">{c.prod}</div>
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
                    {c.fifo ? "✓ FIFO" : "⚠ FIFO"}
                  </span>
                </div>
              </div>
              <div className="w-full h-1 bg-[#1E2F50] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
              </div>
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 text-[10px] mt-2.5">
                <span className="text-[#4E6090]">Capacity</span>
                <span className="font-semibold text-[#E8EDF8]">{c.cap.toLocaleString()} bags</span>
                <span className="text-[#4E6090]">Occupied</span>
                <span className="font-semibold text-[#E8EDF8]">{c.occ.toLocaleString()} bags</span>
                <span className="text-[#4E6090]">Batch</span>
                <span className="font-semibold text-[#E8EDF8]">{c.batch}</span>
                <span className="text-[#4E6090]">Last Activity</span>
                <span className="font-semibold text-[#E8EDF8]">{c.act}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
