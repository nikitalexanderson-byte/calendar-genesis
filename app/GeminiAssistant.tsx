"use client";

import { useEffect, useRef, useState } from "react";
import {
  requestGeminiPlan,
  type GeminiAssistantContext,
  type GeminiPlan,
} from "./cloud-sync";
import type { Language } from "./i18n";

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_RECORDING_MS = 60_000;

type GeminiAssistantProps = {
  language: Language;
  context: GeminiAssistantContext;
  onApply: (plan: GeminiPlan) => Promise<string>;
  onClose: () => void;
};

function preferredAudioMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать запись."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const separator = result.indexOf(",");
      if (separator < 0) {
        reject(new Error("Не удалось подготовить запись."));
        return;
      }
      resolve(result.slice(separator + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function assistantError(error: unknown, language: Language) {
  const message = error instanceof Error ? error.message : "";
  if (message === "GEMINI_NOT_CONFIGURED") {
    return language === "en"
      ? "Gemini is not configured on the GENESIS server yet."
      : "Gemini пока не настроен на сервере GENESIS.";
  }
  if (message === "GEMINI_RATE_LIMIT") {
    return language === "en"
      ? "Too many requests. Please try again in a few minutes."
      : "Слишком много запросов. Повторите через несколько минут.";
  }
  return message || (language === "en" ? "Gemini could not prepare the plan." : "Gemini не смог подготовить план.");
}

export function GeminiAssistant({ language, context, onApply, onClose }: GeminiAssistantProps) {
  const [command, setCommand] = useState("");
  const [audio, setAudio] = useState<{ data: string; mimeType: string; bytes: number } | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<GeminiPlan | null>(null);
  const [model, setModel] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
  };

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current);
  }, []);

  const startRecording = async () => {
    setError("");
    setMessage("");
    setPlan(null);
    setAudio(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(language === "en" ? "Voice recording is not supported in this browser." : "Этот браузер не поддерживает запись голоса.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError(language === "en" ? "Voice recording failed." : "Не удалось записать голос.");
        setRecording(false);
        stopStream();
      };
      recorder.onstop = () => {
        const recording = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        setRecording(false);
        stopStream();
        if (!recording.size) {
          setError(language === "en" ? "The voice recording is empty." : "Запись голоса оказалась пустой.");
          return;
        }
        if (recording.size > MAX_AUDIO_BYTES) {
          setError(language === "en" ? "The recording is larger than 4 MB." : "Запись превышает 4 МБ.");
          return;
        }
        void blobToBase64(recording)
          .then((data) => setAudio({ data, mimeType: recording.type || "audio/webm", bytes: recording.size }))
          .catch((readError) => setError(assistantError(readError, language)));
      };
      recorder.start(250);
      setRecording(true);
      stopTimerRef.current = window.setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, MAX_RECORDING_MS);
    } catch (recordError) {
      stopStream();
      setError(recordError instanceof DOMException && recordError.name === "NotAllowedError"
        ? (language === "en" ? "Allow microphone access to record a command." : "Разрешите доступ к микрофону, чтобы записать команду.")
        : (language === "en" ? "Could not access the microphone." : "Не удалось получить доступ к микрофону."));
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  const analyze = async () => {
    if (recording) {
      setError(language === "en" ? "Stop the recording before analysis." : "Остановите запись перед анализом.");
      return;
    }
    if (!command.trim() && !audio) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await requestGeminiPlan({
        command: command.trim(),
        audio: audio ? { data: audio.data, mimeType: audio.mimeType } : null,
        context,
      });
      setPlan(result.plan);
      setModel(result.model);
    } catch (requestError) {
      setError(assistantError(requestError, language));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!plan) return;
    setBusy(true);
    setError("");
    try {
      setMessage(await onApply(plan));
      setPlan(null);
      setCommand("");
      setAudio(null);
    } catch (applyError) {
      setError(assistantError(applyError, language));
    } finally {
      setBusy(false);
    }
  };

  const actionCount = plan ? plan.projects.length + plan.taskLists.length + plan.tasks.length : 0;

  return (
    <div className="modal-backdrop gemini-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target && !busy) onClose();
    }}>
      <section className="gemini-assistant" role="dialog" aria-modal="true" aria-labelledby="gemini-assistant-title">
        <header>
          <div className="gemini-mark" aria-hidden="true">✦</div>
          <div>
            <span className="eyebrow">Gemini · голосовой помощник</span>
            <h2 id="gemini-assistant-title">Создание задач голосом</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Закрыть Gemini">×</button>
        </header>

        <p className="gemini-intro">Продиктуйте или напишите, какие проекты, списки Google Tasks и задачи нужно создать. Перед сохранением Gemini покажет полный план.</p>

        <div className={`gemini-recorder${recording ? " recording" : ""}`}>
          <button type="button" className="gemini-record-button" onClick={() => void (recording ? stopRecording() : startRecording())} disabled={busy}>
            <span aria-hidden="true">{recording ? "■" : "●"}</span>
            {recording ? "Остановить запись" : audio ? "Записать заново" : "Записать голосовую команду"}
          </button>
          <small>{recording
            ? "Идёт запись · максимум 60 секунд"
            : audio
              ? `Запись готова · ${Math.max(1, Math.round(audio.bytes / 1024))} КБ`
              : "Микрофон включается только после нажатия"}</small>
        </div>

        <label className="gemini-command-field">
          <span>Команда текстом</span>
          <textarea
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="Например: создай проект «Запуск курса» и пять задач к следующей пятнице"
            rows={4}
            maxLength={4000}
            disabled={busy}
          />
        </label>

        <p className="gemini-privacy"><span aria-hidden="true">◇</span> Запись, текст команды, названия элементов и адреса подключённых аккаунтов отправляются в Google Gemini только после нажатия «Подготовить план». GENESIS их не сохраняет.</p>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {message ? <p className="form-success" role="status">{message}</p> : null}

        {!plan ? (
          <button type="button" className="gemini-primary" onClick={() => void analyze()} disabled={busy || recording || (!command.trim() && !audio)}>
            {busy ? "Gemini составляет план…" : "Подготовить план"}
          </button>
        ) : (
          <div className="gemini-plan">
            <div className="gemini-plan-heading">
              <div>
                <span className="eyebrow">Проверка перед созданием</span>
                <h3 data-no-translate>{plan.summary || (language === "en" ? "Gemini prepared a plan" : "Gemini подготовил план")}</h3>
              </div>
              {model ? <small>{model}</small> : null}
            </div>
            {plan.request ? <p className="gemini-understood"><strong>Распознано:</strong> <span data-no-translate>{plan.request}</span></p> : null}

            {plan.projects.length ? (
              <section>
                <h4>Проекты · {plan.projects.length}</h4>
                {plan.projects.map((project, index) => (
                  <article key={`project-${index}-${project.title}`}>
                    <strong data-no-translate>{project.title}</strong>
                    {project.description ? <p data-no-translate>{project.description}</p> : null}
                    <small data-no-translate>{[project.category, project.parentProject, ...project.tags.map((tag) => `#${tag}`)].filter(Boolean).join(" · ")}</small>
                  </article>
                ))}
              </section>
            ) : null}

            {plan.taskLists.length ? (
              <section>
                <h4>Списки Google Tasks · {plan.taskLists.length}</h4>
                {plan.taskLists.map((taskList, index) => (
                  <article key={`list-${index}-${taskList.title}`}>
                    <strong data-no-translate>{taskList.title}</strong>
                    <small data-no-translate>{[taskList.project, taskList.accountEmail].filter(Boolean).join(" · ")}</small>
                  </article>
                ))}
              </section>
            ) : null}

            {plan.tasks.length ? (
              <section>
                <h4>Задачи · {plan.tasks.length}</h4>
                {plan.tasks.map((task, index) => (
                  <article key={`task-${index}-${task.title}`}>
                    <strong data-no-translate>{task.title}</strong>
                    {task.description ? <p data-no-translate>{task.description}</p> : null}
                    <small data-no-translate>{[`${task.startDate} — ${task.dueDate}`, task.time, task.project, task.taskList, `P${task.priority}`].filter(Boolean).join(" · ")}</small>
                  </article>
                ))}
              </section>
            ) : null}

            {!actionCount ? <p className="gemini-empty">В команде не найдено действий для создания. Уточните формулировку и попробуйте ещё раз.</p> : null}

            <div className="gemini-plan-actions">
              <button type="button" onClick={() => setPlan(null)} disabled={busy}>Изменить команду</button>
              <button type="button" className="gemini-primary" onClick={() => void apply()} disabled={busy || !actionCount}>
                {busy ? "Создание…" : `Создать всё · ${actionCount}`}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
