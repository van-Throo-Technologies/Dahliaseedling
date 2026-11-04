import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

/*
 * Administrator review reads. Every row comes from admin_list_reports, which checks is_admin() itself and returns only report
 * context: the reporter, the reported grower, the content saved when it was reported, and whether the target is still public.
 * Nothing here opens a conversation or a profile that the report does not concern.
 */

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ReportTarget = "update" | "comment" | "profile" | "message";
export type ReportStatus = "open" | "reviewed" | "actioned" | "dismissed";

export interface AdminReport {
  readonly id: string;
  readonly targetType: ReportTarget;
  readonly targetId: string;
  readonly reason: string;
  readonly details: string | null;
  readonly status: ReportStatus;
  readonly createdAt: string;
  readonly reporterName: string | null;
  readonly reportedUserId: string;
  readonly reportedName: string | null;
  readonly reportedSuspended: boolean;
  readonly contentSnapshot: string | null;
  readonly targetLive: boolean;
  readonly targetUpdateId: string | null;
  readonly isMessage: boolean;
}

/** True only for a signed-in administrator. Visitors and growers get false, and the page then answers not found. */
export async function isAdministrator(client: Client): Promise<boolean> {
  const { data } = await client.rpc("is_admin");
  return data === true;
}

/** Reports for review, newest first. "open" lists the reports still waiting; "all" lists every report. */
export async function listAdminReports(
  client: Client,
  status: "open" | "all",
): Promise<AdminReport[]> {
  const { data, error } = await client.rpc("admin_list_reports", {
    p_show_all: status === "all",
    p_limit: 50,
  });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    targetType: row.target_type as ReportTarget,
    targetId: row.target_id,
    reason: row.reason,
    details: row.details,
    status: row.status as ReportStatus,
    createdAt: row.created_at,
    reporterName: row.reporter_name,
    reportedUserId: row.reported_user_id,
    reportedName: row.reported_name,
    reportedSuspended: row.reported_suspended,
    contentSnapshot: row.content_snapshot,
    targetLive: row.target_live,
    targetUpdateId: row.target_update_id,
    isMessage: row.is_message,
  }));
}
