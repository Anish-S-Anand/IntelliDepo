import dynamic from "next/dynamic";
import InventorySkeleton from "@/components/depot/skeletons/InventorySkeleton";

const InventoryPage = dynamic(
  () => import("@/components/depot/operations/InventoryPage"),
  { ssr: false, loading: () => <InventorySkeleton /> },
);

export default function InventoryRoute() {
  return <InventoryPage />;
}
