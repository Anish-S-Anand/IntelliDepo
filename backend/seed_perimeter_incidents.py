"""
Seed script for perimeter incidents - Task 1.3
Creates incidents from breaches with proper video archive references and escalation deadlines.
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, Column, String, Text, Integer, Float, Boolean, DateTime, UUID
from sqlalchemy.ext.asyncio import AsyncSession

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.database import async_session
from app.shared.models.base import DBBaseModel


# Define models inline to avoid circular imports
class PerimeterZone(DBBaseModel):
    """A monitored perimeter zone associated with one or more cameras."""
    __tablename__ = "depot_perimeter_zones"

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    zone_type = Column(String, default="restricted")
    camera_id = Column(UUID(as_uuid=True), nullable=True)
    polygon_points = Column(Text, nullable=True)
    alert_on_entry = Column(Boolean, default=True)
    alert_severity = Column(String, default="high")
    night_vision_enabled = Column(Boolean, default=False)
    night_vision_mode = Column(String, default="auto")
    active_hours_start = Column(String, nullable=True)
    active_hours_end = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_by = Column(String, nullable=True)


class PerimeterBreach(DBBaseModel):
    """An immutable breach event record."""
    __tablename__ = "depot_perimeter_breaches"

    zone_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    camera_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    breach_type = Column(String, default="unauthorized_entry")
    severity = Column(String, default="high")
    confidence = Column(Float, nullable=True)
    snapshot_ref = Column(String, nullable=True)
    alert_sent = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    detected_at = Column(DateTime(timezone=True), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String, nullable=True)
    resolution_notes = Column(Text, nullable=True)


class PerimeterIncident(DBBaseModel):
    """Incident created from a perimeter breach with auto-escalation tracking."""
    __tablename__ = "depot_perimeter_incidents"

    breach_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    zone_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    severity = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    escalation_level = Column(Integer, default=0)
    escalation_deadline = Column(DateTime(timezone=True), nullable=True)
    escalated_to = Column(String, nullable=True)
    status = Column(String, default="open")
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(String, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    video_archive_ref = Column(String, nullable=True)


# Breach type to video file mapping as per requirements
BREACH_VIDEO_MAP = {
    "unauthorized_entry": "Perimeter_Detection.mp4",
    "loitering": "Theft Camera .mp4",
    "forced_entry": "Perimeter_Detection.mp4",
    "after_hours": "Recording 2025-07-30 115417.mp4",
    "object_left": "Theft Camera .mp4",
    "unknown": "LPR_RECOGNITION.mp4",
}


async def seed_incidents_from_breaches():
    """
    Create incidents from existing breaches.
    For each breach, create a corresponding incident with:
    - title, description, severity, zone_id, breach_id, status="open"
    - video_archive_ref based on breach_type using BREACH_VIDEO_MAP
    - escalation_deadline set to 5 minutes from creation for critical incidents
    """
    async with async_session() as db:
        # Fetch all breaches
        result = await db.execute(select(PerimeterBreach))
        breaches = result.scalars().all()
        
        if not breaches:
            print("No breaches found. Please run tasks 1.1 and 1.2 first to create zones and breaches.")
            return
        
        print(f"Found {len(breaches)} breaches. Creating incidents...")
        
        incidents_created = 0
        for breach in breaches:
            # Check if incident already exists for this breach
            existing = await db.execute(
                select(PerimeterIncident).where(PerimeterIncident.breach_id == breach.id)
            )
            if existing.scalar_one_or_none():
                print(f"  Incident already exists for breach {breach.id}, skipping...")
                continue
            
            # Get zone information
            zone = await db.get(PerimeterZone, breach.zone_id)
            zone_name = zone.name if zone else "Unknown Zone"
            
            # Determine video archive reference based on breach type
            video_ref = BREACH_VIDEO_MAP.get(breach.breach_type, "Perimeter_Detection.mp4")
            
            # Set escalation deadline (5 minutes for critical incidents)
            escalation_deadline = None
            if breach.severity == "critical":
                escalation_deadline = datetime.now(timezone.utc) + timedelta(minutes=5)
            
            # Create incident
            incident = PerimeterIncident(
                breach_id=breach.id,
                zone_id=breach.zone_id,
                severity=breach.severity,
                title=f"Security Incident — {zone_name}",
                description=(
                    f"{breach.breach_type.replace('_', ' ').title()} detected in {zone_name}. "
                    f"Confidence: {breach.confidence:.0%}." if breach.confidence else 
                    f"{breach.breach_type.replace('_', ' ').title()} detected in {zone_name}."
                ),
                escalation_level=0,
                escalation_deadline=escalation_deadline,
                escalated_to="Security Supervisor" if breach.severity == "critical" else None,
                status="open",
                video_archive_ref=video_ref,
            )
            
            db.add(incident)
            incidents_created += 1
            print(f"  Created incident for breach {breach.id} ({breach.breach_type}) -> video: {video_ref}")
        
        await db.commit()
        print(f"\n✓ Successfully created {incidents_created} incidents from breaches")


if __name__ == "__main__":
    asyncio.run(seed_incidents_from_breaches())
