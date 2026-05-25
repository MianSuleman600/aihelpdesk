"""add missing tables (user_settings, uploaded_documents, audit_logs)

Revision ID: 9a9e52ea7138
Revises: c4ae7ee11a9b
Create Date: 2026-05-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a9e52ea7138'
down_revision: Union[str, None] = 'c4ae7ee11a9b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('user_settings',
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('notification_email', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('notification_browser', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('notification_ticket_updates', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('theme', sa.String(length=20), nullable=False, server_default=sa.text("'system'")),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_user_settings_user_id_users'), ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', name=op.f('pk_user_settings')),
    )
    op.create_table('uploaded_documents',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('PROCESSING', 'READY', 'FAILED', name='uploadeddocumentstatus'), nullable=False, server_default=sa.text("'processing'")),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('chunk_count', sa.Integer(), nullable=True, server_default=sa.text('0')),
        sa.Column('uploaded_by_id', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id'], name=op.f('fk_uploaded_documents_uploaded_by_id_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_uploaded_documents')),
    )
    op.create_table('audit_logs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('resource_type', sa.String(length=50), nullable=True),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_audit_logs_user_id_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_audit_logs')),
    )


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('uploaded_documents')
    op.drop_table('user_settings')
    op.execute('DROP TYPE IF EXISTS uploadeddocumentstatus')
