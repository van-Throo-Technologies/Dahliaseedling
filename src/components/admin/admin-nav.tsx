import Link from "next/link";
import { getTranslation } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translator";

/*
 * Moves between the four administrator pages. It shows the same section names the pages already use, and marks the current one with
 * aria-current. Each page still checks isAdministrator() itself, so this list is navigation only and grants nothing.
 */

export type AdminSection = "invitations" | "reports" | "accounts" | "feedback";

const SECTIONS: readonly {
  readonly key: AdminSection;
  readonly href: string;
  readonly label: MessageKey;
}[] = [
  { key: "invitations", href: "/admin/invitations", label: "invitations.admin.title" },
  { key: "reports", href: "/admin/reports", label: "admin.reports.title" },
  { key: "accounts", href: "/admin/accounts", label: "admin.accounts.title" },
  { key: "feedback", href: "/admin/feedback", label: "feedback.admin.title" },
];

export async function AdminNav({ current }: { readonly current: AdminSection }) {
  const { t } = await getTranslation();
  return (
    <nav aria-label={t("admin.nav.label")} className="flex flex-wrap gap-2">
      {SECTIONS.map((section) => (
        <Link
          key={section.key}
          href={section.href}
          aria-current={section.key === current ? "page" : undefined}
          className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-base text-text-brand aria-[current=page]:border-text-brand aria-[current=page]:font-medium"
        >
          {t(section.label)}
        </Link>
      ))}
    </nav>
  );
}
