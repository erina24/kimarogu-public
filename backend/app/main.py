"""FastAPI アプリの入り口

- 起動:backend フォルダで uv run uvicorn app.main:app --reload
- API の一覧(説明書):http://localhost:8000/docs
"""

from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.firebase import init_firebase

from app.routers import me, minutes, session
from app.routers import decisions, minutes_confirm

# アプリの起動時・終了時に1回だけ行う処理
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 起動時:Firebase Admin SDK を準備する(ログインの確認に使う)
    init_firebase()
    yield


app = FastAPI(title="Section8 Team A API", lifespan=lifespan)

# ===== API の登録 =====
app.include_router(decisions.router)
app.include_router(minutes_confirm.router)
app.include_router(session.router)
app.include_router(me.router)
app.include_router(minutes.router)
# 機能ごとの API(minutes・decisions・chat など)は、担当の人がここに足す


# ===== 動作確認用 =====


# FastAPI が動いているかの確認
@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


# DB につながっているかの確認
@app.get("/api/health/db")
def health_check_db(db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"database": "ok"}
