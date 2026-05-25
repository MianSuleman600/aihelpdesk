"""
Audit logging service.
Logs sensitive operations to the audit_logs table.
"""

from typing import Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AuditLog


class AuditService:
    """Service for recording audit trail entries."""

    @staticmethod
    async def log(
        db: AsyncSession,
        action: str,
        user_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        """
        Record an audit log entry.

        Args:
            db: Database session
            action: Action name (e.g. "user.login", "doc.upload", "user.role_change")
            user_id: User who performed the action
            resource_type: Type of resource affected (e.g. "user", "ticket", "document")
            resource_id: ID of the resource
            details: Additional context as JSON dict
            ip_address: Client IP address
            user_agent: Client user agent

        Returns:
            The created AuditLog record
        """
        entry = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(entry)
        return entry
