"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { maxStepsFor } from "@/domain/challenge/engine";
import { MAX_STEPS, MIN_STEPS, difficulties, templateIds, type CustomSituation, type Difficulty, type TemplateId } from "@/domain/challenge/schema";
import { TEMPLATES, difficultyLabels, suggestTemplate } from "@/domain/challenge/templates";
import { serverHasLlm } from "@/lib/candidate-actions";
import { createChallenge } from "@/lib/challenge-actions";
import { newId, useHydrated, useSessions } from "@/lib/sessions";
import { candidateNames } from "@/components/hiring/candidate-card";
import { BackToHiring, DemoBadge, NotFound } from "./shell";

export function ChallengeSetupView({ sessionId, candidateId }: { sessionId: string; candidateId: string }) {
  const router = useRouter();
  const uid = useId();
  const hydrated = useHydrated();
  const session = useSessions().find((item) => item.id === sessionId);
  const candidate = session?.candidates.find((item) => item.id === candidateId);

  const [templateId, setTemplateId] = useState<TemplateId | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [steps, setSteps] = useState(5);
  const [custom, setCustom] = useState<CustomSituation[]>([]);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [llm, setLlm] = useState(false);
  const [useLlm, setUseLlm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void serverHasLlm().then((value) => {
      if (active) setLlm(value);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!hydrated) return <p className="mx-auto max-w-3xl px-5 py-12 text-muted">Открываю проверку…</p>;
  if (!session?.draft || !candidate) {
    return <NotFound sessionId={sessionId} title="Кандидат не найден" text="Проверка запускается из карточки кандидата в разделе подбора." />;
  }

  const chosen = templateId ?? suggestTemplate(session.draft.title);
  const template = TEMPLATES[chosen];
  const available = maxStepsFor(chosen, custom);
  const stepCount = Math.min(steps, Math.max(MIN_STEPS, available));
  const name = candidateNames(session.candidates)[candidate.id]!;
  const demo = candidate.mode === "demo";

  function addSituation() {
    if (draftTitle.trim().length < 2 || draftPrompt.trim().length < 10) {
      setError("У ситуации нужны название и текст не короче 10 символов.");
      return;
    }
    setCustom((current) => [...current, { id: newId().slice(0, 12), title: draftTitle.trim().slice(0, 80), prompt: draftPrompt.trim().slice(0, 1000) }].slice(0, MAX_STEPS));
    setDraftTitle("");
    setDraftPrompt("");
    setError(null);
  }

  function start() {
    const result = createChallenge(sessionId, candidateId, {
      templateId: chosen,
      difficulty,
      stepCount,
      engine: useLlm && llm && chosen !== "custom" ? "llm" : "scripted",
      customSituations: custom,
    });
    if ("error" in result) setError(result.error);
    else router.push(`/vacancies/${sessionId}/hiring/challenge/${result.id}`);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-12">
      <BackToHiring sessionId={sessionId} />
      <h1 className="mt-2 text-[1.875rem] font-light leading-[1.1] tracking-[-0.02em] sm:text-4xl">Проверка навыков</h1>
      <p className="mt-3 text-lg leading-relaxed text-ink-soft">
        {name}
        {demo ? <DemoBadge /> : null}
      </p>
      <p className="mt-4 max-w-[62ch] leading-relaxed text-muted">
        Кандидат решает рабочие ситуации письменно. Отчёт показывает, какие профессиональные навыки проявились в ответах, — с цитатами. Проверка
        не отклоняет кандидата и не принимает решений за вас.
      </p>

      <form
        aria-label="Настройка проверки"
        className="mt-8 flex flex-col gap-7 rounded-card border border-line bg-surface p-5 sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          start();
        }}
      >
        <div>
          <label className="label" htmlFor={`${uid}-template`}>Сценарий</label>
          <select id={`${uid}-template`} className="field" value={chosen} onChange={(e) => setTemplateId(e.target.value as TemplateId)}>
            {templateIds.map((item) => (
              <option key={item} value={item}>
                {TEMPLATES[item].title}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{template.intro}</p>
        </div>

        {chosen === "custom" ? (
          <fieldset>
            <legend className="text-lg font-medium">Ваши ситуации</legend>
            <p className="mt-1 text-[0.9375rem] text-muted">
              От {MIN_STEPS} до {MAX_STEPS}. Опишите ситуацию так, как её услышит кандидат.
            </p>
            {custom.length ? (
              <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5">
                {custom.map((item) => (
                  <li key={item.id} className="leading-relaxed">
                    <span className="font-medium">{item.title}</span> — {item.prompt}{" "}
                    <button type="button" className="btn-text text-sm" onClick={() => setCustom((c) => c.filter((x) => x.id !== item.id))}>
                      Убрать
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}
            {custom.length < MAX_STEPS ? (
              <div className="mt-3 grid gap-3">
                <div>
                  <label className="label" htmlFor={`${uid}-sit-title`}>Название ситуации</label>
                  <input id={`${uid}-sit-title`} className="field" value={draftTitle} maxLength={80} onChange={(e) => setDraftTitle(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor={`${uid}-sit-prompt`}>Текст ситуации</label>
                  <textarea id={`${uid}-sit-prompt`} className="field leading-relaxed" rows={3} maxLength={1000} value={draftPrompt} onChange={(e) => setDraftPrompt(e.target.value)} />
                </div>
                <button type="button" className="btn btn-quiet w-full sm:w-auto" onClick={addSituation}>
                  Добавить ситуацию
                </button>
              </div>
            ) : null}
          </fieldset>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor={`${uid}-difficulty`}>Сложность</label>
            <select id={`${uid}-difficulty`} className="field" value={difficulty} disabled={chosen === "custom"} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
              {difficulties.map((item) => (
                <option key={item} value={item}>
                  {difficultyLabels[item]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`${uid}-steps`}>Количество ситуаций</label>
            <select id={`${uid}-steps`} className="field" value={stepCount} onChange={(e) => setSteps(Number(e.target.value))}>
              {Array.from({ length: MAX_STEPS - MIN_STEPS + 1 }, (_, i) => MIN_STEPS + i)
                .filter((n) => n <= Math.max(MIN_STEPS, available))
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="text-lg font-medium">Собеседник</legend>
          <label className="mt-3 flex items-start gap-3 leading-relaxed">
            <input type="radio" name={`${uid}-engine`} className="mt-1.5 size-4 accent-ink" checked={!useLlm || !llm} onChange={() => setUseLlm(false)} />
            <span>
              <span className="font-medium">Сценарий по шаблону</span>
              <span className="block text-[0.9375rem] text-muted">Реплики собеседника написаны заранее и не подстраиваются под ответы. Это не ИИ-собеседник.</span>
            </span>
          </label>
          <label className={`mt-3 flex items-start gap-3 leading-relaxed ${llm && chosen !== "custom" ? "" : "opacity-50"}`}>
            <input type="radio" name={`${uid}-engine`} className="mt-1.5 size-4 accent-ink" disabled={!llm || chosen === "custom"} checked={useLlm && llm} onChange={() => setUseLlm(true)} />
            <span>
              <span className="font-medium">ИИ-собеседник</span>
              <span className="block text-[0.9375rem] text-muted">
                {llm ? "Реплики пишет языковая модель с учётом ответов. Ответы кандидата без контактов передаются на сервер и в модель." : "Языковая модель не подключена к этой установке."}
              </span>
            </span>
          </label>
        </fieldset>

        {error ? (
          <p role="alert" className="rounded-field border border-danger/30 bg-danger-wash px-4 py-3 leading-relaxed">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary w-full sm:w-auto">
          Продолжить
        </button>
      </form>
    </div>
  );
}
