import {
  toggleGrowerFollowAction,
  toggleLikeAction,
  toggleSavedAction,
  toggleSeedlingFollowAction,
} from "@/modules/publications/actions";

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
}: {
  readonly updateId: string;
  readonly liked: boolean;
  readonly count: number;
}) {
  return (
    <form action={toggleLikeAction}>
      <input type="hidden" name="updateId" value={updateId} />
      <input type="hidden" name="on" value={liked ? "0" : "1"} />
      <button type="submit" aria-pressed={liked} className={liked ? controlOn : control}>
        {liked ? "Liked" : "Like"}
        <span className="ml-2 text-sm font-normal">{count}</span>
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
  return (
    <div className="flex flex-wrap gap-3">
      <form action={toggleSeedlingFollowAction}>
        <input type="hidden" name="seedlingId" value={seedlingId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="on" value={followed ? "0" : "1"} />
        <button type="submit" aria-pressed={followed} className={followed ? controlOn : control}>
          {followed ? "Following this seedling" : "Follow this seedling"}
        </button>
      </form>
      <form action={toggleSavedAction}>
        <input type="hidden" name="seedlingId" value={seedlingId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="on" value={saved ? "0" : "1"} />
        <button type="submit" aria-pressed={saved} className={saved ? controlOn : control}>
          {saved ? "Saved privately" : "Save"}
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
  return (
    <form action={toggleGrowerFollowAction}>
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="on" value={following ? "0" : "1"} />
      <button type="submit" aria-pressed={following} className={following ? controlOn : control}>
        {following ? "Following this grower" : "Follow this grower"}
      </button>
    </form>
  );
}
