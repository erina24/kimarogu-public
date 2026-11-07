"use client";

// 機能①の画面の本体
// ① 入力(タイトル・日時・議事録を貼る)→「AI で整理する」
// ② AI の結果を確認・直す(ExtractionEditor)
// ③「保存する」→ 保存の窓口(POST /api/minutes/save・#55)
//    保存の窓口の中で:本文の保存 → 確定保存 → RAG 登録 をまとめて行う
// チームID・ユーザーID は画面から送らない(それぞれのサーバー側で /api/auth/me から決める)

import { RagRetryButton } from "../rag-retry-button";
import { retryMinuteRag } from "../../lib/rag-retry";
import { useState } from "react";
import { ExtractionEditor } from "./extraction-editor";
import type { MinutesExtraction, SaveResult } from "./minutes-types";

// 抽出を呼ぶ Route Handler の URL(開発チーム・10/26 決定:frontend/app/api/minutes/extract/route.ts)
const EXTRACT_URL = "/api/minutes/extract";
// 保存の窓口(開発チーム・#55)
const SAVE_URL = "/api/minutes/save";

// 文字数の上限(api.md と同じ)
const TITLE_MAX = 100;
const CONTENT_MAX = 10000;

type Step = "input" | "review" | "saved";

// 入力欄の見た目(チャットの入力欄とそろえる)
const inputClass =
  "w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-[#1c2b4e] placeholder:text-slate-400 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-700";
const mainButton =
  "min-h-12 rounded-xl bg-[#269f91] px-5 font-semibold text-white transition hover:bg-[#208779] disabled:cursor-not-allowed disabled:opacity-40";
const subButton =
  "min-h-12 rounded-xl border border-slate-200 px-5 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-40";

/** 抽出の結果を、決めた形にそろえる(項目がなくても画面がこわれないように) */
function normalizeExtraction(data: unknown): MinutesExtraction | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Partial<MinutesExtraction>;
  if (!Array.isArray(d.summary3) || !Array.isArray(d.decisions) || !Array.isArray(d.undecided) || !Array.isArray(d.todos)) {
    return null;
  }
  return {
    summary3: d.summary3.map(String),
    decisions: d.decisions.map((x) => ({
      content: String(x?.content ?? ""),
      reason: x?.reason ? String(x.reason) : null,
      replaces: x?.replaces ? String(x.replaces) : null, // 空の文字は「前の決定なし」
    })),
    undecided: d.undecided.map(String),
    todos: d.todos.map((x) => ({
      task: String(x?.task ?? ""),
      assignee: x?.assignee ? String(x.assignee) : null,
      due: toDateOrNull(x?.due),
    })),
  };
}

/** 期限は YYYY-MM-DD の形だけ残す(AI が「9/12」などで返したときは空=期限未定にする。確定保存の API は日付の形しか受けつけないため) */
function toDateOrNull(v: unknown): string | null {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;
}

/** 保存の前に、空の行を取りのぞき、前後の空白を消す */
function cleanExtraction(e: MinutesExtraction): MinutesExtraction {
  const trimOrNull = (v: string | null) => (v && v.trim() ? v.trim() : null);
  return {
    summary3: e.summary3.map((s) => s.trim()).filter(Boolean),
    decisions: e.decisions
      .map((d) => ({ content: d.content.trim(), reason: trimOrNull(d.reason), replaces: trimOrNull(d.replaces) }))
      .filter((d) => d.content),
    undecided: e.undecided.map((s) => s.trim()).filter(Boolean),
    todos: e.todos
      .map((t) => ({ task: t.task.trim(), assignee: trimOrNull(t.assignee), due: toDateOrNull(t.due) }))
      .filter((t) => t.task),
  };
}

export function MinutesEditor() {
  // ① 入力
  const [title, setTitle] = useState("");
  const [meetingAt, setMeetingAt] = useState(""); // 例:2026-09-08T21:00(日本時間)
  const [content, setContent] = useState("");
  // ② AI の結果(人が直したもの)
  const [extraction, setExtraction] = useState<MinutesExtraction | null>(null);
  // 画面の様子
  const [step, setStep] = useState<Step>("input");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMinuteId, setSavedMinuteId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const canExtract = title.trim() !== "" && meetingAt !== "" && content.trim() !== "" && !loading;

  // ①「AI で整理する」
  async function handleExtract() {
    if (!canExtract) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(EXTRACT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // エラーはチャットと同じ形 { error }(くわしい原因はサーバーのログだけ)
        throw new Error(data?.error ?? "時間をおいてもう一度お試しください");
      }
      const result = normalizeExtraction(data);
      if (!result) throw new Error("うまく整理できませんでした。もう一度お試しください");
      setExtraction(result);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  // ③「保存する」
  async function handleSave() {
    if (!extraction || loading) return;
    const cleaned = cleanExtraction(extraction);
    if (cleaned.summary3.length === 0) {
      setError("決まったこと3行を、1行以上入れてください(なければ「決まったことはありません」)");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(SAVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          // 画面の日時は日本時間 → タイムゾーンつきの形にする(保存の窓口の決まり)
          meeting_at: `${meetingAt}:00+09:00`,
          content: content.trim(),
          extraction: cleaned,
        }),
      });
      const data: SaveResult | null = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "議事録の保存に失敗しました。");
      }
      // RAG 登録だけ失敗したときは、保存は成功・注意の文を出す(10/22 決定)
      setSavedMinuteId(typeof data?.minuteId === "string" ? data.minuteId : null);
      setNotice(data?.ragStatus === "failed" ? data.warning ?? "AI検索への登録に失敗しました。" : null);
      setStep("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  async function handleRagRetry(minuteId: string) {
    setRetrying(true);
    try {
      await retryMinuteRag(minuteId);
    } finally {
      setRetrying(false);
    }
  }

  // 新しい議事録を入れる(はじめにもどる)
  function handleReset() {
    setSavedMinuteId(null);
    setTitle("");
    setMeetingAt("");
    setContent("");
    setExtraction(null);
    setError(null);
    setNotice(null);
    setStep("input");
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* ① 入力 */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-[#1c2b4e]">① 議事録を貼る</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
          <label className="text-sm font-medium text-slate-700">
            タイトル
            <input className={inputClass} value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="例:9/8 定例MTG" disabled={step !== "input" || loading} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            会議の日時
            <input className={inputClass} type="datetime-local" value={meetingAt} onChange={(e) => setMeetingAt(e.target.value)} disabled={step !== "input" || loading} />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          議事録(ふつうのメモでも OK)
          <textarea className={`${inputClass} min-h-48`} value={content} maxLength={CONTENT_MAX} onChange={(e) => setContent(e.target.value)} placeholder="ここに議事録を貼りつけてください" disabled={step !== "input" || loading} />
        </label>
        <p className="text-right text-xs text-slate-500">
          {content.length} / {CONTENT_MAX} 文字
        </p>
        {step === "input" && (
          <button type="button" className={mainButton} onClick={handleExtract} disabled={!canExtract}>
            {loading ? "AI が整理しています…" : "AI で整理する"}
          </button>
        )}
      </section>

      {/* ② 確認・直す */}
      {extraction && step !== "input" && (
        <section className="space-y-4 border-t border-slate-100 pt-6">
          <h2 className="text-lg font-bold text-[#1c2b4e]">② AI の結果を確認・直す</h2>
          <p className="text-sm font-medium text-slate-700">AI の結果はまちがえることがあります。保存する前に、議事録とくらべて直してください。</p>
          <ExtractionEditor value={extraction} onChange={setExtraction} disabled={step === "saved" || loading} />
          {step === "review" && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={mainButton} onClick={handleSave} disabled={loading}>
                {loading ? "保存しています…" : "③ 保存する"}
              </button>
              <button type="button" className={subButton} onClick={() => setStep("input")} disabled={loading}>
                議事録を直す
              </button>
            </div>
          )}
        </section>
      )}

      {/* 保存できたとき */}
      {step === "saved" && (
        <section className="space-y-3 rounded-xl bg-[#eef7f6] p-4" role="status">
          <p className="font-bold text-[#1c2b4e]">保存できました ✅</p>
          {notice && (savedMinuteId
            ? <RagRetryButton key={savedMinuteId} minuteId={savedMinuteId} onRetry={handleRagRetry} />
            : <p className="text-sm text-[#c25a22]">⚠️ {notice}</p>)}
          {/* WANT①:議事録エクスポートのボタンは、ここ(保存のあとだけ)に置く(10/25 合意ずみ・10/27 に MUST がそろったら) */}
          <button type="button" className={subButton} onClick={handleReset} disabled={retrying}>
            新しい議事録を入れる
          </button>
        </section>
      )}

      {/* エラー(くわしい原因は出さない) */}
      {error && (
        <p className="rounded-xl bg-[#fde8e4] p-3 text-sm text-[#b23a26]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
