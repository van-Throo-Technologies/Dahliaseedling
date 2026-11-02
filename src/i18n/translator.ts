import { interpolate } from "./format";
import type { Messages } from "./messages";

/** Every dotted path to a message, for example "identity.signIn.title". Derived from English, so it is checked. */
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type Values = Readonly<Record<string, string | number>>;
export type Translator = (key: MessageKey, values?: Values) => string;

function lookup(tree: unknown, key: string): string | undefined {
  let node: unknown = tree;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Returns the message for a key in the active language. Keys are checked by the type system against the English
 * dictionary, and the parity test checks Dutch and French, so a key that is missing here is a development error.
 * It is reported in development and never shown as a raw key in the normal interface.
 */
export function createTranslator(messages: Messages): Translator {
  return (key, values) => {
    const text = lookup(messages, key);
    if (text === undefined) {
      if (process.env.NODE_ENV !== "production") console.error(`Missing translation: ${key}`);
      return "";
    }
    return interpolate(text, values);
  };
}
