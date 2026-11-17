"use client";

import { MIN_RESUME_CHARS, NO_TEXT_MESSAGE, capResumeText, formatByName, tidyResumeText } from "@/domain/candidate/resume-text";

/** Файл прочитан, но текста в нём нет: показывать пользователю, на сервер не отправлять. */
export class NoTextError extends Error {}

/**
 * Читает резюме прямо в браузере: файл не покидает устройство работодателя.
 * Возвращает null, если этот браузер не смог разобрать файл, — тогда
 * вызывающий код решает, отправлять ли его на сервер.
 */
export async function extractInBrowser(file: File): Promise<string | null> {
  const format = formatByName(file.name);
  if (!format) return null;

  let raw: string;
  try {
    if (format === "txt") {
      raw = await file.text();
    } else if (format === "docx") {
      const mammoth = await import("mammoth");
      raw = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    } else {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const document = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      raw = (await extractText(document, { mergePages: true })).text;
    }
  } catch {
    return null;
  }

  const text = tidyResumeText(raw);
  if (text.length < MIN_RESUME_CHARS) throw new NoTextError(NO_TEXT_MESSAGE[format]);
  return capResumeText(text).text;
}
