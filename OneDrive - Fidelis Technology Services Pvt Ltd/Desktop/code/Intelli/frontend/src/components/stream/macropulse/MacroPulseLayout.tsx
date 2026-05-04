"use client";

import MacroPulseSidebar from "./MacroPulseSidebar";

export default function MacroPulseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(157,227,229,0.72),_transparent_36%),linear-gradient(135deg,_#b7e4e6_0%,_#dff1ef_52%,_#edf6f3_100%)] text-slate-900">
      <MacroPulseSidebar />
      <main className="min-w-0 flex-1 overflow-hidden">
        <div className="h-screen">{children}</div>
      </main>
    </div>
  );
}
