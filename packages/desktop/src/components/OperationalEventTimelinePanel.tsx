import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface OperationalEventView {
  readonly id: string;
  readonly sequence: number;
  readonly timestamp: string;
  readonly kind: string;
  readonly outcome: string;
  readonly actor: string;
  readonly actor_id: string;
  readonly entity_type: string | null;
  readonly entity_id: string | null;
  readonly trace_id: string | null;
  readonly parent_event_id: string | null;
  readonly payload_json: string | null;
}

interface OperationalEventTimelinePanelProps {
  readonly workspaceId: string;
}

export function OperationalEventTimelinePanel({
  workspaceId,
}: OperationalEventTimelinePanelProps) {
  const [events, setEvents] = useState<readonly OperationalEventView[]>([]);
  const [traceId, setTraceId] = useState("");
  const [entityId, setEntityId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async (): Promise<void> => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      setError("");
      setEvents(
        await invoke<OperationalEventView[]>("operational_event_list", {
          entityType: null,
          entityId: entityId.trim() || null,
          traceId: traceId.trim() || null,
          limit: 100,
        }),
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "فشل تحميل سجل التشغيل",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTraceId("");
    setEntityId("");
    void load();
  }, [workspaceId]);

  return (
    <section className="card">
      <div className="actions">
        <div>
          <h2>Operational Timeline</h2>
          <p>
            سجل تشغيلي دائم لمساحة العمل. العرض تشخيصي فقط ولا يعيد تنفيذ أي
            إجراء خارجي.
          </p>
        </div>
        <button className="button secondary" type="button" onClick={() => void load()}>
          {loading ? "جاري التحديث…" : "تحديث"}
        </button>
      </div>

      <div className="actions">
        <label>
          Entity ID
          <input
            value={entityId}
            onChange={(event) => setEntityId(event.target.value)}
            placeholder="campaign-001"
          />
        </label>
        <label>
          Trace ID
          <input
            value={traceId}
            onChange={(event) => setTraceId(event.target.value)}
            placeholder="trace-001"
          />
        </label>
        <button className="button primary" type="button" onClick={() => void load()}>
          بحث
        </button>
      </div>

      {error ? <div className="notice error">{error}</div> : null}

      <div className="account-list">
        {events.map((event) => (
          <article className="account-row" key={event.id}>
            <div>
              <strong>
                #{event.sequence} • {event.kind}
              </strong>
              <div className="account-meta">
                {event.outcome} • {event.actor} • {event.actor_id}
              </div>
              <div className="account-meta">
                {event.timestamp}
                {event.entity_type && event.entity_id
                  ? ` • ${event.entity_type}:${event.entity_id}`
                  : ""}
                {event.trace_id ? ` • trace:${event.trace_id}` : ""}
              </div>
            </div>
          </article>
        ))}
        {!loading && !events.length ? (
          <div className="result">
            لا توجد أحداث مطابقة بعد. الأحداث تُسجل عندما تمر العمليات عبر
            runtime command/execution paths.
          </div>
        ) : null}
      </div>
    </section>
  );
}
