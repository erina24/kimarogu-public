// トップページ：ページを開く前に、サーバー側でログインとチームのメンバーかを確かめる
// URL の直接入力・ページの再読み込みのときも、必ずここを通る
import { redirect } from "next/navigation";

import ChatClient from "./chat-client";
import { getCurrentUser } from "../lib/current-user";

// ログインの状態は人ごとにちがうので、毎回サーバーで確かめる
export const dynamic = "force-dynamic";

export default async function Home() {
  const result = await getCurrentUser();

  if (result.status === "not_logged_in") {
    redirect("/login");
  }

  if (result.status === "not_member") {
    return (
      <Notice
        title="利用権限がありません"
        message="このアカウントは、チームのメンバーとして登録されていません。チームの管理者に確認してください。"
      />
    );
  }

  if (result.status === "error") {
    return <Notice title="読みこめませんでした" message="時間をおいてもう一度お試しください。" />;
  }

  return <ChatClient teamName={result.user.team_name} />;
}

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-6">
      <section className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
        <div className="mb-4 text-3xl">🔒</div>
        <h1 className="text-lg font-bold text-[#1c2b4e]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{message}</p>
        <a
          href="/login"
          className="mt-6 inline-block rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          ログイン画面へ
        </a>
      </section>
    </main>
  );
}