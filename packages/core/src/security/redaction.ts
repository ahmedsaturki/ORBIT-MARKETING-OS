const SECRET_KEY_PATTERN = /(password|passwd|secret|token|cookie|session|authorization|api[-_]?key|private[-_]?key)/i;

/**
 * Redact likely credential fields before data reaches logs or telemetry.
 */
export function redactRecord(
  record: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      output[key] = "[REDACTED]";
      continue;
    }

    if (Array.isArray(value)) {
      output[key] = value.map((entry) =>
        typeof entry === "object" && entry !== null
          ? redactRecord(entry as Record<string, unknown>)
          : entry,
      );
      continue;
    }

    if (typeof value === "object" && value !== null) {
      output[key] = redactRecord(value as Record<string, unknown>);
      continue;
    }

    output[key] = value;
  }

  return output;
}
