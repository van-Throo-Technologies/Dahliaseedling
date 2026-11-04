import { FormMessage } from "@/design-system/components/form-message";
import { getTranslation } from "@/i18n/server";
import { MESSAGING_ERRORS, MESSAGING_NOTICES } from "./feedback";

/*
 * The result of a messaging, reporting, blocking or subscription action, shown on the page the grower came from. Unknown keys
 * show nothing, so an old or edited address never displays raw text.
 */
export async function MessagingFeedback({
  error,
  notice,
}: {
  readonly error?: string | null;
  readonly notice?: string | null;
}) {
  const { t } = await getTranslation();
  const errorKey = error ? MESSAGING_ERRORS[error] : undefined;
  const noticeKey = notice ? MESSAGING_NOTICES[notice] : undefined;
  if (!errorKey && !noticeKey) return null;
  return (
    <div className="flex flex-col gap-2">
      {noticeKey ? <FormMessage tone="success">{t(noticeKey)}</FormMessage> : null}
      {errorKey ? <FormMessage tone="error">{t(errorKey)}</FormMessage> : null}
    </div>
  );
}
