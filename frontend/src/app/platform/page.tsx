"use client";

import AppCard from "@/components/platform/AppCard";
import {
  BarChart3,
  Zap,
  Building2,
  Users,
} from "lucide-react";

export default function PlatformPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-[#0f2356] mb-3">
          Welcome to INTELLI
        </h2>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl">
          Your integrated platform for warehouse operations, financial intelligence, and business management.
        </p>
      </div>

      {/* App Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        <AppCard
          title="Stream"
          description="Real-time financial intelligence, scenario planning, and macro pulse monitoring for strategic decision-making."
          icon={Zap}
          href="/platform/stream"
          color="blue"
          badge="Live"
        />

        <AppCard
          title="Depot"
          description="Comprehensive warehouse operations management including cameras, analytics, command, and inventory tracking."
          icon={Building2}
          href="/platform/depot"
          color="orange"
        />

        <AppCard
          title="Cafe"
          description="Employee engagement and collaboration space for team communication and knowledge sharing."
          icon={Users}
          href="/platform/cafe"
          color="green"
        />

        <AppCard
          title="Recruit"
          description="Talent acquisition and HR management tools for recruitment, onboarding, and team building."
          icon={Users}
          href="/platform/recruit"
          color="purple"
        />
      </div>

      {/* Footer Info */}
      <div className="mt-16 pt-8 border-t border-slate-200">
        <p className="text-sm text-slate-500 text-center">
          Fidelis Platform · INTELLI Intelligence Suite · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
