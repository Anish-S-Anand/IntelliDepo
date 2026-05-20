"""
One-time migration script — updates zone names in the database to the canonical standard.

Run from the backend folder:
    python update_zone_names.py
"""
import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in backend/.env")

# ---------------------------------------------------------------------------
# Mapping: old value -> new canonical value
# ---------------------------------------------------------------------------

CAMERA_ZONE_MAP = {
    "Zone-A":     "Zone A",
    "Zone-B":     "Zone B",
    "Zone-C":     "Zone C",
    "Zone-D":     "Zone D",
    "Entry Gate": "Gate — North Entry",
    "Exit Gate":  "Gate — South Exit",
    # Loading Dock and Yard stay the same
}

ZONE_FIELD_MAP = {
    # ops_tasks, ops_sop_checklists, ops_exceptions, ops_vehicles, ops_dock_slots
    "Zone-A":       "Zone A",
    "Zone-B":       "Zone B",
    "Zone-C":       "Zone C",
    "Zone-D":       "Zone D",
    "Entry Gate":   "Gate — North Entry",
    "Exit Gate":    "Gate — South Exit",
    "inbound_gate": "Gate — North Entry",
    "outbound_gate":"Gate — South Exit",
    "staging_area": "Zone B",
    "dock_area":    "Loading Dock",
    "cold_storage": "Zone C",
    "parking_yard": "Yard",
}

# Tables and their zone column names
ZONE_TABLES = [
    ("depot_cameras",           "zone"),
    ("ops_tasks",               "zone"),
    ("ops_sop_checklists",      "zone"),
    ("ops_exceptions",          "zone"),
    ("ops_vehicles",            "current_zone"),
    ("ops_dock_slots",          "zone"),
    ("depot_count_sessions",    "zone"),
    # depot_inventory_items — table may not exist
    # depot_perimeter_breaches.zone_id — UUID column, skip
    # depot_perimeter_zones.name — display name, skip
]


async def migrate():
    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        total = 0
        for table, col in ZONE_TABLES:
            # Check table exists
            exists = await db.execute(text(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = :t)"
            ), {"t": table})
            if not exists.scalar():
                print(f"  ⚠ Table {table} not found — skipping")
                continue

            for old, new in ZONE_FIELD_MAP.items():
                result = await db.execute(text(
                    f"UPDATE {table} SET {col} = :new WHERE {col} = :old"
                ), {"old": old, "new": new})
                if result.rowcount > 0:
                    print(f"  ✓ {table}.{col}: '{old}' → '{new}' ({result.rowcount} rows)")
                    total += result.rowcount

        await db.commit()
        await engine.dispose()
        print(f"\n✓ Done. {total} rows updated across {len(ZONE_TABLES)} tables.")


if __name__ == "__main__":
    asyncio.run(migrate())
