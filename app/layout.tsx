import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import DemoBanner from "@/components/DemoBanner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import MobileCtaBar from "@/components/MobileCtaBar";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: "500",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Northwind Dental (demo)",
    template: "%s | Northwind Dental (demo)",
  },
  description:
    "Northwind Dental is a fictional boutique dental clinic website built as a demo project.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-brand focus:px-4 focus:py-2 focus:text-canvas"
        >
          Skip to content
        </a>
        <DemoBanner />
        <Header />
        <main id="main" className="w-full flex-1 py-6 sm:py-10">
          {children}
        </main>
        <Footer />
        <MobileCtaBar />
        <ChatWidget />
      </body>
    </html>
  );
}
