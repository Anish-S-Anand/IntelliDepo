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
    # Local depot videos — real warehouse CCTV recordings from depot pendrive
    # stream_url uses "local:{filename}" prefix; video_library.py serves frames
    {"name": "Gate Entry North",  "stream_url": "local:dtranshipment 1 (2).mp4",                "zone": "Entry Gate",   "frame_rate": 25, "resolution": "854x480"},  # Transhipment area
    {"name": "Zone A Overhead",   "stream_url": "local:cluster 13 (1).mp4",                     "zone": "Zone-A",       "frame_rate": 25, "resolution": "854x480"},  # Cluster 13 storage
    {"name": "Loading Bay 1-4",   "stream_url": "local:cluster 4-5 (1).mp4",                    "zone": "Loading Dock", "frame_rate": 25, "resolution": "854x480"},  # Cluster 4-5 bay
    {"name": "Zone C Perimeter",  "stream_url": "local:Recording 2025-07-30 115417.mp4",        "zone": "Zone-C",       "frame_rate": 25, "resolution": "854x480"},  # Depot perimeter
    {"name": "Gate Exit South",   "stream_url": "local:Recording 2025-08-11 171805.mp4",        "zone": "Exit Gate",    "frame_rate": 25, "resolution": "854x480"},  # Exit gate ops
    {"name": "Yard Overview",     "stream_url": "local:Screen Recording 2025-08-11 174929.mp4", "zone": "Yard",         "frame_rate": 25, "resolution": "854x480"},  # Yard overview
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

            # ── Vehicles (gate registry) ──
            try:
                async with db.begin_nested():
                    for v in VEHICLES:
                        await db.execute(text("""
                            INSERT INTO depot_vehicle_registry (id, plate_number, vehicle_type, owner_name, company, status, is_active, created_at, updated_at)
                            VALUES (:id, :plate_number, :vehicle_type, :owner_name, :company, :status, true, :now, :now)
                            ON CONFLICT DO NOTHING
                        """), {**v, "id": uuid.uuid4(), "now": now})
                logger.info(f"Seeded {len(VEHICLES)} vehicles")
            except Exception as e:
                logger.warning(f"Skipped vehicles: {e}")

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
            try:
                async with db.begin_nested():
                    for batch in BATCHES:
                        await db.execute(text("""
                            INSERT INTO depot_inventory_batches (id, product_name, batch_number, quantity, zone, rack, bin_location, manufacturing_date, expiry_date, rule_type, status, priority_score, created_at, updated_at)
                            VALUES (:id, :product_name, :batch_number, :quantity, :zone, :rack, :bin_location, :mfg, :exp, :rule_type, 'active', 0.0, :now, :now)
                            ON CONFLICT DO NOTHING
                        """), {
                            "id": uuid.uuid4(), "product_name": batch["product_name"],
                            "batch_number": batch["batch_number"], "quantity": batch["quantity"],
                            "zone": batch["zone"], "rack": batch["rack"], "bin_location": batch["bin_location"],
                            "mfg": batch["manufacturing_date"], "exp": batch["expiry_date"],
                            "rule_type": batch["rule_type"], "now": now,
                        })
                logger.info(f"Seeded {len(BATCHES)} inventory batches")
            except Exception as e:
                logger.warning(f"Skipped inventory batches: {e}")

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

            # ── Dashboard User (for legacy HTML auth) ──
            from passlib.context import CryptContext
            pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
            dash_email = "dashboard@intelli.ai"
            dash_pass = pwd_ctx.hash("DashboardOps2026!")
            existing = await db.execute(text("SELECT id FROM users WHERE email = :e"), {"e": dash_email})
            if not existing.scalar_one_or_none():
                await db.execute(text("""
                    INSERT INTO users (id, email, hashed_password, full_name, is_active, is_superuser, account_type, failed_login_attempts, mfa_enabled, email_verified, created_at, updated_at)
                    VALUES (:id, :email, :pw, 'Dashboard Operator', true, false, 'platform_user', 0, false, true, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {"id": uuid.uuid4(), "email": dash_email, "pw": dash_pass, "now": now})
                logger.info("Seeded dashboard user: dashboard@intelli.ai")
            else:
                logger.info("Dashboard user already exists")

            # ── Fleet Dock Slots ──
            dock_slots = [
                {"dock_id": "DOCK-A1", "dock_name": "Dock A1", "zone": "dock_area", "dock_type": "standard", "capacity_tonnes": 25.0},
                {"dock_id": "DOCK-A2", "dock_name": "Dock A2", "zone": "dock_area", "dock_type": "standard", "capacity_tonnes": 25.0},
                {"dock_id": "DOCK-B1", "dock_name": "Dock B1", "zone": "dock_area", "dock_type": "refrigerated", "capacity_tonnes": 15.0},
                {"dock_id": "DOCK-B2", "dock_name": "Dock B2", "zone": "dock_area", "dock_type": "refrigerated", "capacity_tonnes": 15.0},
                {"dock_id": "DOCK-C1", "dock_name": "Dock C1", "zone": "dock_area", "dock_type": "heavy", "capacity_tonnes": 40.0},
                {"dock_id": "DOCK-C2", "dock_name": "Dock C2", "zone": "dock_area", "dock_type": "standard", "capacity_tonnes": 25.0},
            ]
            dock_ids = []
            for ds in dock_slots:
                did = uuid.uuid4()
                dock_ids.append({"id": did, "dock_id": ds["dock_id"]})
                await db.execute(text("""
                    INSERT INTO ops_dock_slots (id, dock_id, dock_name, zone, dock_type, capacity_tonnes, status, x_position, y_position, created_at, updated_at)
                    VALUES (:id, :dock_id, :dock_name, :zone, :dock_type, :cap, 'free', 0, 0, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {**ds, "id": did, "cap": ds["capacity_tonnes"], "now": now})
            logger.info(f"Seeded {len(dock_slots)} dock slots")

            # ── Fleet Vehicles (ops_vehicles — different from gate vehicles) ──
            fleet_vehicles = [
                {"vehicle_id": "TN-04-AB-1234", "plate_number": "TN-04-AB-1234", "vehicle_type": "truck_20ft", "status": "at_dock", "current_zone": "dock_area", "assigned_dock": "DOCK-A1"},
                {"vehicle_id": "MH-12-CD-5678", "plate_number": "MH-12-CD-5678", "vehicle_type": "truck_40ft", "status": "in_yard", "current_zone": "staging_area", "assigned_dock": None},
                {"vehicle_id": "DL-01-EF-9012", "plate_number": "DL-01-EF-9012", "vehicle_type": "truck_20ft", "status": "at_dock", "current_zone": "dock_area", "assigned_dock": "DOCK-B1"},
                {"vehicle_id": "KA-03-GH-3456", "plate_number": "KA-03-GH-3456", "vehicle_type": "refrigerated", "status": "in_yard", "current_zone": "parking_yard", "assigned_dock": None},
                {"vehicle_id": "GJ-06-IJ-7890", "plate_number": "GJ-06-IJ-7890", "vehicle_type": "truck_40ft", "status": "at_gate", "current_zone": "inbound_gate", "assigned_dock": None},
                {"vehicle_id": "RJ-14-KL-2345", "plate_number": "RJ-14-KL-2345", "vehicle_type": "truck_20ft", "status": "at_dock", "current_zone": "dock_area", "assigned_dock": "DOCK-C1"},
                {"vehicle_id": "AP-09-MN-6789", "plate_number": "AP-09-MN-6789", "vehicle_type": "refrigerated", "status": "in_yard", "current_zone": "cold_storage", "assigned_dock": None},
                {"vehicle_id": "UP-32-OP-1234", "plate_number": "UP-32-OP-1234", "vehicle_type": "truck_20ft", "status": "departed", "current_zone": "outbound_gate", "assigned_dock": None},
            ]
            for idx_fv, fv in enumerate(fleet_vehicles):
                yard_time = now - timedelta(minutes=[22, 45, 38, 67, 5, 55, 30, 2][idx_fv])
                await db.execute(text("""
                    INSERT INTO ops_vehicles (id, vehicle_id, vehicle_type, status, current_zone, assigned_dock, entered_yard_at, last_gps_at, latitude, longitude, created_at, updated_at)
                    VALUES (:id, :vid, :vtype, :status, :zone, :dock, :yard_at, :now, :lat, :lng, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {
                    "id": uuid.uuid4(), "vid": fv["vehicle_id"],
                    "vtype": fv["vehicle_type"], "status": fv["status"], "zone": fv["current_zone"],
                    "dock": fv["assigned_dock"], "yard_at": yard_time, "now": now,
                    "lat": 12.97 + (idx_fv * 0.005),
                    "lng": 77.59 + (idx_fv * 0.003),
                })
            logger.info(f"Seeded {len(fleet_vehicles)} fleet vehicles")

            # Mark occupied docks
            for fv in fleet_vehicles:
                if fv["assigned_dock"]:
                    await db.execute(text("""
                        UPDATE ops_dock_slots SET status = 'occupied', assigned_vehicle_id = :vid
                        WHERE dock_id = :dock_id
                    """), {"vid": fv["vehicle_id"], "dock_id": fv["assigned_dock"]})

            # ── Dwell Records ──
            for i, fv in enumerate(fleet_vehicles[:5]):
                dwell_mins = [22, 45, 38, 67, 5][i]
                alert_lvl = "critical" if dwell_mins > 60 else "warning" if dwell_mins > 30 else "normal"
                await db.execute(text("""
                    INSERT INTO ops_dwell_records (id, vehicle_id, zone, entered_at, dwell_minutes, alert_level, created_at, updated_at)
                    VALUES (:id, :vid, :zone, :checkin, :dwell, :alert, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {
                    "id": uuid.uuid4(), "vid": fv["vehicle_id"], "zone": fv["current_zone"],
                    "checkin": now - timedelta(minutes=dwell_mins), "dwell": dwell_mins,
                    "alert": alert_lvl, "now": now,
                })
            logger.info("Seeded 5 dwell records")

            # ── Incidents ──
            incidents = [
                {"title": "Unauthorized entry at Gate 4 perimeter", "description": "Person detected in restricted zone after hours. Camera CAM-042 triggered alert.", "source": "camera", "priority": "P1", "severity_score": 0.95, "status": "open", "zone": "Gate 4 Perimeter", "category": "security"},
                {"title": "Damaged bags during unloading Zone C", "description": "5 bags torn during truck unloading at Bay 4. Estimated loss ₹4,200.", "source": "manual", "priority": "P2", "severity_score": 0.75, "status": "open", "zone": "Zone C Bay 4", "category": "damage"},
                {"title": "Count mismatch in Cluster B-09", "description": "Physical count shows -5 bags vs ERP record for batch B2025-1021.", "source": "counting", "priority": "P2", "severity_score": 0.70, "status": "acknowledged", "zone": "Cluster B-09", "category": "inventory"},
                {"title": "SLA breach risk — Dock B queue", "description": "Truck queue at Dock B exceeded 30-minute SLA window.", "source": "sla_breach", "priority": "P3", "severity_score": 0.55, "status": "open", "zone": "Dock B", "category": "sla"},
                {"title": "Cold storage temperature spike", "description": "Temperature exceeded 4°C threshold in Zone C cold storage.", "source": "sensor", "priority": "P3", "severity_score": 0.50, "status": "open", "zone": "Zone C Cold Storage", "category": "environment"},
                {"title": "Forklift collision near Zone A", "description": "Minor collision between forklift and pallet stack. No injuries.", "source": "camera", "priority": "P1", "severity_score": 0.90, "status": "escalated", "zone": "Zone A", "category": "safety"},
            ]
            for j, inc in enumerate(incidents):
                inc_id = uuid.uuid4()
                created = now - timedelta(minutes=[8, 25, 62, 15, 45, 3][j])
                chain = [{"tier": "Shift Supervisor", "assigned_at": created.isoformat()}]
                if inc["status"] == "escalated":
                    chain.append({"tier": "Operations Manager", "assigned_at": (created + timedelta(minutes=5)).isoformat()})
                import json as _json
                await db.execute(text("""
                    INSERT INTO ops_incidents (id, title, description, source, priority, severity_score, status, zone, incident_type, escalation_level, escalation_chain, escalation_deadline, assigned_to, created_at, updated_at)
                    VALUES (:id, :title, :desc, :source, :priority, :sev, :status, :zone, :cat, :elevel, :echain, :deadline, :assigned, :created, :now)
                    ON CONFLICT DO NOTHING
                """), {
                    "id": inc_id, "title": inc["title"], "desc": inc["description"],
                    "source": inc["source"], "priority": inc["priority"], "sev": inc["severity_score"],
                    "status": inc["status"], "zone": inc["zone"], "cat": inc["category"],
                    "elevel": len(chain) - 1, "echain": _json.dumps(chain),
                    "deadline": created + timedelta(minutes={"P1": 5, "P2": 15, "P3": 60, "P4": 240}[inc["priority"]]),
                    "assigned": chain[-1]["tier"], "created": created, "now": now,
                })
            logger.info(f"Seeded {len(incidents)} incidents")

            # ── Monitoring Events + Alerts (so Live Monitoring has data) ──
            event_types = ["sensor", "camera", "gate", "security", "equipment"]
            severities = ["critical", "high", "medium", "low", "info"]
            zones = ["Zone-A", "Zone-B", "Zone-C", "Entry Gate", "Loading Dock", "Perimeter"]
            for i in range(12):
                eid = uuid.uuid4()
                ev_sev = severities[i % 5]
                ev_zone = zones[i % 6]
                ev_time = now - timedelta(minutes=i * 8)
                await db.execute(text("""
                    INSERT INTO ops_sensor_events (id, event_type, source_id, source_name, zone, severity, value, unit, message, timestamp, processed, created_at, updated_at)
                    VALUES (:id, :etype, :src_id, :src_name, :zone, :sev, :val, :unit, :msg, :ts, false, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {
                    "id": eid, "etype": event_types[i % 5], "src_id": f"SRC-{i:03d}",
                    "src_name": f"Sensor-{i+1}", "zone": ev_zone, "sev": ev_sev,
                    "val": [38.5, 72.0, 1.0, 3.2, 101.5, 45.0, 0.0, 8.1, 0.5, 2.0, 39.0, 65.0][i],
                    "unit": ["°C", "%RH", "bool", "mm/s", "kPa"][i % 5],
                    "msg": f"Seed event {i+1} for demo", "ts": ev_time, "now": now,
                })
            logger.info("Seeded 12 sensor events")

            # Alerts from those events
            alert_statuses = ["active", "active", "acknowledged", "active", "resolved"]
            for i in range(5):
                await db.execute(text("""
                    INSERT INTO ops_alert_queue (id, alert_type, severity, priority_score, source_id, source_name, zone, title, message, status, timestamp, created_at, updated_at)
                    VALUES (:id, :atype, :sev, :score, :src_id, :src_name, :zone, :title, :msg, :status, :ts, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {
                    "id": uuid.uuid4(), "atype": event_types[i],
                    "src_id": f"SRC-{i:03d}", "src_name": f"Sensor-{i+1}",
                    "zone": zones[i], "sev": severities[i],
                    "title": ["Critical temperature in Zone-A", "Unauthorized motion Zone-B", "Gate sensor anomaly", "Perimeter vibration alert", "Equipment pressure warning"][i],
                    "msg": ["Temperature 38.5°C exceeds 35°C threshold", "Motion detected after hours in Zone-B", "Gate A sensor malfunction detected", "Vibration spike 3.2mm/s in Perimeter", "Pressure drop to 101.5kPa in equipment"][i],
                    "score": [100, 75, 50, 75, 25][i],
                    "status": alert_statuses[i],
                    "ts": now - timedelta(minutes=i * 12),
                    "now": now,
                })
            logger.info("Seeded 5 monitoring alerts")

            # ── Sequencing Batches (fixed columns) ──
            try:
                async with db.begin_nested():
                    seq_batches = [
                        {"sku_code": "CEM-53", "product_name": "OPC Cement 53 Grade", "zone": "A", "rack": "A-01", "bin_location": "A-01-L1", "quantity": 498, "rule": "FIFO", "days": 365},
                        {"sku_code": "FERT-DAP", "product_name": "DAP Fertilizer 50kg", "zone": "A", "rack": "A-03", "bin_location": "A-03-L2", "quantity": 320, "rule": "FEFO", "days": 180},
                        {"sku_code": "CHEM-H2SO4", "product_name": "Sulfuric Acid Drums", "zone": "C", "rack": "C-01", "bin_location": "C-01-L1", "quantity": 50, "rule": "FIFO", "days": 730},
                        {"sku_code": "STEEL-TMT", "product_name": "TMT Steel Bars 12mm", "zone": "B", "rack": "B-05", "bin_location": "B-05-L3", "quantity": 1200, "rule": "FIFO", "days": 9999},
                        {"sku_code": "RICE-BAS", "product_name": "Basmati Rice 25kg", "zone": "D", "rack": "D-02", "bin_location": "D-02-L1", "quantity": 800, "rule": "FEFO", "days": 365},
                    ]
                    for sb in seq_batches:
                        mfg = now - timedelta(days=30)
                        exp = now + timedelta(days=sb["days"])
                        days_to = sb["days"]
                        await db.execute(text("""
                            INSERT INTO depot_inventory_batches (id, batch_code, sku_code, product_name, zone, rack, bin_location, quantity, original_quantity, manufacture_date, expiry_date, received_at, sequencing_rule, priority_score, status, is_near_expiry, days_to_expiry, created_at, updated_at)
                            VALUES (:id, :batch_code, :sku, :name, :zone, :rack, :bin, :qty, :qty, :mfg, :exp, :now, :rule, 0.0, 'active', :near, :days, :now, :now)
                            ON CONFLICT DO NOTHING
                        """), {
                            "id": uuid.uuid4(), "batch_code": f"B2026-{sb['sku_code']}", "sku": sb["sku_code"], "name": sb["product_name"],
                            "zone": sb["zone"], "rack": sb["rack"], "bin": sb["bin_location"],
                            "qty": sb["quantity"], "mfg": mfg, "exp": exp,
                            "rule": sb["rule"], "near": days_to < 60, "days": days_to, "now": now,
                        })
                logger.info(f"Seeded {len(seq_batches)} sequencing batches")
            except Exception as e:
                logger.warning(f"Skipped sequencing batches: {e}")

            # ── Scorecard Entries ──
            try:
                async with db.begin_nested():
                    iso_week = now.strftime("%G-W%V")
                    scorecards = [
                        {"group_name": "Live Monitoring", "total": 12, "compliant": 12, "at_risk": 0, "breached": 0, "penalty": 0},
                        {"group_name": "SLA Tracking", "total": 18, "compliant": 15, "at_risk": 2, "breached": 1, "penalty": 1500},
                    ]
                    for sc in scorecards:
                        comp_pct = round(sc["compliant"] / sc["total"] * 100, 1) if sc["total"] > 0 else 100
                        await db.execute(text("""
                            INSERT INTO ops_scorecard_entries (id, period, group_type, group_name, total_slas, compliant, at_risk, breached, compliance_pct, penalty_amount, currency, created_at, updated_at)
                            VALUES (:id, :period, 'module', :gn, :total, :comp, :ar, :br, :pct, :pen, 'USD', :now, :now)
                            ON CONFLICT DO NOTHING
                        """), {
                            "id": uuid.uuid4(), "period": iso_week, "gn": sc["group_name"],
                            "total": sc["total"], "comp": sc["compliant"], "ar": sc["at_risk"],
                            "br": sc["breached"], "pct": comp_pct, "pen": sc["penalty"], "now": now,
                        })
                logger.info(f"Seeded {len(scorecards)} scorecard entries")
            except Exception as e:
                logger.warning(f"Skipped scorecard entries: {e}")

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
            print(f"  • {len(dock_slots)} dock slots")
            print(f"  • {len(fleet_vehicles)} fleet vehicles + 5 dwell records")
            print(f"  • {len(incidents)} incidents")
            print(f"  • 12 sensor events + 5 alerts")
            print(f"  • 1 dashboard user")

        except Exception as e:
            await db.rollback()
            logger.error(f"Seed failed: {e}")
            print(f"\n✗ Seed failed: {e}")
            raise


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_database())
