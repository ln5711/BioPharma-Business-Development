import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oncology BD",
  description:
    "AI-native oncology business-development operating system — turn scientific change into commercial action.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
