"""
IntelliVision Depot — Data Seed Script

Seeds the database with realistic warehouse demo data:
- 6 cameras (different zones)
- 3 gates (entry, exit, loading)
- 10 vehicles (mix of approved, pending, blacklisted)
- 5 visitors
- 6 perimeter zones (restricted, hazardous, loading, general)
- Detection model (YOLOv8n)
- 4 cluster zones with occupancy
- 3 shipment manifests with count sessions
- 2 sequencing configs (FIFO, FEFO)
- 5 inventory batches

Run: python -m app.depot.seed
"""
import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

logger = logging.getLogger("intelli.depot.seed")


# ---------------------------------------------------------------------------
# Seed data definitions
# ---------------------------------------------------------------------------

CAMERAS = [
    {"name": "Gate Entry North", "stream_url": "rtsp://192.168.1.101:554/stream1", "zone": "Entry Gate", "frame_rate": 30, "resolution": "3840x2160"},
    {"name": "Zone A Overhead", "stream_url": "rtsp://192.168.1.102:554/stream1", "zone": "Zone-A", "frame_rate": 25, "resolution": "3840x2160"},
    {"name": "Loading Bay 1-4", "stream_url": "rtsp://192.168.1.103:554/stream1", "zone": "Loading Dock", "frame_rate": 30, "resolution": "1920x1080"},
    {"name": "Zone C Perimeter", "stream_url": "rtsp://192.168.1.104:554/stream1", "zone": "Zone-C", "frame_rate": 25, "resolution": "1920x1080"},
    {"name": "Gate Exit South", "stream_url": "rtsp://192.168.1.105:554/stream1", "zone": "Exit Gate", "frame_rate": 30, "resolution": "3840x2160"},
    {"name": "Yard Overview", "stream_url": "rtsp://192.168.1.106:554/stream1", "zone": "Yard", "frame_rate": 20, "resolution": "3840x2160"},
]

GATES = [
    {"name": "Gate A — North Entry", "gate_type": "entry"},
    {"name": "Gate B — South Exit", "gate_type": "exit"},
    {"name": "Gate C — Loading Dock", "gate_type": "loading"},
]

VEHICLES = [
    {"plate_number": "TN-04-AB-1234", "vehicle_type": "truck", "owner_name": "Rajesh Kumar", "company": "TransCargo India", "status": "approved"},
    {"plate_number": "MH-12-CD-5678", "vehicle_type": "truck", "owner_name": "Suresh Patel", "company": "BlueLine Logistics", "status": "approved"},
    {"plate_number": "GJ-05-EF-9012", "vehicle_type": "truck", "owner_name": "Amit Shah", "company": "Gujarat Transport", "status": "approved"},
    {"plate_number": "DL-03-GH-3456", "vehicle_type": "container", "owner_name": "Vikram Singh", "company": "Delhi Freight Corp", "status": "approved"},
    {"plate_number": "RJ-14-IJ-7890", "vehicle_type": "truck", "owner_name": "Mohan Joshi", "company": "Rajasthan Cargo", "status": "approved"},
    {"plate_number": "KA-01-KL-2345", "vehicle_type": "tanker", "owner_name": "Prasad Rao", "company": "Southern Transport", "status": "approved"},
    {"plate_number": "AP-09-MN-6789", "vehicle_type": "van", "owner_name": "Ravi Teja", "company": "QuickShip", "status": "pending"},
    {"plate_number": "UP-80-OP-0123", "vehicle_type": "truck", "owner_name": "Anil Gupta", "company": "UP Movers", "status": "pending"},
    {"plate_number": "MH-01-QR-4567", "vehicle_type": "van", "owner_name": "Unknown", "company": "Unregistered", "status": "blacklisted"},
    {"plate_number": "DL-10-ST-8901", "vehicle_type": "truck", "owner_name": "Suspicious", "company": "N/A", "status": "blacklisted"},
]

VISITORS = [
    {"name": "Ananya Sharma", "company": "Deloitte India", "purpose": "Audit inspection", "contact_number": "+91-9876543210", "host_name": "Site Manager"},
    {"name": "Karthik Reddy", "company": "Fidelis Technology", "purpose": "System maintenance", "contact_number": "+91-9123456789", "host_name": "IT Lead"},
    {"name": "Priya Nair", "company": "SafeGuard Consulting", "purpose": "Safety audit", "contact_number": "+91-9988776655", "host_name": "HSE Manager"},
    {"name": "Rahul Verma", "company": "CementCo Supplier", "purpose": "Delivery coordination", "contact_number": "+91-9112233445", "host_name": "Dispatch Head"},
    {"name": "Deepika Jain", "company": "InsureMax Ltd", "purpose": "Insurance assessment", "contact_number": "+91-9556677889", "host_name": "Operations Director"},
]

PERIMETER_ZONES = [
    {"name": "Server Room Entrance", "zone_type": "restricted", "alert_severity": "critical", "alert_on_entry": True},
    {"name": "Hazmat Storage Perimeter", "zone_type": "hazardous", "alert_severity": "high", "alert_on_entry": True},
    {"name": "Loading Dock Boundary", "zone_type": "loading", "alert_severity": "medium", "alert_on_entry": True},
    {"name": "North Fence Line", "zone_type": "restricted", "alert_severity": "high", "alert_on_entry": True},
    {"name": "South Perimeter Wall", "zone_type": "general", "alert_severity": "medium", "alert_on_entry": True},
    {"name": "Emergency Exit Corridor", "zone_type": "controlled", "alert_severity": "high", "alert_on_entry": True},
]

CLUSTER_ZONES = [
    {"zone_code": "A", "name": "Storage Bay A — Cement", "zone_type": "storage", "floor": "ground", "area_sqm": 2400, "max_capacity_units": 1000, "current_occupancy": 810},
    {"zone_code": "B", "name": "Storage Bay B — Fertilizers", "zone_type": "storage", "floor": "ground", "area_sqm": 2800, "max_capacity_units": 1000, "current_occupancy": 450},
    {"zone_code": "C", "name": "Hazmat Storage C", "zone_type": "hazmat", "floor": "ground", "area_sqm": 1600, "max_capacity_units": 800, "current_occupancy": 595},
    {"zone_code": "D", "name": "Heavy Materials D", "zone_type": "storage", "floor": "ground", "area_sqm": 3200, "max_capacity_units": 1200, "current_occupancy": 1092},
]

MANIFESTS = [
    {"manifest_code": "MF-2026-0412", "vehicle_number": "TN-04-AB-1234", "expected_bags": 500, "expected_boxes": 50},
    {"manifest_code": "MF-2026-0413", "vehicle_number": "MH-12-CD-5678", "expected_bags": 300, "expected_boxes": 0},
    {"manifest_code": "MF-2026-0414", "vehicle_number": "GJ-05-EF-9012", "expected_bags": 200, "expected_boxes": 100},
]

DETECTION_MODEL = {
    "model_name": "yolov8n",
    "model_version": "8.0.1",
    "confidence_threshold": 0.85,
    "iou_threshold": 0.45,
    "target_classes": "bag,box,pallet,carton,person,vehicle",
    "description": "YOLOv8 Nano — warehouse object detection (bags, boxes, pallets, cartons, vehicles, personnel)",
}

BATCHES = [
    {"sku_id": "SKU-CEM-53", "product_name": "OPC Cement 53 Grade", "batch_number": "B2025-1022", "quantity": 498, "zone": "A", "rack": "A-01", "bin_location": "A-01-L1", "manufacturing_date": "2026-01-15", "expiry_date": "2027-01-15", "rule_type": "FIFO"},
    {"sku_id": "SKU-CEM-33", "product_name": "PPC Cement 33 Grade", "batch_number": "B2025-1019", "quantity": 320, "zone": "A", "rack": "A-02", "bin_location": "A-02-L1", "manufacturing_date": "2026-02-01", "expiry_date": "2027-02-01", "rule_type": "FIFO"},
    {"sku_id": "SKU-FRT-GA", "product_name": "Fertilizer Grade A", "batch_number": "B2025-1021", "quantity": 450, "zone": "B", "rack": "B-02", "bin_location": "B-02-L2", "manufacturing_date": "2025-10-01", "expiry_date": "2026-10-01", "rule_type": "FEFO"},
    {"sku_id": "SKU-HAZ-03", "product_name": "Chemicals HAZ-3", "batch_number": "B2025-1018", "quantity": 148, "zone": "C", "rack": "C-01", "bin_location": "C-01-L1", "manufacturing_date": "2025-11-15", "expiry_date": "2026-05-15", "rule_type": "FEFO"},
    {"sku_id": "SKU-STL-02", "product_name": "Steel Coils Grade 2", "batch_number": "B2025-1023", "quantity": 580, "zone": "D", "rack": "D-01", "bin_location": "D-01-L1", "manufacturing_date": "2026-03-01", "expiry_date": "2028-03-01", "rule_type": "FIFO"},
]


# ---------------------------------------------------------------------------
# Seed runner
# ---------------------------------------------------------------------------

async def seed_database(db_url: str | None = None):
    """Seed the depot database with demo data."""
    import os
    if db_url is None:
        db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://intelli:intelli@localhost:5432/intelli")

    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        try:
            now = datetime.now(timezone.utc)
            seed_user = "seed-script"

            # ── Cameras ──
            camera_ids = []
            for cam in CAMERAS:
                cid = uuid.uuid4()
                camera_ids.append(cid)
                await db.execute(text("""
                    INSERT INTO depot_cameras (id, name, stream_url, protocol, zone, status, is_active, frame_rate, resolution, created_at, updated_at)
                    VALUES (:id, :name, :stream_url, 'rtsp', :zone, 'active', true, :frame_rate, :resolution, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {**cam, "id": cid, "now": now})
            logger.info(f"Seeded {len(CAMERAS)} cameras")

            # ── Gates ──
            gate_ids = []
            for i, gate in enumerate(GATES):
                gid = uuid.uuid4()
                gate_ids.append(gid)
                await db.execute(text("""
                    INSERT INTO depot_gates (id, gate_code, name, gate_type, status, is_active, total_entries_today, created_at, updated_at)
                    VALUES (:id, :code, :name, :gate_type, 'closed', true, 0, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {**gate, "id": gid, "code": f"GATE-{chr(65+i)}", "now": now})
            logger.info(f"Seeded {len(GATES)} gates")

            # ── Vehicles ──
            for v in VEHICLES:
                await db.execute(text("""
                    INSERT INTO depot_vehicles (id, plate_number, vehicle_type, owner_name, company, status, is_active, created_at, updated_at)
                    VALUES (:id, :plate_number, :vehicle_type, :owner_name, :company, :status, true, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {**v, "id": uuid.uuid4(), "now": now})
            logger.info(f"Seeded {len(VEHICLES)} vehicles")

            # ── Visitors ──
            for vis in VISITORS:
                await db.execute(text("""
                    INSERT INTO depot_visitors (id, name, company, purpose, contact_number, host_name, status, checked_in_at, pass_valid_until, registered_by, created_at, updated_at)
                    VALUES (:id, :name, :company, :purpose, :contact_number, :host_name, 'checked_in', :now, :expiry, :user, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {**vis, "id": uuid.uuid4(), "now": now, "expiry": now + timedelta(hours=8), "user": seed_user})
            logger.info(f"Seeded {len(VISITORS)} visitors")

            # ── Perimeter Zones ──
            pz_ids = []
            for j, pz in enumerate(PERIMETER_ZONES):
                pzid = uuid.uuid4()
                pz_ids.append(pzid)
                cam_id = camera_ids[j % len(camera_ids)]
                await db.execute(text("""
                    INSERT INTO depot_perimeter_zones (id, name, zone_type, alert_severity, alert_on_entry, camera_id, is_active, night_vision_enabled, night_vision_mode, created_by, created_at, updated_at)
                    VALUES (:id, :name, :zone_type, :alert_severity, :alert_on_entry, :cam_id, true, true, 'auto', :user, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {**pz, "id": pzid, "cam_id": cam_id, "user": seed_user, "now": now})
            logger.info(f"Seeded {len(PERIMETER_ZONES)} perimeter zones")

            # ── Sample Breaches ──
            for k in range(3):
                bid = uuid.uuid4()
                await db.execute(text("""
                    INSERT INTO depot_perimeter_breaches (id, zone_id, camera_id, breach_type, severity, confidence, snapshot_ref, alert_sent, notes, detected_at, created_at, updated_at)
                    VALUES (:id, :zone_id, :cam_id, :breach_type, :severity, :confidence, :snapshot, true, :notes, :detected_at, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {
                    "id": bid,
                    "zone_id": pz_ids[k],
                    "cam_id": camera_ids[k],
                    "breach_type": ["unauthorized_entry", "loitering", "after_hours"][k],
                    "severity": ["critical", "high", "medium"][k],
                    "confidence": [0.94, 0.87, 0.78][k],
                    "snapshot": f"seed://breach-{k}",
                    "notes": f"Seed breach event {k+1} for demo",
                    "detected_at": now - timedelta(minutes=[5, 25, 90][k]),
                    "now": now,
                })
            logger.info("Seeded 3 sample breaches")

            # ── Cluster Zones ──
            for cz in CLUSTER_ZONES:
                await db.execute(text("""
                    INSERT INTO depot_zones (id, zone_code, name, zone_type, floor, area_sqm, max_capacity_units, current_occupancy, utilization_pct, status, is_active, created_at, updated_at)
                    VALUES (:id, :zone_code, :name, :zone_type, :floor, :area_sqm, :max, :occ, :util, :status, true, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {
                    **cz, "id": uuid.uuid4(),
                    "max": cz["max_capacity_units"],
                    "occ": cz["current_occupancy"],
                    "util": round(cz["current_occupancy"] / cz["max_capacity_units"] * 100, 1),
                    "status": "critical" if cz["current_occupancy"] / cz["max_capacity_units"] > 0.9 else "warning" if cz["current_occupancy"] / cz["max_capacity_units"] > 0.75 else "normal",
                    "now": now,
                })
            logger.info(f"Seeded {len(CLUSTER_ZONES)} cluster zones")

            # ── Detection Model ──
            await db.execute(text("""
                INSERT INTO depot_detection_models (id, model_name, model_version, confidence_threshold, iou_threshold, target_classes, description, is_active, created_at, updated_at)
                VALUES (:id, :model_name, :model_version, :confidence_threshold, :iou_threshold, :target_classes, :description, true, :now, :now)
                ON CONFLICT DO NOTHING
            """), {**DETECTION_MODEL, "id": uuid.uuid4(), "now": now})
            logger.info("Seeded detection model: yolov8n")

            # ── Shipment Manifests ──
            for mf in MANIFESTS:
                await db.execute(text("""
                    INSERT INTO depot_shipment_manifests (id, manifest_code, vehicle_number, expected_bags, expected_boxes, status, created_at, updated_at)
                    VALUES (:id, :manifest_code, :vehicle_number, :expected_bags, :expected_boxes, 'active', :now, :now)
                    ON CONFLICT DO NOTHING
                """), {**mf, "id": uuid.uuid4(), "now": now})
            logger.info(f"Seeded {len(MANIFESTS)} shipment manifests")

            # ── Inventory Batches ──
            for batch in BATCHES:
                await db.execute(text("""
                    INSERT INTO depot_inventory_batches (id, sku_id, product_name, batch_number, quantity, zone, rack, bin_location, manufacturing_date, expiry_date, rule_type, status, priority_score, created_at, updated_at)
                    VALUES (:id, :sku_id, :product_name, :batch_number, :quantity, :zone, :rack, :bin_location, :mfg, :exp, :rule_type, 'available', 0.0, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {
                    **batch, "id": uuid.uuid4(),
                    "mfg": batch["manufacturing_date"],
                    "exp": batch["expiry_date"],
                    "now": now,
                })
            logger.info(f"Seeded {len(BATCHES)} inventory batches")

            # ── IntelliOps Tasks ──
            ops_tasks = [
                {"title": "Unload Truck TN-04-AB-1234", "worker_name": "Ramesh K.", "worker_id": "W-001", "area": "Zone C Bay 4", "zone": "Zone-C", "priority": "high",   "status": "in_progress"},
                {"title": "FIFO Compliance Check — Zone B", "worker_name": "Priya S.", "worker_id": "W-002", "area": "Zone B Clusters", "zone": "Zone-B", "priority": "medium", "status": "pending"},
                {"title": "LPR Gate Calibration", "worker_name": "Tech Team", "worker_id": "W-003", "area": "Gate Entry North", "zone": "Entry Gate", "priority": "low",    "status": "pending"},
                {"title": "Damage Assessment — INC-002", "worker_name": "QA Lead", "worker_id": "W-004", "area": "Zone C", "zone": "Zone-C", "priority": "high",   "status": "in_progress"},
                {"title": "Inventory Reconciliation — Zone A", "worker_name": "Anita R.", "worker_id": "W-005", "area": "Zone A", "zone": "Zone-A", "priority": "medium", "status": "completed"},
            ]
            for t in ops_tasks:
                await db.execute(text("""
                    INSERT INTO ops_tasks (id, title, worker_name, worker_id, area, zone, priority, status, created_at, updated_at)
                    VALUES (:id, :title, :worker_name, :worker_id, :area, :zone, :priority, :status, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {**t, "id": uuid.uuid4(), "now": now})
            logger.info(f"Seeded {len(ops_tasks)} IntelliOps tasks")

            # ── IntelliOps SOP Checklists ──
            checklists = [
                {"name": "Inbound Inspection — Shift A", "shift": "Shift A", "zone": "Entry Gate", "progress_pct": 85, "status": "in_progress", "item_count": 20, "items_done": 17},
                {"name": "FIFO Daily Audit",              "shift": "Shift A", "zone": "Zone-B",     "progress_pct": 100, "status": "complete",    "item_count": 10, "items_done": 10},
                {"name": "Perimeter Security Check",      "shift": "Shift B", "zone": "Perimeter",  "progress_pct": 60,  "status": "in_progress", "item_count": 15, "items_done": 9},
                {"name": "Cold Storage Temperature Log",  "shift": "Shift A", "zone": "Zone-C",     "progress_pct": 0,   "status": "not_started", "item_count": 8,  "items_done": 0},
            ]
            for cl in checklists:
                await db.execute(text("""
                    INSERT INTO ops_sop_checklists (id, name, shift, zone, progress_pct, status, item_count, items_done, created_at, updated_at)
                    VALUES (:id, :name, :shift, :zone, :progress_pct, :status, :item_count, :items_done, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {**cl, "id": uuid.uuid4(), "now": now})
            logger.info(f"Seeded {len(checklists)} SOP checklists")

            # ── IntelliOps Exceptions ──
            exceptions = [
                {"exception_type": "count_mismatch",        "location": "Cluster B-09",       "zone": "Zone-B", "root_cause": "ERP sync delay",   "description": "Physical count shows -5 bags vs ERP record.", "status": "open",         "severity": "high",   "sla_minutes": 60},
                {"exception_type": "fifo_violation",        "location": "Zone B Cluster B2",  "zone": "Zone-B", "root_cause": "Manual override",   "description": "Batch B2025-1021 picked out of FIFO order.",  "status": "investigating","severity": "high",   "sla_minutes": 120},
                {"exception_type": "damaged_goods",         "location": "Zone C Bay 4",       "zone": "Zone-C", "root_cause": "Handling error",    "description": "5 bags torn during unloading. Est. loss ₹4,200.", "status": "open",      "severity": "medium", "sla_minutes": 30},
                {"exception_type": "missing_documentation", "location": "Gate Entry",         "zone": "Entry Gate", "root_cause": "Driver oversight", "description": "Delivery challan missing for TN-04-AB-1234.", "status": "open",       "severity": "low",    "sla_minutes": 240},
            ]
            for ex in exceptions:
                await db.execute(text("""
                    INSERT INTO ops_exceptions (id, exception_type, location, zone, root_cause, description, status, severity, sla_minutes, detected_at, created_at, updated_at)
                    VALUES (:id, :exception_type, :location, :zone, :root_cause, :description, :status, :severity, :sla_minutes, :now, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {**ex, "id": uuid.uuid4(), "now": now})
            logger.info(f"Seeded {len(exceptions)} IntelliOps exceptions")

            await db.commit()
            logger.info("=== Depot seed complete ===")
            print("\n✓ Depot database seeded successfully with demo data.")
            print(f"  • {len(CAMERAS)} cameras")
            print(f"  • {len(GATES)} gates")
            print(f"  • {len(VEHICLES)} vehicles")
            print(f"  • {len(VISITORS)} visitors")
            print(f"  • {len(PERIMETER_ZONES)} perimeter zones + 3 breaches")
            print(f"  • {len(CLUSTER_ZONES)} cluster zones")
            print(f"  • 1 detection model (YOLOv8n)")
            print(f"  • {len(MANIFESTS)} shipment manifests")
            print(f"  • {len(BATCHES)} inventory batches")

        except Exception as e:
            await db.rollback()
            logger.error(f"Seed failed: {e}")
            print(f"\n✗ Seed failed: {e}")
            raise


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_database())
