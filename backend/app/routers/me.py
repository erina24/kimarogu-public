"""ログイン中のユーザー情報を返す API (GET /api/auth/me)"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_user
from app.models import Team, User
from app.schemas import AuthMeRead

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=AuthMeRead)
def get_me(
    claims: Annotated[dict, Depends(require_user)],
    db: Annotated[Session, Depends(get_db)],
) -> AuthMeRead:
    firebase_uid = claims.get("uid")

    if not isinstance(firebase_uid, str) or not firebase_uid:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = db.scalar(
        select(User).where(User.firebase_uid == firebase_uid)
    )

    if user is None:
        raise HTTPException(status_code=403, detail="Not a team member")

    team = db.get(Team, user.team_id)

    return AuthMeRead(
        id=str(user.id),
        firebase_uid=user.firebase_uid,
        team_id=str(user.team_id),
        team_name=team.name if team else "",
        name=user.name,
        role=user.role,
    )
