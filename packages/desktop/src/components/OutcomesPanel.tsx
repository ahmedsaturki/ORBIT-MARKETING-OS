import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ContactOption {
  readonly id: string;
  readonly display_name: string;
}

interface CampaignOption {
  readonly id: string;
  readonly name: string;
}

interface OpportunityView {
  readonly id: string;
  readonly contact_id: string;
  readonly campaign_id: string | null;
  readonly name: string;
  readonly stage: string;
  readonly value: number;
  readonly currency: string;
  readonly probability: number;
  readonly source: string | null;
  readonly owner_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface InsightView {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly summary: string;
  readonly metric: string | null;
  readonly value: number | null;
  readonly confidence: number;
  readonly source_ids_json: string;
  readonly observed_at: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface OutcomesPanelProps {
  readonly workspaceId: string;
  readonly contacts: readonly ContactOption[];
  readonly campaigns: readonly CampaignOption[];
}

const STAGES = [
  ["new", "جديد"],
  ["qualified", "مؤهل"],
  ["proposal", "عرض"],
  ["negotiation", "تفاوض"],
  ["won", "فاز"],
  ["lost", "خسر"],
  ["nurture", "رعاية"],
] as const;

const INSIGHT_KINDS = [
  ["performance", "أداء"],
  ["anomaly", "شذوذ"],
  ["learning", "تعلم"],
  ["trend", "اتجاه"],
  ["recommendation", "توصية"],
] as const;

async function native<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

export function OutcomesPanel({
  workspaceId,
  contacts,
  campaigns,
}: OutcomesPanelProps) {
  const [opportunities, setOpportunities] = useState<readonly OpportunityView[]>(
    [],
  );
  const [insights, setInsights] = useState<readonly InsightView[]>([]);
  const [opportunityId, setOpportunityId] = useState("");
  const [opportunityName, setOpportunityName] = useState("");
  const [opportunityContactId, setOpportunityContactId] = useState("");
  const [opportunityCampaignId, setOpportunityCampaignId] = useState("");
  const [opportunityStage, setOpportunityStage] = useState("new");
  const [opportunityValue, setOpportunityValue] = useState("0");
  const [opportunityCurrency, setOpportunityCurrency] = useState("EGP");
  const [opportunityProbability, setOpportunityProbability] = useState("20");
  const [opportunitySource, setOpportunitySource] = useState("");
  const [insightId, setInsightId] = useState("");
  const [insightKind, setInsightKind] = useState("learning");
  const [insightTitle, setInsightTitle] = useState("");
  const [insightSummary, setInsightSummary] = useState("");
  const [insightMetric, setInsightMetric] = useState("");
  const [insightValue, setInsightValue] = useState("");
  const [insightConfidence, setInsightConfidence] = useState("0.8");
  const [insightSources, setInsightSources] = useState("analytics");
  const [error, setError] = useState("");

  const load = async (): Promise<void> => {
    try {
      setError("");
      const [nextOpportunities, nextInsights] = await Promise.all([
        native<OpportunityView[]>("opportunity_list"),
        native<InsightView[]>("insight_list"),
      ]);
      setOpportunities(nextOpportunities);
      setInsights(nextInsights);
      setOpportunityContactId((current) => current || contacts[0]?.id || "");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل تحميل الـOutcomes");
    }
  };

  useEffect(() => {
    if (workspaceId) void load();
  }, [workspaceId]);

  const saveOpportunity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!opportunityId.trim() || !opportunityName.trim() || !opportunityContactId) {
      setError("أدخل معرف الفرصة والاسم واختر العميل");
      return;
    }

    try {
      setError("");
      await native<OpportunityView>("opportunity_upsert", {
        id: opportunityId.trim(),
        contactId: opportunityContactId,
        campaignId: opportunityCampaignId || null,
        name: opportunityName.trim(),
        stage: opportunityStage,
        value: Number(opportunityValue),
        currency: opportunityCurrency.trim().toUpperCase(),
        probability: Number(opportunityProbability),
        source: opportunitySource.trim() || null,
        ownerId: null,
      });
      setOpportunityId("");
      setOpportunityName("");
      setOpportunitySource("");
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حفظ الفرصة");
    }
  };

  const saveInsight = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!insightId.trim() || !insightTitle.trim() || !insightSummary.trim()) {
      setError("أدخل معرف الاستنتاج والعنوان والملخص");
      return;
    }

    const sources = insightSources
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    try {
      setError("");
      await native<InsightView>("insight_upsert", {
        id: insightId.trim(),
        kind: insightKind,
        title: insightTitle.trim(),
        summary: insightSummary.trim(),
        metric: insightMetric.trim() || null,
        value: insightValue.trim() ? Number(insightValue) : null,
        confidence: Number(insightConfidence),
        sourceIdsJson: JSON.stringify(sources),
        observedAt: new Date().toISOString(),
      });
      setInsightId("");
      setInsightTitle("");
      setInsightSummary("");
      setInsightMetric("");
      setInsightValue("");
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حفظ الاستنتاج");
    }
  };

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <h2>Outcomes & Learning</h2>
          <p>
            هنا تتحول المحادثات والحملات إلى فرص فعلية، والنتائج إلى معرفة تدخل
            الدورة التسويقية التالية.
          </p>
        </div>
        <button className="button secondary" type="button" onClick={() => void load()}>
          تحديث
        </button>
      </div>

      {error ? <div className="result">{error}</div> : null}

      <div className="grid">
        <div className="card">
          <h3>Opportunity Pipeline</h3>
          <form className="vault-form" onSubmit={saveOpportunity}>
            <label>
              معرف الفرصة
              <input
                value={opportunityId}
                onChange={(event) => setOpportunityId(event.target.value)}
                placeholder="opp-001"
              />
            </label>
            <label>
              اسم الفرصة
              <input
                value={opportunityName}
                onChange={(event) => setOpportunityName(event.target.value)}
                placeholder="صفقة جديدة"
              />
            </label>
            <label>
              العميل
              <select
                value={opportunityContactId}
                onChange={(event) => setOpportunityContactId(event.target.value)}
              >
                <option value="">اختر العميل</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              الحملة (اختياري)
              <select
                value={opportunityCampaignId}
                onChange={(event) => setOpportunityCampaignId(event.target.value)}
              >
                <option value="">بدون ربط</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid">
              <label>
                المرحلة
                <select
                  value={opportunityStage}
                  onChange={(event) => setOpportunityStage(event.target.value)}
                >
                  {STAGES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                القيمة
                <input
                  inputMode="decimal"
                  value={opportunityValue}
                  onChange={(event) => setOpportunityValue(event.target.value)}
                />
              </label>
              <label>
                العملة
                <input
                  value={opportunityCurrency}
                  onChange={(event) => setOpportunityCurrency(event.target.value)}
                  maxLength={3}
                />
              </label>
              <label>
                احتمال الإغلاق %
                <input
                  inputMode="decimal"
                  value={opportunityProbability}
                  onChange={(event) =>
                    setOpportunityProbability(event.target.value)
                  }
                />
              </label>
            </div>
            <label>
              المصدر
              <input
                value={opportunitySource}
                onChange={(event) => setOpportunitySource(event.target.value)}
                placeholder="campaign / inbound / referral"
              />
            </label>
            <button className="button primary" type="submit">
              حفظ الفرصة
            </button>
          </form>

          <div className="account-list">
            {opportunities.slice(0, 10).map((opportunity) => (
              <div className="account-row" key={opportunity.id}>
                <div>
                  <strong>{opportunity.name}</strong>
                  <div className="account-meta">
                    {opportunity.stage} • {opportunity.value.toLocaleString()}{" "}
                    {opportunity.currency} • {opportunity.probability}%
                  </div>
                </div>
              </div>
            ))}
            {!opportunities.length ? (
              <div className="result">لا توجد فرص بعد.</div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <h3>Learning Inbox</h3>
          <form className="vault-form" onSubmit={saveInsight}>
            <label>
              معرف الاستنتاج
              <input
                value={insightId}
                onChange={(event) => setInsightId(event.target.value)}
                placeholder="insight-001"
              />
            </label>
            <label>
              النوع
              <select
                value={insightKind}
                onChange={(event) => setInsightKind(event.target.value)}
              >
                {INSIGHT_KINDS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              العنوان
              <input
                value={insightTitle}
                onChange={(event) => setInsightTitle(event.target.value)}
                placeholder="Hook جديد نجح بشكل ملحوظ"
              />
            </label>
            <label>
              الملخص
              <textarea
                rows={5}
                value={insightSummary}
                onChange={(event) => setInsightSummary(event.target.value)}
              />
            </label>
            <div className="grid">
              <label>
                Metric
                <input
                  value={insightMetric}
                  onChange={(event) => setInsightMetric(event.target.value)}
                  placeholder="conversion_rate"
                />
              </label>
              <label>
                Value
                <input
                  inputMode="decimal"
                  value={insightValue}
                  onChange={(event) => setInsightValue(event.target.value)}
                />
              </label>
            </div>
            <div className="grid">
              <label>
                Confidence
                <input
                  inputMode="decimal"
                  value={insightConfidence}
                  onChange={(event) =>
                    setInsightConfidence(event.target.value)
                  }
                />
              </label>
              <label>
                مصادر الاستنتاج
                <input
                  value={insightSources}
                  onChange={(event) => setInsightSources(event.target.value)}
                  placeholder="analytics-001,campaign-001"
                />
              </label>
            </div>
            <button className="button primary" type="submit">
              حفظ الاستنتاج
            </button>
          </form>

          <div className="account-list">
            {insights.slice(0, 10).map((insight) => (
              <div className="account-row" key={insight.id}>
                <div>
                  <strong>{insight.title}</strong>
                  <div className="account-meta">
                    {insight.kind} • ثقة {(insight.confidence * 100).toFixed(0)}%
                  </div>
                  <div>{insight.summary}</div>
                </div>
              </div>
            ))}
            {!insights.length ? (
              <div className="result">لا توجد استنتاجات بعد.</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
