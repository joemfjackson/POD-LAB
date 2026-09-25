import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, encryptionConfigured, secretHint } from "@/lib/crypto";
import { sanitizeFilename, validateUpload } from "@/server/services/files";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("credential encryption", () => {
  afterEach(() => {
    delete process.env.POD_LAB_ENCRYPTION_KEY;
  });

  it("round-trips with AES-256-GCM and random IVs", () => {
    process.env.POD_LAB_ENCRYPTION_KEY = KEY;
    const a = encryptSecret("sk-test-123456");
    const b = encryptSecret("sk-test-123456");
    expect(a).not.toBe(b);
    expect(a.startsWith("v1.")).toBe(true);
    expect(decryptSecret(a)).toBe("sk-test-123456");
  });

  it("detects tampering", () => {
    process.env.POD_LAB_ENCRYPTION_KEY = KEY;
    const parts = encryptSecret("secret-value").split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("requires a 32-byte key", () => {
    expect(encryptionConfigured()).toBe(false);
    process.env.POD_LAB_ENCRYPTION_KEY = "short";
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
  });

  it("shows only a hint", () => {
    expect(secretHint("sk-abcdef1234")).toBe("••••1234");
    expect(secretHint("abc")).toBe("••••");
  });
});

describe("upload validation", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

  it("sanitises filenames", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("My Design <final>.png")).toBe("My-Design-final.png");
    expect(sanitizeFilename("...")).toBe("file");
  });

  it("accepts matching type, extension and magic bytes", () => {
    expect(validateUpload({ name: "a.png", type: "image/png", size: 100 }, png)).toBe("image/png");
  });

  it("rejects mismatches, SVG/HTML, oversized and empty files", () => {
    expect(() => validateUpload({ name: "a.jpg", type: "image/png", size: 100 }, png)).toThrow(/extension/);
    expect(() => validateUpload({ name: "a.png", type: "image/png", size: 100 }, new Uint8Array([1, 2, 3, 4]))).toThrow(/content/);
    expect(() => validateUpload({ name: "a.svg", type: "image/svg+xml", size: 100 }, png)).toThrow(/Unsupported/);
    expect(() => validateUpload({ name: "a.txt", type: "text/plain", size: 100 }, new TextEncoder().encode("<script>alert(1)</script>"))).toThrow(/content/);
    expect(() => validateUpload({ name: "a.png", type: "image/png", size: 50 * 1024 * 1024 }, png)).toThrow(/4 MB/);
    expect(() => validateUpload({ name: "a.png", type: "image/png", size: 0 }, png)).toThrow(/empty/);
  });
});
