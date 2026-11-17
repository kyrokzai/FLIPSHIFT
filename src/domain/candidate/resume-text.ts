import { MAX_RESUME_CHARS } from "./schema";

/** Приводит извлечённый из файла текст к аккуратному виду. Общий код для браузера и сервера. */
export function tidyResumeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const MIN_RESUME_CHARS = 40;

export type ResumeFormat = "pdf" | "docx" | "txt";

/** Формат по имени файла; null — формат не поддерживается. */
export function formatByName(name: string): ResumeFormat | null {
  const extension = name.toLowerCase().split(".").pop() ?? "";
  if (extension === "pdf") return "pdf";
  if (extension === "docx") return "docx";
  if (extension === "txt" || extension === "md") return "txt";
  return null;
}

export const NO_TEXT_MESSAGE: Record<ResumeFormat, string> = {
  pdf: "В PDF нет текста — похоже, это скан или фотография. Вставьте текст резюме вручную.",
  docx: "В файле почти нет текста. Проверьте файл или вставьте текст резюме вручную.",
  txt: "В файле почти нет текста. Проверьте файл или вставьте текст резюме вручную.",
};

export function capResumeText(text: string): { text: string; truncated: boolean } {
  return { text: text.slice(0, MAX_RESUME_CHARS), truncated: text.length > MAX_RESUME_CHARS };
}
