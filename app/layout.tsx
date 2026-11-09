import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import DemoBanner from "@/components/DemoBanner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Northwind Dental (demo)",
    template: "%s | Northwind Dental (demo)",
  },
  description:
    "Northwind Dental is a fictional dental clinic website built as a demo project.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-brand focus:px-4 focus:py-2 focus:text-canvas"
        >
          Skip to content
        </a>
        <DemoBanner />
        <Header />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">
          {children}
        </main>
        <Footer />
        {/* TODO(Task 7): mount <ChatWidget /> here (floating chat widget). Intentionally empty for now. */}
      </body>
    </html>
  );
}
