"use client";

import { useId, useRef, useState } from "react";
import { addResume } from "@/lib/candidate-actions";

const SOURCES = ["hh.kz", "Enbek.kz", "LinkedIn", "Отклик на вакансию", "Почта или мессенджер", "Рекомендация", "Другое"];

/** Ручное добавление резюме в LIVE: файл PDF/DOCX/TXT или вставленный текст. */
export function AddResumeForm({ sessionId }: { sessionId: string }) {
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [source, setSource] = useState(SOURCES[0]!);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = !busy && (file !== null || text.trim().length >= 40);

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    const problem = await addResume(sessionId, { text, file, name, sourceLabel: source, url });
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    setFile(null);
    setText("");
    setName("");
    setUrl("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form
      aria-label="Добавление резюме"
      className="rounded-card border border-line bg-surface p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h3 className="text-lg font-medium">Добавить резюме</h3>
      <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted">
        Добавляйте резюме, полученные законно: от самого кандидата или на площадке под вашей учётной записью. Резюме хранится
        только в этом браузере.
      </p>

      <div className="mt-4 grid gap-4">
        <div>
          <label className="label" htmlFor={`${uid}-file`}>Файл резюме: PDF, DOCX или TXT, до 5 МБ</label>
          <input
            ref={fileRef}
            id={`${uid}-file`}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="block w-full text-[0.9375rem] text-ink-soft file:mr-3 file:min-h-11 file:rounded-field file:border file:border-line-strong file:bg-surface file:px-4 file:text-[0.9375rem] file:font-medium file:text-ink"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        {!file ? (
          <div>
            <label className="label" htmlFor={`${uid}-text`}>Или вставьте текст резюме</label>
            <textarea
              id={`${uid}-text`}
              className="field leading-relaxed"
              rows={5}
              maxLength={30000}
              value={text}
              placeholder="Скопируйте сюда текст резюме целиком"
              onChange={(event) => setText(event.target.value)}
            />
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor={`${uid}-name`}>Имя кандидата, необязательно</label>
            <input id={`${uid}-name`} className="field" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor={`${uid}-source`}>Откуда резюме</label>
            <select id={`${uid}-source`} className="field" value={source} onChange={(event) => setSource(event.target.value)}>
              {SOURCES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-url`}>Ссылка на оригинальный профиль, необязательно</label>
          <input
            id={`${uid}-url`}
            className="field"
            type="url"
            inputMode="url"
            value={url}
            maxLength={600}
            placeholder="https://"
            onChange={(event) => setUrl(event.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-field border border-danger/30 bg-danger-wash px-4 py-3 leading-relaxed text-ink">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn btn-primary mt-5 w-full sm:w-auto" disabled={!ready}>
        {busy ? "Читаю резюме…" : "Добавить и проанализировать"}
      </button>
    </form>
  );
}
