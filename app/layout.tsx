import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { FooterArt, LogoMark } from "@/components/art";
import { DebugToggle } from "@/components/debug";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EduLearn",
  description: "Learn anything with a course built around you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line bg-paper/90 backdrop-blur sticky top-0 z-20">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 font-display text-xl font-semibold text-brand-dark">
              <LogoMark />
              <span>
                <span className="text-ink">Edu</span>Learn
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <DebugToggle />
              <Link href="/" className="text-sm text-muted hover:text-ink">
                My courses
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-8 pt-6">{children}</main>
        <footer className="mt-4">
          <FooterArt />
          <div className="border-t border-brand/25 bg-[#040913]">
            <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm">
              <span className="font-display text-base text-ink">Learn anything, one lesson at a time.</span>
              <span className="text-muted">EduLearn · courses built around you</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
