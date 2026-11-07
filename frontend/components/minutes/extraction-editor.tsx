"use client";

// AI の抽出の結果を、人が確認して直す部品(決まったこと3行・決定事項・未決事項・ToDo)
// 値は親(MinutesEditor)が持ち、ここでは「直した結果」を onChange で返すだけ

import type {
  ExtractedDecision,
  ExtractedTodo,
  MinutesExtraction,
} from "./minutes-types";

type ExtractionEditorProps = {
  value: MinutesExtraction;
  onChange: (next: MinutesExtraction) => void;
  disabled?: boolean;
};

// 入力欄の見た目(チャットの入力欄とそろえる)
const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#1c2b4e] placeholder:text-slate-400 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50 disabled:text-slate-700";
const smallButton =
  "rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-40";

export function ExtractionEditor({ value, onChange, disabled }: ExtractionEditorProps) {
  // 配列の1つを入れかえる小さな関数
  function replaceAt<T>(list: T[], index: number, item: T): T[] {
    return list.map((old, i) => (i === index ? item : old));
  }
  function removeAt<T>(list: T[], index: number): T[] {
    return list.filter((_, i) => i !== index);
  }

  return (
    <div className="space-y-6">
      {/* ① 決まったこと3行 */}
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="mb-1 text-sm font-bold text-[#1c2b4e]">
          決まったこと3行<span className="ml-2 text-xs font-normal text-slate-500">1〜3行・1行60文字まで</span>
        </legend>
        {value.summary3.map((line, i) => (
          <div key={`summary-${i}`} className="flex gap-2">
            <span className="pt-2 text-sm text-slate-500">{i + 1}.</span>
            <input
              className={inputClass}
              value={line}
              maxLength={60}
              onChange={(e) => onChange({ ...value, summary3: replaceAt(value.summary3, i, e.target.value) })}
              aria-label={`決まったこと ${i + 1}行め`}
            />
            {value.summary3.length > 1 && (
              <button type="button" className={smallButton} onClick={() => onChange({ ...value, summary3: removeAt(value.summary3, i) })}>
                消す
              </button>
            )}
          </div>
        ))}
        {value.summary3.length < 3 && (
          <button type="button" className={smallButton} onClick={() => onChange({ ...value, summary3: [...value.summary3, ""] })}>
            + 行を足す
          </button>
        )}
      </fieldset>

      {/* ② 決定事項 */}
      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="mb-1 text-sm font-bold text-[#1c2b4e]">決定事項</legend>
        {value.decisions.length === 0 && <p className="text-sm text-slate-500">決定事項はありません</p>}
        {value.decisions.map((d, i) => {
          const update = (patch: Partial<ExtractedDecision>) =>
            onChange({ ...value, decisions: replaceAt(value.decisions, i, { ...d, ...patch }) });
          return (
            <div key={`decision-${i}`} className="space-y-2 rounded-xl border border-slate-100 bg-[#f8fbfb] p-3">
              <input className={inputClass} value={d.content} onChange={(e) => update({ content: e.target.value })} aria-label="決まったこと" placeholder="決まったこと" />
              <input className={inputClass} value={d.reason ?? ""} onChange={(e) => update({ reason: e.target.value || null })} aria-label="理由" placeholder="理由(書いていなければ空のまま)" />
              {/* 前の決定:AI が「前の決定を変えた」と判断したときだけ出す */}
              {d.replaces !== null && (
                <p className="text-sm text-slate-600">
                  🔁 前の決定:<span className="font-semibold">{d.replaces}</span>(保存すると「以前」になります)
                </p>
              )}
              <div className="text-right">
                <button type="button" className={smallButton} onClick={() => onChange({ ...value, decisions: removeAt(value.decisions, i) })}>
                  この決定を消す
                </button>
              </div>
            </div>
          );
        })}
        <button type="button" className={smallButton} onClick={() => onChange({ ...value, decisions: [...value.decisions, { content: "", reason: null, replaces: null }] })}>
          + 決定事項を足す
        </button>
      </fieldset>

      {/* ③ まだ決まっていないこと */}
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="mb-1 text-sm font-bold text-[#1c2b4e]">まだ決まっていないこと</legend>
        {value.undecided.length === 0 && <p className="text-sm text-slate-500">ありません</p>}
        {value.undecided.map((item, i) => (
          <div key={`undecided-${i}`} className="flex gap-2">
            <input className={inputClass} value={item} onChange={(e) => onChange({ ...value, undecided: replaceAt(value.undecided, i, e.target.value) })} aria-label="まだ決まっていないこと" />
            <button type="button" className={smallButton} onClick={() => onChange({ ...value, undecided: removeAt(value.undecided, i) })}>
              消す
            </button>
          </div>
        ))}
        <button type="button" className={smallButton} onClick={() => onChange({ ...value, undecided: [...value.undecided, ""] })}>
          + 足す
        </button>
      </fieldset>

      {/* ④ ToDo */}
      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="mb-1 text-sm font-bold text-[#1c2b4e]">ToDo</legend>
        {value.todos.length === 0 && <p className="text-sm text-slate-500">ToDo はありません</p>}
        {value.todos.map((t, i) => {
          const update = (patch: Partial<ExtractedTodo>) =>
            onChange({ ...value, todos: replaceAt(value.todos, i, { ...t, ...patch }) });
          return (
            <div key={`todo-${i}`} className="grid gap-2 rounded-xl border border-slate-100 bg-[#f8fbfb] p-3 sm:grid-cols-[1fr_8rem_9rem_auto]">
              <input className={inputClass} value={t.task} maxLength={200} onChange={(e) => update({ task: e.target.value })} aria-label="やること" placeholder="やること" />
              {/* 担当・期限は空なら「未定」(10/21 決定:担当者未定) */}
              <input className={inputClass} value={t.assignee ?? ""} onChange={(e) => update({ assignee: e.target.value || null })} aria-label="担当" placeholder="担当者未定" />
              <input className={inputClass} type="date" value={t.due ?? ""} onChange={(e) => update({ due: e.target.value || null })} aria-label="期限" title="期限(空なら期限未定)" />
              <button type="button" className={smallButton} onClick={() => onChange({ ...value, todos: removeAt(value.todos, i) })}>
                消す
              </button>
            </div>
          );
        })}
        <button type="button" className={smallButton} onClick={() => onChange({ ...value, todos: [...value.todos, { task: "", assignee: null, due: null }] })}>
          + ToDo を足す
        </button>
      </fieldset>
    </div>
  );
}
