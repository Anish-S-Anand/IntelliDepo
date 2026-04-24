"use client";

import PlatformNav from "@/components/platform/PlatformNav";
import AuthGuard from "@/components/auth/AuthGuard";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50">
        <PlatformNav />
        <main className="flex-1">{children}</main>
      </div>
    </AuthGuard>
  );
}
