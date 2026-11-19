"use client";

import { useEffect, useId, useRef, useState } from "react";
import { demoAnswer, demoTier } from "@/domain/challenge/demo-answers";
import { CONSENT_VERSION, plannedSituations } from "@/domain/challenge/engine";
import type { AnswerAuthor } from "@/domain/challenge/schema";
import { TEMPLATES, difficultyLabels } from "@/domain/challenge/templates";
import { discardChallenge, startChallenge, stopChallenge, submitAnswer } from "@/lib/challenge-actions";
import { useHydrated, useSessions } from "@/lib/sessions";
import { useAutoGrow } from "@/lib/use-auto-grow";
import { candidateNames } from "@/components/hiring/candidate-card";
import { ChallengeReportView } from "./challenge-report";
import { BackToHiring, DemoBadge, NotFound } from "./shell";

const AUTHOR_LABEL: Record<AnswerAuthor, string> = {
  candidate: "Кандидат вводит ответы сам на этом устройстве",
  employer_transcribed: "Работодатель вносит ответы кандидата с его слов или из переписки",
  demo: "Вымышленные ответы",
};

export function ChallengeRunner({ sessionId, challengeId }: { sessionId: string; challengeId: string }) {
  const uid = useId();
  const hydrated = useHydrated();
  const session = useSessions().find((item) => item.id === sessionId);
  const challenge = session?.challenges.find((item) => item.id === challengeId);
  const candidate = session?.candidates.find((item) => item.id === challenge?.candidateId);

  const [agreed, setAgreed] = useState(false);
  const [author, setAuthor] = useState<AnswerAuthor>("candidate");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(inputRef, text);

  const pendingIndex = challenge?.turns.findIndex((turn) => turn.answer === null) ?? -1;
  useEffect(() => {
    if (pendingIndex >= 0) inputRef.current?.focus({ preventScroll: true });
  }, [pendingIndex]);

  if (!hydrated) return <p className="mx-auto max-w-3xl px-5 py-12 text-muted">Открываю проверку…</p>;
  if (!session || !challenge || !candidate) {
    return <NotFound sessionId={sessionId} title="Проверка не найдена" text="Проверки хранятся в браузере, где они созданы. Запустите новую из карточки кандидата." />;
  }

  const template = TEMPLATES[challenge.templateId];
  const demo = challenge.mode === "demo";
  const planned = plannedSituations(challenge);
  const answered = challenge.turns.filter((turn) => turn.answer !== null).length;
  const pending = pendingIndex >= 0 ? challenge.turns[pendingIndex]! : null;
  const name = candidateNames(session.candidates)[candidate.id]!;

  async function send() {
    if (!challenge || busy) return;
    setBusy(true);
    setError(null);
    const problem = await submitAnswer(sessionId, challenge.id, text);
    setBusy(false);
    if (problem) setError(problem);
    else setText("");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-12">
      <BackToHiring sessionId={sessionId} />
      <h1 className="mt-2 text-[1.875rem] font-light leading-[1.1] tracking-[-0.02em] sm:text-4xl">Проверка навыков</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-soft">
        {name}
        {demo ? <DemoBadge /> : null}
      </p>
      <p className="mt-1 text-[0.9375rem] text-muted">
        {template.title}. {challenge.templateId === "custom" ? "" : `${difficultyLabels[challenge.difficulty]}. `}Ситуаций: {challenge.stepCount}.
      </p>

      {challenge.status === "setup" ? (
        <section aria-label="Согласие кандидата" className="mt-8 rounded-card border border-line bg-surface p-5 sm:p-7">
          {demo ? (
            <>
              <h2 className="text-xl font-medium">Демонстрация</h2>
              <p className="mt-2 leading-relaxed text-ink-soft">
                Кандидат вымышлен, согласие не требуется. Ответы подставляются из демонстрационного набора — их можно изменить перед отправкой.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-medium">Перед началом — для кандидата</h2>
              <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 leading-relaxed text-ink-soft">
                <li>Вы ответите письменно на {challenge.stepCount} рабочих ситуаций. Можно остановиться в любой момент.</li>
                <li>
                  {challenge.engine === "llm"
                    ? "Реплики собеседника пишет языковая модель. Ваши ответы без контактов передаются на сервер платформы и в модель."
                    : "Реплики собеседника заданы заранее и не зависят от ваших ответов. Это не ИИ-собеседник."}
                </li>
                <li>Ответы и отчёт увидит работодатель. Они хранятся только в браузере этого устройства.</li>
                <li>Оцениваются только профессиональные действия в ответах. Проверка не принимает решение о найме.</li>
              </ul>
              <fieldset className="mt-5">
                <legend className="font-medium">Кто вводит ответы</legend>
                {(["candidate", "employer_transcribed"] as const).map((value) => (
                  <label key={value} className="mt-2 flex items-start gap-3 leading-relaxed">
                    <input type="radio" name={`${uid}-author`} className="mt-1.5 size-4 accent-ink" checked={author === value} onChange={() => setAuthor(value)} />
                    <span>{AUTHOR_LABEL[value]}</span>
                  </label>
                ))}
              </fieldset>
              <label className="mt-5 flex items-start gap-3 leading-relaxed">
                <input type="checkbox" className="mt-1.5 size-4 accent-ink" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                <span>Кандидат согласен пройти проверку и на обработку ответов работодателем для этой вакансии.</span>
              </label>
              <p className="mt-2 text-sm text-muted">Версия текста согласия: {CONSENT_VERSION}.</p>
            </>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || (!demo && !agreed)}
              onClick={async () => {
                setBusy(true);
                await startChallenge(sessionId, challenge.id, author);
                setBusy(false);
              }}
            >
              Начать проверку
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => discardChallenge(sessionId, challenge.id)}>
              Отменить
            </button>
          </div>
        </section>
      ) : null}

      {challenge.status !== "setup" ? (
        <section aria-label="Диалог проверки" className="mt-8">
          <div className="flex items-center justify-between gap-3 text-sm text-muted">
            <span>
              {challenge.status === "in_progress" ? `Ситуация ${Math.min(answered + 1, challenge.stepCount)} из ${challenge.stepCount}` : `Отвечено ${answered} из ${challenge.stepCount}`}
            </span>
            <span>{challenge.consent ? AUTHOR_LABEL[challenge.consent.author] : null}</span>
          </div>
          <div aria-hidden className="mt-2 h-1 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-gold transition-[width] duration-300" style={{ width: `${(answered / challenge.stepCount) * 100}%` }} />
          </div>

          <ol className="mt-6 flex flex-col gap-5" aria-label="Реплики">
            {challenge.turns.map((turn, index) => (
              <li key={`${turn.situationId}-${index}`} className="flex flex-col gap-3">
                <div className="border-l-2 border-gold pl-4">
                  <p className="text-sm text-muted">
                    {template.counterpart} · {planned[index]?.title ?? "Ситуация"} ·{" "}
                    {turn.promptSource === "llm" ? "реплика языковой модели" : "реплика по сценарию"}
                  </p>
                  <p className="mt-1 leading-relaxed">{turn.prompt}</p>
                </div>
                {turn.answer !== null ? (
                  <p className="ml-auto max-w-[92%] whitespace-pre-line rounded-2xl rounded-br-md border border-line bg-surface px-4 py-3 leading-relaxed" data-testid="answer">
                    <span className="sr-only">Ответ кандидата: </span>
                    {turn.answer}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>

          {challenge.status === "in_progress" && pending ? (
            <form
              className="mt-6 flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <label htmlFor={`${uid}-answer`} className="label">
                {challenge.consent?.author === "employer_transcribed" ? "Ответ кандидата (вносит работодатель)" : "Ответ кандидата"}
              </label>
              <textarea
                ref={inputRef}
                id={`${uid}-answer`}
                className="field max-h-72 resize-none leading-relaxed"
                rows={3}
                maxLength={2000}
                value={text}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
              />
              {demo ? (
                <button
                  type="button"
                  className="btn-text self-start text-[0.9375rem]"
                  onClick={() => setText(demoAnswer(challenge.templateId, pending.situationId, pendingIndex + 1, demoTier(candidate)))}
                >
                  Подставить вымышленный ответ
                </button>
              ) : null}
              {error ? (
                <p role="alert" className="text-[0.9375rem] text-danger">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button type="submit" className="btn btn-primary" disabled={busy || text.trim().length < 2}>
                  {busy ? "Сохраняю…" : "Отправить ответ"}
                </button>
                {confirmStop ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <button type="button" className="btn btn-quiet" onClick={() => stopChallenge(sessionId, challenge.id)}>
                      Завершить и получить отчёт
                    </button>
                    <button type="button" className="btn-text text-sm" onClick={() => setConfirmStop(false)}>
                      Продолжить
                    </button>
                  </span>
                ) : (
                  <button type="button" className="btn btn-quiet" onClick={() => setConfirmStop(true)}>
                    Закончить досрочно
                  </button>
                )}
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      {challenge.report ? (
        <div className="mt-10">
          <ChallengeReportView sessionId={sessionId} challenge={challenge} weights={session.challengeWeights} />
        </div>
      ) : null}
    </div>
  );
}
