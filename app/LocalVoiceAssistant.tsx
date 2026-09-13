"use client";

import { useEffect, useRef, useState } from "react";
import type { GeminiAssistantContext, GeminiPlan } from "./cloud-sync";
import type { Language } from "./i18n";
import { createLocalVoicePlan } from "./local-voice-plan";

type SpeechResultEvent = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
};

type SpeechErrorEvent = Event & { error: string };

type SpeechRecognizer = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognizerConstructor = {
  new(): SpeechRecognizer;
  available?: (options: { langs: string[]; processLocally: boolean }) => Promise<"available" | "downloadable" | "downloading" | "unavailable">;
  install?: (options: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
};

type LocalVoiceAssistantProps = {
  language: Language;
  context: GeminiAssistantContext;
  onApply: (plan: GeminiPlan) => Promise<string>;
  onClose: () => void;
};

function speechRecognizerConstructor() {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognizerConstructor;
    webkitSpeechRecognition?: SpeechRecognizerConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function speechErrorMessage(error: string, language: Language) {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return language === "en" ? "Allow microphone access to dictate a task." : "Разрешите доступ к микрофону, чтобы продиктовать задачу.";
  }
  if (error === "no-speech") {
    return language === "en" ? "No speech was detected. Please try again." : "Речь не распознана. Попробуйте ещё раз.";
  }
  if (error === "audio-capture") {
    return language === "en" ? "The microphone is unavailable." : "Микрофон недоступен.";
  }
  if (error === "language-not-supported") {
    return language === "en" ? "This device has no speech pack for the selected language." : "На устройстве нет голосового пакета для выбранного языка.";
  }
  return language === "en" ? "Speech recognition could not start. You can type the command instead." : "Не удалось запустить распознавание речи. Команду можно написать вручную.";
}

export function LocalVoiceAssistant({ language, context, onApply, onClose }: LocalVoiceAssistantProps) {
  const [command, setCommand] = useState("");
  const [interim, setInterim] = useState("");
  const [starting, setStarting] = useState(false);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<GeminiPlan | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recognitionMode, setRecognitionMode] = useState<"device" | "browser" | "text">("text");
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const activeRef = useRef(true);

  useEffect(() => () => {
    activeRef.current = false;
    recognizerRef.current?.abort();
  }, []);

  const startListening = async () => {
    if (starting) return;
    setStarting(true);
    setError("");
    setMessage("");
    setPlan(null);
    setInterim("");
    const Constructor = speechRecognizerConstructor();
    if (!Constructor) {
      setStarting(false);
      setRecognitionMode("text");
      setError(language === "en" ? "Voice input is not supported in this browser. Type the command below." : "Этот браузер не поддерживает голосовой ввод. Напишите команду ниже.");
      return;
    }

    const locale = language === "en" ? "en-US" : "ru-RU";
    let useDeviceRecognition = false;
    try {
      if (Constructor.available) {
        try {
          const availability = await Constructor.available({ langs: [locale], processLocally: true });
          if (availability === "available") {
            useDeviceRecognition = true;
          } else if ((availability === "downloadable" || availability === "downloading") && Constructor.install) {
            setMessage(language === "en" ? "Installing the on-device speech pack…" : "Устанавливается голосовой пакет на устройство…");
            useDeviceRecognition = await Constructor.install({ langs: [locale], processLocally: true });
            setMessage(useDeviceRecognition
              ? (language === "en" ? "The speech pack is ready." : "Голосовой пакет готов.")
              : (language === "en" ? "Using the browser speech service." : "Используется голосовой сервис браузера."));
          }
        } catch {
          useDeviceRecognition = false;
        }
      }
      if (!activeRef.current) return;

      const recognizer = new Constructor();
      recognizer.lang = locale;
      recognizer.continuous = false;
      recognizer.interimResults = true;
      recognizer.maxAlternatives = 1;
      if (useDeviceRecognition && "processLocally" in recognizer) recognizer.processLocally = true;
      recognizer.onstart = () => {
        setStarting(false);
        setListening(true);
        setRecognitionMode(useDeviceRecognition ? "device" : "browser");
      };
      recognizer.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const transcript = event.results[index][0]?.transcript ?? "";
          if (event.results[index].isFinal) finalText += transcript;
          else interimText += transcript;
        }
        if (finalText.trim()) setCommand((current) => `${current.trim()} ${finalText.trim()}`.trim());
        setInterim(interimText.trim());
      };
      recognizer.onerror = (event) => {
        setStarting(false);
        setListening(false);
        setInterim("");
        setError(speechErrorMessage(event.error, language));
      };
      recognizer.onend = () => {
        setStarting(false);
        setListening(false);
        setInterim("");
      };
      recognizerRef.current = recognizer;
      recognizer.start();
    } catch (recognitionError) {
      setStarting(false);
      setListening(false);
      setInterim("");
      setRecognitionMode("text");
      setError(recognitionError instanceof DOMException && recognitionError.name === "NotAllowedError"
        ? speechErrorMessage("not-allowed", language)
        : speechErrorMessage("start-failed", language));
    }
  };

  const stopListening = () => recognizerRef.current?.stop();

  const preparePlan = () => {
    setError("");
    setMessage("");
    try {
      setPlan(createLocalVoicePlan(command, context));
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : (language === "en" ? "Could not understand the command." : "Не удалось разобрать команду."));
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
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : (language === "en" ? "Could not create the task." : "Не удалось создать задачу."));
    } finally {
      setBusy(false);
    }
  };

  const actionCount = plan?.tasks.length ?? 0;
  const labels = language === "en" ? {
    eyebrow: "GENESIS Voice · free assistant",
    title: "Create tasks by voice",
    close: "Close voice assistant",
    intro: "Dictate a task, date and time. The command is parsed in this app without an AI API key. Separate several tasks with a semicolon.",
    listen: "Dictate a task",
    stop: "Stop listening",
    listening: "Listening… Speak naturally",
    starting: "Preparing the microphone…",
    idle: "Voice recognition runs on your device when available",
    textLabel: "Command",
    placeholder: "For example: create a task call Alex tomorrow at 18:30 #calls",
    privacy: "GENESIS does not send or store an audio recording. Speech-to-text is handled by your device or browser; task parsing happens locally in the app.",
    prepare: "Prepare preview",
    preview: "Check before creating",
    understood: "Recognized:",
    tasks: "Tasks",
    edit: "Edit command",
    create: "Create",
    creating: "Creating…",
    local: "on device",
    browser: "browser speech",
    text: "text mode",
  } : {
    eyebrow: "GENESIS Voice · бесплатный помощник",
    title: "Создание задач голосом",
    close: "Закрыть голосовой помощник",
    intro: "Продиктуйте задачу, дату и время. Команда разбирается в приложении без ключа AI API. Несколько задач разделяйте точкой с запятой.",
    listen: "Продиктовать задачу",
    stop: "Остановить",
    listening: "Слушаю… Говорите естественно",
    starting: "Подготовка микрофона…",
    idle: "По возможности речь распознаётся прямо на устройстве",
    textLabel: "Команда",
    placeholder: "Например: создай задачу позвонить врачу завтра в 18:30 #звонки",
    privacy: "GENESIS не отправляет и не хранит аудиозапись. Речь преобразует в текст устройство или браузер; сама команда разбирается локально в приложении.",
    prepare: "Подготовить план",
    preview: "Проверка перед созданием",
    understood: "Распознано:",
    tasks: "Задачи",
    edit: "Изменить команду",
    create: "Создать",
    creating: "Создание…",
    local: "на устройстве",
    browser: "голосовой сервис браузера",
    text: "текстовый режим",
  };

  return (
    <div className="modal-backdrop gemini-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target && !busy) onClose();
    }}>
      <section className="gemini-assistant local-voice-assistant" role="dialog" aria-modal="true" aria-labelledby="local-voice-assistant-title">
        <header>
          <div className="gemini-mark voice-mark" aria-hidden="true">●</div>
          <div>
            <span className="eyebrow">{labels.eyebrow}</span>
            <h2 id="local-voice-assistant-title">{labels.title}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label={labels.close}>×</button>
        </header>

        <p className="gemini-intro">{labels.intro}</p>

        <div className={`gemini-recorder${listening ? " recording" : ""}`}>
          <button type="button" className="gemini-record-button" onClick={() => void (listening ? stopListening() : startListening())} disabled={busy || starting}>
            <span aria-hidden="true">{listening ? "■" : "●"}</span>
            {listening ? labels.stop : labels.listen}
          </button>
          <small>{starting ? labels.starting : listening ? labels.listening : labels.idle} · {labels[recognitionMode === "device" ? "local" : recognitionMode]}</small>
        </div>

        <label className="gemini-command-field">
          <span>{labels.textLabel}</span>
          <textarea
            value={interim ? `${command}${command ? " " : ""}${interim}` : command}
            onChange={(event) => {
              setCommand(event.target.value);
              setInterim("");
              setPlan(null);
            }}
            placeholder={labels.placeholder}
            rows={4}
            maxLength={4000}
            disabled={busy || starting || listening}
          />
        </label>

        <p className="gemini-privacy"><span aria-hidden="true">◇</span> {labels.privacy}</p>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {message ? <p className="form-success" role="status">{message}</p> : null}

        {!plan ? (
          <button type="button" className="gemini-primary" onClick={preparePlan} disabled={busy || starting || listening || !command.trim()}>
            {labels.prepare}
          </button>
        ) : (
          <div className="gemini-plan">
            <div className="gemini-plan-heading">
              <div>
                <span className="eyebrow">{labels.preview}</span>
                <h3 data-no-translate>{plan.summary}</h3>
              </div>
              <small>{labels[recognitionMode === "device" ? "local" : recognitionMode]}</small>
            </div>
            <p className="gemini-understood"><strong>{labels.understood}</strong> <span data-no-translate>{plan.request}</span></p>
            <section>
              <h4>{labels.tasks} · {plan.tasks.length}</h4>
              {plan.tasks.map((task, index) => (
                <article key={`${index}-${task.title}-${task.startDate}`}>
                  <strong data-no-translate>{task.title}</strong>
                  <small data-no-translate>{[
                    task.startDate,
                    task.time,
                    task.project,
                    task.taskList,
                    task.tags.map((tag) => `#${tag}`).join(" "),
                    `P${task.priority}`,
                  ].filter(Boolean).join(" · ")}</small>
                </article>
              ))}
            </section>
            <div className="gemini-plan-actions">
              <button type="button" onClick={() => setPlan(null)} disabled={busy}>{labels.edit}</button>
              <button type="button" className="gemini-primary" onClick={() => void apply()} disabled={busy || !actionCount}>
                {busy ? labels.creating : `${labels.create} · ${actionCount}`}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
