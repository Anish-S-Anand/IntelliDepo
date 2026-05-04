"use client";

import { usePathname } from "next/navigation";
import StreamSidebar from "./StreamSidebar";

export default function StreamLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandaloneStreamApp = pathname?.startsWith("/stream/macropulse");

  if (isStandaloneStreamApp) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#eef1f5] lg:h-screen lg:overflow-hidden">
      <StreamSidebar />
      <main className="ml-56 min-w-0 flex-1 lg:h-screen lg:overflow-hidden">
        {children}
      </main>
    </div>
  );
}
