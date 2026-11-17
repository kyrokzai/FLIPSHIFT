"use client";

import { useId, useRef, useState } from "react";
import type { Question, QuestionOption } from "@/domain/vacancy/schema";
import type { ChatMessage, VacancySession } from "@/lib/sessions";
import { useAutoGrow } from "@/lib/use-auto-grow";

interface Props {
  session: VacancySession;
  question: Question | null;
  onSend: (text: string) => void;
  onChoose: (question: Question, options: QuestionOption[]) => void;
  onSkip: (question: Question) => void;
  onRetry: () => void;
}

function Message({ item }: { item: ChatMessage }) {
  if (item.role === "employer") {
    return (
      <li className="ml-auto max-w-[92%] rounded-2xl rounded-br-md border border-line bg-surface px-4 py-3 leading-relaxed text-ink">
        <span className="sr-only">Вы: </span>
        {item.text}
      </li>
    );
  }
  return (
    <li className="border-l-2 border-gold pl-4 leading-relaxed text-ink">
      <span className="sr-only">Talent Agent: </span>
      {item.text}
      {item.notices.map((notice) => (
        <p
          key={notice.attribute}
          role="note"
          className="mt-3 rounded-field border border-gold/40 bg-gold-wash px-3.5 py-3 text-[0.9375rem] leading-relaxed text-ink-soft"
        >
          {notice.message}
        </p>
      ))}
    </li>
  );
}

function QuestionBlock({
  question,
  disabled,
  onChoose,
  onSkip,
}: {
  question: Question;
  disabled: boolean;
  onChoose: Props["onChoose"];
  onSkip: Props["onSkip"];
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const multi = question.mode === "multi";

  return (
    <div className="animate-settle">
      <p className="text-lg font-medium leading-snug">{question.text}</p>
      {question.hint ? <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-muted">{question.hint}</p> : null}

      {question.options.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={question.text}>
          {question.options.map((option) => {
            const active = picked.includes(option.label);
            return (
              <button
                key={option.label}
                type="button"
                className="chip"
                disabled={disabled}
                aria-pressed={multi ? active : undefined}
                onClick={() => {
                  if (!multi) return onChoose(question, [option]);
                  setPicked((current) => (active ? current.filter((label) => label !== option.label) : [...current, option.label]));
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {multi || question.skipLabel ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {multi ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={disabled || picked.length === 0}
              onClick={() => onChoose(question, question.options.filter((option) => picked.includes(option.label)))}
            >
              Готово
            </button>
          ) : null}
          {question.skipLabel ? (
            <button type="button" className="btn-text text-[0.9375rem]" disabled={disabled} onClick={() => onSkip(question)}>
              {question.skipLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function VacancyDialog({ session, question, onSend, onChoose, onSkip, onRetry }: Props) {
  const inputId = useId();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(inputRef, text);
  const busy = session.pending !== null;
  const confirmed = session.status === "confirmed";

  // На виду — последний обмен репликами; остальное сворачивается.
  const lastAgent = session.messages.findLastIndex((item) => item.role === "agent");
  const split = lastAgent > 0 ? lastAgent - 1 : 0;
  const earlier = session.messages.slice(0, split);
  const recent = session.messages.slice(split);

  function submit() {
    if (busy || text.trim().length < 2) return;
    onSend(text);
    setText("");
  }

  return (
    <section aria-label="Диалог с Talent Agent" className="flex flex-col gap-6">
      {earlier.length > 0 ? (
        <details className="group">
          <summary className="inline-flex min-h-11 list-none items-center text-[0.9375rem] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Показать начало переписки</span>
            <span className="hidden group-open:inline">Скрыть начало переписки</span>
          </summary>
          <ol className="mt-3 flex flex-col gap-4">
            {earlier.map((item) => (
              <Message key={item.id} item={item} />
            ))}
          </ol>
        </details>
      ) : null}

      <ol className="flex flex-col gap-4" aria-live="polite">
        {recent.map((item) => (
          <Message key={item.id} item={item} />
        ))}
        {busy ? (
          <li className="border-l-2 border-gold pl-4 text-muted" role="status">
            <span className="animate-pulse">Разбираю запрос…</span>
          </li>
        ) : null}
      </ol>

      {session.failed ? (
        <div role="alert" className="rounded-field border border-danger/30 bg-danger-wash px-4 py-3.5">
          <p className="leading-relaxed text-ink">{session.failed.reason}</p>
          <button type="button" className="btn btn-quiet mt-3" onClick={onRetry}>
            Повторить отправку
          </button>
        </div>
      ) : null}

      {!confirmed && question && !busy && !session.failed ? (
        <QuestionBlock key={question.id} question={question} disabled={busy} onChoose={onChoose} onSkip={onSkip} />
      ) : null}

      {!confirmed ? (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex-1">
            <label htmlFor={inputId} className="sr-only">
              {question ? "Ваш ответ" : "Сообщение агенту"}
            </label>
            <textarea
              ref={inputRef}
              id={inputId}
              value={text}
              rows={1}
              maxLength={2000}
              disabled={busy}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={question && !session.failed ? question.placeholder : "Допишите или измените условия"}
              className="field block max-h-40 resize-none leading-relaxed"
            />
          </div>
          <button type="submit" className="btn btn-quiet" disabled={busy || text.trim().length < 2}>
            Отправить
          </button>
        </form>
      ) : null}

      {session.engine === "rules" && !confirmed ? (
        <p className="text-sm leading-relaxed text-muted">
          Работает базовый разбор запросов: языковая модель к этой установке не подключена.
        </p>
      ) : null}
    </section>
  );
}
