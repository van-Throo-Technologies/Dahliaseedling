import type { Metadata } from "next";
import { NotYetAvailable } from "@/components/app-shell/not-yet-available";
import { getTranslation } from "@/i18n/server";
import { requireParticipant } from "@/modules/identity/gate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("identity.placeholder.inboxTitle") };
}

export default async function InboxPage() {
  await requireParticipant("/inbox");
  const { t } = await getTranslation();
  return (
    <NotYetAvailable
      title={t("identity.placeholder.inboxTitle")}
      message={t("identity.placeholder.inboxMessage")}
    />
  );
}
