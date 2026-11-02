"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useT } from "@/i18n/client";

interface RecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}

interface RecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<RecognitionResultLike>;
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { readonly error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionConstructor = new () => RecognitionLike;

/** The browser's speech recognition, if it exposes one. Safari and Chromium do; some browsers do not. */
function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const candidate = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};

/**
 * Field dictation. The words the grower speaks are added to the note and kept as the original transcript.
 * If dictation is unavailable or fails, the typed note remains, and saving is never blocked.
 * Nothing is sent to an AI service. The browser's own speech recognition does the work.
 */
export function VoiceNote({
  onTranscript,
  onCommand,
  disabled,
}: {
  readonly onTranscript: (transcript: string) => void;
  readonly onCommand: (transcript: string) => void;
  readonly disabled: boolean;
}) {
  const t = useT();
  const supported = useSyncExternalStore(
    noSubscribe,
    () => recognitionConstructor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const recognition = useRef<RecognitionLike | null>(null);

  function start() {
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    const instance = new Constructor();
    instance.lang = typeof navigator !== "undefined" ? navigator.language : "en";
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = (event) => {
      const result = event.results[event.resultIndex];
      const transcript = result?.[0]?.transcript?.trim() ?? "";
      if (result?.isFinal && transcript) {
        onTranscript(transcript);
        onCommand(transcript);
      }
    };
    instance.onerror = () => {
      setListening(false);
      setMessage(t("capture.voice.stopped"));
    };
    instance.onend = () => setListening(false);
    recognition.current = instance;
    setMessage(null);
    setListening(true);
    try {
      instance.start();
    } catch {
      setListening(false);
      setMessage(t("capture.voice.unavailable"));
    }
  }

  function stop() {
    recognition.current?.stop();
    setListening(false);
  }

  if (!supported) {
    return <p className="text-sm text-text-muted">{t("capture.voice.unsupported")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={disabled}
        aria-pressed={listening}
        className="inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-background px-4 text-base font-medium text-text-brand"
      >
        {listening ? t("capture.voice.stop") : t("capture.voice.dictate")}
      </button>
      {listening ? (
        <p role="status" className="text-sm text-text-muted">
          {t("capture.voice.listening")}
        </p>
      ) : null}
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
