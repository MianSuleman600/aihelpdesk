from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.models.models import UserSettings
from app.schemas.schemas import UserSettingsUpdate


class SettingsService:

    @staticmethod
    async def get_settings(user_id: str, db: AsyncSession) -> UserSettings:
        result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
        settings = result.scalar_one_or_none()
        if not settings:
            settings = UserSettings(user_id=user_id)
            db.add(settings)
            await db.flush()
            await db.refresh(settings)
        return settings

    @staticmethod
    async def update_settings(
        user_id: str,
        data: UserSettingsUpdate,
        db: AsyncSession,
    ) -> UserSettings:
        settings = await SettingsService.get_settings(user_id, db)
        update_data = data.model_dump(exclude_none=True)
        for key, value in update_data.items():
            setattr(settings, key, value)
        await db.flush()
        await db.refresh(settings)
        return settings
