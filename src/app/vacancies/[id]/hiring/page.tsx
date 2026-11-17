import type { Metadata } from "next";
import { HiringWorkspace } from "@/components/hiring/hiring-workspace";

export const metadata: Metadata = { title: "Подбор кандидатов" };

export default async function HiringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HiringWorkspace id={id} />;
}
