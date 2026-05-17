"""
Ticket management endpoints: CRUD, status workflow, messages.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.models import Ticket, TicketMessage, User, UserRole, TicketStatus
from app.schemas.schemas import (
    TicketCreate, TicketUpdate, TicketResponse,
    TicketMessageCreate, TicketMessageResponse,
)
from app.api.deps import get_current_user, require_agent_or_admin

router = APIRouter()


@router.get("/", response_model=List[TicketResponse])
async def list_tickets(
    status_filter: Optional[TicketStatus] = Query(None, alias="status"),
    assigned_to_me: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List tickets. Users see own tickets; Agents/Admins see all."""
    query = select(Ticket)

    # Role-based filtering
    if current_user.role == UserRole.USER:
        query = query.where(Ticket.created_by_id == current_user.id)
    elif assigned_to_me:
        query = query.where(Ticket.assigned_to_id == current_user.id)

    if status_filter:
        query = query.where(Ticket.status == status_filter)

    query = query.order_by(Ticket.updated_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific ticket."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Users can only see their own tickets
    if current_user.role == UserRole.USER and ticket.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return ticket


@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    data: TicketCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new support ticket."""
    ticket = Ticket(
        **data.model_dump(),
        created_by_id=current_user.id,
    )
    db.add(ticket)
    await db.flush()
    await db.refresh(ticket)
    return ticket


@router.patch("/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    data: TicketUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """Update ticket status/assignment (Agent/Admin only)."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ticket, field, value)

    # Set resolved_at when status changes to RESOLVED
    if data.status == TicketStatus.RESOLVED and not ticket.resolved_at:
        ticket.resolved_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(ticket)
    return ticket


# --- Ticket Messages ---

@router.get("/{ticket_id}/messages", response_model=List[TicketMessageResponse])
async def list_ticket_messages(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all messages in a ticket."""
    query = select(TicketMessage).where(TicketMessage.ticket_id == ticket_id)

    # Users cannot see internal notes
    if current_user.role == UserRole.USER:
        query = query.where(TicketMessage.is_internal == False)

    query = query.order_by(TicketMessage.created_at.asc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{ticket_id}/messages", response_model=TicketMessageResponse, status_code=status.HTTP_201_CREATED)
async def add_ticket_message(
    ticket_id: str,
    data: TicketMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a message/reply to a ticket."""
    # Verify ticket exists
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Users can only message their own tickets
    if current_user.role == UserRole.USER and ticket.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Only agents/admins can create internal notes
    if data.is_internal and current_user.role == UserRole.USER:
        raise HTTPException(status_code=403, detail="Users cannot create internal notes")

    message = TicketMessage(
        ticket_id=ticket_id,
        sender_id=current_user.id,
        message=data.message,
        is_internal=data.is_internal,
    )
    db.add(message)
    await db.flush()
    await db.refresh(message)
    return message
