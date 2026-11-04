import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildStoreZip, type ZipEntry } from "@/lib/zip/store-zip";
import { logEvent } from "@/lib/logging/log";

/*
 * The grower's own data export. It runs in the grower's session, so every read is limited by the database to what that grower may see.
 * The archive is built in memory for this one request and is never stored, so there is nothing to expire or clean up.
 *
 * Original media is downloaded through the grower's own storage session. A file the storage policy refuses is listed as missing in the
 * manifest rather than failing the export. The size cap is an operational guard for one request. It is not a retention period.
 */

export const dynamic = "force-dynamic";

const MAX_EXPORT_BYTES = 256 * 1024 * 1024;
const NO_STORE = { "Cache-Control": "private, no-store" };

interface MediaRow {
  readonly id: string;
  readonly mime_type: string;
  readonly storage_path: string;
}

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "video/mp4":
      return "mp4";
    case "video/quicktime":
      return "mov";
    default:
      return "bin";
  }
}

export async function GET(): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  }

  await supabase.rpc("note_my_export");
  const { data, error } = await supabase.rpc("account_export_document");
  if (error || !data) {
    logEvent("error", "account_export", {
      outcome: "failed",
      code: "document_unavailable",
      route: "account.export",
    });
    return Response.json({ error: "unavailable" }, { status: 503, headers: NO_STORE });
  }

  const document = data as Record<string, unknown>;
  const media = (document.media as MediaRow[] | undefined) ?? [];
  const entries: ZipEntry[] = [];
  const included: string[] = [];
  const missing: string[] = [];
  let total = 0;

  for (const item of media) {
    const { data: blob, error: downloadError } = await supabase.storage
      .from("private-media")
      .download(item.storage_path);
    if (downloadError || !blob) {
      missing.push(item.id);
      continue;
    }
    total += blob.size;
    if (total > MAX_EXPORT_BYTES) {
      logEvent("warn", "account_export", {
        outcome: "too_large",
        route: "account.export",
        status: 413,
      });
      return Response.json({ error: "too_large" }, { status: 413, headers: NO_STORE });
    }
    entries.push({
      name: `media/${item.id}.${extensionFor(item.mime_type)}`,
      data: Buffer.from(await blob.arrayBuffer()),
    });
    included.push(item.id);
  }

  const manifest = { included_media: included, missing_media: missing };
  entries.unshift({
    name: "account-export.json",
    data: Buffer.from(JSON.stringify({ ...document, media_files: manifest }, null, 2), "utf8"),
  });

  logEvent("info", "account_export", {
    outcome: "completed",
    count: included.length,
    route: "account.export",
    status: 200,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buildStoreZip(entries)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="dahliaseedling-export-${stamp}.zip"`,
      ...NO_STORE,
    },
  });
}
