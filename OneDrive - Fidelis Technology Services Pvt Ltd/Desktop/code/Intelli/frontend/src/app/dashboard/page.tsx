"use client";

import { AppWindow, ArrowLeft, ArrowUpRight, Coffee, Factory, LineChart, Users } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

type VariantKey = "platform" | "stream" | "depot" | "cafe" | "recruit";
type Variant = {
  id: VariantKey;
  name: string;
  label: string;
  summary: string;
  accent: string;
  visual: string;
  icon: React.ComponentType<{ className?: string }>;
  highlights: string[];
};

const variants: Variant[] = [
  { id: "platform", name: "INTELLI PLATFORM", label: "Core Experience", summary: "The unified control layer for navigation, discovery, orchestration, and platform-wide visibility.", accent: "from-cyan-200/18 to-sky-100/10", visual: "from-[#dff5fb] via-[#f4fbff] to-transparent", icon: AppWindow, highlights: ["Unified workspace shell", "Cross-variant navigation", "Shared design and controls"] },
  { id: "stream",   name: "INTELLI STREAM",   label: "Financial Intelligence", summary: "Executive finance and treasury visibility with premium analytics surfaces.", accent: "from-sky-300/25 to-cyan-200/10", visual: "from-[#c7ecfb] via-[#eaf7ff] to-transparent", icon: LineChart, highlights: ["Live financial signals", "Executive-ready insight tiles", "Strategic planning views"] },
  { id: "depot",    name: "INTELLI DEPOT",    label: "Warehouse Operations", summary: "Operational command views for logistics, inventory movement, and fulfillment orchestration.", accent: "from-sky-300/22 to-cyan-100/10", visual: "from-[#d9f0ff] via-[#f1faff] to-transparent", icon: Factory, highlights: ["Monitoring and coordination", "Inventory-aware workflows", "Exception visibility"] },
  { id: "cafe",     name: "INTELLI CAFE",     label: "Employee Engagement Platform", summary: "A connected employee experience platform for updates, recognition, culture, and internal engagement.", accent: "from-sky-200/20 to-cyan-100/10", visual: "from-[#dff5fb] via-[#f6fbff] to-transparent", icon: Coffee, highlights: ["Employee social feed", "Recognition and announcements", "Culture and engagement surfaces"] },
  { id: "recruit",  name: "INTELLI RECRUIT",  label: "Talent Platform", summary: "A refined recruiting workspace for pipeline movement, hiring operations, and team collaboration.", accent: "from-sky-200/22 to-indigo-100/10", visual: "from-[#d7ecff] via-[#f1f8ff] to-transparent", icon: Users, highlights: ["Hiring pipeline command", "Team collaboration surfaces", "Decision support views"] },
];

export default function DashboardPage() {
  const router = useRouter();
  const [activeVariant, setActiveVariant] = useState<VariantKey | null>(null);
  const selectedVariant = variants.find((v) => v.id === activeVariant) ?? null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#87D3D4_0%,#b8e7e7_40%,#edf9f8_100%)] text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(211,244,244,0.28),transparent_24%)]" />
        <div className="motion-float-slow absolute left-[-6rem] top-10 h-72 w-72 rounded-full bg-white/25 blur-3xl" />
        <div className="motion-float-medium absolute right-[-5rem] top-24 h-96 w-96 rounded-full bg-cyan-50/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-5 py-4 sm:px-8 lg:px-10">
        <nav className="flex items-center justify-between rounded-full border border-white/75 bg-white/55 px-5 py-2.5 shadow-[0_18px_48px_rgba(74,118,165,0.10)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 ring-1 ring-white/70">
              <Image src="/fidelis-logo.png" alt="Fidelis" width={24} height={24} className="h-6 w-6 object-contain" priority />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#0b5675] sm:text-sm">INTELLI</p>
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">A Fidelis Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedVariant ? (
              <button onClick={() => setActiveVariant(null)} className="inline-flex items-center gap-2 rounded-full border border-[#0b6a8e]/15 bg-white/80 px-4 py-2 text-sm font-medium text-[#0b5675] transition hover:bg-[#e9f6fb]">
                <ArrowLeft className="h-4 w-4" />Back to Dashboard
              </button>
            ) : (
              <button onClick={() => router.push("/")} className="inline-flex items-center gap-2 rounded-full border border-[#0b6a8e]/15 bg-white/80 px-4 py-2 text-sm font-medium text-[#0b5675] transition hover:bg-[#e9f6fb]">
                <ArrowLeft className="h-4 w-4" />Back to Home
              </button>
            )}
          </div>
        </nav>

        <main className="flex flex-1 items-start py-6">
          <section className="w-full">
            {selectedVariant ? (
              <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[32px] border border-white/80 bg-white/58 p-7 shadow-[0_20px_55px_rgba(67,107,153,0.12)] backdrop-blur-xl sm:p-10">
                  <div className={`inline-flex rounded-full border border-white/70 bg-gradient-to-r ${selectedVariant.accent} px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#0b5675]`}>{selectedVariant.label}</div>
                  <h1 className="mt-6 text-4xl font-semibold tracking-[-0.05em] text-slate-900 sm:text-5xl">{selectedVariant.name}</h1>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">{selectedVariant.summary}</p>
                  <div className="mt-10 grid gap-4 sm:grid-cols-3">
                    {selectedVariant.highlights.map((h) => (
                      <div key={h} className="rounded-[24px] border border-white/80 bg-[rgba(255,255,255,0.55)] px-5 py-5 shadow-[0_14px_32px_rgba(80,123,168,0.08)] backdrop-blur-sm">
                        <p className="text-sm font-medium leading-7 text-slate-700">{h}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[32px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.60),rgba(232,245,252,0.72))] p-7 shadow-[0_20px_55px_rgba(67,107,153,0.12)] backdrop-blur-xl sm:p-8">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0b6a8e]/10 text-[#0b5675]">
                    <selectedVariant.icon className="h-7 w-7" />
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-slate-900">Placeholder interface</h2>
                  <p className="mt-4 text-sm leading-7 text-slate-600">This section is ready for the dedicated {selectedVariant.name} experience.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-[#0d1b3d] sm:text-[2.5rem]">Choose your INTELLI experience.</h1>
                  <p className="mt-1 text-sm text-slate-500">Explore each platform variant.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {variants.map((variant, index) => {
                    const Icon = variant.icon;
                    return (
                      <button
                        key={variant.id}
                        onClick={() => {
                          if (variant.id === "stream") { router.push("/stream/overview"); }
                          else { setActiveVariant(variant.id); }
                        }}
                        className="group relative min-h-[320px] overflow-hidden rounded-[30px] border border-white/85 bg-[linear-gradient(180deg,#bfe3f7,#d7eefb_34%,#edf7fe_68%,#ebf7ff)] px-5 py-5 text-left shadow-[0_18px_50px_rgba(79,119,160,0.10)] backdrop-blur-xl transition-[transform,box-shadow] duration-500 hover:z-20 hover:-translate-y-5 hover:scale-[1.065] hover:shadow-[0_44px_110px_rgba(48,101,146,0.28)]"
                        style={{ animationDelay: `${index * 80}ms` }}
                      >
                        <div className={`absolute inset-0 rounded-[30px] bg-gradient-to-br ${variant.accent} opacity-0 transition duration-500 group-hover:opacity-100`} />
                        <div className={`absolute inset-x-5 bottom-5 top-[48%] rounded-[24px] bg-gradient-to-b ${variant.visual} opacity-95`} />
                        <div className="relative flex h-full flex-col">
                          <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#0b6a8e]/10 text-[#0b5675] transition duration-500 group-hover:bg-white/80">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="mt-4">
                            <h2 className="mt-2 text-[1.1rem] font-semibold leading-tight tracking-[-0.03em] text-[#0d1b3d]">{variant.name}</h2>
                            <p className="mt-2 text-base font-medium text-[#0d1b3d]">{variant.label}</p>
                            <p className="mt-2 max-w-xs text-sm leading-6 text-slate-600">{variant.summary}</p>
                          </div>
                          <div className="mt-auto inline-flex items-center gap-2 pt-3 text-sm font-medium text-[#0b5675]">
                            <span className="rounded-full bg-white/78 px-3 py-1.5 transition duration-500 group-hover:bg-white">Explore</span>
                            <ArrowUpRight className="h-4 w-4" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
