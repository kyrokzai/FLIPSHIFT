"use client";

import Link from "next/link";
import { MIN_COMPARE, NO_DATA, buildComparison, sourceLabels, type CompareCell } from "@/domain/compare/compare";
import { candidateNames } from "@/components/hiring/candidate-card";
import { BackToHiring, DemoBadge, NotFound } from "@/components/challenge/shell";
import { compareIdsFor, toggleCompare } from "@/lib/compare-actions";
import { useHydrated, useSessions } from "@/lib/sessions";

function Cell({ cell, name, demo }: { cell: CompareCell; name: string; demo: boolean }) {
  return (
    <div className="min-w-0 rounded-field border border-line bg-surface p-3.5" data-testid="compare-cell">
      <p className="text-sm font-medium text-ink-soft">
        {name}
        {demo ? <DemoBadge /> : null}
      </p>
      <p className={`mt-1 break-words leading-relaxed ${cell.value === null ? "text-muted" : "text-ink"}`}>{cell.value ?? NO_DATA}</p>
      {cell.detail ? <p className="mt-1 break-words text-[0.9375rem] leading-relaxed text-muted">{cell.detail}</p> : null}
      {cell.excerpt ? <blockquote className="mt-2 break-words border-l-2 border-gold pl-3 text-[0.9375rem] leading-relaxed text-ink-soft">«{cell.excerpt}»</blockquote> : null}
      {cell.source ? <p className="mt-1.5 text-xs text-muted">Источник: {sourceLabels[cell.source]}</p> : null}
    </div>
  );
}

export function CompareView({ sessionId }: { sessionId: string }) {
  const hydrated = useHydrated();
  const session = useSessions().find((item) => item.id === sessionId);

  if (!hydrated) return <p className="mx-auto max-w-5xl px-5 py-12 text-muted">Открываю сравнение…</p>;
  if (!session?.draft) return <NotFound sessionId={sessionId} title="Вакансия не найдена" text="Сравнение доступно внутри подбора по вакансии." />;

  const mode = session.mode;
  const ids = compareIdsFor(session, mode);
  const candidates = ids.map((id) => session.candidates.find((c) => c.id === id)!).filter((c) => c.analysis);
  const names = candidateNames(session.candidates);
  const demo = mode === "demo";

  if (candidates.length < MIN_COMPARE) {
    return (
      <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-12">
        <BackToHiring sessionId={sessionId} />
        <h1 className="mt-2 text-[1.875rem] font-light tracking-[-0.02em] sm:text-4xl">Сравнение кандидатов</h1>
        <p className="mt-4 max-w-[56ch] leading-relaxed text-ink-soft">
          Нужно хотя бы {MIN_COMPARE} проанализированных кандидата{demo ? " в режиме DEMO" : " в режиме LIVE"}. Сейчас выбрано: {candidates.length}. Добавьте
          кандидатов кнопкой «Добавить к сравнению» в их карточках.
        </p>
        <Link href={`/vacancies/${sessionId}/hiring`} className="btn btn-primary mt-8">
          К кандидатам
        </Link>
      </div>
    );
  }

  const { fields, report } = buildComparison({ draft: session.draft, candidates, challenges: session.challenges, weights: session.challengeWeights, names });
  const columns = candidates.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  const list = (items: Array<{ candidateId: string; items: string[] }>, emptyText: string) => (
    <div className={`mt-3 grid gap-3 ${columns}`}>
      {items.map((entry) => (
        <div key={entry.candidateId} className="rounded-field border border-line bg-surface p-3.5">
          <p className="text-sm font-medium text-ink-soft">{names[entry.candidateId]}</p>
          {entry.items.length ? (
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 leading-relaxed">
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-muted">{emptyText}</p>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
      <BackToHiring sessionId={sessionId} />
      <h1 className="mt-2 text-[1.875rem] font-light leading-[1.1] tracking-[-0.02em] sm:text-4xl">Сравнение кандидатов</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">{session.draft.title}</p>
      {demo ? (
        <p className="mt-4 rounded-field border border-gold/40 bg-gold-wash px-4 py-3 leading-relaxed">Режим DEMO: все кандидаты и их ответы вымышлены.</p>
      ) : null}
      <p className="mt-4 max-w-[64ch] leading-relaxed text-muted">
        Платформа не выбирает победителя. Кандидаты показаны в порядке добавления. У каждого значения указан источник; если данных нет, так и
        написано.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {candidates.map((candidate) => (
          <button key={candidate.id} type="button" className="btn btn-quiet" onClick={() => toggleCompare(sessionId, candidate.id)}>
            Убрать: {names[candidate.id]}
          </button>
        ))}
      </div>

      <section aria-labelledby="compare-report" className="mt-8">
        <h2 id="compare-report" className="text-2xl font-normal tracking-[-0.01em]">
          Сравнительный отчёт
        </h2>
        <h3 className="mt-6 text-lg font-medium">Сильные стороны</h3>
        {list(report.strengths, "Подтверждённых сильных сторон нет.")}
        <h3 className="mt-6 text-lg font-medium">Отличия</h3>
        {report.differences.length ? (
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 leading-relaxed">
            {report.differences.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-muted">Существенных отличий по имеющимся данным нет.</p>
        )}
        <h3 className="mt-6 text-lg font-medium">Возможные профессиональные пробелы</h3>
        {list(report.gaps, "Пробелов по имеющимся данным не найдено.")}
        <h3 className="mt-6 text-lg font-medium">Что проверить дальше</h3>
        {list(report.questions, "Вопросов нет.")}
        <p className="mt-6 text-sm leading-relaxed text-muted">
          Отчёт собран из резюме и проверок навыков. Возраст, пол, семейное положение и другие личные признаки не учитываются. Решение
          принимаете вы.
        </p>
      </section>
      <section aria-labelledby="compare-fields" className="mt-12 border-t border-line pt-8">
        <h2 id="compare-fields" className="text-2xl font-normal tracking-[-0.01em]">
          Подробно по полям
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">Нажмите на поле, чтобы раскрыть значения всех кандидатов с источниками.</p>
        <div className="mt-4 divide-y divide-line border-y border-line">
          {fields.map((field, index) => {
            const unknown = field.cells.filter((cell) => cell.value === null).length;
            return (
              <details key={field.id} className="group py-1" open={index < 2} data-testid={`field-${field.id}`}>
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 [&::-webkit-details-marker]:hidden">
                  <span className="text-lg font-medium leading-snug">{field.label}</span>
                  <span className="shrink-0 text-sm text-muted">
                    {unknown ? `нет данных: ${unknown}` : "данные есть"}
                    <span aria-hidden className="ml-2 inline-block transition-transform group-open:rotate-180">⌄</span>
                  </span>
                </summary>
                <div className={`mb-3 mt-1 grid gap-3 ${columns}`}>
                  {field.cells.map((cell) => (
                    <Cell key={cell.candidateId} cell={cell} name={names[cell.candidateId] ?? "Кандидат"} demo={demo} />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
