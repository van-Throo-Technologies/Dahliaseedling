"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/modules/capture/validation";
import { requireParticipant } from "@/modules/identity/gate";
import { safeReturnPath } from "@/modules/messaging/validation";
import { refuseOnPublicSurface } from "@/lib/security/public-action-guard";

/*
 * Notification read state. Each action changes only the caller's own notifications; the database function enforces that, so
 * a notification id from another grower simply changes nothing.
 */

export async function markNotificationReadAction(formData: FormData): Promise<never> {
  refuseOnPublicSurface();
  await requireParticipant("/notifications");
  const id = String(formData.get("notificationId") ?? "");
  if (isUuid(id)) {
    const client = await createSupabaseServerClient();
    await client.rpc("mark_notification_read", { p_notification_id: id });
  }
  revalidatePath("/notifications");
  redirect(safeReturnPath(formData.get("returnTo"), "/notifications"));
}

export async function markAllNotificationsReadAction(): Promise<never> {
  refuseOnPublicSurface();
  await requireParticipant("/notifications");
  const client = await createSupabaseServerClient();
  await client.rpc("mark_all_notifications_read");
  revalidatePath("/notifications");
  redirect("/notifications");
}
