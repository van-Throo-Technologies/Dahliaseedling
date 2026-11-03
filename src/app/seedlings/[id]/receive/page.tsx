import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslation } from "@/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireParticipant } from "@/modules/identity/gate";
import { confirmReceiptAction } from "@/modules/rehome/actions";
import { readRehomePanel } from "@/modules/rehome/repository";
import { displayNames, getSeedling } from "@/modules/seedlings/repository";
import { isUuid } from "@/modules/seedlings/validation";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslation();
  return { title: t("rehome.receive.title") };
}

/** Only the selected recipient of an arranged or sent continuation reaches this page. Everyone else is refused. */
export default async function ReceivePage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await requireParticipant(`/seedlings/${id}/receive`);
  const { t } = await getTranslation();
  const supabase = await createSupabaseServerClient();
  const panel = await readRehomePanel(supabase, id);
  const item = panel?.case;
  if (
    !panel ||
    panel.role !== "recipient" ||
    !item ||
    (item.status !== "arranged" && item.status !== "sent")
  ) {
    notFound();
  }
  const seedling = await getSeedling(supabase, id);
  if (!seedling) notFound();
  const names = await displayNames(supabase, [seedling.originatorId]);
  const originator = names.get(seedling.originatorId) ?? t("rehome.provenance.someone");

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          {t("rehome.receive.title")}
        </h1>
        <p className="text-base text-text">{t("rehome.receive.intro", { originator })}</p>
      </div>
      <form action={confirmReceiptAction} className="flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="seedlingId" value={id} />
        <input type="hidden" name="caseId" value={item.id} />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 text-base font-medium text-on-primary"
        >
          {t("rehome.receive.submit")}
        </button>
        <Link
          href={`/seedlings/${id}`}
          className="inline-flex min-h-11 items-center text-base text-text-brand"
        >
          {t("rehome.receive.back")}
        </Link>
      </form>
    </section>
  );
}
