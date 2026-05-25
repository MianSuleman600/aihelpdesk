from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.models.models import Notification, UserSettings, User
from app.core.email import send_email
from app.core.config import settings
from app.core.logging import get_logger
from app.ws.manager import ws_manager

logger = get_logger(__name__)


class NotificationService:

    @staticmethod
    async def user_wants_notifications(
        user_id: str,
        notification_type: str,
        db: AsyncSession,
    ) -> bool:
        result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
        settings = result.scalar_one_or_none()
        if not settings:
            return True
        if notification_type == "email" and not settings.notification_email:
            return False
        if notification_type == "browser" and not settings.notification_browser:
            return False
        if notification_type == "ticket" and not settings.notification_ticket_updates:
            return False
        return True

    @staticmethod
    async def _send_email_notification(
        user_id: str,
        title: str,
        message: str,
        link: Optional[str],
        db: AsyncSession,
    ) -> None:
        if not settings.SMTP_HOST:
            return
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user or not user.email:
            return
        if not await NotificationService.user_wants_notifications(user_id, "email", db):
            return
        html_body = f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #13131b; padding: 40px 20px;">
  <table style="max-width: 480px; margin: 0 auto; background: #1f1f27; border-radius: 16px; padding: 40px;">
    <tr><td style="text-align: center; padding-bottom: 24px;">
      <h1 style="color: #e4e1ed; font-size: 20px; margin: 0;">{title}</h1>
    </td></tr>
    <tr><td style="padding: 12px 0;">
      <p style="color: #908fa0; font-size: 14px; line-height: 1.6; margin: 0;">{message}</p>
    </td></tr>"""
        if link:
            html_body += f"""\
    <tr><td style="text-align: center; padding: 24px 0;">
      <a href="{link}" style="display: inline-block; padding: 12px 32px; border-radius: 8px; background: linear-gradient(135deg, #10b981, #047857); color: white; text-decoration: none; font-weight: 600; font-size: 15px;">View Details</a>
    </td></tr>"""
        html_body += """\
  </table>
</body>
</html>"""
        sent = send_email(to=user.email, subject=title, html_body=html_body)
        if not sent:
            logger.warning(f"Failed to send email notification to {user.email}")

    @staticmethod
    async def create_notification(
        user_id: str,
        title: str,
        message: str,
        db: AsyncSession,
        link: Optional[str] = None,
        notification_type: str = "browser",
    ) -> Optional[Notification]:
        if not await NotificationService.user_wants_notifications(user_id, notification_type, db):
            return None
        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            link=link,
        )
        db.add(notif)
        await db.flush()
        await db.refresh(notif)

        # Push real-time notification via WebSocket
        await ws_manager.send_to_user(
            user_id=user_id,
            event={
                "type": "new_notification",
                "notification": {
                    "id": notif.id,
                    "title": notif.title,
                    "message": notif.message,
                    "link": notif.link,
                    "is_read": notif.is_read,
                    "created_at": notif.created_at.isoformat() if notif.created_at else None,
                },
            },
        )

        # Send email notification if SMTP is configured and user has opted in
        await NotificationService._send_email_notification(user_id, title, message, link, db)

        return notif
