import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: "POD Lab", template: "%s · POD Lab" },
  description: "AI-powered print-on-demand brand discovery, launch, testing and scaling operating system.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0a0a0b", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh font-sans text-sm">{children}</body>
    </html>
  );
}
