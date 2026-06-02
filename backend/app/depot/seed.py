"""
IntelliVision Depot — Data Seed Script

Seeds the database with realistic warehouse demo data:
- 6 cameras (different zones)
- 3 gates (entry, exit, loading)
- 10 vehicles (mix of approved, pending, blacklisted)
- 5 visitors
- 6 perimeter zones (restricted, hazardous, loading, general)
- Detection model (trained cement-bag model)
- 4 cluster zones with occupancy
- 3 shipment manifests with count sessions
- 2 sequencing configs (FIFO, FEFO)
- 5 inventory batches

Run: python -m app.depot.seed
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta, date

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.depot.storage_truth import cluster_zones_for_seed

logger = logging.getLogger("intelli.depot.seed")


def add_months(value: date, months: int) -> date:
    month = value.month - 1 + months
    year = value.year + month // 12
    month = month % 12 + 1
    days_in_month = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return date(year, month, min(value.day, days_in_month[month - 1]))


# ---------------------------------------------------------------------------
# Seed data definitions
# ---------------------------------------------------------------------------

CAMERAS = [
    # Local depot videos — real warehouse CCTV recordings from depot pendrive
    # stream_url uses "local:{filename}" prefix; video_library.py serves frames
    {"name": "BLR-W01-Gate1-Entry",        "stream_url": "local:dtranshipment 1 (2).mp4",                "zone": "BLR-Z1", "frame_rate": 25, "resolution": "854x480"},  # Transhipment area
    {"name": "BLR-W01-Cluster1-Overhead",  "stream_url": "local:cluster 13 (1).mp4",                     "zone": "BLR-Z1", "frame_rate": 25, "resolution": "854x480"},  # Cluster 13 storage
    {"name": "BLR-W01-LoadingBay1-4",      "stream_url": "local:cluster 4-5 (1).mp4",                    "zone": "BLR-Z2", "frame_rate": 25, "resolution": "854x480"},  # Cluster 4-5 bay
    {"name": "BLR-W01-Cluster3-Perimeter", "stream_url": "local:Recording 2025-07-30 115417.mp4",        "zone": "BLR-Z3", "frame_rate": 25, "resolution": "854x480"},  # Depot perimeter
    {"name": "BLR-W01-Gate2-Exit",         "stream_url": "local:Recording 2025-08-11 171805.mp4",        "zone": "BLR-Z4", "frame_rate": 25, "resolution": "854x480"},  # Exit gate ops
    {"name": "BLR-W01-Yard-Overview",      "stream_url": "local:Screen Recording 2025-08-11 174929.mp4", "zone": "BLR-Z4", "frame_rate": 25, "resolution": "854x480"},  # Yard overview
]

GATES = [
    {"name": "Gate A — North Entry", "gate_type": "entry"},
    {"name": "Gate B — South Exit", "gate_type": "exit"},
    {"name": "Gate C — Loading Dock", "gate_type": "loading"},
]

VEHICLES = [
    {"plate_number": "TN-04-AB-1234", "vehicle_type": "truck", "owner_name": "Rajesh Kumar", "company": "TransCargo India", "status": "approved", "footage_url": "https://via.placeholder.com/800x600/1E2F50/E8EDF8?text=TN-04-AB-1234"},
    {"plate_number": "MH-12-CD-5678", "vehicle_type": "truck", "owner_name": "Suresh Patel", "company": "BlueLine Logistics", "status": "approved", "footage_url": "https://via.placeholder.com/800x600/1E2F50/E8EDF8?text=MH-12-CD-5678"},
    {"plate_number": "GJ-05-EF-9012", "vehicle_type": "truck", "owner_name": "Amit Shah", "company": "Gujarat Transport", "status": "approved", "footage_url": "https://via.placeholder.com/800x600/1E2F50/E8EDF8?text=GJ-05-EF-9012"},
    {"plate_number": "DL-03-GH-3456", "vehicle_type": "container", "owner_name": "Vikram Singh", "company": "Delhi Freight Corp", "status": "approved", "footage_url": "https://via.placeholder.com/800x600/1E2F50/E8EDF8?text=DL-03-GH-3456"},
    {"plate_number": "RJ-14-IJ-7890", "vehicle_type": "truck", "owner_name": "Mohan Joshi", "company": "Rajasthan Cargo", "status": "approved", "footage_url": "https://via.placeholder.com/800x600/1E2F50/E8EDF8?text=RJ-14-IJ-7890"},
    {"plate_number": "KA-01-KL-2345", "vehicle_type": "tanker", "owner_name": "Prasad Rao", "company": "Southern Transport", "status": "approved", "footage_url": "https://via.placeholder.com/800x600/1E2F50/E8EDF8?text=KA-01-KL-2345"},
    {"plate_number": "AP-09-MN-6789", "vehicle_type": "van", "owner_name": "Ravi Teja", "company": "QuickShip", "status": "pending", "footage_url": "https://via.placeholder.com/800x600/1E2F50/E8EDF8?text=AP-09-MN-6789"},
    {"plate_number": "UP-80-OP-0123", "vehicle_type": "truck", "owner_name": "Anil Gupta", "company": "UP Movers", "status": "pending", "footage_url": "https://via.placeholder.com/800x600/1E2F50/E8EDF8?text=UP-80-OP-0123"},
    {"plate_number": "MH-01-QR-4567", "vehicle_type": "van", "owner_name": "Unknown", "company": "Unregistered", "status": "blacklisted", "footage_url": "https://via.placeholder.com/800x600/1E2F50/E8EDF8?text=MH-01-QR-4567"},
    {"plate_number": "DL-10-ST-8901", "vehicle_type": "truck", "owner_name": "Suspicious", "company": "N/A", "status": "blacklisted", "footage_url": "https://via.placeholder.com/800x600/1E2F50/E8EDF8?text=DL-10-ST-8901"},
    {"plate_number": "KA03NP0051", "vehicle_type": "SUV", "owner_name": "Mercedes GLS 400d", "company": "Vehicle Registry", "status": "registered", "footage_url": "/vehicles/registry/KA03NP0051.png"},
    {"plate_number": "KL21L7408", "vehicle_type": "Hatchback", "owner_name": "Suzuki Alto", "company": "Vehicle Registry", "status": "registered", "footage_url": "/vehicles/registry/KL21L7408.png"},
    {"plate_number": "KL56S6087", "vehicle_type": "Hatchback", "owner_name": "Suzuki Swift", "company": "Vehicle Registry", "status": "registered", "footage_url": "/vehicles/registry/KL56S6087.png"},
    {"plate_number": "DL1CQ1199", "vehicle_type": "Sedan", "owner_name": "BMW 520d", "company": "Vehicle Registry", "status": "registered", "footage_url": "/vehicles/registry/DL1CQ1199.png"},
]

GATE_ACCESS_LOGS = [
    {"gate_code": "GATE-A", "plate_number": "KA01AB1234", "direction": "entry", "decision": "granted", "denied_reason": None, "minutes_ago": 260},
    {"gate_code": "GATE-A", "plate_number": "DL03EF9012", "direction": "entry", "decision": "granted", "denied_reason": None, "minutes_ago": 256},
    {"gate_code": "GATE-A", "plate_number": "MH02CD5678", "direction": "entry", "decision": "granted", "denied_reason": None, "minutes_ago": 256},
    {"gate_code": "GATE-B", "plate_number": "RJ-14-IJ-7890", "direction": "exit", "decision": "granted", "denied_reason": None, "minutes_ago": 250},
    {"gate_code": "GATE-C", "plate_number": "TN04GH3456", "direction": "exit", "decision": "granted", "denied_reason": None, "minutes_ago": 243},
]

VISITORS = [
    {"name": "Rajesh Kumar", "company": "Tech Solutions Pvt Ltd", "purpose": "Client meeting", "contact_number": "+91-9876543210", "host_name": "Priya Sharma", "vehicle_plate": "KA01AB1234"},
    {"name": "Ananya Reddy", "company": "Logistics Express", "purpose": "Delivery coordination", "contact_number": "+91-9123456789", "host_name": "Amit Patel", "vehicle_plate": "MH02CD5678"},
    {"name": "Vikram Singh", "company": "Safety Audit Services", "purpose": "Safety inspection", "contact_number": "+91-9988776655", "host_name": "Site Manager", "vehicle_plate": "DL03EF9012"},
    {"name": "Sunita Joshi", "company": "Consulting Group", "purpose": "Business consultation", "contact_number": "+91-9112233445", "host_name": "Operations Director", "vehicle_plate": "AP06KL2345"},
    {"name": "Karthik Menon", "company": "Equipment Maintenance Co", "purpose": "Equipment servicing", "contact_number": "+91-9556677889", "host_name": "Facility Manager", "vehicle_plate": "KA05IJ7890"},
]

PERIMETER_ZONES = [
    {"name": "Cold Storage", "zone_type": "controlled", "alert_severity": "high", "alert_on_entry": True},
    {"name": "Inbound Gate", "zone_type": "controlled", "alert_severity": "high", "alert_on_entry": True},
    {"name": "Staging Area", "zone_type": "controlled", "alert_severity": "high", "alert_on_entry": True},
    {"name": "Dispatch Bay", "zone_type": "controlled", "alert_severity": "high", "alert_on_entry": True},
]

CLUSTER_ZONES = cluster_zones_for_seed("WH_BLR")

MANIFESTS = [
    {"manifest_code": "MF-2026-0412", "vehicle_number": "TN-04-AB-1234", "expected_bags": 500, "expected_boxes": 50},
    {"manifest_code": "MF-2026-0413", "vehicle_number": "MH-12-CD-5678", "expected_bags": 300, "expected_boxes": 0},
    {"manifest_code": "MF-2026-0414", "vehicle_number": "GJ-05-EF-9012", "expected_bags": 200, "expected_boxes": 100},
]

DETECTION_MODEL = {
    "model_name": "cement-bags-custom",
    "model_version": "2025-05-29",
    "weights_path": os.getenv(
        "YOLO_WEIGHTS",
        r"C:\Users\karte\OneDrive - Fidelis Technology Services Pvt Ltd\Desktop\intelli-platform\best_cement_bags_2025-05-29.pt",
    ),
    "confidence_threshold": 0.25,
    "iou_threshold": 0.45,
    "target_classes": "bag,vehicle",
    "description": "Custom trained cement bag and yard vehicle detector",
}

BATCHES = [
    # Zone A batches: mixed full, partial, and empty stock levels.
    {"sku_id": "SKU-CEM-01", "product_name": "UltraTech Cement", "batch_number": "B2026-1022", "quantity": 490, "capacity": 500, "zone": "A", "rack": "A-01", "bin_location": "A-01-L1", "manufacturing_date": date(2026, 1, 15), "expiry_date": date(2026, 4, 15), "rule_type": "FIFO"},
    {"sku_id": "SKU-CEM-02", "product_name": "ACC Cement", "batch_number": "B2026-1019", "quantity": 160, "capacity": 320, "zone": "A", "rack": "A-02", "bin_location": "A-02-L1", "manufacturing_date": date(2026, 2, 1), "expiry_date": date(2026, 5, 1), "rule_type": "FIFO"},
    # Zone B batches.
    {"sku_id": "SKU-CEM-03", "product_name": "ACC Cement", "batch_number": "B2026-1021", "quantity": 450, "capacity": 450, "zone": "B", "rack": "B-02", "bin_location": "B-02-L2", "manufacturing_date": date(2026, 1, 10), "expiry_date": date(2026, 4, 10), "rule_type": "FEFO"},
    # Zone C batches.
    {"sku_id": "SKU-CEM-04", "product_name": "JSW Cement", "batch_number": "B2026-1018", "quantity": 300, "capacity": 600, "zone": "C", "rack": "C-01", "bin_location": "C-01-L1", "manufacturing_date": date(2026, 1, 5), "expiry_date": date(2026, 4, 5), "rule_type": "FEFO"},
    # Zone D batches.
    {"sku_id": "SKU-CEM-05", "product_name": "Ambuja Cement", "batch_number": "B2026-1023", "quantity": 910, "capacity": 1000, "zone": "D", "rack": "D-01", "bin_location": "D-01-L1", "manufacturing_date": date(2026, 3, 1), "expiry_date": date(2026, 6, 1), "rule_type": "FIFO"},
    # Additional batches for more data
    {"sku_id": "SKU-CEM-06", "product_name": "UltraTech Cement", "batch_number": "B2026-1024", "quantity": 0, "capacity": 250, "zone": "A", "rack": "A-03", "bin_location": "A-03-L1", "manufacturing_date": date(2026, 1, 20), "expiry_date": date(2026, 4, 20), "rule_type": "FIFO"},
    {"sku_id": "SKU-CEM-07", "product_name": "ACC Cement", "batch_number": "B2026-1025", "quantity": 90, "capacity": 180, "zone": "B", "rack": "B-03", "bin_location": "B-03-L1", "manufacturing_date": date(2026, 1, 8), "expiry_date": date(2026, 4, 8), "rule_type": "FEFO"},
    {"sku_id": "SKU-CEM-08", "product_name": "JSW Cement", "batch_number": "B2026-1026", "quantity": 420, "capacity": 420, "zone": "C", "rack": "C-02", "bin_location": "C-02-L1", "manufacturing_date": date(2026, 1, 3), "expiry_date": date(2026, 4, 3), "rule_type": "FIFO"},
    {"sku_id": "SKU-CEM-09", "product_name": "Ambuja Cement", "batch_number": "B2026-1027", "quantity": 175, "capacity": 350, "zone": "D", "rack": "D-02", "bin_location": "D-02-L1", "manufacturing_date": date(2026, 2, 15), "expiry_date": date(2026, 5, 15), "rule_type": "FIFO"},
    {"sku_id": "SKU-CEM-10", "product_name": "UltraTech Cement", "batch_number": "B2026-1028", "quantity": 145, "capacity": 290, "zone": "A", "rack": "A-04", "bin_location": "A-04-L1", "manufacturing_date": date(2026, 1, 5), "expiry_date": date(2026, 4, 5), "rule_type": "FIFO"},
    {"sku_id": "SKU-CEM-11", "product_name": "ACC Cement", "batch_number": "B2026-1029", "quantity": 220, "capacity": 220, "zone": "B", "rack": "B-04", "bin_location": "B-04-L1", "manufacturing_date": date(2026, 1, 12), "expiry_date": date(2026, 4, 12), "rule_type": "FEFO"},
    {"sku_id": "SKU-CEM-12", "product_name": "JSW Cement", "batch_number": "B2026-1030", "quantity": 190, "capacity": 380, "zone": "C", "rack": "C-03", "bin_location": "C-03-L1", "manufacturing_date": date(2026, 1, 7), "expiry_date": date(2026, 4, 7), "rule_type": "FEFO"},
    {"sku_id": "SKU-CEM-13", "product_name": "Ambuja Cement", "batch_number": "B2026-1031", "quantity": 460, "capacity": 460, "zone": "D", "rack": "D-03", "bin_location": "D-03-L1", "manufacturing_date": date(2026, 3, 10), "expiry_date": date(2026, 6, 10), "rule_type": "FIFO"},
    {"sku_id": "SKU-CEM-14", "product_name": "UltraTech Cement", "batch_number": "B2026-1032", "quantity": 0, "capacity": 310, "zone": "A", "rack": "A-05", "bin_location": "A-05-L1", "manufacturing_date": date(2026, 1, 25), "expiry_date": date(2026, 4, 25), "rule_type": "FIFO"},
    {"sku_id": "SKU-CEM-15", "product_name": "ACC Cement", "batch_number": "B2026-1033", "quantity": 135, "capacity": 270, "zone": "B", "rack": "B-05", "bin_location": "B-05-L1", "manufacturing_date": date(2026, 1, 9), "expiry_date": date(2026, 4, 9), "rule_type": "FEFO"},
]

DEMO_USERS = [
    {"email": "wm.blr@fidelis-demo.com", "full_name": "Warehouse Manager - Bengaluru", "password": "Depot!26", "is_superuser": False},
    {"email": "wm.hyd@fidelis-demo.com", "full_name": "Warehouse Manager - Hyderabad", "password": "Depot!26", "is_superuser": False},
    {"email": "wm.mum@fidelis-demo.com", "full_name": "Warehouse Manager - Mumbai", "password": "Depot!26", "is_superuser": False},
    {"email": "regional@fidelis-demo.com", "full_name": "Regional Manager - India", "password": "Depot!26", "is_superuser": False},
    {"email": "admin@fidelis-demo.com", "full_name": "Platform Admin", "password": "Depot!26", "is_superuser": True},
]


# ---------------------------------------------------------------------------
# Seed runner
# ---------------------------------------------------------------------------

async def seed_database(db_url: str | None = None):
    """Seed the depot database with demo data."""
    if db_url is None:
        db_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://intelli:intelli@localhost:5432/intelli")
    is_sqlite = db_url.startswith("sqlite")

    def new_id():
        value = uuid.uuid4()
        return str(value) if is_sqlite else value

    engine = create_async_engine(db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        try:
            now = datetime.now(timezone.utc)
            seed_user = "seed-script"

            # ── Cameras ──
            camera_ids = []
            for cam in CAMERAS:
                cid = new_id()
                camera_ids.append(cid)
                await db.execute(text("""
                    UPDATE depot_cameras
                    SET stream_url = :stream_url,
                        protocol = 'rtsp',
                        zone = :zone,
                        status = 'active',
                        is_active = true,
                        frame_rate = :frame_rate,
                        resolution = :resolution,
                        updated_at = :now
                    WHERE name = :name
                """), {**cam, "now": now})
                await db.execute(text("""
                    INSERT INTO depot_cameras (id, name, stream_url, protocol, zone, status, is_active, frame_rate, resolution, created_at, updated_at)
                    SELECT :id, CAST(:name AS VARCHAR), :stream_url, 'rtsp', :zone, 'active', true, :frame_rate, :resolution, :now, :now
                    WHERE NOT EXISTS (
                        SELECT 1 FROM depot_cameras WHERE name = CAST(:name AS VARCHAR)
                    )
                """), {**cam, "id": cid, "now": now})
            logger.info(f"Seeded {len(CAMERAS)} cameras")

            # ── Gates ──
            gate_ids = []
            for i, gate in enumerate(GATES):
                gid = new_id()
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
                        """), {**v, "id": new_id(), "now": now})
                logger.info(f"Seeded {len(VEHICLES)} vehicles")
            except Exception as e:
                logger.warning(f"Skipped vehicles: {e}")

            for log in GATE_ACCESS_LOGS:
                gate_row = await db.execute(text("""
                    SELECT id
                    FROM depot_gates
                    WHERE gate_code = :gate_code
                    LIMIT 1
                """), {"gate_code": log["gate_code"]})
                gate_id = gate_row.scalar_one_or_none()

                vehicle_row = await db.execute(text("""
                    SELECT id
                    FROM depot_vehicle_registry
                    WHERE plate_number = :plate_number
                    LIMIT 1
                """), {"plate_number": log["plate_number"]})
                vehicle_id = vehicle_row.scalar_one_or_none()

                if not gate_id:
                    continue

                event_time = now - timedelta(minutes=log["minutes_ago"])
                await db.execute(text("""
                    INSERT INTO depot_gate_access_logs
                      (id, gate_id, gate_code, plate_number, plate_confidence, vehicle_id,
                       decision, direction, snapshot_ref, denied_reason, processed_at,
                       created_at, updated_at)
                    SELECT :id, :gate_id, CAST(:gate_code AS varchar), CAST(:plate_number AS varchar), :plate_confidence, :vehicle_id,
                           CAST(:decision AS varchar), CAST(:direction AS varchar), CAST(:snapshot_ref AS varchar), CAST(:denied_reason AS varchar), :processed_at,
                           :created_at, :updated_at
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM depot_gate_access_logs
                        WHERE plate_number = CAST(:plate_number AS varchar)
                          AND gate_code = CAST(:gate_code AS varchar)
                          AND direction = CAST(:direction AS varchar)
                    )
                """), {
                    "id": new_id(),
                    "gate_id": gate_id,
                    "gate_code": log["gate_code"],
                    "plate_number": log["plate_number"],
                    "plate_confidence": 0.95,
                    "vehicle_id": vehicle_id,
                    "decision": log["decision"],
                    "direction": log["direction"],
                    "snapshot_ref": f"seed://gate/{log['plate_number']}",
                    "denied_reason": log["denied_reason"],
                    "processed_at": event_time,
                    "created_at": event_time,
                    "updated_at": event_time,
                })
            logger.info(f"Seeded {len(GATE_ACCESS_LOGS)} gate access logs")

            # ── Visitors ──
            for vis in VISITORS:
                await db.execute(text("""
                    INSERT INTO depot_visitors
                      (id, name, company, purpose, contact_number, host_name, vehicle_plate,
                       status, checked_in_at, pass_valid_until, registered_by, created_at, updated_at)
                    SELECT :id,
                           CAST(:name AS varchar),
                           CAST(:company AS varchar),
                           CAST(:purpose AS varchar),
                           CAST(:contact_number AS varchar),
                           CAST(:host_name AS varchar),
                           CAST(:vehicle_plate AS varchar),
                           CAST('checked_in' AS varchar),
                           :now, :expiry, CAST(:user AS varchar), :now, :now
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM depot_visitors
                        WHERE name = CAST(:name AS varchar)
                          AND company = CAST(:company AS varchar)
                          AND status = CAST('checked_in' AS varchar)
                    )
                """), {**vis, "id": new_id(), "now": now, "expiry": now + timedelta(hours=8), "user": seed_user})
            logger.info(f"Seeded {len(VISITORS)} visitors")

            # ── Perimeter Zones ──
            pz_ids = []
            zone_refs = {}  # Dictionary to store zone references by name for later use
            for j, pz in enumerate(PERIMETER_ZONES):
                pzid = new_id()
                pz_ids.append(pzid)
                zone_refs[pz["name"]] = pzid  # Store zone ID by name
                cam_id = camera_ids[j % len(camera_ids)]
                await db.execute(text("""
                    INSERT INTO depot_perimeter_zones (id, name, zone_type, alert_severity, alert_on_entry, camera_id, is_active, night_vision_enabled, night_vision_mode, created_by, created_at, updated_at)
                    VALUES (:id, :name, :zone_type, :alert_severity, :alert_on_entry, :cam_id, true, true, 'auto', :user, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {**pz, "id": pzid, "cam_id": cam_id, "user": seed_user, "now": now})
            logger.info(f"Seeded {len(PERIMETER_ZONES)} perimeter zones with references: {list(zone_refs.keys())}")

            # ── Sample Breaches (5 breaches corresponding to 5 sample incidents) ──
            # Mapping: incident source → breach_type
            # perimeter → unauthorized_entry, alert → loitering, sensor → unknown, sla_breach → after_hours
            # Mapping: incident priority → severity
            # P1 → critical, P2 → high, P3 → medium, default → low
            
            sample_breaches = [
                {
                    "zone_name": "Inbound Gate",
                    "breach_type": "unauthorized_entry",  # perimeter source
                    "severity": "high",  # default (no priority specified)
                    "confidence": 0.92,
                    "video_ref": "Perimeter_Detection.mp4",
                    "notes": "LPR mismatch. Vehicle not in approved list.",
                    "detected_minutes_ago": 25
                },
                {
                    "zone_name": "Staging Area",
                    "breach_type": "loitering",  # alert source
                    "severity": "medium",  # default (no priority specified)
                    "confidence": 0.87,
                    "video_ref": "Theft Camera .mp4",
                    "notes": "Vehicle in staging area for 4h 30m. SLA threshold: 3h.",
                    "detected_minutes_ago": 62
                }
            ]
            
            for breach_data in sample_breaches:
                bid = new_id()
                # Get zone_id from zone_refs dictionary
                zone_id = zone_refs.get(breach_data["zone_name"])
                if zone_id is None:
                    logger.warning(f"Zone '{breach_data['zone_name']}' not found in zone_refs, skipping breach")
                    continue
                
                # Select camera based on zone
                cam_id = camera_ids[list(zone_refs.keys()).index(breach_data["zone_name"]) % len(camera_ids)]
                
                await db.execute(text("""
                    INSERT INTO depot_perimeter_breaches (id, zone_id, camera_id, breach_type, severity, confidence, snapshot_ref, alert_sent, notes, detected_at, created_at, updated_at)
                    VALUES (:id, :zone_id, :cam_id, :breach_type, :severity, :confidence, :snapshot, true, :notes, :detected_at, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {
                    "id": bid,
                    "zone_id": zone_id,
                    "cam_id": cam_id,
                    "breach_type": breach_data["breach_type"],
                    "severity": breach_data["severity"],
                    "confidence": breach_data["confidence"],
                    "snapshot": breach_data["video_ref"],
                    "notes": breach_data["notes"],
                    "detected_at": now - timedelta(minutes=breach_data["detected_minutes_ago"]),
                    "now": now,
                })
            logger.info(f"Seeded {len(sample_breaches)} perimeter breaches corresponding to sample incidents")

            # ── Cluster Zones ──
            for cz in CLUSTER_ZONES:
                await db.execute(text("""
                    INSERT INTO depot_zones (id, zone_code, name, zone_type, floor, area_sqm, max_capacity_units, current_occupancy, utilization_pct, status, is_active, created_at, updated_at)
                    VALUES (:id, :zone_code, :name, :zone_type, :floor, :area_sqm, :max, :occ, :util, :status, true, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {
                    **cz, "id": new_id(),
                    "max": cz["max_capacity_units"],
                    "occ": cz["current_occupancy"],
                    "util": round(cz["current_occupancy"] / cz["max_capacity_units"] * 100, 1),
                    "status": "critical" if cz["current_occupancy"] / cz["max_capacity_units"] > 0.9 else "warning" if cz["current_occupancy"] / cz["max_capacity_units"] > 0.75 else "normal",
                    "now": now,
                })
            logger.info(f"Seeded {len(CLUSTER_ZONES)} cluster zones")

            # ── Detection Model ──
            await db.execute(text("""
                UPDATE depot_detection_models
                SET is_active = false, updated_at = :now
                WHERE model_name != :model_name OR model_version != :model_version
            """), {
                "model_name": DETECTION_MODEL["model_name"],
                "model_version": DETECTION_MODEL["model_version"],
                "now": now,
            })

            existing_model = await db.execute(text("""
                SELECT id FROM depot_detection_models
                WHERE model_name = :model_name AND model_version = :model_version
                LIMIT 1
            """), {
                "model_name": DETECTION_MODEL["model_name"],
                "model_version": DETECTION_MODEL["model_version"],
            })
            existing_model_id = existing_model.scalar_one_or_none()

            if existing_model_id:
                await db.execute(text("""
                    UPDATE depot_detection_models
                    SET weights_path = :weights_path,
                        confidence_threshold = :confidence_threshold,
                        iou_threshold = :iou_threshold,
                        target_classes = :target_classes,
                        description = :description,
                        is_active = true,
                        updated_at = :now
                    WHERE id = :id
                """), {
                    **DETECTION_MODEL,
                    "id": existing_model_id,
                    "now": now,
                })
            else:
                from app.depot.vision.detection import DetectionModel as DetectionModelORM

                db.add(DetectionModelORM(
                    model_name=DETECTION_MODEL["model_name"],
                    model_version=DETECTION_MODEL["model_version"],
                    weights_path=DETECTION_MODEL["weights_path"],
                    confidence_threshold=DETECTION_MODEL["confidence_threshold"],
                    iou_threshold=DETECTION_MODEL["iou_threshold"],
                    target_classes=DETECTION_MODEL["target_classes"],
                    description=DETECTION_MODEL["description"],
                    is_active=True,
                ))
            logger.info("Seeded detection model: cement-bags-custom")

            # ── Shipment Manifests ──
            for mf in MANIFESTS:
                await db.execute(text("""
                    INSERT INTO depot_shipment_manifests (id, manifest_code, vehicle_number, expected_bags, expected_boxes, status, created_at, updated_at)
                    VALUES (:id, :manifest_code, :vehicle_number, :expected_bags, :expected_boxes, 'active', :now, :now)
                    ON CONFLICT DO NOTHING
                """), {**mf, "id": new_id(), "now": now})
            logger.info(f"Seeded {len(MANIFESTS)} shipment manifests")

            # ── Inventory Batches ──
            # Vary batch creation timestamps across the replay window so
            # Vary batch creation timestamps across 2+ months so
            # heatmap date ranges show inventory building over time.
            batch_timestamps = [
                now - timedelta(days=62, hours=4),
                now - timedelta(days=55, hours=2),
                now - timedelta(days=49, hours=5),
                now - timedelta(days=43, hours=3),
                now - timedelta(days=38, hours=6),
                now - timedelta(days=33, hours=2),
                now - timedelta(days=28, hours=5),
                now - timedelta(days=24, hours=3),
                now - timedelta(days=20, hours=4),
                now - timedelta(days=16, hours=2),
                now - timedelta(days=12, hours=5),
                now - timedelta(days=9, hours=3),
                now - timedelta(days=6, hours=4),
                now - timedelta(days=3, hours=2),
                now - timedelta(days=1, hours=5),
            ]
            try:
                async with db.begin_nested():
                    for idx, batch in enumerate(BATCHES):
                        batch_time = batch_timestamps[idx] if idx < len(batch_timestamps) else now
                        await db.execute(text("""
                            INSERT INTO depot_inventory_batches (id, batch_code, sku_code, product_name, zone, rack, bin_location, quantity, original_quantity, manufacture_date, expiry_date, received_at, sequencing_rule, status, priority_score, is_near_expiry, created_at, updated_at)
                            VALUES (:id, :batch_code, :sku_code, :product_name, :zone, :rack, :bin_location, :quantity, :capacity, :mfg, :exp, :batch_time, :sequencing_rule, 'active', 0.0, false, :batch_time, :batch_time)
                            ON CONFLICT (batch_code) DO UPDATE SET
                                quantity = EXCLUDED.quantity,
                                original_quantity = EXCLUDED.original_quantity,
                                zone = EXCLUDED.zone,
                                rack = EXCLUDED.rack,
                                bin_location = EXCLUDED.bin_location,
                                manufacture_date = EXCLUDED.manufacture_date,
                                expiry_date = EXCLUDED.expiry_date,
                                received_at = EXCLUDED.received_at,
                                created_at = EXCLUDED.created_at,
                                status = EXCLUDED.status,
                                updated_at = EXCLUDED.updated_at
                        """), {
                            "id": new_id(), "product_name": batch["product_name"],
                            "batch_code": batch["batch_number"],
                            "sku_code": batch.get("sku_id", batch["batch_number"]),
                            "quantity": batch["quantity"],
                            "capacity": batch.get("capacity", batch["quantity"]),
                            "zone": batch["zone"], "rack": batch["rack"], "bin_location": batch["bin_location"],
                            "mfg": batch_time.date(), "exp": add_months(batch_time.date(), 6),
                            "sequencing_rule": batch["rule_type"], "batch_time": batch_time,
                        })
                logger.info(f"Seeded {len(BATCHES)} inventory batches")
            except Exception as e:
                logger.warning(f"Skipped inventory batches: {e}")

            try:
                zones_result = await db.execute(text("""
                    SELECT id, zone_code, max_capacity_units
                    FROM depot_zones
                    WHERE is_active = true
                    ORDER BY zone_code
                """))
                zone_rows = zones_result.mappings().all()

                batch_result = await db.execute(text("""
                    SELECT zone, quantity, original_quantity, received_at
                    FROM depot_inventory_batches
                    WHERE status = 'active' AND zone IS NOT NULL
                """))
                batch_rows = batch_result.mappings().all()

                await db.execute(text("""
                    DELETE FROM depot_zone_density_history
                    WHERE zone_id IN (
                        SELECT id FROM depot_zones WHERE is_active = true
                    )
                """))

                history_rows = 0
                for day_offset in range(60, -1, -1):
                    recorded_at = (now - timedelta(days=day_offset)).replace(hour=18, minute=0, second=0, microsecond=0)
                    for zone in zone_rows:
                        zone_code = zone["zone_code"]
                        zone_batches = [
                            batch for batch in batch_rows
                            if batch["zone"] == zone_code and batch["received_at"] <= recorded_at
                        ]
                        capacity = sum(int(batch["original_quantity"] or 0) for batch in zone_batches)
                        occupancy = sum(int(batch["quantity"] or 0) for batch in zone_batches)
                        if capacity <= 0:
                            capacity = int(zone["max_capacity_units"] or 0)
                            occupancy = 0
                        utilization = round((occupancy / capacity) * 100, 1) if capacity > 0 else 0.0
                        status = "critical" if utilization >= 95 else "warning" if utilization >= 80 else "normal"

                        await db.execute(text("""
                            INSERT INTO depot_zone_density_history
                                (id, zone_id, zone_code, occupancy, capacity, utilization_pct, status, recorded_at, created_at, updated_at)
                            VALUES
                                (:id, :zone_id, :zone_code, :occupancy, :capacity, :utilization_pct, :status, :recorded_at, :now, :now)
                        """), {
                            "id": new_id(),
                            "zone_id": zone["id"],
                            "zone_code": zone_code,
                            "occupancy": occupancy,
                            "capacity": capacity,
                            "utilization_pct": utilization,
                            "status": status,
                            "recorded_at": recorded_at,
                            "now": now,
                        })
                        history_rows += 1
                logger.info(f"Seeded {history_rows} daily density snapshots for date-range heatmap replay")
            except Exception as e:
                logger.warning(f"Skipped density history seed: {e}")

            # ── IntelliOps Tasks ──
            ops_tasks = [
                {"title": "Unload Truck TN-04-AB-1234", "worker_name": "Ramesh K.", "worker_id": "W-001", "area": "Zone C Bay 4", "zone": "Zone-C", "priority": "high",   "status": "in_progress"},
                {"title": "FIFO Compliance Check — Zone B", "worker_name": "Priya S.", "worker_id": "W-002", "area": "Zone B Clusters", "zone": "Zone-B", "priority": "medium", "status": "pending"},
                {"title": "LPR Gate Calibration", "worker_name": "Tech Team", "worker_id": "W-003", "area": "BLR-W01-Gate1-Entry", "zone": "BLR-Z1", "priority": "low",    "status": "pending"},
                {"title": "Damage Assessment — INC-002", "worker_name": "QA Lead", "worker_id": "W-004", "area": "Zone C", "zone": "Zone-C", "priority": "high",   "status": "in_progress"},
                {"title": "Inventory Reconciliation — Zone A", "worker_name": "Anita R.", "worker_id": "W-005", "area": "Zone A", "zone": "Zone-A", "priority": "medium", "status": "completed"},
            ]
            for t in ops_tasks:
                await db.execute(text("""
                    INSERT INTO ops_tasks (id, title, worker_name, worker_id, area, zone, priority, status, created_at, updated_at)
                    VALUES (:id, :title, :worker_name, :worker_id, :area, :zone, :priority, :status, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {**t, "id": new_id(), "now": now})
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
                """), {**cl, "id": new_id(), "now": now})
            logger.info(f"Seeded {len(checklists)} SOP checklists")

            # ── IntelliOps Exceptions ──
            exceptions = [
                {"exception_type": "count_mismatch",        "location": "Cluster B-09",       "zone": "Zone-B", "root_cause": "ERP sync delay",   "description": "Physical count shows -5 bags vs ERP record.", "status": "open",         "severity": "high",   "sla_minutes": 60},
                {"exception_type": "fifo_violation",        "location": "Zone B Cluster B2",  "zone": "Zone-B", "root_cause": "Manual override",   "description": "Batch B2026-1021 picked out of FIFO order.",  "status": "investigating","severity": "high",   "sla_minutes": 120},
                {"exception_type": "damaged_goods",         "location": "Zone C Bay 4",       "zone": "Zone-C", "root_cause": "Handling error",    "description": "5 bags torn during unloading. Est. loss ₹4,200.", "status": "open",      "severity": "medium", "sla_minutes": 30},
                {"exception_type": "missing_documentation", "location": "Gate Entry",         "zone": "Entry Gate", "root_cause": "Driver oversight", "description": "Delivery challan missing for TN-04-AB-1234.", "status": "open",       "severity": "low",    "sla_minutes": 240},
            ]
            for ex in exceptions:
                await db.execute(text("""
                    INSERT INTO ops_exceptions (id, exception_type, location, zone, root_cause, description, status, severity, sla_minutes, detected_at, created_at, updated_at)
                    VALUES (:id, :exception_type, :location, :zone, :root_cause, :description, :status, :severity, :sla_minutes, :now, :now, :now)
                    ON CONFLICT DO NOTHING
                """), {**ex, "id": new_id(), "now": now})
            logger.info(f"Seeded {len(exceptions)} IntelliOps exceptions")

            # ── Dashboard User (for legacy HTML auth) ──
            from app.core.auth.authentication import register_user
            for demo_user in DEMO_USERS:
                try:
                    existing = await db.execute(text("SELECT id FROM users WHERE email = :e"), {"e": demo_user["email"]})
                    if existing.scalar_one_or_none():
                        continue
                    user = await register_user(
                        db,
                        demo_user["email"],
                        demo_user["password"],
                        demo_user["full_name"],
                    )
                    user.is_superuser = demo_user["is_superuser"]
                    user.email_verified = True
                    await db.commit()
                except Exception as e:
                    logger.warning(f"Skipped demo user {demo_user['email']}: {e}")
                    await db.rollback()
            logger.info("Seeded frontend demo users")

            # Dashboard operator user
            try:
                from passlib.context import CryptContext
                pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
                dash_email = "dashboard@intelli.ai"
                existing = await db.execute(text("SELECT id FROM users WHERE email = :e"), {"e": dash_email})
                if not existing.scalar_one_or_none():
                    dash_user = await register_user(db, dash_email, "DashboardOps2026!", "Dashboard Operator")
                    dash_user.email_verified = True
                    await db.commit()
                    logger.info("Seeded dashboard user: dashboard@intelli.ai")
                else:
                    logger.info("Dashboard user already exists")
            except Exception as e:
                logger.warning(f"Skipped dashboard user: {e}")
                await db.rollback()

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
                did = new_id()
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
                    "id": new_id(), "vid": fv["vehicle_id"],
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
                    "id": new_id(), "vid": fv["vehicle_id"], "zone": fv["current_zone"],
                    "checkin": now - timedelta(minutes=dwell_mins), "dwell": dwell_mins,
                    "alert": alert_lvl, "now": now,
                })
            logger.info("Seeded 5 dwell records")

            # ── Incidents ──
            incidents = [
                {"title": "Unauthorized entry at Gate 4 perimeter", "description": "Person detected in restricted zone after hours. Camera BLR-W01-Gate1-Entry triggered alert.", "source": "camera", "priority": "P1", "severity_score": 0.95, "status": "open", "zone": "Gate 4 Perimeter", "category": "security"},
                {"title": "Damaged bags during unloading Zone C", "description": "5 bags torn during truck unloading at Bay 4. Estimated loss ₹4,200.", "source": "manual", "priority": "P2", "severity_score": 0.75, "status": "open", "zone": "Zone C Bay 4", "category": "damage"},
                {"title": "Count mismatch in Cluster B-09", "description": "Physical count shows -5 bags vs ERP record for batch B2025-1021.", "source": "counting", "priority": "P2", "severity_score": 0.70, "status": "acknowledged", "zone": "Cluster B-09", "category": "inventory"},
                {"title": "SLA breach risk — Dock B queue", "description": "Truck queue at Dock B exceeded 30-minute SLA window.", "source": "sla_breach", "priority": "P3", "severity_score": 0.55, "status": "open", "zone": "Dock B", "category": "sla"},
                {"title": "Cold storage temperature spike", "description": "Temperature exceeded 4°C threshold in Zone C cold storage.", "source": "sensor", "priority": "P3", "severity_score": 0.50, "status": "open", "zone": "Zone C Cold Storage", "category": "environment"},
                {"title": "Forklift collision near Zone A", "description": "Minor collision between forklift and pallet stack. No injuries.", "source": "camera", "priority": "P1", "severity_score": 0.90, "status": "escalated", "zone": "Zone A", "category": "safety"},
            ]
            for j, inc in enumerate(incidents):
                inc_id = new_id()
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
                eid = new_id()
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
                    "id": new_id(), "atype": event_types[i],
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
                            "id": new_id(), "period": iso_week, "gn": sc["group_name"],
                            "total": sc["total"], "comp": sc["compliant"], "ar": sc["at_risk"],
                            "br": sc["breached"], "pct": comp_pct, "pen": sc["penalty"], "now": now,
                        })
                logger.info(f"Seeded {len(scorecards)} scorecard entries")
            except Exception as e:
                logger.warning(f"Skipped scorecard entries: {e}")

            await db.commit()
            logger.info("=== Depot seed complete ===")
            print("\n[OK] Depot database seeded successfully with demo data.")
            print(f"  - {len(CAMERAS)} cameras")
            print(f"  - {len(GATES)} gates")
            print(f"  - {len(VEHICLES)} vehicles")
            print(f"  - {len(VISITORS)} visitors")
            print(f"  - {len(PERIMETER_ZONES)} perimeter zones + 5 breaches")
            print(f"  - {len(CLUSTER_ZONES)} cluster zones")
            print(f"  - 1 detection model (cement-bags-custom)")
            print(f"  - {len(MANIFESTS)} shipment manifests")
            print(f"  - {len(BATCHES)} inventory batches")
            print(f"  - {len(dock_slots)} dock slots")
            print(f"  - {len(fleet_vehicles)} fleet vehicles + 5 dwell records")
            print(f"  - {len(incidents)} incidents")
            print(f"  - 12 sensor events + 5 alerts")
            print(f"  - 1 dashboard user")

        except Exception as e:
            await db.rollback()
            logger.error(f"Seed failed: {e}")
            print(f"\n[ERROR] Seed failed: {e}")
            raise


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_database())
