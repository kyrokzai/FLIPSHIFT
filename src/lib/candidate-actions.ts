"use client";

import { demoResumesFor } from "@/domain/candidate/demo";
import { analyzeResume, vacancyKey } from "@/domain/candidate/match";
import {
  AnalyzeResponseSchema,
  ExtractResponseSchema,
  MAX_RESUME_CHARS,
  type Candidate,
  type CandidateSource,
  type Mode,
} from "@/domain/candidate/schema";
import { NoTextError, extractInBrowser } from "./resume-file-client";
import { recordEvent } from "./activity";
import { getSession, newId, updateSession } from "./sessions";

const inFlight = new Set<string>();

let llmEnabled: Promise<boolean> | null = null;

/** Подключена ли на сервере языковая модель. При сбое запроса считаем, что нет: анализ пройдёт в браузере. */
export function serverHasLlm(): Promise<boolean> {
  llmEnabled ??= fetch("/api/config")
    .then((response) => (response.ok ? response.json() : { llm: false }))
    .then((data: unknown) => !!(data && typeof data === "object" && "llm" in data && data.llm))
    .catch(() => false);
  return llmEnabled;
}

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
    // Без языковой модели резюме анализируется в браузере и не покидает устройство.
    // DEMO всегда считается локально: синтетические резюме модель не тратят.
    let result;
    if (candidate.mode === "demo" || !(await serverHasLlm())) {
      result = analyzeResume(draft, candidate.resumeText, { name: candidate.facts?.name ?? null });
    } else {
      const response = await fetch("/api/candidates/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vacancy: draft, resumeText: candidate.resumeText, name: candidate.facts?.name ?? null, mode: candidate.mode }),
      });
      if (!response.ok) throw new RequestError(await readError(response, "Сервер не смог проанализировать резюме."));
      result = AnalyzeResponseSchema.parse(await response.json());
    }
    patchCandidate(sessionId, candidateId, (current) => ({
      ...current,
      facts: result.facts,
      analysis: result.analysis,
      vacancyKey: vacancyKey(draft),
      error: null,
    }));
    recordEvent({
      vacancyId: sessionId,
      key: `resume_analyzed:${candidateId}:${vacancyKey(draft)}:${Date.now()}`,
      type: "resume_analyzed",
      actor: "agent",
      candidateId,
      mode: candidate.mode,
      source: candidate.source.label,
      result: `Соответствие вакансии: ${result.analysis.verdict === "insufficient" ? "мало данных" : `${result.analysis.score}%`}. Критериев проверено: ${result.analysis.criteria.length}. ${result.analysis.engine === "llm" ? "С языковой моделью" : "Встроенный разбор, в браузере"}.`,
    });
  } catch (error) {
    const reason = error instanceof RequestError ? error.message : "Нет связи с сервером. Проверьте интернет и повторите анализ.";
    patchCandidate(sessionId, candidateId, (current) => ({ ...current, error: reason }));
    recordEvent({
      vacancyId: sessionId,
      key: `resume_analysis_failed:${candidateId}:${Date.now()}`,
      type: "resume_analysis_failed",
      actor: "agent",
      candidateId,
      mode: candidate.mode,
      status: "error",
      errorCode: error instanceof RequestError ? "server_rejected" : "network",
      result: reason,
    });
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
    try {
      const local = await extractInBrowser(input.file);
      if (local !== null) {
        text = local;
      } else {
        // Браузер не смог разобрать файл — сервер извлекает текст в памяти и ничего не сохраняет.
        const form = new FormData();
        form.set("file", input.file);
        const response = await fetch("/api/resumes/extract", { method: "POST", body: form });
        if (!response.ok) {
          const reason = await readError(response, "Не удалось прочитать файл. Вставьте текст резюме вручную.");
          importFailed(sessionId, `http_${response.status}`, reason);
          return reason;
        }
        text = ExtractResponseSchema.parse(await response.json()).text;
      }
      kind = "file";
      fileName = input.file.name.slice(0, 200);
    } catch (error) {
      if (error instanceof NoTextError) {
        importFailed(sessionId, "no_text", error.message);
        return error.message;
      }
      importFailed(sessionId, "network", "Нет связи с сервером при чтении файла.");
      return "Нет связи с сервером. Проверьте интернет и повторите загрузку.";
    }
  }

  if (text.length < 40) {
    importFailed(sessionId, "too_short", "В резюме слишком мало текста для анализа.");
    return "В резюме слишком мало текста для анализа. Добавьте описание опыта.";
  }

  const id = addCandidate(
    sessionId,
    "live",
    { kind, label: input.sourceLabel.trim().slice(0, 80) || "Добавлено вручную", url, fileName },
    text,
    input.name.trim().slice(0, 120) || null,
  );
  recordEvent({
    vacancyId: sessionId,
    key: `resume_imported:${id}`,
    type: "resume_imported",
    actor: "employer",
    candidateId: id,
    mode: "live",
    source: input.sourceLabel.trim().slice(0, 80) || "Добавлено вручную",
    result: kind === "file" ? `Резюме загружено из файла ${(fileName ?? "").split(".").pop()?.toUpperCase() ?? ""} и прочитано в браузере.` : "Резюме добавлено текстом.",
  });
  void analyze(sessionId, id);
  return null;
}

function importFailed(sessionId: string, code: string, reason: string) {
  recordEvent({ vacancyId: sessionId, key: `resume_import_failed:${Date.now()}`, type: "resume_import_failed", actor: "system", mode: "live", status: "error", errorCode: code, result: reason });
}

/** DEMO: загружает вымышленных кандидатов под текущую вакансию. */
export function loadDemoCandidates(sessionId: string): void {
  const session = getSession(sessionId);
  if (!session?.draft) return;
  const demoIds = new Set(session.candidates.filter((candidate) => candidate.mode === "demo").map((candidate) => candidate.id));
  updateSession(sessionId, (current) => ({
    ...current,
    candidates: current.candidates.filter((candidate) => candidate.mode !== "demo"),
    challenges: current.challenges.filter((item) => !demoIds.has(item.candidateId)),
    compare: current.compare.filter((id) => !demoIds.has(id)),
  }));
  for (const resume of demoResumesFor(session.draft)) {
    addCandidate(sessionId, "demo", { kind: "demo", label: "Демонстрационные данные", url: null, fileName: null }, resume.resumeText, resume.name);
  }
  recordEvent({
    vacancyId: sessionId,
    key: `demo_loaded:${Date.now()}`,
    type: "demo_loaded",
    actor: "employer",
    mode: "demo",
    source: "Демонстрационные данные",
    result: `Загружено вымышленных кандидатов: ${demoResumesFor(session.draft).length}. Это не результат поиска.`,
  });
  // Сначала факт загрузки, затем анализ — в журнале события идут в реальном порядке.
  analyzePending(sessionId, "demo");
}

export function removeCandidate(sessionId: string, candidateId: string): void {
  const candidate = getSession(sessionId)?.candidates.find((item) => item.id === candidateId);
  updateSession(sessionId, (session) => ({
    ...session,
    candidates: session.candidates.filter((item) => item.id !== candidateId),
    // Вместе с резюме удаляются проверки навыков и место в сравнении.
    challenges: session.challenges.filter((item) => item.candidateId !== candidateId),
    compare: session.compare.filter((id) => id !== candidateId),
  }));
  if (candidate) {
    recordEvent({ vacancyId: sessionId, key: `candidate_removed:${candidateId}`, type: "candidate_removed", actor: "employer", candidateId, mode: candidate.mode, result: "Резюме, проверки навыков и место в сравнении удалены." });
  }
}

export function setMode(sessionId: string, mode: Mode): void {
  updateSession(sessionId, (session) => ({ ...session, mode }));
}
