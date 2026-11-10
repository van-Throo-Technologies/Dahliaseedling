import { expect, test } from "@playwright/test";

/*
 * The staging testing gate, end to end. It runs only when the server is started with STAGING_ACCESS_PASSWORD set on a non-production
 * branch, for example: STAGING_ACCESS_PASSWORD=<password> VERCEL_GIT_COMMIT_REF=staging npx playwright test tests/e2e/staging-gate.spec.ts
 * Without that, the gate is off and these tests are skipped, so the rest of the suite is unaffected.
 */

const PASSWORD = process.env.STAGING_ACCESS_PASSWORD ?? "";
const gateOn = PASSWORD !== "" && process.env.VERCEL_GIT_COMMIT_REF !== "main";

test.skip(!gateOn, "The staging gate is off: set STAGING_ACCESS_PASSWORD on a non-main branch");

test.describe.configure({ mode: "serial" });

/** Reads the session cookie a successful login sets, from the response headers, so the test can send it back. */
function sessionCookie(setCookie: string | undefined): string {
  const pair = (setCookie ?? "").split(";")[0] ?? "";
  return pair;
}

test("pages and API routes send a visitor without a session to the gate", async ({ request }) => {
  const page = await request.get("/", { maxRedirects: 0 });
  expect(page.status()).toBe(307);
  expect(page.headers().location).toContain("/staging-access");
  expect(page.headers().location).toContain("next=%2F");

  const capture = await request.get("/capture", { maxRedirects: 0 });
  expect(capture.status()).toBe(307);

  const api = await request.get("/api/email/deliver", { maxRedirects: 0 });
  expect(api.status()).toBe(401);
});

test("the gate page and its static files are open, and the page holds no secret", async ({
  request,
}) => {
  const gate = await request.get("/staging-access?next=%2Fcapture", { maxRedirects: 0 });
  expect(gate.status()).toBe(200);
  const html = await gate.text();
  expect(html).toContain('type="password"');
  expect(html).toContain('action="/api/staging-access"');
  expect(html).not.toContain(PASSWORD);
});

test("a wrong password sets no cookie and returns to the gate with a message", async ({
  request,
}) => {
  const response = await request.post("/api/staging-access", {
    form: { password: `${PASSWORD}-wrong`, next: "/capture" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers()["set-cookie"]).toBeUndefined();
  expect(response.headers().location).toContain("/staging-access");
  expect(response.headers().location).toContain("error=1");
});

test("the right password sets an HttpOnly, Secure, SameSite session cookie, and the visitor reaches the site", async ({
  request,
}) => {
  const response = await request.post("/api/staging-access", {
    form: { password: PASSWORD, next: "/sign-in" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toMatch(/\/sign-in$/);
  const setCookie = response.headers()["set-cookie"] ?? "";
  expect(setCookie).toContain("ds_staging_access=");
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("Secure");
  expect(setCookie).toContain("SameSite=Lax");
  expect(setCookie).toContain("Max-Age=1209600");
  expect(setCookie).not.toContain(PASSWORD);

  const cookie = sessionCookie(setCookie);
  const signIn = await request.get("/sign-in", { maxRedirects: 0, headers: { cookie } });
  expect(signIn.status()).toBe(200);
});

test("a tampered session cookie is refused", async ({ request }) => {
  const response = await request.post("/api/staging-access", {
    form: { password: PASSWORD, next: "/" },
    maxRedirects: 0,
  });
  const cookie = sessionCookie(response.headers()["set-cookie"]);
  const [name, value = ""] = cookie.split("=");
  const forged = `${name}=${value.replace(/.$/, value.endsWith("A") ? "B" : "A")}`;
  const refused = await request.get("/capture", { maxRedirects: 0, headers: { cookie: forged } });
  expect(refused.status()).toBe(307);
});

test("the next address after the gate cannot send the visitor off the site", async ({
  request,
}) => {
  const response = await request.post("/api/staging-access", {
    form: { password: PASSWORD, next: "//example.invalid" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  // The redirect stays on the host the server answered for, and lands on the Home page, not on the address the visitor was sent.
  const target = new URL(response.headers().location ?? "", "http://127.0.0.1");
  expect(target.hostname).not.toBe("example.invalid");
  expect(target.pathname).toBe("/");
});

test("a request with no body is refused as malformed, with no session", async ({ request }) => {
  const response = await request.post("/api/staging-access", { maxRedirects: 0 });
  expect(response.status()).toBe(400);
  expect(response.headers()["set-cookie"]).toBeUndefined();
});

test("a malformed multipart body is refused as malformed, with no session", async ({ request }) => {
  const response = await request.post("/api/staging-access", {
    headers: { "content-type": "multipart/form-data" },
    data: "not a real multipart body",
    maxRedirects: 0,
  });
  expect(response.status()).toBe(400);
  expect(response.headers()["set-cookie"]).toBeUndefined();
});

test("a JSON body is refused as malformed, with no session", async ({ request }) => {
  const response = await request.post("/api/staging-access", {
    data: { password: PASSWORD, next: "/" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(400);
  expect(response.headers()["set-cookie"]).toBeUndefined();
});

test("an empty form counts as a wrong password, and sets no session", async ({ request }) => {
  const response = await request.post("/api/staging-access", { form: {}, maxRedirects: 0 });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toContain("error=1");
  expect(response.headers()["set-cookie"]).toBeUndefined();
});

// Last, because it uses up this connection's allowance of wrong attempts, and every request in this file shares that connection.
test("repeated wrong passwords stop the gate from checking the password for a while", async ({
  request,
}) => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await request.post("/api/staging-access", {
      form: { password: `${PASSWORD}-wrong-${attempt}`, next: "/" },
      maxRedirects: 0,
    });
  }
  const response = await request.post("/api/staging-access", {
    form: { password: PASSWORD, next: "/" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toContain("error=limited");
  expect(response.headers()["set-cookie"]).toBeUndefined();
});
