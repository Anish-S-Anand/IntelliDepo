"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { IntelliLanding } from "@/components/layout/intelli-landing";

export default function HomePage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    // If already logged in, go straight to IntelliDepot
    if (isAuthenticated) {
      router.replace("/depot/operations");
    }
  }, [isAuthenticated, router]);

  return <IntelliLanding />;
}
