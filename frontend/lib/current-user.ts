// ログインしている人を FastAPI の /api/auth/me で確かめる部品（サーバー側だけで使う）
// チームID・ユーザーID は、ここで返ってきた値だけを使う（画面から送られた値は使わない）
import { cookies } from "next/headers";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:8001";

export type CurrentUser = {
  id: string;
  team_id: string;
  team_name?: string; // 所属チーム名
  name: string;
  role: string;
};

export type CurrentUserResult =
  | { status: "ok"; user: CurrentUser }
  | { status: "not_logged_in" } // ログインしていない・期限切れ
  | { status: "not_member" } // ログインはできたが、DB の users にいない
  | { status: "error" }; // FastAPI につながらない など

export async function getCurrentUser(): Promise<CurrentUserResult> {
  const session = (await cookies()).get("session")?.value;
  if (!session) return { status: "not_logged_in" };

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Cookie: `session=${session}` },
      cache: "no-store",
    });

    if (response.status === 401) return { status: "not_logged_in" };
    // 未登録ユーザーを示す403/404を同じ状態として扱う
    if (response.status === 403 || response.status === 404) return { status: "not_member" };
    if (!response.ok) {
      console.error("Auth /me failed. HTTP status:", response.status);
      return { status: "error" };
    }

    const user = await response.json();
    if (typeof user.id !== "string" || !user.id || typeof user.team_id !== "string" || !user.team_id) {
      return { status: "error" };
    }

    return {
      status: "ok",
      user: {
        id: user.id,
        team_id: user.team_id,
        team_name: typeof user.team_name === "string" && user.team_name ? user.team_name : undefined,
        name: String(user.name ?? ""),
        role: String(user.role ?? ""),
      },
    };
  } catch (error) {
    console.error("Auth /me error:", error);
    return { status: "error" };
  }
}
