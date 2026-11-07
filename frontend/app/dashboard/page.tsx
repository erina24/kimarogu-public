import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// ダッシュボード(WANT ②)
// チームの MUST「決定事項の一覧(現在/以前)」も、この画面で表示する(10/26 チームで OK)
// 決定事項の一覧 API(開発チーム #52:GET /api/decisions?status=all)を、サーバー側で呼ぶ
// チームは FastAPI がログイン中のユーザーから決める(画面からチームIDは送らない)

// FastAPI の接続先(README で 8001 に統一)
const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:8001";

// #52 の DecisionRead と同じ形
// status は "current"(現在)か "previous"(以前:新しい決定に変わったもの・#54)
type DecisionRead = {
  id: string;
  content: string;
  status: string;
  minute_id: string | null;
  minute_title: string | null;
  meeting_at: string | null;
};

// 現在・以前の決定を、新しい会議の順にもらう(並び順は API 側で決まっている)
async function fetchDecisions(): Promise<DecisionRead[] | "error"> {
  const session = (await cookies()).get("session")?.value;
  if (!session) redirect("/login");

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/decisions?status=all`, {
      headers: { Cookie: `session=${session}` },
      cache: "no-store",
    });
  } catch (error) {
    console.error("Decisions API request failed:", error);
    return "error";
  }

  // redirect は try の外で呼ぶ(try の中だと catch に入ってしまうため)
  if (response.status === 401) redirect("/login");
  if (!response.ok) {
    console.error("Decisions API failed. HTTP status:", response.status);
    return "error";
  }
  return (await response.json()) as DecisionRead[];
}

// 会議の日を「2026/10/25」の形にする(日本時間)
function formatDate(value: string | null) {
  if (!value) return "日付なし";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日付なし";
  return date.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
}

// 決定の一覧(現在・以前で同じ見た目を使う)
function DecisionList({
  decisions,
  emptyText,
  previous = false,
}: {
  decisions: DecisionRead[];
  emptyText: string;
  previous?: boolean;
}) {
  if (decisions.length === 0) {
    return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{emptyText}</p>;
  }
  return (
    <ul className="space-y-3">
      {decisions.map((decision) => (
        <li
          key={decision.id}
          className={
            previous
              ? "rounded-xl border border-slate-200 bg-slate-50 p-4"
              : "rounded-xl border border-slate-200 p-4"
          }
        >
          <p className={previous ? "text-slate-500 line-through" : "font-bold text-[#1c2b4e]"}>
            {decision.content}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {formatDate(decision.meeting_at)}・{decision.minute_title ?? "議事録なし"}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const decisions = await fetchDecisions();
  const current = decisions === "error" ? [] : decisions.filter((d) => d.status === "current");
  const previous = decisions === "error" ? [] : decisions.filter((d) => d.status === "previous");

  return (
    <main className="min-h-screen bg-[#f5f7fb] p-3 sm:p-6">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow-lg">
        <header className="flex items-center gap-3 bg-[#1c2b4e] px-5 py-4 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-xl">
            📌
          </div>
          <div>
            <h1 className="font-bold">ダッシュボード</h1>
            <p className="text-xs text-slate-300">チームの決定事項(現在/以前)を確かめる</p>
          </div>
          <Link
            href="/"
            className="ml-auto rounded-full bg-white/15 px-3 py-1 text-xs hover:bg-white/25"
          >
            チャットへ
          </Link>
        </header>

        <div className="space-y-6 p-4 sm:p-6">
          {decisions === "error" ? (
            <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
              決定事項を読みこめませんでした。時間をおいて、もう一度開いてください。
            </p>
          ) : (
            <>
              <section>
                <h2 className="mb-3 text-lg font-bold text-[#1c2b4e]">
                  最新の決定 <span className="text-sm font-normal text-slate-500">({current.length}件)</span>
                </h2>
                <DecisionList
                  decisions={current}
                  emptyText="まだ決定事項がありません。議事録を保存すると、ここに出ます。"
                />
              </section>

              <section>
                <h2 className="mb-1 text-lg font-bold text-[#1c2b4e]">
                  以前の決定 <span className="text-sm font-normal text-slate-500">({previous.length}件)</span>
                </h2>
                <p className="mb-3 text-xs text-slate-500">新しい決定に変わる前のものです。</p>
                <DecisionList decisions={previous} emptyText="以前の決定はありません。" previous />
              </section>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
