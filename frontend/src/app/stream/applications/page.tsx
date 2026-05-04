"use client";

import {
  Activity,
  BrainCircuit,
  ChartNoAxesCombined,
  FileChartColumn,
  Globe,
  HeartPulse,
  Radar,
  ScanSearch,
  ShieldAlert,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";

const columns = [
  {
    id: "market",
    title: "Market Intelligence",
    tag: "Real-time Intelligence",
    description: "Macro volatility, competitor movement, and forward-looking market signals for capital planning.",
    icon: Activity,
    accent: "from-cyan-400 to-blue-500",
    headerTint: "bg-cyan-50 text-sky-800 border-cyan-200",
    modules: [
      { name: "MacroPulse", href: "/stream/macropulse", icon: HeartPulse },
      { name: "CompeteLens", href: "/stream", icon: ScanSearch },
    ],
  },
  {
    id: "customer",
    title: "Customer Intelligence",
    tag: "Predictive Insights",
    description: "Customer momentum, loyalty signals, and churn exposure translated into finance-ready action.",
    icon: Users,
    accent: "from-fuchsia-400 to-violet-500",
    headerTint: "bg-violet-50 text-violet-800 border-violet-200",
    modules: [
      { name: "Pulse Meter", href: "/stream/pulsemeter", icon: HeartPulse },
      { name: "Churn Guard", href: "/stream", icon: UserRoundCheck },
      { name: "CLV Tracker", href: "/stream", icon: ChartNoAxesCombined },
    ],
  },
  {
    id: "vendor",
    title: "Vendor Intelligence",
    tag: "Risk Monitoring",
    description: "Third-party exposure, geographic risk, and service continuity monitoring in one control layer.",
    icon: ShieldAlert,
    accent: "from-amber-400 to-orange-500",
    headerTint: "bg-orange-50 text-orange-800 border-orange-200",
    modules: [
      { name: "RiskRadar", href: "/stream", icon: Radar },
      { name: "GeoRisk", href: "/stream", icon: Globe },
      { name: "SLA Monitor", href: "/stream", icon: FileChartColumn },
    ],
  },
];

function FlowLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1440 900"
      fill="none"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="lineBlue" x1="720" y1="210" x2="260" y2="350" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#38bdf8" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id="linePurple" x1="720" y1="210" x2="1180" y2="350" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a855f7" stopOpacity="0.9" />
          <stop offset="1" stopColor="#a855f7" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id="lineOrange" x1="720" y1="210" x2="720" y2="660" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f97316" stopOpacity="0.9" />
          <stop offset="1" stopColor="#f97316" stopOpacity="0.18" />
        </linearGradient>
      </defs>

      <path d="M720 248 L720 300 L250 300 L250 352" stroke="url(#lineBlue)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M720 248 L720 300 L1190 300 L1190 352" stroke="url(#linePurple)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M720 248 L720 620" stroke="url(#lineOrange)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

      <circle cx="720" cy="248" r="6" fill="#0ea5e9" />
      <circle cx="250" cy="352" r="6" fill="#0ea5e9" />
      <circle cx="1190" cy="352" r="6" fill="#a855f7" />
      <circle cx="720" cy="620" r="6" fill="#f97316" />
    </svg>
  );
}

function ModulePill({
  name,
  href,
  icon: Icon,
  router,
}: {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <button
      onClick={() => router.push(href)}
      className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-left shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_14px_24px_rgba(14,165,233,0.08)]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
        <Icon className="h-4.5 w-4.5 text-sky-700" />
      </div>
      <span className="text-sm font-semibold text-slate-800">{name}</span>
    </button>
  );
}

function ColumnCard({
  title,
  tag,
  description,
  icon: Icon,
  accent,
  headerTint,
  modules,
  router,
}: {
  title: string;
  tag: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  headerTint: string;
  modules: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className="w-[320px] rounded-[28px] border border-white/80 bg-white/72 p-4 shadow-[0_20px_48px_rgba(47,77,103,0.12)] backdrop-blur-xl">
      <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] ${headerTint}`}>
        {tag}
      </div>

      <div className="mt-3 flex items-start gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br ${accent}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="text-[1.3rem] font-bold tracking-[-0.04em] text-[#0d1b3d]">{title}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {modules.map((module) => (
          <ModulePill key={module.name} {...module} router={router} />
        ))}
      </div>
    </div>
  );
}

export default function ApplicationsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#87D3D4_0%,#b8e7e7_40%,#edf9f8_100%)] text-slate-900 lg:h-screen">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(157,227,229,0.72),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(203,213,255,0.35),_transparent_30%)]" />
        <div className="motion-nebula absolute left-[-8%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(34,197,215,0.14)_0%,_rgba(14,23,43,0)_72%)] blur-3xl" />
        <div className="motion-nebula-slow absolute right-[-10%] top-[8%] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(168,85,247,0.08)_0%,_rgba(14,23,43,0)_72%)] blur-3xl" />
      </div>

      <div className="relative hidden h-screen w-full lg:block">
        <FlowLines />

        <div className="absolute left-1/2 top-[6%] z-30 w-[400px] -translate-x-1/2">
          <div className="rounded-[34px] border border-cyan-200/70 bg-[linear-gradient(160deg,rgba(240,251,255,0.98),rgba(224,246,248,0.94))] p-7 shadow-[0_0_0_1px_rgba(125,211,252,0.18),0_24px_70px_rgba(6,182,212,0.12)] backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="motion-pulse-node flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-cyan-400 to-blue-500 shadow-[0_0_24px_rgba(56,189,248,0.26)]">
                <BrainCircuit className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-sky-700/75">Core Hub</p>
                <h2 className="mt-1 text-[2.1rem] font-black tracking-[-0.05em] text-[#0d1b3d]">IntelliStream</h2>
              </div>
            </div>
            <p className="mt-4 text-lg font-semibold text-[#0b5675]">CFO Intelligence Suite</p>
            <p className="mt-3 text-[15px] leading-8 text-slate-600">
              The enterprise intelligence engine connecting market, customer, and vendor signals into one finance operating layer.
            </p>
          </div>
        </div>

        <div className="absolute left-[4.5%] top-[28%] z-20">
          <ColumnCard {...columns[0]} router={router} />
        </div>

        <div className="absolute right-[4.5%] top-[28%] z-20">
          <ColumnCard {...columns[1]} router={router} />
        </div>

        <div className="absolute left-1/2 top-[47%] z-20 -translate-x-1/2">
          <ColumnCard {...columns[2]} router={router} />
        </div>
      </div>

      <div className="relative space-y-5 px-4 py-4 lg:hidden">
        <div className="rounded-[28px] border border-cyan-200/60 bg-[linear-gradient(160deg,rgba(240,251,255,0.96),rgba(224,246,248,0.92))] p-6 shadow-[0_18px_50px_rgba(6,182,212,0.1)]">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-cyan-400 to-blue-500">
              <BrainCircuit className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-sky-700/75">Core Hub</p>
              <h2 className="mt-1 text-3xl font-black tracking-[-0.05em] text-[#0d1b3d]">IntelliStream</h2>
              <p className="mt-1 text-sm text-[#0b5675]">CFO Intelligence Suite</p>
            </div>
          </div>
        </div>

        {columns.map((column) => {
          const Icon = column.icon;
          return (
            <div key={column.id} className="rounded-[26px] border border-white/75 bg-white/62 p-5 shadow-[0_24px_70px_rgba(47,77,103,0.12)] backdrop-blur-xl">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] ${column.headerTint}`}>
                {column.tag}
              </div>
              <div className="mt-4 flex items-start gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-[16px] bg-gradient-to-br ${column.accent}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold tracking-[-0.04em] text-[#0d1b3d]">{column.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{column.description}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {column.modules.map((module) => (
                  <ModulePill key={module.name} {...module} router={router} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
