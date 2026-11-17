"use client";

import { demoResumesFor } from "@/domain/candidate/demo";
import { vacancyKey } from "@/domain/candidate/match";
import {
  AnalyzeResponseSchema,
  ExtractResponseSchema,
  MAX_RESUME_CHARS,
  type Candidate,
  type CandidateSource,
  type Mode,
} from "@/domain/candidate/schema";
import { getSession, newId, updateSession } from "./sessions";

const inFlight = new Set<string>();

class RequestError extends Error {}

async function readError(response: Response, fallback: string): Promise<string> {
  const data: unknown = await response.json().catch(() => null);
  return data && typeof data === "object" && "error" in data ? String(data.error) : fallback;
}

function patchCandidate(sessionId: string, candidateId: string, change: (candidate: Candidate) => Candidate) {
  updateSession(sessionId, (session) => ({
    ...session,
    candidates: session.candidates.map((candidate) => (candidate.id === candidateId ? change(candidate) : candidate)),
  }));
}

/** Отправляет резюме Scout Agent и записывает результат в карточку кандидата. */
async function analyze(sessionId: string, candidateId: string): Promise<void> {
  const flightKey = `${sessionId}:${candidateId}`;
  if (inFlight.has(flightKey)) return;
  const session = getSession(sessionId);
  const candidate = session?.candidates.find((item) => item.id === candidateId);
  if (!session?.draft || !candidate) return;
  inFlight.add(flightKey);
  const draft = session.draft;

  try {
    const response = await fetch("/api/candidates/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vacancy: draft, resumeText: candidate.resumeText, name: candidate.facts?.name ?? null, mode: candidate.mode }),
    });
    if (!response.ok) throw new RequestError(await readError(response, "Сервер не смог проанализировать резюме."));
    const result = AnalyzeResponseSchema.parse(await response.json());
    patchCandidate(sessionId, candidateId, (current) => ({
      ...current,
      facts: result.facts,
      analysis: result.analysis,
      vacancyKey: vacancyKey(draft),
      error: null,
    }));
  } catch (error) {
    const reason = error instanceof RequestError ? error.message : "Нет связи с сервером. Проверьте интернет и повторите анализ.";
    patchCandidate(sessionId, candidateId, (current) => ({ ...current, error: reason }));
  } finally {
    inFlight.delete(flightKey);
  }
}

/** Запускает анализ для всех резюме выбранного режима, у которых ещё нет оценки. */
export function analyzePending(sessionId: string, mode: Mode): void {
  const session = getSession(sessionId);
  for (const candidate of session?.candidates ?? []) {
    if (candidate.mode === mode && !candidate.analysis && !candidate.error) void analyze(sessionId, candidate.id);
  }
}

/** Повторный анализ: после ошибки или после изменения условий вакансии. */
export function reanalyze(sessionId: string, mode: Mode, onlyId?: string): void {
  updateSession(sessionId, (session) => ({
    ...session,
    candidates: session.candidates.map((candidate) =>
      candidate.mode === mode && (!onlyId || candidate.id === onlyId) ? { ...candidate, analysis: null, error: null, vacancyKey: null } : candidate,
    ),
  }));
  analyzePending(sessionId, mode);
}

function addCandidate(sessionId: string, mode: Mode, source: CandidateSource, resumeText: string, name: string | null): string {
  const id = newId();
  const candidate: Candidate = {
    id,
    mode,
    addedAt: Date.now(),
    source,
    resumeText: resumeText.slice(0, MAX_RESUME_CHARS),
    facts: name
      ? { name, headline: null, city: null, relocation: false, experienceYears: null, positions: [], skills: [], salaryExpectation: null }
      : null,
    analysis: null,
    vacancyKey: null,
    error: null,
  };
  updateSession(sessionId, (session) => ({ ...session, candidates: [...session.candidates, candidate] }));
  return id;
}

export interface ResumeInput {
  text: string;
  file: File | null;
  name: string;
  sourceLabel: string;
  url: string;
}

/** Ручное добавление резюме в LIVE: файл или текст. Возвращает текст ошибки или null. */
export async function addResume(sessionId: string, input: ResumeInput): Promise<string | null> {
  let text = input.text.trim();
  let kind: CandidateSource["kind"] = "text";
  let fileName: string | null = null;

  let url: string | null = null;
  if (input.url.trim()) {
    try {
      const parsed = new URL(input.url.trim());
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("protocol");
      url = parsed.toString().slice(0, 600);
    } catch {
      return "Ссылка на профиль должна начинаться с https://. Исправьте её или оставьте поле пустым.";
    }
  }

  if (input.file) {
    const form = new FormData();
    form.set("file", input.file);
    try {
      const response = await fetch("/api/resumes/extract", { method: "POST", body: form });
      if (!response.ok) return await readError(response, "Не удалось прочитать файл. Вставьте текст резюме вручную.");
      text = ExtractResponseSchema.parse(await response.json()).text;
      kind = "file";
      fileName = input.file.name.slice(0, 200);
    } catch {
      return "Нет связи с сервером. Проверьте интернет и повторите загрузку.";
    }
  }

  if (text.length < 40) return "В резюме слишком мало текста для анализа. Добавьте описание опыта.";

  const id = addCandidate(
    sessionId,
    "live",
    { kind, label: input.sourceLabel.trim().slice(0, 80) || "Добавлено вручную", url, fileName },
    text,
    input.name.trim().slice(0, 120) || null,
  );
  void analyze(sessionId, id);
  return null;
}

/** DEMO: загружает вымышленных кандидатов под текущую вакансию. */
export function loadDemoCandidates(sessionId: string): void {
  const session = getSession(sessionId);
  if (!session?.draft) return;
  updateSession(sessionId, (current) => ({ ...current, candidates: current.candidates.filter((candidate) => candidate.mode !== "demo") }));
  for (const resume of demoResumesFor(session.draft)) {
    addCandidate(sessionId, "demo", { kind: "demo", label: "Демонстрационные данные", url: null, fileName: null }, resume.resumeText, resume.name);
  }
  analyzePending(sessionId, "demo");
}

export function removeCandidate(sessionId: string, candidateId: string): void {
  updateSession(sessionId, (session) => ({ ...session, candidates: session.candidates.filter((candidate) => candidate.id !== candidateId) }));
}

export function setMode(sessionId: string, mode: Mode): void {
  updateSession(sessionId, (session) => ({ ...session, mode }));
}
