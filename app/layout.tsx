import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import AccountNav from "@/features/auth/account-nav";
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
  title: "Echo of Photons",
  description: "以星图识别为入口，帮助用户看懂夜空并逐步建立观星兴趣",
};

const navItems = [
  { href: "/", label: "首页" },
  { href: "/sky-map", label: "星图" },
  { href: "/observations", label: "记录" },
  { href: "/achievements", label: "成就" },
  { href: "/gallery", label: "画廊" },
  { href: "/tools", label: "工具" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://basemaps.cartocdn.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://basemaps.cartocdn.com" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-sm">
          <nav className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-3 px-4">
            <Link
              href="/"
              className="shrink-0 text-sm font-medium tracking-wide text-accent"
            >
              <span className="sm:hidden">EOP</span>
              <span className="hidden sm:inline">Echo of Photons</span>
            </Link>
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-white/60 transition-colors hover:text-white/90"
                >
                  {item.label}
                </Link>
              ))}
              <AccountNav />
            </div>
          </nav>
        </header>
        <main className="flex-1 pt-12">{children}</main>
      </body>
    </html>
  );
}
