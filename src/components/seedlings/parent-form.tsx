"use client";

import { useActionState, useEffect, useState } from "react";
import { FormMessage } from "@/design-system/components/form-message";
import { SelectField, TextAreaField, TextField } from "@/design-system/components/form-fields";
import { SubmitButton } from "@/design-system/components/submit-button";
import { useLocale, useT } from "@/i18n/client";
import { IDLE_FORM_STATE } from "@/modules/identity/form-state";
import { findParentCandidatesAction, setParentAction } from "@/modules/seedlings/actions";
import type { ParentCandidate } from "@/modules/seedlings/repository";

export interface ParentDefaults {
  readonly kind: "none" | "unknown" | "seedling" | "cultivar";
  readonly parentSeedlingId: string;
  readonly parentLabel: string;
  readonly cultivarName: string;
  readonly notes: string;
}

/**
 * One parent role. "Not recorded" and "Unknown" are different: unknown is a deliberate statement that the
 * parent is not known. Choosing another seedling uses a short search, not a list of every seedling, and
 * the server returns only seedlings this grower may see.
 */
export function ParentForm({
  seedlingId,
  role,
  heading,
  defaults,
}: {
  readonly seedlingId: string;
  readonly role: "seed_parent" | "pollen_parent";
  readonly heading: string;
  readonly defaults: ParentDefaults;
}) {
  const t = useT();
  const locale = useLocale();
  const [state, action] = useActionState(setParentAction, IDLE_FORM_STATE);
  const errors = state.status === "error" ? state.fieldErrors : {};
  const [kind, setKind] = useState(defaults.kind);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ParentCandidate[]>([]);
  const [searchFailed, setSearchFailed] = useState(false);
  const [chosen, setChosen] = useState<{ id: string; label: string } | null>(
    defaults.parentSeedlingId
      ? { id: defaults.parentSeedlingId, label: defaults.parentLabel }
      : null,
  );

  // Results only ever come from a search for the current term. Clearing happens by deriving, not by
  // setting state inside the effect.
  const searching = kind === "seedling" && term.trim() !== "";
  const shown = searching ? results : [];

  useEffect(() => {
    if (!searching) return;
    let active = true;
    const timer = setTimeout(() => {
      findParentCandidatesAction(term, seedlingId)
        .then((found) => {
          if (active) {
            setResults(found);
            setSearchFailed(false);
          }
        })
        .catch(() => {
          if (active) setSearchFailed(true);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searching, term, seedlingId]);

  return (
    <form
      action={action}
      noValidate
      className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-4"
    >
      <h3 className="text-lg font-medium text-text-brand">{heading}</h3>
      <input type="hidden" name="seedlingId" value={seedlingId} />
      <input type="hidden" name="role" value={role} />
      <input
        type="hidden"
        name="parentSeedlingId"
        value={kind === "seedling" ? (chosen?.id ?? "") : ""}
      />
      {state.status === "error" && state.message ? (
        <FormMessage tone="error">{state.message}</FormMessage>
      ) : null}
      {state.status === "saved" ? <FormMessage tone="success">{state.message}</FormMessage> : null}

      <SelectField
        label={t("seedlings.parent.howKnown")}
        name="kind"
        value={kind}
        onChange={(event) => setKind(event.target.value as ParentDefaults["kind"])}
        error={errors.kind}
        options={[
          { value: "none", label: t("glossary.parentNotRecorded") },
          { value: "unknown", label: t("glossary.unknownParent") },
          { value: "seedling", label: t("glossary.aSeedling") },
          { value: "cultivar", label: t("glossary.namedCultivar") },
        ]}
      />

      {kind === "seedling" ? (
        <div className="flex flex-col gap-3">
          {chosen ? (
            <p className="flex flex-wrap items-center gap-2 text-base text-text">
              <span>{t("seedlings.parent.chosen", { label: chosen.label })}</span>
              <button
                type="button"
                onClick={() => setChosen(null)}
                className="min-h-11 rounded-control px-2 text-base font-medium text-text-brand underline underline-offset-4"
              >
                {t("seedlings.parent.change")}
              </button>
            </p>
          ) : null}
          <TextField
            label={t("seedlings.parent.findSeedling")}
            name="parentSearch"
            autoComplete="off"
            hint={t("seedlings.parent.findHint")}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            error={errors.parentSeedlingId}
          />
          {searchFailed ? (
            <p className="text-sm text-destructive">{t("errors.searchFailed")}</p>
          ) : null}
          {shown.length > 0 ? (
            <ul aria-label={t("seedlings.parent.matching")} className="flex flex-col gap-2">
              {shown.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    onClick={() => setChosen({ id: candidate.id, label: candidate.label })}
                    className="flex min-h-11 w-full flex-col items-start rounded-control border border-border bg-background px-3 py-2 text-left text-base text-text"
                  >
                    <span className="font-medium">{candidate.label}</span>
                    {candidate.ownerName ? (
                      <span className="text-sm text-text-muted">
                        {t("seedlings.parent.grownBy", { name: candidate.ownerName })}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : searching && !searchFailed ? (
            <p className="text-sm text-text-muted">{t("seedlings.parent.noMatch")}</p>
          ) : null}
        </div>
      ) : null}

      {kind === "cultivar" ? (
        <TextField
          label={t("seedlings.parent.cultivarName")}
          name="cultivarName"
          maxLength={80}
          defaultValue={defaults.cultivarName}
          error={errors.cultivarName}
          hint={t("seedlings.parent.cultivarHint")}
        />
      ) : null}

      <TextAreaField
        label={t("seedlings.parent.note")}
        name="notes"
        rows={2}
        maxLength={280}
        defaultValue={defaults.notes}
        error={errors.notes}
      />

      <SubmitButton pendingLabel={t("common.saving")}>
        {t("seedlings.parent.submit", { role: heading.toLocaleLowerCase(locale) })}
      </SubmitButton>
    </form>
  );
}
