"use client";

import {
  toggleGrowerFollowAction,
  toggleLikeAction,
  toggleSavedAction,
  toggleSeedlingFollowAction,
} from "@/modules/publications/actions";
import { useT } from "@/i18n/client";
import { ThumbIcon } from "@/design-system/icons";

/*
 * Social controls are plain forms that call server actions. They work without JavaScript. A visitor who
 * submits one is sent through the existing sign-in gate, and returns to the same place afterwards.
 * Each state is shown in words as well as by colour: "Liked" or "Like", "Saved" or "Save".
 */

const control =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface px-4 text-base font-medium text-text-brand transition-colors hover:border-text-brand";
const controlOn =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-text-brand bg-text-brand px-4 text-base font-medium text-surface transition-colors hover:brightness-110";

export function LikeForm({
  updateId,
  liked,
  count,
  showCount = true,
  quiet = false,
}: {
  readonly updateId: string;
  readonly liked: boolean;
  readonly count: number;
  /** The Feed shows the count in its own line, so its button can say only Like. */
  readonly showCount?: boolean;
  /** The quiet action of a conversation card: an icon and a word, no border. */
  readonly quiet?: boolean;
}) {
  const t = useT();
  if (quiet) {
    return (
      <form action={toggleLikeAction}>
        <input type="hidden" name="updateId" value={updateId} />
        <input type="hidden" name="on" value={liked ? "0" : "1"} />
        <button
          type="submit"
          aria-pressed={liked}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-control px-3 text-sm font-medium transition-colors hover:bg-background ${liked ? "font-semibold text-text-brand" : "text-text-muted hover:text-text-brand"}`}
        >
          <ThumbIcon className="size-[18px]" fill={liked ? "currentColor" : "none"} />
          {liked ? t("publication.social.liked") : t("publication.social.like")}
        </button>
      </form>
    );
  }
  return (
    <form action={toggleLikeAction}>
      <input type="hidden" name="updateId" value={updateId} />
      <input type="hidden" name="on" value={liked ? "0" : "1"} />
      <button type="submit" aria-pressed={liked} className={liked ? controlOn : control}>
        {liked ? t("publication.social.liked") : t("publication.social.like")}
        {showCount ? <span className="ml-2 text-sm font-normal">{count}</span> : null}
      </button>
    </form>
  );
}

export function SeedlingActions({
  seedlingId,
  followed,
  saved,
  returnTo,
}: {
  readonly seedlingId: string;
  readonly followed: boolean;
  readonly saved: boolean;
  readonly returnTo: string;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-3">
      <form action={toggleSeedlingFollowAction}>
        <input type="hidden" name="seedlingId" value={seedlingId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="on" value={followed ? "0" : "1"} />
        <button type="submit" aria-pressed={followed} className={followed ? controlOn : control}>
          {followed
            ? t("publication.social.followingSeedling")
            : t("publication.social.followSeedling")}
        </button>
      </form>
      <form action={toggleSavedAction}>
        <input type="hidden" name="seedlingId" value={seedlingId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="on" value={saved ? "0" : "1"} />
        <button type="submit" aria-pressed={saved} className={saved ? controlOn : control}>
          {saved ? t("publication.social.savedPrivately") : t("publication.social.save")}
        </button>
      </form>
    </div>
  );
}

export function GrowerFollowForm({
  profileId,
  following,
  returnTo,
}: {
  readonly profileId: string;
  readonly following: boolean;
  readonly returnTo: string;
}) {
  const t = useT();
  return (
    <form action={toggleGrowerFollowAction}>
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="on" value={following ? "0" : "1"} />
      <button type="submit" aria-pressed={following} className={following ? controlOn : control}>
        {following ? t("publication.social.followingGrower") : t("publication.social.followGrower")}
      </button>
    </form>
  );
}
