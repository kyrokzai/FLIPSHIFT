import type { Metadata } from "next";
import { VacancyList } from "@/components/vacancy-list";

export const metadata: Metadata = { title: "Мои вакансии" };

export default function VacanciesPage() {
  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <h1 className="text-3xl font-light tracking-[-0.02em] sm:text-4xl">Мои вакансии</h1>
      <VacancyList />
    </section>
  );
}
