import type { MessageKey, Translator, Values } from "./translator";

/**
 * A message the domain or validation layer wants shown: a key and its values, not a sentence. Validators return
 * these, so the same rule works in the browser and on the server, and the sentence is chosen at the last moment.
 */
export interface Msg {
  readonly key: MessageKey;
  readonly values?: Values;
}

export function msg(key: MessageKey, values?: Values): Msg {
  return values ? { key, values } : { key };
}

export function translateMsg(t: Translator, message: Msg): string {
  return t(message.key, message.values);
}

/** Turns a map of field errors into the sentences a form shows. */
export function translateFields(
  t: Translator,
  fields: Readonly<Record<string, Msg>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, message] of Object.entries(fields)) out[name] = translateMsg(t, message);
  return out;
}
