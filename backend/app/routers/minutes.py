
from datetime import timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_user
from app.models import Minute, User
from app.schemas import MinuteCreate, MinuteRead

router = APIRouter(prefix="/api/minutes", tags=["minutes"])


@router.post("", response_model=MinuteRead, status_code=201)
def create_minute(
    payload: MinuteCreate,
    claims: Annotated[dict, Depends(require_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MinuteRead:
    firebase_uid = claims.get("uid")

    if not isinstance(firebase_uid, str) or not firebase_uid:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = db.scalar(
        select(User).where(User.firebase_uid == firebase_uid)
    )
    if user is None:
        raise HTTPException(status_code=403, detail="Not a team member")

    title = payload.title.strip()
    content = payload.content.strip()

    if not title or not content:
        raise HTTPException(
            status_code=422,
            detail="Title and content must not be empty",
        )

    meeting_at = payload.meeting_at
    if meeting_at.tzinfo is None:
        raise HTTPException(
            status_code=422,
            detail="meeting_at must include a timezone",
        )

    minute = Minute(
        team_id=user.team_id,
        title=title,
        content=content,
        meeting_at=meeting_at.astimezone(timezone.utc),
        created_by=user.id,
    )

    db.add(minute)
    db.commit()
    db.refresh(minute)

    return MinuteRead(
        id=str(minute.id),
        title=minute.title,
        content=minute.content,
        meeting_at=minute.meeting_at,
        team_id=str(minute.team_id),
        created_by=str(minute.created_by),
        created_at=minute.created_at,
    )


@router.get("/{minute_id}", response_model=MinuteRead)
def get_confirmed_minute(
    minute_id: UUID,
    claims: Annotated[dict, Depends(require_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MinuteRead:
    """RAG再登録用。自チームの確定済み議事録だけを読み取る。"""
    uid = claims.get("uid")
    if not isinstance(uid, str) or not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = db.scalar(select(User).where(User.firebase_uid == uid))
    if user is None:
        raise HTTPException(status_code=403, detail="Not a team member")

    minute = db.scalar(select(Minute).where(
        Minute.id == minute_id,
        Minute.team_id == user.team_id,
    ))
    # 他チームの議事録の存在も知らせない
    if minute is None:
        raise HTTPException(status_code=404, detail="Minute not found")
    if minute.summary is None:
        raise HTTPException(status_code=409, detail="Minute is not confirmed")

    return MinuteRead(
        id=str(minute.id), title=minute.title, content=minute.content,
        meeting_at=minute.meeting_at, team_id=str(minute.team_id),
        created_by=str(minute.created_by), created_at=minute.created_at,
    )
