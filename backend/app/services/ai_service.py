"""
AI service layer: chat, summarization, draft replies.
Uses ModelRouter for automatic model fallback across multiple free/paid models.
Features: query rewriting, hybrid search, structured prompt with CoT and citations.
"""

import asyncio
import json
import re
import logging
from typing import List, Optional, AsyncGenerator, Tuple
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from app.core.config import settings
from app.core.model_router import get_model_router, ModelEntry
from app.models.models import (
    User, Ticket, TicketMessage, ChatSession, ChatMessage, KBArticle,
)
from app.schemas.schemas import (
    AIChatResponse, AIChatSource, AISummarizeRequest,
)
from app.services.embedding_service import EmbeddingService, CONFIDENCE_THRESHOLD

from app.services.pinecone_service import PineconeService

logger = logging.getLogger(__name__)


async def _llm_ainvoke_with_fallback(
    messages: list,
    temperature: float = 0.3,
    streaming: bool = False,
    max_retries: int = 3,
) -> Tuple[str, str]:
    """
    Call LLM with automatic model fallback on rate limits.
    Returns (content, model_used).
    """
    router = get_model_router()
    last_error = None

    for attempt in range(max_retries):
        entry = router.next_chat_model()
        if entry is None:
            raise RuntimeError("No chat models available")

        try:
            model_id = entry.model_id
            llm = router.build_chat_llm(entry, temperature=temperature, streaming=streaming)

            if streaming:
                collected = []
                async for chunk in llm.astream(messages):
                    token = chunk.content
                    collected.append(token)
                content = "".join(collected)
            else:
                response = await llm.ainvoke(messages)
                content = response.content

            return content, model_id

        except Exception as e:
            error_str = str(e).lower()
            last_error = e

            if "429" in error_str or "rate limit" in error_str or "too many requests" in error_str:
                router.mark_rate_limited(model_id, purpose="chat")
                logger.warning("Model %s rate-limited, trying next (attempt %d/%d)", model_id, attempt + 1, max_retries)
                await asyncio.sleep(1 * (attempt + 1))
                continue

            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue

            raise last_error

    raise last_error or RuntimeError("All models exhausted")


def _rewrite_query(query: str, history: str = "") -> str:
    """
    Rewrite user query into a better search query using simple heuristics
    (no extra LLM cost). Expands abbreviations, adds context, normalizes.
    """
    expanded = query.strip()

    expansions = {
        r'\bpls\b': 'please',
        r'\bhow\s+to\b': 'steps to',
        r'\bwhat\s+is\b': 'explain',
        r'\btell\s+me\b': '',
        r'\bi\s+need\b': '',
        r'\bplz\b': 'please',
        r'\bthx\b': 'thanks',
        r'\bu\b': 'you',
        r'\bur\b': 'your',
    }

    for pattern, replacement in expansions.items():
        expanded = re.sub(pattern, replacement, expanded, flags=re.IGNORECASE)

    expanded = re.sub(r'\s+', ' ', expanded).strip()

    if history and len(expanded.split()) <= 3:
        recent = history.split('\n')[-1] if history else ''
        expanded = f"{expanded} {recent[:100]}" if recent else expanded

    return expanded


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

        # --- 4. Rewrite query for better retrieval ---
        history_text = "\n".join(
            f"{'User' if m.role == 'user' else 'Assistant'}: {m.content[:200]}"
            for m in history_messages[-3:]
        ) if history_messages else ""
        search_query = _rewrite_query(query, history_text)

        # --- 5. Search for relevant context via hybrid search ---
        sources: List[AIChatSource] = []
        context_text = ""

        try:
            pinecone_results = await PineconeService.query_all_namespaces(
                query_text=search_query,
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
                        f"[Source: {title}]\n{meta.get('text_snippet', '')}"
                    )

                context_text = "\n\n---\n\n".join(context_parts)

            # Fallback: hybrid dense+sparse search on KB articles
            if not context_text:
                kb_result = await db.execute(
                    select(KBArticle).where(KBArticle.is_published == True)
                )
                articles = kb_result.scalars().all()

                if articles:
                    kb_texts = []
                    kb_map = []
                    for article in articles:
                        chunks = EmbeddingService.semantic_chunk_text(
                            f"{article.title}\n\n{article.body}", max_tokens=512
                        )
                        for chunk in chunks:
                            kb_texts.append(chunk)
                            kb_map.append((article, chunk))

                    if kb_texts:
                        dense_results = []
                        sparse_results = []

                        query_embedding = await EmbeddingService.generate_embedding(search_query)
                        article_embeddings = await EmbeddingService.generate_embeddings_batch(kb_texts)

                        dense_results = EmbeddingService.search_embeddings(
                            query_embedding, article_embeddings, k=10
                        )

                        bm25_index = EmbeddingService.build_bm25_index(kb_texts)
                        sparse_results = EmbeddingService.bm25_search(search_query, bm25_index, top_k=10)

                        hybrid_indices = EmbeddingService.hybrid_fusion(
                            dense_results, sparse_results, top_k=5, alpha=0.7
                        )

                        seen_article_ids = set()
                        seen_chunks = set()
                        for idx, score in hybrid_indices:
                            article, chunk = kb_map[idx]
                            chunk_key = f"{article.id}_{chunk[:50]}"
                            if chunk_key not in seen_chunks and article.id not in seen_article_ids:
                                seen_chunks.add(chunk_key)
                                if len(seen_article_ids) < 3:
                                    seen_article_ids.add(article.id)
                                sources.append(AIChatSource(
                                    article_id=article.id,
                                    title=article.title,
                                    relevance_score=round(float(score), 4),
                                    snippet=chunk[:300],
                                ))

                        context_parts = []
                        for idx, score in hybrid_indices:
                            article, chunk = kb_map[idx]
                            context_parts.append(
                                f"[Source: {article.title}]\n{chunk}"
                            )
                        context_text = "\n\n---\n\n".join(context_parts[:5])

                        if not context_text:
                            dense_reranked = EmbeddingService.mmr_rerank(
                                query_embedding, article_embeddings, lambda_param=0.5, k=5
                            )
                            context_parts = []
                            for idx in dense_reranked:
                                article, chunk = kb_map[idx]
                                context_parts.append(
                                    f"[Source: {article.title}]\n{chunk}"
                                )
                            context_text = "\n\n---\n\n".join(context_parts)
        except Exception:
            context_text = ""
            sources = []

        # --- 6. Build messages with structured prompt ---
        source_lines = []
        for i, s in enumerate(sources, 1):
            source_lines.append(
                f"[{i}] \"{s.title}\" (relevance: {s.relevance_score:.2f})"
            )
        source_list = "\n".join(source_lines) if source_lines else "No sources found."

        system_content = (
            "You are a HelpDesk AI support assistant. Follow these rules strictly:\n\n"
            "## RULES\n"
            "1. Answer ONLY using the provided context below.\n"
            "2. If context is insufficient, say so and suggest creating a ticket.\n"
            "3. NEVER make up information or use external knowledge.\n"
            "4. Cite sources using [Source: Title] after each claim.\n"
            "5. Be concise, accurate, and helpful.\n"
            "6. If the user asks a general question, first check if the context has the answer.\n\n"
            "## REASONING\n"
            "- Read the context carefully.\n"
            "- Determine if the context contains the answer.\n"
            "- If yes: answer with citations.\n"
            "- If no: say 'I don't have enough information' and suggest a ticket.\n\n"
            "## CONTEXT\n"
            f"{context_text if context_text else 'No relevant context was found for this query.'}\n\n"
            "## SOURCES AVAILABLE\n"
            f"{source_list}"
        )

        messages = [SystemMessage(content=system_content)]
        for msg in history_messages:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            else:
                messages.append(AIMessage(content=msg.content))
        messages.append(HumanMessage(content=query))

        # --- 7. Generate answer with model fallback ---
        confidence = 0.0
        try:
            answer, model_used = await _llm_ainvoke_with_fallback(
                messages, temperature=0.3, max_retries=3,
            )
            logger.info("Chat answered using model: %s", model_used)

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

        # --- 8. Save assistant message ---
        ai_msg = ChatMessage(
            session_id=session.id,
            role="assistant",
            content=answer,
            sources=[s.model_dump() for s in sources] if sources else None,
        )
        db.add(ai_msg)
        await db.flush()

        # --- 9. Build response ---
        suggest_ticket = confidence < CONFIDENCE_THRESHOLD

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

        # --- Context retrieval via hybrid search ---
        history_text = "\n".join(
            f"{'User' if m.role == 'user' else 'Assistant'}: {m.content[:200]}"
            for m in history_messages[-3:]
        ) if history_messages else ""
        search_query = _rewrite_query(query, history_text)

        sources: List[dict] = []
        context_text = ""
        try:
            pinecone_results = await PineconeService.query_all_namespaces(
                query_text=search_query,
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
                        f"[Source: {title}]\n{meta.get('text_snippet', '')}"
                    )
                context_text = "\n\n---\n\n".join(context_parts)

            # Hybrid dense+sparse fallback
            if not context_text:
                kb_result = await db.execute(
                    select(KBArticle).where(KBArticle.is_published == True)
                )
                articles = kb_result.scalars().all()
                if articles:
                    kb_texts = []
                    kb_map = []
                    for article in articles:
                        chunks = EmbeddingService.semantic_chunk_text(
                            f"{article.title}\n\n{article.body}", max_tokens=512
                        )
                        for chunk in chunks:
                            kb_texts.append(chunk)
                            kb_map.append((article, chunk))

                    if kb_texts:
                        query_embedding = await EmbeddingService.generate_embedding(search_query)
                        article_embeddings = await EmbeddingService.generate_embeddings_batch(kb_texts)

                        dense_results = EmbeddingService.search_embeddings(
                            query_embedding, article_embeddings, k=10
                        )

                        bm25_index = EmbeddingService.build_bm25_index(kb_texts)
                        sparse_results = EmbeddingService.bm25_search(search_query, bm25_index, top_k=10)

                        hybrid_indices = EmbeddingService.hybrid_fusion(
                            dense_results, sparse_results, top_k=5, alpha=0.7
                        )

                        seen_ids = set()
                        seen_chunks = set()
                        for idx, score in hybrid_indices:
                            article, chunk = kb_map[idx]
                            ck = f"{article.id}_{chunk[:50]}"
                            if ck not in seen_chunks and article.id not in seen_ids:
                                seen_chunks.add(ck)
                                if len(seen_ids) < 3:
                                    seen_ids.add(article.id)
                                sources.append({
                                    "article_id": article.id,
                                    "title": article.title,
                                    "relevance_score": round(float(score), 4),
                                    "snippet": chunk[:300],
                                })

                        context_parts = []
                        for idx, score in hybrid_indices:
                            article, chunk = kb_map[idx]
                            context_parts.append(
                                f"[Source: {article.title}]\n{chunk}"
                            )
                        context_text = "\n\n---\n\n".join(context_parts[:5])
        except Exception:
            context_text = ""
            sources = []

        confidence = max((s["relevance_score"] for s in sources), default=0.0)

        # --- Send meta event ---
        yield f"data: {json.dumps({'type': 'meta', 'session_id': session.id, 'sources': sources, 'confidence': confidence})}\n\n"

        # --- Build messages with improved prompt ---
        source_lines = []
        for i, s in enumerate(sources, 1):
            source_lines.append(
                f"[{i}] \"{s['title']}\" (relevance: {s['relevance_score']:.2f})"
            )
        source_list = "\n".join(source_lines) if source_lines else "No sources found."

        system_content = (
            "You are a HelpDesk AI support assistant. Follow these rules strictly:\n\n"
            "## RULES\n"
            "1. Answer ONLY using the provided context below.\n"
            "2. If context is insufficient, say so and suggest creating a ticket.\n"
            "3. NEVER make up information or use external knowledge.\n"
            "4. Cite sources using [Source: Title] after each claim.\n"
            "5. Be concise, accurate, and helpful.\n\n"
            "## REASONING\n"
            "- Read the context carefully.\n"
            "- Determine if the context contains the answer.\n"
            "- If yes: answer with citations.\n"
            "- If no: say 'I don't have enough information' and suggest a ticket.\n\n"
            "## CONTEXT\n"
            f"{context_text if context_text else 'No relevant context was found for this query.'}\n\n"
            "## SOURCES AVAILABLE\n"
            f"{source_list}"
        )

        langchain_messages = [SystemMessage(content=system_content)]
        for msg in history_messages:
            if msg.role == "user":
                langchain_messages.append(HumanMessage(content=msg.content))
            else:
                langchain_messages.append(AIMessage(content=msg.content))
        langchain_messages.append(HumanMessage(content=query))

        # --- Streaming generation with model fallback ---
        collected_tokens: List[str] = []
        try:
            content, model_used = await _llm_ainvoke_with_fallback(
                langchain_messages, temperature=0.3, streaming=True, max_retries=3,
            )
            collected_tokens = [content]
            yield f"data: {json.dumps({'type': 'chunk', 'content': content})}\n\n"
            logger.info("Stream answered using model: %s", model_used)
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
            summary, _ = await _llm_ainvoke_with_fallback(
                [HumanMessage(content=prompt)], temperature=0.2, max_retries=2,
            )
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
            draft, _ = await _llm_ainvoke_with_fallback(
                [HumanMessage(content=prompt)], temperature=0.4, max_retries=2,
            )
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
