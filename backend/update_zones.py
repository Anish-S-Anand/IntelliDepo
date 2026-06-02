import asyncio
from sqlalchemy import text
from app.database import async_session
from app.depot.storage_truth import cluster_zones_for_seed

async def update():
    async with async_session() as db:
        for zone in cluster_zones_for_seed("WH_BLR"):
            await db.execute(text("""
                UPDATE depot_zones
                SET name=:name,
                    max_capacity_units=:max_capacity_units,
                    current_occupancy=:current_occupancy,
                    utilization_pct=:utilization_pct,
                    status=:status
                WHERE zone_code=:zone_code
            """), zone)
        await db.commit()
        print("Zone live storage levels updated successfully")

asyncio.run(update())
