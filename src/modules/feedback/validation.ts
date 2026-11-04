export const FEEDBACK_CATEGORIES = ["idea", "problem", "experience"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

/** The same bound the database enforces, counted after trimming. */
export const FEEDBACK_MESSAGE_MAX = 2000;

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return typeof value === "string" && (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

export function isFeedbackMessageValid(message: string): boolean {
  const length = message.trim().length;
  return length >= 1 && length <= FEEDBACK_MESSAGE_MAX;
}
