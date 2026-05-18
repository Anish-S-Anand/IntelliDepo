"""
Seed script — Daily Throughput (Bags In / Out)

Inserts realistic TrackedObject rows into depot_tracked_objects for the
last 7 days so the Daily Throughput chart on the Executive Dashboard
shows real-looking data.

Uses raw SQL to avoid circular import issues in the app module tree.

Run from the backend folder:
    python seed_throughput.py
"""
import asyncio
import uuid
import random
import os
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set in backend/.env")

# ---------------------------------------------------------------------------
# Config — tweak these to change the shape of the chart
# ---------------------------------------------------------------------------

BAGS_IN_PER_DAY  = [320, 410, 290, 380, 450, 270, 510]   # Wed → Tue
BAGS_OUT_PER_DAY = [280, 390, 260, 350, 420, 240, 480]   # Wed → Tue


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    today = datetime.now(timezone.utc).date()
    days = [(today - timedelta(days=i)) for i in range(6, -1, -1)]  # oldest → newest

    async with Session() as db:
        inserted = 0

        for day_idx, day in enumerate(days):
            bags_in  = BAGS_IN_PER_DAY[day_idx]
            bags_out = BAGS_OUT_PER_DAY[day_idx]

            session_id = uuid.uuid4()
            started_at  = datetime(day.year, day.month, day.day, 6,  0, tzinfo=timezone.utc)
            completed_at = datetime(day.year, day.month, day.day, 18, 0, tzinfo=timezone.utc)

            # Insert tracking session
            import json
            counts_json = json.dumps({"bag": bags_in + bags_out})
            await db.execute(text("""
                INSERT INTO depot_tracking_sessions
                    (id, status, total_frames, unique_objects, counts_by_class,
                     started_at, completed_at, initiated_by, created_at, updated_at)
                VALUES
                    (:id, 'completed', :total, :unique, cast(:counts as jsonb),
                     :started, :completed, 'seed_script', :created, :created)
            """), {
                "id": session_id,
                "total": bags_in + bags_out,
                "unique": bags_in + bags_out,
                "counts": counts_json,
                "started": started_at,
                "completed": completed_at,
                "created": started_at,
            })

            def rand_ts(d):
                return datetime(
                    d.year, d.month, d.day,
                    random.randint(6, 17),
                    random.randint(0, 59),
                    random.randint(0, 59),
                    tzinfo=timezone.utc,
                )

            # Inbound bags
            for i in range(bags_in):
                ts = rand_ts(day)
                await db.execute(text("""
                    INSERT INTO depot_tracked_objects
                        (id, track_id, session_id, class_label,
                         first_seen_frame, last_seen_frame, total_frames,
                         avg_confidence, last_bbox_x, last_bbox_y, last_bbox_w, last_bbox_h,
                         direction, speed_estimate, is_counted, crossed_line,
                         created_at, updated_at)
                    VALUES
                        (:id, :track_id, :session_id, 'bag',
                         :first_frame, :last_frame, 10,
                         :conf, :bx, :by, :bw, :bh,
                         'inbound', :speed, true, true,
                         :ts, :ts)
                """), {
                    "id": uuid.uuid4(),
                    "track_id": i + 1,
                    "session_id": session_id,
                    "first_frame": i * 2,
                    "last_frame": i * 2 + 10,
                    "conf": round(random.uniform(0.82, 0.99), 4),
                    "bx": round(random.uniform(0.1, 0.9), 4),
                    "by": round(random.uniform(0.1, 0.9), 4),
                    "bw": round(random.uniform(0.05, 0.15), 4),
                    "bh": round(random.uniform(0.05, 0.15), 4),
                    "speed": round(random.uniform(0.5, 2.5), 2),
                    "ts": ts,
                })
                inserted += 1

            # Outbound bags
            for i in range(bags_out):
                ts = rand_ts(day)
                await db.execute(text("""
                    INSERT INTO depot_tracked_objects
                        (id, track_id, session_id, class_label,
                         first_seen_frame, last_seen_frame, total_frames,
                         avg_confidence, last_bbox_x, last_bbox_y, last_bbox_w, last_bbox_h,
                         direction, speed_estimate, is_counted, crossed_line,
                         created_at, updated_at)
                    VALUES
                        (:id, :track_id, :session_id, 'bag',
                         :first_frame, :last_frame, 10,
                         :conf, :bx, :by, :bw, :bh,
                         'outbound', :speed, true, true,
                         :ts, :ts)
                """), {
                    "id": uuid.uuid4(),
                    "track_id": bags_in + i + 1,
                    "session_id": session_id,
                    "first_frame": (bags_in + i) * 2,
                    "last_frame": (bags_in + i) * 2 + 10,
                    "conf": round(random.uniform(0.82, 0.99), 4),
                    "bx": round(random.uniform(0.1, 0.9), 4),
                    "by": round(random.uniform(0.1, 0.9), 4),
                    "bw": round(random.uniform(0.05, 0.15), 4),
                    "bh": round(random.uniform(0.05, 0.15), 4),
                    "speed": round(random.uniform(0.5, 2.5), 2),
                    "ts": ts,
                })
                inserted += 1

        await db.commit()
        await engine.dispose()

    print(f"✓ Seeded {inserted} TrackedObject rows across {len(days)} days.\n")
    print("  Day              Bags In   Bags Out")
    print("  " + "-" * 36)
    for i, day in enumerate(days):
        print(f"  {day.strftime('%a %Y-%m-%d')}    {BAGS_IN_PER_DAY[i]:>6}      {BAGS_OUT_PER_DAY[i]:>6}")


if __name__ == "__main__":
    asyncio.run(seed())
