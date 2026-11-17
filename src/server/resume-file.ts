import { MIN_RESUME_CHARS, NO_TEXT_MESSAGE, capResumeText, tidyResumeText } from "@/domain/candidate/resume-text";
import type { ExtractResponse } from "@/domain/candidate/schema";

/**
 * Извлечение текста из файла резюме. Файл обрабатывается в памяти и нигде
 * не сохраняется: сервер возвращает текст и забывает о нём.
 */

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export class ResumeFileError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ResumeFileError";
  }
}

function detectFormat(name: string, bytes: Uint8Array): ExtractResponse["format"] {
  const extension = name.toLowerCase().split(".").pop() ?? "";
  const magic = String.fromCharCode(...bytes.subarray(0, 5));
  if (magic.startsWith("%PDF")) return "pdf";
  if (magic.startsWith("PK") && (extension === "docx" || extension === "")) return "docx";
  if (extension === "pdf") return "pdf";
  if (extension === "docx") return "docx";
  if (extension === "txt" || extension === "md") return "txt";
  if (extension === "doc" || extension === "rtf" || extension === "odt" || extension === "pages") {
    throw new ResumeFileError(`Формат .${extension} не поддерживается. Сохраните резюме как PDF или DOCX либо вставьте текст.`, 415);
  }
  throw new ResumeFileError("Поддерживаются файлы PDF, DOCX и TXT. Либо вставьте текст резюме.", 415);
}

export async function extractResumeText(name: string, bytes: Uint8Array): Promise<ExtractResponse> {
  if (bytes.byteLength === 0) throw new ResumeFileError("Файл пустой.", 400);
  if (bytes.byteLength > MAX_FILE_BYTES) throw new ResumeFileError("Файл больше 5 МБ. Загрузите резюме поменьше или вставьте текст.", 413);

  const format = detectFormat(name, bytes);
  let raw: string;
  try {
    if (format === "pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const document = await getDocumentProxy(new Uint8Array(bytes));
      raw = (await extractText(document, { mergePages: true })).text;
    } else if (format === "docx") {
      const mammoth = await import("mammoth");
      raw = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    } else {
      raw = new TextDecoder("utf-8").decode(bytes);
    }
  } catch {
    throw new ResumeFileError("Не удалось прочитать файл: он повреждён или защищён паролем. Вставьте текст резюме вручную.", 422);
  }

  const text = tidyResumeText(raw);
  if (text.length < MIN_RESUME_CHARS) throw new ResumeFileError(NO_TEXT_MESSAGE[format], 422);
  return { ...capResumeText(text), format };
}
