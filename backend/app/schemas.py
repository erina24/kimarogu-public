"""API で受け取る形・返す形(スキーマ)

機能ごとのスキーマは、ぶつからないように app/schemas/ の下にファイルを分けて足す案もある
(例:minutes.py・chat.py。docs のフォルダ構成の案を参照)
"""

from datetime import datetime

from pydantic import BaseModel, Field


# ===== ログイン =====


# ログイン画面(Next.js)から受け取る形:Firebase の IDトークン(身分証)
class SessionCreate(BaseModel):
    id_token: str


# Next.js に返す形:セッションクッキー(カードキー)と有効期限
class SessionRead(BaseModel):
    session_cookie: str
    # 有効期限(秒)。Next.js がクッキーの maxAge に使う
    expires_in: int

# ===== ログイン中のユーザー情報 =====


class AuthMeRead(BaseModel):
    id: str
    firebase_uid: str
    team_id: str
    team_name: str
    name: str
    role: str

# ===== 議事録 =====


class MinuteCreate(BaseModel):
    """議事録保存APIのリクエスト"""

    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    meeting_at: datetime


class MinuteRead(BaseModel):
    """議事録保存APIのレスポンス"""

    id: str
    title: str
    content: str
    meeting_at: datetime
    team_id: str
    created_by: str
    created_at: datetime