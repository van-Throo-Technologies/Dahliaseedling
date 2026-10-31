import { NotYetAvailable } from "@/components/app-shell/not-yet-available";
import { requireParticipant } from "@/modules/identity/gate";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  await requireParticipant("/inbox");
  return (
    <NotYetAvailable
      title="Inbox"
      message="Messages are not available yet. Private conversations will appear here."
    />
  );
}
