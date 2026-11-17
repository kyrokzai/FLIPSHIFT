"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useId, useMemo, useRef, useState } from "react";
import { describePatch } from "@/domain/vacancy/format";
import { parseEmployerMessage } from "@/domain/vacancy/parse";
import { createSession } from "@/lib/sessions";
import { useAutoGrow } from "@/lib/use-auto-grow";

const EXAMPLES = [
  {
    label: "Два бариста в кофейню",
    text: "Мне нужны два бариста в Астане, зарплата 300 000 тенге, график 5/2. Опыт необязателен. Обязанности: приготовление кофе, работа с гостями, кассой и чистота рабочего места. Предварительное ИИ-интервью включено.",
  },
  {
    label: "Менеджер по продажам мебели",
    text: "Мебельная компания в Астане ищет менеджера по активным продажам готовой мебели и мебели на заказ. Требуется самостоятельный поиск клиентов, B2B-продажи, переговоры и заключение сделок. Рассматриваем разные варианты оплаты.",
  },
];

const MAX_LENGTH = 2000;

/**
 * Главное поле ввода. Пока работодатель печатает, встроенный разбор прямо
 * в браузере показывает, что уже понято, — без запросов к серверу.
 */
export function IntakeComposer() {
  const router = useRouter();
  const inputId = useId();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const deferred = useDeferredValue(text);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(inputRef, text);

  const recognized = useMemo(() => {
    if (deferred.trim().length < 3) return { chips: [], completeness: 0 };
    const { patch } = parseEmployerMessage(deferred);
    const core = [patch.title, patch.city ?? (patch.workFormat === "remote" ? "remote" : null), patch.compensation, patch.schedule];
    return { chips: describePatch(patch), completeness: core.filter(Boolean).length / core.length };
  }, [deferred]);

  const ready = text.trim().length >= 2 && !submitting;

  function submit() {
    if (!ready) return;
    setSubmitting(true);
    const session = createSession(text.trim().slice(0, MAX_LENGTH));
    router.push(`/vacancies/${session.id}`);
  }

  return (
    <div>
      <form
        className="relative overflow-hidden rounded-card border border-line bg-surface shadow-lift"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {/* Золотая линия растёт по мере того, как запрос становится понятнее. */}
        <div aria-hidden className="h-[3px] bg-line/60">
          <div
            className="h-full origin-left bg-gold transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${recognized.completeness})` }}
          />
        </div>

        <label htmlFor={inputId} className="sr-only">
          Кого вы ищете
        </label>
        <textarea
          ref={inputRef}
          id={inputId}
          name="request"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
          maxLength={MAX_LENGTH}
          rows={3}
          placeholder="Например: нужны два бариста в Астане, зарплата 300 000 тенге, график 5/2"
          className="block min-h-28 w-full resize-none bg-transparent px-5 pb-3 pt-5 text-[1.0625rem] leading-relaxed text-ink placeholder:text-muted focus:outline-none sm:px-7 sm:pt-6 sm:text-lg"
        />

        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between sm:px-7 sm:pb-6">
          <div aria-live="polite" className="min-h-11 flex-1">
            {recognized.chips.length > 0 ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Понято из запроса">
                {recognized.chips.map((chip) => (
                  <li key={chip.key} className="flex animate-settle items-center gap-2 text-sm text-ink-soft">
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-gold" />
                    {chip.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pt-2.5 text-sm text-muted">Пишите как коллеге: должность, город, условия.</p>
            )}
          </div>
          <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={!ready}>
            Собрать вакансию
          </button>
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-sm text-muted">Примеры запросов</span>
        {EXAMPLES.map((example) => (
          <button key={example.label} type="button" className="chip" onClick={() => setText(example.text)}>
            {example.label}
          </button>
        ))}
      </div>
    </div>
  );
}
