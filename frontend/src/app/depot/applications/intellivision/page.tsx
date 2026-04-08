"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import LayerDashboard from "@/components/depot/LayerDashboard";
import type { LayerConfig } from "@/components/depot/LayerDashboard";

const config: LayerConfig = {
  layer: 1,
  name: "IntelliVision\u2122",
  subtitle: "Computer Vision & Physical Intelligence",
  color: "#0f7b8a",
  icon: Eye,
  modules: [
    { name: "Bag/Box Detection", description: "YOLO-class object detection model with 85% confidence threshold. Mismatch alert pipeline to Notification Hub.", status: "active", kpis: [{ label: "Items Detected", value: "2,847" }, { label: "Accuracy", value: "98.2%" }, { label: "Mismatches", value: "12" }, { label: "Alerts Sent", value: "8" }] },
    { name: "Automated Counting", description: "Frame-by-frame counting agent with batch tallying and cross-verification against shipment manifests.", status: "active", kpis: [{ label: "Bags Counted", value: "4,210" }, { label: "Reconciled", value: "99.1%" }, { label: "Discrepancies", value: "4" }, { label: "Batches", value: "38" }] },
    { name: "Cluster Mapping", description: "Spatial heatmap engine with IoT sensor data ingestion, density analytics, and capacity threshold alerts.", status: "active", kpis: [{ label: "Zones Mapped", value: "24" }, { label: "Utilization", value: "78%" }, { label: "Alerts", value: "3" }, { label: "Sensors", value: "48" }] },
    { name: "FIFO/FILO/LIFO Logic", description: "Rule-based inventory sequencing with expiry-aware prioritization and compliance enforcement.", status: "active", kpis: [{ label: "Pick Orders", value: "312" }, { label: "Compliance", value: "100%" }, { label: "Near Expiry", value: "7" }, { label: "Overrides", value: "2" }] },
    { name: "LPR & Gate Control", description: "OCR plate recognition with gate open/close trigger API, vehicle registry sync, and blacklist matching.", status: "active", kpis: [{ label: "Vehicles Today", value: "87" }, { label: "Recognized", value: "98.8%" }, { label: "Denied", value: "1" }, { label: "Avg Gate Time", value: "14s" }] },
    { name: "Perimeter Monitoring", description: "Intrusion detection model with fence-line motion tracking, night vision support, and breach alert dispatch.", status: "active", kpis: [{ label: "Zones Active", value: "12" }, { label: "Alerts", value: "2" }, { label: "Uptime", value: "99.9%" }, { label: "Cameras", value: "18" }] },
  ],
};

export default function IntelliVisionPage() {
  return (
    <LayerDashboard config={config}>
      <section className="mb-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Vision Console
        </p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#0d1b3d]">Open the dedicated camera workspace</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Use the camera console for feed inspection, reconnect actions, and camera-linked security and gate context.
            </p>
          </div>
          <Link
            href="/depot/cameras"
            className="inline-flex items-center justify-center rounded-full border border-[#0f7b8a]/20 bg-[#0f7b8a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0c6672]"
          >
            Open Camera Console
          </Link>
        </div>
      </section>
    </LayerDashboard>
  );
}
