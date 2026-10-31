import { NotYetAvailable } from "@/components/app-shell/not-yet-available";
import { requireParticipant } from "@/modules/identity/gate";

export const metadata = { title: "Capture" };

// Capture is the dominant action, but its workflow arrives in Phase 3. Until then this page only
// enforces the participation gate and says so plainly.
export default async function CapturePage() {
  await requireParticipant("/capture");
  return (
    <NotYetAvailable
      title="Capture"
      message="Capture is not available yet. Photos and notes will be saved privately here."
    />
  );
}
