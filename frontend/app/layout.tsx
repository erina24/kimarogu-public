import type { Metadata } from "next";
import { Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-zen-maru-gothic",
});

export const metadata: Metadata = {
  title: "きまログ",
  description: "議事録から決まったことを取り出し、根拠つきで答えるチーム開発のアシスタント",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={zenMaruGothic.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}