import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { COUNTRIES } from "@/modules/identity/country-codes";

/*
 * Form controls. Each one labels its input, links hint and error text with aria-describedby,
 * and marks invalid input with aria-invalid. The error is text, so it never relies on colour.
 * Inputs use 16px text so mobile browsers do not zoom on focus.
 */

interface FieldFrameProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly children: (describedBy: string | undefined) => ReactNode;
}

function FieldFrame({ id, label, hint, error, children }: FieldFrameProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-medium text-text">
        {label}
      </label>
      {children(describedBy)}
      {hint ? (
        <p id={hintId} className="text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const controlClasses =
  "min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 text-base text-text placeholder:text-text-muted aria-[invalid=true]:border-destructive";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
  readonly name: string;
  readonly error?: string;
  readonly hint?: string;
}

export function TextField({ label, name, error, hint, ...input }: TextFieldProps) {
  const id = `field-${name}`;
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <input
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={controlClasses}
          {...input}
        />
      )}
    </FieldFrame>
  );
}

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly label: string;
  readonly name: string;
  readonly error?: string;
  readonly hint?: string;
}

export function TextAreaField({ label, name, error, hint, ...textarea }: TextAreaFieldProps) {
  const id = `field-${name}`;
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <textarea
          id={id}
          name={name}
          rows={4}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${controlClasses} min-h-28`}
          {...textarea}
        />
      )}
    </FieldFrame>
  );
}

export interface CountrySelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly label: string;
  readonly name: string;
  readonly error?: string;
  readonly hint?: string;
}

export function CountrySelect({ label, name, error, hint, ...select }: CountrySelectProps) {
  const id = `field-${name}`;
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <select
          id={id}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={controlClasses}
          {...select}
        >
          <option value="">Choose a country</option>
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
      )}
    </FieldFrame>
  );
}

export interface FileFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
  readonly name: string;
  readonly error?: string;
  readonly hint?: string;
}

export function FileField({ label, name, error, hint, ...input }: FileFieldProps) {
  const id = `field-${name}`;
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <input
          id={id}
          name={name}
          type="file"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="min-h-11 w-full text-base text-text file:mr-3 file:min-h-11 file:rounded-control file:border file:border-border file:bg-surface file:px-4 file:text-text-brand"
          {...input}
        />
      )}
    </FieldFrame>
  );
}
