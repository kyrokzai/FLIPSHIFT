import type { Metadata, Viewport } from "next";
import "@fontsource-variable/geologica";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: {
    default: "FORMIQ Talent Agent — ИИ-подбор сотрудников",
    template: "%s — FORMIQ Talent Agent",
  },
  description:
    "Опишите обычными словами, кого вы ищете. Talent Agent соберёт вакансию, уточнит недостающие условия и подготовит подбор кандидатов.",
  applicationName: "FORMIQ Talent Agent",
  authors: [{ name: "FORMIQ" }],
  formatDetection: { telephone: false },
  // Пилот не должен попадать в поисковую выдачу: ссылку получают только те, кому её дали.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f3f4f6",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Перейти к содержимому
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
