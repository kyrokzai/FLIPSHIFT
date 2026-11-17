import { rankCandidates } from "@/domain/candidate/match";
import { SHORTLIST_THRESHOLD, type Candidate } from "@/domain/candidate/schema";
import { candidateName } from "./candidate-card";

function Reason({ candidate }: { candidate: Candidate }) {
  const analysis = candidate.analysis!;
  const met = analysis.criteria.filter((c) => c.status === "met").map((c) => c.label.replace(/^Опыт по профилю: /, "профиль — "));
  const lacking = analysis.criteria.filter((c) => c.status === "missing" || c.status === "partial").map((c) => c.label.replace(/^Опыт по профилю: /, "профиль — "));
  return (
    <div className="mt-2 flex flex-col gap-1 text-[0.9375rem] leading-relaxed">
      {met.length ? (
        <p>
          <span className="font-medium text-ok">Подтверждено: </span>
          {met.slice(0, 4).join("; ")}
          {met.length > 4 ? ` и ещё ${met.length - 4}` : ""}
        </p>
      ) : null}
      {lacking.length ? (
        <p>
          <span className="font-medium text-danger">Не хватает: </span>
          {lacking.slice(0, 3).join("; ")}
          {lacking.length > 3 ? ` и ещё ${lacking.length - 3}` : ""}
        </p>
      ) : null}
      {analysis.toClarify.length ? (
        <p className="text-muted">Уточнить на интервью: {analysis.toClarify.length}</p>
      ) : null}
    </div>
  );
}

export function ShortlistSection({ candidates }: { candidates: Candidate[] }) {
  const { shortlist, others } = rankCandidates(candidates);
  const indexOf = (candidate: Candidate) => candidates.indexOf(candidate);

  if (shortlist.length + others.length === 0) {
    return <p className="mt-4 leading-relaxed text-muted">Шорт-лист появится, когда будет проанализировано хотя бы одно резюме.</p>;
  }

  return (
    <div className="mt-5">
      {shortlist.length > 0 ? (
        <ol className="flex flex-col gap-3" aria-label="Шорт-лист">
          {shortlist.map((candidate, place) => (
            <li key={candidate.id} className="rounded-card border border-line bg-surface p-5">
              <p className="flex items-baseline justify-between gap-3">
                <span className="text-lg font-medium leading-snug">
                  <span className="mr-2 text-gold-deep">{place + 1}</span>
                  {candidateName(candidate, indexOf(candidate))}
                </span>
                <span className="shrink-0 text-lg font-medium">{candidate.analysis!.score}%</span>
              </p>
              <Reason candidate={candidate} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-card border border-line bg-surface p-5 leading-relaxed text-ink-soft">
          Никто из проанализированных кандидатов не набрал {SHORTLIST_THRESHOLD}% соответствия. Ниже указано, чего не хватает каждому.
        </p>
      )}

      {others.length > 0 ? (
        <section className="mt-6">
          <h3 className="text-[0.9375rem] font-medium text-ink-soft">Не вошли в шорт-лист</h3>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {others.map((candidate) => (
              <li key={candidate.id} className="py-4">
                <p className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{candidateName(candidate, indexOf(candidate))}</span>
                  <span className="shrink-0 text-ink-soft">{candidate.analysis!.verdict === "insufficient" ? "мало данных" : `${candidate.analysis!.score}%`}</span>
                </p>
                <Reason candidate={candidate} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-5 text-sm leading-relaxed text-muted">
        В шорт-лист попадают до пяти кандидатов с соответствием от {SHORTLIST_THRESHOLD}%. Порядок и порог — рекомендация: решение о
        приглашении и найме принимаете вы.
      </p>
    </div>
  );
}
