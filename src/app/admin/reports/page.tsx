import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminReportList } from "@/components/admin/report-list";
import { FormMessage } from "@/design-system/components/form-message";
import { getTranslation } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdministrator, listAdminReports } from "@/modules/admin/repository";

const NOTICE: Record<string, MessageKey> = {
  resolved: "admin.reports.notices.resolved",
  removed: "admin.reports.notices.removed",
  suspended: "admin.reports.notices.suspended",
  restored: "admin.reports.notices.restored",
};

const ERROR: Record<string, MessageKey> = {
  notAllowed: "admin.reports.errors.notAllowed",
  notFound: "admin.reports.errors.notFound",
  generic: "admin.reports.errors.generic",
  alreadyResolved: "admin.reports.errors.alreadyResolved",
  notRemovable: "admin.reports.errors.notRemovable",
  ownAccount: "admin.reports.errors.ownAccount",
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("admin.reports.title"), robots: { index: false, follow: false } };
}

/*
 * The protected review surface. Only an administrator sees it; anyone else gets the same not-found page as a missing resource,
 * so the surface itself is not revealed. Reports are listed newest first, and the filter is kept in the address.
 */
export default async function AdminReportsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ status?: string; adminNotice?: string; adminError?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  if (!(await isAdministrator(supabase))) notFound();
  const { t } = await getTranslation();
  const query = await searchParams;
  const status = query.status === "all" ? "all" : "open";
  const reports = await listAdminReports(supabase, status);
  const returnTo = `/admin/reports?status=${status}`;
  const notice = query.adminNotice ? NOTICE[query.adminNotice] : undefined;
  const error = query.adminError ? ERROR[query.adminError] : undefined;

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("admin.reports.title")}
        </h1>
        <p className="text-base text-text-muted">{t("admin.reports.intro")}</p>
      </div>

      <nav aria-label={t("admin.reports.title")} className="flex flex-wrap gap-3">
        <Link
          href="/admin/reports?status=open"
          aria-current={status === "open" ? "page" : undefined}
          className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base text-text-brand aria-[current=page]:border-text-brand aria-[current=page]:font-medium"
        >
          {t("admin.reports.filterOpen")}
        </Link>
        <Link
          href="/admin/accounts"
          className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base text-text-brand"
        >
          {t("admin.accounts.link")}
        </Link>
        <Link
          href="/admin/reports?status=all"
          aria-current={status === "all" ? "page" : undefined}
          className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base text-text-brand aria-[current=page]:border-text-brand aria-[current=page]:font-medium"
        >
          {t("admin.reports.filterAll")}
        </Link>
      </nav>

      {notice ? <FormMessage tone="success">{t(notice)}</FormMessage> : null}
      {error ? <FormMessage tone="error">{t(error)}</FormMessage> : null}

      {reports.length === 0 ? (
        <p className="rounded-control border border-border bg-surface p-4 text-base text-text-muted">
          {t("admin.reports.empty")}
        </p>
      ) : (
        <AdminReportList reports={reports} returnTo={returnTo} />
      )}
    </section>
  );
}
