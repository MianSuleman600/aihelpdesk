"""
Model Router — manages multiple LLM models with fallback, rate-limit tracking,
and paid-model support for future expansion.

Free models are tried in priority order. If one hits a rate limit (429),
it goes on cooldown and the next model is tried. Paid models can be
added via .env or code without changing the fallback logic.

Embedding uses a separate model from chat to distribute rate limits.
"""

import time
import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from langchain_openai import ChatOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model definitions — free tiers (prioritised best-first)
# ---------------------------------------------------------------------------

FREE_CHAT_MODELS: List[str] = [
    "deepseek/deepseek-v4-flash:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
    "minimax/minimax-m2.5:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "qwen/qwen3-coder:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "liquid/lfm-2.5-1.2b-thinking:free",
    "poolside/laguna-xs.2:free",
    "poolside/laguna-m.1:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "openai/gpt-oss-120b:free",
    "openai/gpt-oss-20b:free",
    "z-ai/glm-4.5-air:free",
    "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    "baidu/cobuddy:free",
    "liquid/lfm-2.5-1.2b-instruct:free",
]

# Separate embedding models — primary + fallback
FREE_EMBEDDING_MODELS: List[str] = [
    "nvidia/llama-nemotron-embed-vl-1b-v2:free",
    "text-embedding-3-small",
]

# Paid model slots — empty by default, add here or via .env later
# Format: {"model": "openai/gpt-4o", "provider": "openrouter"}
PAID_CHAT_MODELS: List[Dict[str, Any]] = [
    {"model": "openai/gpt-4o", "provider": "openrouter"},
    {"model": "openai/gpt-4o-mini", "provider": "openrouter"},
    {"model": "anthropic/claude-3.5-sonnet", "provider": "openrouter"},
    {"model": "google/gemini-2.0-flash-exp", "provider": "openrouter"},
]
PAID_EMBEDDING_MODELS: List[Dict[str, Any]] = [
    {"model": "openai/text-embedding-3-large", "provider": "openrouter"},
    {"model": "openai/text-embedding-3-small", "provider": "openrouter"},
]

# How long (seconds) a model stays on cooldown after a 429
RATE_LIMIT_COOLDOWN = 5


@dataclass
class ModelEntry:
    """Tracks a single model's state."""
    model_id: str
    provider: str = "openrouter"  # "openrouter" | "openai"
    api_key: str = ""
    base_url: str = ""
    cooldown_until: float = 0.0  # timestamp; 0 = not rate-limited

    def is_available(self) -> bool:
        return time.time() >= self.cooldown_until

    def mark_rate_limited(self, seconds: int = RATE_LIMIT_COOLDOWN) -> None:
        self.cooldown_until = time.time() + seconds
        logger.warning("Model %s rate-limited, cooldown %ds", self.model_id, seconds)


class ModelRouter:
    """
    Picks the next available model for a given purpose ('chat' or 'embedding').
    Falls back through the list when a model is on cooldown.
    """

    def __init__(self) -> None:
        self._chat_index = 0
        self._embed_index = 0
        self._chat_models: List[ModelEntry] = []
        self._embed_models: List[ModelEntry] = []
        self._init_models()

    # ------------------------------------------------------------------
    # Initialisation
    # ------------------------------------------------------------------

    def _init_models(self) -> None:
        """Build internal model lists from free definitions + any paid config."""

        or_key = settings.OPENROUTER_API_KEY or ""
        or_url = settings.OPENROUTER_BASE_URL or "https://openrouter.ai/api/v1"

        # Chat models — free tier
        for m in FREE_CHAT_MODELS:
            self._chat_models.append(ModelEntry(
                model_id=m,
                provider="openrouter",
                api_key=or_key,
                base_url=or_url,
            ))

        # Chat models — paid tier (future)
        if settings.OPENAI_API_KEY:
            self._chat_models.append(ModelEntry(
                model_id=settings.OPENAI_MODEL or "gpt-4o-mini",
                provider="openai",
                api_key=settings.OPENAI_API_KEY,
            ))

        for pm in PAID_CHAT_MODELS:
            self._chat_models.append(ModelEntry(
                model_id=pm["model"],
                provider=pm.get("provider", "openrouter"),
                api_key=pm.get("api_key", or_key),
                base_url=pm.get("base_url", or_url),
            ))

        # Embedding models — free tier
        for m in FREE_EMBEDDING_MODELS:
            self._embed_models.append(ModelEntry(
                model_id=m,
                provider="openrouter",
                api_key=or_key,
                base_url=or_url,
            ))

        # Embedding models — paid fallback (OpenAI native)
        if settings.OPENAI_API_KEY:
            self._embed_models.append(ModelEntry(
                model_id=settings.OPENAI_EMBEDDING_MODEL or "text-embedding-3-small",
                provider="openai",
                api_key=settings.OPENAI_API_KEY,
            ))

        for pm in PAID_EMBEDDING_MODELS:
            self._embed_models.append(ModelEntry(
                model_id=pm["model"],
                provider=pm.get("provider", "openrouter"),
                api_key=pm.get("api_key", or_key),
                base_url=pm.get("base_url", or_url),
            ))

        logger.info(
            "ModelRouter initialised: %d chat models, %d embedding models",
            len(self._chat_models), len(self._embed_models),
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def next_chat_model(self) -> Optional[ModelEntry]:
        """Return the next available chat model (round-robin, skip cooldowns)."""
        return self._next_available(self._chat_models, "chat")

    def next_embedding_model(self) -> Optional[ModelEntry]:
        """Return the next available embedding model."""
        return self._next_available(self._embed_models, "embedding")

    def mark_rate_limited(self, model_id: str, purpose: str = "chat") -> None:
        """Mark a model as rate-limited so it gets skipped for a while."""
        pool = self._chat_models if purpose == "chat" else self._embed_models
        for entry in pool:
            if entry.model_id == model_id:
                entry.mark_rate_limited()
                return

    def build_chat_llm(
        self,
        model_entry: Optional[ModelEntry] = None,
        temperature: float = 0.3,
        streaming: bool = False,
    ) -> ChatOpenAI:
        """Construct a ChatOpenAI instance for the given or next available model."""
        entry = model_entry or self.next_chat_model()
        if entry is None:
            raise RuntimeError("No chat models available (all rate-limited?)")

        kwargs: Dict[str, Any] = {
            "model": entry.model_id,
            "temperature": temperature,
            "timeout": 30,
            "max_retries": 1,
        }

        if entry.provider == "openrouter":
            kwargs["base_url"] = entry.base_url or settings.OPENROUTER_BASE_URL
            kwargs["api_key"] = entry.api_key or settings.OPENROUTER_API_KEY
            kwargs["default_headers"] = {
                "HTTP-Referer": settings.FRONTEND_URL or "http://localhost:3000",
                "X-Title": settings.APP_NAME or "HelpDesk AI",
            }
        elif entry.provider == "openai":
            kwargs["api_key"] = entry.api_key or settings.OPENAI_API_KEY

        if streaming:
            kwargs["streaming"] = True

        return ChatOpenAI(**kwargs)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _next_available(self, pool: List[ModelEntry], purpose: str) -> Optional[ModelEntry]:
        if not pool:
            return None

        start = self._chat_index if purpose == "chat" else self._embed_index
        n = len(pool)

        for offset in range(n):
            idx = (start + offset) % n
            entry = pool[idx]
            if entry.is_available():
                if purpose == "chat":
                    self._chat_index = (idx + 1) % n
                else:
                    self._embed_index = (idx + 1) % n
                return entry

        # All models on cooldown — wait for the first to recover
        earliest = min(e.cooldown_until for e in pool)
        wait = max(0, earliest - time.time())
        if wait > 0:
            logger.warning("All %s models rate-limited, waiting %.0fs", purpose, wait)
            time.sleep(wait)

        # Reset and return first
        for e in pool:
            e.cooldown_until = 0.0
        return pool[0]


_model_router: Optional[ModelRouter] = None


def get_model_router() -> ModelRouter:
    global _model_router
    if _model_router is None:
        _model_router = ModelRouter()
    return _model_router
