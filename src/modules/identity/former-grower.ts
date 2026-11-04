/*
 * A deleted grower's profile keeps the stored name below, so the database never has to store a language. Every place that shows a
 * grower's name passes it through displayedName, which returns the localized "former grower" label for that stored name and the name
 * unchanged for everyone else. Conditions still test the raw name, so the label never changes who is shown or who may act.
 */
export const FORMER_GROWER_NAME = "Former grower";

export function displayedName(name: string, formerLabel: string): string {
  return name === FORMER_GROWER_NAME ? formerLabel : name;
}
