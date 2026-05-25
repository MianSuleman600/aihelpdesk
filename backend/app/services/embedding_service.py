"""
Embedding service: chunking, vectorization, similarity search, MMR re-ranking.
Uses numpy for vector ops and OpenAI for embeddings.
Features: semantic chunking, BM25 hybrid search, model fallback.
"""

import re
import math
import logging
import numpy as np
import tiktoken
import asyncio
from collections import Counter
from typing import List, Tuple, Optional
from openai import AsyncOpenAI, RateLimitError


logger = logging.getLogger(__name__)

from app.core.config import settings
from app.core.model_router import get_model_router


def _build_async_client() -> AsyncOpenAI:
    """Build an AsyncOpenAI client using the next available embedding model."""
    router = get_model_router()
    entry = router.next_embedding_model()
    if entry is None:
        return AsyncOpenAI(
            api_key=settings.OPENROUTER_API_KEY or settings.OPENAI_API_KEY,
            base_url=settings.OPENROUTER_BASE_URL if settings.OPENROUTER_API_KEY else None,
        )
    return AsyncOpenAI(
        api_key=entry.api_key or settings.OPENROUTER_API_KEY or settings.OPENAI_API_KEY,
        base_url=entry.base_url if entry.provider == "openrouter" else None,
    )


client = _build_async_client()
_current_embedding_model: str = settings.OPENROUTER_EMBEDDING_MODEL or settings.OPENAI_EMBEDDING_MODEL or "text-embedding-3-small"

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
    def semantic_chunk_text(text: str, max_tokens: int = 512) -> List[str]:
        """
        Split text at paragraph/sentence boundaries to create semantically
        coherent chunks. Falls back to token-based splitting if paragraphs
        are too long.

        Args:
            text: Input text
            max_tokens: Maximum tokens per chunk

        Returns:
            List of semantically coherent text chunks
        """
        paragraphs = re.split(r'\n\s*\n', text.strip())
        paragraphs = [p.strip() for p in paragraphs if p.strip()]

        if not paragraphs:
            return [text] if text.strip() else []

        chunks = []
        current_paragraphs = []
        current_token_count = 0

        for para in paragraphs:
            para_tokens = len(ENCODING.encode(para))

            if para_tokens > max_tokens:
                if current_paragraphs:
                    chunks.append('\n\n'.join(current_paragraphs))
                    current_paragraphs = []
                    current_token_count = 0
                chunks.extend(EmbeddingService.chunk_text(para, chunk_size=max_tokens, overlap=0))
                continue

            if current_token_count + para_tokens > max_tokens:
                if current_paragraphs:
                    chunks.append('\n\n'.join(current_paragraphs))
                current_paragraphs = [para]
                current_token_count = para_tokens
            else:
                current_paragraphs.append(para)
                current_token_count += para_tokens

        if current_paragraphs:
            chunks.append('\n\n'.join(current_paragraphs))

        return chunks if chunks else [text]

    @staticmethod
    def build_bm25_index(texts: List[str]) -> tuple:
        """
        Build a BM25 index from a list of text documents.
        Uses simple tokenization with IDF scoring.

        Args:
            texts: List of document strings

        Returns:
            Tuple of (doc_tokens, idf_scores, avg_doc_len)
        """
        tokenized_docs = []
        doc_freq = Counter()
        total_terms = 0

        for text in texts:
            tokens = re.findall(r'\w+', text.lower())
            tokenized_docs.append(tokens)
            doc_freq.update(set(tokens))
            total_terms += len(tokens)

        n_docs = len(texts)
        k1 = 1.5
        b = 0.75
        avg_doc_len = total_terms / max(n_docs, 1)

        idf = {}
        for term, freq in doc_freq.items():
            idf[term] = math.log(1 + (n_docs - freq + 0.5) / (freq + 0.5))

        return tokenized_docs, idf, k1, b, avg_doc_len

    @staticmethod
    def bm25_search(query: str, index_data: tuple, top_k: int = 5) -> List[Tuple[int, float]]:
        """
        Search using BM25 scoring against a pre-built index.

        Args:
            query: Search query
            index_data: Tuple from build_bm25_index()
            top_k: Number of results

        Returns:
            List of (index, score) tuples sorted by score descending
        """
        tokenized_docs, idf, k1, b, avg_doc_len = index_data
        query_tokens = set(re.findall(r'\w+', query.lower()))

        scores = []
        for i, doc_tokens in enumerate(tokenized_docs):
            doc_len = len(doc_tokens)
            score = 0.0
            doc_counter = Counter(doc_tokens)

            for term in query_tokens:
                if term not in idf:
                    continue
                tf = doc_counter.get(term, 0)
                score += idf[term] * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * doc_len / max(avg_doc_len, 1)))

            scores.append((i, score))

        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

    @staticmethod
    def hybrid_fusion(
        dense_results: List[Tuple[int, float]],
        sparse_results: List[Tuple[int, float]],
        top_k: int = 5,
        alpha: float = 0.7,
    ) -> List[Tuple[int, float]]:
        """
        Reciprocal Rank Fusion (RRF) to merge dense + sparse results.

        Args:
            dense_results: List of (index, score) from dense search
            sparse_results: List of (index, score) from sparse search
            top_k: Final number of results
            alpha: Weight for dense (0-1). Higher = more weight on dense.

        Returns:
            Ranked list of (index, score) tuples
        """
        k = 60
        combined = {}

        for rank, (idx, _) in enumerate(dense_results):
            combined[idx] = combined.get(idx, 0) + alpha * (1.0 / (rank + k))

        for rank, (idx, _) in enumerate(sparse_results):
            combined[idx] = combined.get(idx, 0) + (1 - alpha) * (1.0 / (rank + k))

        ranked = sorted(combined.items(), key=lambda x: x[1], reverse=True)
        return [(idx, score) for idx, score in ranked[:top_k]]

    @staticmethod
    async def _embed_with_retry(text: str, attempt: int = 0) -> np.ndarray:
        """
        Generate embedding with model fallback on rate limits.

        Args:
            text: Text to embed
            attempt: Current retry attempt number

        Returns:
            Numpy array of embedding vector
        """
        global client, _current_embedding_model
        max_retries = 3
        try:
            response = await client.embeddings.create(
                model=_current_embedding_model,
                input=text,
            )
            return np.array(response.data[0].embedding, dtype=np.float32)
        except RateLimitError:
            router = get_model_router()
            router.mark_rate_limited(_current_embedding_model, purpose="embedding")
            next_entry = router.next_embedding_model()
            if next_entry and next_entry.model_id != _current_embedding_model:
                _current_embedding_model = next_entry.model_id
                client = _build_async_client()
                logger.info("Switched embedding model to %s", _current_embedding_model)
            if attempt < max_retries - 1:
                wait = 2 ** (attempt + 1)
                await asyncio.sleep(wait)
                return await EmbeddingService._embed_with_retry(text, attempt + 1)
            raise
        except Exception:
            router = get_model_router()
            next_entry = router.next_embedding_model()
            if next_entry and next_entry.model_id != _current_embedding_model:
                router.mark_rate_limited(_current_embedding_model, purpose="embedding")
                _current_embedding_model = next_entry.model_id
                client = _build_async_client()
                logger.info("Embedding model failed, switched to %s", _current_embedding_model)
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
        Switches model on rate limit or any error.
        """
        global client, _current_embedding_model
        try:
            response = await client.embeddings.create(
                model=_current_embedding_model,
                input=texts,
            )
            return [np.array(d.embedding, dtype=np.float32) for d in response.data]
        except Exception:
            router = get_model_router()
            router.mark_rate_limited(_current_embedding_model, purpose="embedding")
            next_entry = router.next_embedding_model()
            if next_entry and next_entry.model_id != _current_embedding_model:
                _current_embedding_model = next_entry.model_id
                client = _build_async_client()
                logger.info("Embedding batch failed, switched to %s", _current_embedding_model)
            await asyncio.sleep(1.5)
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
