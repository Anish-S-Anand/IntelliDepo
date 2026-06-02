"""Cement Bag Detection Training - Detection Metrics table

Revision ID: 019_detection_metrics
Revises: 018_training_models
Create Date: 2025-01-29
"""
from __future__ import annotations
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "019_detection_metrics"
down_revision = "018_training_models"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create detection_metrics table with time-series partitioning support
    op.create_table(
        "detection_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("camera_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model_version", sa.String(50), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        
        # Detection counts (Requirement 8.1)
        sa.Column("total_detections", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("detections_by_class", postgresql.JSONB(), nullable=True),
        
        # Confidence metrics (Requirement 8.2)
        sa.Column("avg_confidence", sa.Float(), nullable=True),
        sa.Column("min_confidence", sa.Float(), nullable=True),
        sa.Column("max_confidence", sa.Float(), nullable=True),
        
        # Performance metrics (Requirement 8.3, 8.4)
        sa.Column("inference_time_ms", sa.Float(), nullable=False),
        sa.Column("fps", sa.Float(), nullable=True),
        
        # Error tracking (Requirement 8.8)
        sa.Column("error_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_types", postgresql.JSONB(), nullable=True),
        
        # Aggregation window metadata
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("window_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("window_duration_seconds", sa.Integer(), nullable=True),
        
        # Audit
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False)
    )
    
    # Create indexes for efficient querying (Requirement 8.8)
    op.create_index("idx_detection_metrics_camera_id", "detection_metrics", ["camera_id"])
    op.create_index("idx_detection_metrics_timestamp", "detection_metrics", ["timestamp"], postgresql_ops={"timestamp": "DESC"})
    op.create_index("idx_detection_metrics_model_version", "detection_metrics", ["model_version"])
    
    # Create composite index for common query patterns (camera + timestamp)
    op.create_index("idx_detection_metrics_camera_timestamp", "detection_metrics", ["camera_id", "timestamp"], postgresql_ops={"timestamp": "DESC"})
    
    # Create monthly partitions for the current and next 3 months
    # Note: In production, you would set up automatic partition creation
    # This creates initial partitions to demonstrate the partitioning strategy
    
    conn = op.get_bind()
    
    # Create partitions for 2025 (current year based on migration date)
    # Format: detection_metrics_y2025m01, detection_metrics_y2025m02, etc.
    months = [
        ("2025", "01", "2025-01-01", "2025-02-01"),
        ("2025", "02", "2025-02-01", "2025-03-01"),
        ("2025", "03", "2025-03-01", "2025-04-01"),
        ("2025", "04", "2025-04-01", "2025-05-01"),
    ]
    
    for year, month, start_date, end_date in months:
        partition_name = f"detection_metrics_y{year}m{month}"
        
        # Create partition table
        conn.execute(sa.text(f"""
            CREATE TABLE IF NOT EXISTS {partition_name} (
                CHECK (timestamp >= '{start_date}'::timestamptz AND timestamp < '{end_date}'::timestamptz)
            ) INHERITS (detection_metrics)
        """))
        
        # Create indexes on partition
        conn.execute(sa.text(f"""
            CREATE INDEX IF NOT EXISTS idx_{partition_name}_camera_id ON {partition_name}(camera_id)
        """))
        conn.execute(sa.text(f"""
            CREATE INDEX IF NOT EXISTS idx_{partition_name}_timestamp ON {partition_name}(timestamp DESC)
        """))
        conn.execute(sa.text(f"""
            CREATE INDEX IF NOT EXISTS idx_{partition_name}_model_version ON {partition_name}(model_version)
        """))
    
    # Create trigger function to route inserts to appropriate partition
    conn.execute(sa.text("""
        CREATE OR REPLACE FUNCTION detection_metrics_insert_trigger()
        RETURNS TRIGGER AS $$
        DECLARE
            partition_name TEXT;
            year_month TEXT;
        BEGIN
            year_month := to_char(NEW.timestamp, 'YYYYmMM');
            partition_name := 'detection_metrics_' || lower(year_month);
            
            -- Try to insert into the appropriate partition
            BEGIN
                EXECUTE format('INSERT INTO %I SELECT ($1).*', partition_name) USING NEW;
                RETURN NULL;
            EXCEPTION
                WHEN undefined_table THEN
                    -- Partition doesn't exist, insert into parent table
                    -- In production, you might want to create the partition dynamically here
                    RETURN NEW;
            END;
        END;
        $$ LANGUAGE plpgsql;
    """))
    
    # Create trigger to automatically route inserts
    conn.execute(sa.text("""
        CREATE TRIGGER insert_detection_metrics_trigger
            BEFORE INSERT ON detection_metrics
            FOR EACH ROW EXECUTE FUNCTION detection_metrics_insert_trigger()
    """))


def downgrade() -> None:
    conn = op.get_bind()
    
    # Drop trigger and function
    conn.execute(sa.text("DROP TRIGGER IF EXISTS insert_detection_metrics_trigger ON detection_metrics"))
    conn.execute(sa.text("DROP FUNCTION IF EXISTS detection_metrics_insert_trigger()"))
    
    # Drop partition tables
    months = [
        ("2025", "01"),
        ("2025", "02"),
        ("2025", "03"),
        ("2025", "04"),
    ]
    
    for year, month in months:
        partition_name = f"detection_metrics_y{year}m{month}"
        conn.execute(sa.text(f"DROP TABLE IF EXISTS {partition_name}"))
    
    # Drop indexes
    op.drop_index("idx_detection_metrics_camera_timestamp", table_name="detection_metrics")
    op.drop_index("idx_detection_metrics_model_version", table_name="detection_metrics")
    op.drop_index("idx_detection_metrics_timestamp", table_name="detection_metrics")
    op.drop_index("idx_detection_metrics_camera_id", table_name="detection_metrics")
    
    # Drop table
    op.drop_table("detection_metrics")
