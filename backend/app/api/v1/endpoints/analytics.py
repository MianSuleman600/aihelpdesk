"""
Admin Analytics endpoints.
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.models.models import (
    Ticket, TicketStatus, KBArticle, AIFeedback,
    FeedbackRating, User,
)
from app.schemas.schemas import AnalyticsOverview
from app.api.deps import require_admin

router = APIRouter()


@router.get("/overview", response_model=AnalyticsOverview)
async def get_analytics_overview(
    period: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get analytics overview (Admin only)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=period)

    # Total tickets
    total = await db.execute(
        select(func.count(Ticket.id)).where(Ticket.created_at >= cutoff)
    )
    total_tickets = total.scalar() or 0

    # Open tickets
    open_q = await db.execute(
        select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.OPEN, Ticket.created_at >= cutoff)
    )
    open_tickets = open_q.scalar() or 0

    # Resolved tickets
    resolved_q = await db.execute(
        select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.RESOLVED, Ticket.created_at >= cutoff)
    )
    resolved_tickets = resolved_q.scalar() or 0

    # Avg resolution time (hours)
    avg_res = await db.execute(
        select(
            func.avg(
                func.extract("epoch", Ticket.resolved_at - Ticket.created_at) / 3600
            )
        ).where(Ticket.resolved_at.isnot(None), Ticket.created_at >= cutoff)
    )
    avg_resolution_hours = round(avg_res.scalar() or 0, 1)

    # Total articles
    articles_q = await db.execute(select(func.count(KBArticle.id)))
    total_articles = articles_q.scalar() or 0

    # AI satisfaction
    helpful_q = await db.execute(
        select(func.count(AIFeedback.id)).where(AIFeedback.rating == FeedbackRating.HELPFUL)
    )
    total_feedback_q = await db.execute(select(func.count(AIFeedback.id)))
    helpful = helpful_q.scalar() or 0
    total_feedback = total_feedback_q.scalar() or 0
    ai_satisfaction = round((helpful / total_feedback * 100) if total_feedback > 0 else 0, 1)

    # Tickets by status
    status_q = await db.execute(
        select(Ticket.status, func.count(Ticket.id)).group_by(Ticket.status)
    )
    tickets_by_status = {row[0].value: row[1] for row in status_q.all()}

    # Tickets by category
    cat_q = await db.execute(
        select(Ticket.category_id, func.count(Ticket.id))
        .where(Ticket.category_id.isnot(None))
        .group_by(Ticket.category_id)
    )
    tickets_by_category = {str(row[0]): row[1] for row in cat_q.all()}

    return AnalyticsOverview(
        total_tickets=total_tickets,
        open_tickets=open_tickets,
        resolved_tickets=resolved_tickets,
        avg_resolution_hours=avg_resolution_hours,
        total_articles=total_articles,
        ai_satisfaction_percent=ai_satisfaction,
        tickets_by_status=tickets_by_status,
        tickets_by_category=tickets_by_category,
        ai_feedback_summary={"helpful": helpful, "unhelpful": total_feedback - helpful},
    )
