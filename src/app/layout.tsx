import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MythicalMind — Studio Rundown & Ruang Kerja Produktif",
  description:
    "Susun rundown acara dan rencana harian dalam hitungan menit — dari template siap pakai atau dengan AI milikmu sendiri — lalu ekspor ke PDF. Ruang kerja produktivitas pribadi dengan penyedia AI apa pun yang kompatibel dengan OpenAI.",
  applicationName: "MythicalMind",
};

export const viewport: Viewport = {
  themeColor: "#04060d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "rgba(10, 14, 26, 0.92)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "#e8edf7",
              backdropFilter: "blur(14px)",
            },
          }}
        />
      </body>
    </html>
  );
}
