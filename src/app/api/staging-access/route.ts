import {
  STAGING_GATE_COOKIE,
  STAGING_GATE_LOGIN_PATH,
  STAGING_GATE_MAX_AGE_SECONDS,
  issueStagingToken,
  passwordMatches,
  safeNextPath,
  stagingGate,
} from "@/lib/security/staging-gate";
import {
  clearAttempts,
  isAttemptLimited,
  recordFailedAttempt,
} from "@/lib/security/staging-attempts";
import { visitorAddress } from "@/modules/invitations/visitor";

// The password is read at request time, so a change in the environment takes effect without a rebuild.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/*
 * The staging testing gate's form handler. A correct password sets a session cookie that is HttpOnly, Secure and SameSite=Lax, and sends
 * the visitor to the page they asked for. A wrong password returns to the gate with a message and is counted against the visitor's address.
 * After too many wrong attempts the gate refuses further attempts for a while, without checking the password. When the gate is off, this
 * route does not exist for anyone.
 */
export async function POST(request: Request): Promise<Response> {
  const gate = stagingGate(process.env);
  if (gate.state === "off") return new Response(null, { status: 404, headers: NO_STORE });
  if (gate.state === "misconfigured") {
    return new Response(null, { status: 503, headers: NO_STORE });
  }

  const address = visitorAddress(request.headers) ?? "unknown";
  const nowSeconds = Math.floor(Date.now() / 1000);

  const form = await request.formData();
  const submitted = form.get("password");
  const next = safeNextPath(typeof form.get("next") === "string" ? String(form.get("next")) : null);

  const back = (error: "1" | "limited") => {
    const location = new URL(STAGING_GATE_LOGIN_PATH, request.url);
    location.searchParams.set("error", error);
    location.searchParams.set("next", next);
    return new Response(null, {
      status: 303,
      headers: { ...NO_STORE, Location: location.toString() },
    });
  };

  if (isAttemptLimited(address, nowSeconds)) return back("limited");

  if (typeof submitted !== "string" || !passwordMatches(submitted, gate.password)) {
    recordFailedAttempt(address, nowSeconds);
    return back("1");
  }

  clearAttempts(address);
  const token = issueStagingToken(gate.password, nowSeconds);
  return new Response(null, {
    status: 303,
    headers: {
      ...NO_STORE,
      Location: new URL(next, request.url).toString(),
      "Set-Cookie": `${STAGING_GATE_COOKIE}=${token}; Path=/; Max-Age=${STAGING_GATE_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}
