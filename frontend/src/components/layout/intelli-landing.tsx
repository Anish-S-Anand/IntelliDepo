"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Building2, Zap, Coffee, Users, ArrowRight, Shield, BarChart3, Eye, Cpu, Menu, X } from "lucide-react";
import { useState } from "react";

const PRODUCTS = [
  {
    id: "stream",
    name: "IntelliStream",
    tagline: "Financial Intelligence",
    description: "Real-time financial analytics, scenario planning, and macro pulse monitoring for strategic decision-making.",
    icon: Zap,
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.25)",
    href: "/platform/stream",
  },
  {
    id: "depot",
    name: "IntelliDepot",
    tagline: "Warehouse Operations",
    description: "AI-powered warehouse management with live cameras, inventory tracking, gate LPR, and incident response.",
    icon: Building2,
    color: "#E5521A",
    bg: "rgba(229,82,26,0.08)",
    border: "rgba(229,82,26,0.25)",
    href: "/platform/depot",
  },
  {
    id: "cafe",
    name: "IntelliCafe",
    tagline: "Employee Engagement",
    description: "A modern employee engagement platform for culture, updates, recognition, and internal community.",
    icon: Coffee,
    color: "#22C55E",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.25)",
    href: "/platform/cafe",
  },
  {
    id: "recruit",
    name: "IntelliRecruit",
    tagline: "Talent Platform",
    description: "Hiring pipeline command, candidate intelligence, and collaborative recruiting decisions.",
    icon: Users,
    color: "#A855F7",
    bg: "rgba(168,85,247,0.08)",
    border: "rgba(168,85,247,0.25)",
    href: "/platform/recruit",
  },
];

const STATS = [
  { label: "AI Models Active", value: "12+", icon: Cpu },
  { label: "Camera Feeds", value: "6", icon: Eye },
  { label: "Incidents Resolved", value: "99%", icon: Shield },
  { label: "Analytics Dashboards", value: "8", icon: BarChart3 },
];

export function IntelliLanding() {
  const router = useRouter();
<<<<<<< HEAD
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
=======
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
      const idleId = window.requestIdleCallback(() => startScene(), { timeout: 2500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    timeoutId = setTimeout(startScene, 2200);
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);
>>>>>>> fa12d98 (Lpr Updated recognition system)

  return (
    <div className="min-h-screen bg-[#020B18] text-white overflow-x-hidden">
      {/* Background grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      {/* Radial glows */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[400px] sm:w-[800px] h-[300px] sm:h-[400px] rounded-full bg-blue-600/10 blur-[80px] sm:blur-[120px]" />
      <div className="pointer-events-none fixed top-1/3 right-0 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] rounded-full bg-orange-600/8 blur-[80px] sm:blur-[100px]" />

      {/* ── Navigation ── */}
      <nav className="relative z-20 flex items-center justify-between px-4 sm:px-8 lg:px-16 py-4 border-b border-white/5">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center backdrop-blur-sm overflow-hidden flex-shrink-0">
            <Image
              src="/fidelis-logo.png"
              alt="Fidelis"
              width={28}
              height={28}
              className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
              priority
            />
          </div>
          <div>
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.3em] text-blue-300/80 leading-none">INTELLI</p>
            <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-white/40 leading-none mt-0.5">A Fidelis Platform</p>
          </div>
        </div>

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-5">
          {PRODUCTS.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(p.href)}
              className="text-[13px] text-white/50 hover:text-white transition font-medium"
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/login")}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[12px] sm:text-[13px] font-bold transition"
          >
            Sign In
            <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="relative z-20 lg:hidden bg-[#0a1120] border-b border-white/5 px-4 py-3">
          {PRODUCTS.map((p) => (
            <button
              key={p.id}
              onClick={() => { router.push(p.href); setMobileMenuOpen(false); }}
              className="w-full text-left py-2.5 text-[14px] text-white/60 hover:text-white transition border-b border-white/5 last:border-0"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Hero ── */}
      <section className="relative z-10 px-4 sm:px-8 lg:px-16 pt-12 sm:pt-16 lg:pt-20 pb-10 sm:pb-14 lg:pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] sm:text-[11px] font-semibold uppercase tracking-widest mb-6 sm:mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          AI-Powered Enterprise Platform
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight mb-4 sm:mb-6 leading-[1.05]">
          <span className="text-white">The Intelligence</span>
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent">
            Platform for Fidelis
          </span>
        </h1>

        <p className="text-base sm:text-lg lg:text-xl text-white/50 max-w-xl sm:max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2">
          One unified platform combining warehouse operations, financial intelligence,
          employee engagement, and talent management — all powered by AI.
        </p>

        <div className="flex flex-col xs:flex-row items-center justify-center gap-3 sm:gap-4">
          <button
            onClick={() => router.push("/login")}
            className="w-full xs:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[14px] sm:text-[15px] transition shadow-[0_0_40px_rgba(59,130,246,0.3)]"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push("/platform/depot")}
            className="w-full xs:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl border border-white/15 text-white/70 hover:text-white hover:border-white/30 font-bold text-[14px] sm:text-[15px] transition"
          >
            Explore IntelliDepot
          </button>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="relative z-10 px-4 sm:px-8 lg:px-16 pb-10 sm:pb-14 lg:pb-16">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl bg-white/[0.03] border border-white/8 backdrop-blur-sm"
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                <div className="text-xl sm:text-2xl font-black text-white">{stat.value}</div>
                <div className="text-[10px] sm:text-[11px] text-white/40 text-center leading-tight">{stat.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Products Grid ── */}
      <section className="relative z-10 px-4 sm:px-8 lg:px-16 pb-16 sm:pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white mb-2 sm:mb-3">
              Four Powerful Applications
            </h2>
            <p className="text-white/40 text-[13px] sm:text-[15px]">
              Each module is purpose-built for its domain, seamlessly integrated.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {PRODUCTS.map((product) => {
              const Icon = product.icon;
              return (
                <button
                  key={product.id}
                  onClick={() => router.push(product.href)}
                  className="group text-left p-4 sm:p-6 rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl active:scale-[0.98]"
                  style={{ background: product.bg, borderColor: product.border }}
                >
                  <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                    <div
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${product.color}20`, border: `1px solid ${product.color}40` }}
                    >
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: product.color }} />
                    </div>
                    <div>
                      <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mb-0.5 sm:mb-1" style={{ color: product.color }}>
                        {product.tagline}
                      </div>
                      <h3 className="text-[16px] sm:text-[18px] font-black text-white">{product.name}</h3>
                    </div>
                  </div>
                  <p className="text-[12px] sm:text-[13px] text-white/50 leading-relaxed mb-3 sm:mb-4">{product.description}</p>
                  <div
                    className="flex items-center gap-1.5 text-[11px] sm:text-[12px] font-bold group-hover:gap-2.5 transition-all"
                    style={{ color: product.color }}
                  >
                    Launch Application
                    <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 px-4 sm:px-8 lg:px-16 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0">
              <Image
                src="/fidelis-logo.png"
                alt="Fidelis"
                width={20}
                height={20}
                className="w-5 h-5 object-contain opacity-50"
              />
            </div>
            <span className="text-[11px] sm:text-[12px] text-white/30 text-center sm:text-left">
              Fidelis Platform · INTELLI Intelligence Suite · {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            All systems operational
          </div>
        </div>
      </footer>
    </div>
  );
}
