import type { Metadata } from "next";
import { CompareView } from "@/components/compare/compare-view";

export const metadata: Metadata = { title: "Сравнение кандидатов" };

export default async function ComparePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompareView sessionId={id} />;
}
