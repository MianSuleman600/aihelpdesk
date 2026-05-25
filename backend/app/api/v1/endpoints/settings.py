from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.models import User
from app.schemas.schemas import UserSettingsResponse, UserSettingsUpdate
from app.api.deps import get_current_user
from app.services.settings_service import SettingsService

router = APIRouter()


@router.get("", response_model=UserSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await SettingsService.get_settings(current_user.id, db)


@router.patch("", response_model=UserSettingsResponse)
async def update_settings(
    data: UserSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await SettingsService.update_settings(current_user.id, data, db)
