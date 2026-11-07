from typing import Annotated

from fastapi import Cookie, HTTPException
from firebase_admin import auth

SESSION_COOKIE_NAME = "session"


def require_admin(
    session: Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)] = None,
) -> dict:
    if session is None:
        raise HTTPException(status_code=404, detail="Not Found")

    try:
        claims = auth.verify_session_cookie(session, check_revoked=True)
    except (
        auth.InvalidSessionCookieError,
        auth.ExpiredSessionCookieError,
        auth.RevokedSessionCookieError,
        auth.UserDisabledError,
        ValueError,
    ):
        raise HTTPException(status_code=404, detail="Not Found")

    if claims.get("admin") is not True:
        raise HTTPException(status_code=404, detail="Not Found")

    return claims


def require_user(
    session: Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)] = None,
) -> dict:
    if session is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        claims = auth.verify_session_cookie(session, check_revoked=True)
    except (
        auth.InvalidSessionCookieError,
        auth.ExpiredSessionCookieError,
        auth.RevokedSessionCookieError,
        auth.UserDisabledError,
        ValueError,
    ):
        raise HTTPException(status_code=401, detail="Not authenticated")

    return claims
