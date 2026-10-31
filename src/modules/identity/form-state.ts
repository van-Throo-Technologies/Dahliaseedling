/**
 * Shared shape for form results returned by server actions to client forms.
 *
 * `values` echoes back non-sensitive submitted fields. React resets uncontrolled inputs after an
 * action, so the form uses these to keep what the user typed. Passwords are never echoed.
 */
export type FormState =
  | { readonly status: "idle" }
  | {
      readonly status: "error";
      readonly message?: string;
      readonly fieldErrors: Readonly<Record<string, string>>;
      readonly values?: Readonly<Record<string, string>>;
    }
  | { readonly status: "saved"; readonly message: string };

export const IDLE_FORM_STATE: FormState = { status: "idle" };
