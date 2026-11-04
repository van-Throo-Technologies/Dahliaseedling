import Link from "next/link";
import { formatDateTime } from "@/i18n/format";
import { getTranslation } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translator";
import {
  removeContentAction,
  resolveReportAction,
  setReportedSuspensionAction,
} from "@/modules/admin/actions";
import type { AdminReport } from "@/modules/admin/repository";
import { REPORT_REASONS } from "@/modules/messaging/validation";

/*
 * One report per card, with the context a moderator needs and nothing more. The reported grower's name and the saved content
 * are shown; a private conversation is never opened from here. Every action is a button in its own form, labelled in full, and
 * the destructive ones carry a sentence saying what they do. Removal and suspension are offered only where they apply.
 */

const PUBLIC_LINK: Record<string, (report: AdminReport) => string | null> = {
  update: (report) => `/updates/${report.targetId}`,
  comment: (report) => (report.targetUpdateId ? `/updates/${report.targetUpdateId}` : null),
  profile: (report) => `/profiles/${report.targetId}`,
  message: () => null,
};

const DESTRUCTIVE =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-destructive px-4 text-base font-medium text-destructive";
const SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand";

export async function AdminReportList({
  reports,
  returnTo,
}: {
  readonly reports: readonly AdminReport[];
  readonly returnTo: string;
}) {
  const { t, locale } = await getTranslation();
  return (
    <ul className="flex flex-col gap-4">
      {reports.map((report) => {
        const titleId = `report-${report.id}-title`;
        const link = PUBLIC_LINK[report.targetType]?.(report) ?? null;
        const canRemove =
          (report.targetType === "update" || report.targetType === "comment") && report.targetLive;
        const reason = REPORT_REASONS.includes(report.reason as (typeof REPORT_REASONS)[number])
          ? t(
              `safety.report.reasons.${report.reason as (typeof REPORT_REASONS)[number]}` as MessageKey,
            )
          : report.reason;
        return (
          <li key={report.id}>
            <article
              aria-labelledby={titleId}
              className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-4"
            >
              <header className="flex flex-col gap-1">
                <h2 id={titleId} className="text-lg font-medium text-text">
                  {t(`admin.reports.targetLabel.${report.targetType}` as MessageKey)}
                  {" · "}
                  <span className="font-normal text-text-muted">
                    {t(`admin.reports.statusLabel.${report.status}` as MessageKey)}
                  </span>
                </h2>
                <p className="text-sm text-text-muted">
                  <time dateTime={report.createdAt}>
                    {t("admin.reports.reportedAt", {
                      date: formatDateTime(report.createdAt, locale),
                    })}
                  </time>
                </p>
              </header>

              <div className="grid gap-3 text-base sm:grid-cols-2">
                <p className="text-text">
                  {t("admin.reports.reporter", {
                    name: report.reporterName ?? t("admin.reports.unnamed"),
                  })}
                </p>
                <p className="text-text">
                  {t("admin.reports.reported", {
                    name: report.reportedName ?? t("admin.reports.unnamed"),
                  })}
                  {" · "}
                  {report.reportedSuspended
                    ? t("admin.reports.suspended")
                    : t("admin.reports.active")}
                </p>
                <div className="sm:col-span-2">
                  <p className="text-sm text-text-muted">{t("safety.report.reason")}</p>
                  <p className="text-text">{reason}</p>
                </div>
                {report.details ? (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-text-muted">{t("safety.report.details")}</p>
                    <p className="whitespace-pre-wrap text-text">{report.details}</p>
                  </div>
                ) : null}
              </div>

              {report.targetType !== "profile" ? (
                <section
                  aria-label={t("admin.reports.snapshotTitle")}
                  className="flex flex-col gap-2"
                >
                  <h3 className="text-sm font-medium text-text-muted">
                    {t("admin.reports.snapshotTitle")}
                  </h3>
                  {report.contentSnapshot ? (
                    <p className="whitespace-pre-wrap rounded-control border border-border bg-background p-3 text-base text-text">
                      {report.contentSnapshot}
                    </p>
                  ) : (
                    <p className="text-base text-text-muted">{t("admin.reports.snapshotEmpty")}</p>
                  )}
                  {report.isMessage ? (
                    <p className="text-sm text-text-muted">{t("admin.reports.messageNote")}</p>
                  ) : !report.targetLive ? (
                    <p className="text-sm text-text-muted">{t("admin.reports.notLive")}</p>
                  ) : null}
                </section>
              ) : null}

              {link ? (
                <Link
                  href={link}
                  className="inline-flex min-h-11 items-center text-text-brand underline underline-offset-4"
                >
                  {t("admin.reports.openTarget")}
                </Link>
              ) : null}

              {report.status === "open" ? (
                <div className="flex flex-wrap gap-2">
                  {(["reviewed", "actioned", "dismissed"] as const).map((status) => (
                    <form key={status} action={resolveReportAction}>
                      <input type="hidden" name="reportId" value={report.id} />
                      <input type="hidden" name="status" value={status} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button type="submit" className={SECONDARY}>
                        {t(
                          `admin.reports.actions.${status === "reviewed" ? "review" : status === "actioned" ? "actioned" : "dismiss"}` as MessageKey,
                        )}
                      </button>
                    </form>
                  ))}
                </div>
              ) : null}

              {canRemove ? (
                <form action={removeContentAction} className="flex flex-col gap-2">
                  <input type="hidden" name="reportId" value={report.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <p id={`${titleId}-remove`} className="text-sm text-text-muted">
                    {t("admin.reports.helpers.remove")}
                  </p>
                  <div>
                    <button
                      type="submit"
                      aria-describedby={`${titleId}-remove`}
                      className={DESTRUCTIVE}
                    >
                      {t("admin.reports.actions.remove")}
                    </button>
                  </div>
                </form>
              ) : null}

              <form action={setReportedSuspensionAction} className="flex flex-col gap-2">
                <input type="hidden" name="reportId" value={report.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="suspend" value={report.reportedSuspended ? "0" : "1"} />
                <p id={`${titleId}-suspend`} className="text-sm text-text-muted">
                  {t(
                    report.reportedSuspended
                      ? "admin.reports.helpers.restore"
                      : "admin.reports.helpers.suspend",
                  )}
                </p>
                <div>
                  <button
                    type="submit"
                    aria-describedby={`${titleId}-suspend`}
                    className={report.reportedSuspended ? SECONDARY : DESTRUCTIVE}
                  >
                    {t(
                      report.reportedSuspended
                        ? "admin.reports.actions.restore"
                        : "admin.reports.actions.suspend",
                    )}
                  </button>
                </div>
              </form>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
