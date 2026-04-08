import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Company System",
  description: "Company labor cost management system",
};

const primaryMenus = [
  { href: "/", label: "노무비 입력" },
  { href: "/fund-request", label: "자금청구서" },
  { href: "/workers", label: "근로자 관리" },
  { href: "/settings/rates", label: "보험/세금 설정" },
];

const adminMenus = [
  { href: "/sites", label: "현장관리" },
  { href: "/clients", label: "거래처관리" },
  { href: "/general-affairs", label: "총무관리" },
  { href: "/hr", label: "인사관리" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">
        <div className="flex min-h-full">
          <aside className="w-64 shrink-0 border-r border-slate-200 bg-white px-4 py-5">
            <div className="mb-6">
              <h1 className="text-base font-semibold text-slate-900">Company System</h1>
              <p className="mt-1 text-xs text-slate-500">?낅Т 硫붾돱</p>
            </div>

            <nav className="space-y-1">
              {primaryMenus.map((menu) => (
                <Link
                  key={menu.href}
                  href={menu.href}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  {menu.label}
                </Link>
              ))}
            </nav>

            <div className="mt-7 border-t border-slate-200 pt-5">
              <p className="mb-2 px-3 text-xs font-semibold tracking-wide text-slate-500">愿由ъ옄</p>
              <nav className="space-y-1">
                {adminMenus.map((menu) => (
                  <Link
                    key={menu.href}
                    href={menu.href}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    {menu.label}
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
