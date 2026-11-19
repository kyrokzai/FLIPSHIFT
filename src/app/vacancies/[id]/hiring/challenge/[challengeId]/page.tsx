import type { Metadata } from "next";
import { ChallengeRunner } from "@/components/challenge/challenge-runner";

export const metadata: Metadata = { title: "Проверка навыков" };

export default async function ChallengePage({ params }: { params: Promise<{ id: string; challengeId: string }> }) {
  const { id, challengeId } = await params;
  return <ChallengeRunner sessionId={id} challengeId={challengeId} />;
}
