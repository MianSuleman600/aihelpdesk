"""Upload docs directly via service layer (bypass HTTP timeout)."""
import asyncio
import logging
logging.basicConfig(level=logging.INFO)

FILES = [
    "starbit_account_guide.txt",
    "starbit_troubleshooting.txt",
    "starbit_it_policies.txt",
    "starbit_game_platform.txt",
]

async def upload_all():
    from sqlalchemy import select
    from app.db.session import AsyncSessionLocal
    from app.models.models import User, UploadedDocument, UploadedDocumentStatus
    from app.services.document_processor import DocumentProcessor
    from app.core.config import settings
    import os, uuid
    from datetime import datetime, timezone

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == "admin@test.com"))
        admin = result.scalar_one_or_none()
        if not admin:
            print("Admin user not found")
            return

        for fname in FILES:
            print(f"\n=== Processing {fname} ===")
            if not os.path.exists(fname):
                print(f"File not found: {fname}")
                continue

            title = os.path.splitext(fname)[0]
            doc_id = str(uuid.uuid4())
            ext = os.path.splitext(fname)[1].lower()
            file_size = os.path.getsize(fname)
            file_path = os.path.abspath(fname)

            doc = UploadedDocument(
                id=doc_id,
                title=title,
                filename=fname,
                file_path=file_path,
                file_type=ext,
                file_size=file_size,
                status=UploadedDocumentStatus.PROCESSING,
                uploaded_by_id=admin.id,
            )
            db.add(doc)
            await db.flush()

            result = await DocumentProcessor.index_document(doc_id, title, file_path, fname)
            print(f"  Result: {result}")

            if result["status"] == "ready":
                doc.status = UploadedDocumentStatus.READY
                doc.chunk_count = result["chunk_count"]
            else:
                doc.status = UploadedDocumentStatus.FAILED
                doc.error_message = result.get("error")
            doc.updated_at = datetime.now(timezone.utc)
            await db.flush()
            print(f"  Done: {doc.status.value} / {doc.chunk_count} chunks")

    print("\n=== All uploads complete ===")

if __name__ == "__main__":
    asyncio.run(upload_all())
