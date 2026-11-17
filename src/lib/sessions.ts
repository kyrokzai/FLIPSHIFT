"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { NoticeSchema, QuestionIdSchema, VacancyDraftSchema, type QuestionId, type VacancyDraft } from "@/domain/vacancy/schema";

/**
 * Черновики вакансий без регистрации хранятся только в браузере работодателя.
 * На сервер они не сохраняются. С этапа H3 подтверждённые вакансии
 * переносятся в аккаунт организации.
 */

const STORAGE_KEY = "formiq.talent-agent.vacancies.v1";
const MAX_SESSIONS = 30;

const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["employer", "agent"]),
  text: z.string(),
  notices: z.array(NoticeSchema).default([]),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

const PendingSchema = z.object({
  message: z.string(),
  questionId: QuestionIdSchema.nullable(),
});

const SessionSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  status: z.enum(["draft", "confirmed"]),
  draft: VacancyDraftSchema.nullable(),
  messages: z.array(ChatMessageSchema),
  skipped: z.array(QuestionIdSchema),
  engine: z.enum(["rules", "llm"]).nullable(),
  /** Сообщение, которое ждёт ответа агента. */
  pending: PendingSchema.nullable(),
  /** Последний сбой отправки — чтобы предложить повтор. */
  failed: PendingSchema.extend({ reason: z.string() }).nullable(),
});
export type VacancySession = z.infer<typeof SessionSchema>;

const EMPTY: VacancySession[] = [];
let cache: VacancySession[] | null = null;
const listeners = new Set<() => void>();

function read(): VacancySession[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? z.array(z.unknown()).parse(JSON.parse(raw)) : [];
    // Повреждённые записи пропускаем, остальные сохраняем.
    cache = parsed.flatMap((item) => {
      const session = SessionSchema.safeParse(item);
      return session.success ? [session.data] : [];
    });
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: VacancySession[]) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Хранилище недоступно (приватный режим) — работаем в памяти вкладки.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSessions(): VacancySession[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

const noop = () => () => {};

/** false на сервере и при первой отрисовке, true после загрузки данных браузера. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createSession(prompt: string): VacancySession {
  const now = Date.now();
  const session: VacancySession = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    status: "draft",
    draft: null,
    messages: [{ id: newId(), role: "employer", text: prompt, notices: [] }],
    skipped: [],
    engine: null,
    pending: { message: prompt, questionId: null },
    failed: null,
  };
  write([session, ...read()].slice(0, MAX_SESSIONS));
  return session;
}

export function getSession(id: string): VacancySession | undefined {
  return read().find((session) => session.id === id);
}

export function updateSession(id: string, change: (session: VacancySession) => VacancySession): void {
  write(read().map((session) => (session.id === id ? { ...change(session), updatedAt: Date.now() } : session)));
}

export function deleteSession(id: string): void {
  write(read().filter((session) => session.id !== id));
}

export function message(role: ChatMessage["role"], text: string, notices: ChatMessage["notices"] = []): ChatMessage {
  return { id: newId(), role, text, notices };
}

export type { QuestionId, VacancyDraft };
