"""
Email service for sending transactional emails (password reset, notifications).
Uses SMTP configured via environment variables.
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def send_email(
    to: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
) -> bool:
    """
    Send an email via SMTP.

    Args:
        to: Recipient email address
        subject: Email subject line
        html_body: HTML version of the email body
        text_body: Plain text fallback (auto-generated if not provided)

    Returns:
        True if sent successfully, False otherwise
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning("SMTP not configured — cannot send email")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to
    msg["Subject"] = subject

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, [to], msg.as_string())
        logger.info(f"Email sent to {to}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


def send_password_reset_email(email: str, reset_link: str) -> bool:
    """Send a password reset email with a link."""
    subject = f"{settings.APP_NAME} — Password Reset"
    html_body = f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #13131b; padding: 40px 20px;">
  <table style="max-width: 480px; margin: 0 auto; background: #1f1f27; border-radius: 16px; padding: 40px;">
    <tr><td style="text-align: center; padding-bottom: 24px;">
      <div style="width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #10b981, #047857); display: inline-flex; align-items: center; justify-content: center;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
      </div>
      <h1 style="color: #e4e1ed; font-size: 22px; margin: 16px 0 4px;">Reset Your Password</h1>
      <p style="color: #908fa0; font-size: 14px; margin: 0;">Click the button below to set a new password</p>
    </td></tr>
    <tr><td style="text-align: center; padding: 24px 0;">
      <a href="{reset_link}" style="display: inline-block; padding: 12px 32px; border-radius: 8px; background: linear-gradient(135deg, #10b981, #047857); color: white; text-decoration: none; font-weight: 600; font-size: 15px;">Reset Password</a>
    </td></tr>
    <tr><td style="text-align: center; padding-top: 24px;">
      <p style="color: #464554; font-size: 12px;">This link expires in 30 minutes.<br>If you didn't request this, ignore this email.</p>
    </td></tr>
  </table>
</body>
</html>"""
    return send_email(email, subject, html_body)
