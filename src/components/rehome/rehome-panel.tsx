import Link from "next/link";
import { FormMessage } from "@/design-system/components/form-message";
import { StartConversation } from "@/components/messaging/start-conversation";
import { formatDate } from "@/i18n/format";
import { getTranslation } from "@/i18n/server";
import type { MessageKey } from "@/i18n/translator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  chooseRecipientAction,
  declineRecipientAction,
  expressInterestAction,
  markSentAction,
  reopenAction,
  withdrawAvailabilityAction,
  withdrawInterestAction,
} from "@/modules/rehome/actions";
import {
  readRehomePanel,
  type RehomePanel as Panel,
  type RehomeCase,
} from "@/modules/rehome/repository";
import { displayedName } from "@/modules/identity/former-grower";

/*
 * The continuation panel on a Seedling page. What appears depends on the reader's role and the case's state, and the
 * database has already decided what the reader may see. A visitor sees only that the Seedling is looking for a new
 * grower and its terms. The holder sees the interests and chooses. A recipient sees their own receipt action.
 */

const NOTICE: Record<string, MessageKey> = {
  started: "rehome.notice.started",
  interestRecorded: "rehome.notice.interestRecorded",
  interestWithdrawn: "rehome.notice.interestWithdrawn",
  chosen: "rehome.notice.chosen",
  declined: "rehome.notice.declined",
  sent: "rehome.notice.sent",
  reopened: "rehome.notice.reopened",
  withdrawn: "rehome.notice.withdrawn",
  received: "rehome.notice.received",
  alreadyReceived: "rehome.notice.alreadyReceived",
  stale: "rehome.notice.stale",
};

const FAILURE: Record<string, MessageKey> = {
  notAllowed: "rehome.errors.notAllowed",
  notAvailable: "rehome.errors.notAvailable",
  makePublicFirst: "rehome.errors.makePublicFirst",
  rateLimited: "safety.errors.rateLimited",
  note: "rehome.errors.note",
  generic: "rehome.errors.generic",
};

const TERM: Record<string, MessageKey> = {
  donate: "rehome.terms.donate",
  sell: "rehome.terms.sell",
  trade: "rehome.terms.trade",
};

const HANDOVER: Record<string, MessageKey> = {
  pickup: "rehome.handover.pickup",
  shipping: "rehome.handover.shipping",
  both: "rehome.handover.both",
};

const PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 text-base font-medium text-on-primary";
const SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand";

function Terms({
  item,
  t,
}: {
  readonly item: RehomeCase;
  readonly t: (key: MessageKey, values?: Record<string, string>) => string;
}) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base text-text">
      {item.term ? (
        <>
          <dt className="text-text-muted">{t("rehome.panel.termLabel")}</dt>
          <dd>{t(TERM[item.term]!)}</dd>
        </>
      ) : null}
      {item.priceText ? (
        <>
          <dt className="text-text-muted">{t("rehome.panel.priceLabel")}</dt>
          <dd>{item.priceText}</dd>
        </>
      ) : null}
      {item.handover ? (
        <>
          <dt className="text-text-muted">{t("rehome.panel.handoverLabel")}</dt>
          <dd>{t(HANDOVER[item.handover]!)}</dd>
        </>
      ) : null}
      {item.note ? (
        <>
          <dt className="text-text-muted">{t("rehome.panel.noteLabel")}</dt>
          <dd className="whitespace-pre-line">{item.note}</dd>
        </>
      ) : null}
    </dl>
  );
}

export async function RehomePanel({
  seedlingId,
  holderId,
  notice,
  failure,
}: {
  readonly seedlingId: string;
  /** The current holder. Used only to open a conversation with them; the panel never shows it. */
  readonly holderId?: string;
  readonly notice?: string;
  readonly failure?: string;
}) {
  const { t, locale } = await getTranslation();
  const supabase = await createSupabaseServerClient();
  const panel: Panel | null = await readRehomePanel(supabase, seedlingId);
  if (!panel) return null;
  const item = panel.case;
  const here = `/seedlings/${seedlingId}`;
  const activeCase =
    item && (item.status === "available" || item.status === "arranged" || item.status === "sent");
  const chosenName = item?.chosenRecipientId
    ? panel.interests.find((interest) => interest.userId === item.chosenRecipientId)?.displayName
    : undefined;

  const alerts = (
    <>
      {notice && NOTICE[notice] ? (
        <FormMessage tone="success">{t(NOTICE[notice]!)}</FormMessage>
      ) : null}
      {failure && FAILURE[failure] ? (
        <FormMessage tone="error">{t(FAILURE[failure]!)}</FormMessage>
      ) : null}
    </>
  );

  // The holder with nothing active: the way to start.
  if (!activeCase) {
    if (panel.role !== "holder") return null;
    return (
      <section aria-labelledby="rehome-title" className="flex flex-col gap-3">
        <h2 id="rehome-title" className="text-lg font-medium text-text">
          {t("rehome.panel.title")}
        </h2>
        {alerts}
        <p className="text-base text-text-muted">{t("rehome.panel.holderFootnote")}</p>
        <Link href={`${here}/rehome`} className={SECONDARY}>
          {t("rehome.panel.notKeepingLink")}
        </Link>
      </section>
    );
  }

  const status = item!.status;
  const isHolder = panel.role === "holder";
  const isRecipient = panel.role === "recipient";
  const isInterested = panel.role === "interested";

  // Arranged or sent: a recipient has been chosen. Its name is shown only to the holder and the recipient.
  if (status === "arranged" || status === "sent") {
    return (
      <section
        aria-labelledby="rehome-title"
        className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-4"
      >
        <h2 id="rehome-title" className="text-lg font-medium text-text">
          {t("rehome.panel.chosenTitle")}
        </h2>
        {alerts}
        {isHolder ? (
          <>
            <p className="text-base text-text">
              {chosenName ? displayedName(chosenName, t("privacy.formerGrower")) : ""}
            </p>
            <p className="text-base text-text-muted">{t("rehome.panel.chosenText")}</p>
            <Terms item={item!} t={t} />
            <div className="flex flex-col gap-3 sm:flex-row">
              {status === "arranged" ? (
                <form action={markSentAction}>
                  <input type="hidden" name="seedlingId" value={seedlingId} />
                  <input type="hidden" name="caseId" value={item!.id} />
                  <button type="submit" className={SECONDARY}>
                    {t("rehome.panel.markSent")}
                  </button>
                </form>
              ) : null}
              <form action={reopenAction}>
                <input type="hidden" name="seedlingId" value={seedlingId} />
                <input type="hidden" name="caseId" value={item!.id} />
                <button type="submit" className={SECONDARY}>
                  {t("rehome.panel.reopen")}
                </button>
              </form>
              <form action={withdrawAvailabilityAction}>
                <input type="hidden" name="seedlingId" value={seedlingId} />
                <input type="hidden" name="caseId" value={item!.id} />
                <button type="submit" className={SECONDARY}>
                  {t("rehome.panel.withdrawAvailability")}
                </button>
              </form>
            </div>
          </>
        ) : null}
        {isRecipient ? (
          <>
            <p className="text-base text-text-muted">{t("rehome.panel.chosenText")}</p>
            <Link href={`${here}/receive`} className={PRIMARY}>
              {t("rehome.panel.confirmReceiptLink")}
            </Link>
            {status === "arranged" ? (
              <form action={declineRecipientAction} className="flex flex-col gap-2">
                <p className="text-sm text-text-muted">{t("rehome.panel.declineText")}</p>
                <input type="hidden" name="seedlingId" value={seedlingId} />
                <input type="hidden" name="caseId" value={item!.id} />
                <button type="submit" className={SECONDARY}>
                  {t("rehome.panel.declineButton")}
                </button>
              </form>
            ) : null}
          </>
        ) : null}
        {isInterested ? (
          <p className="text-base text-text-muted">{t("rehome.panel.chosenNotYou")}</p>
        ) : null}
      </section>
    );
  }

  // Available: the holder chooses; others may express interest.
  return (
    <section
      aria-labelledby="rehome-title"
      className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-4"
    >
      <h2 id="rehome-title" className="text-lg font-medium text-text">
        {isHolder ? t("rehome.panel.title") : t("rehome.panel.availableTitle")}
      </h2>
      {alerts}
      {!isHolder ? (
        <p className="text-base text-text-muted">{t("rehome.panel.availableText")}</p>
      ) : null}
      <Terms item={item!} t={t} />

      {isHolder ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-medium text-text">{t("rehome.panel.interestedTitle")}</h3>
          <p className="text-sm text-text-muted">{t("rehome.panel.interestedOnlyHolder")}</p>
          {panel.interests.filter((interest) => interest.active).length === 0 ? (
            <p className="text-base text-text-muted">{t("rehome.panel.interestedNone")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {panel.interests
                .filter((interest) => interest.active)
                .map((interest) => (
                  <li
                    key={interest.id}
                    className="flex flex-col gap-2 rounded-control border border-border p-3"
                  >
                    <span className="text-base font-medium text-text">
                      {displayedName(interest.displayName, t("privacy.formerGrower"))}
                    </span>
                    <span className="text-sm text-text-muted">
                      {formatDate(interest.createdAt, locale)}
                    </span>
                    <StartConversation
                      kind="rehome"
                      target={item!.id}
                      other={interest.userId}
                      returnTo={`/seedlings/${seedlingId}`}
                      label={t("messaging.start.rehome")}
                      id={`start-rehome-${interest.userId}`}
                    />
                    <form action={chooseRecipientAction}>
                      <input type="hidden" name="seedlingId" value={seedlingId} />
                      <input type="hidden" name="caseId" value={item!.id} />
                      <input type="hidden" name="recipientId" value={interest.userId} />
                      <button type="submit" className={PRIMARY}>
                        {t("rehome.panel.choose")}
                      </button>
                    </form>
                  </li>
                ))}
            </ul>
          )}
          <form action={withdrawAvailabilityAction}>
            <input type="hidden" name="seedlingId" value={seedlingId} />
            <input type="hidden" name="caseId" value={item!.id} />
            <button type="submit" className={SECONDARY}>
              {t("rehome.panel.withdrawAvailability")}
            </button>
          </form>
        </div>
      ) : null}

      {!isHolder && panel.hasInterest ? (
        <div className="flex flex-col gap-3">
          <p className="text-base text-text-muted">{t("rehome.panel.interestRecorded")}</p>
          {holderId ? (
            <StartConversation
              kind="rehome"
              target={item!.id}
              other={holderId}
              returnTo={`/seedlings/${seedlingId}`}
              label={t("messaging.start.rehome")}
              id="start-rehome-holder"
            />
          ) : null}
          <form action={withdrawInterestAction}>
            <input type="hidden" name="seedlingId" value={seedlingId} />
            <input type="hidden" name="caseId" value={item!.id} />
            <button type="submit" className={SECONDARY}>
              {t("rehome.panel.withdrawInterest")}
            </button>
          </form>
        </div>
      ) : null}

      {!isHolder && !panel.hasInterest && panel.canExpressInterest ? (
        <form action={expressInterestAction}>
          <input type="hidden" name="seedlingId" value={seedlingId} />
          <input type="hidden" name="caseId" value={item!.id} />
          <button type="submit" className={PRIMARY}>
            {t("rehome.panel.expressInterest")}
          </button>
        </form>
      ) : null}

      {!isHolder && !panel.signedIn ? (
        <Link href={`/sign-in?next=${encodeURIComponent(here)}`} className={PRIMARY}>
          {t("rehome.panel.signInToInterest")}
        </Link>
      ) : null}
    </section>
  );
}

export type { Panel as RehomePanelState };
