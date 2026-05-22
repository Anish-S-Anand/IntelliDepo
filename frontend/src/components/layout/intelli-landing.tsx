"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  Package,
  Menu,
  Bell,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export function IntelliLanding() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(false);
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

      {/* ══ TOPBAR ══ */}
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
              style={{ filter: "drop-shadow(0 0 6px var(--accent-border))" }}
              priority
            />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)", letterSpacing: "-0.4px", lineHeight: 1.1 }}>
              Fidelis
            </div>
            <div style={{ fontSize: 11, color: "#7A8FAE", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              IntelliDepot™
            </div>
          </div>
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
          <Menu size={18} />
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
            className="w-full py-3 rounded-xl text-white font-bold text-base transition active:scale-95"
            style={{ background: "var(--accent)", fontSize: 16 }}
          >
            Open IntelliDepot
          </button>
          <button
            onClick={() => { router.push("/login"); setMobileMenuOpen(false); }}
            className="w-full mt-3 py-3 rounded-xl text-white font-bold text-base transition active:scale-95"
            style={{ background: "rgba(255,255,255,0.1)", fontSize: 16 }}
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
            border: "1px solid var(--accent-border)",
            background: "var(--accent-subtle)",
            color: "var(--accent)", fontSize: 13, fontWeight: 800,
            textTransform: "uppercase", letterSpacing: "0.12em",
            marginBottom: 28,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "var(--accent)", display: "inline-block",
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
                backgroundImage: "linear-gradient(135deg, var(--accent) 0%, #FF9A6C 40%, #FFD4B8 60%, var(--accent) 100%)",
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
                background: "var(--accent)", color: "#fff",
                fontWeight: 800, fontSize: 17,
                boxShadow: "0 0 50px var(--accent-border)",
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
    </div>
  );
}
