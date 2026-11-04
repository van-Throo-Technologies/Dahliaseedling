import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  localeOrDefault,
  renderAvailabilityEmail,
  seedlingUrl,
} from "./availability-email";

const base = "https://dahlia.example";
const id = "5b0e0c52-2d7a-4a57-9a0e-2f1f1d6c6f10";

describe("availability email, by language", () => {
  it("English names the Seedling, says it is available, and links to its page", () => {
    const mail = renderAvailabilityEmail({
      locale: "en",
      seedlingName: "Sunset Dream",
      seedlingId: id,
      baseUrl: base,
    });
    expect(mail.subject).toBe("A Seedling you asked about is now available");
    expect(mail.text).toContain("The Seedling “Sunset Dream” is now available to continue.");
    expect(mail.text).toContain(`${base}/seedlings/${id}`);
    expect(mail.text).toContain("Availability is not a reservation");
  });

  it("Dutch and French use the same structure and their own wording", () => {
    const nl = renderAvailabilityEmail({
      locale: "nl",
      seedlingName: "Sunset Dream",
      seedlingId: id,
      baseUrl: base,
    });
    const fr = renderAvailabilityEmail({
      locale: "fr",
      seedlingName: "Sunset Dream",
      seedlingId: id,
      baseUrl: base,
    });
    expect(nl.subject).toBe("Een zaailing waar je om vroeg is, is nu beschikbaar");
    expect(nl.text).toContain("De zaailing “Sunset Dream” is nu beschikbaar om verder te kweken.");
    expect(fr.subject).toBe("Un semis que vous avez demandé est maintenant disponible");
    expect(fr.text).toContain(
      "Le semis « Sunset Dream » est maintenant disponible pour être poursuivi.",
    );
    expect(nl.html).toContain('<html lang="nl">');
    expect(fr.html).toContain('<html lang="fr">');
  });

  it("an unknown or missing language uses the English fallback", () => {
    expect(localeOrDefault("de")).toBe("en");
    expect(localeOrDefault("")).toBe("en");
    const mail = renderAvailabilityEmail({
      locale: "de",
      seedlingName: "X",
      seedlingId: id,
      baseUrl: base,
    });
    expect(mail.subject).toBe("A Seedling you asked about is now available");
    expect(mail.html).toContain('<html lang="en">');
  });

  it("without a working name the message does not invent one", () => {
    const mail = renderAvailabilityEmail({
      locale: "en",
      seedlingName: null,
      seedlingId: id,
      baseUrl: base,
    });
    const body = mail.text.split("\n")[0] ?? "";
    expect(body.startsWith("A Seedling you asked about is now available to continue.")).toBe(true);
    expect(body).not.toContain("“");
  });
});

describe("availability email, content boundaries", () => {
  it("contains only the Seedling name, one safe link and the stop hint; nothing else reaches the message", () => {
    const mail = renderAvailabilityEmail({
      locale: "en",
      seedlingName: "Sunset Dream",
      seedlingId: id,
      baseUrl: base,
    });
    const everything = `${mail.subject}\n${mail.text}\n${mail.html}`;
    const links = everything.match(new RegExp(`${base}/seedlings/[0-9a-f-]+`, "g"));
    expect(links).toEqual([`${base}/seedlings/${id}`, `${base}/seedlings/${id}`]);
    expect(everything.match(/https?:\/\//g)).toHaveLength(2);
    expect(everything).not.toMatch(/@/);
    expect(everything).not.toMatch(/recommend|other Seedlings|offer|interest/i);
  });

  it("escapes a Seedling name so markup in it cannot change the HTML", () => {
    const mail = renderAvailabilityEmail({
      locale: "en",
      seedlingName: `<img src=x onerror="alert(1)"> & 'quoted'`,
      seedlingId: id,
      baseUrl: base,
    });
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;quoted&#39;",
    );
  });

  it("builds the link only from the base URL and a UUID, with no trailing slash doubled", () => {
    expect(seedlingUrl("https://dahlia.example/", id)).toBe(
      `https://dahlia.example/seedlings/${id}`,
    );
    expect(escapeHtml(`a"b`)).toBe("a&quot;b");
  });
});
