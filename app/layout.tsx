import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Company System",
  description: "Company labor cost management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
