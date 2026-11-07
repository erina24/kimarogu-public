// 機能①で使う型(この画面だけで使うので、共通の lib/types.ts にはさわらない)
// 形は docs/ai-design.md の「出力の型」と、保存の窓口(#55)にそろえる

/** 決定事項 1つ */
export type ExtractedDecision = {
  content: string; // 決まったこと
  reason: string | null; // 理由(書いていなければ null)
  replaces: string | null; // 前の決定を変えたとき、その前の決定の文(なければ null)
};

/** ToDo 1つ */
export type ExtractedTodo = {
  task: string; // やること
  assignee: string | null; // 担当(書いていなければ null → 画面では「担当者未定」)
  due: string | null; // 期限(YYYY-MM-DD。書いていなければ null → 画面では「期限未定」)
};

/** AI の抽出の結果(= 出力の型) */
export type MinutesExtraction = {
  summary3: string[]; // 決まったこと3行(1〜3行・1行60文字まで)
  decisions: ExtractedDecision[];
  undecided: string[]; // まだ決まっていないこと
  todos: ExtractedTodo[];
};

/** 保存の窓口(POST /api/minutes/save・#55)が返す形 */
export type SaveResult = {
  minuteId?: string;
  ragStatus?: "success" | "failed" | "not_started";
  warning?: string; // RAG 登録に失敗したときの文(10/22 決定)
  error?: string;
};
