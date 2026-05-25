"""
Ticket management endpoints: CRUD, status workflow, messages.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.models import Ticket, TicketMessage, User, UserRole, TicketStatus
from app.services.notification_service import NotificationService
from app.schemas.schemas import (
    TicketCreate, TicketUpdate, TicketResponse, TicketAssign,
    TicketMessageCreate, TicketMessageResponse,
)
from app.api.deps import get_current_user, require_agent_or_admin
from app.ws.manager import ws_manager

router = APIRouter()

ALLOWED_TRANSITIONS = {
    TicketStatus.OPEN: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
    TicketStatus.IN_PROGRESS: [TicketStatus.WAITING, TicketStatus.RESOLVED, TicketStatus.CLOSED],
    TicketStatus.WAITING: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
    TicketStatus.RESOLVED: [TicketStatus.CLOSED],
    TicketStatus.CLOSED: [],
}

USER_TRANSITIONS = {
    TicketStatus.OPEN: [TicketStatus.CLOSED],
    TicketStatus.IN_PROGRESS: [TicketStatus.CLOSED],
    TicketStatus.WAITING: [TicketStatus.CLOSED],
    TicketStatus.RESOLVED: [TicketStatus.CLOSED],
    TicketStatus.CLOSED: [TicketStatus.OPEN],
}


def enforce_ticket_fsm(current_status: TicketStatus, next_status: TicketStatus, is_user: bool = False) -> None:
    if current_status == next_status:
        return
    transitions = USER_TRANSITIONS if is_user else ALLOWED_TRANSITIONS
    allowed = transitions.get(current_status, [])
    if next_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition from '{current_status.value}' to '{next_status.value}'. "
                   f"Allowed transitions: {[s.value for s in allowed] or ['none']}",
        )


async def _attach_sender_names(messages: List[TicketMessage], db: AsyncSession) -> None:
    sender_ids = {m.sender_id for m in messages}
    if sender_ids:
        result = await db.execute(select(User).where(User.id.in_(sender_ids)))
        users = {u.id: u for u in result.scalars().all()}
        for m in messages:
            user = users.get(m.sender_id)
            m.sender_name = user.name if user else "Unknown"


@router.get("/", response_model=List[TicketResponse])
async def list_tickets(
    status_filter: Optional[TicketStatus] = Query(None, alias="status"),
    assigned_to_me: Optional[bool] = Query(None),
    category_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List tickets. Users see own tickets; Agents/Admins see all."""
    query = select(Ticket).options(
        selectinload(Ticket.created_by_user),
        selectinload(Ticket.assigned_to_user),
        selectinload(Ticket.category),
    )

    if current_user.role == UserRole.USER:
        query = query.where(Ticket.created_by_id == current_user.id)
    elif assigned_to_me:
        query = query.where(Ticket.assigned_to_id == current_user.id)

    if status_filter:
        query = query.where(Ticket.status == status_filter)

    if category_id:
        query = query.where(Ticket.category_id == category_id)

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
    result = await db.execute(
        select(Ticket)
        .options(selectinload(Ticket.created_by_user), selectinload(Ticket.assigned_to_user))
        .where(Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

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
    ticket.created_by_user = current_user

    admins = await db.execute(
        select(User).where(User.role.in_([UserRole.ADMIN, UserRole.AGENT]))
    )
    for admin in admins.scalars().all():
        if admin.id != current_user.id:
            await NotificationService.create_notification(
                user_id=admin.id,
                title="New ticket created",
                message=f"{current_user.name} created ticket: {ticket.subject[:100]}",
                link=f"/dashboard/tickets/{ticket.id}",
                db=db,
                notification_type="ticket",
            )

    return ticket


@router.patch("/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: str,
    data: TicketUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """Update ticket status/assignment (Agent/Admin only)."""
    result = await db.execute(
        select(Ticket)
        .options(selectinload(Ticket.created_by_user), selectinload(Ticket.assigned_to_user))
        .where(Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if data.status and data.status != ticket.status:
        enforce_ticket_fsm(ticket.status, data.status)
        ticket.status = data.status
        if data.status == TicketStatus.RESOLVED and not ticket.resolved_at:
            ticket.resolved_at = datetime.now(timezone.utc)

    if data.priority is not None:
        ticket.priority = data.priority
    if data.assigned_to_id is not None:
        ticket.assigned_to_id = data.assigned_to_id
    if data.category_id is not None:
        ticket.category_id = data.category_id

    await db.flush()

    if data.status:
        await NotificationService.create_notification(
            user_id=ticket.created_by_id,
            title=f"Ticket #{ticket.id[:8]} updated",
            message=f"Status changed to '{ticket.status.value}'",
            link=f"/dashboard/tickets/{ticket.id}",
            db=db,
            notification_type="ticket",
        )

    if data.assigned_to_id and data.assigned_to_id != ticket.created_by_id:
        await NotificationService.create_notification(
            user_id=data.assigned_to_id,
            title="New ticket assignment",
            message=f"Ticket '{ticket.subject}' has been assigned to you",
            link=f"/dashboard/tickets/{ticket.id}",
            db=db,
            notification_type="ticket",
        )

    await db.flush()

    await ws_manager.broadcast_to_ticket(
        ticket_id=ticket_id,
        event={
            "type": "ticket_updated",
            "ticket": {
                "id": ticket.id,
                "status": ticket.status.value,
                "subject": ticket.subject,
                "assigned_to_id": ticket.assigned_to_id,
            },
        },
    )

    return ticket


@router.post("/{ticket_id}/close", response_model=TicketResponse)
async def close_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Close a ticket. Users can close their own tickets; Agents/Admins can close any."""
    result = await db.execute(
        select(Ticket)
        .options(selectinload(Ticket.created_by_user), selectinload(Ticket.assigned_to_user))
        .where(Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    is_user = current_user.role == UserRole.USER
    if is_user and ticket.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    enforce_ticket_fsm(ticket.status, TicketStatus.CLOSED, is_user=is_user)
    ticket.status = TicketStatus.CLOSED
    await db.flush()

    await NotificationService.create_notification(
        user_id=ticket.created_by_id,
        title=f"Ticket #{ticket.id[:8]} closed",
        message="Ticket has been closed",
        link=f"/dashboard/tickets/{ticket.id}",
        db=db,
        notification_type="ticket",
    )

    await ws_manager.broadcast_to_ticket(
        ticket_id=ticket_id,
        event={
            "type": "ticket_updated",
            "ticket": {
                "id": ticket.id,
                "status": ticket.status.value,
                "subject": ticket.subject,
                "assigned_to_id": ticket.assigned_to_id,
            },
        },
    )

    return ticket


@router.post("/{ticket_id}/reopen", response_model=TicketResponse)
async def reopen_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reopen a closed ticket. Ticket owner only."""
    result = await db.execute(
        select(Ticket)
        .options(selectinload(Ticket.created_by_user), selectinload(Ticket.assigned_to_user))
        .where(Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the ticket owner can reopen")

    if ticket.status != TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Only closed tickets can be reopened")

    ticket.status = TicketStatus.OPEN
    ticket.resolved_at = None
    await db.flush()

    admins = await db.execute(
        select(User).where(User.role.in_([UserRole.ADMIN, UserRole.AGENT]))
    )
    for admin in admins.scalars().all():
        if admin.id != current_user.id:
            await NotificationService.create_notification(
                user_id=admin.id,
                title=f"Ticket #{ticket.id[:8]} reopened",
                message=f"{current_user.name} reopened ticket: {ticket.subject[:100]}",
                link=f"/dashboard/tickets/{ticket.id}",
                db=db,
                notification_type="ticket",
            )

    await ws_manager.broadcast_to_ticket(
        ticket_id=ticket_id,
        event={
            "type": "ticket_updated",
            "ticket": {
                "id": ticket.id,
                "status": ticket.status.value,
                "subject": ticket.subject,
                "assigned_to_id": ticket.assigned_to_id,
            },
        },
    )

    return ticket


@router.post("/{ticket_id}/assign", response_model=TicketResponse)
async def assign_ticket(
    ticket_id: str,
    data: TicketAssign,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """Assign a ticket to an agent (Agent/Admin only)."""
    result = await db.execute(
        select(Ticket)
        .options(selectinload(Ticket.created_by_user), selectinload(Ticket.assigned_to_user))
        .where(Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    assignee_result = await db.execute(select(User).where(User.id == data.assigned_to_id))
    assignee = assignee_result.scalar_one_or_none()
    if not assignee:
        raise HTTPException(status_code=404, detail="User not found")

    ticket.assigned_to_id = data.assigned_to_id

    if ticket.status == TicketStatus.OPEN:
        ticket.status = TicketStatus.IN_PROGRESS

    await db.flush()

    await NotificationService.create_notification(
        user_id=data.assigned_to_id,
        title="New ticket assignment",
        message=f"Ticket '{ticket.subject[:100]}' has been assigned to you",
        link=f"/dashboard/tickets/{ticket.id}",
        db=db,
        notification_type="ticket",
    )

    await NotificationService.create_notification(
        user_id=ticket.created_by_id,
        title=f"Ticket #{ticket.id[:8]} assigned",
        message=f"Ticket has been assigned to {assignee.name}",
        link=f"/dashboard/tickets/{ticket.id}",
        db=db,
        notification_type="ticket",
    )

    await ws_manager.broadcast_to_ticket(
        ticket_id=ticket_id,
        event={
            "type": "ticket_updated",
            "ticket": {
                "id": ticket.id,
                "status": ticket.status.value,
                "subject": ticket.subject,
                "assigned_to_id": ticket.assigned_to_id,
            },
        },
    )

    return ticket


@router.get("/{ticket_id}/messages", response_model=List[TicketMessageResponse])
async def list_ticket_messages(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all messages in a ticket."""
    query = select(TicketMessage).where(TicketMessage.ticket_id == ticket_id)

    if current_user.role == UserRole.USER:
        query = query.where(TicketMessage.is_internal == False)

    query = query.order_by(TicketMessage.created_at.asc())
    result = await db.execute(query)
    messages = result.scalars().all()
    await _attach_sender_names(messages, db)
    return messages


@router.post("/{ticket_id}/messages", response_model=TicketMessageResponse, status_code=status.HTTP_201_CREATED)
async def add_ticket_message(
    ticket_id: str,
    data: TicketMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a message/reply to a ticket."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if ticket.status == TicketStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Cannot reply to a closed ticket. Reopen it first.")

    if current_user.role == UserRole.USER and ticket.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if data.is_internal and current_user.role == UserRole.USER:
        raise HTTPException(status_code=403, detail="Users cannot create internal notes")

    message = TicketMessage(
        ticket_id=ticket_id,
        sender_id=current_user.id,
        message=data.message,
        is_internal=data.is_internal,
    )
    message.sender_name = current_user.name
    db.add(message)
    await db.flush()

    if not data.is_internal:
        other_user_id = ticket.assigned_to_id if current_user.id == ticket.created_by_id else ticket.created_by_id
        if other_user_id and other_user_id != current_user.id:
            await NotificationService.create_notification(
                user_id=other_user_id,
                title=f"New reply on #{ticket.id[:8]}",
                message=f"{current_user.name} replied: {data.message[:100]}",
                link=f"/dashboard/tickets/{ticket.id}",
                db=db,
                notification_type="ticket",
            )
            await db.flush()

    # Broadcast new message via WebSocket to all ticket subscribers except sender
    await ws_manager.broadcast_to_ticket(
        ticket_id=ticket_id,
        event={
            "type": "new_message",
            "ticket_id": ticket_id,
            "message": {
                "id": message.id,
                "ticket_id": message.ticket_id,
                "sender_id": message.sender_id,
                "sender_name": current_user.name,
                "message": message.message,
                "is_internal": message.is_internal,
                "is_ai_draft": message.is_ai_draft,
                "created_at": message.created_at.isoformat() if message.created_at else None,
            },
        },
        exclude_user_id=current_user.id,
    )

    return message
