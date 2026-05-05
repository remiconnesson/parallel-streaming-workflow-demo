import type { Metadata } from "next";
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
  title: "Parallel Streaming Workflows",
  description:
    "A visual demo of Vercel Workflows spawning parallel children with real-time streaming",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-background h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased h-full`}
      >
        {children}
      </body>
    </html>
  );
}
