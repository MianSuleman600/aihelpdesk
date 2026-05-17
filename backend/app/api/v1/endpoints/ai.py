"""
AI Assistant endpoints: chat, summarize, draft reply.
Placeholder implementations - will integrate LangChain + Pinecone + OpenAI.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.models import User, Ticket, TicketMessage, ChatSession, ChatMessage
from app.schemas.schemas import (
    AIChatRequest, AIChatResponse, AIChatSource,
    AISummarizeRequest, AIDraftReplyRequest,
    AIFeedbackCreate, AIFeedbackResponse,
)
from app.models.models import AIFeedback
from app.api.deps import get_current_user, require_agent_or_admin

router = APIRouter()


@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(
    data: AIChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI Chat - Ask questions and get KB-grounded answers.
    
    Pipeline:
    1. Generate embedding for user query
    2. Search Pinecone for relevant KB chunks
    3. Build prompt with retrieved context
    4. Generate answer via OpenAI with citations
    5. Return answer + sources
    """
    # TODO: Integrate RAG pipeline (LangChain + Pinecone + OpenAI)
    # For now, return a placeholder response

    # Create or retrieve chat session
    session_id = data.session_id
    if not session_id:
        session = ChatSession(user_id=current_user.id, title=data.query[:50])
        db.add(session)
        await db.flush()
        session_id = session.id

    # Save user message
    user_msg = ChatMessage(
        session_id=session_id,
        role="user",
        content=data.query,
    )
    db.add(user_msg)

    # Placeholder AI response
    ai_answer = (
        f"Thank you for your question about: '{data.query}'. "
        "This is a placeholder response. Once the RAG pipeline is connected, "
        "I will search the Knowledge Base and provide grounded answers with citations."
    )

    # Save AI message
    ai_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=ai_answer,
        sources=[],
    )
    db.add(ai_msg)
    await db.flush()

    return AIChatResponse(
        answer=ai_answer,
        sources=[],
        confidence=0.0,
        session_id=session_id,
        suggest_ticket=True,
    )


@router.post("/summarize")
async def summarize_ticket(
    data: AISummarizeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """
    AI Ticket Summarization - Generate a summary of ticket conversation.
    Agent/Admin only.
    """
    # Fetch ticket and messages
    result = await db.execute(select(Ticket).where(Ticket.id == data.ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    msgs_result = await db.execute(
        select(TicketMessage)
        .where(TicketMessage.ticket_id == data.ticket_id)
        .order_by(TicketMessage.created_at.asc())
    )
    messages = msgs_result.scalars().all()

    # TODO: Integrate OpenAI summarization
    summary = (
        f"**Ticket Summary: {ticket.subject}**\n\n"
        f"Status: {ticket.status.value} | Priority: {ticket.priority.value}\n"
        f"Total messages: {len(messages)}\n\n"
        "This is a placeholder summary. Integration with OpenAI will provide "
        "an intelligent summary of the full ticket conversation."
    )

    return {"summary": summary, "message_count": len(messages)}


@router.post("/draft-reply")
async def draft_reply(
    data: AIDraftReplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent_or_admin),
):
    """
    AI Draft Reply - Generate a suggested response for a ticket.
    Agent/Admin only.
    """
    # Fetch ticket
    result = await db.execute(select(Ticket).where(Ticket.id == data.ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # TODO: Integrate OpenAI + RAG for draft generation
    draft = (
        f"Dear User,\n\n"
        f"Thank you for reaching out regarding '{ticket.subject}'.\n\n"
        "This is a placeholder draft reply. Once connected to the AI pipeline, "
        "it will generate a professional response based on the ticket context "
        "and relevant Knowledge Base articles.\n\n"
        "Best regards,\nSupport Team"
    )

    return {"draft": draft, "is_ai_generated": True}


@router.post("/feedback", response_model=AIFeedbackResponse, status_code=201)
async def submit_feedback(
    data: AIFeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit feedback on an AI response (thumbs up/down)."""
    feedback = AIFeedback(
        user_id=current_user.id,
        **data.model_dump(),
    )
    db.add(feedback)
    await db.flush()
    await db.refresh(feedback)
    return feedback
