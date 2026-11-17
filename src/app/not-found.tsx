import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-20">
      <h1 className="text-3xl font-light tracking-[-0.02em] sm:text-4xl">Такой страницы нет</h1>
      <p className="mt-4 max-w-[50ch] leading-relaxed text-ink-soft">
        Возможно, ссылка устарела. Начните с главной — там можно описать, кого вы ищете.
      </p>
      <Link href="/" className="btn btn-primary mt-8">
        На главную
      </Link>
    </section>
  );
}
