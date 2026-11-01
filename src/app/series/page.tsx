import { SeriesForm } from "@/components/seedlings/series-form";
import { patternExample } from "@/modules/seedlings/presentation";
import { listSeries } from "@/modules/seedlings/repository";
import { requireParticipant } from "@/modules/identity/gate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Series" };

export default async function SeriesPage() {
  await requireParticipant("/series");
  const supabase = await createSupabaseServerClient();
  const series = await listSeries(supabase);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="page-title" className="flex flex-col gap-3">
        <h1 id="page-title" className="font-display text-3xl text-text-brand">
          Series
        </h1>
        <p className="text-base text-text-muted">
          A series is an identifier prefix you choose, such as JV. DahliaSeedling does not decide
          what it means. Seedlings you number with a series also keep an automatic number.
        </p>
      </section>

      <section aria-labelledby="existing-title" className="flex flex-col gap-3">
        <h2 id="existing-title" className="text-lg font-medium text-text">
          Your series
        </h2>
        {series.length === 0 ? (
          <p className="rounded-surface border border-border bg-surface p-4 text-base text-text-muted">
            You have no series yet. Seedlings still get automatic numbers without one.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {series.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1 rounded-surface border border-border bg-surface p-4"
              >
                <span className="text-lg font-medium text-text-brand">{item.name}</span>
                <span className="text-sm text-text-muted">
                  Identifiers look like {patternExample(item.pattern)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="create-title" className="flex flex-col gap-4">
        <h2 id="create-title" className="text-lg font-medium text-text">
          Add a series
        </h2>
        <SeriesForm />
      </section>
    </div>
  );
}
