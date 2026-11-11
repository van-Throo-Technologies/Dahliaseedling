"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

/*
 * Cloudflare Turnstile, rendered explicitly into a container inside the form. Each form renders its own widget, so each protected surface
 * has its own widget ID. The widget adds its token to the form as the cf-turnstile-response field, which the server passes to Supabase
 * Auth. Supabase performs the server-side verification with the secret key kept in its dashboard; this component never sees the secret.
 *
 * Tokens are single-use and expire after a short time. The widget resets after each failed attempt, and refreshes itself when a token
 * expires, so the next submission always carries a valid token.
 */

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileOptions = {
  sitekey: string;
  action: string;
  size: "flexible";
  theme: "auto";
  "expired-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({
  siteKey,
  action,
  label,
  resetSignal,
}: {
  readonly siteKey: string;
  /** The surface this challenge protects, such as sign-up. Cloudflare records it with each challenge. */
  readonly action: string;
  readonly label: string;
  /** Changes whenever the form receives a new result, so a used token is replaced. */
  readonly resetSignal: unknown;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const firstSignal = useRef(true);
  // The script may already be loaded when this form is shown again. The markup does not depend on this value, so reading it at mount is safe.
  const [ready, setReady] = useState(
    () => typeof window !== "undefined" && window.turnstile !== undefined,
  );

  useEffect(() => {
    const turnstile = window.turnstile;
    if (!ready || !turnstile || !container.current) return;
    const id = turnstile.render(container.current, {
      sitekey: siteKey,
      action,
      size: "flexible",
      theme: "auto",
      "expired-callback": () => turnstile.reset(id),
    });
    widgetId.current = id;
    return () => {
      turnstile.remove(id);
      widgetId.current = null;
    };
  }, [ready, siteKey, action]);

  useEffect(() => {
    if (firstSignal.current) {
      firstSignal.current = false;
      return;
    }
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, [resetSignal]);

  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-col gap-2">
      <Script src={TURNSTILE_SCRIPT} strategy="afterInteractive" onReady={() => setReady(true)} />
      <div ref={container} className="min-w-0 max-w-full" />
    </div>
  );
}
