import {
  Activity,
  BriefcaseBusiness,
  Globe,
  LayoutDashboard,
  LockKeyhole,
  Search,
  ShieldCheck,
  Settings,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "What-If Studio", icon: Sparkles },
  { label: "Feature Search", icon: BriefcaseBusiness },
  { label: "Team Access", icon: Users },
  { label: "Monitoring", icon: Activity },
  { label: "Settings", icon: Settings },
];

const metrics = [
  { label: "Workspace Health", value: "96.8%", detail: "Stable across live platform modules" },
  { label: "Feature Coverage", value: "42", detail: "Searchable modules and operational tools" },
  { label: "Automation Readiness", value: "18", detail: "Workspaces primed for execution flows" },
];

const trustSignals = [
  { title: "Feature Discovery", detail: "Search through analytics, workflows, and operations modules from one surface.", icon: Search },
  { title: "Secure Governance", detail: "Role-aware workspace access with platform-level policy guardrails.", icon: LockKeyhole },
  { title: "Executive Visibility", detail: "Track health, momentum, and adoption from a unified analytics console.", icon: Globe },
];

const activityFeed = [
  "Given workspace: Precision Workspace",
  "Search-enabled feature index across platform modules",
  "Responsive analytics shell optimized for desktop and mobile teams",
];

export function AppShell() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(83,149,214,0.18),transparent_22%),radial-gradient(circle_at_85%_8%,rgba(255,255,255,0.96),transparent_24%),linear-gradient(180deg,rgba(232,241,250,0.98),rgba(216,230,243,0.94))]" />
      <div className="relative mx-auto flex min-h-screen max-w-[1580px] flex-col lg:flex-row">
        <aside className="border-sky-950/10 flex w-full shrink-0 flex-col border-b bg-[linear-gradient(180deg,#1f5a72,#204c64)] px-5 py-6 text-white shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)] lg:w-[292px] lg:border-b-0 lg:border-r lg:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-[30px] bg-white shadow-[0_20px_34px_rgba(8,31,46,0.18)]">
                <Image
                  src="/fidelis-logo.png"
                  alt="Fidelis Digital logo"
                  width={70}
                  height={70}
                  className="h-[70px] w-[70px] object-contain"
                  priority
                />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold uppercase tracking-[0.34em] text-white">
                  INTELLI PLATFORM
                </p>
                <p className="mt-2 max-w-[11rem] text-xs font-medium uppercase tracking-[0.24em] text-sky-100/70">
                  By Fidelis Digital
                </p>
              </div>
            </div>
            <Badge variant="success" className="w-fit self-start border-white/15 bg-emerald-400/15 text-emerald-100">
              Live
            </Badge>
          </div>

          <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/55">
              Workspace
            </p>
            <nav className="mt-3 grid gap-1.5">
            {navigation.map(({ label, icon: Icon, active }) => (
              <button
                key={label}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${
                  active
                    ? "bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(5,25,40,0.12)]"
                    : "text-sky-50/78 hover:bg-white/16 hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                }`}
                type="button"
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{label}</span>
              </button>
            ))}
            </nav>
          </div>

          <Card className="mt-6 border-white/10 bg-white/6 text-white shadow-none">
            <CardHeader className="gap-3 pb-3">
              <Badge variant="neutral" className="w-fit border-white/10 bg-white/10 text-white">
                Workspace Focus
              </Badge>
              <CardTitle className="text-xl leading-tight">Precision Workspace for analytics, search, and guided execution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-sky-50/80">
              <div className="grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-100/55">Search</p>
                  <p className="mt-1 text-sm text-sky-50/85">Find features, dashboards, and tools instantly.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-100/55">Workspace</p>
                  <p className="mt-1 text-sm text-sky-50/85">A given workspace keeps features organized by flow.</p>
                </div>
              </div>
              <Button variant="secondary" className="w-full rounded-2xl bg-white text-sky-950 hover:bg-sky-50">
                Open workspace
              </Button>
            </CardContent>
          </Card>
        </aside>

        <main className="flex-1 px-5 py-6 lg:px-8 lg:py-7">
          <div className="flex flex-col gap-5 rounded-[34px] border border-[#dceaf7] bg-[linear-gradient(180deg,rgba(234,244,252,0.98),rgba(223,237,248,0.96))] p-4 shadow-[0_26px_70px_rgba(54,92,127,0.14)] sm:p-5 lg:p-7">
            <header className="flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Badge className="border-sky-100 bg-white text-sky-700">Given Workspace</Badge>
                <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-sky-950 sm:text-5xl">
                  Precision Workspace for intelligent feature discovery and execution.
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-500 sm:text-lg">
                  Search the INTELLI PLATFORM, move through curated features, and keep every workspace aligned to a single operational view.
                </p>
              </div>

              <div className="flex w-full max-w-xl flex-col gap-3">
                <div className="flex items-center gap-3 rounded-[24px] border border-sky-100 bg-white px-4 py-3 shadow-[0_12px_30px_rgba(72,115,152,0.10)]">
                  <Search className="h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search features, workflows, dashboards, or settings"
                    className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                  <span className="rounded-full bg-white px-3 py-2 text-sky-700 shadow-sm">Workspace: Precision</span>
                  <span className="rounded-full bg-white px-3 py-2 shadow-sm">Search Ready</span>
                  <span className="rounded-full bg-white px-3 py-2 shadow-sm">Analytics Active</span>
                </div>
              </div>
            </header>

            <section className="grid gap-4 xl:grid-cols-[1.3fr_0.95fr]">
              <Card className="border-[#d7e7f5] bg-[linear-gradient(135deg,rgba(229,241,252,0.96),rgba(241,248,254,0.98))] shadow-[0_24px_50px_rgba(90,138,182,0.10)]">
                <CardHeader className="gap-3 pb-4">
                  <Badge className="w-fit border-sky-100 bg-white text-sky-700">Core Capabilities</Badge>
                  <CardTitle className="text-2xl tracking-[-0.03em]">
                    Clean, searchable workspace surfaces with stronger visual hierarchy
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm leading-6 text-slate-600 sm:grid-cols-3">
                  {trustSignals.map(({ title, detail, icon: Icon }) => (
                    <div key={title} className="rounded-[28px] border border-[#dceaf7] bg-[linear-gradient(180deg,rgba(250,253,255,0.98),rgba(240,247,253,0.96))] p-5 shadow-[0_10px_24px_rgba(94,137,180,0.08)]">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                        {title}
                      </p>
                      <p className="mt-3 text-base leading-7 text-slate-600">
                        {detail}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-[#d7e7f5] bg-[linear-gradient(180deg,rgba(246,251,255,0.96),rgba(236,245,252,0.94))] shadow-[0_18px_40px_rgba(90,138,182,0.10)]">
                <CardHeader className="gap-3">
                  <Badge variant="neutral" className="w-fit border-sky-100 bg-sky-50 text-sky-700">
                    Platform Status
                  </Badge>
                  <CardTitle className="text-xl text-sky-950">Workspace readiness overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-500">
                  <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-[0.22em]">All systems nominal</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-emerald-700/85">
                      Search, workspace navigation, and feature surfaces are available for active use.
                    </p>
                  </div>
                  {activityFeed.map((item) => (
                    <div key={item} className="rounded-2xl border border-[#dceaf7] bg-[rgba(233,244,252,0.86)] px-4 py-3 text-slate-600">
                      {item}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {metrics.map((metric) => (
                <Card key={metric.label} className="rounded-[28px] border-[#d7e7f5] bg-[linear-gradient(180deg,rgba(247,252,255,0.96),rgba(236,245,252,0.94))] shadow-[0_12px_28px_rgba(90,138,182,0.08)]">
                  <CardHeader className="pb-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                      {metric.label}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                      {metric.value}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{metric.detail}</p>
                  </CardContent>
                </Card>
              ))}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
