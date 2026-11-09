import { SubmitButton } from "@/design-system/components/submit-button";
import { getTranslation } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translator";
import { reportAction } from "@/modules/messaging/actions";
import { REPORT_REASONS, type ReportTarget } from "@/modules/messaging/validation";

/*
 * Report an Update, a comment, a grower profile or a private message. The disclosure opens without script, and its summary names
 * exactly what is being reported. The reporter sees a confirmation; the reported grower is never told and never sees the report.
 */

const LABEL: Record<ReportTarget, MessageKey> = {
  update: "safety.report.linkUpdate",
  comment: "safety.report.linkComment",
  profile: "safety.report.link",
  message: "messaging.thread.report",
};

interface ReportControlProps {
  readonly targetType: ReportTarget;
  readonly targetId: string;
  readonly returnTo: string;
  readonly id: string;
  /** Layout only, for the caller's row. The disclosure's own look does not change. */
  readonly className?: string;
}

export async function ReportControl({
  targetType,
  targetId,
  returnTo,
  id,
  className,
}: ReportControlProps) {
  const { t } = await getTranslation();
  const reasonId = `${id}-reason`;
  const detailsId = `${id}-details`;
  return (
    <details className={`text-base ${className ?? ""}`}>
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-text-brand underline underline-offset-4">
        {t(LABEL[targetType])}
      </summary>
      <form
        action={reportAction}
        className="mt-3 space-y-3 rounded-control border border-border bg-surface p-4"
      >
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="space-y-1">
          <label htmlFor={reasonId} className="block font-medium text-text">
            {t("safety.report.reason")}
          </label>
          <select
            id={reasonId}
            name="reason"
            required
            className="min-h-11 w-full rounded-control border border-border bg-background px-3 text-base"
          >
            {REPORT_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {t(`safety.report.reasons.${reason}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={detailsId} className="block font-medium text-text">
            {t("safety.report.details")}
          </label>
          <p id={`${detailsId}-hint`} className="text-sm text-text-muted">
            {t("safety.report.detailsHint")}
          </p>
          <textarea
            id={detailsId}
            name="details"
            rows={3}
            maxLength={1000}
            aria-describedby={`${detailsId}-hint`}
            className="w-full rounded-control border border-border bg-background px-3 py-2 text-base"
          />
        </div>
        <SubmitButton pendingLabel={t("safety.report.submit")}>
          {t("safety.report.submit")}
        </SubmitButton>
      </form>
    </details>
  );
}
