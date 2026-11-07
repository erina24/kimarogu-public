"use client";

import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const idToken = await result.user.getIdToken();

      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        setError("ログインできませんでした。");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("ログインに失敗しました。");
    } finally {
      await signOut(auth);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-heading">きまログ</h1>
        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="mt-6 w-full rounded-full bg-primary px-6 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "ログイン中…" : "Googleでログイン"}
        </button>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      </div>
    </main>
  );
}