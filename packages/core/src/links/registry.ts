export interface LinkRegistryInput {
  readonly destinationUrl: string;
  readonly campaignId?: string | null;
  readonly contentId?: string | null;
  readonly source?: string | null;
  readonly medium?: string | null;
  readonly campaign?: string | null;
  readonly term?: string | null;
  readonly content?: string | null;
}

export interface LinkRegistryRecord {
  readonly key: string;
  readonly destinationUrl: string;
  readonly trackedUrl: string;
  readonly tracking: Readonly<Record<string, string>>;
  readonly provenance: "local";
}

function normalizeOptional(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function hash32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function normalizeDestinationUrl(input: string): string {
  const raw = input.trim();
  if (!raw) throw new Error("destinationUrl is required");

  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("destinationUrl must use http or https");
  }

  url.hostname = url.hostname.toLowerCase();
  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }
  url.hash = "";
  url.searchParams.sort();

  return url.toString();
}

export function buildTrackedUrl(input: LinkRegistryInput): string {
  const destinationUrl = normalizeDestinationUrl(input.destinationUrl);
  const url = new URL(destinationUrl);

  const tracking: Record<string, string> = {};
  const candidates: ReadonlyArray<[string, string | null | undefined]> = [
    ["utm_source", input.source],
    ["utm_medium", input.medium],
    ["utm_campaign", input.campaign],
    ["utm_term", input.term],
    ["utm_content", input.content],
  ];

  for (const [name, value] of candidates) {
    const normalized = normalizeOptional(value);
    if (normalized) {
      tracking[name] = normalized;
      url.searchParams.set(name, normalized);
    }
  }

  url.searchParams.sort();
  return url.toString();
}

export function createLinkRecord(input: LinkRegistryInput): LinkRegistryRecord {
  const destinationUrl = normalizeDestinationUrl(input.destinationUrl);
  const trackedUrl = buildTrackedUrl(input);
  const tracking: Record<string, string> = {};

  for (const [name, value] of new URL(trackedUrl).searchParams.entries()) {
    if (name.startsWith("utm_")) tracking[name] = value;
  }

  const canonical = JSON.stringify({
    destinationUrl,
    campaignId: normalizeOptional(input.campaignId),
    contentId: normalizeOptional(input.contentId),
    tracking,
  });

  return {
    key: "lnk_" + hash32(canonical),
    destinationUrl,
    trackedUrl,
    tracking,
    provenance: "local",
  };
}
