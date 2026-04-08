"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, HeartPulse, Loader2, Lock, Mail } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

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
      router.push("/stream/macropulse");
    } catch {
      // error is set in store
    }
  };

  const fillDemo = () => {
    setEmail("demo@fidelis-demo.com");
    setPassword("MacroPulse2025!");
    clearError();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(157,227,229,0.72),_transparent_36%),linear-gradient(135deg,_#b7e4e6_0%,_#dff1ef_52%,_#edf6f3_100%)]">
      <div className="w-full max-w-md px-4">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#1a2332] shadow-[0_16px_32px_rgba(26,35,50,0.35)] mb-4">
            <HeartPulse className="h-8 w-8 text-cyan-300" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-sky-700">Intelli Stream</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#0f2356]">Macro Pulse</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your workspace</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-white/70 bg-white/80 backdrop-blur-sm shadow-[0_8px_32px_rgba(15,35,86,0.10)] p-8">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-gray-200 pl-10 pr-4 py-3 text-sm text-gray-800 bg-gray-50/70 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 pl-10 pr-10 py-3 text-sm text-gray-800 bg-gray-50/70 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1a2332] py-3 text-sm font-bold text-white hover:bg-[#243044] disabled:opacity-60 transition"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Demo Credentials</p>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs text-slate-600 font-mono">demo@fidelis-demo.com</p>
                <p className="text-xs text-slate-600 font-mono">MacroPulse2025!</p>
              </div>
              <button
                onClick={fillDemo}
                className="text-xs font-semibold text-blue-600 bg-white border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition"
              >
                Use Demo
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-700 transition">
              Create account
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Fidelis Platform · MacroPulse Intelligence Suite
        </p>
      </div>
    </div>
  );
}
