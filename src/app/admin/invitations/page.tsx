import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { getTranslation } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdministrator } from "@/modules/admin/repository";
import { countryName } from "@/modules/identity/presentation";
import {
  decideInvitationRequestAction,
  markInvitationSentAction,
} from "@/modules/invitations/actions";

type RequestRow = {
  readonly request_id: string;
  readonly name: string;
  readonly country_code: string;
  readonly email: string;
  readonly reason: string;
  readonly status: string;
  readonly created_at: string;
};

const NOTICE: Record<string, MessageKey> = {
  approved: "invitations.admin.notices.approved",
  declined: "invitations.admin.notices.declined",
  sent: "invitations.admin.notices.sent",
};
const ERROR: Record<string, MessageKey> = {
  alreadyDecided: "invitations.admin.errors.alreadyDecided",
  notApproved: "invitations.admin.errors.notApproved",
  notFound: "invitations.admin.errors.notFound",
  notAllowed: "invitations.admin.errors.notAllowed",
  generic: "invitations.admin.errors.generic",
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("invitations.admin.title"), robots: { index: false, follow: false } };
}

/**
 * Invitation requests for administrators only. Anyone else gets the same not-found page as any missing resource. The applicant's details
 * are shown as plain text, and they are read only through the administrator function, which checks the caller itself.
 */
export default async function AdminInvitationsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  if (!(await isAdministrator(supabase))) notFound();

  const { notice, error } = await searchParams;
  const { t, locale } = await getTranslation();
  const [pending, approved] = await Promise.all([
    supabase.rpc("admin_list_invitation_requests", { p_status: "pending", p_limit: 100 }),
    supabase.rpc("admin_list_invitation_requests", { p_status: "approved", p_limit: 100 }),
  ]);
  const pendingRows = (pending.data ?? []) as unknown as RequestRow[];
  const approvedRows = (approved.data ?? []) as unknown as RequestRow[];

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("invitations.admin.title")}
        </h1>
        <p className="text-base text-text-muted">{t("invitations.admin.intro")}</p>
      </div>

      {notice && NOTICE[notice] ? (
        <FormMessage tone="success">{t(NOTICE[notice]!)}</FormMessage>
      ) : null}
      {error && ERROR[error] ? <FormMessage tone="error">{t(ERROR[error]!)}</FormMessage> : null}

      <section aria-labelledby="pending-title" className="flex flex-col gap-4">
        <h2 id="pending-title" className="font-display text-xl text-text-brand">
          {t("invitations.admin.pending")}
        </h2>
        {pendingRows.length === 0 ? (
          <p className="text-text-muted">{t("invitations.admin.none")}</p>
        ) : null}
        {pendingRows.map((row) => (
          <article
            key={row.request_id}
            className="flex flex-col gap-3 rounded-control border border-border bg-surface p-4"
          >
            <p className="font-medium text-text">
              {row.name} · {countryName(row.country_code, locale)} · {row.email}
            </p>
            <p className="text-sm text-text-muted">
              {t("invitations.admin.requested")}: {row.created_at.slice(0, 10)}
            </p>
            <p className="whitespace-pre-line text-base text-text">{row.reason}</p>
            <div className="flex flex-wrap gap-3">
              <form action={decideInvitationRequestAction}>
                <input type="hidden" name="requestId" value={row.request_id} />
                <input type="hidden" name="decision" value="approve" />
                <SubmitButton pendingLabel={t("invitations.admin.approve")}>
                  {t("invitations.admin.approve")}
                </SubmitButton>
              </form>
              <form action={decideInvitationRequestAction}>
                <input type="hidden" name="requestId" value={row.request_id} />
                <input type="hidden" name="decision" value="decline" />
                <SubmitButton pendingLabel={t("invitations.admin.decline")}>
                  {t("invitations.admin.decline")}
                </SubmitButton>
              </form>
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="approved-title" className="flex flex-col gap-4">
        <h2 id="approved-title" className="font-display text-xl text-text-brand">
          {t("invitations.admin.approved")}
        </h2>
        {approvedRows.length === 0 ? (
          <p className="text-text-muted">{t("invitations.admin.none")}</p>
        ) : null}
        {approvedRows.map((row) => (
          <article
            key={row.request_id}
            className="flex flex-col gap-3 rounded-control border border-border bg-surface p-4"
          >
            <p className="font-medium text-text">
              {row.name} · {row.email}
            </p>
            <p className="text-sm text-text-muted">
              {t("invitations.admin.requested")}: {row.created_at.slice(0, 10)}
            </p>
            <form action={markInvitationSentAction}>
              <input type="hidden" name="requestId" value={row.request_id} />
              <SubmitButton pendingLabel={t("invitations.admin.markSent")}>
                {t("invitations.admin.markSent")}
              </SubmitButton>
            </form>
          </article>
        ))}
      </section>
    </section>
  );
}
