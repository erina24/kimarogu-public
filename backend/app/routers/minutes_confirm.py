from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_user
from app.models import (
    Decision,
    DecisionHistory,
    Minute,
    PendingItem,
    Todo,
    User,
)


router = APIRouter(prefix="/api/minutes", tags=["minutes"])


class DecisionInput(BaseModel):
    content: str = Field(min_length=1)
    reason: str | None = None
    replaces: str | None = None


class TodoInput(BaseModel):
    task: str = Field(min_length=1)
    assignee: str | None = None
    due: date | None = None


class ConfirmInput(BaseModel):
    summary3: list[str] = Field(min_length=1, max_length=3)
    decisions: list[DecisionInput]
    undecided: list[str]
    todos: list[TodoInput]


class ConfirmResult(BaseModel):
    saved_decisions: int
    saved_todos: int


@router.post("/{minute_id}/confirm", response_model=ConfirmResult, status_code=201)
def confirm_minute(
    minute_id: UUID,
    payload: ConfirmInput,
    claims: Annotated[dict, Depends(require_user)],
    db: Annotated[Session, Depends(get_db)],
):
    uid = claims.get("uid")
    if not isinstance(uid, str) or not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = db.scalar(select(User).where(User.firebase_uid == uid))
    if user is None:
        raise HTTPException(status_code=403, detail="Not a team member")

    # 議事録をロックし、同時確定による二重保存を防ぐ
    minute = db.scalar(
        select(Minute)
        .where(Minute.id == minute_id)
        .with_for_update()
    )
    if minute is None:
        raise HTTPException(status_code=404, detail="Minute not found")
    if minute.team_id != user.team_id:
        raise HTTPException(status_code=403, detail="Other team's minute")

    existing = (
        db.scalar(select(Decision.id).where(Decision.minute_id == minute_id).limit(1))
        or db.scalar(select(Todo.id).where(Todo.minute_id == minute_id).limit(1))
        or db.scalar(
            select(PendingItem.id)
            .where(PendingItem.minute_id == minute_id)
            .limit(1)
        )
    )
    if minute.summary is not None or existing is not None:
        raise HTTPException(status_code=409, detail="Already confirmed")

    summary = [line.strip() for line in payload.summary3]
    if any(not line or len(line) > 60 for line in summary):
        raise HTTPException(status_code=422, detail="Invalid summary3")

    # 担当者は同じチームのメンバーから探す
    team_users = db.scalars(
        select(User).where(User.team_id == user.team_id)
    ).all()

    try:
        for item in payload.decisions:
            content = item.content.strip()
            if not content:
                raise HTTPException(status_code=422, detail="Empty decision")

            if item.replaces and item.replaces.strip():
                previous = db.scalar(
                    select(Decision)
                    .where(
                        Decision.team_id == user.team_id,
                        Decision.status == "current",
                        Decision.content == item.replaces.strip(),
                    )
                    .with_for_update()
                )
                if previous is not None:
                    previous.status = "previous"
                    db.add(
                        DecisionHistory(
                            decision_id=previous.id,
                            old_content=previous.content,
                            new_content=content,
                            change_reason=item.reason,
                            changed_by=user.id,
                            minute_id=minute.id,
                        )
                    )

            db.add(
                Decision(
                    team_id=user.team_id,
                    content=content,
                    reason=item.reason,
                    status="current",
                    minute_id=minute.id,
                    created_by=user.id,
                )
            )

        for content in payload.undecided:
            content = content.strip()
            if not content:
                raise HTTPException(status_code=422, detail="Empty undecided")
            db.add(
                PendingItem(
                    team_id=user.team_id,
                    content=content,
                    status="unresolved",
                    minute_id=minute.id,
                )
            )

        for item in payload.todos:
            task = item.task.strip()
            if not task or len(task) > 200:
                raise HTTPException(status_code=422, detail="Invalid todo")

            assignee_id = None
            if item.assignee and item.assignee.strip():
                matches = [
                    member for member in team_users
                    if member.name == item.assignee.strip()
                ]
                if len(matches) == 1:
                    assignee_id = matches[0].id

            db.add(
                Todo(
                    team_id=user.team_id,
                    title=task,
                    assignee_id=assignee_id,
                    created_by=user.id,
                    due_date=item.due,
                    status="not_started",
                    minute_id=minute.id,
                )
            )

        minute.summary = "\n".join(summary)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return ConfirmResult(
        saved_decisions=len(payload.decisions),
        saved_todos=len(payload.todos),
    )
