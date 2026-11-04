import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { suspendProfileAction } from "@/modules/admin/actions";
import { FormMessage } from "@/design-system/components/form-message";
import { getTranslation } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdministrator } from "@/modules/admin/repository";

const NOTICE: Record<string, MessageKey> = {
  suspended: "admin.accounts.notices.suspended",
  restored: "admin.accounts.notices.restored",
};

const ERROR: Record<string, MessageKey> = {
  notAllowed: "admin.accounts.errors.notAllowed",
  notFound: "admin.accounts.errors.notFound",
  ownAccount: "admin.accounts.errors.ownAccount",
  reason: "admin.accounts.errors.reason",
  generic: "admin.accounts.errors.generic",
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("admin.accounts.title"), robots: { index: false, follow: false } };
}

/*
 * Direct account suspension for administrators. Anyone else receives the same not-found page as any missing resource.
 */
export default async function AdminAccountsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ adminNotice?: string; adminError?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  if (!(await isAdministrator(supabase))) notFound();
  const { t } = await getTranslation();
  const query = await searchParams;
  const notice = query.adminNotice ? NOTICE[query.adminNotice] : undefined;
  const error = query.adminError ? ERROR[query.adminError] : undefined;

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("admin.accounts.title")}
        </h1>
        <p className="text-base text-text-muted">{t("admin.accounts.intro")}</p>
      </div>

      {notice ? <FormMessage tone="success">{t(notice)}</FormMessage> : null}
      {error ? <FormMessage tone="error">{t(error)}</FormMessage> : null}

      <form action={suspendProfileAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="account-profile-id" className="text-base font-medium text-text">
            {t("admin.accounts.profileId")}
          </label>
          <input
            id="account-profile-id"
            name="profileId"
            required
            aria-describedby="account-profile-id-hint"
            autoComplete="off"
            className="min-h-11 w-full rounded-control border border-border bg-background px-3 text-base text-text"
          />
          <p id="account-profile-id-hint" className="text-sm text-text-muted">
            {t("admin.accounts.profileIdHint")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="account-reason" className="text-base font-medium text-text">
            {t("admin.accounts.reason")}
          </label>
          <textarea
            id="account-reason"
            name="reason"
            required
            minLength={10}
            maxLength={500}
            rows={4}
            aria-describedby="account-reason-hint"
            className="w-full rounded-control border border-border bg-background px-3 py-2 text-base text-text"
          />
          <p id="account-reason-hint" className="text-sm text-text-muted">
            {t("admin.accounts.reasonHint")}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            name="suspend"
            value="1"
            className="inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-base font-medium text-on-primary"
          >
            {t("admin.accounts.suspend")}
          </button>
          <button
            type="submit"
            name="suspend"
            value="0"
            className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-5 text-base font-medium text-text-brand"
          >
            {t("admin.accounts.restore")}
          </button>
        </div>
      </form>
    </section>
  );
}
