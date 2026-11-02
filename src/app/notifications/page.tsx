import type { Metadata } from "next";
import { NotYetAvailable } from "@/components/app-shell/not-yet-available";
import { getTranslation } from "@/i18n/server";
import { requireParticipant } from "@/modules/identity/gate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("identity.placeholder.notificationsTitle") };
}

export default async function NotificationsPage() {
  await requireParticipant("/notifications");
  const { t } = await getTranslation();
  return (
    <NotYetAvailable
      title={t("identity.placeholder.notificationsTitle")}
      message={t("identity.placeholder.notificationsMessage")}
    />
  );
}
