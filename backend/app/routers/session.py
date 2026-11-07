import time
from datetime import timedelta

from fastapi import APIRouter, HTTPException
from firebase_admin import auth

from app.schemas import SessionCreate, SessionRead

router = APIRouter(prefix="/api/auth", tags=["auth"])

SESSION_EXPIRES_IN = timedelta(days=5)
RECENT_SIGN_IN_SECONDS = 5 * 60


@router.post("/session", response_model=SessionRead)
def create_session(body: SessionCreate) -> SessionRead:
    try:
        decoded = auth.verify_id_token(body.id_token, check_revoked=True)
    except (auth.InvalidIdTokenError, auth.UserDisabledError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid ID token")

    if time.time() - decoded["auth_time"] > RECENT_SIGN_IN_SECONDS:
        raise HTTPException(status_code=401, detail="Recent sign-in required")


    session_cookie = auth.create_session_cookie(body.id_token, expires_in=SESSION_EXPIRES_IN)

    return SessionRead(
        session_cookie=session_cookie,
        expires_in=int(SESSION_EXPIRES_IN.total_seconds()),
    )