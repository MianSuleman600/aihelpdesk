"""Test RAG queries against uploaded Starbit documents."""
import asyncio
import logging
logging.basicConfig(level=logging.WARNING)

QUERIES = [
    "How do I reset my password?",
    "My account is locked, what do I do?",
    "What browsers does the portal support?",
    "How to report a bug in game development?",
    "What is the password policy?",
    "How do I set up two-factor authentication?",
    "What happens if I lose access to my authenticator app?",
    "How do I contact IT support?",
    "What is the hotfix process?",
    "What are the rules for remote work?",
]

async def run_queries():
    from app.db.session import AsyncSessionLocal
    from sqlalchemy import select
    from app.models.models import User
    from app.services.ai_service import AIService

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == "admin@test.com"))
        user = result.scalar_one_or_none()
        if not user:
            print("User not found")
            return

        for q in QUERIES:
            print(f"\nQ: {q}")
            try:
                resp = await AIService.chat(q, None, db, user)
                found = resp.confidence > 0
                print(f"A: {resp.answer[:120]}...")
                print(f"  Confidence: {resp.confidence:.4f} | Sources: {len(resp.sources)} | SuggestTicket: {resp.suggest_ticket}")
                for s in resp.sources:
                    print(f"  -> Source: {s.title} (score: {s.relevance_score:.4f})")
            except Exception as e:
                print(f"  Error: {str(e)[:80]}")

asyncio.run(run_queries())
