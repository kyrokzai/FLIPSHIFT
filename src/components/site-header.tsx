import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]">
        <Link href="/" className="flex items-baseline gap-2.5 rounded-sm" aria-label="FORMIQ Talent Agent — на главную">
          <span className="text-[1.0625rem] font-semibold tracking-[0.16em] text-ink">FORMIQ</span>
          <span aria-hidden className="h-3.5 w-px translate-y-0.5 bg-gold" />
          <span className="text-[0.9375rem] font-normal text-ink-soft">Talent Agent</span>
        </Link>
        <nav aria-label="Основная навигация">
          <Link
            href="/vacancies"
            className="inline-flex min-h-11 items-center rounded-md px-2 text-[0.9375rem] font-medium text-ink-soft hover:text-ink"
          >
            Мои вакансии
          </Link>
        </nav>
      </div>
    </header>
  );
}
