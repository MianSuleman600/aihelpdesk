"""
Embedding service: chunking, vectorization, similarity search, MMR re-ranking.
Uses numpy for vector ops and OpenAI for embeddings.
"""

import numpy as np
import tiktoken
import asyncio
from typing import List, Tuple
from openai import AsyncOpenAI, RateLimitError

from app.core.config import settings

use_or = settings.LLM_PROVIDER == "openrouter" and settings.OPENROUTER_API_KEY

client = AsyncOpenAI(
    api_key=settings.OPENROUTER_API_KEY if use_or else settings.OPENAI_API_KEY,
    base_url=settings.OPENROUTER_BASE_URL if use_or else None,
)

ENCODING = tiktoken.get_encoding("cl100k_base")
CONFIDENCE_THRESHOLD = 0.72


class EmbeddingService:
    """Service for text chunking, embedding generation, and similarity search."""

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 512, overlap: int = 50) -> List[str]:
        """
        Split text into overlapping chunks of approximately `chunk_size` tokens.

        Args:
            text: Input text to split
            chunk_size: Target token count per chunk
            overlap: Number of overlapping tokens between consecutive chunks

        Returns:
            List of text chunks
        """
        tokens = ENCODING.encode(text)
        if len(tokens) <= chunk_size:
            return [text]

        chunks = []
        start = 0
        while start < len(tokens):
            end = min(start + chunk_size, len(tokens))
            chunk_tokens = tokens[start:end]
            chunks.append(ENCODING.decode(chunk_tokens))
            if end == len(tokens):
                break
            start += chunk_size - overlap

        return chunks

    @staticmethod
    async def _embed_with_retry(text: str, attempt: int = 0) -> np.ndarray:
        """
        Generate embedding with exponential backoff retry logic.

        Args:
            text: Text to embed
            attempt: Current retry attempt number

        Returns:
            Numpy array of embedding vector
        """
        max_retries = 3
        try:
            response = await client.embeddings.create(
                model=settings.OPENAI_EMBEDDING_MODEL,
                input=text,
            )
            return np.array(response.data[0].embedding, dtype=np.float32)
        except RateLimitError:
            if attempt < max_retries - 1:
                wait = 2 ** (attempt + 1)
                await asyncio.sleep(wait)
                return await EmbeddingService._embed_with_retry(text, attempt + 1)
            raise
        except Exception:
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                return await EmbeddingService._embed_with_retry(text, attempt + 1)
            raise

    @staticmethod
    async def generate_embedding(text: str) -> np.ndarray:
        """
        Generate an embedding vector for the given text via OpenAI.

        Args:
            text: Input text (will be truncated to 8192 tokens)

        Returns:
            Numpy float32 array of embedding dimensions
        """
        return await EmbeddingService._embed_with_retry(text)

    @staticmethod
    async def generate_embeddings_batch(texts: List[str]) -> List[np.ndarray]:
        """
        Generate embeddings for a batch of texts in a single API call.

        Args:
            texts: List of texts to embed

        Returns:
            List of numpy float32 arrays in the same order as input
        """
        try:
            response = await client.embeddings.create(
                model=settings.OPENAI_EMBEDDING_MODEL,
                input=texts,
            )
            return [np.array(d.embedding, dtype=np.float32) for d in response.data]
        except RateLimitError:
            await asyncio.sleep(2)
            return await EmbeddingService.generate_embeddings_batch(texts)
        except Exception:
            await asyncio.sleep(1)
            return await EmbeddingService.generate_embeddings_batch(texts)

    @staticmethod
    def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        """
        Compute cosine similarity between two vectors.

        Args:
            a: First vector
            b: Second vector

        Returns:
            Similarity score in [0, 1]
        """
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a < 1e-10 or norm_b < 1e-10:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    @staticmethod
    def search_embeddings(
        query_embedding: np.ndarray,
        embeddings: List[np.ndarray],
        k: int = 5,
        threshold: float = CONFIDENCE_THRESHOLD,
    ) -> List[Tuple[int, float]]:
        """
        Return top-k (index, similarity_score) pairs filtered by threshold.

        Args:
            query_embedding: Query vector
            embeddings: List of document vectors to search
            k: Maximum number of results to return
            threshold: Minimum similarity score threshold

        Returns:
            List of (index, score) tuples sorted by score descending
        """
        scores = [
            (i, EmbeddingService.cosine_similarity(query_embedding, emb))
            for i, emb in enumerate(embeddings)
        ]
        scores = [(i, s) for i, s in scores if s >= threshold]
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:k]

    @staticmethod
    def mmr_rerank(
        query_embedding: np.ndarray,
        embeddings: List[np.ndarray],
        lambda_param: float = 0.5,
        k: int = 5,
    ) -> List[int]:
        """
        Maximum Marginal Relevance re-ranking to balance relevance and diversity.

        Args:
            query_embedding: Query vector
            embeddings: List of document vectors
            lambda_param: Trade-off parameter (1 = pure relevance, 0 = pure diversity)
            k: Number of items to select

        Returns:
            List of selected indices in ranked order
        """
        n = len(embeddings)
        if n == 0:
            return []

        query_sims = np.array([
            EmbeddingService.cosine_similarity(query_embedding, emb)
            for emb in embeddings
        ])

        doc_sims = np.zeros((n, n))
        for i in range(n):
            for j in range(i + 1, n):
                s = EmbeddingService.cosine_similarity(embeddings[i], embeddings[j])
                doc_sims[i][j] = s
                doc_sims[j][i] = s

        selected = []
        candidates = set(range(n))

        for _ in range(min(k, n)):
            if not candidates:
                break
            best_score = -float("inf")
            best_idx = -1
            for idx in candidates:
                sim_to_query = query_sims[idx]
                if selected:
                    max_sim_to_selected = max(doc_sims[idx][s] for s in selected)
                else:
                    max_sim_to_selected = 0.0
                mmr_score = lambda_param * sim_to_query - (1 - lambda_param) * max_sim_to_selected
                if mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = idx
            if best_idx != -1:
                selected.append(best_idx)
                candidates.remove(best_idx)

        return selected
