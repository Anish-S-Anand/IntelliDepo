"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Overview",
    href: "/stream/overview",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
      </svg>
    ),
  },
  {
    label: "Applications",
    href: "/stream/applications",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    label: "Dashboard",
    href: "/stream/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
    ),
  },
];

export default function StreamSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-[#1a2332] text-white flex flex-col z-40">
      {/* Brand */}
      <div className="px-5 pt-6 pb-4 border-b border-white/10">
        <h1 className="text-lg font-bold tracking-tight">IntelliStream</h1>
        <p className="text-[11px] font-semibold tracking-widest text-blue-400 uppercase mt-0.5">
          Financial Intelligence
        </p>
      </div>

      {/* Back button */}
      <div className="px-3 pt-3">
        <button
          onClick={() => router.push("/dashboard")}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>
      </div>

      {/* Nav — only 3 items */}
      <nav className="flex-1 px-3 space-y-0.5 mt-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600/20 text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
