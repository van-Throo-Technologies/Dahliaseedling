"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { FormMessage } from "@/design-system/components/form-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";
import { prepareUploadsAction, captureAction } from "@/modules/capture/actions";
import { CAPTURE_LIMITS } from "@/modules/capture/limits";
import { matchVoiceCommand } from "@/modules/capture/voice";
import { validateSelection } from "@/modules/capture/validation";
import { MediaPreview } from "./media-preview";
import { VoiceNote } from "./voice-note";

export interface HeldSeedlingChoice {
  readonly id: string;
  readonly label: string;
}

interface Chosen {
  readonly key: string;
  readonly file: File;
  readonly url: string;
}

type Mode = "new" | "existing" | "identifier";
type Phase = "idle" | "uploading" | "saving";

/**
 * The fast path: take or choose media, then save privately. New seedling is the default, so a grower who
 * only takes a photo needs one more tap. Notes, voice and time are optional and never block saving.
 * Uploads go straight to private storage, one file at a time. Retrying resumes the files not yet uploaded.
 */
export function CaptureFlow({ seedlings }: { readonly seedlings: readonly HeldSeedlingChoice[] }) {
  const [state, formAction] = useActionState(captureAction, IDLE_FORM_STATE);
  const [chosen, setChosen] = useState<Chosen[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("new");
  const [seedlingId, setSeedlingId] = useState(seedlings[0]?.id ?? "");
  const [identifier, setIdentifier] = useState("");
  const [note, setNote] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [observedAt, setObservedAt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadedPaths = useRef<Map<string, string>>(new Map());
  const pathsForAttempt = useRef<string[] | null>(null);
  const urls = useRef<string[]>([]);

  // Revoke preview URLs when the page goes away. Nothing else holds them.
  useEffect(() => {
    const current = urls.current;
    return () => current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    const next: Chosen[] = [...chosen];
    for (const file of incoming) {
      if (next.length >= CAPTURE_LIMITS.maxFilesPerCapture) break;
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      next.push({ key: `${file.name}-${file.size}-${crypto.randomUUID()}`, file, url });
    }
    const check = validateSelection(next.map((item) => item.file));
    setProblem(check.ok ? null : (Object.values(check.fieldErrors)[0] ?? null));
    setChosen(next);
    setUploadError(null);
    pathsForAttempt.current = null;
    uploadedPaths.current = new Map();
  }

  function removeFile(key: string) {
    const removed = chosen.find((item) => item.key === key);
    if (removed) URL.revokeObjectURL(removed.url);
    const next = chosen.filter((item) => item.key !== key);
    setChosen(next);
    const check = validateSelection(next.map((item) => item.file));
    setProblem(
      next.length === 0 || check.ok ? null : (Object.values(check.fieldErrors)[0] ?? null),
    );
    pathsForAttempt.current = null;
    uploadedPaths.current = new Map();
  }

  function handleVoiceCommand(transcript: string) {
    if (matchVoiceCommand(transcript) === "new_seedling") setMode("new");
  }

  async function save() {
    const check = validateSelection(chosen.map((item) => item.file));
    if (!check.ok) {
      setProblem(Object.values(check.fieldErrors)[0] ?? null);
      return;
    }
    setUploadError(null);
    setPhase("uploading");

    try {
      if (!pathsForAttempt.current) {
        const prepared = await prepareUploadsAction(chosen.map((item) => item.file.type));
        if ("error" in prepared) throw new Error(prepared.error);
        pathsForAttempt.current = prepared.paths;
      }
      const paths = pathsForAttempt.current;
      setProgress({ done: uploadedPaths.current.size, total: chosen.length });

      const browser = createSupabaseBrowserClient();
      for (let index = 0; index < chosen.length; index += 1) {
        const item = chosen[index];
        const path = paths[index];
        if (!item || !path || uploadedPaths.current.has(item.key)) continue;
        const { error } = await browser.storage.from("private-media").upload(path, item.file, {
          contentType: item.file.type,
          upsert: false,
        });
        // A retry after a dropped response finds the file already there. That is the same upload.
        if (error && !/already exists|duplicate/i.test(error.message)) {
          throw new Error(`The upload of ${item.file.name} did not finish.`);
        }
        uploadedPaths.current.set(item.key, path);
        setProgress({ done: uploadedPaths.current.size, total: chosen.length });
      }
    } catch (error) {
      setPhase("idle");
      setUploadError(
        error instanceof Error
          ? `${error.message} Your photos are still here, so try again.`
          : "The upload did not finish. Try again.",
      );
      return;
    }

    setPhase("saving");
    const form = new FormData();
    form.set("mode", mode);
    form.set("seedlingId", seedlingId);
    form.set("identifier", identifier);
    form.set("note", note);
    form.set("voiceTranscript", voiceTranscript);
    form.set("observedAt", observedAt ? new Date(observedAt).toISOString() : "");
    form.set("paths", JSON.stringify(pathsForAttempt.current));
    startTransition(() => {
      formAction(form);
    });
  }

  const busy = phase !== "idle";
  const saveLabel =
    phase === "uploading"
      ? "Uploading…"
      : phase === "saving"
        ? "Saving privately…"
        : "Save privately";
  const message = state.status === "error" ? state.message : null;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="media-title" className="flex flex-col gap-4">
        <h1 id="media-title" className="font-display text-3xl text-text-brand">
          Capture
        </h1>
        <p className="text-base text-text-muted">
          Take a photo, and save it privately. You can add details later.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label
            htmlFor="capture-photo"
            className="flex min-h-14 cursor-pointer items-center justify-center rounded-control bg-primary px-4 py-3 text-base font-medium text-on-primary focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
          >
            Take photo
            <input
              id="capture-photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => addFiles(event.target.files)}
              disabled={busy}
            />
          </label>
          <label
            htmlFor="capture-video"
            className="flex min-h-14 cursor-pointer items-center justify-center rounded-control border border-border bg-surface px-4 py-3 text-base font-medium text-text-brand focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
          >
            Record video
            <input
              id="capture-video"
              type="file"
              accept="video/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => addFiles(event.target.files)}
              disabled={busy}
            />
          </label>
          <label
            htmlFor="capture-library"
            className="flex min-h-14 cursor-pointer items-center justify-center rounded-control border border-border bg-surface px-4 py-3 text-base font-medium text-text-brand focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
          >
            Choose a file
            <input
              id="capture-library"
              type="file"
              accept="image/*,video/*"
              multiple
              className="sr-only"
              onChange={(event) => addFiles(event.target.files)}
              disabled={busy}
            />
          </label>
        </div>

        {problem ? <FormMessage tone="error">{problem}</FormMessage> : null}
        {chosen.length > 0 ? (
          <ul aria-label="Files to save" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {chosen.map((item) => (
              <li key={item.key} className="flex flex-col gap-2">
                <MediaPreview src={item.url} mime={item.file.type} label={item.file.name} />
                <button
                  type="button"
                  onClick={() => removeFile(item.key)}
                  disabled={busy}
                  className="min-h-11 rounded-control text-sm font-medium text-text-brand underline underline-offset-4"
                >
                  Remove {item.file.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-surface border border-border bg-surface p-4 text-base text-text-muted">
            Nothing chosen yet. Take a photo, record a short video, or choose one you already have.
          </p>
        )}
      </section>

      <form className="flex flex-col gap-6" noValidate onSubmit={(event) => event.preventDefault()}>
        <fieldset className="flex flex-col gap-3" disabled={busy}>
          <legend className="text-lg font-medium text-text">Where does it go?</legend>
          <label className="flex min-h-11 items-center gap-3 rounded-control border border-border bg-surface px-4 py-3 text-base text-text">
            <input
              type="radio"
              name="destination"
              checked={mode === "new"}
              onChange={() => setMode("new")}
              className="h-5 w-5"
            />
            <span>
              <span className="font-medium">New seedling</span>
              <span className="block text-sm text-text-muted">
                Creates a seedling with its own number. Nothing else is needed.
              </span>
            </span>
          </label>
          {seedlings.length > 0 ? (
            <label className="flex min-h-11 items-start gap-3 rounded-control border border-border bg-surface px-4 py-3 text-base text-text">
              <input
                type="radio"
                name="destination"
                checked={mode === "existing"}
                onChange={() => setMode("existing")}
                className="mt-1 h-5 w-5"
              />
              <span className="flex flex-1 flex-col gap-2">
                <span className="font-medium">One of my seedlings</span>
                {mode === "existing" ? (
                  <select
                    aria-label="Choose a seedling"
                    value={seedlingId}
                    onChange={(event) => setSeedlingId(event.target.value)}
                    className="min-h-11 w-full rounded-control border border-border bg-background px-3 text-base text-text"
                  >
                    {seedlings.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </span>
            </label>
          ) : null}
          <label className="flex min-h-11 items-start gap-3 rounded-control border border-border bg-surface px-4 py-3 text-base text-text">
            <input
              type="radio"
              name="destination"
              checked={mode === "identifier"}
              onChange={() => setMode("identifier")}
              className="mt-1 h-5 w-5"
            />
            <span className="flex flex-1 flex-col gap-2">
              <span className="font-medium">I know its identifier</span>
              {mode === "identifier" ? (
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="JV-26-001 or #12"
                  autoComplete="off"
                  aria-label="Seedling identifier"
                  className="min-h-11 w-full rounded-control border border-border bg-background px-3 text-base text-text"
                />
              ) : null}
            </span>
          </label>
          {state.status === "error" && state.fieldErrors.identifier ? (
            <p className="text-sm font-medium text-destructive">{state.fieldErrors.identifier}</p>
          ) : null}
        </fieldset>

        <details className="rounded-surface border border-border bg-surface p-4">
          <summary className="min-h-11 cursor-pointer text-base font-medium text-text-brand">
            Add a note (optional)
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            <VoiceNote
              onTranscript={(transcript) => {
                setVoiceTranscript((current) =>
                  current ? `${current} ${transcript}` : transcript,
                );
                setNote((current) => (current ? `${current} ${transcript}` : transcript));
              }}
              onCommand={handleVoiceCommand}
              disabled={busy}
            />
            <label htmlFor="capture-note" className="text-base font-medium text-text">
              Note
            </label>
            <textarea
              id="capture-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={CAPTURE_LIMITS.noteMaxLength}
              rows={3}
              disabled={busy}
              className="w-full rounded-control border border-border bg-background px-3 py-2 text-base text-text"
            />
          </div>
        </details>

        <details className="rounded-surface border border-border bg-surface p-4">
          <summary className="min-h-11 cursor-pointer text-base font-medium text-text-brand">
            Adjust the time (optional)
          </summary>
          <div className="mt-4 flex flex-col gap-2">
            <label htmlFor="capture-observed" className="text-base font-medium text-text">
              When was this observed?
            </label>
            <input
              id="capture-observed"
              type="datetime-local"
              value={observedAt}
              onChange={(event) => setObservedAt(event.target.value)}
              disabled={busy}
              className="min-h-11 w-full rounded-control border border-border bg-background px-3 text-base text-text"
            />
            <p className="text-sm text-text-muted">Leave it empty to use the time you save.</p>
          </div>
        </details>

        {uploadError ? <FormMessage tone="error">{uploadError}</FormMessage> : null}
        {message && !uploadError ? <FormMessage tone="error">{message}</FormMessage> : null}
        <p role="status" aria-live="polite" className="text-base text-text-muted">
          {phase === "uploading"
            ? `Uploading ${progress.done + 1} of ${progress.total}…`
            : phase === "saving"
              ? "Saving privately…"
              : ""}
        </p>

        <button
          type="button"
          onClick={save}
          disabled={busy || chosen.length === 0 || problem !== null}
          className="inline-flex min-h-14 w-full items-center justify-center rounded-control bg-primary px-4 py-3 text-lg font-medium text-on-primary disabled:cursor-wait disabled:opacity-70"
        >
          {saveLabel}
        </button>
        <p className="text-sm text-text-muted">
          Saved privately means only you can see it. It is not shared, and nothing is published.
        </p>
        <p className="text-sm">
          <Link href="/profile" className="text-text-brand underline underline-offset-4">
            Back to your profile
          </Link>
        </p>
      </form>
    </div>
  );
}
