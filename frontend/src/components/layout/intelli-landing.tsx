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
  ChevronDown,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useTheme } from "@/components/layout/ThemeProvider";

/* Only IntelliDepot */
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

/* Business-friendly stats */
const STATS = [
  { label: "Depots Managed",      value: "15+",  icon: Building2, color: "#E5521A" },
  { label: "Trucks Tracked Daily", value: "200+", icon: Truck,     color: "#22C55E" },
  { label: "Incidents Resolved",   value: "99%",  icon: Shield,    color: "#3B82F6" },
  { label: "Accuracy Rate",        value: "99.8%",icon: BarChart3, color: "#A855F7" },
];

export function IntelliLanding() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [scrolled, setScrolled]             = useState(false);
  const [visible, setVisible]               = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Theme-aware color tokens
  const bg         = isDark ? "#010810"              : "#F6F8FB";
  const surface    = isDark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.82)";
  const border     = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.10)";
  const textPrimary   = isDark ? "#FFFFFF"           : "#0F172A";
  const textSecondary = isDark ? "rgba(255,255,255,0.55)" : "#334155";
  const textMuted     = isDark ? "rgba(255,255,255,0.28)" : "#64748B";
  const headerBg   = isDark ? "rgba(11,18,32,0.98)"  : "rgba(255,255,255,0.94)";
  const headerBgSm = isDark ? "rgba(11,18,32,0.90)"  : "rgba(255,255,255,0.86)";
  const dividerColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.10)";

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
    <div className="min-h-screen overflow-x-hidden" style={{ background: bg, color: textPrimary, transition: "background 0.25s ease, color 0.25s ease" }}>

      {/* Top bar */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center gap-2.5 px-4 py-0 transition-all duration-500"
        style={{
          height: 60,
          background: scrolled ? headerBg : headerBgSm,
          backdropFilter: "blur(16px)",
          borderBottom: `1px solid ${border}`,
          boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,0.12)" : "none",
        }}
      >
        {/* Logo */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2.5 flex-shrink-0 group"
          aria-label="Home"
          style={{ textDecoration: "none" }}
        >
          <div className="flex items-center justify-center rounded-xl overflow-hidden flex-shrink-0" style={{ width: 28, height: 28 }}>
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
            <div style={{ fontSize: 11, color: textMuted, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              IntelliDepot TM
            </div>
          </div>
        </button>

        <div style={{ flex: 1 }} />

        <ThemeToggle />

        <button
          onClick={() => router.push("/login")}
          style={{
            padding: "9px 18px",
            borderRadius: 9,
            border: `1px solid ${border}`,
            background: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.82)",
            color: textPrimary,
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Log In
        </button>
        <button
          onClick={() => router.push("/register")}
          style={{
            padding: "9px 18px",
            borderRadius: 9,
            background: "linear-gradient(135deg, #C43A08, #E5521A)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            flexShrink: 0,
            border: "1px solid rgba(229,82,26,0.3)",
            boxShadow: isDark ? "none" : "0 12px 28px rgba(229,82,26,0.20)",
          }}
        >
          Sign Up
        </button>
      </header>

      {/* Hero section */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden"
        style={{ height: "100vh", minHeight: 600, maxHeight: 1000 }}
      >
        {/* Background video */}
        <video
          ref={videoRef}
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            zIndex: 0,
            filter: isDark ? "none" : "contrast(1.08) saturate(0.9) brightness(1.18)",
            opacity: isDark ? 1 : 0.28,
          }}
        >
          <source src="/logo_intro.mp4" type="video/mp4" />
        </video>
        {isDark ? (
          <>
            <div className="absolute inset-0 z-10" style={{
              background: "linear-gradient(to bottom, rgba(1,8,16,0.55) 0%, rgba(1,8,16,0.3) 40%, rgba(1,8,16,0.7) 85%, rgba(1,8,16,1) 100%)"
            }} />
            <div className="absolute inset-0 z-10" style={{
              background: "radial-gradient(ellipse at center, rgba(1,8,16,0.1) 0%, rgba(1,8,16,0.6) 100%)"
            }} />
          </>
        ) : (
          <div className="absolute inset-0 z-10" style={{
            background: "linear-gradient(180deg, rgba(246,248,251,0.70) 0%, rgba(246,248,251,0.80) 42%, rgba(246,248,251,0.96) 88%, #F6F8FB 100%)"
          }} />
        )}

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
            background: isDark ? "rgba(229,82,26,0.10)" : "rgba(255,255,255,0.84)",
            color: "#E5521A", fontSize: 13, fontWeight: 800,
            textTransform: "uppercase", letterSpacing: "0.12em",
            marginBottom: 28,
            boxShadow: isDark ? "none" : "0 14px 34px rgba(15,23,42,0.08)",
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
            <span style={{ color: isDark ? "#FFFFFF" : "#111827" }}>Intelligent Depot</span>
            <br />
            <span style={{
              backgroundImage: "linear-gradient(135deg, #C43A08 0%, #E5521A 50%, #C43A08 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              Operations by Fidelis
            </span>
          </h1>

          <p style={{
            fontSize: "clamp(1rem, 2vw, 1.25rem)",
            color: isDark ? "rgba(255,255,255,0.65)" : "#263244",
            maxWidth: 640, margin: "0 auto 36px",
            lineHeight: 1.7,
            fontWeight: isDark ? 400 : 500,
          }}>
            Manage your entire depot with live cameras, smart inventory tracking,
            automated gate entry, and real-time alerts, all from one screen.
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
                boxShadow: isDark ? "0 0 50px rgba(229,82,26,0.35)" : "0 18px 44px rgba(229,82,26,0.24)",
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
                border: `1.5px solid ${isDark ? "rgba(255,255,255,0.25)" : "rgba(15,23,42,0.16)"}`,
                color: textPrimary,
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.92)",
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
          style={{ color: isDark ? "rgba(255,255,255,0.3)" : "#475569" }}>
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

      {/* Stats bar */}
      <section style={{ position: "relative", zIndex: 10, padding: "48px 16px" }}>
        <div style={{
          maxWidth: 800, margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 14,
        }}>
          {STATS.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                  padding: "22px 12px", borderRadius: 18,
                  background: surface,
                  border: `1px solid ${border}`,
                  backdropFilter: "blur(8px)",
                  boxShadow: isDark ? "none" : "0 18px 44px rgba(15,23,42,0.06)",
                  transition: "transform 0.3s, box-shadow 0.3s",
                  animationDelay: `${i * 100}ms`,
                  cursor: "default",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 12px 32px ${stat.color}25`;
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
                <div style={{ fontSize: 13, color: textSecondary, textAlign: "center", fontWeight: 700, lineHeight: 1.3 }}>
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Divider */}
      <div style={{ padding: "0 32px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(229,82,26,0.4), transparent)" }} />
      </div>

      {/* IntelliDepot feature section */}
      <section style={{ position: "relative", zIndex: 10, padding: "64px 16px 80px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 16px", borderRadius: 99,
              border: `1px solid ${border}`,
              background: surface,
              color: textSecondary, fontSize: 13, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.12em",
              marginBottom: 18,
            }}>
              Platform
            </div>
            <h2 style={{
              fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
              fontWeight: 900, color: textPrimary, marginBottom: 14, letterSpacing: "-0.02em",
            }}>
              IntelliDepot - One Platform, Full Control
            </h2>
            <p style={{
              color: textSecondary, fontSize: 17, maxWidth: 560, margin: "0 auto",
              lineHeight: 1.7,
            }}>
              Purpose-built for warehouse operations and integrated across the Fidelis enterprise.
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
                  background: isDark
                    ? "linear-gradient(135deg, rgba(229,82,26,0.08) 0%, rgba(255,255,255,0.02) 100%)"
                    : "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(255,247,243,0.94) 100%)",
                  border: `1px solid ${border}`,
                  boxShadow: isDark ? "none" : "0 24px 64px rgba(15,23,42,0.08)",
                  cursor: "pointer", position: "relative", overflow: "hidden",
                  transition: "all 0.3s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = product.border;
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 24px 72px ${product.color}25`;
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-4px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = border;
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = isDark
                    ? "none"
                    : "0 24px 64px rgba(15,23,42,0.08)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                }}
              >
                {/* Background glow */}
                <div style={{
                  position: "absolute", top: -80, right: -80,
                  width: 300, height: 300, borderRadius: "50%",
                  background: `${product.color}10`, filter: "blur(60px)",
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
                      <h3 style={{ fontSize: 26, fontWeight: 900, color: textPrimary, letterSpacing: "-0.02em" }}>
                        {product.name}
                      </h3>
                    </div>
                  </div>
                  <p style={{
                    fontSize: 16, color: textSecondary, lineHeight: 1.8, marginBottom: 28,
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

      {/* Footer */}
      <footer style={{
        position: "relative", zIndex: 10,
        borderTop: `1px solid ${dividerColor}`,
        padding: "28px 16px",
      }}>
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
            <span style={{ fontSize: 13, color: textMuted }}>
              Fidelis Platform - IntelliDepot TM - {new Date().getFullYear()}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: textMuted }}>
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
