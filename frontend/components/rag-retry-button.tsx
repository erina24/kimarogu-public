
"use client";

import { useRef, useState } from "react";

/**
 * RAG登録に失敗したときに表示する再試行ボタン。
 *
 * 議事録のDB保存自体は成功しているため、
 * 再試行時に議事録を二重保存しない。
 *
 * 実際の再登録処理は、親画面から渡されるAPI呼び出しが担当する。
 */

type RagRetryButtonProps = {
  // DBに保存済みの議事録ID
  minuteId: string;

  // 親画面から渡す再試行処理
  onRetry: (minuteId: string) => Promise<void>;
};

export function RagRetryButton({
  minuteId,
  onRetry,
}: RagRetryButtonProps) {
  const [status, setStatus] = useState<
    "failed" | "loading" | "success"
  >("failed");

  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    // ボタンの連打による多重実行を防ぐ
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);

    setStatus("loading");

    try {
      await onRetry(minuteId);
      setStatus("success");
    } catch (error) {
      setError(error instanceof Error ? error.message : "AI検索への再登録に失敗しました。");
      // 再試行が失敗した場合も、再度ボタンを押せるようにする
      setStatus("failed");
    } finally {
      inFlight.current = false;
    }
  }

  if (status === "success") {
    return (
      <p role="status" className="text-sm text-green-700">
        AI検索への登録が完了しました。
      </p>
    );
  }

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4"
    >
      <p className="text-sm text-amber-900">
        議事録は保存されていますが、AI検索への登録に失敗しました。
        もう一度お試しください。
      </p>

      {error && <p role="alert" className="mt-2 text-sm text-amber-900">{error}</p>}

      <button
        type="button"
        onClick={handleRetry}
        disabled={status === "loading"}
        className="mt-3 rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {status === "loading" ? "再登録中…" : "再試行"}
      </button>
    </div>
  );
}
