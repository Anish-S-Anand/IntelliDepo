import asyncio
from sqlalchemy import text
from app.database import engine

async def fix():
    async with engine.begin() as conn:
        # Check current column size
        result = await conn.execute(text("""
            SELECT character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'alembic_version' 
            AND column_name = 'version_num'
        """))
        row = result.fetchone()
        if row:
            print(f"Current version_num column length: {row[0]}")
        
        # Alter the column to accommodate longer revision IDs
        print("Altering version_num column to VARCHAR(64)...")
        await conn.execute(text("""
            ALTER TABLE alembic_version 
            ALTER COLUMN version_num TYPE VARCHAR(64)
        """))
        print("✓ Column altered successfully")
        
        # Verify the change
        result = await conn.execute(text("""
            SELECT character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'alembic_version' 
            AND column_name = 'version_num'
        """))
        row = result.fetchone()
        if row:
            print(f"New version_num column length: {row[0]}")

asyncio.run(fix())
