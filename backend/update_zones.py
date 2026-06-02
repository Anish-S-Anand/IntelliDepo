import asyncio
from sqlalchemy import text
from app.database import async_session

async def update():
    async with async_session() as db:
        await db.execute(text("UPDATE depot_zones SET name='UltraTech Cement - Zone A', max_capacity_units=1000, current_occupancy=810, utilization_pct=81.0, status='warning' WHERE zone_code='A'"))
        await db.execute(text("UPDATE depot_zones SET name='ACC Cement - Zone B', max_capacity_units=1000, current_occupancy=450, utilization_pct=45.0, status='normal' WHERE zone_code='B'"))
        await db.execute(text("UPDATE depot_zones SET name='JSW Cement - Zone C', max_capacity_units=1000, current_occupancy=595, utilization_pct=59.5, status='normal' WHERE zone_code='C'"))
        await db.execute(text("UPDATE depot_zones SET name='Ambuja Cement - Zone D', max_capacity_units=1000, current_occupancy=910, utilization_pct=91.0, status='critical' WHERE zone_code='D'"))
        await db.commit()
        print("Zone live storage levels updated successfully")

asyncio.run(update())
