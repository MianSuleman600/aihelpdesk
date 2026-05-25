"""
Pinecone vector store service.
Handles index management, vector upsert, query, and delete operations.
"""

import asyncio
import numpy as np
from typing import List, Optional, Dict, Any
from pinecone import Pinecone, ServerlessSpec

from app.core.config import settings
from app.services.embedding_service import EmbeddingService


class PineconeService:
    """Service for Pinecone vector database operations."""

    _pc: Optional[Pinecone] = None
    _index = None
    _lock = asyncio.Lock()

    # Namespaces for logical separation
    NS_KB = "kb"
    NS_DOCS = "docs"

    @classmethod
    async def get_index(cls):
        """Get or initialize the Pinecone index."""
        if cls._index is not None:
            return cls._index

        async with cls._lock:
            if cls._index is not None:
                return cls._index

            if not settings.PINECONE_API_KEY:
                return None

            cls._pc = Pinecone(api_key=settings.PINECONE_API_KEY)

            existing = [idx["name"] for idx in cls._pc.list_indexes()]
            index_name = settings.PINECONE_INDEX_NAME

            if index_name not in existing:
                cls._pc.create_index(
                    name=index_name,
                    dimension=settings.PINECONE_EMBEDDING_DIMENSION,
                    metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region=settings.PINECONE_ENVIRONMENT),
                )
                # Wait for index to be ready
                while not cls._pc.describe_index(index_name).status["ready"]:
                    await asyncio.sleep(1)

            cls._index = cls._pc.Index(index_name)
            return cls._index

    @classmethod
    async def upsert_chunks(
        cls,
        namespace: str,
        vectors: List[Dict[str, Any]],
    ) -> int:
        """
        Upsert vectors into Pinecone.

        Args:
            namespace: Namespace (kb or docs)
            vectors: List of dicts with id, values, metadata

        Returns:
            Number of upserted vectors
        """
        index = await cls.get_index()
        if index is None:
            return 0

        batch_size = 100
        total = 0
        for i in range(0, len(vectors), batch_size):
            batch = vectors[i : i + batch_size]
            index.upsert(vectors=batch, namespace=namespace)
            total += len(batch)

        return total

    @classmethod
    async def query(
        cls,
        namespace: str,
        query_text: str,
        top_k: int = 5,
        filter: Optional[Dict] = None,
        include_values: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Search for similar vectors in Pinecone.

        Args:
            namespace: Namespace to search
            query_text: Text to search for
            top_k: Number of results
            filter: Optional metadata filter
            include_values: Include embedding vectors (needed for MMR reranking)

        Returns:
            List of matches with id, score, metadata, (optionally) values
        """
        index = await cls.get_index()
        if index is None:
            return []

        query_embedding = await EmbeddingService.generate_embedding(query_text)

        result = index.query(
            namespace=namespace,
            vector=query_embedding.tolist(),
            top_k=top_k,
            include_metadata=True,
            include_values=include_values,
            filter=filter,
        )

        matches = []
        for m in result.matches:
            match = {
                "id": m.id,
                "score": m.score,
                "metadata": m.metadata,
            }
            if include_values and m.values:
                match["values"] = m.values
            matches.append(match)

        return matches

    @classmethod
    async def query_all_namespaces(
        cls,
        query_text: str,
        top_k_per_ns: int = 10,
        top_k_final: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Search across both KB and docs namespaces, merge results.

        Args:
            query_text: Text to search for
            top_k_per_ns: Initial results per namespace (higher for MMR to pick from)
            top_k_final: Final number of results after MMR reranking

        Returns:
            Merged, score-sorted results
        """
        kb_results, doc_results = await asyncio.gather(
            cls.query(namespace=cls.NS_KB, query_text=query_text, top_k=top_k_per_ns, include_values=True),
            cls.query(namespace=cls.NS_DOCS, query_text=query_text, top_k=top_k_per_ns, include_values=True),
        )

        merged = kb_results + doc_results
        merged.sort(key=lambda x: x["score"], reverse=True)

        # MMR rerank across merged results for diversity
        if len(merged) > 1:
            query_embedding = await EmbeddingService.generate_embedding(query_text)
            embeddings = [np.array(m["values"]) for m in merged if "values" in m]
            if embeddings and len(embeddings) == len(merged):
                mmr_indices = EmbeddingService.mmr_rerank(
                    query_embedding=query_embedding,
                    embeddings=embeddings,
                    lambda_param=0.5,
                    k=min(top_k_final, len(merged)),
                )
                merged = [merged[i] for i in mmr_indices]
            else:
                merged = merged[:top_k_final]
        else:
            merged = merged[:top_k_final]

        # Strip values from results before returning (keeps response small)
        for m in merged:
            m.pop("values", None)

        return merged

    @classmethod
    async def delete_vectors(
        cls,
        namespace: str,
        doc_id: str,
        metadata_field: str = "doc_id",
    ) -> int:
        """
        Delete all vectors for a given document.

        Args:
            namespace: Namespace
            doc_id: Document ID to delete vectors for
            metadata_field: Metadata field name that holds the doc ID

        Returns:
            Number of deleted vectors
        """
        index = await cls.get_index()
        if index is None:
            return 0

        result = index.delete(
            namespace=namespace,
            filter={metadata_field: doc_id},
        )
        return result.get("deleted", 0)

    @classmethod
    async def delete_all_in_namespace(cls, namespace: str) -> bool:
        """Delete all vectors in a namespace."""
        index = await cls.get_index()
        if index is None:
            return False
        index.delete(namespace=namespace, delete_all=True)
        return True
