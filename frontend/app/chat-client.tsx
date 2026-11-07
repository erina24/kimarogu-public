"use client";

import { useState } from "react";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  sources?: { title: string; date: string }[];
};

export default function ChatClient({ teamName }: { teamName?: string }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const text = question.trim();
    if (!text || loading) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", text },
    ]);
    setQuestion("");
    setLoading(true);

    try {
      // Next.jsのAPIを通じてMastraに質問を送る
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: text }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "AIへの問い合わせに失敗しました。"
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: result.answer || "回答を取得できませんでした。",
          sources: result.sources ?? [],
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "通信エラーが発生しました。",
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-3 sm:p-6">
      <section className="mx-auto flex h-[calc(100dvh-24px)] max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-lg sm:h-[calc(100dvh-48px)]">
        <header className="flex items-center gap-3 bg-[#1c2b4e] px-5 py-4 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl">
            💬
          </div>
          <div>
            <h1 className="font-bold">きまログ</h1>
            <p className="text-xs text-slate-300">
              {teamName ? `${teamName}・根拠つきAIチャット` : "根拠つきAIチャット"}
            </p>
          </div>
          <span className="ml-auto rounded-full bg-white/15 px-3 py-1 text-xs">
            チャット
          </span>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 && (
            <div className="flex min-h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f5f3] text-3xl">
                🧭
              </div>
              <h2 className="text-lg font-bold text-[#1c2b4e]">
                チームの決定事項を確認しよう
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                議事録について質問すると、関連する情報と出典を確認できるチャットです。
              </p>
              <button
                type="button"
                onClick={() =>
                  setQuestion("直近の会議で決まったことを教えて")
                }
                className="mt-6 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-600 transition hover:bg-slate-50"
              >
                <span className="block text-xs text-slate-400">
                  質問例
                </span>
                直近の会議で決まったことを教えて →
              </button>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user"
                  ? "justify-end"
                  : "justify-start"
                }`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 ${message.role === "user"
                    ? "rounded-br-sm bg-[#1c2b4e] text-white"
                    : "rounded-bl-sm border border-slate-100 bg-[#eef7f6] text-slate-700"
                  }`}
              >
                <p className="mb-1 text-xs font-semibold opacity-70">
                  {message.role === "user"
                    ? "あなた"
                    : "AIアシスタント"}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {message.text}
                </p>

                {message.role === "assistant" &&
                  message.sources &&
                  message.sources.length > 0 && (
                    <div className="mt-4 border-t border-slate-200 pt-3">
                      <p className="mb-2 text-xs font-bold">
                        📄 関連する議事録
                      </p>
                      {message.sources.map((source, index) => (
                        <div
                          key={`${source.title}-${index}`}
                          className="mb-2 rounded-lg bg-white p-3 text-xs"
                        >
                          <p className="font-semibold">
                            {source.title}
                          </p>
                          <p className="mt-1 text-slate-500">
                            会議日：{source.date}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          ))}

          {loading && (
            <p className="text-sm text-slate-500" role="status">
              回答を準備しています…
            </p>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-slate-100 bg-white p-3 sm:p-4"
        >
          <label htmlFor="question" className="sr-only">
            質問を入力
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="議事録について質問する…"
              rows={1}
              maxLength={500}
              className="min-h-12 flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
            <button
              type="submit"
              disabled={!question.trim() || loading}
              className="min-h-12 rounded-xl bg-[#269f91] px-5 font-semibold text-white transition hover:bg-[#208779] disabled:cursor-not-allowed disabled:opacity-40"
            >
              送信
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">
            Enterで送信・Shift + Enterで改行
          </p>
        </form>
      </section>
    </main>
  );
}