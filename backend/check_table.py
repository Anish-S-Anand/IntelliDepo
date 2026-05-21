import asyncio
from sqlalchemy import inspect, text
from app.database import engine

async def check():
    async with engine.connect() as conn:
        # Get all tables
        result = await conn.run_sync(lambda sync_conn: inspect(sync_conn).get_table_names())
        print(f"Total tables: {len(result)}")
        
        # Check for depot-related tables
        depot_tables = [t for t in result if t.startswith('depot_')]
        print(f"\nDepot tables ({len(depot_tables)}):")
        for table in sorted(depot_tables):
            print(f"  - {table}")
        
        # Check alembic version
        try:
            result = await conn.execute(text("SELECT version_num FROM alembic_version"))
            rows = result.fetchall()
            if rows:
                print(f"\nCurrent alembic version: {rows[0][0]}")
            else:
                print("\nNo alembic version found")
        except Exception as e:
            print(f"\nNo alembic version table or error: {e}")
        
        # Check specifically for depot_detection_metrics
        if 'depot_detection_metrics' in result:
            print("\n✓ depot_detection_metrics table EXISTS")
        else:
            print("\n✗ depot_detection_metrics table does NOT exist")

asyncio.run(check())
