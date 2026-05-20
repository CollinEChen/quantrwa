import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "QuantRWA",
  description: "Decentralized Real-World Asset Tokenization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
        <header className="bg-slate-950/95 border-b border-slate-800 shadow-sm">
          <div className="container mx-20 flex flex-wrap items-center justify-between px-0 py-4">
            <div>
              <Link href='/' className="flex items-center gap-2">
                <img src="/navbar-logo-2.png" alt="QuantRWA Logo" className="h-15 w-70" />
              </Link>
            </div>
            <nav className="flex flex-wrap items-center gap-2 text-sm">
              <Link href="/" className="rounded-full px-4 py-2 text-slate-200 transition hover:bg-slate-800/80">
                Home
              </Link>
              <Link href="/trading" className="rounded-full bg-cyan-500 px-4 py-2 text-slate-950 transition hover:bg-cyan-400">
                Trading Dashboard
              </Link>
            </nav>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
