"use client";

import type { SearchPlan } from "@/domain/sourcing/queries";
import { recordEvent } from "@/lib/activity";
import { buildProfessionLinks, buildQueryLink } from "@/domain/sourcing/sources";
import type { VacancyDraft } from "@/domain/vacancy/schema";
import { CopyButton } from "./copy-button";

/** Переход по ссылке — это действие работодателя, а не автоматический поиск: так он и записывается. */
function logOpen(sessionId: string, source: string) {
  recordEvent({
    vacancyId: sessionId,
    key: `source_opened:${source}:${Date.now()}`,
    type: "source_opened",
    actor: "employer",
    mode: "live",
    source,
    result: `Открыт поиск резюме на ${source} в новой вкладке. Резюме автоматически не загружались.`,
  });
}

export function QueriesSection({ sessionId, plan, draft }: { sessionId: string; plan: SearchPlan; draft: VacancyDraft }) {
  if (plan.queries.length === 0) {
    return <p className="mt-4 leading-relaxed text-muted">Укажите в вакансии должность — агент составит запросы.</p>;
  }
  const others = buildProfessionLinks(plan, draft);

  return (
    <>
      <ol className="mt-5 flex flex-col gap-5">
        {plan.queries.map((query) => {
          const text = query.boolean ?? query.text;
          const link = buildQueryLink(query, draft);
          return (
            <li key={query.id} className="rounded-card border border-line bg-surface p-5 sm:p-6">
              <h3 className="text-lg font-medium leading-snug">{query.label}</h3>
              <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">{query.purpose}</p>
              <p className="mt-3 break-words rounded-field bg-paper px-3.5 py-3 leading-relaxed text-ink" data-testid={`query-${query.id}`}>
                {text}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="btn btn-quiet" onClick={() => logOpen(sessionId, link.source)}>
                  {link.label}
                </a>
                <CopyButton text={text} label="Скопировать запрос" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{link.note}</p>
            </li>
          );
        })}
      </ol>

      {others.length > 0 ? (
        <section aria-labelledby="other-sources-title" className="mt-5 rounded-card border border-line bg-surface p-5 sm:p-6">
          <h3 id="other-sources-title" className="text-lg font-medium leading-snug">
            Другие площадки
          </h3>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">
            Здесь поиск проще, поэтому агент ищет по самому распространённому названию должности: «{plan.titles[0]}».
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {others.map((link) => (
              <li key={link.source}>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="btn btn-quiet w-full sm:w-auto" onClick={() => logOpen(sessionId, link.source)}>
                  {link.label}
                </a>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{link.note}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
