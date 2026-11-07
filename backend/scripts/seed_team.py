"""
【検証用チームと4人のユーザーを初期登録する】

使い方:
  cd backend
  uv run python scripts/seed_team.py --file seed-users.json

安全対策:
- 実行前に必ず入力内容を確認する
- --apply を付けない限りDBを変更しない
- 同じFirebase UIDを重複登録しない
- 既存ユーザーのチームや権限を勝手に変更しない
"""

import argparse
import json
import sys
from pathlib import Path

# DB関連のモジュールは、実際に登録するときだけ読み込む。
# 入力確認だけならDB設定や接続は不要。


def load_users(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))

    if not isinstance(data, dict):
        raise ValueError("入力ファイルの形式が正しくありません")

    team_name = data.get("team_name")
    users = data.get("users")

    if not isinstance(team_name, str) or not team_name.strip():
        raise ValueError("チーム名が必要です")

    if not isinstance(users, list) or len(users) != 4:
        raise ValueError("ユーザーは4人分指定してください")

    seen_uids = set()

    for user in users:
        if not isinstance(user, dict):
            raise ValueError("ユーザー情報の形式が正しくありません")

        for field in ("firebase_uid", "name", "role"):
            value = user.get(field)

            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{field} が不足しています")

        uid = user["firebase_uid"].strip()

        if uid in seen_uids:
            raise ValueError("Firebase UIDが重複しています")

        seen_uids.add(uid)

    return team_name.strip(), users


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    team_name, users = load_users(Path(args.file))

    print(f"チーム: {team_name}")
    print(f"登録対象: {len(users)}人")
    print("ユーザー名:", ", ".join(user["name"] for user in users))

    if not args.apply:
        print("✅ 入力内容の確認成功。DBは変更していません。")
        print("実際の登録には --apply が必要です。")
        return

    from sqlalchemy import select
    from app.database import SessionLocal
    from app.models import Team, User

    with SessionLocal.begin() as session:
        team = session.scalar(
            select(Team).where(Team.name == team_name)
        )

        if team is None:
            team = Team(name=team_name)
            session.add(team)
            session.flush()

        for user_data in users:
            uid = user_data["firebase_uid"].strip()

            existing = session.scalar(
                select(User).where(User.firebase_uid == uid)
            )

            if existing is not None:
                if existing.team_id != team.id:
                    raise ValueError(
                        "既存ユーザーが別チームに所属しています。処理を中止します。"
                    )

                print(f"登録済み: {user_data['name']}")
                continue

            session.add(
                User(
                    firebase_uid=uid,
                    team_id=team.id,
                    name=user_data["name"].strip(),
                    role=user_data["role"].strip(),
                )
            )

        print("✅ 初期登録処理を実行しました")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"❌ エラー: {error}", file=sys.stderr)
        sys.exit(1)
