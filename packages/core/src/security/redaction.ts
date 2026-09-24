const SENSITIVE_KEY =
  /(pass(word|wd|phrase)?|secret|token|api[-_]?key|apikey|authorization|auth[-_]?token|credential|private[-_]?key|access[-_]?key|session[-_]?id|cookie|bearer)/i;

const PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // Authorization header values: "Bearer xyz", "Basic abc"
  [/\b(Bearer|Basic)\s+[A-Za-z0-9\-._~+/=]{4,}/gi, "$1 [REDACTED]"],
  // JSON Web Tokens
  [
    /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g,
    "[REDACTED_JWT]",
  ],
  // AWS access key ids
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, "[REDACTED_AWS_KEY]"],
  // Google API keys
  [/\bAIza[0-9A-Za-z_-]{30,}\b/g, "[REDACTED_GOOGLE_KEY]"],
  // Vendor token prefixes: sk-, pkk-, ghp_, xoxb-, glpat-, npm_...
  [
    /\b(?:sk|pk|rk|ghp|gho|ghs|ghu|xoxb|xoxp|xoxa|xoxs|glpat|npm|dop_v1|rpa)[-_][A-Za-z0-9_-]{16,}\b/g,
    "[REDACTED_TOKEN]",
  ],
  // sensitive key = value assignments (password=..., api_key: "...", "token":"...")
  [
    /("?[A-Za-z0-9_\-]*(?:pass(?:word|wd|phrase)?|secret|token|api[-_]?key|apikey|credential|authorization|private[-_]?key)[A-Za-z0-9_\-]*"?\s*[:=]\s*)(["']?)([^\s"',;&}]{3,})\2/gi,
    "$1$2[REDACTED]$2",
  ],
  // credentials embedded in URLs: scheme://user:password@host
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+):([^/\s@]+)@/gi, "$1:[REDACTED]@"],
  // PEM private key blocks
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"],
];

export function redactText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function redactDeep<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactText(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = redactValue(entry);
      }
    }
    return out;
  }
  return value;
}

export interface RedactingLogger {
  info(message: string, ...meta: unknown[]): void;
  warn(message: string, ...meta: unknown[]): void;
  error(message: string, ...meta: unknown[]): void;
}

export function formatLogLine(
  level: "info" | "warn" | "error",
  message: string,
  meta: readonly unknown[],
): string {
  const parts = [message];
  for (const entry of meta) {
    if (typeof entry === "string") {
      parts.push(entry);
    } else if (entry instanceof Error) {
      parts.push(redactText(entry.stack ?? `${entry.name}: ${entry.message}`));
    } else {
      try {
        parts.push(JSON.stringify(redactDeep(entry)) ?? String(entry));
      } catch {
        parts.push("[UNSERIALIZABLE]");
      }
    }
  }
  return redactText(parts.join(" "));
}

export function createRedactingLogger(
  write: (line: string) => void,
): RedactingLogger {
  return {
    info: (message, ...meta) => write(formatLogLine("info", message, meta)),
    warn: (message, ...meta) => write(formatLogLine("warn", message, meta)),
    error: (message, ...meta) => write(formatLogLine("error", message, meta)),
  };
}
