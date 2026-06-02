"use client";

import dynamic from "next/dynamic";

const CommandPage = dynamic(
  () => import("@/components/depot/operations/CommandPage"),
  { ssr: false },
);

export default function AdminCommandRoute() {
  return <CommandPage />;
}
