"""
AI service layer: chat, summarization, draft replies.
Uses LangChain + OpenAI with RAG from the knowledge base.
"""

import asyncio
import json
from typing import List, Optional, AsyncGenerator, Tuple
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from app.core.config import settings
from app.models.models import (
    User, Ticket, TicketMessage, ChatSession, ChatMessage, KBArticle,
)
from app.schemas.schemas import (
    AIChatResponse, AIChatSource, AISummarizeRequest,
)
from app.services.embedding_service import EmbeddingService

from app.services.pinecone_service import PineconeService

# Lazy LLM — created on first use, not at import time
_llm: Optional[ChatOpenAI] = None


def get_llm() -> ChatOpenAI:
    global _llm
    if _llm is None:
        use_openrouter = settings.LLM_PROVIDER == "openrouter" and settings.OPENROUTER_API_KEY

        if use_openrouter:
            _llm = ChatOpenAI(
                model=settings.OPENROUTER_MODEL,
                temperature=0.3,
                timeout=30,
                max_retries=3,
                base_url=settings.OPENROUTER_BASE_URL,
                api_key=settings.OPENROUTER_API_KEY,
                default_headers={
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "HelpDesk AI",
                },
            )
        elif settings.OPENAI_API_KEY:
            _llm = ChatOpenAI(
                model=settings.OPENAI_MODEL,
                temperature=0.3,
                timeout=30,
                max_retries=3,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No LLM provider configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY in .env",
            )
    return _llm


class AIService:
    """Service layer for AI-powered operations."""

    # ------------------------------------------------------------------
    # Chat
    # ------------------------------------------------------------------

    @staticmethod
    async def chat(
        query: str,
        session_id: Optional[str],
        db: AsyncSession,
        current_user: User,
    ) -> AIChatResponse:
        """
        Answer a user query grounded in the knowledge base.

        Pipeline:
        1. Retrieve or create chat session
        2. Save user message
        3. Fetch last 10 messages for context
        4. Search KB for relevant chunks via embeddings
        5. Build system prompt with grounding rules
        6. Generate answer via OpenAI
        7. Save assistant response with sources
        8. Return answer, sources, confidence
        """
        # --- 1. Session management ---
        if session_id:
            result = await db.execute(
                select(ChatSession).where(
                    ChatSession.id == session_id,
                    ChatSession.user_id == current_user.id,
                )
            )
            session = result.scalar_one_or_none()
            if not session:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Chat session not found",
                )
        else:
            session = ChatSession(
                user_id=current_user.id,
                title=query[:100],
            )
            db.add(session)
            await db.flush()

        # --- 2. Save user message ---
        user_msg = ChatMessage(
            session_id=session.id,
            role="user",
            content=query,
        )
        db.add(user_msg)
        await db.flush()

        # --- 3. Fetch history (last 10 messages) ---
        history_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(10)
        )
        history_messages = list(reversed(history_result.scalars().all()))

        # --- 4. Search for relevant context via Pinecone ---
        sources: List[AIChatSource] = []
        context_text = ""

        try:
            pinecone_results = await PineconeService.query_all_namespaces(
                query_text=query,
                top_k_per_ns=10,
                top_k_final=5,
            )

            if pinecone_results:
                context_parts = []
                seen_sources = set()

                for r in pinecone_results:
                    meta = r.get("metadata", {})
                    title = meta.get("title", "Untitled")
                    snippet = (meta.get("text_snippet", "") or "")[:300]
                    source_key = meta.get("doc_id", meta.get("article_id", r["id"]))

                    if source_key not in seen_sources:
                        seen_sources.add(source_key)
                        sources.append(AIChatSource(
                            article_id=source_key,
                            title=title,
                            relevance_score=round(r["score"], 4),
                            snippet=snippet,
                        ))

                    context_parts.append(
                        f"Source: {title}\nContent: {meta.get('text_snippet', '')}"
                    )

                context_text = "\n\n---\n\n".join(context_parts)

            # Fallback: if Pinecone returned nothing or is not configured,
            # do in-memory search on KB articles
            if not context_text:
                query_embedding = await EmbeddingService.generate_embedding(query)
                kb_result = await db.execute(
                    select(KBArticle).where(KBArticle.is_published == True)
                )
                articles = kb_result.scalars().all()

                if articles:
                    article_embeddings = []
                    article_map = []
                    for article in articles:
                        chunks = EmbeddingService.chunk_text(
                            f"{article.title}\n\n{article.body}"
                        )
                        for chunk in chunks:
                            chunk_embedding = await EmbeddingService.generate_embedding(chunk)
                            article_embeddings.append(chunk_embedding)
                            article_map.append((article, chunk))

                    if article_embeddings:
                        results = EmbeddingService.search_embeddings(
                            query_embedding, article_embeddings, k=5
                        )
                        mmr_indices = EmbeddingService.mmr_rerank(
                            query_embedding, article_embeddings, lambda_param=0.5, k=5
                        )

                        seen_article_ids = set()
                        for idx, score in results:
                            article, chunk = article_map[idx]
                            if article.id not in seen_article_ids:
                                sources.append(AIChatSource(
                                    article_id=article.id,
                                    title=article.title,
                                    relevance_score=round(score, 4),
                                    snippet=chunk[:300],
                                ))
                                seen_article_ids.add(article.id)

                        context_parts = []
                        for idx in mmr_indices:
                            article, chunk = article_map[idx]
                            context_parts.append(
                                f"Source: {article.title}\nContent: {chunk}"
                            )
                        context_text = "\n\n---\n\n".join(context_parts)
        except Exception:
            context_text = ""
            sources = []

        # --- 5. Build messages ---
        system_content = (
            "You are a helpful and professional support assistant for our Helpdesk. "
            "Answer the user's question using ONLY the provided context below. "
            "If the context does not contain enough information to answer, "
            "say so honestly and suggest that the user create a support ticket. "
            "Do NOT make up information or use external knowledge. "
            "Keep answers concise, accurate, and helpful.\n\n"
            f"Context:\n{context_text if context_text else 'No relevant context found.'}"
        )

        messages = [SystemMessage(content=system_content)]
        for msg in history_messages:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            else:
                messages.append(AIMessage(content=msg.content))
        messages.append(HumanMessage(content=query))

        # --- 6. Generate answer ---
        confidence = 0.0
        try:
            response = await get_llm().ainvoke(messages)
            answer = response.content

            if sources:
                confidence = max(s.relevance_score for s in sources)
            elif context_text:
                confidence = 0.5
            else:
                confidence = 0.0
        except Exception as e:
            answer = (
                "I'm sorry, I'm having trouble connecting to my knowledge base right now. "
                "Please try again later, or feel free to create a support ticket "
                "and an agent will assist you."
            )
            confidence = 0.0

        # --- 7. Save assistant message ---
        ai_msg = ChatMessage(
            session_id=session.id,
            role="assistant",
            content=answer,
            sources=[s.model_dump() for s in sources] if sources else None,
        )
        db.add(ai_msg)
        await db.flush()

        # --- 8. Build response ---
        suggest_ticket = confidence < EmbeddingService.CONFIDENCE_THRESHOLD

        return AIChatResponse(
            answer=answer,
            sources=sources,
            confidence=round(confidence, 4),
            session_id=session.id,
            suggest_ticket=suggest_ticket,
        )

    @staticmethod
    async def streaming_chat(
        query: str,
        session_id: Optional[str],
        db: AsyncSession,
        current_user: User,
    ) -> AsyncGenerator[str, None]:
        """
        SSE streaming version of chat.

        Yields SSE-formatted events:
          - data: {"type": "meta", "session_id": "...", "sources": [...], "confidence": 0.0}
          - data: {"type": "chunk", "content": "..."}
          - data: {"type": "done", "full_content": "..."}
        """
        # --- Session & history prep (same as chat) ---
        if session_id:
            result = await db.execute(
                select(ChatSession).where(
                    ChatSession.id == session_id,
                    ChatSession.user_id == current_user.id,
                )
            )
            session = result.scalar_one_or_none()
            if not session:
                yield f"data: {json.dumps({'type': 'error', 'detail': 'Chat session not found'})}\n\n"
                return
        else:
            session = ChatSession(
                user_id=current_user.id,
                title=query[:100],
            )
            db.add(session)
            await db.flush()

        user_msg = ChatMessage(
            session_id=session.id, role="user", content=query,
        )
        db.add(user_msg)
        await db.flush()

        history_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(10)
        )
        history_messages = list(reversed(history_result.scalars().all()))

        # --- Context retrieval via Pinecone ---
        sources: List[dict] = []
        context_text = ""
        try:
            pinecone_results = await PineconeService.query_all_namespaces(
                query_text=query,
                top_k_per_ns=10,
                top_k_final=5,
            )

            if pinecone_results:
                context_parts = []
                seen_sources = set()
                for r in pinecone_results:
                    meta = r.get("metadata", {})
                    title = meta.get("title", "Untitled")
                    source_key = meta.get("doc_id", meta.get("article_id", r["id"]))
                    if source_key not in seen_sources:
                        seen_sources.add(source_key)
                        sources.append({
                            "article_id": source_key,
                            "title": title,
                            "relevance_score": round(r["score"], 4),
                            "snippet": (meta.get("text_snippet", "") or "")[:300],
                        })
                    context_parts.append(
                        f"Source: {title}\nContent: {meta.get('text_snippet', '')}"
                    )
                context_text = "\n\n---\n\n".join(context_parts)

            # Fallback in-memory search
            if not context_text:
                kb_result = await db.execute(
                    select(KBArticle).where(KBArticle.is_published == True)
                )
                articles = kb_result.scalars().all()
                if articles:
                    query_embedding = await EmbeddingService.generate_embedding(query)
                    article_embeddings = []
                    article_map = []
                    for article in articles:
                        chunks = EmbeddingService.chunk_text(
                            f"{article.title}\n\n{article.body}"
                        )
                        for chunk in chunks:
                            chunk_embedding = await EmbeddingService.generate_embedding(chunk)
                            article_embeddings.append(chunk_embedding)
                            article_map.append((article, chunk))

                    if article_embeddings:
                        results = EmbeddingService.search_embeddings(
                            query_embedding, article_embeddings, k=5
                        )
                        seen_ids = set()
                        for idx, score in results:
                            article, chunk = article_map[idx]
                            if article.id not in seen_ids:
                                sources.append({
                                    "article_id": article.id,
                                    "title": article.title,
                                    "relevance_score": round(score, 4),
                                    "snippet": chunk[:300],
                                })
                                seen_ids.add(article.id)
                        mmr_indices = EmbeddingService.mmr_rerank(
                            query_embedding, article_embeddings, lambda_param=0.5, k=5
                        )
                        context_parts = []
                        for idx in mmr_indices:
                            article, chunk = article_map[idx]
                            context_parts.append(
                                f"Source: {article.title}\nContent: {chunk}"
                            )
                        context_text = "\n\n---\n\n".join(context_parts)
        except Exception:
            context_text = ""
            sources = []

        confidence = max((s["relevance_score"] for s in sources), default=0.0)

        # --- Send meta event ---
        yield f"data: {json.dumps({'type': 'meta', 'session_id': session.id, 'sources': sources, 'confidence': confidence})}\n\n"

        # --- Build messages ---
        system_content = (
            "You are a helpful and professional support assistant for our Helpdesk. "
            "Answer the user's question using ONLY the provided context below. "
            "If the context does not contain enough information to answer, "
            "say so honestly and suggest that the user create a support ticket. "
            "Do NOT make up information or use external knowledge. "
            "Keep answers concise, accurate, and helpful.\n\n"
            f"Context:\n{context_text if context_text else 'No relevant context found.'}"
        )

        langchain_messages = [SystemMessage(content=system_content)]
        for msg in history_messages:
            if msg.role == "user":
                langchain_messages.append(HumanMessage(content=msg.content))
            else:
                langchain_messages.append(AIMessage(content=msg.content))
        langchain_messages.append(HumanMessage(content=query))

        # --- Streaming generation ---
        collected_tokens: List[str] = []
        try:
            use_openrouter = settings.LLM_PROVIDER == "openrouter" and settings.OPENROUTER_API_KEY
            streaming_llm = ChatOpenAI(
                model=settings.OPENROUTER_MODEL if use_openrouter else settings.OPENAI_MODEL,
                temperature=0.3,
                timeout=30,
                max_retries=3,
                streaming=True,
                base_url=settings.OPENROUTER_BASE_URL if use_openrouter else None,
                api_key=settings.OPENROUTER_API_KEY if use_openrouter else None,
                default_headers={
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "HelpDesk AI",
                } if use_openrouter else None,
            )
            async for chunk in streaming_llm.astream(langchain_messages):
                token = chunk.content
                collected_tokens.append(token)
                yield f"data: {json.dumps({'type': 'chunk', 'content': token})}\n\n"
        except Exception:
            fallback = (
                "I'm sorry, I'm having trouble connecting to my knowledge base right now. "
                "Please try again later, or create a support ticket for assistance."
            )
            collected_tokens = [fallback]
            yield f"data: {json.dumps({'type': 'chunk', 'content': fallback})}\n\n"

        full_answer = "".join(collected_tokens)

        # --- Save assistant message ---
        ai_msg = ChatMessage(
            session_id=session.id,
            role="assistant",
            content=full_answer,
            sources=sources if sources else None,
        )
        db.add(ai_msg)
        await db.flush()

        # --- Done ---
        yield f"data: {json.dumps({'type': 'done', 'full_content': full_answer, 'session_id': session.id})}\n\n"

    # ------------------------------------------------------------------
    # Summarize Ticket
    # ------------------------------------------------------------------

    @staticmethod
    async def summarize_ticket(
        ticket_id: str,
        db: AsyncSession,
    ) -> dict:
        """
        Generate an AI summary of a ticket's conversation.

        Args:
            ticket_id: ID of the ticket
            db: Database session

        Returns:
            Dictionary with summary and message_count

        Raises:
            HTTPException: If ticket not found
        """
        result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
        ticket = result.scalar_one_or_none()
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found",
            )

        msgs_result = await db.execute(
            select(TicketMessage)
            .where(TicketMessage.ticket_id == ticket_id)
            .order_by(TicketMessage.created_at.asc())
        )
        messages = msgs_result.scalars().all()

        if not messages:
            return {
                "summary": f"**{ticket.subject}**\n\nNo messages in this ticket yet.",
                "message_count": 0,
            }

        conversation_text = "\n".join(
            f"[{m.created_at.strftime('%Y-%m-%d %H:%M')}] "
            f"{'Agent' if m.is_internal else 'User'}: {m.message}"
            for m in messages
        )

        prompt = (
            f"Summarize the following support ticket conversation.\n\n"
            f"Subject: {ticket.subject}\n"
            f"Status: {ticket.status.value}\n"
            f"Priority: {ticket.priority.value}\n\n"
            f"Conversation:\n{conversation_text}\n\n"
            "Provide a concise summary covering: the issue, key points discussed, "
            "any resolution steps taken, and current status."
        )

        try:
            use_or = settings.LLM_PROVIDER == "openrouter" and settings.OPENROUTER_API_KEY
            summary_llm = ChatOpenAI(
                model=settings.OPENROUTER_MODEL if use_or else settings.OPENAI_MODEL,
                temperature=0.2,
                timeout=30,
                max_retries=3,
                base_url=settings.OPENROUTER_BASE_URL if use_or else None,
                api_key=settings.OPENROUTER_API_KEY if use_or else None,
                default_headers={"HTTP-Referer": "http://localhost:3000", "X-Title": "HelpDesk AI"} if use_or else None,
            )
            response = await summary_llm.ainvoke(
                [HumanMessage(content=prompt)]
            )
            summary = response.content
        except Exception:
            summary = (
                f"**Ticket Summary: {ticket.subject}**\n\n"
                f"Status: {ticket.status.value} | Priority: {ticket.priority.value}\n"
                f"Total messages: {len(messages)}\n\n"
                "AI summarization is currently unavailable."
            )

        return {
            "summary": summary,
            "message_count": len(messages),
        }

    # ------------------------------------------------------------------
    # Draft Reply
    # ------------------------------------------------------------------

    @staticmethod
    async def draft_reply(
        ticket_id: str,
        db: AsyncSession,
    ) -> dict:
        """
        Generate an AI draft reply for a ticket.

        Args:
            ticket_id: ID of the ticket
            db: Database session

        Returns:
            Dictionary with draft and is_ai_generated

        Raises:
            HTTPException: If ticket not found
        """
        result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
        ticket = result.scalar_one_or_none()
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ticket not found",
            )

        msgs_result = await db.execute(
            select(TicketMessage)
            .where(TicketMessage.ticket_id == ticket_id)
            .where(TicketMessage.is_internal == False)
            .order_by(TicketMessage.created_at.asc())
        )
        messages = msgs_result.scalars().all()

        if not messages:
            return {
                "draft": (
                    f"Dear User,\n\n"
                    f"Thank you for reaching out regarding '{ticket.subject}'. "
                    "We have received your request and will get back to you shortly.\n\n"
                    "Best regards,\nSupport Team"
                ),
                "is_ai_generated": True,
            }

        conversation_text = "\n".join(
            f"User: {m.message}" for m in messages
        )

        # Search KB for related context
        kb_context = ""
        try:
            kb_articles = await db.execute(
                select(KBArticle).where(KBArticle.is_published == True)
            )
            articles = kb_articles.scalars().all()
            if articles:
                all_texts = [
                    f"{a.title}\n{a.body}" for a in articles
                ]
                query_text = f"{ticket.subject}\n{messages[-1].message}"
                query_emb = await EmbeddingService.generate_embedding(query_text)
                article_embeddings = [
                    await EmbeddingService.generate_embedding(t) for t in all_texts
                ]
                results = EmbeddingService.search_embeddings(
                    query_emb, article_embeddings, k=3
                )
                related = []
                for idx, score in results:
                    related.append(f"{articles[idx].title}\n{articles[idx].body[:500]}")
                if related:
                    kb_context = "\n\n---\n\n".join(related)
        except Exception:
            kb_context = ""

        prompt_parts = [
            "You are a professional customer support agent. Draft a reply to the following ticket.",
            f"\nSubject: {ticket.subject}",
            f"\nConversation history:\n{conversation_text}",
        ]
        if kb_context:
            prompt_parts.append(
                f"\nRelevant knowledge base articles:\n{kb_context}\n\n"
                "Use information from these articles to provide an accurate, helpful response."
            )
        prompt_parts.append(
            "\n\nWrite a professional, empathetic, and clear response. "
            "Sign off as 'Support Team'. Do not invent information not present in the context."
        )

        prompt = "".join(prompt_parts)

        try:
            use_or = settings.LLM_PROVIDER == "openrouter" and settings.OPENROUTER_API_KEY
            draft_llm = ChatOpenAI(
                model=settings.OPENROUTER_MODEL if use_or else settings.OPENAI_MODEL,
                temperature=0.4,
                timeout=30,
                max_retries=3,
                base_url=settings.OPENROUTER_BASE_URL if use_or else None,
                api_key=settings.OPENROUTER_API_KEY if use_or else None,
                default_headers={"HTTP-Referer": "http://localhost:3000", "X-Title": "HelpDesk AI"} if use_or else None,
            )
            response = await draft_llm.ainvoke(
                [HumanMessage(content=prompt)]
            )
            draft = response.content
        except Exception:
            draft = (
                f"Dear User,\n\n"
                f"Thank you for reaching out regarding '{ticket.subject}'. "
                "We have received your message and are reviewing it. "
                "We will get back to you as soon as possible.\n\n"
                "Best regards,\nSupport Team"
            )

        return {
            "draft": draft,
            "is_ai_generated": True,
        }
