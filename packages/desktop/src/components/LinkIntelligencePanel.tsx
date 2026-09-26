import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { Link2, ShieldCheck } from "lucide-react";
import { createLinkRecord } from "@orbit/core";
import { invoke } from "@tauri-apps/api/core";

interface CampaignOption {
  readonly id: string;
  readonly name: string;
}

interface ContentOption {
  readonly id: string;
  readonly title: string;
}

interface LinkView {
  readonly id: string;
  readonly workspace_id: string;
  readonly link_key: string;
  readonly destination_url: string;
  readonly tracked_url: string;
  readonly tracking_json: string;
  readonly campaign_id: string | null;
  readonly content_id: string | null;
  readonly provenance: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface EvidenceView {
  readonly id: string;
  readonly workspace_id: string;
  readonly link_id: string;
  readonly source_type: string;
  readonly metric_name: string;
  readonly metric_value: number;
  readonly observed_at: string;
  readonly source_locator: string | null;
  readonly provenance: string;
  readonly metadata_json: string;
  readonly created_at: string;
}

interface LinkIntelligencePanelProps {
  readonly workspaceId: string;
  readonly campaigns: readonly CampaignOption[];
  readonly contentItems: readonly ContentOption[];
}

function nowInputValue(): string {
  const now = new Date();
  const adjusted = new Date(
    now.getTime() - now.getTimezoneOffset() * 60_000,
  );
  return adjusted.toISOString().slice(0, 16);
}

export function LinkIntelligencePanel({
  workspaceId,
  campaigns,
  contentItems,
}: LinkIntelligencePanelProps): ReactElement {
  const [destinationUrl, setDestinationUrl] = useState("");
  const [source, setSource] = useState("facebook");
  const [medium, setMedium] = useState("social");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [contentId, setContentId] = useState("");
  const [links, setLinks] = useState<readonly LinkView[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState("");
  const [sourceType, setSourceType] = useState("manual");
  const [metricName, setMetricName] = useState("clicks");
  const [metricValue, setMetricValue] = useState("0");
  const [observedAt, setObservedAt] = useState(nowInputValue);
  const [sourceLocator, setSourceLocator] = useState("");
  const [evidenceProvenance, setEvidenceProvenance] =
    useState("manual_observation");
  const [evidence, setEvidence] = useState<readonly EvidenceView[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedLink = useMemo(
    () => links.find((link) => link.id === selectedLinkId),
    [links, selectedLinkId],
  );

  const load = async (): Promise<void> => {
    try {
      const nextLinks = await invoke<LinkView[]>("marketing_link_list", {});
      setLinks(nextLinks);
      setSelectedLinkId((current) =>
        current && nextLinks.some((link) => link.id === current)
          ? current
          : nextLinks[0]?.id ?? "",
      );
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل تحميل الروابط");
    }
  };

  const loadEvidence = async (linkId?: string): Promise<void> => {
    try {
      setEvidence(
        await invoke<EvidenceView[]>("marketing_link_evidence_list", {
          linkId: linkId ?? null,
        }),
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "فشل تحميل أدلة الروابط",
      );
    }
  };

  useEffect(() => {
    setLinks([]);
    setEvidence([]);
    setSelectedLinkId("");
    void load();
  }, [workspaceId]);

  useEffect(() => {
    void loadEvidence(selectedLinkId || undefined);
  }, [selectedLinkId]);

  const saveLink = async (): Promise<void> => {
    try {
      setBusy(true);
      setError("");
      setMessage("");
      const record = createLinkRecord({
        destinationUrl,
        campaignId: campaignId || null,
        contentId: contentId || null,
        source,
        medium,
        campaign: campaign || null,
        content: content || null,
      });
      const saved = await invoke<LinkView>("marketing_link_upsert", {
        linkKey: record.key,
        destinationUrl: record.destinationUrl,
        trackedUrl: record.trackedUrl,
        trackingJson: JSON.stringify(record.tracking),
        campaignId: campaignId || null,
        contentId: contentId || null,
      });
      setSelectedLinkId(saved.id);
      setMessage("تم حفظ الرابط المحلي وربطه بسياق الحملة/المحتوى.");
      setDestinationUrl("");
      await load();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل إنشاء الرابط المحلي",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveEvidence = async (): Promise<void> => {
    if (!selectedLink) {
      setError("اختر رابطًا محفوظًا أولًا.");
      return;
    }

    const value = Number(metricValue);
    if (!Number.isFinite(value) || value < 0) {
      setError("قيمة القياس يجب أن تكون رقمًا غير سالب.");
      return;
    }

    try {
      setBusy(true);
      setError("");
      setMessage("");
      await invoke<EvidenceView>("marketing_link_evidence_add", {
        linkId: selectedLink.id,
        sourceType,
        metricName: metricName.trim(),
        metricValue: value,
        observedAt: new Date(observedAt).toISOString(),
        sourceLocator: sourceLocator.trim() || null,
        provenance: evidenceProvenance,
        metadataJson: JSON.stringify({
          workspaceId,
          metric: metricName.trim(),
        }),
      });
      await loadEvidence(selectedLink.id);
      setMessage(
        "تم تسجيل evidence. لا يُعتبر القياس مثبتًا خارج نطاق المصدر/provenance المسجل.",
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "فشل تسجيل evidence للرابط",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-labelledby="link-intelligence-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">LINK INTELLIGENCE • LOCAL PROVENANCE</div>
          <h2 id="link-intelligence-title">
            <Link2 size={20} /> ذكاء الروابط والتتبع
          </h2>
          <p>
            روابط deterministic محلية مرتبطة بالحملات والمحتوى، مع evidence
            صريح بدل الادعاء بوجود metrics غير مثبتة.
          </p>
        </div>
        <ShieldCheck size={22} />
      </div>

      {error ? (
        <div className="notice error" role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="notice success" role="status">
          {message}
        </div>
      ) : null}

      <div className="vault-form">
        <label>
          الوجهة
          <input
            value={destinationUrl}
            onChange={(event) => setDestinationUrl(event.target.value)}
            placeholder="https://example.com/offer"
            inputMode="url"
          />
        </label>
        <label>
          المصدر
          <input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="facebook"
          />
        </label>
        <label>
          الوسط
          <input
            value={medium}
            onChange={(event) => setMedium(event.target.value)}
            placeholder="social"
          />
        </label>
        <label>
          UTM Campaign
          <input
            value={campaign}
            onChange={(event) => setCampaign(event.target.value)}
            placeholder="q4-launch"
          />
        </label>
        <label>
          UTM Content
          <input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="hero-01"
          />
        </label>
        <label>
          ربط بالحملة
          <select
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
          >
            <option value="">بدون</option>
            {campaigns.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          ربط بالمحتوى
          <select
            value={contentId}
            onChange={(event) => setContentId(event.target.value)}
          >
            <option value="">بدون</option>
            {contentItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="actions">
        <button
          className="button primary"
          type="button"
          onClick={() => void saveLink()}
          disabled={busy || !destinationUrl.trim()}
        >
          {busy ? "جاري الحفظ..." : "إنشاء / تحديث الرابط المحلي"}
        </button>
      </div>

      {links.length > 0 ? (
        <div className="result-list">
          {links.map((link) => (
            <article className="card" key={link.id}>
              <div className="section-heading">
                <div>
                  <div className="eyebrow">{link.provenance}</div>
                  <strong>{link.link_key}</strong>
                  <p style={{ overflowWrap: "anywhere" }}>
                    {link.tracked_url}
                  </p>
                </div>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setSelectedLinkId(link.id)}
                >
                  {selectedLinkId === link.id ? "محدد" : "اختيار"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="account-meta">لا توجد روابط محفوظة في workspace الحالية.</div>
      )}

      <div className="card">
        <div className="eyebrow">EVIDENCE LEDGER</div>
        <h3>إضافة evidence للرابط المحدد</h3>
        <div className="vault-form">
          <label>
            المصدر
            <select
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
            >
              <option value="manual">Manual</option>
              <option value="platform_api">Platform API</option>
              <option value="platform_export">Platform Export</option>
              <option value="web_observation">Web observation</option>
              <option value="import">Import</option>
            </select>
          </label>
          <label>
            Metric
            <input
              value={metricName}
              onChange={(event) => setMetricName(event.target.value)}
              placeholder="clicks"
            />
          </label>
          <label>
            القيمة
            <input
              inputMode="decimal"
              value={metricValue}
              onChange={(event) => setMetricValue(event.target.value)}
            />
          </label>
          <label>
            وقت القياس
            <input
              type="datetime-local"
              value={observedAt}
              onChange={(event) => setObservedAt(event.target.value)}
            />
          </label>
          <label>
            Source locator
            <input
              value={sourceLocator}
              onChange={(event) => setSourceLocator(event.target.value)}
              placeholder="https://..."
            />
          </label>
          <label>
            Provenance
            <select
              value={evidenceProvenance}
              onChange={(event) => setEvidenceProvenance(event.target.value)}
            >
              <option value="manual_observation">Manual observation</option>
              <option value="platform_observed">Platform observed</option>
              <option value="imported_export">Imported export</option>
              <option value="verified_external">Verified external</option>
            </select>
          </label>
        </div>
        <div className="actions">
          <button
            className="button secondary"
            type="button"
            onClick={() => void saveEvidence()}
            disabled={busy || !selectedLink}
          >
            تسجيل evidence
          </button>
        </div>

        {selectedLink ? (
          <div className="account-meta" style={{ overflowWrap: "anywhere" }}>
            الرابط المحدد: {selectedLink.link_key} • provenance:
            {" " + selectedLink.provenance}
          </div>
        ) : null}

        {evidence.length > 0 ? (
          <div className="result-list">
            {evidence.map((item) => (
              <div className="result" key={item.id}>
                <strong>
                  {item.metric_name}: {item.metric_value}
                </strong>
                <div className="account-meta">
                  {item.source_type} • {item.provenance} •{" "}
                  {new Date(item.observed_at).toLocaleString("ar-EG")}
                </div>
                {item.source_locator ? (
                  <div
                    className="account-meta"
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {item.source_locator}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="account-meta">
            لا يوجد evidence مثبت للرابط المحدد حتى الآن.
          </div>
        )}
      </div>
    </section>
  );
}
