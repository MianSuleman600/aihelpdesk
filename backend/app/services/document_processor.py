"""
Document processing service.
Handles PDF/DOCX/TXT text extraction, chunking, embedding, and Pinecone indexing.
"""

import os
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from app.core.config import settings
from app.services.embedding_service import EmbeddingService
from app.services.pinecone_service import PineconeService


class DocumentProcessor:
    """Service for processing uploaded documents and indexing them into Pinecone."""

    ALLOWED_EXTENSIONS = {ext.lower() for ext in settings.ALLOWED_EXTENSIONS}

    @staticmethod
    def validate_file(filename: str, file_size: int) -> None:
        """
        Validate file extension and size.

        Args:
            filename: Original filename
            file_size: File size in bytes

        Raises:
            ValueError: If file is invalid
        """
        ext = os.path.splitext(filename)[1].lower()
        if ext not in DocumentProcessor.ALLOWED_EXTENSIONS:
            raise ValueError(
                f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(DocumentProcessor.ALLOWED_EXTENSIONS))}"
            )

        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            raise ValueError(
                f"File too large ({file_size / 1024 / 1024:.1f} MB). "
                f"Maximum allowed: {settings.MAX_UPLOAD_SIZE_MB} MB"
            )

    @staticmethod
    def extract_text(file_path: str, filename: str) -> str:
        """
        Extract text from a document file.

        Args:
            file_path: Absolute path to the saved file
            filename: Original filename (for extension detection)

        Returns:
            Extracted text content

        Raises:
            ValueError: If file type is not supported
        """
        ext = os.path.splitext(filename)[1].lower()

        if ext == ".txt":
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()

        if ext == ".pdf":
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            pages = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            return "\n\n".join(pages)

        if ext == ".docx":
            try:
                from docx import Document as DocxDocument
                doc = DocxDocument(file_path)
                paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
                return "\n\n".join(paragraphs)
            except ImportError:
                # Fallback: try extracting as ZIP/XML
                import zipfile
                import xml.etree.ElementTree as ET
                texts = []
                with zipfile.ZipFile(file_path) as z:
                    xml_content = z.read("word/document.xml")
                    root = ET.fromstring(xml_content)
                    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
                    for t in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t"):
                        if t.text:
                            texts.append(t.text)
                return "\n\n".join(texts) if texts else ""

        raise ValueError(f"Unsupported file type: {ext}")

    @staticmethod
    async def index_document(
        doc_id: str,
        title: str,
        file_path: str,
        filename: str,
    ) -> Dict[str, Any]:
        """
        Full indexing pipeline: extract → chunk → embed → upsert to Pinecone.

        Args:
            doc_id: Document database ID
            title: Document title (from filename or user)
            file_path: Absolute path to saved file
            filename: Original filename

        Returns:
            Dict with status, chunk_count, error (if any)
        """
        try:
            # 1. Extract text
            text = await asyncio.to_thread(DocumentProcessor.extract_text, file_path, filename)
            if not text.strip():
                return {"status": "failed", "chunk_count": 0, "error": "No text could be extracted from the document"}

            # 2. Chunk text
            chunks = EmbeddingService.chunk_text(text, chunk_size=512, overlap=50)
            if not chunks:
                return {"status": "failed", "chunk_count": 0, "error": "Document too short after chunking"}

            # 3. Generate embeddings in batches
            all_embeddings = await EmbeddingService.generate_embeddings_batch(chunks)

            # 4. Build Pinecone vectors
            vectors = []
            for idx, (chunk, embedding) in enumerate(zip(chunks, all_embeddings)):
                vectors.append({
                    "id": f"doc_{doc_id}_chunk_{idx}",
                    "values": embedding.tolist(),
                    "metadata": {
                        "doc_id": doc_id,
                        "title": title,
                        "filename": filename,
                        "chunk_index": idx,
                        "total_chunks": len(chunks),
                        "text_snippet": chunk[:500],
                        "indexed_at": datetime.now(timezone.utc).isoformat(),
                    },
                })

            # 5. Upsert to Pinecone
            upserted = await PineconeService.upsert_chunks(
                namespace=PineconeService.NS_DOCS,
                vectors=vectors,
            )

            return {"status": "ready", "chunk_count": upserted, "error": None}

        except Exception as e:
            return {"status": "failed", "chunk_count": 0, "error": str(e)}

    @staticmethod
    async def reindex_document(
        doc_id: str,
        title: str,
        file_path: str,
        filename: str,
    ) -> Dict[str, Any]:
        """
        Re-index a document: delete old vectors, then re-index.

        Args:
            Same as index_document
        """
        await PineconeService.delete_vectors(
            namespace=PineconeService.NS_DOCS,
            doc_id=doc_id,
        )
        return await DocumentProcessor.index_document(doc_id, title, file_path, filename)

    @staticmethod
    async def delete_document_vectors(doc_id: str) -> int:
        """Delete all Pinecone vectors for a document."""
        return await PineconeService.delete_vectors(
            namespace=PineconeService.NS_DOCS,
            doc_id=doc_id,
        )
