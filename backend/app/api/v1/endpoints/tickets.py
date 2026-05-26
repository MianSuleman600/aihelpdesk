"""
Ticket management endpoints: CRUD, status workflow, messages, attachments.
"""

import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.models import Ticket, TicketMessage, TicketAttachment, TicketEvent, TicketEventType, User, UserRole, TicketStatus, Priority
from app.services.notification_service import NotificationService
from app.schemas.schemas import (
    TicketCreate, TicketUpdate, TicketResponse, TicketAssign,
    TicketMessageCreate, TicketMessageResponse, TicketEventResponse, PaginatedResponse,
    TicketAttachmentResponse,
)
from app.api.deps import get_current_user, require_agent_or_admin
from app.core.config import settings
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


async def _record_ticket_event(
    ticket_id: str,
    user_id: Optional[str],
    event_type: TicketEventType,
    db: AsyncSession,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    description: Optional[str] = None,
) -> TicketEvent:
    event = TicketEvent(
        ticket_id=ticket_id,
        user_id=user_id,
        event_type=event_type,
        old_value=old_value,
        new_value=new_value,
        description=description,
    )
    db.add(event)
    return event


@router.get("/", response_model=PaginatedResponse[TicketResponse])
async def list_tickets(
    search: Optional[str] = Query(None),
    status_filter: Optional[TicketStatus] = Query(None, alias="status"),
    priority: Optional[Priority] = Query(None),
    assigned_to_me: Optional[bool] = Query(None),
    category_id: Optional[str] = Query(None),
    unassigned: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List tickets. Users see own tickets; Agents/Admins see all."""

    def _apply_filters(q):
        if current_user.role == UserRole.USER:
            q = q.where(Ticket.created_by_id == current_user.id)
        elif assigned_to_me:
            q = q.where(Ticket.assigned_to_id == current_user.id)
        if status_filter:
            q = q.where(Ticket.status == status_filter)
        if priority:
            q = q.where(Ticket.priority == priority)
        if category_id:
            q = q.where(Ticket.category_id == category_id)
        if unassigned:
            q = q.where(Ticket.assigned_to_id.is_(None))
        if search:
            pattern = f"%{search}%"
            q = q.where(Ticket.subject.ilike(pattern) | Ticket.description.ilike(pattern))
        return q

    query = _apply_filters(select(Ticket).options(
        selectinload(Ticket.created_by_user),
        selectinload(Ticket.assigned_to_user),
        selectinload(Ticket.category),
        selectinload(Ticket.attachments),
    ))

    count_q = _apply_filters(select(func.count(Ticket.id)))
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    query = query.order_by(Ticket.updated_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()

    return PaginatedResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific ticket."""
    result = await db.execute(
        select(Ticket)
        .options(selectinload(Ticket.created_by_user), selectinload(Ticket.assigned_to_user), selectinload(Ticket.attachments))
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

    # Eager-load relationships for response serialization
    result = await db.execute(
        select(Ticket)
        .options(selectinload(Ticket.created_by_user), selectinload(Ticket.assigned_to_user), selectinload(Ticket.attachments))
        .where(Ticket.id == ticket.id)
    )
    ticket = result.scalar_one()

    await _record_ticket_event(
        ticket_id=ticket.id,
        user_id=current_user.id,
        event_type=TicketEventType.CREATED,
        db=db,
        new_value=ticket.status.value,
        description="Ticket created",
    )

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
        .options(selectinload(Ticket.created_by_user), selectinload(Ticket.assigned_to_user), selectinload(Ticket.attachments))
        .where(Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if data.status and data.status != ticket.status:
        enforce_ticket_fsm(ticket.status, data.status)
        old_status = ticket.status.value
        ticket.status = data.status
        if data.status == TicketStatus.RESOLVED and not ticket.resolved_at:
            ticket.resolved_at = datetime.now(timezone.utc)
        await _record_ticket_event(
            ticket_id=ticket_id,
            user_id=current_user.id,
            event_type=TicketEventType.STATUS_CHANGED,
            db=db,
            old_value=old_status,
            new_value=ticket.status.value,
        )

    if data.priority is not None and data.priority != ticket.priority:
        old_priority = ticket.priority.value
        ticket.priority = data.priority
        await _record_ticket_event(
            ticket_id=ticket_id,
            user_id=current_user.id,
            event_type=TicketEventType.PRIORITY_CHANGED,
            db=db,
            old_value=old_priority,
            new_value=ticket.priority.value,
        )

    if data.assigned_to_id is not None and data.assigned_to_id != ticket.assigned_to_id:
        old_assignee = ticket.assigned_to_id
        ticket.assigned_to_id = data.assigned_to_id
        await _record_ticket_event(
            ticket_id=ticket_id,
            user_id=current_user.id,
            event_type=TicketEventType.ASSIGNED,
            db=db,
            old_value=old_assignee or "unassigned",
            new_value=data.assigned_to_id,
        )

    if data.category_id is not None and data.category_id != ticket.category_id:
        old_cat = ticket.category_id
        ticket.category_id = data.category_id
        await _record_ticket_event(
            ticket_id=ticket_id,
            user_id=current_user.id,
            event_type=TicketEventType.CATEGORY_CHANGED,
            db=db,
            old_value=old_cat or "none",
            new_value=data.category_id,
        )

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
        .options(selectinload(Ticket.created_by_user), selectinload(Ticket.assigned_to_user), selectinload(Ticket.attachments))
        .where(Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    is_user = current_user.role == UserRole.USER
    if is_user and ticket.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    enforce_ticket_fsm(ticket.status, TicketStatus.CLOSED, is_user=is_user)
    old_status = ticket.status.value
    ticket.status = TicketStatus.CLOSED
    await _record_ticket_event(
        ticket_id=ticket_id,
        user_id=current_user.id,
        event_type=TicketEventType.CLOSED,
        db=db,
        old_value=old_status,
        new_value=TicketStatus.CLOSED.value,
    )
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
        .options(selectinload(Ticket.created_by_user), selectinload(Ticket.assigned_to_user), selectinload(Ticket.attachments))
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
    await _record_ticket_event(
        ticket_id=ticket_id,
        user_id=current_user.id,
        event_type=TicketEventType.REOPENED,
        db=db,
        old_value=TicketStatus.CLOSED.value,
        new_value=TicketStatus.OPEN.value,
    )
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
        .options(selectinload(Ticket.created_by_user), selectinload(Ticket.assigned_to_user), selectinload(Ticket.attachments))
        .where(Ticket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    assignee_result = await db.execute(select(User).where(User.id == data.assigned_to_id))
    assignee = assignee_result.scalar_one_or_none()
    if not assignee:
        raise HTTPException(status_code=404, detail="User not found")

    old_assignee = ticket.assigned_to_id
    ticket.assigned_to_id = data.assigned_to_id

    await _record_ticket_event(
        ticket_id=ticket_id,
        user_id=current_user.id,
        event_type=TicketEventType.ASSIGNED,
        db=db,
        old_value=old_assignee or "unassigned",
        new_value=data.assigned_to_id,
        description=f"Assigned to {assignee.name}",
    )

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


@router.get("/{ticket_id}/messages", response_model=PaginatedResponse[TicketMessageResponse])
async def list_ticket_messages(
    ticket_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List messages in a ticket with pagination."""
    query = select(TicketMessage).where(TicketMessage.ticket_id == ticket_id)
    query = query.options(selectinload(TicketMessage.sender))

    if current_user.role == UserRole.USER:
        query = query.where(TicketMessage.is_internal == False)

    count_q = select(func.count(TicketMessage.id)).where(TicketMessage.ticket_id == ticket_id)
    if current_user.role == UserRole.USER:
        count_q = count_q.where(TicketMessage.is_internal == False)
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    query = query.order_by(TicketMessage.created_at.asc()).offset(skip).limit(limit)
    result = await db.execute(query)
    messages = result.scalars().all()
    await _attach_sender_names(messages, db)
    return PaginatedResponse(items=messages, total=total, skip=skip, limit=limit)


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


@router.get("/{ticket_id}/events", response_model=List[TicketEventResponse])
async def list_ticket_events(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get event timeline for a ticket (authenticated users with access)."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user.role == UserRole.USER and ticket.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    events_result = await db.execute(
        select(TicketEvent)
        .options(selectinload(TicketEvent.user))
        .where(TicketEvent.ticket_id == ticket_id)
        .order_by(TicketEvent.created_at.asc())
    )
    events = events_result.scalars().all()
    response = []
    for ev in events:
        resp = TicketEventResponse(
            id=ev.id,
            ticket_id=ev.ticket_id,
            user_id=ev.user_id,
            event_type=ev.event_type.value if hasattr(ev.event_type, 'value') else str(ev.event_type),
            old_value=ev.old_value,
            new_value=ev.new_value,
            description=ev.description,
            created_at=ev.created_at,
            user_name=ev.user.name if ev.user else None,
        )
        response.append(resp)
    return response


# --- Ticket Attachments ---

TICKET_UPLOAD_DIR = settings.TICKET_UPLOAD_DIR or "uploads/tickets"


@router.post("/{ticket_id}/attachments", response_model=TicketAttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_ticket_attachment(
    ticket_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a file attachment to a ticket (authenticated users)."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    # Only ticket creator or agent/admin can upload
    if ticket.created_by_id != current_user.id and current_user.role not in (UserRole.ADMIN, UserRole.AGENT):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    ext = os.path.splitext(file.filename or "unknown")[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported file type: {ext}")
    if (file.size or 0) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"File too large (max {settings.MAX_UPLOAD_SIZE_MB}MB)")

    os.makedirs(TICKET_UPLOAD_DIR, exist_ok=True)
    file_id = str(uuid.uuid4())
    safe_name = f"{file_id}{ext}"
    file_path = os.path.join(TICKET_UPLOAD_DIR, safe_name)
    content = await file.read()
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    attachment = TicketAttachment(
        ticket_id=ticket_id,
        file_url=f"/uploads/tickets/{safe_name}",
        file_name=file.filename or safe_name,
        file_type=ext,
        file_size=len(content),
    )
    db.add(attachment)
    await db.flush()
    await db.refresh(attachment)
    return attachment


@router.get("/{ticket_id}/attachments", response_model=List[TicketAttachmentResponse])
async def list_ticket_attachments(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all attachments for a ticket."""
    result = await db.execute(
        select(TicketAttachment).where(TicketAttachment.ticket_id == ticket_id).order_by(TicketAttachment.created_at)
    )
    return result.scalars().all()


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket_attachment(
    attachment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a ticket attachment (admin/agent or attachment owner)."""
    result = await db.execute(select(TicketAttachment).where(TicketAttachment.id == attachment_id))
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    file_path = os.path.join(TICKET_UPLOAD_DIR, os.path.basename(attachment.file_url))
    if os.path.exists(file_path):
        os.remove(file_path)
    await db.delete(attachment)
    await db.flush()
