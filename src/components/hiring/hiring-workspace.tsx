"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { rankCandidates, vacancyKey } from "@/domain/candidate/match";
import { MAX_COMPARE, MIN_COMPARE } from "@/domain/compare/compare";
import type { Mode } from "@/domain/candidate/schema";
import { buildVacancyQuestions } from "@/domain/interview/questions";
import { buildSearchPlan } from "@/domain/sourcing/queries";
import { analyzePending, loadDemoCandidates, reanalyze, removeCandidate, setMode } from "@/lib/candidate-actions";
import { recordEvent } from "@/lib/activity";
import { compareIdsFor, toggleCompare } from "@/lib/compare-actions";
import { computeSteps, type HiringStep } from "@/lib/hiring-steps";
import { useHydrated, useSessions } from "@/lib/sessions";
import { AddResumeForm } from "./add-resume-form";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { CandidateCard, candidateNames } from "./candidate-card";
import { CopyButton } from "./copy-button";
import { QueriesSection } from "./queries-section";
import { ShortlistSection } from "./shortlist-section";
import { SourcesSection } from "./sources-section";
import { StatusBadge } from "./status-badge";

const MODES: Array<{ id: Mode; label: string; text: string }> = [
  { id: "live", label: "LIVE", text: "Только реальные данные: резюме, которые добавили вы, и подключённые источники." },
  { id: "demo", label: "DEMO", text: "Вымышленные кандидаты. Режим показывает, как работает подбор, и не содержит реальных людей." },
];

type Tab = "steps" | "search" | "candidates" | "shortlist" | "interview" | "journal";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "steps", label: "Ход подбора" },
  { id: "search", label: "Поиск" },
  { id: "candidates", label: "Кандидаты" },
  { id: "shortlist", label: "Шорт-лист" },
  { id: "interview", label: "Интервью" },
  { id: "journal", label: "Журнал" },
];

const STEP_TAB: Record<HiringStep["id"], Tab> = {
  vacancy: "steps",
  queries: "search",
  sources: "search",
  resumes: "candidates",
  analysis: "candidates",
  shortlist: "shortlist",
  interview: "interview",
};

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-normal tracking-[-0.01em]">{children}</h2>;
}

export function HiringWorkspace({ id }: { id: string }) {
  const hydrated = useHydrated();
  const sessions = useSessions();
  const session = sessions.find((item) => item.id === id);
  const draft = session?.draft ?? null;
  const mode = session?.mode ?? "live";
  const [tab, setTab] = useState<Tab>("steps");
  const waiting = session?.candidates.filter((c) => c.mode === mode && !c.analysis && !c.error).length ?? 0;

  // После перезагрузки страницы незавершённый анализ продолжается.
  useEffect(() => {
    if (waiting > 0) analyzePending(id, mode);
  }, [id, mode, waiting]);

  const plan = draft ? buildSearchPlan(draft) : null;
  const questions = draft ? buildVacancyQuestions(draft) : [];
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Журнал: запросы сформированы (один раз на версию вакансии) и честная отметка, что автоматического поиска не было.
  const queryCount = plan?.queries.length ?? 0;
  const draftKey = draft ? vacancyKey(draft) : null;
  useEffect(() => {
    if (!draftKey || queryCount === 0) return;
    recordEvent({ vacancyId: id, key: `queries:${draftKey}`, type: "queries_generated", actor: "agent", mode: "live", result: `Составлено поисковых запросов: ${queryCount}. Поиск по ним выполняет работодатель на площадках.` });
  }, [id, draftKey, queryCount]);
  useEffect(() => {
    if (!hydrated || mode !== "live" || !draftKey) return;
    recordEvent({
      vacancyId: id,
      key: "source_unavailable",
      type: "source_unavailable",
      actor: "system",
      mode: "live",
      status: "needs_permission",
      source: "hh.kz, Enbek.kz",
      errorCode: "employer_access_required",
      result: "Автоматический поиск резюме не выполнялся: площадкам нужен доступ работодателя (аккаунт или API). Кандидаты не получены.",
    });
  }, [id, hydrated, mode, draftKey]);

  // Журнал: шорт-лист записывается, когда анализ завершён и состав изменился.
  const modeCandidates = session?.candidates.filter((candidate) => candidate.mode === mode) ?? [];
  const settled = modeCandidates.length > 0 && modeCandidates.every((candidate) => candidate.analysis || candidate.error);
  const shortlistIds = settled ? rankCandidates(modeCandidates).shortlist.map((candidate) => candidate.id).join(",") : null;
  const analysedCount = modeCandidates.filter((candidate) => candidate.analysis).length;
  useEffect(() => {
    if (shortlistIds === null || analysedCount === 0) return;
    const size = shortlistIds ? shortlistIds.split(",").length : 0;
    recordEvent({
      vacancyId: id,
      key: `shortlist:${mode}:${shortlistIds}`,
      type: "shortlist_updated",
      actor: "agent",
      mode,
      result: `В шорт-листе ${size} из ${analysedCount} проанализированных. Порог — рекомендация, решение за работодателем.`,
    });
  }, [id, mode, shortlistIds, analysedCount]);

  if (!hydrated) {
    return (
      <section className="mx-auto w-full max-w-4xl px-5 py-12">
        <p className="text-muted">Открываю подбор…</p>
      </section>
    );
  }

  if (!session || !draft || !plan) {
    return (
      <section className="mx-auto w-full max-w-3xl px-5 py-16">
        <h1 className="text-3xl font-light tracking-[-0.02em] sm:text-4xl">Сначала нужна вакансия</h1>
        <p className="mt-4 max-w-[52ch] leading-relaxed text-ink-soft">
          Подбор строится от условий вакансии. На этом устройстве такой вакансии нет — опишите, кого вы ищете.
        </p>
        <Link href="/" className="btn btn-primary mt-8">
          Описать вакансию
        </Link>
      </section>
    );
  }

  const confirmed = session.status === "confirmed";
  const candidates = session.candidates.filter((candidate) => candidate.mode === mode);
  const key = vacancyKey(draft);
  const stale = candidates.filter((candidate) => candidate.analysis && candidate.vacancyKey !== key);
  const steps = computeSteps({ draft, confirmed, mode, candidates: session.candidates, plan });
  const demo = mode === "demo";
  const compareIds = compareIdsFor(session, mode);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-5 py-8 sm:py-12">
      <header>
        <Link href={`/vacancies/${id}`} className="inline-flex min-h-11 items-center text-[0.9375rem] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink">
          К условиям вакансии
        </Link>
        <h1 className="mt-2 text-[1.875rem] font-light leading-[1.1] tracking-[-0.02em] sm:text-5xl">Подбор: {draft.title ?? "вакансия без названия"}</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">{[draft.city, draft.business].filter(Boolean).join(", ")}</p>

        <div className="mt-6" role="radiogroup" aria-label="Режим подбора">
          <div className="inline-flex rounded-field border border-line-strong bg-surface p-1">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={mode === item.id}
                className={`min-h-11 rounded-[0.4rem] px-5 text-[0.9375rem] font-medium transition-colors ${mode === item.id ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}
                onClick={() => setMode(id, item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className={`mt-3 max-w-[60ch] leading-relaxed ${demo ? "rounded-field border border-gold/40 bg-gold-wash px-4 py-3 text-ink" : "text-muted"}`} data-testid="mode-note">
            {MODES.find((item) => item.id === mode)!.text}
          </p>
        </div>
      </header>

      <div>
        <div role="tablist" aria-label="Разделы подбора" className="-mx-5 flex gap-1 overflow-x-auto border-b border-line px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((item) => {
            const count = item.id === "candidates" ? candidates.length : 0;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`panel-${item.id}`}
                className={`-mb-px min-h-12 shrink-0 whitespace-nowrap border-b-2 px-3 text-[0.9375rem] font-medium transition-colors ${tab === item.id ? "border-gold text-ink" : "border-transparent text-muted hover:text-ink"}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
                {count > 0 ? <span className="ml-1.5 text-muted">{count}</span> : null}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-7">
          {tab === "steps" ? (
            <>
              <Heading>Ход подбора</Heading>
              <ol className="mt-4 divide-y divide-line border-y border-line">
                {steps.map((step, index) => (
                  <li key={step.id} data-testid={`step-${step.id}`}>
                    <button type="button" className="block w-full py-3.5 text-left" onClick={() => setTab(STEP_TAB[step.id])}>
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-medium leading-snug">
                          <span className="mr-2 text-gold-deep">{index + 1}</span>
                          {step.title}
                        </span>
                        <StatusBadge status={step.status} />
                      </span>
                      <span className="mt-1 block text-[0.9375rem] leading-relaxed text-muted">{step.detail}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </>
          ) : null}

          {tab === "search" ? (
            <div className="flex flex-col gap-10">
              <section aria-labelledby="queries-title">
                <h2 id="queries-title" className="text-2xl font-normal tracking-[-0.01em]">
                  Поисковые запросы
                </h2>
                <p className="mt-2 max-w-[62ch] leading-relaxed text-muted">
                  Агент составил запросы по условиям вакансии. Откройте поиск на площадке под своей учётной записью, а найденные резюме
                  добавьте во вкладке «Кандидаты» — агент их проанализирует.
                </p>
                <QueriesSection sessionId={id} plan={plan} draft={draft} />
              </section>
              <section aria-labelledby="sources-title">
                <h2 id="sources-title" className="text-2xl font-normal tracking-[-0.01em]">
                  Источники кандидатов
                </h2>
                <p className="mt-2 max-w-[62ch] leading-relaxed text-muted">
                  Что можно делать с каждым источником законно и что для этого нужно. Платформа не собирает страницы площадок
                  автоматически и не обходит их ограничения.
                </p>
                <SourcesSection />
              </section>
            </div>
          ) : null}

          {tab === "candidates" ? (
            <>
              <Heading>{demo ? "Кандидаты, демонстрационные" : "Кандидаты"}</Heading>
              <div className="mt-5 flex flex-col gap-5">
                {demo ? (
                  <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
                    <p className="leading-relaxed text-ink-soft">
                      Демонстрационный набор — вымышленные резюме под эту вакансию. Они проходят тот же анализ, что и настоящие.
                    </p>
                    <button type="button" className="btn btn-primary mt-4 w-full sm:w-auto" onClick={() => loadDemoCandidates(id)}>
                      {candidates.length ? "Загрузить набор заново" : "Загрузить демонстрационных кандидатов"}
                    </button>
                  </div>
                ) : (
                  <AddResumeForm sessionId={id} />
                )}

                {compareIds.length > 0 ? (
                  <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-card border border-line-strong bg-surface p-4 shadow-lift sm:flex-row sm:items-center sm:justify-between" data-testid="compare-bar">
                    <p className="leading-relaxed">
                      В сравнении: {compareIds.length} из {MAX_COMPARE}
                      {compareIds.length < MIN_COMPARE ? ". Добавьте ещё одного кандидата." : "."}
                    </p>
                    {compareIds.length >= MIN_COMPARE ? (
                      <Link href={`/vacancies/${id}/hiring/compare`} className="btn btn-primary">
                        Сравнить кандидатов
                      </Link>
                    ) : null}
                  </div>
                ) : null}
                {compareError ? (
                  <p role="alert" className="text-[0.9375rem] text-danger">
                    {compareError}
                  </p>
                ) : null}

                {stale.length > 0 ? (
                  <div className="rounded-field border border-gold/40 bg-gold-wash px-4 py-3.5">
                    <p className="leading-relaxed">Условия вакансии изменились после анализа. Оценки нужно пересчитать.</p>
                    <button type="button" className="btn btn-quiet mt-3" onClick={() => reanalyze(id, mode)}>
                      Пересчитать оценки
                    </button>
                  </div>
                ) : null}

                {candidates.length > 0 ? (
                  <ul className="flex flex-col gap-4" aria-label="Кандидаты">
                    {candidates.map((candidate, index) => (
                      <CandidateCard
                        key={candidate.id}
                        sessionId={id}
                        vacancyTitle={draft.title}
                        candidate={candidate}
                        index={index}
                        stale={stale.includes(candidate)}
                        challenges={session.challenges.filter((item) => item.candidateId === candidate.id)}
                        weights={session.challengeWeights}
                        inCompare={compareIds.includes(candidate.id)}
                        compareFull={compareIds.length >= MAX_COMPARE}
                        onToggleCompare={() => setCompareError(toggleCompare(id, candidate.id))}
                        onShowHistory={() => {
                          setHistoryFor(candidate.id);
                          setTab("journal");
                        }}
                        onRemove={() => removeCandidate(id, candidate.id)}
                        onRetry={() => reanalyze(id, mode, candidate.id)}
                      />
                    ))}
                  </ul>
                ) : !demo ? (
                  <p className="leading-relaxed text-muted">
                    Пока нет ни одного резюме. В LIVE здесь появляются только те кандидаты, которых добавили вы.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {tab === "shortlist" ? (
            <>
              <Heading>{demo ? "Шорт-лист, демонстрационный" : "Шорт-лист"}</Heading>
              <ShortlistSection candidates={candidates} />
            </>
          ) : null}

          {tab === "journal" ? (
            <>
              <Heading>Журнал действий</Heading>
              <div className="mt-4">
                <ActivityFeed
                  events={session.events.filter((event) => event.mode === mode)}
                  candidateNames={candidateNames(session.candidates)}
                  fixedMode={mode}
                  candidateFilter={historyFor}
                  onClearCandidate={() => setHistoryFor(null)}
                />
              </div>
            </>
          ) : null}

          {tab === "interview" ? (
            <>
              <Heading>Вопросы для предварительного интервью</Heading>
              <p className="mt-2 max-w-[62ch] leading-relaxed text-muted">
                Общие вопросы по вакансии. Личные вопросы по пробелам в резюме — в карточке каждого кандидата. Автоматическое
                ИИ-интервью пока не подключено: вопросы задаёт работодатель.
              </p>
              <ol className="mt-4 flex list-decimal flex-col gap-2.5 pl-5 leading-relaxed marker:text-gold-deep" aria-label="Общие вопросы">
                {questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ol>
              <div className="mt-5">
                <CopyButton text={questions.map((question, index) => `${index + 1}. ${question}`).join("\n")} label="Скопировать вопросы" />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
