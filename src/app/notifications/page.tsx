import { NotYetAvailable } from "@/components/app-shell/not-yet-available";
import { requireParticipant } from "@/modules/identity/gate";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireParticipant("/notifications");
  return (
    <NotYetAvailable
      title="Notifications"
      message="Notifications are not available yet. Activity that needs your attention will appear here."
    />
  );
}
