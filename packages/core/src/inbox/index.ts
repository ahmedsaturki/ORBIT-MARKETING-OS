export class InboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InboxError";
  }
}

export type InboxPlatform = "facebook" | "instagram" | "whatsapp" | "telegram" | "email";

export interface RawInboundMessage {
  readonly workspaceId: string;
  readonly platform: InboxPlatform;
  readonly accountId: string;
  readonly externalThreadId: string;
  readonly externalMessageId: string;
  readonly sender: string;
  readonly text: string;
  readonly timestamp: string;
}

export interface UnifiedMessage {
  readonly id: string;
  readonly workspaceId: string;
  readonly platform: InboxPlatform;
  readonly accountId: string;
  readonly threadId: string;
  readonly direction: "inbound" | "outbound";
  readonly sender: string;
  readonly body: string;
  readonly receivedAt: string;
}

export interface UnifiedConversation {
  readonly id: string;
  readonly workspaceId: string;
  readonly platform: InboxPlatform;
  readonly accountId: string;
  readonly externalThreadId: string;
  readonly lastMessageAt: string;
  readonly lastMessagePreview: string;
  readonly unreadCount: number;
}

const PLATFORMS: readonly InboxPlatform[] = [
  "facebook",
  "instagram",
  "whatsapp",
  "telegram",
  "email",
];

function requireNonEmpty(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InboxError(`${field} must be a non-empty string`);
  }
  return value;
}

function validateMessage(raw: RawInboundMessage): void {
  requireNonEmpty(raw.workspaceId, "workspaceId");
  requireNonEmpty(raw.accountId, "accountId");
  requireNonEmpty(raw.externalThreadId, "externalThreadId");
  requireNonEmpty(raw.externalMessageId, "externalMessageId");
  requireNonEmpty(raw.sender, "sender");
  requireNonEmpty(raw.text, "text");
  requireNonEmpty(raw.timestamp, "timestamp");
  if (!PLATFORMS.includes(raw.platform)) {
    throw new InboxError(`unknown platform: ${String(raw.platform)}`);
  }
  if (!Number.isFinite(Date.parse(raw.timestamp))) {
    throw new InboxError(`invalid timestamp: ${raw.timestamp}`);
  }
}

function threadKey(raw: RawInboundMessage): string {
  return `${raw.platform}:${raw.accountId}:${raw.externalThreadId}`;
}

/**
 * One normalized inbox across connectors. Threads are keyed by
 * platform + account + external thread id, so identical external ids from
 * different platforms never collide, and everything stays workspace-scoped.
 */
export class UnifiedInbox {
  private readonly messagesByThread = new Map<string, UnifiedMessage[]>();
  private readonly seenMessageIds = new Set<string>();
  private readonly conversations = new Map<string, UnifiedConversation>();
  private readonly unread = new Map<string, number>();

  ingest(raw: RawInboundMessage): UnifiedMessage {
    validateMessage(raw);
    const globalMessageId = `${raw.platform}:${raw.externalMessageId}`;
    const key = threadKey(raw);

    // Connector fixtures may re-deliver the same message; ingestion is idempotent.
    if (this.seenMessageIds.has(globalMessageId)) {
      const existing = this.messagesByThread
        .get(key)
        ?.find((m) => m.id === globalMessageId);
      if (existing) return existing;
      throw new InboxError(`message id collision across threads: ${globalMessageId}`);
    }

    const message: UnifiedMessage = {
      id: globalMessageId,
      workspaceId: raw.workspaceId,
      platform: raw.platform,
      accountId: raw.accountId,
      threadId: key,
      direction: "inbound",
      sender: raw.sender,
      body: raw.text,
      receivedAt: raw.timestamp,
    };

    const list = this.messagesByThread.get(key) ?? [];
    list.push(message);
    list.sort((a, b) =>
      a.receivedAt < b.receivedAt ? -1 : a.receivedAt > b.receivedAt ? 1 : 0,
    );
    this.messagesByThread.set(key, list);
    this.seenMessageIds.add(globalMessageId);
    this.unread.set(key, (this.unread.get(key) ?? 0) + 1);

    const previous = this.conversations.get(key);
    const lastAt =
      previous && previous.lastMessageAt >= message.receivedAt
        ? previous.lastMessageAt
        : message.receivedAt;
    this.conversations.set(key, {
      id: key,
      workspaceId: raw.workspaceId,
      platform: raw.platform,
      accountId: raw.accountId,
      externalThreadId: raw.externalThreadId,
      lastMessageAt: lastAt,
      lastMessagePreview: message.body.slice(0, 120),
      unreadCount: this.unread.get(key) ?? 0,
    });
    return message;
  }

  listConversations(workspaceId: string): readonly UnifiedConversation[] {
    requireNonEmpty(workspaceId, "workspaceId");
    const result: UnifiedConversation[] = [];
    for (const conversation of this.conversations.values()) {
      if (conversation.workspaceId === workspaceId) result.push(conversation);
    }
    result.sort((a, b) =>
      a.lastMessageAt < b.lastMessageAt
        ? 1
        : a.lastMessageAt > b.lastMessageAt
          ? -1
          : a.id < b.id
            ? -1
            : 1,
    );
    return result;
  }

  getThread(
    workspaceId: string,
    platform: InboxPlatform,
    accountId: string,
    externalThreadId: string,
  ): readonly UnifiedMessage[] {
    requireNonEmpty(workspaceId, "workspaceId");
    const key = `${platform}:${accountId}:${externalThreadId}`;
    const conversation = this.conversations.get(key);
    if (!conversation || conversation.workspaceId !== workspaceId) return [];
    return this.messagesByThread.get(key) ?? [];
  }

  markRead(
    workspaceId: string,
    platform: InboxPlatform,
    accountId: string,
    externalThreadId: string,
  ): void {
    const key = `${platform}:${accountId}:${externalThreadId}`;
    const conversation = this.conversations.get(key);
    if (!conversation || conversation.workspaceId !== workspaceId) {
      throw new InboxError(`unknown thread: ${key}`);
    }
    this.unread.set(key, 0);
    this.conversations.set(key, { ...conversation, unreadCount: 0 });
  }
}
