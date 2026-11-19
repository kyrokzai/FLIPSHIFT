"use client";

import { CONSENT_VERSION, createTurn, evaluateChallenge, nextSituation, validateSetup } from "@/domain/challenge/engine";
import { MAX_ANSWER_CHARS, type AnswerAuthor, type Challenge, type CustomSituation, type Difficulty, type TemplateId } from "@/domain/challenge/schema";
import { TEMPLATES } from "@/domain/challenge/templates";
import { recordEvent } from "./activity";
import { getSession, newId, updateSession } from "./sessions";

function patchChallenge(sessionId: string, challengeId: string, change: (challenge: Challenge) => Challenge) {
  updateSession(sessionId, (session) => ({
    ...session,
    challenges: session.challenges.map((item) => (item.id === challengeId ? { ...change(item), updatedAt: Date.now() } : item)),
  }));
}

export function findChallenge(sessionId: string, challengeId: string): Challenge | undefined {
  return getSession(sessionId)?.challenges.find((item) => item.id === challengeId);
}

export interface ChallengeSetup {
  templateId: TemplateId;
  difficulty: Difficulty;
  stepCount: number;
  engine: Challenge["engine"];
  customSituations: CustomSituation[];
}

/** Создаёт проверку в статусе «настройка». Режим берётся у кандидата — DEMO и LIVE не смешиваются. */
export function createChallenge(sessionId: string, candidateId: string, setup: ChallengeSetup): { id: string } | { error: string } {
  const session = getSession(sessionId);
  const candidate = session?.candidates.find((item) => item.id === candidateId);
  if (!session || !candidate) return { error: "Кандидат не найден." };
  const problem = validateSetup(setup);
  if (problem) return { error: problem };

  const now = Date.now();
  const challenge: Challenge = {
    id: newId(),
    candidateId,
    mode: candidate.mode,
    templateId: setup.templateId,
    difficulty: setup.difficulty,
    engine: setup.engine,
    stepCount: setup.stepCount,
    customSituations: setup.templateId === "custom" ? setup.customSituations : [],
    status: "setup",
    consent: null,
    turns: [],
    report: null,
    createdAt: now,
    updatedAt: now,
  };
  updateSession(sessionId, (current) => ({ ...current, challenges: [...current.challenges, challenge] }));
  return { id: challenge.id };
}

async function promptFor(challenge: Challenge): Promise<ReturnType<typeof createTurn> | null> {
  const situation = nextSituation(challenge);
  if (!situation) return null;
  if (challenge.engine === "llm" && challenge.templateId !== "custom") {
    try {
      const response = await fetch("/api/challenges/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: challenge.templateId,
          difficulty: challenge.difficulty,
          situationId: situation.id,
          history: challenge.turns.map((turn) => ({ prompt: turn.prompt, answer: turn.answer ?? "" })),
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as { message?: unknown };
        if (typeof data.message === "string" && data.message.trim()) return createTurn(situation, challenge.difficulty, data.message);
      }
    } catch {
      // Модель недоступна — реплика берётся из сценария, и в диалоге это видно.
    }
  }
  return createTurn(situation, challenge.difficulty);
}

/** Согласие кандидата (в DEMO — отметка о вымышленном кандидате) и первая реплика. */
export async function startChallenge(sessionId: string, challengeId: string, author: AnswerAuthor): Promise<void> {
  const challenge = findChallenge(sessionId, challengeId);
  if (!challenge || challenge.status !== "setup") return;
  const effectiveAuthor: AnswerAuthor = challenge.mode === "demo" ? "demo" : author;
  const consented: Challenge = { ...challenge, consent: { version: CONSENT_VERSION, at: Date.now(), author: effectiveAuthor }, status: "in_progress" };
  const first = await promptFor(consented);
  patchChallenge(sessionId, challengeId, () => ({ ...consented, turns: first ? [first] : [] }));
  recordEvent({
    vacancyId: sessionId,
    key: `challenge_started:${challengeId}`,
    type: "challenge_started",
    actor: "employer",
    candidateId: challenge.candidateId,
    mode: challenge.mode,
    result: `${TEMPLATES[challenge.templateId].title}: ${challenge.stepCount} шагов${challenge.mode === "live" ? ", согласие кандидата отмечено" : ", вымышленный кандидат"}.`,
  });
}

function complete(sessionId: string, challengeId: string, status: "completed" | "stopped") {
  const challenge = findChallenge(sessionId, challengeId);
  if (!challenge || challenge.status !== "in_progress") return;
  const answeredTurns = challenge.turns.filter((turn) => turn.answer !== null);
  const finished: Challenge = { ...challenge, turns: answeredTurns, status };
  const report = evaluateChallenge(finished);
  patchChallenge(sessionId, challengeId, () => ({ ...finished, report }));
  recordEvent({
    vacancyId: sessionId,
    key: `challenge_${status}:${challengeId}`,
    type: status === "completed" ? "challenge_completed" : "challenge_stopped",
    actor: status === "completed" ? "agent" : "employer",
    candidateId: challenge.candidateId,
    mode: challenge.mode,
    result: `Отвечено шагов: ${report.answeredSteps} из ${report.totalSteps}. Отчёт сформирован по правилам, без языковой модели.`,
  });
}

/** Сохраняет ответ и переходит к следующей ситуации. Возвращает ошибку или null. */
export async function submitAnswer(sessionId: string, challengeId: string, text: string): Promise<string | null> {
  const answer = text.trim().slice(0, MAX_ANSWER_CHARS);
  if (answer.length < 2) return "Введите ответ.";
  const challenge = findChallenge(sessionId, challengeId);
  if (!challenge || challenge.status !== "in_progress") return "Проверка уже завершена.";
  const index = challenge.turns.findIndex((turn) => turn.answer === null);
  if (index === -1) return "Нет вопроса, ожидающего ответа.";

  const turns = challenge.turns.map((turn, i) => (i === index ? { ...turn, answer, answeredAt: Date.now() } : turn));
  const updated: Challenge = { ...challenge, turns };
  // Ответ сохраняется сразу — перезагрузка страницы его не потеряет.
  patchChallenge(sessionId, challengeId, () => updated);

  const next = await promptFor(updated);
  if (next) {
    patchChallenge(sessionId, challengeId, (current) => (current.turns.length === turns.length ? { ...current, turns: [...current.turns, next] } : current));
  } else {
    complete(sessionId, challengeId, "completed");
  }
  return null;
}

export function stopChallenge(sessionId: string, challengeId: string): void {
  complete(sessionId, challengeId, "stopped");
}

export function discardChallenge(sessionId: string, challengeId: string): void {
  updateSession(sessionId, (session) => ({ ...session, challenges: session.challenges.filter((item) => item.id !== challengeId) }));
}

export function setChallengeWeight(sessionId: string, templateId: TemplateId, criterionId: string, weight: number): void {
  const value = Math.max(0, Math.min(3, Math.round(weight)));
  updateSession(sessionId, (session) => ({
    ...session,
    challengeWeights: { ...session.challengeWeights, [templateId]: { ...(session.challengeWeights[templateId] ?? {}), [criterionId]: value } },
  }));
}
