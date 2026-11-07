"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { useT } from "@/i18n/client";
import { translateMsg } from "@/i18n/message";
import { FormMessage } from "@/design-system/components/form-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";
import { prepareUploadsAction, captureAction, composePostAction } from "@/modules/capture/actions";
import { CAPTURE_LIMITS } from "@/modules/capture/limits";
import { matchVoiceCommand, normaliseTranscript, type VoiceCommand } from "@/modules/capture/voice";
import { validateSelection } from "@/modules/capture/validation";
import { effectiveMimeType } from "@/modules/capture/media-type";
import type { Msg } from "@/i18n/message";

/** An upload problem whose message is already translated, so it can be shown as it is. Other errors are not shown raw. */
class UploadProblem extends Error {}
import { MediaPreview } from "./media-preview";
import { VoiceNote } from "./voice-note";

export interface HeldSeedlingChoice {
  readonly id: string;
  readonly label: string;
}

/** url: the address of the preview, or null when the file has none on this device (a HEIC file, until it is saved). */
interface Chosen {
  readonly key: string;
  readonly file: File;
  readonly url: string | null;
}

type Mode = "new" | "existing" | "identifier";
type Phase = "idle" | "uploading" | "saving";

/**
 * The fast path: take or choose media, then save privately. New seedling is the default, so a grower who
 * only takes a photo needs one more tap. Notes, voice and time are optional and never block saving.
 * Uploads go straight to private storage, one file at a time. Retrying resumes the files not yet uploaded.
 */
/**
 * The Capture flow. On the Capture page it stands alone. On the Feed it is embedded, and a grower who starts from a seedling passes that
 * seedling as initialSeedlingId, so it is already chosen and nothing needs to be re-entered.
 */
export function CaptureFlow({
  seedlings,
  initialSeedlingId = null,
  embedded = false,
  composer = false,
}: {
  readonly seedlings: readonly HeldSeedlingChoice[];
  readonly initialSeedlingId?: string | null;
  readonly embedded?: boolean;
  /** The Feed composer: photos only, with an optional caption and an explicit choice to share publicly now. */
  readonly composer?: boolean;
}) {
  const Heading = embedded ? "h2" : "h1";
  const startingSeedling =
    initialSeedlingId !== null && seedlings.some((item) => item.id === initialSeedlingId)
      ? initialSeedlingId
      : null;
  const t = useT();
  const [state, formAction] = useActionState(
    composer ? composePostAction : captureAction,
    IDLE_FORM_STATE,
  );
  const [caption, setCaption] = useState("");
  const [sharePublicly, setSharePublicly] = useState(false);
  const [chosen, setChosen] = useState<Chosen[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(
    startingSeedling || (composer && seedlings.length > 0) ? "existing" : "new",
  );
  const [seedlingSearch, setSeedlingSearch] = useState("");
  const [voiceNotice, setVoiceNotice] = useState<VoiceCommand | null>(null);
  const [seedlingId, setSeedlingId] = useState(startingSeedling ?? seedlings[0]?.id ?? "");
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
      // Every file gets a preview address. The browser shows it if it can; a HEIC file it cannot show gets the save-first explanation.
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      next.push({ key: `${file.name}-${file.size}-${crypto.randomUUID()}`, file, url });
    }
    const check = validateSelection(next.map((item) => item.file));
    setProblem(check.ok ? null : translateProblem(check.fieldErrors));
    setChosen(next);
    setUploadError(null);
    pathsForAttempt.current = null;
    uploadedPaths.current = new Map();
  }

  function removeFile(key: string) {
    const removed = chosen.find((item) => item.key === key);
    if (removed?.url) URL.revokeObjectURL(removed.url);
    const next = chosen.filter((item) => item.key !== key);
    setChosen(next);
    const check = validateSelection(next.map((item) => item.file));
    setProblem(next.length === 0 || check.ok ? null : translateProblem(check.fieldErrors));
    pathsForAttempt.current = null;
    uploadedPaths.current = new Map();
  }

  function translateProblem(fieldErrors: Readonly<Record<string, Msg>>): string | null {
    const first = Object.values(fieldErrors)[0];
    return first ? translateMsg(t, first) : null;
  }

  /**
   * A recognised command only shows its control. "New seedling" selects the New Seedling destination; "Not keeping this one"
   * offers the continuation for the chosen Seedling. Neither changes anything until the grower presses the control.
   */
  function handleVoiceCommand(transcript: string) {
    const command = matchVoiceCommand(transcript);
    if (command === "new_seedling") setMode("new");
    setVoiceNotice(command);
  }

  const searchTerm = normaliseTranscript(seedlingSearch);
  const shownSeedlings = seedlings.filter(
    (item) => searchTerm === "" || normaliseTranscript(item.label).includes(searchTerm),
  );

  async function save() {
    const check = validateSelection(chosen.map((item) => item.file));
    if (!check.ok) {
      setProblem(translateProblem(check.fieldErrors));
      return;
    }
    setUploadError(null);
    setPhase("uploading");

    try {
      if (!pathsForAttempt.current) {
        const prepared = await prepareUploadsAction(
          chosen.map((item) => effectiveMimeType(item.file)),
        );
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
          contentType: effectiveMimeType(item.file),
          upsert: false,
        });
        // A retry after a dropped response finds the file already there. That is the same upload.
        if (error && !/already exists|duplicate/i.test(error.message)) {
          throw new UploadProblem(t("capture.capture.uploadNotFinished", { name: item.file.name }));
        }
        uploadedPaths.current.set(item.key, path);
        setProgress({ done: uploadedPaths.current.size, total: chosen.length });
      }
    } catch (error) {
      setPhase("idle");
      setUploadError(
        error instanceof UploadProblem
          ? `${error.message} ${t("capture.capture.stillHere")}`
          : t("capture.capture.uploadFailed"),
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
    form.set("caption", caption);
    form.set("share", composer && sharePublicly ? "public" : "private");
    startTransition(() => {
      formAction(form);
    });
  }

  const busy = phase !== "idle";
  const saveLabel =
    phase === "uploading"
      ? t("capture.capture.uploadingShort")
      : phase === "saving"
        ? t("capture.capture.savingPrivately")
        : composer && sharePublicly
          ? t("capture.capture.composer.post")
          : t("capture.capture.save");
  const message = state.status === "error" ? state.message : null;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="media-title" className="flex flex-col gap-4">
        <Heading id="media-title" className="font-display text-3xl text-text-brand">
          {t("capture.capture.title")}
        </Heading>
        <p className="text-base text-text-muted">{t("capture.capture.intro")}</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label
            htmlFor="capture-photo"
            className="flex min-h-14 cursor-pointer items-center justify-center rounded-control bg-primary px-4 py-3 text-base font-medium text-on-primary focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
          >
            {t("capture.capture.takePhoto")}
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
          {composer ? null : (
            <label
              htmlFor="capture-video"
              className="flex min-h-14 cursor-pointer items-center justify-center rounded-control border border-border bg-surface px-4 py-3 text-base font-medium text-text-brand focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
            >
              {t("capture.capture.recordVideo")}
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
          )}
          <label
            htmlFor="capture-library"
            className="flex min-h-14 cursor-pointer items-center justify-center rounded-control border border-border bg-surface px-4 py-3 text-base font-medium text-text-brand focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
          >
            {t("capture.capture.chooseFile")}
            <input
              id="capture-library"
              type="file"
              accept={composer ? "image/*" : "image/*,video/*"}
              multiple
              className="sr-only"
              onChange={(event) => addFiles(event.target.files)}
              disabled={busy}
            />
          </label>
        </div>

        {problem ? <FormMessage tone="error">{problem}</FormMessage> : null}
        {chosen.length > 0 ? (
          <ul
            aria-label={t("capture.capture.filesToSave")}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {chosen.map((item) => (
              <li key={item.key} className="flex flex-col gap-2">
                <MediaPreview
                  src={item.url}
                  mime={effectiveMimeType(item.file)}
                  label={item.file.name}
                  beforeSave
                />
                <button
                  type="button"
                  onClick={() => removeFile(item.key)}
                  disabled={busy}
                  className="min-h-11 rounded-control text-sm font-medium text-text-brand underline underline-offset-4"
                >
                  {t("capture.capture.removeFile", { name: item.file.name })}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-surface border border-border bg-surface p-4 text-base text-text-muted">
            {t("capture.capture.nothingChosen")}
          </p>
        )}
      </section>

      <form className="flex flex-col gap-6" noValidate onSubmit={(event) => event.preventDefault()}>
        <fieldset className="flex flex-col gap-3" disabled={busy}>
          <legend className="text-lg font-medium text-text">
            {t("assistive.capture.question")}
          </legend>
          <p className="text-sm text-text-muted">{t("assistive.capture.questionHint")}</p>
          <label className="flex min-h-11 items-center gap-3 rounded-control border border-border bg-surface px-4 py-3 text-base text-text">
            <input
              type="radio"
              name="destination"
              checked={mode === "new"}
              onChange={() => setMode("new")}
              className="h-5 w-5"
            />
            <span>
              <span className="font-medium">{t("capture.capture.newSeedling")}</span>
              <span className="block text-sm text-text-muted">
                {t("capture.capture.newSeedlingHint")}
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
                <span className="font-medium">{t("capture.capture.existing")}</span>
                {mode === "existing" ? (
                  <span className="flex flex-col gap-2">
                    <label
                      htmlFor="capture-seedling-search"
                      className="text-sm font-medium text-text"
                    >
                      {t("assistive.capture.searchLabel")}
                    </label>
                    <input
                      id="capture-seedling-search"
                      type="search"
                      value={seedlingSearch}
                      onChange={(event) => setSeedlingSearch(event.target.value)}
                      autoComplete="off"
                      aria-describedby="capture-seedling-search-hint"
                      className="min-h-11 w-full rounded-control border border-border bg-background px-3 text-base text-text"
                    />
                    <span id="capture-seedling-search-hint" className="text-sm text-text-muted">
                      {t("assistive.capture.searchHint")}
                    </span>
                    {shownSeedlings.length === 0 ? (
                      <span role="status" className="text-sm text-text-muted">
                        {t("assistive.capture.noMatches")}
                      </span>
                    ) : (
                      <select
                        aria-label={t("assistive.capture.question")}
                        value={
                          shownSeedlings.some((item) => item.id === seedlingId)
                            ? seedlingId
                            : shownSeedlings[0]?.id
                        }
                        onChange={(event) => setSeedlingId(event.target.value)}
                        size={Math.min(Math.max(shownSeedlings.length, 2), 6)}
                        className="min-h-11 w-full rounded-control border border-border bg-background px-3 text-base text-text"
                      >
                        {shownSeedlings.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </span>
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
              <span className="font-medium">{t("capture.capture.identifier")}</span>
              {mode === "identifier" ? (
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder={t("capture.capture.identifierPlaceholder")}
                  autoComplete="off"
                  aria-label={t("capture.capture.identifierLabel")}
                  className="min-h-11 w-full rounded-control border border-border bg-background px-3 text-base text-text"
                />
              ) : null}
            </span>
          </label>
          {state.status === "error" && state.fieldErrors.identifier ? (
            <p className="text-sm font-medium text-destructive">{state.fieldErrors.identifier}</p>
          ) : null}
        </fieldset>

        {composer ? null : (
          <>
            <details className="rounded-surface border border-border bg-surface p-4">
              <summary className="min-h-11 cursor-pointer text-base font-medium text-text-brand">
                {t("capture.capture.addNote")}
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
                {voiceNotice === "new_seedling" ? (
                  <p role="status" className="text-sm text-text-muted">
                    {t("assistive.capture.newSeedlingApplied")}
                  </p>
                ) : null}
                {voiceNotice === "not_keeping" ? (
                  <div
                    role="status"
                    className="flex flex-col gap-2 rounded-control border border-border bg-background p-3"
                  >
                    <p className="text-base font-medium text-text">
                      {t("assistive.voice.notKeepingHeading")}
                    </p>
                    {mode === "existing" && seedlingId ? (
                      <Link
                        href={`/seedlings/${seedlingId}/rehome`}
                        className="inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand"
                      >
                        {t("assistive.voice.notKeepingAction")}
                      </Link>
                    ) : (
                      <p className="text-sm text-text-muted">
                        {t("assistive.voice.notKeepingChoose")}
                      </p>
                    )}
                  </div>
                ) : null}
                <label htmlFor="capture-note" className="text-base font-medium text-text">
                  {t("capture.capture.note")}
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
                {t("capture.capture.time")}
              </summary>
              <div className="mt-4 flex flex-col gap-2">
                <label htmlFor="capture-observed" className="text-base font-medium text-text">
                  {t("capture.capture.timeLabel")}
                </label>
                <input
                  id="capture-observed"
                  type="datetime-local"
                  value={observedAt}
                  onChange={(event) => setObservedAt(event.target.value)}
                  disabled={busy}
                  className="min-h-11 w-full rounded-control border border-border bg-background px-3 text-base text-text"
                />
                <p className="text-sm text-text-muted">{t("capture.capture.timeHint")}</p>
              </div>
            </details>
          </>
        )}

        {composer ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="composer-caption" className="text-base font-medium text-text">
                {t("capture.capture.composer.caption")}
              </label>
              <textarea
                id="composer-caption"
                rows={3}
                maxLength={2000}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                disabled={busy}
                className="w-full rounded-control border border-border bg-background px-3 py-2 text-base text-text"
              />
            </div>
            <label className="inline-flex min-h-11 items-start gap-3 text-base text-text">
              <input
                type="checkbox"
                checked={sharePublicly}
                onChange={(event) => setSharePublicly(event.target.checked)}
                disabled={busy}
                className="mt-1 h-6 w-6 shrink-0 accent-[var(--color-text-brand)]"
              />
              <span>
                {t("capture.capture.composer.sharePublicly")}
                <span className="block text-sm text-text-muted">
                  {t("capture.capture.composer.sharePubliclyHint")}
                </span>
              </span>
            </label>
          </div>
        ) : null}

        {uploadError ? <FormMessage tone="error">{uploadError}</FormMessage> : null}
        {message && !uploadError ? <FormMessage tone="error">{message}</FormMessage> : null}
        <p role="status" aria-live="polite" className="text-base text-text-muted">
          {phase === "uploading"
            ? t("capture.capture.uploading", { done: progress.done + 1, total: progress.total })
            : phase === "saving"
              ? t("capture.capture.savingPrivately")
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
          {composer
            ? t(
                sharePublicly
                  ? "capture.capture.composer.privacyPublic"
                  : "capture.capture.composer.privacyPrivate",
              )
            : t("capture.capture.privacyNote")}
        </p>
        <p className="text-sm">
          <Link href="/profile" className="text-text-brand underline underline-offset-4">
            {t("capture.capture.backToProfile")}
          </Link>
        </p>
      </form>
    </div>
  );
}
