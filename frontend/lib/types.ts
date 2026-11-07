// API(FastAPI)から受け取るデータの形
// backend のスキーマと同じ形にする(片方を変えたら、もう片方も変える)

// Server Action の結果(画面に出すメッセージ)
export type ActionState = {
  ok: boolean; // 成功なら true
  message: string; // 画面に出すメッセージ
};
// チャットで参照する議事録の出典
export type ChatSource = {
  title: string;
  date: string;
};

// チャットの回答
export type ChatAnswer = {
  answer: string;
  found: boolean;
  sources: ChatSource[];
};

// Server Actionから画面に返す結果
export type ChatResult =
  | {
      ok: true;
      result: ChatAnswer;
    }
  | {
      ok: false;
      message: string;
    };