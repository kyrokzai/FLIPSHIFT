import type { Notice, ProtectedAttribute } from "./schema";
import { normalize, word } from "./text";

/**
 * Защищённые личные признаки не попадают в вакансию и не используются
 * при отборе. Если работодатель упомянул такой признак, агент исключает
 * его и объясняет почему.
 */

interface Rule {
  attribute: ProtectedAttribute;
  pattern: RegExp;
}

const RULES: Rule[] = [
  {
    attribute: "age",
    pattern: word(
      [
        "возраст\\S*(?:\\s+(?:от|до)\\s+\\d{2}(?:\\s+(?:до)\\s+\\d{2})?(?:\\s+лет)?)?",
        "не\\s+старше\\s+\\d{2}(?:\\s+лет)?",
        "не\\s+младше\\s+\\d{2}(?:\\s+лет)?",
        "(?:от\\s+)?\\d{2}\\s*(?:-|–|—|до)\\s*\\d{2}\\s+лет",
        "до\\s+[2-6]\\d\\s+лет",
        "молод(?:ой|ого|ая|ую|ые|ых|ым|ежь|ежи)",
        "пенсионер\\S*",
      ].join("|"),
      "g",
    ),
  },
  {
    attribute: "gender",
    pattern: word(
      [
        "девушк(?:а|у|и|ам|ами|е)|девуш(?:ек|ки)",
        "женщин(?:а|у|ы|ам|е)?",
        "мужчин(?:а|у|ы|ам|е)?",
        "парн(?:я|ей|и|ю)|парень",
        "юнош(?:а|у|и|ей)",
        "(?:женск|мужск)(?:ого|ий|ой)\\s+пол(?:а)?",
        "пол\\s*[:—-]?\\s*(?:муж|жен)\\S*",
      ].join("|"),
      "g",
    ),
  },
  {
    attribute: "ethnicity",
    pattern: word(
      [
        "национальност\\S*",
        "славянск\\S+\\s+внешност\\S*",
        "славян(?:е|ин|ка|ку|ок)?",
        "(?:казах|русск|узбек|киргиз|кыргыз|таджик|уйгур|корей|татар)\\S*\\s+национальност\\S*",
        "только\\s+(?:казах\\S*|русск\\S*|узбек\\S*|кыргыз\\S*|таджик\\S*)",
      ].join("|"),
      "g",
    ),
  },
  {
    attribute: "religion",
    pattern: word("мусульман\\S*|христиан\\S*|православн\\S*|религи\\S*|вероисповедан\\S*", "g"),
  },
  {
    attribute: "family",
    pattern: word(
      "семейн\\S+\\s+положени\\S*|не\\s?замужн\\S*|замужн\\S*|не\\s+замужем|замужем|женат\\S*|холост\\S*|без\\s+детей|бездетн\\S*|беременн\\S*|декрет\\S*",
      "g",
    ),
  },
  {
    attribute: "appearance",
    pattern: word("приятн\\S+\\s+внешност\\S*|модельн\\S+\\s+внешност\\S*|внешност\\S*|рост\\s+(?:от|не)\\s+\\S+|стройн\\S*", "g"),
  },
  {
    attribute: "health",
    pattern: word("без\\s+инвалидност\\S*|инвалидност\\S*|инвалид\\S*|без\\s+хронических\\s+\\S+", "g"),
  },
];

const LABELS: Record<ProtectedAttribute, string> = {
  age: "возраст",
  gender: "пол",
  ethnicity: "национальность или происхождение",
  religion: "религия",
  family: "семейное положение",
  appearance: "внешность",
  health: "состояние здоровья",
};

export function protectedAttributeLabel(attribute: ProtectedAttribute): string {
  return LABELS[attribute];
}

export function buildNotice(attribute: ProtectedAttribute, excerpt: string): Notice {
  return {
    kind: "protected_attribute",
    attribute,
    excerpt: excerpt.slice(0, 120),
    message: `Условие «${excerpt.trim()}» не вошло в вакансию: ${LABELS[attribute]} — защищённый признак, по нему нельзя отбирать кандидатов. Опишите вместо этого навыки и задачи.`,
  };
}

/** Находит упоминания защищённых признаков в сообщении работодателя. */
export function findProtectedAttributes(text: string): Notice[] {
  const norm = normalize(text);
  const notices: Notice[] = [];
  const seen = new Set<ProtectedAttribute>();

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of norm.matchAll(rule.pattern)) {
      if (seen.has(rule.attribute)) break;
      const start = match.index;
      // «опыт до 10 лет» и «стаж от 15 лет» — про опыт, а не про возраст.
      if (rule.attribute === "age" && /(?:опыт\S*|стаж\S*)\s+(?:работы\s+)?(?:от\s+)?$/.test(norm.slice(0, start))) continue;
      seen.add(rule.attribute);
      notices.push(buildNotice(rule.attribute, text.slice(start, start + match[0].length)));
    }
  }

  return notices;
}

/** true, если фраза упоминает защищённый признак и не должна попасть в требования. */
export function mentionsProtectedAttribute(text: string): boolean {
  return findProtectedAttributes(text).length > 0;
}

/** Убирает из списка пункты с защищёнными признаками. */
export function withoutProtected(items: string[]): string[] {
  return items.filter((item) => !mentionsProtectedAttribute(item));
}

export function mergeNotices(...groups: Notice[][]): Notice[] {
  const byAttribute = new Map<ProtectedAttribute, Notice>();
  for (const notice of groups.flat()) {
    if (!byAttribute.has(notice.attribute)) byAttribute.set(notice.attribute, notice);
  }
  return [...byAttribute.values()];
}
