import { formatAmount, formatNumber, plural } from "@/domain/vacancy/format";
import type { VacancyDraft } from "@/domain/vacancy/schema";
import { buildCandidateQuestions } from "@/domain/interview/questions";
import { extractFacts } from "./extract";
import {
  SHORTLIST_SIZE,
  SHORTLIST_THRESHOLD,
  type Analysis,
  type Candidate,
  type Criterion,
  type ResumeFacts,
  type Verdict,
} from "./schema";
import { bestEvidence, indexText, isNegated, keyTermPairs, matchTerms, splitUnits } from "./terms";

/**
 * Scout Agent, встроенная оценка: сравнивает профессиональные сведения из
 * резюме с требованиями вакансии. Каждая оценка опирается на дословную
 * выдержку из резюме — работодатель может её проверить.
 *
 * Личные признаки (возраст, пол, семейное положение и другие) в оценке
 * не участвуют: таких критериев просто нет.
 */

const WEIGHTS = { role: 25, responsibility: 35, requirement: 20, experience: 10, city: 5, salary: 5 } as const;

/** Отпечаток вакансии: по нему видно, что оценка сделана по устаревшим условиям. */
export function vacancyKey(draft: VacancyDraft): string {
  const source = JSON.stringify(draft);
  let hash = 5381;
  for (let i = 0; i < source.length; i++) hash = ((hash << 5) + hash + source.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

interface TextCriterionInput {
  id: string;
  kind: "role" | "responsibility" | "requirement";
  label: string;
  weight: number;
}

interface ResumeView {
  /** Индекс по строкам, где опыт утверждается. */
  index: ReturnType<typeof indexText>;
  units: string[];
  /** Строки, где кандидат сам пишет об отсутствии опыта. */
  negated: string[];
}

function viewResume(resumeText: string): ResumeView {
  const all = splitUnits(resumeText);
  const negated = all.filter(isNegated);
  const units = all.filter((unit) => !negated.includes(unit));
  return { index: indexText(units.join("\n")), units, negated };
}

/**
 * Критерий по тексту: source — формулировка из вакансии. Для должности (strict)
 * нужны все значимые слова: «менеджер по продажам мебели» без опыта в мебели —
 * это частичное соответствие, а не полное.
 */
function assessText(input: TextCriterionInput, source: string, view: ResumeView, strict = false): Criterion {
  const pairs = keyTermPairs(source);
  if (pairs.length === 0) {
    return { ...input, status: "unknown", evidence: null, comment: "Формулировка слишком общая для автоматической проверки." };
  }
  const stems = pairs.map((pair) => pair.stem);
  const { matched, missed } = matchTerms(view.index, stems);
  const ratio = matched.length / stems.length;
  const evidence = matched.length ? bestEvidence(view.units, matched) : null;
  const denial = bestEvidence(view.negated, stems);
  const missedWords = pairs.filter((pair) => missed.includes(pair.stem)).map((pair) => pair.word);

  let status: Criterion["status"] = ratio >= (strict ? 1 : 0.6) ? "met" : ratio >= (strict ? 0.5 : 0.3) ? "partial" : "missing";
  if (!evidence) status = "missing";

  let comment: string | null = null;
  if (status !== "met") {
    comment = denial
      ? `Кандидат сам указывает: «${denial}».`
      : status === "partial"
        ? `Подтверждается частично: в резюме нет упоминаний — ${missedWords.join(", ")}.`
        : "В резюме не найдено упоминаний.";
  }
  return { ...input, status, evidence: status === "missing" ? null : evidence, comment };
}

export function buildCriteria(draft: VacancyDraft, facts: ResumeFacts, resumeText: string): Criterion[] {
  const view = viewResume(resumeText);
  const criteria: Criterion[] = [];

  if (draft.title) {
    criteria.push(
      assessText({ id: "role", kind: "role", label: `Опыт по профилю: ${draft.title}`, weight: WEIGHTS.role }, draft.title, view, true),
    );
  }

  const share = (total: number, count: number) => Math.round((total / count) * 100) / 100;
  draft.responsibilities.forEach((label, i) => {
    criteria.push(
      assessText(
        { id: `resp-${i + 1}`, kind: "responsibility", label, weight: share(WEIGHTS.responsibility, draft.responsibilities.length) },
        label,
        view,
      ),
    );
  });
  draft.requirements.forEach((label, i) => {
    criteria.push(
      assessText(
        { id: `req-${i + 1}`, kind: "requirement", label, weight: share(WEIGHTS.requirement, draft.requirements.length) },
        label,
        view,
      ),
    );
  });

  if (draft.experienceRequired) {
    const need = draft.experienceMinYears;
    const have = facts.experienceYears;
    const label = need ? `Опыт работы от ${need} ${plural(need, ["года", "лет", "лет"])}` : "Опыт работы";
    const haveText = have === null ? null : `${String(have).replace(".", ",")} ${plural(Math.floor(have), ["год", "года", "лет"])}`;
    criteria.push({
      id: "experience",
      kind: "experience",
      label,
      weight: WEIGHTS.experience,
      status: have === null ? "unknown" : have >= (need ?? 0.5) ? "met" : need && have >= need * 0.7 ? "partial" : "missing",
      evidence: null,
      comment: have === null ? "Общий стаж по резюме определить не удалось." : `По резюме общий стаж — ${haveText}.`,
    });
  }

  if (draft.city && draft.workFormat !== "remote") {
    const same = facts.city === draft.city;
    criteria.push({
      id: "city",
      kind: "city",
      label: `Город: ${draft.city}`,
      weight: WEIGHTS.city,
      status: facts.city === null ? "unknown" : same ? "met" : facts.relocation ? "partial" : "missing",
      evidence: null,
      comment:
        facts.city === null
          ? "Город в резюме не указан."
          : same
            ? null
            : facts.relocation
              ? `В резюме указан город ${facts.city}, кандидат готов к переезду.`
              : `В резюме указан город ${facts.city}.`,
    });
  }

  const ceiling = draft.compensation.amountTo ?? draft.compensation.amountFrom;
  if (ceiling !== null && draft.compensation.period === "month") {
    const wish = facts.salaryExpectation;
    const comparable = wish && wish.currency === draft.compensation.currency;
    const offer = formatAmount(draft.compensation);
    criteria.push({
      id: "salary",
      kind: "salary",
      label: `Ожидания по оплате в пределах вакансии (${offer})`,
      weight: WEIGHTS.salary,
      status: !comparable ? "unknown" : wish.amount <= ceiling ? "met" : wish.amount <= ceiling * 1.15 ? "partial" : "missing",
      evidence: null,
      comment: !wish
        ? "Ожидания по оплате в резюме не указаны."
        : !comparable
          ? "Ожидания указаны в другой валюте — сравнить автоматически нельзя."
          : `Ожидания кандидата — ${formatNumber(wish.amount)}.`,
    });
  }

  return criteria;
}

const VALUE = { met: 1, partial: 0.5, missing: 0, unknown: 0 } as const;

export function scoreCriteria(criteria: Criterion[]): { score: number; coverage: number; verdict: Verdict } {
  const total = criteria.reduce((sum, c) => sum + c.weight, 0);
  const known = criteria.filter((c) => c.status !== "unknown");
  const knownWeight = known.reduce((sum, c) => sum + c.weight, 0);
  if (total === 0 || knownWeight === 0) return { score: 0, coverage: 0, verdict: "insufficient" };

  const score = Math.round((known.reduce((sum, c) => sum + c.weight * VALUE[c.status], 0) / knownWeight) * 100);
  const coverage = Math.round((knownWeight / total) * 100) / 100;
  const verdict: Verdict = coverage < 0.4 ? "insufficient" : score >= 80 ? "strong" : score >= 50 ? "partial" : "weak";
  return { score, coverage, verdict };
}

const short = (label: string) => label.replace(/^Опыт по профилю: /, "профиль «").replace(/^(профиль «.*)$/, "$1»");

export function summarize(criteria: Criterion[], score: number, verdict: Verdict): Pick<Analysis, "summary" | "strengths" | "gaps" | "toClarify"> {
  const strengths = criteria.filter((c) => c.status === "met").map((c) => (c.evidence ? `${c.label} — «${c.evidence}»` : c.label));
  const gaps = criteria
    .filter((c) => c.status === "missing" || c.status === "partial")
    .map((c) => (c.comment ? `${c.label}. ${c.comment}` : c.label));
  const toClarify = criteria.filter((c) => c.status === "unknown").map((c) => (c.comment ? `${c.label}. ${c.comment}` : c.label));

  const met = criteria.filter((c) => c.status === "met").length;
  const known = criteria.filter((c) => c.status !== "unknown").length;
  const parts: string[] = [];
  if (verdict === "insufficient") {
    parts.push("В резюме слишком мало сведений, чтобы оценить соответствие вакансии.");
  } else {
    parts.push(`Соответствие ${score}%: подтверждено ${met} из ${known} ${plural(known, ["проверенного критерия", "проверенных критериев", "проверенных критериев"])}.`);
  }
  const top = criteria.filter((c) => c.status === "met").slice(0, 3).map((c) => short(c.label).toLowerCase());
  if (top.length) parts.push(`Подтверждается: ${top.join("; ")}.`);
  const lacking = criteria.filter((c) => c.status === "missing").slice(0, 3).map((c) => short(c.label).toLowerCase());
  if (lacking.length) parts.push(`Не найдено в резюме: ${lacking.join("; ")}.`);
  if (toClarify.length) parts.push(`Нужно уточнить у кандидата: ${toClarify.length} ${plural(toClarify.length, ["пункт", "пункта", "пунктов"])}.`);

  return {
    summary: parts.join(" ").slice(0, 900),
    strengths: strengths.slice(0, 12).map((s) => s.slice(0, 400)),
    gaps: gaps.slice(0, 12).map((s) => s.slice(0, 400)),
    toClarify: toClarify.slice(0, 12).map((s) => s.slice(0, 400)),
  };
}

export function assembleAnalysis(draft: VacancyDraft, criteria: Criterion[], engine: Analysis["engine"], summaryOverride?: string | null): Analysis {
  const { score, coverage, verdict } = scoreCriteria(criteria);
  const text = summarize(criteria, score, verdict);
  return {
    score,
    coverage,
    verdict,
    ...text,
    summary: summaryOverride?.trim() ? summaryOverride.trim().slice(0, 900) : text.summary,
    criteria,
    questions: buildCandidateQuestions(draft, criteria),
    engine,
  };
}

export function analyzeResume(
  draft: VacancyDraft,
  resumeText: string,
  options: { name?: string | null; now?: Date } = {},
): { facts: ResumeFacts; analysis: Analysis } {
  const facts = extractFacts(resumeText, options);
  const criteria = buildCriteria(draft, facts, resumeText);
  return { facts, analysis: assembleAnalysis(draft, criteria, "rules") };
}

export const verdictLabels: Record<Verdict, string> = {
  strong: "Сильное соответствие",
  partial: "Частичное соответствие",
  weak: "Слабое соответствие",
  insufficient: "Мало данных",
};

export interface Ranked {
  shortlist: Candidate[];
  others: Candidate[];
  pending: Candidate[];
}

/** Шорт-лист: лучшие по соответствию среди тех, кто прошёл порог. Порядок и порог — рекомендация. */
export function rankCandidates(candidates: Candidate[]): Ranked {
  const analysed = candidates
    .filter((c) => c.analysis)
    .sort((a, b) => b.analysis!.score - a.analysis!.score || b.analysis!.coverage - a.analysis!.coverage || a.addedAt - b.addedAt);
  const passed = analysed.filter((c) => c.analysis!.score >= SHORTLIST_THRESHOLD && c.analysis!.verdict !== "insufficient");
  const shortlist = passed.slice(0, SHORTLIST_SIZE);
  return {
    shortlist,
    others: analysed.filter((c) => !shortlist.includes(c)),
    pending: candidates.filter((c) => !c.analysis),
  };
}
