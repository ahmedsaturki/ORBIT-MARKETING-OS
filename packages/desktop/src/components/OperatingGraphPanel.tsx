import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

interface OperationalLinkView {
  readonly workspace_id: string;
  readonly from_type: string;
  readonly from_id: string;
  readonly to_type: string;
  readonly to_id: string;
  readonly relation: string;
  readonly created_at: string;
}

interface GraphPanelProps {
  readonly workspaceId: string;
}

const ENTITY_TYPES = [
  "objective",
  "strategy",
  "audience",
  "offer",
  "campaign",
  "content",
  "task",
  "conversation",
  "contact",
  "opportunity",
  "insight",
  "agent",
  "agent_run",
  "policy",
  "work_item",
  "media_asset",
] as const;

export function OperatingGraphPanel({ workspaceId }: GraphPanelProps) {
  const [links, setLinks] = useState<readonly OperationalLinkView[]>([]);
  const [fromType, setFromType] = useState("campaign");
  const [fromId, setFromId] = useState("");
  const [toType, setToType] = useState("content");
  const [toId, setToId] = useState("");
  const [relation, setRelation] = useState("produces");
  const [filterType, setFilterType] = useState("");
  const [filterId, setFilterId] = useState("");
  const [error, setError] = useState("");

  const load = async (): Promise<void> => {
    try {
      setError("");
      setLinks(
        await invoke<OperationalLinkView[]>("operational_link_list", {
          entityType: filterType || null,
          entityId: filterId.trim() || null,
        }),
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "فشل تحميل الـOperating Graph",
      );
    }
  };

  useEffect(() => {
    if (workspaceId) void load();
  }, [workspaceId, filterType, filterId]);

  const deleteLink = async (link: OperationalLinkView): Promise<void> => {
    const confirmed = window.confirm(
      "سيتم حذف العلاقة التشغيلية المحددة. هل تريد المتابعة؟",
    );
    if (!confirmed) return;

    try {
      setError("");
      await invoke("operational_link_delete", {
        fromType: link.from_type,
        fromId: link.from_id,
        toType: link.to_type,
        toId: link.to_id,
        relation: link.relation,
      });
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حذف العلاقة");
    }
  };

  const createLink = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!fromId.trim() || !toId.trim() || !relation.trim()) {
      setError("أدخل طرفي العلاقة والـrelation");
      return;
    }

    try {
      setError("");
      await invoke("operational_link_upsert", {
        fromType,
        fromId: fromId.trim(),
        toType,
        toId: toId.trim(),
        relation: relation.trim(),
      });
      setFromId("");
      setToId("");
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل إنشاء العلاقة");
    }
  };

  return (
    <section className="card">
      <h2>Operating Graph</h2>
      <p>
        طبقة العلاقات التشغيلية التي تربط Strategy والحملات والمحتوى والمهام
        والعملاء والفرص والـInsights في سياق واحد.
      </p>

      {error ? <div className="result">{error}</div> : null}

      <form className="vault-form" onSubmit={createLink}>
        <div className="grid">
          <label>
            From type
            <select
              value={fromType}
              onChange={(event) => setFromType(event.target.value)}
            >
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            From ID
            <input
              value={fromId}
              onChange={(event) => setFromId(event.target.value)}
              placeholder="campaign-001"
            />
          </label>
          <label>
            Relation
            <input
              value={relation}
              onChange={(event) => setRelation(event.target.value)}
              placeholder="produces"
            />
          </label>
          <label>
            To type
            <select
              value={toType}
              onChange={(event) => setToType(event.target.value)}
            >
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            To ID
            <input
              value={toId}
              onChange={(event) => setToId(event.target.value)}
              placeholder="content-001"
            />
          </label>
        </div>
        <button className="button primary" type="submit">
          ربط الكيانات
        </button>
      </form>

      <div className="actions">
        <select
          value={filterType}
          onChange={(event) => setFilterType(event.target.value)}
        >
          <option value="">كل الأنواع</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <input
          value={filterId}
          onChange={(event) => setFilterId(event.target.value)}
          placeholder="تصفية بالـID"
        />
        <button
          className="button secondary"
          type="button"
          onClick={() => void load()}
        >
          تحديث الرسم
        </button>
      </div>

      <div className="account-list">
        {links.slice(0, 30).map((link) => (
          <div
            className="account-row"
            key={
              link.from_type +
              ":" +
              link.from_id +
              ":" +
              link.to_type +
              ":" +
              link.to_id +
              ":" +
              link.relation
            }
          >
            <div>
              <strong>
                {link.from_type}:{link.from_id} → {link.to_type}:{link.to_id}
              </strong>
              <div className="account-meta">
                {link.relation} • {link.created_at}
              </div>
              <button
                className="button danger"
                type="button"
                onClick={() => void deleteLink(link)}
              >
                حذف العلاقة
              </button>
            </div>
          </div>
        ))}
        {!links.length ? (
          <div className="result">لا توجد روابط تشغيلية بعد.</div>
        ) : null}
      </div>
    </section>
  );
}
