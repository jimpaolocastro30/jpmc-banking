import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { LanguageProvider } from "@/components/i18n";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "Bankak",
  description: "Bankak mobile banking and admin portal",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0E2744",
};

export const instant = false;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full`}>
      <body className="min-h-full antialiased">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
