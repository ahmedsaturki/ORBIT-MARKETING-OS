import { describe, expect, it } from "vitest";
import {
  createRedactingLogger,
  formatLogLine,
  redactDeep,
  redactText,
} from "../src/security/index.js";

const SENTINELS = [
  "AIzaSyFAKESECRET1234567890abcdefghijklmnop",
  "sk-proj-FAKESECRET1234567890abcdefghijklmnop",
  "ghp_FAKESECRET1234567890abcdef123456",
  "AKIAFAKESECRET123456",
  "hunter2-super-secret-password",
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
  "SG.FAKESECRET234567890abcdef",
];

describe("secret redaction (SEC-02)", () => {
  it("masks API keys, tokens, passwords, and headers in free text", () => {
    expect(redactText("key is AIzaSyFAKESECRET1234567890abcdefghijklmnop now")).not.toContain(
      "AIzaSyFAKESECRET1234567890abcdefghijklmnop",
    );
    expect(redactText("sk-proj-FAKESECRET1234567890abcdefghijklmnop")).toBe(
      "[REDACTED_TOKEN]",
    );
    expect(redactText("Authorization: Bearer abcdef123456")).toContain(
      "[REDACTED]",
    );
    expect(
      redactText("password=hunter2-super-secret-password"),
    ).not.toContain("hunter2-super-secret-password");
    expect(
      redactText('api_key: "ghp_FAKESECRET1234567890abcdef123456"'),
    ).not.toContain("ghp_");
    expect(
      redactText("postgresql://admin:hunter2-plainpw@db.internal:5432/app"),
    ).not.toContain("hunter2-plainpw");
  });

  it("masks JWTs, AWS keys, and URL credentials", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const redactedJwt = redactText(`token=${jwt}`);
    expect(redactedJwt).not.toContain(jwt);
    expect(redactedJwt).toMatch(/^token=\[REDACTED/);
    expect(redactText("id AKIAFAKESECRET123456 leaked")).toBe(
      "id [REDACTED_AWS_KEY] leaked",
    );
    expect(redactText("https://user:pa55w0rd@example.com/x")).toContain(
      "user:[REDACTED]@",
    );
    expect(redactText("https://user:pa55w0rd@example.com/x")).not.toContain(
      "pa55w0rd",
    );
  });

  it("leaves innocent text untouched", () => {
    const line = "Fallback from gemini-3.1-pro-preview to gemini-3.5-flash";
    expect(redactText(line)).toBe(line);
    const url = "https://example.com/api/v1?limit=42";
    expect(redactText(url)).toBe(url);
    expect(redactText("tokens: 42, retries: 3")).toBe("tokens: 42, retries: 3");
  });

  it("redacts sensitive keys and nested values deeply", () => {
    const input = {
      apiKey: "AIzaSyFAKESECRET1234567890abcdefghijklmnop",
      nested: {
        password: "hunter2-super-secret-password",
        note: "server note is plain",
      },
      list: [{ token: "sk-proj-FAKESECRET1234567890abcdefghijklmnop" }],
      strings: ["plain-entry"],
      keep: "visible-value",
      count: 7,
      flag: true,
      nothing: null,
    };
    const out = redactDeep(input);
    expect(out.apiKey).toBe("[REDACTED]");
    expect(out.nested.password).toBe("[REDACTED]");
    expect(out.nested.note).toBe("server note is plain");
    expect(out.list[0]?.token).toBe("[REDACTED]");
    expect(out.strings[0]).toBe("plain-entry");
    expect(out.keep).toBe("visible-value");
    expect(out.count).toBe(7);
    expect(out.flag).toBe(true);
    expect(out.nothing).toBeNull();
    expect(JSON.stringify(out)).not.toContain("AIzaSyFAKESECRET");
  });

  it("scan: redacting logger output contains no sentinel secrets", () => {
    const lines: string[] = [];
    const logger = createRedactingLogger((line) => lines.push(line));

    logger.error("Chat API Error:", new Error("request failed"));
    logger.warn("key configured", {
      gemini: "AIzaSyFAKESECRET1234567890abcdefghijklmnop",
      password: "hunter2-super-secret-password",
      nested: { authorization: "Bearer abcdef1234567890" },
    });
    logger.info(
      `auth header Authorization: Bearer abcdef1234567890, pass=hunter2-super-secret-password`,
      { jwt: SENTINELS[5]!, key: SENTINELS[1]!, aws: SENTINELS[3]! },
    );
    logger.error(
      "raw message with embedded secret AIzaSyFAKESECRET1234567890abcdefghijklmnop inside",
    );

    const scan = lines.join("\n");
    expect(lines.length).toBe(4);
    for (const sentinel of SENTINELS) {
      expect(scan).not.toContain(sentinel);
    }
    // Redaction preserves diagnostic content.
    expect(scan).toContain("Chat API Error:");
    expect(scan).toContain("request failed");
    expect(scan).toContain("key configured");
    expect(scan).toContain("raw message with embedded secret");
    expect(scan).toContain("[REDACTED");
  });

  it("formatLogLine serializes objects safely and never throws", () => {
    const line = formatLogLine("error", "boom", [
      "plain",
      { secret: "sk-proj-FAKESECRET1234567890abcdefghijklmnop" },
      42,
      null,
    ]);
    expect(line).toContain("boom");
    expect(line).toContain("plain");
    expect(line).not.toContain("sk-proj-FAKESECRET");

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => formatLogLine("error", "cycle", [cyclic])).not.toThrow();
    expect(formatLogLine("error", "cycle", [cyclic])).toContain(
      "[UNSERIALIZABLE]",
    );
  });
});
