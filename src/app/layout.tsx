import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Home } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BukkenWeb - 賃貸物件管理",
  description: "賃貸物件・空室・対応履歴の管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {/* ページ側が h-[calc(100dvh-3.5rem)] を前提にしているため、高さ3.5remの固定ヘッダーを置く */}
        <header className="sticky top-0 z-50 h-14 bg-emerald-700 text-white flex items-center px-4 sm:px-6 shadow-sm">
          <Link href="/" className="flex items-center gap-2 font-extrabold tracking-wide">
            <Home className="h-5 w-5" />
            <span>BukkenWeb</span>
          </Link>
          <span className="ml-3 text-xs font-medium text-emerald-100 hidden sm:inline">
            賃貸物件管理システム
          </span>
        </header>
        {children}
      </body>
    </html>
  );
}

