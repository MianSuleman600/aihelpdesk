"""
AI Assistant endpoints: chat, summarize, draft reply, feedback.
Integrates LangChain + OpenAI for RAG-grounded answers.
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.models import User, Ticket, TicketMessage, ChatSession, ChatMessage, AIFeedback
from app.schemas.schemas import (
    AIChatRequest, AIChatResponse, AIChatSource,
    AISummarizeRequest, AIDraftReplyRequest,
    AIFeedbackCreate, AIFeedbackResponse,
)
from app.api.deps import get_current_user, require_agent_or_admin
from app.services.ai_service import AIService
from app.services.embedding_service import EmbeddingService

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
    2. Search KB for relevant chunks via cosine similarity + MMR
    3. Build prompt with retrieved context
    4. Generate answer via OpenAI
    5. Return answer + sources + confidence
    """
    result = await AIService.chat(
        query=data.query,
        session_id=data.session_id,
        db=db,
        current_user=current_user,
    )
    return result


@router.post("/chat/stream")
async def ai_chat_stream(
    data: AIChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    SSE streaming version of AI Chat.
    Yields events: meta (sources), chunk (token), done (full content).
    """
    return StreamingResponse(
        AIService.streaming_chat(
            query=data.query,
            session_id=data.session_id,
            db=db,
            current_user=current_user,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
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
    result = await AIService.summarize_ticket(
        ticket_id=data.ticket_id,
        db=db,
    )
    return result


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
    result = await AIService.draft_reply(
        ticket_id=data.ticket_id,
        db=db,
    )
    return result


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
