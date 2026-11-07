from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_user
from app.models import Decision, Minute, User


router = APIRouter(prefix="/api/decisions", tags=["decisions"])


class DecisionRead(BaseModel):
    id: UUID
    content: str
    status: str
    minute_id: UUID | None
    minute_title: str | None
    meeting_at: datetime | None


@router.get("", response_model=list[DecisionRead])
def list_decisions(
    claims: Annotated[dict, Depends(require_user)],
    db: Annotated[Session, Depends(get_db)],
    status: Literal["current", "all"] = "all",
):
    firebase_uid = claims.get("uid")
    if not isinstance(firebase_uid, str) or not firebase_uid:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = db.scalar(
        select(User).where(User.firebase_uid == firebase_uid)
    )
    if user is None:
        raise HTTPException(status_code=403, detail="Not a team member")

    stmt = (
        select(Decision, Minute)
        .outerjoin(
            Minute,
            (Decision.minute_id == Minute.id)
            & (Decision.team_id == Minute.team_id),
        )
        .where(Decision.team_id == user.team_id)
    )

    if status == "current":
        stmt = stmt.where(Decision.status == "current")

    stmt = stmt.order_by(
        Minute.meeting_at.desc().nulls_last(),
        Decision.created_at.desc(),
    )

    rows = db.execute(stmt).all()

    return [
        DecisionRead(
            id=decision.id,
            content=decision.content,
            status=decision.status,
            minute_id=decision.minute_id,
            minute_title=minute.title if minute else None,
            meeting_at=minute.meeting_at if minute else None,
        )
        for decision, minute in rows
    ]
