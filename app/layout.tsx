import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "qbitUI — qBittorrent Web Interface",
  description: "Modern web interface for qBittorrent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-gray-950 text-white">
        <Providers>
          {children}
          <Toaster richColors position="bottom-right" theme="dark" />
        </Providers>
      </body>
    </html>
  );
}
