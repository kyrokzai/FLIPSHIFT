export function SiteFooter() {
  return (
    <footer className="border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-5 py-8 text-sm text-muted sm:flex-row sm:items-baseline sm:justify-between">
        <p>
          <span className="font-semibold tracking-[0.14em] text-ink-soft">FORMIQ</span>
          <span className="ml-2">Intelligence in Motion</span>
        </p>
        <p>© 2026 FORMIQ. Talent Agent — платформа в разработке.</p>
      </div>
    </footer>
  );
}
