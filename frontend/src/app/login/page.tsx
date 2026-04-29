"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, Loader2, Lock, Mail, Shield } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { DEMO_CREDENTIALS } from "@/lib/demoCredentials";

function roleLabel(role: string) {
  if (role === "warehouse_manager") return "Warehouse Manager";
  if (role === "regional_manager") return "Regional Manager";
  if (role === "admin") return "Admin";
  return role;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      // Always route to IntelliDepot after login
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

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#020B18] py-6 px-4 sm:px-6">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] sm:w-[600px] h-[200px] sm:h-[300px] rounded-full bg-blue-600/10 blur-[60px] sm:blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] rounded-full bg-orange-600/8 blur-[60px] sm:blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      <div className="relative w-full max-w-sm sm:max-w-md">
        {/* ── Header / Branding ── */}
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          {/* Fidelis Logo */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-white flex items-center justify-center shadow-[0_0_40px_rgba(229,82,26,0.25)] mb-4 sm:mb-5 overflow-hidden">
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
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.35em] text-[#E5521A] mb-1">
              Fidelis
            </p>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              IntelliDepot
            </h1>
            <p className="mt-1 text-[12px] sm:text-[13px] text-white/40">
              A Unified Intelligence AI Platform
            </p>
          </div>
        </div>

        {/* ── Login Card ── */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl p-5 sm:p-8">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 sm:space-y-5">
            {/* Email */}
            <div>
              <label className="block text-[10px] sm:text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1.5 sm:mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#E5521A]/50 focus:border-[#E5521A]/40 transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] sm:text-[11px] font-bold text-white/50 uppercase tracking-widest mb-1.5 sm:mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 sm:pl-10 pr-10 py-2.5 sm:py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#E5521A]/50 focus:border-[#E5521A]/40 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 sm:right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition p-0.5"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#E5521A] hover:bg-[#FF7A42] py-2.5 sm:py-3 text-sm font-bold text-white disabled:opacity-60 transition shadow-[0_0_20px_rgba(229,82,26,0.3)] active:scale-[0.98]"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isLoading ? "Signing in..." : "Sign In to IntelliDepot"}
            </button>
          </form>

          {/* ── Demo Credentials ── */}
          <div className="mt-4 sm:mt-5 rounded-xl border border-white/8 bg-white/[0.03] p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2.5 sm:mb-3">
              <Shield className="w-3.5 h-3.5 text-[#E5521A] flex-shrink-0" />
              <p className="text-[10px] sm:text-[11px] font-bold text-white/50 uppercase tracking-wider">
                Demo Credentials
              </p>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              {DEMO_CREDENTIALS.map((credential) => (
                <div
                  key={credential.id}
                  className="flex items-center justify-between gap-2 sm:gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 sm:px-3 py-1.5 sm:py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-[11px] font-semibold text-white/70 truncate">
                      {roleLabel(credential.role)}
                      {credential.location ? ` — ${credential.location}` : ""}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-white/30 font-mono truncate">
                      {credential.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fillDemo(credential.email, credential.password)}
                    className="flex-shrink-0 text-[10px] sm:text-[11px] font-bold text-[#E5521A] bg-[#E5521A]/10 border border-[#E5521A]/20 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg hover:bg-[#E5521A]/20 transition active:scale-95"
                  >
                    Use
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2.5 sm:mt-3 text-[9px] sm:text-[10px] text-white/25 font-mono text-center">
              Password: MacroPulse2025!
            </p>
          </div>

          {/* Register link */}
          <div className="mt-4 sm:mt-5 text-center text-sm text-white/30">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-[#E5521A] hover:text-[#FF7A42] transition"
            >
              Create account
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-5 sm:mt-6 text-center text-[10px] sm:text-[11px] text-white/20">
          Fidelis IntelliDepot · Unified Intelligence AI Platform · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
