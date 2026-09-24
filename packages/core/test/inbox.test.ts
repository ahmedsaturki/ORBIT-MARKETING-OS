import { describe, expect, it } from "vitest";
import {
  InboxError,
  UnifiedInbox,
  type RawInboundMessage,
} from "../src/inbox/index.js";

const NOW = "2026-09-24T10:00:00.000Z";

function fb(overrides: Partial<RawInboundMessage> = {}): RawInboundMessage {
  return {
    workspaceId: "ws1",
    platform: "facebook",
    accountId: "fb-page-1",
    externalThreadId: "thread-1",
    externalMessageId: "fb-msg-1",
    sender: "customer-a",
    text: "Is the offer still valid?",
    timestamp: NOW,
    ...overrides,
  };
}

function tg(overrides: Partial<RawInboundMessage> = {}): RawInboundMessage {
  return {
    workspaceId: "ws1",
    platform: "telegram",
    accountId: "tg-channel-1",
    externalThreadId: "thread-1",
    externalMessageId: "tg-msg-1",
    sender: "customer-b",
    text: "Send me the price list",
    timestamp: "2026-09-24T10:05:00.000Z",
    ...overrides,
  };
}

describe("unified conversation model from connector fixtures (INBOX-01)", () => {
  it("normalizes messages from different connectors into one workspace inbox", () => {
    const inbox = new UnifiedInbox();
    inbox.ingest(fb());
    inbox.ingest(tg());
    inbox.ingest(
      fb({
        externalMessageId: "fb-msg-2",
        text: "Thanks!",
        timestamp: "2026-09-24T10:10:00.000Z",
      }),
    );

    const conversations = inbox.listConversations("ws1");
    expect(conversations).toHaveLength(2);
    // Both fixtures use externalThreadId "thread-1" — same id, distinct threads.
    expect(conversations.map((c) => c.id).sort()).toEqual([
      "facebook:fb-page-1:thread-1",
      "telegram:tg-channel-1:thread-1",
    ]);
    // Sorted newest-first: the 10:10 Facebook message wins.
    expect(conversations[0]?.id).toBe("facebook:fb-page-1:thread-1");
    expect(conversations[0]?.lastMessageAt).toBe("2026-09-24T10:10:00.000Z");
    expect(conversations[0]?.unreadCount).toBe(2);
    expect(conversations[1]?.unreadCount).toBe(1);
    expect(conversations[0]?.lastMessagePreview).toBe("Thanks!");
  });

  it("returns thread messages in chronological order with unified shape", () => {
    const inbox = new UnifiedInbox();
    inbox.ingest(fb());
    inbox.ingest(
      fb({
        externalMessageId: "fb-msg-0",
        text: "Earlier message",
        timestamp: "2026-09-24T09:00:00.000Z",
      }),
    );

    const thread = inbox.getThread("ws1", "facebook", "fb-page-1", "thread-1");
    expect(thread).toHaveLength(2);
    expect(thread.map((m) => m.body)).toEqual(["Earlier message", "Is the offer still valid?"]);
    expect(thread[0]?.direction).toBe("inbound");
    expect(thread[0]?.threadId).toBe("facebook:fb-page-1:thread-1");
    expect(thread[1]?.id).toBe("facebook:fb-msg-1");
  });

  it("is idempotent when a connector re-delivers a message", () => {
    const inbox = new UnifiedInbox();
    const first = inbox.ingest(fb());
    const second = inbox.ingest(fb());
    expect(second.id).toBe(first.id);
    expect(inbox.listConversations("ws1")).toHaveLength(1);
    expect(inbox.listConversations("ws1")[0]?.unreadCount).toBe(1);
  });

  it("markRead resets unread without dropping the thread", () => {
    const inbox = new UnifiedInbox();
    inbox.ingest(fb());
    inbox.ingest(fb({ externalMessageId: "fb-msg-2", text: "Hello again" }));
    expect(inbox.listConversations("ws1")[0]?.unreadCount).toBe(2);

    inbox.markRead("ws1", "facebook", "fb-page-1", "thread-1");
    expect(inbox.listConversations("ws1")[0]?.unreadCount).toBe(0);
    expect(
      inbox.getThread("ws1", "facebook", "fb-page-1", "thread-1"),
    ).toHaveLength(2);
  });

  it("keeps workspaces isolated on list, thread, and markRead", () => {
    const inbox = new UnifiedInbox();
    inbox.ingest(fb());

    expect(inbox.listConversations("ws2")).toHaveLength(0);
    expect(inbox.getThread("ws2", "facebook", "fb-page-1", "thread-1")).toHaveLength(0);
    expect(() =>
      inbox.markRead("ws2", "facebook", "fb-page-1", "thread-1"),
    ).toThrow(InboxError);
  });

  it("fails closed on malformed and unknown-platform connector messages", () => {
    const inbox = new UnifiedInbox();
    expect(() => inbox.ingest(fb({ text: " " }))).toThrow(/text/);
    expect(() => inbox.ingest(fb({ sender: "" }))).toThrow(/sender/);
    expect(() => inbox.ingest(fb({ workspaceId: "" }))).toThrow(/workspaceId/);
    expect(() =>
      inbox.ingest(fb({ platform: "myspace" as never })),
    ).toThrow(/unknown platform/);
    expect(() => inbox.ingest(fb({ timestamp: "not-a-date" }))).toThrow(
      /invalid timestamp/,
    );
    expect(inbox.listConversations("ws1")).toHaveLength(0);
    expect(() => inbox.listConversations("")).toThrow(InboxError);
  });
});
