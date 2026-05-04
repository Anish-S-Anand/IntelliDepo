from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Boolean
from sqlalchemy.orm import declarative_mixin

@declarative_mixin
class TimestampMixin:
    """Adds created_at and updated_at to models."""
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

@declarative_mixin
class SoftDeleteMixin:
    """Adds soft-delete capabilities to models."""
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)
