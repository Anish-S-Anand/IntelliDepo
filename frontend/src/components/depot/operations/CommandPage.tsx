"use client";

import { DEPOTS, INCIDENTS, SEV_COL } from "@/lib/depot-data";

export default function CommandPage() {
  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      <div className="mb-5">
        <h1 className="text-[22px] font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
          Command Center
        </h1>
        <p className="text-[11px] text-[#8A9BBF] mt-0.5">
          Multi-depot operations overview and global incident feed
        </p>
      </div>

      {/* Depot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 mb-5">
        {DEPOTS.map((dep) => {
          const col = dep.health >= 90 ? "#22D3A1" : dep.health >= 75 ? "#F5A623" : "#F04A4A";
          return (
            <div
              key={dep.id}
              className="bg-[#14203A] border-[1.5px] border-[#1E2F50] rounded-[14px] p-[18px] cursor-pointer transition-all hover:bg-[#E5521A]/3 hover:border-[#2A3F68]"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-[15px] font-bold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
                    {dep.name}
                  </div>
                  <div className="text-[10px] text-[#8A9BBF] mt-0.5">{dep.loc}</div>
                </div>
                <div
                  className="w-[42px] h-[42px] rounded-full flex items-center justify-center border-2 text-[10px] font-extrabold flex-shrink-0"
                  style={{ borderColor: col, color: col, fontFamily: "'Syne', sans-serif" }}
                >
                  {dep.health}%
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] mb-2.5">
                <span className="text-[#4E6090]">Utilization</span>
                <span className="font-bold text-[#E8EDF8]">{dep.util}%</span>
                <span className="text-[#4E6090]">Active Trucks</span>
                <span className="font-bold text-[#E8EDF8]">{dep.trucks}</span>
                <span className="text-[#4E6090]">FIFO</span>
                <span className="font-bold text-[#22D3A1]">{dep.fifo}%</span>
                <span className="text-[#4E6090]">Avg Load</span>
                <span className="font-bold text-[#E8EDF8]">{dep.load} min</span>
              </div>
              <div className="w-full h-1 bg-[#1E2F50] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${dep.util}%`, background: col }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Incident Feed */}
      <div className="bg-[#14203A] border border-[#1E2F50] rounded-[14px] p-[18px]">
        <div className="text-[13px] font-bold text-[#E8EDF8] mb-3.5" style={{ fontFamily: "'Syne', sans-serif" }}>
          Global Incident Feed
        </div>
        <div className="space-y-2">
          {INCIDENTS.slice(0, 5).map((i) => (
            <div
              key={i.id}
              className="flex justify-between items-center p-2.5 bg-[#0F1A30] rounded-[10px] transition-all hover:bg-[#E5521A]/4"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-[34px] rounded flex-shrink-0" style={{ background: SEV_COL[i.sev] }} />
                <div>
                  <div className="text-[11px] font-semibold text-[#E8EDF8]">{i.type}</div>
                  <div className="text-[10px] text-[#8A9BBF]">{i.loc}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
                  style={{ background: `${SEV_COL[i.sev]}22`, color: SEV_COL[i.sev], borderColor: `${SEV_COL[i.sev]}33` }}
                >
                  {i.sev}
                </span>
                <span className="text-[9px] text-[#4E6090]">{i.t}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
