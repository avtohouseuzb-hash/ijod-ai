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
  metadataBase: new URL("https://ijod-ai.uz"),
  title: {
    default: "IJOD AI — Sun’iy intellekt ijodiy platformasi",
    template: "%s | IJOD AI",
  },
  description:
    "IJOD AI — rasm, video, matn va ijodiy kontent yaratish uchun yagona AI platforma.",
  applicationName: "IJOD AI",
  openGraph: {
    type: "website",
    locale: "uz_UZ",
    siteName: "IJOD AI",
    title: "IJOD AI — Sun’iy intellekt ijodiy platformasi",
    description:
      "Rasm, video, matn va ijodiy kontent yaratish uchun yagona AI platforma.",
    url: "https://ijod-ai.uz",
  },
  twitter: {
    card: "summary_large_image",
    title: "IJOD AI — Sun’iy intellekt ijodiy platformasi",
    description:
      "Rasm, video, matn va ijodiy kontent yaratish uchun yagona AI platforma.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="uz"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
