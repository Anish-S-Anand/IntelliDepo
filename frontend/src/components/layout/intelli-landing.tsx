"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Building2,
  Zap,
  Coffee,
  Users,
  ArrowRight,
  Shield,
  BarChart3,
  Eye,
  Cpu,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const PRODUCTS = [
  {
    id: "stream",
    name: "IntelliStream",
    tagline: "Financial Intelligence",
    description:
      "Real-time financial analytics, scenario planning, and macro pulse monitoring for strategic decision-making.",
    icon: Zap,
    color: "#3B82F6",
    gradient: "from-blue-500/20 to-blue-600/5",
    border: "rgba(59,130,246,0.3)",
    href: "/platform/stream",
  },
  {
    id: "depot",
    name: "IntelliDepot",
    tagline: "Warehouse Operations",
    description:
      "AI-powered warehouse management with live cameras, inventory tracking, gate LPR, and incident response.",
    icon: Building2,
    color: "#E5521A",
    gradient: "from-orange-500/20 to-orange-600/5",
    border: "rgba(229,82,26,0.3)",
    href: "/platform/depot",
  },
  {
    id: "cafe",
    name: "IntelliCafe",
    tagline: "Employee Engagement",
    description:
      "A modern employee engagement platform for culture, updates, recognition, and internal community.",
    icon: Coffee,
    color: "#22C55E",
    gradient: "from-green-500/20 to-green-600/5",
    border: "rgba(34,197,94,0.3)",
    href: "/platform/cafe",
  },
  {
    id: "recruit",
    name: "IntelliRecruit",
    tagline: "Talent Platform",
    description:
      "Hiring pipeline command, candidate intelligence, and collaborative recruiting decisions.",
    icon: Users,
    color: "#A855F7",
    gradient: "from-purple-500/20 to-purple-600/5",
    border: "rgba(168,85,247,0.3)",
    href: "/platform/recruit",
  },
];

const STATS = [
  { label: "AI Models Active", value: "12+", icon: Cpu, color: "#3B82F6" },
  { label: "Camera Feeds", value: "6", icon: Eye, color: "#22C55E" },
  { label: "Incidents Resolved", value: "99%", icon: Shield, color: "#E5521A" },
  { label: "Analytics Dashboards", value: "8", icon: BarChart3, color: "#A855F7" },
];

export function IntelliLanding() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Trigger entrance animations
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Ensure video plays on mobile (some browsers block autoplay)
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "#010810" }}>

      {/* ── Navigation ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-8 lg:px-16 py-3 sm:py-4 transition-all duration-500 ${
          scrolled
            ? "bg-[#010810]/95 backdrop-blur-xl border-b border-white/8 shadow-2xl"
            : "bg-transparent"
        }`}
      >
        {/* Logo */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2.5 group"
          aria-label="Home"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm overflow-hidden flex-shrink-0 group-hover:border-[#E5521A]/50 transition-colors">
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
            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.35em] text-[#E5521A] leading-none">
              INTELLI
            </p>
            <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.2em] text-white/40 leading-none mt-0.5">
              A Fidelis Platform
            </p>
          </div>
        </button>

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-6">
          {PRODUCTS.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(p.href)}
              className="text-[13px] text-white/50 hover:text-white transition-colors duration-200 font-semibold relative group"
            >
              {p.name}
              <span
                className="absolute -bottom-0.5 left-0 right-0 h-px scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
                style={{ background: p.color }}
              />
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => router.push("/login")}
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E5521A] hover:bg-[#FF7A42] text-white text-[13px] font-bold transition-all duration-200 shadow-[0_0_20px_rgba(229,82,26,0.3)] hover:shadow-[0_0_30px_rgba(229,82,26,0.5)] active:scale-95"
          >
            Sign In
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden w-9 h-9 flex items-center justify-center text-white/60 hover:text-white transition rounded-lg border border-white/10 hover:border-white/20"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ paddingTop: "64px" }}
      >
        <div className="bg-[#010810]/98 backdrop-blur-xl border-b border-white/8 px-4 py-4">
          {PRODUCTS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                onClick={() => { router.push(p.href); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 py-3 text-left border-b border-white/5 last:border-0 group"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${p.color}20`, border: `1px solid ${p.color}30` }}
                >
                  <Icon className="w-4 h-4" style={{ color: p.color }} />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-white/80 group-hover:text-white transition">{p.name}</div>
                  <div className="text-[11px] text-white/40">{p.tagline}</div>
                </div>
              </button>
            );
          })}
          <button
            onClick={() => { router.push("/login"); setMobileMenuOpen(false); }}
            className="w-full mt-3 py-3 rounded-xl bg-[#E5521A] text-white font-bold text-[14px] transition active:scale-95"
          >
            Sign In
          </button>
        </div>
      </div>

      {/* ── Hero Section with Video ── */}
      <section className="relative h-screen min-h-[600px] max-h-[1000px] flex flex-col items-center justify-center overflow-hidden">
        {/* Looping background video */}
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
        >
          <source src="/logo_intro.mp4" type="video/mp4" />
        </video>

        {/* Gradient overlays for text readability */}
        <div className="absolute inset-0 z-10" style={{
          background: "linear-gradient(to bottom, rgba(1,8,16,0.55) 0%, rgba(1,8,16,0.3) 40%, rgba(1,8,16,0.7) 85%, rgba(1,8,16,1) 100%)"
        }} />
        <div className="absolute inset-0 z-10" style={{
          background: "radial-gradient(ellipse at center, rgba(1,8,16,0.1) 0%, rgba(1,8,16,0.6) 100%)"
        }} />

        {/* Hero content */}
        <div
          className={`relative z-20 text-center px-4 sm:px-8 max-w-5xl mx-auto transition-all duration-1000 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#E5521A]/30 bg-[#E5521A]/10 backdrop-blur-sm text-[#E5521A] text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mb-6 sm:mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E5521A] animate-pulse" />
            AI-Powered Enterprise Platform
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight mb-5 sm:mb-7 leading-[1.02]">
            <span className="text-white drop-shadow-2xl">The Intelligence</span>
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #E5521A 0%, #FF9A6C 40%, #FFD4B8 60%, #E5521A 100%)",
                backgroundSize: "200% 200%",
                animation: "gradient-shift 4s ease infinite",
              }}
            >
              Platform for Fidelis
            </span>
          </h1>

          <p
            className="text-base sm:text-lg lg:text-xl text-white/60 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2"
            style={{ transitionDelay: "200ms" }}
          >
            One unified platform combining warehouse operations, financial intelligence,
            employee engagement, and talent management — all powered by AI.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={() => router.push("/login")}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 sm:px-8 py-3.5 rounded-2xl bg-[#E5521A] hover:bg-[#FF7A42] text-white font-black text-[15px] transition-all duration-200 shadow-[0_0_50px_rgba(229,82,26,0.4)] hover:shadow-[0_0_70px_rgba(229,82,26,0.6)] active:scale-[0.98]"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => router.push("/platform/depot")}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 sm:px-8 py-3.5 rounded-2xl border border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/5 font-bold text-[15px] transition-all duration-200 backdrop-blur-sm active:scale-[0.98]"
            >
              Explore IntelliDepot
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 text-white/30 animate-bounce">
          <span className="text-[10px] font-bold uppercase tracking-widest">Scroll</span>
          <ChevronDown className="w-4 h-4" />
        </div>
      </section>

      {/* Gradient animation keyframe */}
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes stat-count {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Stats Bar ── */}
      <section className="relative z-10 px-4 sm:px-8 lg:px-16 py-10 sm:py-14">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {STATS.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-2 p-4 sm:p-5 rounded-2xl border backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderColor: "rgba(255,255,255,0.08)",
                  animationDelay: `${i * 100}ms`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-1"
                  style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}30` }}
                >
                  <Icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
                <div
                  className="text-2xl sm:text-3xl font-black"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </div>
                <div className="text-[10px] sm:text-[11px] text-white/40 text-center leading-tight font-semibold">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="px-8 lg:px-16 max-w-6xl mx-auto">
        <div className="h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(229,82,26,0.4), transparent)" }} />
      </div>

      {/* ── Products Grid ── */}
      <section className="relative z-10 px-4 sm:px-8 lg:px-16 py-14 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4">
              Platform Suite
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-3">
              Four Powerful Applications
            </h2>
            <p className="text-white/40 text-[13px] sm:text-[15px] max-w-xl mx-auto">
              Each module is purpose-built for its domain, seamlessly integrated across the Fidelis enterprise.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {PRODUCTS.map((product, i) => {
              const Icon = product.icon;
              return (
                <button
                  key={product.id}
                  onClick={() => router.push(product.href)}
                  className={`group text-left p-5 sm:p-7 rounded-3xl border transition-all duration-400 hover:-translate-y-1.5 active:scale-[0.98] relative overflow-hidden`}
                  style={{
                    background: `linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)`,
                    borderColor: "rgba(255,255,255,0.08)",
                    animationDelay: `${i * 80}ms`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = product.border;
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 20px 60px ${product.color}20`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                  }}
                >
                  {/* Background glow */}
                  <div
                    className="absolute -top-20 -right-20 w-48 h-48 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: `${product.color}15` }}
                  />

                  <div className="relative z-10">
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                        style={{
                          background: `${product.color}18`,
                          border: `1px solid ${product.color}35`,
                        }}
                      >
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: product.color }} />
                      </div>
                      <div>
                        <div
                          className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest mb-1"
                          style={{ color: product.color }}
                        >
                          {product.tagline}
                        </div>
                        <h3 className="text-[17px] sm:text-[19px] font-black text-white">
                          {product.name}
                        </h3>
                      </div>
                    </div>
                    <p className="text-[12px] sm:text-[13px] text-white/45 leading-relaxed mb-5">
                      {product.description}
                    </p>
                    <div
                      className="flex items-center gap-1.5 text-[12px] font-black group-hover:gap-3 transition-all duration-200"
                      style={{ color: product.color }}
                    >
                      Launch Application
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 border-t px-4 sm:px-8 lg:px-16 py-7 sm:py-9"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0">
              <Image
                src="/fidelis-logo.png"
                alt="Fidelis"
                width={20}
                height={20}
                className="w-5 h-5 object-contain opacity-50"
              />
            </div>
            <span className="text-[11px] sm:text-[12px] text-white/25 text-center sm:text-left">
              Fidelis Platform · INTELLI Intelligence Suite · {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[11px] text-white/25">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              All systems operational
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
