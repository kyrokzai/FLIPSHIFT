import type { Candidate } from "@/domain/candidate/schema";
import { isNegated, splitUnits } from "@/domain/candidate/terms";
import { levelLabels, weightedShare, weightsFor } from "@/domain/challenge/engine";
import type { Challenge, ChallengeWeights } from "@/domain/challenge/schema";
import { TEMPLATES } from "@/domain/challenge/templates";
import { currencySymbols, formatAmount, formatNumber, plural } from "@/domain/vacancy/format";
import type { VacancyDraft } from "@/domain/vacancy/schema";

/**
 * Сравнение 2–3 кандидатов одной вакансии. Каждое значение — с источником.
 * Неизвестное остаётся неизвестным: «Нет данных», а не ноль.
 * Победитель не назначается, порядок кандидатов — порядок добавления.
 */

export const MAX_COMPARE = 3;
export const MIN_COMPARE = 2;
export const NO_DATA = "Нет данных";

export type SourceKind = "resume" | "analysis" | "challenge" | "interview";

export const sourceLabels: Record<SourceKind, string> = {
  resume: "Резюме",
  analysis: "Сравнение резюме с вакансией",
  challenge: "Проверка навыков",
  interview: "Предварительное интервью",
};

export interface CompareCell {
  candidateId: string;
  /** null — данных нет; интерфейс показывает «Нет данных». */
  value: string | null;
  detail: string | null;
  /** Дословная выдержка, на которой основано значение. */
  excerpt: string | null;
  source: SourceKind | null;
}

export const fieldIds = ["experience", "skills", "prospecting", "achievements", "salary", "schedule", "interview", "challenge", "missing", "questions"] as const;
export type FieldId = (typeof fieldIds)[number];

export const fieldLabels: Record<FieldId, string> = {
  experience: "Профессиональный опыт",
  skills: "Релевантные навыки",
  prospecting: "Самостоятельное привлечение клиентов",
  achievements: "Коммерческие достижения, указанные кандидатом",
  salary: "Зарплатные ожидания",
  schedule: "Готовность к графику",
  interview: "Результаты интервью",
  challenge: "Результаты проверки навыков",
  missing: "Отсутствующая информация",
  questions: "Что уточнить",
};

export interface CompareField {
  id: FieldId;
  label: string;
  cells: CompareCell[];
}

export interface CompareInput {
  draft: VacancyDraft;
  candidates: Candidate[];
  challenges: Challenge[];
  weights: ChallengeWeights;
  names: Record<string, string>;
}

const clip = (text: string, max = 200) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const empty = (candidateId: string, detail: string | null = null): CompareCell => ({ candidateId, value: null, detail, excerpt: null, source: null });

const PROSPECTING = /поиск\S*\s+(?:и\s+привлечени\S*\s+)?(?:новых\s+)?клиент|привлечени\S*\s+(?:новых\s+)?клиент|холодн\S*\s+звон|лидоген|самостоятельн\S*\s+поиск|активн\S*\s+поиск|наработк\S*\s+клиент|выезд\S*\s+к\s+/i;
const ACHIEVEMENT = /(?:выполн\S*\s+план|план\S*\s+(?:продаж\s+)?(?:на|выполн)|\d+\s*%|\d+[\s,.]*(?:млн|млрд|тыс)|сделк\S*\s+(?:от|до|на)\s+\d|рост\S*|увелич\S*|привл\S*\s+\d+|\d+\s+клиент)/i;
const SCHEDULE = /график|5\/2|2\/2|6\/1|сменн|посменн|выходн\S* дн|готов\S* к (?:командировк|переработк|сменам)|полн\S* (?:день|занятост)|частичн\S* занятост/i;

function latestChallenge(challenges: Challenge[], candidateId: string): Challenge | undefined {
  return challenges
    .filter((item) => item.candidateId === candidateId && item.report)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

function cellsFor(candidate: Candidate, input: CompareInput): Record<FieldId, CompareCell> {
  const id = candidate.id;
  const facts = candidate.facts;
  const analysis = candidate.analysis;
  const units = splitUnits(candidate.resumeText);

  // Опыт
  const experience: CompareCell =
    facts?.experienceYears != null
      ? {
          candidateId: id,
          value: `${String(facts.experienceYears).replace(".", ",")} ${plural(Math.floor(facts.experienceYears), ["год", "года", "лет"])}`,
          detail: facts.positions.length ? `Должности: ${facts.positions.slice(0, 3).join("; ")}` : null,
          excerpt: null,
          source: "resume",
        }
      : empty(id, "Стаж в резюме не указан");

  // Навыки: из раздела навыков резюме и подтверждённые требования вакансии
  const confirmed = analysis?.criteria.filter((c) => c.status === "met" && (c.kind === "responsibility" || c.kind === "requirement")).map((c) => c.label) ?? [];
  const skills: CompareCell =
    confirmed.length || facts?.skills.length
      ? {
          candidateId: id,
          value: confirmed.length ? `Подтверждено по вакансии: ${confirmed.slice(0, 4).join("; ")}` : `Навыки из резюме: ${facts!.skills.slice(0, 5).join(", ")}`,
          detail: confirmed.length && facts?.skills.length ? `В разделе навыков: ${facts.skills.slice(0, 5).join(", ")}` : null,
          excerpt: null,
          source: confirmed.length ? "analysis" : "resume",
        }
      : empty(id);

  // Самостоятельное привлечение клиентов
  const prospectLine = units.find((unit) => PROSPECTING.test(unit) && !isNegated(unit));
  const deniedLine = units.find((unit) => isNegated(unit) && /(?:поиск|привлеч|холодн|клиент)/i.test(unit));
  const prospecting: CompareCell = prospectLine
    ? { candidateId: id, value: "Указано в резюме", detail: null, excerpt: clip(prospectLine), source: "resume" }
    : deniedLine
      ? { candidateId: id, value: "Кандидат пишет, что не занимался", detail: null, excerpt: clip(deniedLine), source: "resume" }
      : empty(id, "В резюме не упоминается");

  // Достижения — только то, что написал сам кандидат; платформа их не проверяет
  const achievementLines = units.filter((unit) => ACHIEVEMENT.test(unit) && /\d/.test(unit) && !/^(?:\d{4}|январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)/i.test(unit));
  const achievements: CompareCell = achievementLines.length
    ? { candidateId: id, value: "Указаны в резюме, не проверены", detail: achievementLines.length > 1 ? `Ещё: ${clip(achievementLines[1]!, 140)}` : null, excerpt: clip(achievementLines[0]!), source: "resume" }
    : empty(id, "Цифр и результатов в резюме нет");

  // Зарплатные ожидания относительно вакансии
  let salary: CompareCell = empty(id, "В резюме не указаны");
  const wish = facts?.salaryExpectation;
  if (wish) {
    const comp = input.draft.compensation;
    const ceiling = comp.amountTo ?? comp.amountFrom;
    const comparable = ceiling !== null && comp.currency === wish.currency && comp.period === "month";
    const relation = !comparable ? null : wish.amount <= ceiling ? "в пределах вакансии" : "выше вакансии";
    salary = {
      candidateId: id,
      value: `${formatNumber(wish.amount)} ${currencySymbols[wish.currency]}${relation ? ` — ${relation}` : ""}`,
      detail: comparable ? `В вакансии: ${formatAmount(comp)}` : null,
      excerpt: null,
      source: "resume",
    };
  }

  // График
  const scheduleLine = units.find((unit) => SCHEDULE.test(unit));
  const schedule: CompareCell = scheduleLine
    ? { candidateId: id, value: "Упоминается в резюме", detail: input.draft.schedule ? `В вакансии: ${input.draft.schedule}` : null, excerpt: clip(scheduleLine), source: "resume" }
    : empty(id, input.draft.schedule ? `Не указано. В вакансии: ${input.draft.schedule}` : "Не указано");

  // Интервью: модуль предварительного интервью пока не подключён
  const interview = empty(id, "Предварительное интервью не проводилось");

  // Проверка навыков
  const challenge = latestChallenge(input.challenges, id);
  let challengeCell: CompareCell = empty(id, "Проверка не проводилась");
  if (challenge?.report) {
    const share = weightedShare(challenge.report, weightsFor(challenge.templateId, input.weights));
    const shown = challenge.report.results.filter((r) => r.level === "demonstrated").map((r) => r.label);
    const best = challenge.report.results.find((r) => r.level === "demonstrated" && r.excerpt);
    challengeCell = {
      candidateId: id,
      value: share === null ? "Оценивать нечего" : `Навыки проявлены на ${share}% с учётом весов`,
      detail: `${TEMPLATES[challenge.templateId].title}. Отвечено ${challenge.report.answeredSteps} из ${challenge.report.totalSteps}. Проявлено: ${shown.length ? shown.join(", ") : "ни один критерий"}.${challenge.mode === "demo" ? " Ответы вымышлены." : ""}`,
      excerpt: best?.excerpt ? clip(best.excerpt) : null,
      source: "challenge",
    };
  }

  const base = { experience, skills, prospecting, achievements, salary, schedule, interview, challenge: challengeCell };
  const missingFields = (Object.keys(base) as Array<keyof typeof base>).filter((key) => base[key].value === null).map((key) => fieldLabels[key].toLowerCase());
  const missing: CompareCell = { candidateId: id, value: missingFields.length ? missingFields.join("; ") : "Все поля заполнены", detail: null, excerpt: null, source: null };

  const questions = [
    ...(analysis?.questions.slice(0, 2) ?? []),
    ...(challenge?.report?.results.filter((r) => r.level === "not_observed" || r.level === "partial").slice(0, 1).map((r) => r.toVerify) ?? []),
    ...(base.salary.value === null ? ["Какие у вас ожидания по доходу?"] : []),
    ...(base.schedule.value === null && input.draft.schedule ? [`Подходит ли график ${input.draft.schedule}?`] : []),
  ].slice(0, 4);
  const questionsCell: CompareCell = { candidateId: id, value: questions.length ? questions.join(" / ") : "Вопросов нет", detail: null, excerpt: null, source: questions.length ? "analysis" : null };

  return { ...base, missing, questions: questionsCell };
}

export interface CompareReport {
  strengths: Array<{ candidateId: string; items: string[] }>;
  differences: string[];
  gaps: Array<{ candidateId: string; items: string[] }>;
  questions: Array<{ candidateId: string; items: string[] }>;
}

export interface Comparison {
  fields: CompareField[];
  report: CompareReport;
}

export function buildComparison(input: CompareInput): Comparison {
  const perCandidate = input.candidates.map((candidate) => ({ candidate, cells: cellsFor(candidate, input) }));
  const fields: CompareField[] = fieldIds.map((id) => ({ id, label: fieldLabels[id], cells: perCandidate.map((item) => item.cells[id]) }));
  const name = (id: string) => input.names[id] ?? "Кандидат";

  const strengths = perCandidate.map(({ candidate }) => {
    const met = candidate.analysis?.criteria.filter((c) => c.status === "met" && c.kind !== "city" && c.kind !== "salary").map((c) => c.label.replace(/^Опыт по профилю: /, "Профиль: ")) ?? [];
    const challenge = latestChallenge(input.challenges, candidate.id);
    const shown = challenge?.report?.results.filter((r) => r.level === "demonstrated").map((r) => `${r.label} (проверка навыков)`) ?? [];
    return { candidateId: candidate.id, items: [...met.slice(0, 3), ...shown.slice(0, 2)] };
  });

  const gaps = perCandidate.map(({ candidate }) => {
    const missing = candidate.analysis?.criteria.filter((c) => c.status === "missing" || c.status === "partial").map((c) => `${c.label}: ${c.status === "missing" ? "не найдено в резюме" : "подтверждено частично"}`) ?? [];
    const challenge = latestChallenge(input.challenges, candidate.id);
    const notShown = challenge?.report?.results.filter((r) => r.level === "not_observed").map((r) => `${r.label}: не проявилось в проверке`) ?? [];
    return { candidateId: candidate.id, items: [...missing.slice(0, 3), ...notShown.slice(0, 2)] };
  });

  const questions = perCandidate.map(({ candidate, cells }) => ({
    candidateId: candidate.id,
    items: cells.questions.value && cells.questions.source ? cells.questions.value.split(" / ") : [],
  }));

  const differences: string[] = [];
  const group = (field: FieldId, present: (cell: CompareCell) => boolean, label: string) => {
    const cells = fields.find((f) => f.id === field)!.cells;
    const yes = cells.filter(present).map((c) => name(c.candidateId));
    const no = cells.filter((c) => !present(c)).map((c) => name(c.candidateId));
    if (yes.length && no.length) differences.push(`${label}: есть у ${yes.join(", ")}; нет данных или нет у ${no.join(", ")}.`);
  };

  const years = perCandidate.map(({ candidate }) => ({ id: candidate.id, years: candidate.facts?.experienceYears ?? null }));
  const known = years.filter((y) => y.years !== null);
  if (known.length >= 2) {
    const min = Math.min(...known.map((y) => y.years!));
    const max = Math.max(...known.map((y) => y.years!));
    if (max - min >= 1) differences.push(`Стаж по резюме: ${known.map((y) => `${name(y.id)} — ${String(y.years).replace(".", ",")}`).join(", ")} (лет).`);
  }
  if (known.length < years.length) differences.push(`Стаж не указан у: ${years.filter((y) => y.years === null).map((y) => name(y.id)).join(", ")}.`);
  group("prospecting", (c) => c.value === "Указано в резюме", "Самостоятельный поиск клиентов в резюме");
  group("achievements", (c) => c.value !== null, "Цифры и результаты в резюме");
  const salaryCells = fields.find((f) => f.id === "salary")!.cells;
  const above = salaryCells.filter((c) => c.value?.includes("выше вакансии")).map((c) => name(c.candidateId));
  if (above.length) differences.push(`Ожидания выше вакансии у: ${above.join(", ")}.`);
  group("challenge", (c) => c.value !== null, "Проверка навыков проведена");

  return { fields, report: { strengths, differences, gaps, questions } };
}

export { NO_DATA as noDataLabel, levelLabels };
