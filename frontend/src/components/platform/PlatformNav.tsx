"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, LogOut, Menu, X, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function PlatformNav() {
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const normalizedRole = (user?.role ?? "").toLowerCase().replace(/\s+/g, "_");
  const location = user?.location?.trim();

  const userScopeLabel = (() => {
    if (normalizedRole.includes("warehouse") && location) {
      return `Warehouse: ${location}`;
    }

    if (normalizedRole.includes("regional") && location) {
      return `Region: ${location}`;
    }

    if (location) {
      return location;
    }

    return null;
  })();

  const handleLogout = () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    logout();
    router.push("/login");
  };

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-[#0f2356] flex items-center justify-center">
              <Image
                src="/fidelis-logo.png"
                alt="Fidelis"
                width={32}
                height={32}
                className="w-6 h-6 sm:w-8 sm:h-8"
              />
            </div>
            <div className="hidden sm:flex flex-col">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Fidelis</p>
              <h1 className="text-lg font-bold text-[#0f2356]">INTELLI Platform</h1>
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            <div className="flex items-start gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800">
              <User className="w-4 h-4 text-slate-600" />
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-slate-700">
                  {user?.email || "User"}
                </span>
                {userScopeLabel ? (
                  <span className="text-xs text-slate-500 mt-1">{userScopeLabel}</span>
                ) : null}
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-busy={isLoggingOut}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition font-medium text-sm"
            >
              {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              {isLoggingOut ? "Signing out..." : "Logout"}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 hover:bg-slate-100 rounded-lg transition"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-slate-700" />
            ) : (
              <Menu className="w-6 h-6 text-slate-700" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-slate-100">
              <User className="w-4 h-4 text-slate-600" />
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-slate-700">
                  {user?.email || "User"}
                </span>
                {userScopeLabel ? (
                  <span className="text-xs text-slate-500 mt-1">{userScopeLabel}</span>
                ) : null}
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-busy={isLoggingOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition font-medium text-sm"
            >
              {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              {isLoggingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
