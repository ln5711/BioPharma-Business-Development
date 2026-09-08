import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Editorial display face — page titles, metrics, card headlines (spec §129).
const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif-4",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "newwin",
  description:
    "AI-native oncology business-development operating system — turn scientific change into commercial action.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
