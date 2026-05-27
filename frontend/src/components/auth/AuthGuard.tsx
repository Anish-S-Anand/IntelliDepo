"use client";

import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [checkingUser, setCheckingUser] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (!user && !checkingUser) {
      setCheckingUser(true);
      void fetchMe().finally(() => setCheckingUser(false));
    }
  }, [checkingUser, fetchMe, isAuthenticated, mounted, router, user]);

  // Show loading spinner while checking auth — never blank
  if (!mounted || (isAuthenticated && !user)) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-page, #080e1c)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E5521A] border-t-transparent" />
          <span className="text-[12px] text-[#8A9BBF]">Checking login...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-page, #080e1c)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E5521A] border-t-transparent" />
          <span className="text-[12px] text-[#8A9BBF]">Redirecting to login...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
