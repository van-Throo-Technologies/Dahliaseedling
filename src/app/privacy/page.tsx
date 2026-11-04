import type { Metadata } from "next";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { getTranslation } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAccount } from "@/modules/identity/gate";
import { deactivateAccountAction, requestErasureAction } from "@/modules/privacy/actions";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("privacy.title"), robots: { index: false, follow: false } };
}

interface PrivacyStatus {
  readonly account_state: string;
  readonly erasure_requested_at: string | null;
  readonly avatar_removed: boolean;
  readonly auth_identity_removed: boolean;
  readonly media_purge_outstanding: boolean;
  readonly completed: boolean;
}

const NOTICE: Record<string, MessageKey> = {
  deactivated: "privacy.deactivate.done",
  erasureRequested: "privacy.erasure.requested",
};

const ERROR: Record<string, MessageKey> = {
  notConfirmed: "privacy.errors.notConfirmed",
  notAllowed: "privacy.errors.notAllowed",
  notDeactivated: "privacy.errors.notDeactivated",
  generic: "privacy.errors.generic",
};

/*
 * The grower's privacy settings. The state, the export and the outstanding erasure steps come from the database. Pending and completed
 * steps are labelled differently, and erasure is never shown as complete while a step remains outstanding.
 */
export default async function PrivacyPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ privacyNotice?: string; privacyError?: string }>;
}) {
  await requireAccount("/privacy");
  const { t } = await getTranslation();
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("my_privacy_status");
  const status = ((data as unknown as PrivacyStatus[] | null) ?? [])[0] ?? null;
  const state = status?.account_state ?? "active";
  const notice = query.privacyNotice ? NOTICE[query.privacyNotice] : undefined;
  const error = query.privacyError ? ERROR[query.privacyError] : undefined;

  const stateText =
    state === "deactivated"
      ? t("privacy.state.deactivated")
      : state === "pending_erasure"
        ? t("privacy.state.pendingErasure")
        : state === "erased"
          ? t("privacy.state.erased")
          : t("privacy.state.active");

  return (
    <section aria-labelledby="privacy-title" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 id="privacy-title" className="font-display text-3xl text-text-brand">
          {t("privacy.title")}
        </h1>
        <p className="text-base text-text-muted">{t("privacy.intro")}</p>
      </div>

      {notice ? <FormMessage tone="success">{t(notice)}</FormMessage> : null}
      {error ? <FormMessage tone="error">{t(error)}</FormMessage> : null}

      <div className="flex flex-col gap-1 rounded-surface border border-border bg-surface p-4">
        <p className="text-sm text-text-muted">{t("privacy.state.label")}</p>
        <p className="text-base font-medium text-text">{stateText}</p>
      </div>

      <section aria-labelledby="export-title" className="flex flex-col gap-3">
        <h2 id="export-title" className="text-lg font-medium text-text">
          {t("privacy.export.heading")}
        </h2>
        <p className="text-base text-text-muted">{t("privacy.export.body")}</p>
        <a
          href="/api/account/export"
          download
          className="inline-flex min-h-11 items-center self-start rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand"
        >
          {t("privacy.export.action")}
        </a>
      </section>

      {state === "active" ? (
        <section aria-labelledby="deactivate-title" className="flex flex-col gap-3">
          <h2 id="deactivate-title" className="text-lg font-medium text-text">
            {t("privacy.deactivate.heading")}
          </h2>
          <p className="text-base text-text-muted">{t("privacy.deactivate.body")}</p>
          <form action={deactivateAccountAction} className="flex flex-col gap-3">
            <label className="flex min-h-11 items-center gap-3 text-base text-text">
              <input type="checkbox" name="confirm" value="yes" required className="h-5 w-5" />
              {t("privacy.deactivate.confirm")}
            </label>
            <SubmitButton pendingLabel={t("privacy.deactivate.action")}>
              {t("privacy.deactivate.action")}
            </SubmitButton>
          </form>
        </section>
      ) : null}

      {state === "deactivated" ? (
        <section aria-labelledby="erasure-title" className="flex flex-col gap-3">
          <h2 id="erasure-title" className="text-lg font-medium text-text">
            {t("privacy.erasure.heading")}
          </h2>
          <p className="text-base text-text-muted">{t("privacy.erasure.body")}</p>
          <form action={requestErasureAction} className="flex flex-col gap-3">
            <label className="flex min-h-11 items-center gap-3 text-base text-text">
              <input type="checkbox" name="confirm" value="yes" required className="h-5 w-5" />
              {t("privacy.erasure.confirm")}
            </label>
            <SubmitButton pendingLabel={t("privacy.erasure.action")}>
              {t("privacy.erasure.action")}
            </SubmitButton>
          </form>
        </section>
      ) : null}

      {state === "pending_erasure" && status ? (
        <section aria-labelledby="steps-title" className="flex flex-col gap-3">
          <h2 id="steps-title" className="text-lg font-medium text-text">
            {t("privacy.erasure.pendingHeading")}
          </h2>
          <ul className="flex flex-col gap-2">
            <StepLine label={t("privacy.erasure.steps.recordsCleared")} done={true} t={t} />
            <StepLine
              label={t("privacy.erasure.steps.avatarRemoved")}
              done={status.avatar_removed}
              t={t}
            />
            <StepLine
              label={t("privacy.erasure.steps.mediaPurge")}
              done={!status.media_purge_outstanding}
              t={t}
            />
            <StepLine
              label={t("privacy.erasure.steps.authIdentity")}
              done={status.auth_identity_removed}
              t={t}
            />
          </ul>
          {status.completed ? null : (
            <p className="text-sm text-text-muted">{t("privacy.erasure.outstandingNote")}</p>
          )}
        </section>
      ) : null}
    </section>
  );
}

function StepLine({
  label,
  done,
  t,
}: {
  readonly label: string;
  readonly done: boolean;
  readonly t: (key: MessageKey) => string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-control border border-border bg-background px-4 py-3">
      <span className="text-base text-text">{label}</span>
      <span
        className={
          done ? "text-sm font-medium text-text-brand" : "text-sm font-medium text-text-muted"
        }
      >
        {done ? t("privacy.erasure.done") : t("privacy.erasure.outstanding")}
      </span>
    </li>
  );
}
