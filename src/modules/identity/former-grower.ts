/*
 * A deleted grower's profile keeps the stored name below, so the database never has to store a language. Every place that shows a
 * grower's name passes it through displayedName, which returns the localized "former grower" label for that stored name and the name
 * unchanged for everyone else. Conditions still test the raw name, so the label never changes who is shown or who may act.
 *
 * The name is reserved: a database trigger refuses it for any active account, and the profile form refuses it too. So a grower who chooses
 * that text is never treated as an erased account, and the stored name only appears on an account that has left.
 */
export const FORMER_GROWER_NAME = "Former grower";

export function displayedName(name: string, formerLabel: string): string {
  return name === FORMER_GROWER_NAME ? formerLabel : name;
}
