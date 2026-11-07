// 機能①:議事録の画面(入力 → AI で整理 → 確認・直す → 保存)
// ページ自体はサーバーで表示し、入力や保存の動きは MinutesEditor(クライアント)にまかせる

import type { Metadata } from "next";
import { MinutesEditor } from "@/components/minutes/minutes-editor";

export const metadata: Metadata = {
  title: "議事録 | きまログ",
};

export default function MinutesPage() {
  return (
    <main className="min-h-screen bg-[#f5f7fb] p-3 sm:p-6">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow-lg">
        {/* チャットの画面と同じ見た目のヘッダー */}
        <header className="flex items-center gap-3 bg-[#1c2b4e] px-5 py-4 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl">
            📝
          </div>
          <div>
            <h1 className="font-bold">きまログ</h1>
            <p className="text-xs text-slate-300">議事録 → 決まったこと3行・ToDo</p>
          </div>
          <span className="ml-auto rounded-full bg-white/15 px-3 py-1 text-xs">議事録</span>
        </header>
        <MinutesEditor />
      </section>
    </main>
  );
}
