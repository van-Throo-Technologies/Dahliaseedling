import type { Translator } from "@/i18n/translator";

/**
 * The translated words a Seedling label is built from. The identifier itself ("#14", "JV-26-014") is never
 * translated; only the word in front of an automatic number is.
 */
export interface LabelWords {
  readonly seedling: string;
  readonly automatic: (number: string) => string;
}

export function labelWords(t: Translator): LabelWords {
  const seedling = t("glossary.seedling");
  return {
    seedling,
    automatic: (number) => t("seedlings.label.automatic", { seedling, number }),
  };
}
