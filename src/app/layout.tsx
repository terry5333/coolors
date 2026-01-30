import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Coolors Lite",
    template: "%s | Coolors Lite",
  },
  description: "A Coolors-inspired color palette generator with cloud saving.",
  icons: {
    // 🔥 關鍵：加版本號，強制瀏覽器刷新 favicon
    icon: "/favicon.ico?v=2",
    shortcut: "/favicon.ico?v=2",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <head>
        {/* 🔥 雙保險：有些瀏覽器只吃 link */}
        <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
        <link rel="shortcut icon" href="/favicon.ico?v=2" />
        <meta name="theme-color" content="#FFFACC" />
      </head>
      <body>{children}</body>
    </html>
  );
}
