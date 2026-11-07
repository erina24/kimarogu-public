
/**
 * 【会話メモリをユーザー・チーム別に分ける機能】
 *
 * 同じチャット機能を使っていても、
 * 別のユーザーや別のチームの会話履歴が混ざらないようにする。
 *
 * Mastra Memoryでは、resourceIdを使って会話の所有者を識別する。
 *
 * ※ teamIdとuserIdには、ログイン認証後に
 *   サーバー側で確認した値だけを渡すこと。
 * ※ このファイル自体はログイン認証を行わない。
 */

/**
 * 【認証済みユーザーの情報】
 *
 * teamId：所属チームのID
 * userId：DBに登録されているユーザーID
 */
export type AuthenticatedMemoryUser = {
  teamId: string;
  userId: string;
};

/**
 * 【会話の所有者を識別するIDを作る】
 *
 * チームとユーザーの組み合わせから、
 * Mastra Memoryに渡すresourceIdを作成する。
 *
 * 同じチーム・同じユーザー → 同じresourceId
 * 別チームまたは別ユーザー → 異なるresourceId
 */
export function createMemoryResourceId(
  user: AuthenticatedMemoryUser,
): string {
  const teamId = user.teamId?.trim();
  const userId = user.userId?.trim();

  // IDが不足している場合は履歴を読み出さない
  if (!teamId || !userId) {
    throw new Error(
      "MEMORY_SCOPE_ERROR: ユーザーIDまたはチームIDが不足しています",
    );
  }

  // JSON形式にすることで、IDの区切りが曖昧になるのを防ぐ
  return `team-user:${JSON.stringify([teamId, userId])}`;
}
