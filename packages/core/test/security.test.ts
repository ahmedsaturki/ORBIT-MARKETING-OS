import { describe, expect, it } from "vitest";
import {
  decryptAes256Gcm,
  encryptAes256Gcm,
  generateAes256Key,
} from "../src/security/aesGcm.js";
import {
  canStartExecution,
  recordExecutionFailure,
  recordExecutionSuccess,
} from "../src/security/executePolicy.js";
import { AuditLog, createAuditEvent } from "../src/audit/auditLog.js";

describe("AES-256-GCM", () => {
  it("encrypts and decrypts without exposing plaintext in the payload", async () => {
    const key = await generateAes256Key();
    const plaintext = "sensitive local session material";
    const encrypted = await encryptAes256Gcm(plaintext, key);

    expect(encrypted.ciphertext).not.toContain(plaintext);
    await expect(decryptAes256Gcm(encrypted, key)).resolves.toBe(plaintext);
  });

  it("rejects tampered ciphertext", async () => {
    const key = await generateAes256Key();
    const encrypted = await encryptAes256Gcm("secret", key);
    const tampered = {
      ...encrypted,
      ciphertext: encrypted.ciphertext.slice(0, -2) + "AA",
    };

    await expect(decryptAes256Gcm(tampered, key)).rejects.toThrow();
  });
});

describe("execution guardrails", () => {
  const policy = {
    dailyLimit: 3,
    maxConsecutiveFailures: 2,
    requireExplicitConfirmation: true,
  };

  it("requires confirmation before an externally-visible action", () => {
    const decision = canStartExecution(
      policy,
      { dayKey: "2026-09-24", completedToday: 0, consecutiveFailures: 0, blocked: false },
      false,
    );

    expect(decision).toEqual({ allowed: false, reason: "confirmation_required" });
  });

  it("opens a circuit after consecutive failures", () => {
    const first = recordExecutionFailure(
      { dayKey: "2026-09-24", completedToday: 0, consecutiveFailures: 0, blocked: false },
      "2026-09-24",
    );
    const second = recordExecutionFailure(first, "2026-09-24");

    expect(canStartExecution(policy, second, true)).toEqual({
      allowed: false,
      reason: "circuit_breaker",
    });
  });

  it("resets the consecutive failure count after success", () => {
    const failed = recordExecutionFailure(
      { dayKey: "2026-09-24", completedToday: 1, consecutiveFailures: 1, blocked: false },
      "2026-09-24",
    );
    const recovered = recordExecutionSuccess(failed, "2026-09-24");
    expect(recovered.consecutiveFailures).toBe(0);
    expect(recovered.completedToday).toBe(2);
  });
});

describe("audit log", () => {
  it("rejects duplicate event ids", () => {
    const log = new AuditLog();
    const event = createAuditEvent({
      id: "audit-duplicate",
      timestamp: new Date(0).toISOString(),
      category: "security",
      action: "test",
      outcome: "success",
      actor: "system",
    });
    log.append(event);
    expect(() => log.append(event)).toThrow("Audit event id already exists");
  });

  it("redacts credential-looking metadata", () => {
    const event = createAuditEvent({
      timestamp: new Date(0).toISOString(),
      category: "security",
      action: "connector.authenticated",
      outcome: "success",
      actor: "connector",
      metadata: { token: "do-not-store", attempt: 1 },
    });

    expect(event.metadata).toEqual({ token: "[REDACTED]", attempt: 1 });

    const log = new AuditLog();
    log.append(event);
    const entries = log.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.metadata?.token).toBe("[REDACTED]");
  });
});
