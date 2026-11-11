import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormMessage } from "@/design-system/components/form-message";
import { SubmitButton } from "@/design-system/components/submit-button";
import { getTranslation } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setFeedbackStatusAction } from "@/modules/feedback/actions";
import { FEEDBACK_CATEGORIES, isFeedbackCategory } from "@/modules/feedback/validation";
import { isAdministrator } from "@/modules/admin/repository";

import { AdminNav } from "@/components/admin/admin-nav";
const STATUSES = ["new", "reviewing", "resolved"] as const;
type Status = (typeof STATUSES)[number];

const NOTICE: Record<string, MessageKey> = { updated: "feedback.admin.notices.updated" };
const ERROR: Record<string, MessageKey> = {
  notAllowed: "feedback.admin.errors.notAllowed",
  notFound: "feedback.admin.errors.notFound",
  generic: "feedback.admin.errors.generic",
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("feedback.admin.title"), robots: { index: false, follow: false } };
}

/**
 * Feedback for administrators only. Anyone else gets the same not-found page as any missing resource. The message is shown as plain text.
 */
export default async function AdminFeedbackPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    category?: string;
    status?: string;
    feedbackNotice?: string;
    feedbackError?: string;
  }>;
}) {
  const supabase = await createSupabaseServerClient();
  if (!(await isAdministrator(supabase))) notFound();
  const { t, locale } = await getTranslation();
  const query = await searchParams;
  const category = isFeedbackCategory(query.category) ? query.category : null;
  const status = (STATUSES as readonly string[]).includes(query.status ?? "")
    ? (query.status as Status)
    : null;

  let request = supabase
    .from("feedback")
    .select("id, category, message, status, page_context, app_version, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (category) request = request.eq("category", category);
  if (status) request = request.eq("status", status);
  const { data: items } = await request;

  const filterParams = new URLSearchParams();
  if (category) filterParams.set("category", category);
  if (status) filterParams.set("status", status);
  const hrefWith = (next: Record<string, string | null>) => {
    const params = new URLSearchParams(filterParams);
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const text = params.toString();
    return text ? `/admin/feedback?${text}` : "/admin/feedback";
  };
  const notice = query.feedbackNotice ? NOTICE[query.feedbackNotice] : undefined;
  const error = query.feedbackError ? ERROR[query.feedbackError] : undefined;
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <AdminNav current="feedback" />
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("feedback.admin.title")}
        </h1>
        <p className="text-base text-text-muted">{t("feedback.admin.intro")}</p>
      </div>

      {notice ? <FormMessage tone="success">{t(notice)}</FormMessage> : null}
      {error ? <FormMessage tone="error">{t(error)}</FormMessage> : null}

      <nav aria-label={t("feedback.admin.filterCategory")} className="flex flex-col gap-3">
        <p className="text-sm font-medium text-text">{t("feedback.admin.filterCategory")}</p>
        <ul className="flex flex-wrap gap-2">
          <FilterLink
            href={hrefWith({ category: null })}
            current={category === null}
            label={t("feedback.admin.all")}
          />
          {FEEDBACK_CATEGORIES.map((item) => (
            <FilterLink
              key={item}
              href={hrefWith({ category: item })}
              current={category === item}
              label={t(`feedback.category.${item}`)}
            />
          ))}
        </ul>
        <p className="text-sm font-medium text-text">{t("feedback.admin.filterStatus")}</p>
        <ul className="flex flex-wrap gap-2">
          <FilterLink
            href={hrefWith({ status: null })}
            current={status === null}
            label={t("feedback.admin.all")}
          />
          {STATUSES.map((item) => (
            <FilterLink
              key={item}
              href={hrefWith({ status: item })}
              current={status === item}
              label={t(`feedback.admin.status.${item}`)}
            />
          ))}
        </ul>
      </nav>

      {!items || items.length === 0 ? (
        <p className="text-base text-text-muted">{t("feedback.admin.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <li key={item.id}>
              <article
                aria-label={t(`feedback.category.${item.category as "idea"}`)}
                className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-4"
              >
                <p className="text-sm text-text-muted">
                  <span className="font-medium text-text">
                    {t(`feedback.category.${item.category as "idea"}`)}
                  </span>
                  {" · "}
                  {t(`feedback.admin.status.${item.status as Status}`)}
                  {" · "}
                  <time dateTime={item.created_at}>
                    {dateFormat.format(new Date(item.created_at))}
                  </time>
                </p>
                <p className="whitespace-pre-wrap text-base text-text">{item.message}</p>
                <p className="text-sm text-text-muted">
                  {t("feedback.admin.context")}: {item.page_context ?? "—"} ·{" "}
                  {t("feedback.admin.version")}: {item.app_version ?? "—"}
                </p>
                <form action={setFeedbackStatusAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="feedbackId" value={item.id} />
                  <input type="hidden" name="category" value={category ?? ""} />
                  <input type="hidden" name="statusFilter" value={status ?? ""} />
                  <label className="flex flex-col gap-1 text-sm text-text">
                    {t("feedback.admin.setStatus")}
                    <select
                      name="status"
                      defaultValue={item.status}
                      className="min-h-11 rounded-control border border-border bg-background px-3 text-base text-text"
                    >
                      {STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {t(`feedback.admin.status.${value}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <SubmitButton pendingLabel={t("feedback.admin.setStatus")}>
                    {t("feedback.admin.setStatus")}
                  </SubmitButton>
                </form>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FilterLink({
  href,
  current,
  label,
}: {
  readonly href: string;
  readonly current: boolean;
  readonly label: string;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base text-text-brand aria-[current=page]:border-text-brand aria-[current=page]:font-medium"
      >
        {label}
      </Link>
    </li>
  );
}
