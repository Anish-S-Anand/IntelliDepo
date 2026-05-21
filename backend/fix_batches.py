"""Fix batch original_quantity to be higher than quantity so utilization shows correctly."""
import asyncio
from sqlalchemy import text
from app.database import async_session

BATCH_FIXES = [
    # (batch_code, quantity, original_quantity)
    ("B2026-CEM-53", 498, 600),
    ("B2026-1022",   490, 600),
    ("B2026-1019",   320, 500),
    ("B2026-1021",   450, 600),
    ("B2026-1018",   595, 800),
    ("B2026-1023",   910, 1000),
    ("B2026-1024",   250, 400),
    ("B2026-1025",   180, 300),
    ("B2026-1026",   420, 500),
    ("B2026-1027",   350, 500),
    ("B2026-1028",   290, 400),
    ("B2026-1029",   220, 350),
    ("B2026-1030",   380, 500),
    ("B2026-1031",   460, 600),
    ("B2026-1032",   310, 450),
    ("B2026-1033",   270, 400),
]

async def fix():
    async with async_session() as db:
        # First update all batches to have original_quantity > quantity
        await db.execute(text("""
            UPDATE depot_inventory_batches
            SET original_quantity = ROUND(quantity * 1.4)
            WHERE original_quantity = quantity OR original_quantity = 0
        """))
        # Apply specific fixes
        for batch_code, qty, orig_qty in BATCH_FIXES:
            await db.execute(text("""
                UPDATE depot_inventory_batches
                SET quantity = :qty, original_quantity = :orig_qty
                WHERE batch_code = :code
            """), {"qty": qty, "orig_qty": orig_qty, "code": batch_code})
        await db.commit()
        # Show result
        result = await db.execute(text("""
            SELECT batch_code, quantity, original_quantity,
                   ROUND(quantity::numeric / original_quantity * 100) as pct
            FROM depot_inventory_batches
            ORDER BY batch_code
            LIMIT 20
        """))
        rows = result.fetchall()
        print(f"{'Batch':<20} {'Qty':>6} {'Orig':>6} {'%':>5}")
        print("-" * 40)
        for r in rows:
            print(f"{r[0]:<20} {r[1]:>6} {r[2]:>6} {r[3]:>4}%")
        print("\nDone!")

asyncio.run(fix())
