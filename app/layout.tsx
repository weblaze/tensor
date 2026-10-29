import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Devanagari } from "next/font/google";
import "@/styles/tokens.css";
import "@/styles/components.css";
import "@/styles/app.css";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap" });
const deva = IBM_Plex_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "500", "600"], variable: "--font-plex-deva", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Tensor", template: "%s · Tensor" },
  description: "Operations for Design Matrix clinic builds",
  icons: { icon: "/tensor-mark.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f7f6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${deva.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
