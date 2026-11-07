import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request) {
  const { idToken } = await request.json();

  const res = await fetch(`${API_BASE_URL}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false }, { status: res.status });
  }

  const { session_cookie, expires_in } = await res.json();

  const cookieStore = await cookies();
  cookieStore.set("session", session_cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expires_in,
  });

  return NextResponse.json({ ok: true });
}