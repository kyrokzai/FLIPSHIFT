import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-paper pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))]">
        <Link href="/" className="flex min-w-0 items-baseline gap-2 rounded-sm sm:gap-2.5" aria-label="FORMIQ Talent Agent — на главную">
          <span className="text-base font-semibold tracking-[0.12em] text-ink sm:text-[1.0625rem] sm:tracking-[0.16em]">FORMIQ</span>
          <span aria-hidden className="h-3.5 w-px translate-y-0.5 bg-gold" />
          <span className="whitespace-nowrap text-sm font-normal text-ink-soft sm:text-[0.9375rem]">Talent Agent</span>
        </Link>
        <nav aria-label="Основная навигация" className="flex shrink-0 items-center gap-1 sm:gap-3">
          <Link
            href="/activity"
            className="inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-1.5 sm:px-2 text-[0.9375rem] font-medium text-ink-soft hover:text-ink"
          >
            Журнал
          </Link>
          <Link
            href="/vacancies"
            aria-label="Мои вакансии"
            className="inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-1.5 sm:px-2 text-[0.9375rem] font-medium text-ink-soft hover:text-ink"
          >
            <span className="sm:hidden">Вакансии</span>
            <span className="hidden sm:inline">Мои вакансии</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
