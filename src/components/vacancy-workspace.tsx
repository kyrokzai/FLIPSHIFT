"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { computeQuestions } from "@/domain/vacancy/questions";
import { useHydrated, useSessions } from "@/lib/sessions";
import {
  chooseOptions,
  deliverPending,
  retryFailed,
  saveDraft,
  sendMessage,
  setStatus,
  skipQuestion,
} from "@/lib/vacancy-actions";
import { VacancyCard } from "./vacancy-card";
import { VacancyDialog } from "./vacancy-dialog";
import { VacancyEditor } from "./vacancy-editor";

export function VacancyWorkspace({ id }: { id: string }) {
  const hydrated = useHydrated();
  const sessions = useSessions();
  const session = sessions.find((item) => item.id === id);
  const [editing, setEditing] = useState(false);
  const pending = session?.pending ?? null;
  const vacancyRef = useRef<HTMLDivElement>(null);

  /** Карточка и форма разной высоты: после переключения возвращаем их начало в поле зрения. */
  function toggleEditing(next: boolean) {
    setEditing(next);
    requestAnimationFrame(() => {
      const top = vacancyRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) vacancyRef.current?.scrollIntoView({ block: "start" });
    });
  }

  useEffect(() => {
    if (pending) void deliverPending(id);
  }, [id, pending]);

  if (!hydrated) {
    return (
      <section className="mx-auto w-full max-w-6xl px-5 py-12">
        <p className="text-muted">Открываю вакансию…</p>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="mx-auto w-full max-w-3xl px-5 py-16">
        <h1 className="text-3xl font-light tracking-[-0.02em] sm:text-4xl">Черновик не найден</h1>
        <p className="mt-4 max-w-[52ch] leading-relaxed text-ink-soft">
          Вакансии без регистрации хранятся в браузере, где они созданы. На этом устройстве такого черновика нет —
          возможно, он создан в другом браузере или удалён.
        </p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Link href="/" className="btn btn-primary">
            Описать вакансию заново
          </Link>
          <Link href="/vacancies" className="btn btn-quiet">
            Мои вакансии
          </Link>
        </div>
      </section>
    );
  }

  const draft = session.draft;
  const questions = draft ? computeQuestions(draft, session.skipped) : [];
  const question = questions[0] ?? null;
  const busy = session.pending !== null;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-8 sm:py-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <div className="lg:sticky lg:top-8 lg:self-start">
        <h1 className="sr-only">Создание вакансии</h1>
        <VacancyDialog
          session={session}
          question={question}
          onSend={(text) => sendMessage(id, text, question?.id ?? null)}
          onChoose={(q, options) => chooseOptions(id, q, options)}
          onSkip={(q) => skipQuestion(id, q)}
          onRetry={() => retryFailed(id)}
        />
      </div>

      <div ref={vacancyRef} className="scroll-mt-4">
        {!draft ? (
          <div className="rounded-card border border-dashed border-line-strong p-6 sm:p-9">
            <p className="text-lg font-medium">Здесь появится вакансия</p>
            <p className="mt-2 max-w-[48ch] leading-relaxed text-muted">
              {session.failed
                ? "Запрос не дошёл до агента. Повторите отправку — черновик соберётся из вашего описания."
                : "Агент разбирает ваш запрос: должность, город, оплату и график."}
            </p>
          </div>
        ) : editing ? (
          <VacancyEditor
            draft={draft}
            onCancel={() => toggleEditing(false)}
            onSave={(next) => {
              saveDraft(id, next);
              toggleEditing(false);
            }}
          />
        ) : (
          <VacancyCard
            sessionId={id}
            draft={draft}
            status={session.status}
            busy={busy}
            onEdit={() => toggleEditing(true)}
            onConfirm={() => setStatus(id, "confirmed")}
            onReopen={() => setStatus(id, "draft")}
          />
        )}
      </div>
    </div>
  );
}
