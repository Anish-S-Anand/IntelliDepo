"use client";

import { useCallback, useMemo, useState } from "react";
import { Camera, ShieldCheck, Truck, AlertTriangle, Users, Package } from "lucide-react";
import { ModelProvider, useCocoSsd } from "@/hooks/useCocoSsd";
import { useAuthStore } from "@/stores/authStore";
import { DEPOT_WAREHOUSE_REGISTRY, type DepotWarehouseId } from "@/lib/depot-camera-registry";
import { VideoFeed } from "./VideoFeed";

type WarehouseId = DepotWarehouseId;

interface CameraData {
  id: string;
  name: string;
  warehouseId: WarehouseId;
  warehouseName: string;
  stream_url?: string;
  videoFile?: string;
}

interface DetectionCounts {
  vehicles: number;
  workers: number;
  cementBags: number;
}

const VIDEO_LIBRARY = [
  "Screen Recording 2025-05-22 164244.mp4",
  "Screen Recording 2025-08-11 173926.mp4",
  "Screen Recording 2025-07-30 115414.mp4",
  "Recording 2025-07-30 115417.mp4",
  "Recording 2025-07-30 120521.mp4",
  "Recording 2025-08-11 171805.mp4",
] as const;

function cameraSetForWarehouse(warehouseId: WarehouseId): CameraData[] {
  const warehouse = DEPOT_WAREHOUSE_REGISTRY[warehouseId];

  return Array.from({ length: 6 }, (_, index) => ({
    id: warehouse.cameras[index],
    name: warehouse.cameras[index],
    warehouseId,
    warehouseName: warehouse.name,
    videoFile: VIDEO_LIBRARY[index],
  }));
}

function scopedWarehouseIds(role?: string, email?: string, location?: string): WarehouseId[] {
  const normalizedRole = (role ?? "").toLowerCase();
  const normalizedEmail = (email ?? "").toLowerCase();
  const normalizedLocation = (location ?? "").toLowerCase();

  if (normalizedRole === "warehouse_manager") {
    if (normalizedEmail.includes("hyd") || normalizedLocation.includes("hyderabad")) return ["WH_HYD"];
    if (normalizedEmail.includes("mum") || normalizedLocation.includes("mumbai")) return ["WH_MUM"];
    return ["WH_BLR"];
  }

  if (normalizedRole === "regional_manager") {
    if (normalizedLocation.includes("west")) return ["WH_MUM"];
    return ["WH_HYD", "WH_BLR"];
  }

  if (normalizedRole === "central_manager" || normalizedRole === "admin") {
    return ["WH_HYD", "WH_BLR", "WH_MUM"];
  }

  return ["WH_BLR"];
}

function ModelStatus() {
  const { loading, error } = useCocoSsd();

  if (error) {
    return (
      <span className="flex items-center gap-1.5 rounded bg-yellow-500/20 px-2 py-1 text-[10px] text-yellow-400">
        <AlertTriangle size={12} /> Browser AI unavailable - using server detection
      </span>
    );
  }

  if (loading) {
    return (
      <span className="flex items-center gap-1.5 rounded bg-green-500/20 px-2 py-1 text-[10px] text-green-400">
        <ShieldCheck size={12} /> Cameras active
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 rounded bg-green-500/20 px-2 py-1 text-[10px] text-green-400">
      <ShieldCheck size={12} /> Cameras active
    </span>
  );
}

function CameraGridInner() {
  const user = useAuthStore((state) => state.user);
  const [detections, setDetections] = useState<Record<number, DetectionCounts>>({});

  const warehouseIds = useMemo(
    () => scopedWarehouseIds(user?.role, user?.email, user?.location),
    [user?.role, user?.email, user?.location],
  );

  const cameraGroups = useMemo(
    () =>
      warehouseIds.map((warehouseId) => ({
        warehouseId,
        label: DEPOT_WAREHOUSE_REGISTRY[warehouseId].name,
        cameras: cameraSetForWarehouse(warehouseId),
      })),
    [warehouseIds],
  );

  const cameras = useMemo(() => cameraGroups.flatMap((group) => group.cameras), [cameraGroups]);
  const overviewMode = cameraGroups.length > 1;
  const overviewColumns = cameraGroups.length > 2 ? "grid-cols-6" : "grid-cols-4";

  const handleDetectionUpdate = useCallback(
    (cameraIndex: number) =>
      (vehicles: Array<{ bbox: [number, number, number, number]; class: string; score: number }>) => {
        const vehicleClasses = ["car", "truck", "bus", "motorcycle", "bicycle", "vehicle"];
        const personClasses = ["person"];
        const bagClasses = ["suitcase", "backpack", "handbag", "sports ball"];

        const vehicleCount = vehicles.filter((v) =>
          vehicleClasses.some((c) => v.class.toLowerCase().includes(c)),
        ).length;
        const workerCount = vehicles.filter((v) =>
          personClasses.some((c) => v.class.toLowerCase().includes(c)),
        ).length;
        const bagCount = vehicles.filter((v) =>
          bagClasses.some((c) => v.class.toLowerCase().includes(c)),
        ).length;

        setDetections((prev) => ({
          ...prev,
          [cameraIndex]: {
            vehicles: vehicleCount,
            workers: workerCount,
            cementBags: bagCount,
          },
        }));
      },
    [],
  );

  const activeCameras = cameras.length;

  return (
    <div className="flex h-[calc(100vh-88px)] flex-col gap-2 overflow-hidden bg-[#0a0f1a] p-3">
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-[#3fb950]" />
          <h2 className="text-sm font-bold text-white">IntelliVision</h2>
          <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
            {activeCameras} feeds
          </span>
        </div>
        <ModelStatus />
      </div>

      {overviewMode && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {cameraGroups.map((group) => (
            <span key={group.warehouseId} className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white/60">
              {group.label}: {group.cameras.length}
            </span>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        {overviewMode ? (
          <section className={`grid h-full ${overviewColumns} grid-rows-3 gap-2`}>
            {cameras.map((cam) => {
              const cameraIndex = cameras.findIndex((camera) => camera.id === cam.id);
              const det = detections[cameraIndex];
              const isOffline = !cam.videoFile;

              return (
                <div key={cam.id} className="relative min-h-0">
                  <VideoFeed
                    name={cam.name}
                    cameraId={cam.id}
                    videoFile={cam.videoFile}
                    cameraIndex={cameraIndex}
                    offline={isOffline}
                    compact
                    onDetectionUpdate={handleDetectionUpdate(cameraIndex)}
                  />
                  {!isOffline && (
                    <div className="absolute top-1 left-1 flex flex-col gap-0.5">
                      {det?.vehicles != null && det.vehicles > 0 && (
                        <div className="flex items-center gap-0.5 rounded bg-[#3fb950] px-1.5 py-0.5 text-[9px] font-bold text-black">
                          <Truck size={8} /> {det.vehicles}
                        </div>
                      )}
                      {det?.workers != null && det.workers > 0 && (
                        <div className="flex items-center gap-0.5 rounded bg-blue-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          <Users size={8} /> {det.workers}
                        </div>
                      )}
                      {det?.cementBags != null && det.cementBags > 0 && (
                        <div className="flex items-center gap-0.5 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-black">
                          <Package size={8} /> {det.cementBags} bags
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ) : (
          <div className="h-full overflow-y-auto pr-1">
            {cameraGroups.map((group, groupIndex) => (
              <section key={group.warehouseId} className={groupIndex > 0 ? "mt-4" : ""}>
                <div className="grid grid-cols-3 gap-2">
                  {group.cameras.map((cam) => {
                const cameraIndex = cameras.findIndex((camera) => camera.id === cam.id);
                const det = detections[cameraIndex];
                const isOffline = !cam.videoFile;

                return (
                  <div key={cam.id} className="relative flex flex-col">
                    <VideoFeed
                      name={cam.name}
                      cameraId={cam.id}
                      videoFile={cam.videoFile}
                      cameraIndex={cameraIndex}
                      offline={isOffline}
                      onDetectionUpdate={handleDetectionUpdate(cameraIndex)}
                    />
                    {!isOffline && (
                      <div className="absolute top-1 left-1 flex flex-col gap-0.5">
                        {det?.vehicles != null && det.vehicles > 0 && (
                          <div className="flex items-center gap-0.5 rounded bg-[#3fb950] px-1.5 py-0.5 text-[9px] font-bold text-black">
                            <Truck size={8} /> {det.vehicles}
                          </div>
                        )}
                        {det?.workers != null && det.workers > 0 && (
                          <div className="flex items-center gap-0.5 rounded bg-blue-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            <Users size={8} /> {det.workers}
                          </div>
                        )}
                        {det?.cementBags != null && det.cementBags > 0 && (
                          <div className="flex items-center gap-0.5 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-black">
                            <Package size={8} /> {det.cementBags} bags
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CameraGrid() {
  return (
    <ModelProvider>
      <CameraGridInner />
    </ModelProvider>
  );
}
