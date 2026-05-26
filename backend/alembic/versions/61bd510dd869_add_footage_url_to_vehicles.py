"""add_footage_url_to_vehicles

Revision ID: 61bd510dd869
Revises: 017_training_dataset
Create Date: 2026-05-26 14:13:27.481151
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '61bd510dd869'
down_revision: Union[str, None] = '017_training_dataset'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
