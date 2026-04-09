"use client";

import { useState, useEffect } from "react";
import { CAMERAS, CAM_COL } from "@/lib/depot-data";
import type { CameraFeed } from "@/lib/depot-data";

export default function VisionPage() {
  const [cameras, setCameras] = useState<CameraFeed[]>(CAMERAS);
  const [live, setLive] = useState(true);

  const totalV = cameras.reduce((a, c) => a + c.v, 0);
  const totalP = cameras.reduce((a, c) => a + c.p, 0);
  const totalPer = cameras.reduce((a, c) => a + c.per, 0);

  useEffect(() => {
    if (!live) return;
    const interval = setInterval(() => {
      setCameras((prev) =>
        prev.map((c) =>
          c.status === "active"
            ? {
                ...c,
                v: Math.max(0, c.v + Math.round((Math.random() - 0.5) * 2)),
                p: Math.max(0, c.p + Math.round((Math.random() - 0.5) * 4)),
              }
            : c
        )
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [live]);

  const actCol = (act: string) =>
    act === "HIGH" ? "#E5521A" : act === "MEDIUM" ? "#F5A623" : "#4E6090";

  return (
    <div className="p-5 animate-[fadeIn_0.3s_ease]">
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#E8EDF8]" style={{ fontFamily: "'Syne', sans-serif" }}>
            IntelliVision™ — AI Camera Network
          </h1>
          <p className="text-[11px] text-[#8A9BBF] mt-0.5">
            Real-time object detection, counting & cluster mapping
          </p>
        </div>
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex gap-5 text-[12px]">
            <span className="flex items-center gap-1.5">
              🚛 <span className="font-extrabold text-[#E5521A]" style={{ fontFamily: "'Syne', sans-serif" }}>{totalV}</span> vehicles
            </span>
            <span className="flex items-center gap-1.5">
              📦 <span className="font-extrabold text-[#5B9BF5]" style={{ fontFamily: "'Syne', sans-serif" }}>{totalP}</span> pallets
            </span>
            <span className="flex items-center gap-1.5">
              🤖 <span className="font-extrabold text-[#22D3A1]" style={{ fontFamily: "'Syne', sans-serif" }}>{totalPer}</span> personnel
            </span>
          </div>
          <button
            onClick={() => setLive(!live)}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
              live
                ? "border-[#E5521A] bg-[#E5521A]/10 text-[#E5521A]"
                : "border-[#1E2F50] text-[#8A9BBF]"
            }`}
          >
            {live ? "● LIVE" : "⏸ PAUSED"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {cameras.map((c) => {
          const sCol = CAM_COL[c.status];
          const offline = c.status === "inactive";
          const alertCam = c.status === "alert";

          return (
            <div
              key={c.id}
              className={`bg-[#14203A] border border-[#1E2F50] rounded-[14px] overflow-hidden transition-all hover:border-[#2A3F68] ${
                alertCam ? "animate-[camPulse_2s_ease-in-out_infinite]" : ""
              }`}
            >
              {/* Camera Screen */}
              <div
                className="h-[130px] relative overflow-hidden"
                style={{
                  background: offline
                    ? "#0F1A30"
                    : alertCam
                    ? "linear-gradient(135deg, #1A0808, #2A0D0D)"
                    : "linear-gradient(135deg, #0A1628, #0D1E38)",
                }}
              >
                {offline ? (
                  <div className="flex items-center justify-center h-full text-[11px] text-[#4E6090]">
                    Camera Offline
                  </div>
                ) : (
                  <>
                    <div className="absolute top-2 left-0 right-0 flex justify-between px-2.5 z-10">
                      <span className="bg-black/60 text-[#E8EAED] text-[9px] px-2 py-0.5 rounded backdrop-blur-sm">
                        {c.id}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-bold bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sCol, boxShadow: `0 0 4px ${sCol}` }} />
                        <span style={{ color: sCol }}>{c.status.toUpperCase()}</span>
                      </span>
                    </div>
                    {/* Detection boxes */}
                    <svg className="absolute inset-0 w-full h-full opacity-85">
                      {c.v > 0 && (
                        <>
                          <rect x="15" y="25" width="80" height="55" rx="3" fill="none" stroke="#E5521A" strokeWidth="1.5" />
                          <text x="20" y="23" fontSize="8" fill="#E5521A">Vehicle</text>
                        </>
                      )}
                      {c.p > 0 && (
                        <>
                          <rect x="110" y="18" width="55" height="45" rx="3" fill="none" stroke="#5B9BF5" strokeWidth="1.5" />
                          <text x="112" y="16" fontSize="8" fill="#5B9BF5">Pallet</text>
                        </>
                      )}
                      {c.per > 0 && (
                        <>
                          <ellipse cx="240" cy="60" rx="15" ry="28" fill="none" stroke="#22D3A1" strokeWidth="1.5" />
                          <text x="228" y="96" fontSize="8" fill="#22D3A1">Person</text>
                        </>
                      )}
                    </svg>
                    <div className="absolute bottom-2 left-2.5 bg-black/60 text-[#E8EAED] text-[9px] px-2 py-0.5 rounded backdrop-blur-sm">
                      {c.fps}fps · {c.res} · {c.conf.toFixed(1)}% conf
                    </div>
                  </>
                )}
              </div>

              {/* Camera Info */}
              <div className="p-3">
                <div className="text-[12px] font-bold text-[#E8EDF8] mb-2">{c.name}</div>
                <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                  {[
                    { v: c.v, l: "Vehicles", col: "#E5521A" },
                    { v: c.p, l: "Pallets", col: "#5B9BF5" },
                    { v: c.per, l: "Personnel", col: "#22D3A1" },
                  ].map((d) => (
                    <div key={d.l} className="text-center py-1.5 bg-[#0F1A30] rounded-lg">
                      <div className="text-[17px] font-extrabold" style={{ color: d.col, fontFamily: "'Syne', sans-serif" }}>
                        {d.v}
                      </div>
                      <div className="text-[9px] text-[#4E6090]">{d.l}</div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-[#4E6090] mt-1">
                  <span>Last: {offline ? "—" : `${Math.floor(Math.random() * 5) + 1}s ago`}</span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                    style={{
                      background: `${actCol(c.act)}22`,
                      color: actCol(c.act),
                      borderColor: `${actCol(c.act)}44`,
                    }}
                  >
                    {c.act}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
