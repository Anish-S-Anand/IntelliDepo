"use client";

import { Coffee, Factory, LineChart, Users } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GalaxyBackground } from "./galaxy-background";
import type { SolarVariant } from "./solar-scene";

const SolarScene = dynamic(
  () => import("./solar-scene").then((module) => module.SolarScene),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0" aria-hidden="true" />,
  },
);

const variants: (SolarVariant & { icon: React.ComponentType<{ className?: string }> })[] = [
  {
    id: "stream",
    name: "INTELLI STREAM",
    label: "Financial intelligence",
    summary: "Executive finance visibility, premium analytics surfaces, and strategic decision support in one orbital product experience.",
    accent: "#e59167",
    orbitX: 70,
    orbitZ: 54,
    size: 24,
    speed: 0.1,
    angle: Math.PI * 1.0,
    palette: ["#4b4f5a", "#222631", "#11141b", "#07090e"],
    banding: "striped",
    icon: LineChart,
  },
  {
    id: "depot",
    name: "INTELLI DEPOT",
    label: "Warehouse operations",
    summary: "Inventory movement, fulfillment, and command visibility for logistics teams that need real-time operational clarity.",
    accent: "#d7b27d",
    orbitX: 70,
    orbitZ: 54,
    size: 32,
    speed: 0.1,
    angle: Math.PI * 1.5,
    palette: ["#f2dcc6", "#d58e65", "#b45a46", "#69201c"],
    banding: "marble",
    icon: Factory,
  },
  {
    id: "cafe",
    name: "INTELLI CAFE",
    label: "Employee engagement",
    summary: "A LinkedIn-style employee engagement platform for culture, updates, recognition, and internal community energy.",
    accent: "#d4a855",
    orbitX: 70,
    orbitZ: 54,
    size: 22,
    speed: 0.1,
    angle: Math.PI * 0.5,
    palette: ["#c8d8b0", "#d8cc88", "#c8b060", "#a88840"],
    banding: "faceted",
    icon: Coffee,
  },
  {
    id: "recruit",
    name: "INTELLI RECRUIT",
    label: "Talent platform",
    summary: "Hiring pipeline command, candidate intelligence, and collaborative recruiting decisions across the hiring orbit.",
    accent: "#1a6eb5",
    orbitX: 70,
    orbitZ: 54,
    size: 26,
    speed: 0.1,
    angle: Math.PI * 0.0,
    palette: ["#7a9367", "#4e6054", "#24383d", "#0d1218"],
    banding: "faceted",
    icon: Users,
  },
];

export function IntelliLanding() {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string>("stream");
  const [tooltip, setTooltip] = useState<{ id: string; x: number; y: number } | null>(null);
  const [labelPositions, setLabelPositions] = useState<{ id: string; x: number; y: number; visible: boolean; depth?: number }[]>([]);
  const [showScene, setShowScene] = useState(false);
  const positionsRef = useRef<{ id: string; x: number; y: number; visible: boolean }[]>([]);
  const frameRef = useRef(0);

  const handlePositionsUpdate = useCallback((positions: { id: string; x: number; y: number; visible: boolean }[]) => {
    positionsRef.current = positions;
    frameRef.current += 1;
    if (frameRef.current % 3 === 0) setLabelPositions([...positions]);
  }, []);

  const handleVariantHover = useCallback((id: string) => {
    if (id) {
      setActiveId(id);
      const pos = positionsRef.current.find((p) => p.id === id);
      setTooltip({ id, x: pos?.x ?? window.innerWidth / 2, y: pos?.y ?? window.innerHeight / 2 });
    } else {
      setTooltip(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const startScene = () => {
      if (!cancelled) {
        setShowScene(true);
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(() => startScene(), { timeout: 800 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    timeoutId = setTimeout(startScene, 180);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="relative h-screen overflow-hidden bg-[#020611] text-white">
      <div className="pointer-events-none absolute inset-0">
        <GalaxyBackground />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(1,3,10,0.12),rgba(1,3,10,0.22)_70%,rgba(1,3,10,0.38)_100%)]" />
      </div>

      {showScene ? (
        <div
          className="absolute inset-0 animate-in fade-in duration-700"
          onMouseLeave={() => setTooltip(null)}
        >
          <SolarScene variants={variants} activeId={activeId} onVariantHover={handleVariantHover} onPositionsUpdate={handlePositionsUpdate} />
        </div>
      ) : null}

      {/* Planet name labels — always visible, tracking orbit */}
      {labelPositions.filter((p) => p.id !== "sun").map((pos, i, arr) => {
        const variant = variants.find((v) => v.id === pos.id);
        if (!variant) return null;
        // Hide if too close to another visible label
        const tooClose = arr.some((other, j) => {
          if (j >= i || !other.visible) return false;
          const dx = pos.x - other.x;
          const dy = pos.y - other.y;
          return Math.sqrt(dx * dx + dy * dy) < 80;
        });
        return (
          <div
            key={pos.id}
            className="pointer-events-none absolute z-20 text-center"
            style={{
              left: pos.x,
              top: pos.y + 10,
              transform: "translateX(-50%)",
              opacity: pos.visible && !tooClose ? 1 : 0,
              transition: "opacity 0.6s ease",
              whiteSpace: "nowrap",
            }}
          >
            <p className="text-[13px] font-bold text-white" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.6)" }}>
              {variant.name.replace("INTELLI ", "Intelli ")}
            </p>
            <p className="mt-0.5 text-[10px] italic text-white/55" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
              {variant.label}
            </p>
          </div>
        );
      })}

      {tooltip && (() => {
        const variant = variants.find((v) => v.id === tooltip.id);
        if (!variant) return null;
        return (
          <div
            key={tooltip.id}
            className="pointer-events-none absolute z-50"
            style={{ left: tooltip.x, top: tooltip.y + 44, transform: "translateX(-50%)" }}
          >
            <div
              className="rounded-xl border px-4 py-3 text-center shadow-2xl backdrop-blur-md"
              style={{
                borderColor: `${variant.accent}66`,
                background: `linear-gradient(135deg, rgba(2,6,17,0.96), rgba(2,6,17,0.88))`,
                boxShadow: `0 0 40px ${variant.accent}44, 0 8px 32px rgba(0,0,0,0.8)`,
                minWidth: "190px", maxWidth: "250px",
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: variant.accent }}>{variant.label}</p>
              <p className="mt-1 text-[15px] font-black uppercase tracking-[0.15em] text-white">{variant.name}</p>
              <div className="my-2 h-px w-full" style={{ background: `${variant.accent}44` }} />
              <p className="text-[11px] leading-relaxed text-white/70">{variant.summary}</p>
            </div>
          </div>
        );
      })()}

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,181,85,0.02),transparent_18%),linear-gradient(180deg,rgba(1,3,10,0.03),rgba(1,3,10,0.08)_78%,rgba(1,3,10,0.18)_100%)]" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1540px] flex-col px-6 py-5 lg:px-10">
        <nav className="flex items-center justify-between rounded-full border border-white/10 bg-slate-950/34 px-5 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/92 shadow-[0_0_28px_rgba(128,220,232,0.18)]">
              <Image src="/fidelis-logo.png" alt="Fidelis logo" width={28} height={28} className="h-7 w-7 object-contain" priority />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.34em] text-[#d7fbff]">INTELLI</p>
              <p className="text-xs uppercase tracking-[0.24em] text-white/62">A Fidelis Platform</p>
            </div>
          </div>
          <div className="hidden text-xs uppercase tracking-[0.34em] text-cyan-100/48 lg:block">Cinematic Solar Interface</div>
        </nav>

        {/* Click to know more — below nav, right aligned */}
        <div className="mt-3 flex justify-end pr-1">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-[18px] font-black uppercase tracking-[0.3em] text-white/75 transition hover:text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
          >
            Click to know more →
          </button>
        </div>

        {/* Tagline — just below the solar system */}
        <div className="absolute left-1/2 z-20 -translate-x-1/2" style={{ top: "82%" }}>
          <p className="text-center text-[32px] font-black uppercase tracking-[0.28em] text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.9)]">
            An AI Application Universe from Fidelis
          </p>
        </div>


      </div>
    </div>
  );
}
