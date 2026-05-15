"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Building2,
  ArrowRight,
  Shield,
  BarChart3,
  Truck,
  Package,
  Menu,
  X,
  ChevronDown,
  Bell,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

/* ── Only IntelliDepot ── */
const PRODUCTS = [
  {
    id: "depot",
    name: "IntelliDepot",
    tagline: "Warehouse Operations",
    description:
      "Comprehensive warehouse management with live camera monitoring, inventory tracking, gate management, and real-time incident response.",
    icon: Building2,
    color: "#E5521A",
    gradient: "from-orange-500/20 to-orange-600/5",
    border: "rgba(229,82,26,0.4)",
    href: "/platform/depot",
  },
];

/* ── Business-friendly stats (no technical jargon) ── */
const STATS = [
  { label: "Depots Managed",      value: "15+",  icon: Building2, color: "#E5521A" },
  { label: "Trucks Tracked Daily", value: "200+", icon: Truck,     color: "#22C55E" },
  { label: "Incidents Resolved",   value: "99%",  icon: Shield,    color: "#3B82F6" },
  { label: "Accuracy Rate",        value: "99.8%",icon: BarChart3, color: "#A855F7" },
];

export function IntelliLanding() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled]             = useState(false);
  const [visible, setVisible]               = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "#010810" }}>

      {/* ══ TOPBAR — matches reference HTML exactly ══ */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 flex items-center gap-2.5 px-4 py-0 transition-all duration-500 ${
          scrolled
            ? "bg-[#0B1220]/98 backdrop-blur-xl shadow-2xl"
            : "bg-[#0B1220]/90 backdrop-blur-md"
        }`}
        style={{
          height: 60,
          borderBottom: "1px solid #1C2D4F",
        }}
      >
        {/* Logo */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2.5 flex-shrink-0 group"
          aria-label="Home"
          style={{ textDecoration: "none" }}
        >
          <div
            className="flex items-center justify-center rounded-xl overflow-hidden flex-shrink-0"
            style={{ width: 28, height: 28 }}
          >
            <Image
              src="/fidelis-logo.png"
              alt="Fidelis"
              width={28}
              height={28}
              className="object-contain"
              style={{ filter: "drop-shadow(0 0 6px rgba(229,82,26,0.5))" }}
              priority
            />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#E5521A", letterSpacing: "-0.4px", lineHeight: 1.1 }}>
              Fidelis
            </div>
            <div style={{ fontSize: 11, color: "#7A8FAE", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              IntelliDepot™
            </div>
          </div>
        </button>

        {/* Vertical divider */}
        <div style={{ width: 1, height: 24, background: "#1C2D4F", flexShrink: 0 }} />

        {/* Depot selector */}
        <select
          className="depot-sel"
          style={{
            padding: "7px 12px",
            background: "#0D1526",
            border: "1px solid #1C2D4F",
            borderRadius: 7,
            color: "#E8EDF8",
            fontSize: 15,
            fontWeight: 700,
            outline: "none",
          }}
        >
          <option>📍 Mumbai Central</option>
          <option>📍 Delhi North Hub</option>
          <option>📍 Dubai South</option>
        </select>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* LIVE badge */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "6px 14px", borderRadius: 99,
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.2)",
            fontSize: 14, fontWeight: 700, color: "#22C55E",
            letterSpacing: "0.04em",
          }}
        >
          <span
            style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "#22C55E",
              animation: "blink 1.4s ease-in-out infinite",
              display: "inline-block",
            }}
          />
          LIVE
        </div>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Refresh */}
        <button
          title="Refresh"
          style={{
            width: 34, height: 34, borderRadius: 7,
            border: "1px solid #1C2D4F",
            background: "transparent", color: "#7A8FAE",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}
        >
          <RefreshCw size={16} />
        </button>

        {/* Alerts bell */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => router.push("/login")}
            title="Alerts"
            style={{
              width: 34, height: 34, borderRadius: 7,
              border: "1px solid #1C2D4F",
              background: "transparent", color: "#7A8FAE",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <Bell size={16} />
          </button>
          <span
            style={{
              position: "absolute", top: -4, right: -4,
              width: 16, height: 16, borderRadius: 99,
              background: "#991B1B", color: "#fff",
              fontSize: 9, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid #0B1220",
            }}
          >
            3
          </span>
        </div>

        {/* Avatar / Sign In */}
        <button
          onClick={() => router.push("/login")}
          style={{
            width: 34, height: 34, borderRadius: 8,
            background: "linear-gradient(135deg, #C43A08, #E5521A)",
            color: "#fff", fontSize: 13, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
            border: "1px solid rgba(229,82,26,0.3)",
          }}
          title="Sign In"
        >
          AD
        </button>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden"
          style={{
            width: 34, height: 34, borderRadius: 7,
            border: "1px solid #1C2D4F",
            background: "transparent", color: "#7A8FAE",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {/* Mobile dropdown menu */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ paddingTop: 64 }}
      >
        <div
          style={{
            background: "rgba(1,8,16,0.98)",
            backdropFilter: "blur(16px)",
            borderBottom: "1px solid #1C2D4F",
            padding: "12px 16px",
          }}
        >
          <button
            onClick={() => { router.push("/platform/depot"); setMobileMenuOpen(false); }}
            className="w-full flex items-center gap-3 py-3 text-left"
          >
            <div
              style={{
                width: 36, height: 36, borderRadius: 9,
                background: "rgba(229,82,26,0.12)",
                border: "1px solid rgba(229,82,26,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Building2 size={18} style={{ color: "#E5521A" }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#E8EDF8" }}>IntelliDepot</div>
              <div style={{ fontSize: 13, color: "#7A8FAE" }}>Warehouse Operations</div>
            </div>
          </button>
          <button
            onClick={() => { router.push("/login"); setMobileMenuOpen(false); }}
            className="w-full mt-3 py-3 rounded-xl text-white font-bold text-base transition active:scale-95"
            style={{ background: "#E5521A", fontSize: 16 }}
          >
            Sign In
          </button>
        </div>
      </div>

      {/* ══ Hero Section ══ */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden"
        style={{ height: "100vh", minHeight: 600, maxHeight: 1000 }}
      >
        {/* Background video */}
        <video
          ref={videoRef}
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
        >
          <source src="/logo_intro.mp4" type="video/mp4" />
        </video>

        {/* Gradient overlays */}
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
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 18px", borderRadius: 99,
            border: "1px solid rgba(229,82,26,0.3)",
            background: "rgba(229,82,26,0.10)",
            color: "#E5521A", fontSize: 13, fontWeight: 800,
            textTransform: "uppercase", letterSpacing: "0.12em",
            marginBottom: 28,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "#E5521A", display: "inline-block",
              animation: "blink 1.4s ease-in-out infinite",
            }} />
            Smart Warehouse Platform
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: "clamp(2.6rem, 6vw, 5.5rem)",
            fontWeight: 900, letterSpacing: "-0.03em",
            lineHeight: 1.05, marginBottom: 24,
          }}>
            <span style={{ color: "#fff" }}>Intelligent Depot</span>
            <br />
            <span
              style={{
                backgroundImage: "linear-gradient(135deg, #E5521A 0%, #FF9A6C 40%, #FFD4B8 60%, #E5521A 100%)",
                backgroundSize: "200% 200%",
                animation: "gradient-shift 4s ease infinite",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Operations by Fidelis
            </span>
          </h1>

          <p style={{
            fontSize: "clamp(1rem, 2vw, 1.25rem)",
            color: "rgba(255,255,255,0.65)",
            maxWidth: 640, margin: "0 auto 36px",
            lineHeight: 1.7,
          }}>
            Manage your entire depot with live cameras, smart inventory tracking,
            automated gate entry, and real-time alerts — all from one screen.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={() => router.push("/login")}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, padding: "14px 32px", borderRadius: 14,
                background: "#E5521A", color: "#fff",
                fontWeight: 800, fontSize: 17,
                boxShadow: "0 0 50px rgba(229,82,26,0.4)",
                border: "none", cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              Get Started
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => router.push("/platform/depot")}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, padding: "14px 32px", borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.25)",
                color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.05)",
                fontWeight: 700, fontSize: 17, cursor: "pointer",
                backdropFilter: "blur(8px)", transition: "all 0.2s",
              }}
            >
              <Package size={18} />
              Open IntelliDepot
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 animate-bounce"
          style={{ color: "rgba(255,255,255,0.3)" }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>Scroll</span>
          <ChevronDown size={16} />
        </div>
      </section>

      {/* Animations */}
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {/* ══ Stats Bar ══ */}
      <section style={{ position: "relative", zIndex: 10, padding: "48px 16px" }}>
        <div
          style={{
            maxWidth: 800, margin: "0 auto",
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 14,
          }}
        >
          {STATS.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                  padding: "22px 12px", borderRadius: 18,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  backdropFilter: "blur(8px)",
                  transition: "transform 0.3s, box-shadow 0.3s",
                  animationDelay: `${i * 100}ms`,
                  cursor: "default",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 12px 32px ${stat.color}20`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 11,
                  background: `${stat.color}15`, border: `1px solid ${stat.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={18} style={{ color: stat.color }} />
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, color: stat.color, letterSpacing: "-0.5px" }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center", fontWeight: 700, lineHeight: 1.3 }}>
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ══ Divider ══ */}
      <div style={{ padding: "0 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(229,82,26,0.4), transparent)" }} />
      </div>

      {/* ══ IntelliDepot Feature Section ══ */}
      <section style={{ position: "relative", zIndex: 10, padding: "64px 16px 80px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 16px", borderRadius: 99,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.03)",
              color: "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.12em",
              marginBottom: 18,
            }}>
              Platform
            </div>
            <h2 style={{
              fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
              fontWeight: 900, color: "#fff", marginBottom: 14, letterSpacing: "-0.02em",
            }}>
              IntelliDepot — One Platform, Full Control
            </h2>
            <p style={{
              color: "rgba(255,255,255,0.45)", fontSize: 17, maxWidth: 560, margin: "0 auto",
              lineHeight: 1.7,
            }}>
              Purpose-built for warehouse operations — seamlessly integrated across the Fidelis enterprise.
            </p>
          </div>

          {/* Single large product card */}
          {PRODUCTS.map((product) => {
            const Icon = product.icon;
            return (
              <button
                key={product.id}
                onClick={() => router.push(product.href)}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "36px 40px", borderRadius: 28,
                  background: "linear-gradient(135deg, rgba(229,82,26,0.08) 0%, rgba(255,255,255,0.02) 100%)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer", position: "relative", overflow: "hidden",
                  transition: "all 0.3s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = product.border;
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 24px 72px ${product.color}25`;
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-4px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                }}
              >
                {/* Background glow */}
                <div style={{
                  position: "absolute", top: -80, right: -80,
                  width: 300, height: 300, borderRadius: "50%",
                  background: `${product.color}12`, filter: "blur(60px)",
                  pointerEvents: "none",
                }} />

                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 20 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 16,
                      background: `${product.color}18`,
                      border: `1px solid ${product.color}35`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <Icon size={26} style={{ color: product.color }} />
                    </div>
                    <div>
                      <div style={{
                        fontSize: 13, fontWeight: 800, textTransform: "uppercase",
                        letterSpacing: "0.12em", color: product.color, marginBottom: 6,
                      }}>
                        {product.tagline}
                      </div>
                      <h3 style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
                        {product.name}
                      </h3>
                    </div>
                  </div>
                  <p style={{
                    fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.8, marginBottom: 28,
                    maxWidth: 580,
                  }}>
                    {product.description}
                  </p>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 16, fontWeight: 800, color: product.color,
                  }}>
                    Launch Application
                    <ArrowRight size={18} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ══ Footer ══ */}
      <footer
        style={{
          position: "relative", zIndex: 10,
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "28px 16px",
        }}
      >
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "flex", flexWrap: "wrap",
          alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
              <Image
                src="/fidelis-logo.png"
                alt="Fidelis"
                width={20}
                height={20}
                className="object-contain opacity-50"
              />
            </div>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.28)" }}>
              Fidelis Platform · IntelliDepot™ · {new Date().getFullYear()}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(255,255,255,0.28)" }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "#22C55E", display: "inline-block",
              animation: "blink 1.4s ease-in-out infinite",
            }} />
            All systems operational
          </div>
        </div>
      </footer>
    </div>
  );
}
