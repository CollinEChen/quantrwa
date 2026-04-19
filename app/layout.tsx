import type { Metadata } from "next";
import { Orbitron, DM_Sans } from "next/font/google";
import { Navbar } from "./components/Navbar";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "QuantRWA - Decentralized Real-World Asset Tokenization",
  description: "Tokenize, appraise, and trade real-world assets with AI-powered analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${orbitron.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gradient-to-br from-[#0a1628] to-[#0d2137] text-white font-sans">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}
