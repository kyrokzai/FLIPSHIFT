import { json, rateGuard } from "@/server/http";
import { MAX_FILE_BYTES, ResumeFileError, extractResumeText } from "@/server/resume-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const guard = rateGuard(Number(process.env.RESUME_RATE_LIMIT_PER_MINUTE) > 0 ? Number(process.env.RESUME_RATE_LIMIT_PER_MINUTE) : 30);

/**
 * Принимает файл резюме (PDF, DOCX, TXT) и возвращает его текст.
 * Файл не сохраняется и не попадает в журналы.
 */
export async function POST(request: Request) {
  const limited = guard(request);
  if (limited) return limited;

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_FILE_BYTES + 64 * 1024) return json({ error: "Файл больше 5 МБ. Загрузите резюме поменьше или вставьте текст." }, 413);

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    if (value instanceof File) file = value;
  } catch {
    return json({ error: "Не удалось принять файл. Повторите загрузку." }, 400);
  }
  if (!file) return json({ error: "Выберите файл резюме." }, 400);

  try {
    const result = await extractResumeText(file.name, new Uint8Array(await file.arrayBuffer()));
    return json(result);
  } catch (error) {
    if (error instanceof ResumeFileError) return json({ error: error.message }, error.status);
    console.error("[resume] Сбой при чтении файла");
    return json({ error: "Не удалось прочитать файл. Вставьте текст резюме вручную." }, 500);
  }
}
