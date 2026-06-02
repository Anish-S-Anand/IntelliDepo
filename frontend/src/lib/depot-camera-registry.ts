export type DepotWarehouseId = "WH_BLR" | "WH_HYD" | "WH_MUM";

export const DEPOT_WAREHOUSE_ORDER: DepotWarehouseId[] = ["WH_BLR", "WH_HYD", "WH_MUM"];

export const DEPOT_WAREHOUSE_REGISTRY: Record<
  DepotWarehouseId,
  {
    name: string;
    city: string;
    regionId: string;
    zones: string[];
    cameras: string[];
  }
> = {
  WH_BLR: {
    name: "Bangalore Warehouse 01",
    city: "Bangalore",
    regionId: "REG_SOUTH",
    zones: ["BLR-Z1", "BLR-Z2", "BLR-Z3", "BLR-Z4"],
    cameras: [
      "BLR-W01-Gate1-Entry",
      "BLR-W01-Cluster1-Overhead",
      "BLR-W01-LoadingBay1-4",
      "BLR-W01-Cluster3-Perimeter",
      "BLR-W01-Gate2-Exit",
      "BLR-W01-Yard-Overview",
    ],
  },
  WH_HYD: {
    name: "Hyderabad Warehouse 01",
    city: "Hyderabad",
    regionId: "REG_SOUTH",
    zones: ["HYD-Z1", "HYD-Z2", "HYD-Z3", "HYD-Z4"],
    cameras: [
      "HYD-W01-Gate1-Entry",
      "HYD-W01-Cluster1-Overhead",
      "HYD-W01-LoadingBay1-4",
      "HYD-W01-Cluster3-Perimeter",
      "HYD-W01-Gate2-Exit",
      "HYD-W01-Yard-Overview",
    ],
  },
  WH_MUM: {
    name: "Mumbai Warehouse 01",
    city: "Mumbai",
    regionId: "REG_WEST",
    zones: ["MUM-Z1", "MUM-Z2", "MUM-Z3", "MUM-Z4"],
    cameras: [
      "MUM-W01-Gate1-Entry",
      "MUM-W01-Cluster1-Overhead",
      "MUM-W01-LoadingBay1-4",
      "MUM-W01-Cluster3-Perimeter",
      "MUM-W01-Gate2-Exit",
      "MUM-W01-Yard-Overview",
    ],
  },
};

export function depotCameraName(warehouseId: DepotWarehouseId, index: number): string {
  return DEPOT_WAREHOUSE_REGISTRY[warehouseId].cameras[index] ?? DEPOT_WAREHOUSE_REGISTRY[warehouseId].cameras[0];
}
