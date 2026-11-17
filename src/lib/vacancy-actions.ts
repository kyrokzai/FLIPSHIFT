"use client";

import { applyPatch } from "@/domain/vacancy/merge";
import { computeQuestions } from "@/domain/vacancy/questions";
import { buildReply } from "@/domain/vacancy/reply";
import {
  IntakeResponseSchema,
  emptyDraft,
  type Question,
  type QuestionId,
  type QuestionOption,
  type VacancyDraft,
} from "@/domain/vacancy/schema";
import { getSession, message, updateSession } from "./sessions";

const inFlight = new Set<string>();

class IntakeError extends Error {}

/** Отправляет ожидающее сообщение Orchestrator Agent и записывает ответ в черновик. */
export async function deliverPending(id: string): Promise<void> {
  const session = getSession(id);
  if (!session?.pending || inFlight.has(id)) return;
  inFlight.add(id);
  const pending = session.pending;

  try {
    const response = await fetch("/api/vacancies/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: pending.message,
        draft: session.draft,
        questionId: pending.questionId,
        skipped: session.skipped,
      }),
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const reason = data && typeof data === "object" && "error" in data ? String(data.error) : null;
      throw new IntakeError(reason ?? "Сервер не смог обработать запрос. Повторите попытку.");
    }
    const result = IntakeResponseSchema.parse(data);
    updateSession(id, (current) => ({
      ...current,
      draft: result.draft,
      engine: result.engine,
      pending: null,
      failed: null,
      messages: [...current.messages, message("agent", result.reply, result.notices)],
    }));
  } catch (error) {
    const reason =
      error instanceof IntakeError ? error.message : "Нет связи с сервером. Проверьте интернет и повторите.";
    updateSession(id, (current) => ({ ...current, pending: null, failed: { ...pending, reason } }));
  } finally {
    inFlight.delete(id);
  }
}

export function sendMessage(id: string, text: string, questionId: QuestionId | null): void {
  const trimmed = text.trim().slice(0, 2000);
  if (trimmed.length < 2) return;
  updateSession(id, (current) => ({
    ...current,
    failed: null,
    messages: [...current.messages, message("employer", trimmed)],
    pending: { message: trimmed, questionId },
  }));
}

export function retryFailed(id: string): void {
  updateSession(id, (current) =>
    current.failed
      ? { ...current, pending: { message: current.failed.message, questionId: current.failed.questionId }, failed: null }
      : current,
  );
}

/** Ответ кнопкой: применяется сразу в браузере, без запроса к серверу. */
export function chooseOptions(id: string, question: Question, options: QuestionOption[]): void {
  if (options.length === 0) return;
  updateSession(id, (current) => {
    const before = current.draft ?? emptyDraft();
    const after = options.reduce(
      (draft, option) => applyPatch(draft, option.patch, { models: question.mode === "multi" ? "union" : "replace" }),
      before,
    );
    const open = computeQuestions(after, current.skipped).length;
    return {
      ...current,
      draft: after,
      messages: [
        ...current.messages,
        message("employer", options.map((option) => option.label).join(", ")),
        message("agent", buildReply(before, after, open)),
      ],
    };
  });
}

export function skipQuestion(id: string, question: Question): void {
  updateSession(id, (current) => {
    const skipped = [...new Set([...current.skipped, question.id])];
    const draft = current.draft ?? emptyDraft();
    const open = computeQuestions(draft, skipped).length;
    return {
      ...current,
      skipped,
      messages: [
        ...current.messages,
        message("employer", question.skipLabel ?? "Пропустить"),
        message(
          "agent",
          open > 0
            ? "Хорошо, вернёмся к этому позже — пункт можно заполнить в самой вакансии."
            : "Хорошо. Основные условия заполнены. Проверьте вакансию и подтвердите её.",
        ),
      ],
    };
  });
}

export function saveDraft(id: string, draft: VacancyDraft): void {
  updateSession(id, (current) => ({ ...current, draft }));
}

export function setStatus(id: string, status: "draft" | "confirmed"): void {
  updateSession(id, (current) => ({ ...current, status }));
}
