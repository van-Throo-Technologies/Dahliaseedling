import { SubmitButton } from "@/design-system/components/submit-button";
import { getTranslation } from "@/i18n/server";
import { mergeSeedlingsAction } from "@/modules/seedlings/merge";

/*
 * The merge form. It asks two things explicitly: which other Seedling is the same plant, and which record stays. The confirmation
 * is a required checkbox whose text states that the merge cannot currently be undone. Nothing is preselected.
 */

interface MergeFormProps {
  readonly thisId: string;
  readonly thisLabel: string;
  readonly others: readonly { readonly id: string; readonly label: string }[];
}

const RADIO =
  "flex min-h-11 items-start gap-3 rounded-control border border-border bg-surface px-4 py-3 text-base text-text";

export async function MergeForm({ thisId, thisLabel, others }: MergeFormProps) {
  const { t } = await getTranslation();
  return (
    <form action={mergeSeedlingsAction} className="flex flex-col gap-6">
      <input type="hidden" name="thisId" value={thisId} />
      <fieldset className="flex flex-col gap-3">
        <legend className="text-lg font-medium text-text">
          {t("assistive.merge.chooseOther")}
        </legend>
        {others.map((item) => (
          <label key={item.id} className={RADIO}>
            <input type="radio" name="otherId" value={item.id} required className="mt-1 h-5 w-5" />
            <span>{item.label}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-lg font-medium text-text">{t("assistive.merge.keepThis")}</legend>
        <label className={RADIO}>
          <input type="radio" name="keep" value="this" required className="mt-1 h-5 w-5" />
          <span>
            {t("assistive.merge.keepThis")} · {thisLabel}
          </span>
        </label>
        <label className={RADIO}>
          <input type="radio" name="keep" value="other" required className="mt-1 h-5 w-5" />
          <span>{t("assistive.merge.keepOther")}</span>
        </label>
      </fieldset>
      <label className="flex min-h-11 items-start gap-3 text-base text-text">
        <input type="checkbox" name="confirmed" required className="mt-1 h-5 w-5" />
        <span>{t("assistive.merge.confirm")}</span>
      </label>
      <SubmitButton pendingLabel={t("assistive.merge.submit")}>
        {t("assistive.merge.submit")}
      </SubmitButton>
    </form>
  );
}
