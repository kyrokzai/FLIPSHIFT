import Link from "next/link";

export function BackToHiring({ sessionId }: { sessionId: string }) {
  return (
    <Link
      href={`/vacancies/${sessionId}/hiring`}
      className="inline-flex min-h-11 items-center text-[0.9375rem] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink"
    >
      К подбору
    </Link>
  );
}

export function DemoBadge() {
  return <span className="ml-2 whitespace-nowrap rounded-full bg-gold-wash px-2 py-0.5 align-middle text-xs font-medium text-gold-deep">Демо, вымышлен</span>;
}

export function NotFound({ sessionId, title, text }: { sessionId: string; title: string; text: string }) {
  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-light tracking-[-0.02em] sm:text-4xl">{title}</h1>
      <p className="mt-4 max-w-[52ch] leading-relaxed text-ink-soft">{text}</p>
      <Link href={`/vacancies/${sessionId}/hiring`} className="btn btn-primary mt-8">
        К подбору
      </Link>
    </section>
  );
}
