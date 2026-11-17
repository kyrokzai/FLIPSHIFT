import type { Metadata } from "next";
import { VacancyWorkspace } from "@/components/vacancy-workspace";

export const metadata: Metadata = { title: "Вакансия" };

export default async function VacancyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VacancyWorkspace id={id} />;
}
