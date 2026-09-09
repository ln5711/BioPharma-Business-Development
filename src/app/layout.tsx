import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

// Display face — Source Serif 4 at light weights (300/400) for the Pulsar look.
const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif-4",
  display: "swap",
  weight: ["300", "400", "500"],
});

// Machine-readout voice — eyebrows, ids, figures, kbd hints.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "newwin",
  description:
    "Signal intelligence for oncology business development — every trial amendment, publication, personnel move and financing event, deduplicated, scored and sequenced.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
