import type { Metadata } from "next";
import { ChallengeSetupView } from "@/components/challenge/challenge-setup";

export const metadata: Metadata = { title: "Проверка навыков" };

export default async function ChallengeSetupPage({ params }: { params: Promise<{ id: string; candidateId: string }> }) {
  const { id, candidateId } = await params;
  return <ChallengeSetupView sessionId={id} candidateId={candidateId} />;
}
