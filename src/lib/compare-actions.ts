"use client";

import { MAX_COMPARE } from "@/domain/compare/compare";
import { recordEvent } from "./activity";
import { getSession, updateSession } from "./sessions";

/** Кандидаты в сравнении для текущего режима — DEMO и LIVE сравниваются отдельно. */
export function compareIdsFor(session: { compare: string[]; candidates: Array<{ id: string; mode: string }> }, mode: string): string[] {
  return session.compare.filter((id) => session.candidates.some((candidate) => candidate.id === id && candidate.mode === mode));
}

/** Добавляет или убирает кандидата. Возвращает ошибку или null. */
export function toggleCompare(sessionId: string, candidateId: string): string | null {
  const session = getSession(sessionId);
  const candidate = session?.candidates.find((item) => item.id === candidateId);
  if (!session || !candidate) return "Кандидат не найден.";

  const inList = session.compare.includes(candidateId);
  const sameMode = compareIdsFor(session, candidate.mode);
  if (!inList && sameMode.length >= MAX_COMPARE) return `В сравнении уже ${MAX_COMPARE} кандидата. Уберите одного, чтобы добавить другого.`;

  // У DEMO и LIVE свои списки — до трёх кандидатов в каждом; выбор в одном режиме не трогает другой.
  const next = inList ? session.compare.filter((id) => id !== candidateId) : [...session.compare, candidateId];
  updateSession(sessionId, (current) => ({ ...current, compare: next }));
  recordEvent({
    vacancyId: sessionId,
    key: `comparison:${inList ? "remove" : "add"}:${candidateId}:${Date.now()}`,
    type: "comparison_updated",
    actor: "employer",
    candidateId,
    mode: candidate.mode,
    result: inList ? "Кандидат убран из сравнения." : `Кандидат добавлен к сравнению. В списке: ${sameMode.length + 1}.`,
  });
  return null;
}
