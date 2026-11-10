/*
 * The short-lived mark that a browser has opened a valid password-reset link. The confirmation route sets it after the link checks out,
 * and the new-password action refuses without it. A session alone is not enough, so an ordinary signed-in visitor cannot change a password
 * this way. The mark holds no secret: it only shows that the link was opened here, recently.
 */
export const RESET_COOKIE = "ds_password_reset";
export const RESET_WINDOW_SECONDS = 15 * 60;

export const resetCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: RESET_WINDOW_SECONDS,
};
