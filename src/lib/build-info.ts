/*
 * The build identifier sent with feedback so a report can be matched to the code that produced it. It is a short commit identifier or a
 * label, never a secret, and it is read on the server only.
 */
const fromEnv =
  process.env.APP_BUILD_ID?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 7) || "";

export const APP_BUILD: string = fromEnv.length > 0 && fromEnv.length <= 40 ? fromEnv : "dev";
