"use client";

import { appendEvent, type NewEvent } from "@/domain/activity/events";
import { getSession, newId, updateSession } from "./sessions";

/**
 * Записывает событие в журнал вакансии. Вызывается только после того,
 * как действие действительно выполнено. Повтор с тем же ключом не пишется.
 */
export function recordEvent(input: Omit<NewEvent, "vacancyId"> & { vacancyId: string }): void {
  const session = getSession(input.vacancyId);
  if (!session) return;
  if (session.events.some((event) => event.key === input.key)) return;
  updateSession(input.vacancyId, (current) => ({ ...current, events: appendEvent(current.events, input, newId(), Date.now()) }));
}
