import asyncio
from sqlalchemy import text
from app.database import async_session

async def update():
    async with async_session() as db:
        await db.execute(text("UPDATE depot_zones SET name='UltraTech Cement - Zone A' WHERE zone_code='A'"))
        await db.execute(text("UPDATE depot_zones SET name='ACC Cement - Zone B' WHERE zone_code='B'"))
        await db.execute(text("UPDATE depot_zones SET name='JSW Cement - Zone C' WHERE zone_code='C'"))
        await db.execute(text("UPDATE depot_zones SET name='Ambuja Cement - Zone D' WHERE zone_code='D'"))
        await db.commit()
        print("Zone names updated successfully")

asyncio.run(update())
