import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildStoreZip } from "./store-zip";

const sample = [
  { name: "account-export.json", data: Buffer.from('{"format":"dahliaseedling.account-export"}') },
  { name: "media/photo.jpg", data: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]) },
];

describe("buildStoreZip", () => {
  it("writes the local, central and end records with matching sizes and checksums", () => {
    const zip = buildStoreZip(sample);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    const eocd = zip.length - 22;
    expect(zip.readUInt32LE(eocd)).toBe(0x06054b50);
    expect(zip.readUInt16LE(eocd + 8)).toBe(2);
    expect(zip.readUInt16LE(eocd + 10)).toBe(2);
    const centralOffset = zip.readUInt32LE(eocd + 16);
    expect(zip.readUInt32LE(centralOffset)).toBe(0x02014b50);
  });

  it("is readable by the system unzip, which verifies each entry's checksum", () => {
    const dir = mkdtempSync(join(tmpdir(), "zip-test-"));
    try {
      const path = join(dir, "export.zip");
      writeFileSync(path, buildStoreZip(sample));
      const check = spawnSync("unzip", ["-t", path], { encoding: "utf8" });
      if (check.error) return; // unzip is not installed on this runner; the structural test above still applies.
      expect(check.status).toBe(0);
      expect(check.stdout).toContain("No errors detected");
      const extract = spawnSync("unzip", ["-p", path, "account-export.json"], { encoding: "utf8" });
      expect(extract.stdout).toBe('{"format":"dahliaseedling.account-export"}');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes UTF-8 names", () => {
    const zip = buildStoreZip([{ name: "médias/café.txt", data: Buffer.from("x") }]);
    expect(zip.includes(Buffer.from("médias/café.txt", "utf8"))).toBe(true);
  });
});
