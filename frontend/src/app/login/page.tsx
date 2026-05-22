"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, Loader2, Lock, Mail, Shield } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { DEMO_CREDENTIALS } from "@/lib/demoCredentials";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useTheme } from "@/components/layout/ThemeProvider";

function roleLabel(role: string) {
  if (role === "warehouse_manager") return "Warehouse Manager";
  if (role === "regional_manager") return "Regional Manager";
  if (role === "admin") return "Admin";
  return role;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      router.push("/depot/operations");
    } catch {
      // error is set in store
    }
  };

  const fillDemo = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    clearError();
  };

  // Theme-aware values
  const pageBg = isDark ? "#010810" : "#F0F4FA";
  const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB";
  const cardShadow = isDark ? "0 25px 80px rgba(0,0,0,0.5)" : "0 25px 80px rgba(0,0,0,0.1)";
  const headingColor = isDark ? "#FFFFFF" : "#0D1117";
  const subColor = isDark ? "rgba(255,255,255,0.4)" : "#6B7280";
  const labelColor = isDark ? "rgba(255,255,255,0.45)" : "#6B7280";
  const inputBg = isDark ? "rgba(255,255,255,0.05)" : "#F9FAFB";
  const inputBorder = isDark ? "rgba(255,255,255,0.1)" : "#D1D5DB";
  const inputText = isDark ? "#FFFFFF" : "#0D1117";
  const inputPlaceholder = isDark ? "rgba(255,255,255,0.2)" : "#9CA3AF";
  const iconColor = isDark ? "rgba(255,255,255,0.3)" : "#9CA3AF";
  const demoBoxBg = isDark ? "rgba(255,255,255,0.03)" : "#F3F4F6";
  const demoBoxBorder = isDark ? "rgba(255,255,255,0.08)" : "#E5E7EB";
  const demoItemBg = isDark ? "rgba(255,255,255,0.03)" : "#FFFFFF";
  const demoRoleColor = isDark ? "rgba(255,255,255,0.7)" : "#374151";
  const demoEmailColor = isDark ? "rgba(255,255,255,0.3)" : "#9CA3AF";
  const footerColor = isDark ? "rgba(255,255,255,0.18)" : "#9CA3AF";
  const linkColor = isDark ? "rgba(255,255,255,0.3)" : "#6B7280";

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center py-6 px-4 sm:px-6 theme-transition"
      style={{ backgroundColor: pageBg }}
    >
      {/* Background effects — subtle in light, glow in dark */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {isDark ? (
          <>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] sm:w-[700px] h-[200px] sm:h-[350px] rounded-full bg-blue-600/10 blur-[80px] sm:blur-[120px]" />
            <div className="absolute bottom-0 right-0 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] rounded-full bg-orange-600/8 blur-[60px] sm:blur-[120px]" />
            <div
              className="absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage: `linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)`,
                backgroundSize: "50px 50px",
              }}
            />
          </>
        ) : (
          <>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] sm:w-[800px] h-[200px] sm:h-[300px] rounded-full opacity-30 blur-[100px]" style={{ background: "radial-gradient(circle, #DBEAFE, transparent)" }} />
            <div className="absolute bottom-0 right-0 w-[300px] sm:w-[500px] h-[200px] sm:h-[400px] rounded-full opacity-20 blur-[100px]" style={{ background: "radial-gradient(circle, #FEE2E2, transparent)" }} />
          </>
        )}
      </div>

      {/* Theme toggle — top right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm sm:max-w-md">
        {/* ── Header / Branding ── */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-4 sm:mb-5 overflow-hidden transition-all"
            style={{
              background: "#FFFFFF",
              boxShadow: isDark
                ? "0 0 40px rgba(229,82,26,0.25), 0 8px 32px rgba(0,0,0,0.3)"
                : "0 0 30px rgba(229,82,26,0.15), 0 8px 24px rgba(0,0,0,0.08)",
            }}
          >
            <Image
              src="/fidelis-logo.png"
              alt="Fidelis"
              width={56}
              height={56}
              className="w-10 h-10 sm:w-14 sm:h-14 object-contain"
              priority
            />
          </div>
          <div className="text-center">
            <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.35em] mb-1" style={{ color: 'var(--accent)' }}>
              Fidelis
            </p>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight transition-colors" style={{ color: headingColor }}>
              IntelliDepot
            </h1>
            <p className="mt-1 text-[12px] sm:text-[13px] transition-colors" style={{ color: subColor }}>
              A Unified Intelligence AI Platform
            </p>
          </div>
        </div>

        {/* ── Login Card ── */}
        <div
          className="rounded-2xl sm:rounded-3xl p-5 sm:p-8 transition-all"
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: cardShadow,
            backdropFilter: isDark ? "blur(20px)" : "none",
          }}
        >
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 sm:space-y-5">
            {/* Email */}
            <div>
              <label
                className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest mb-1.5 sm:mb-2 transition-colors"
                style={{ color: labelColor }}
              >
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors"
                  style={{ color: iconColor }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full rounded-xl pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                  style={{
                    background: inputBg,
                    border: `1px solid ${inputBorder}`,
                    color: inputText,
                    boxShadow: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent-border)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-subtle)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = inputBorder;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <style>{`input::placeholder { color: ${inputPlaceholder}; }`}</style>
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                className="block text-[10px] sm:text-[11px] font-black uppercase tracking-widest mb-1.5 sm:mb-2 transition-colors"
                style={{ color: labelColor }}
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors"
                  style={{ color: iconColor }}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl pl-9 sm:pl-10 pr-10 py-2.5 sm:py-3 text-sm focus:outline-none focus:ring-2 transition-all"
                  style={{
                    background: inputBg,
                    border: `1px solid ${inputBorder}`,
                    color: inputText,
                    boxShadow: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent-border)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-subtle)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = inputBorder;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 sm:right-3.5 top-1/2 -translate-y-1/2 transition p-0.5 hover:opacity-80"
                  style={{ color: iconColor }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-red-500 font-semibold">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 sm:py-3.5 text-sm font-black text-white disabled:opacity-60 transition-all active:scale-[0.98] hover:shadow-xl"
              style={{
                background: `linear-gradient(135deg, var(--accent-button-bg), var(--accent-hover))`,
                boxShadow: "0 0 30px var(--accent-subtle)",
              }}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isLoading ? "Signing in..." : "Sign In to IntelliDepot"}
            </button>
          </form>

          {/* ── Demo Credentials ── */}
          <div
            className="mt-4 sm:mt-5 rounded-xl p-3 sm:p-4"
            style={{
              background: demoBoxBg,
              border: `1px solid ${demoBoxBorder}`,
            }}
          >
            <div className="flex items-center gap-2 mb-2.5 sm:mb-3">
              <Shield className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
              <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider" style={{ color: labelColor }}>
                Demo Credentials
              </p>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              {DEMO_CREDENTIALS.map((credential) => (
                <div
                  key={credential.id}
                  className="flex items-center justify-between gap-2 sm:gap-3 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2"
                  style={{
                    background: demoItemBg,
                    border: `1px solid ${demoBoxBorder}`,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-[11px] font-bold truncate" style={{ color: demoRoleColor }}>
                      {roleLabel(credential.role)}
                      {credential.location ? ` — ${credential.location}` : ""}
                    </p>
                    <p className="text-[9px] sm:text-[10px] font-mono truncate" style={{ color: demoEmailColor }}>
                      {credential.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fillDemo(credential.email, credential.password)}
                    className="flex-shrink-0 text-[10px] sm:text-[11px] font-black px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition active:scale-95"
                    style={{
                      color: 'var(--accent)',
                      backgroundColor: 'var(--accent-subtle-bg)',
                      border: '1px solid var(--accent-border)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--accent-subtle)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--accent-subtle-bg)';
                    }}
                  >
                    Use
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] font-mono text-center" style={{ color: demoEmailColor }}>
              Password: MacroPulse2025!
            </p>
          </div>

          {/* Register link */}
          <div className="mt-4 sm:mt-5 text-center text-sm" style={{ color: linkColor }}>
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-black transition"
              style={{ color: 'var(--accent)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--accent-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--accent)';
              }}
            >
              Create account
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-5 sm:mt-6 text-center text-[10px] sm:text-[11px] transition-colors" style={{ color: footerColor }}>
          Fidelis IntelliDepot · Unified Intelligence AI Platform · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
