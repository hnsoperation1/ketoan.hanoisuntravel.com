import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth";
import { ThemeProvider } from "@/contexts/theme";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "HNS Kế toán",
  description: "Quản lý hồ sơ & hợp đồng HDV/MC/NS cho các đoàn tour",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ThemeProvider>
            <AppShell>{children}</AppShell>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
