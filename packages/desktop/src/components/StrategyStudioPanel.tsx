import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ObjectiveView {
  readonly id: string;
  readonly name: string;
  readonly metric: string;
  readonly target: number;
  readonly period_start: string;
  readonly period_end: string;
  readonly status: string;
}

interface AudienceView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly attributes_json: string;
  readonly exclusions_json: string;
}

interface OfferView {
  readonly id: string;
  readonly name: string;
  readonly promise: string;
  readonly proof_points_json: string;
  readonly constraints_json: string;
}

interface StrategyView {
  readonly id: string;
  readonly version: number;
  readonly objective_ids_json: string;
  readonly audience_ids_json: string;
  readonly offer_ids_json: string;
  readonly positioning: string;
  readonly key_messages_json: string;
  readonly content_pillars_json: string;
  readonly channels_json: string;
  readonly status: string;
}

interface StrategyStudioProps {
  readonly workspaceId: string;
}

async function native<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

export function StrategyStudioPanel({ workspaceId }: StrategyStudioProps) {
  const [objectives, setObjectives] = useState<readonly ObjectiveView[]>([]);
  const [audiences, setAudiences] = useState<readonly AudienceView[]>([]);
  const [offers, setOffers] = useState<readonly OfferView[]>([]);
  const [strategies, setStrategies] = useState<readonly StrategyView[]>([]);
  const [error, setError] = useState("");

  const [objectiveId, setObjectiveId] = useState("");
  const [objectiveName, setObjectiveName] = useState("");
  const [objectiveMetric, setObjectiveMetric] = useState("leads");
  const [objectiveTarget, setObjectiveTarget] = useState("100");

  const [audienceId, setAudienceId] = useState("");
  const [audienceName, setAudienceName] = useState("");
  const [audienceDescription, setAudienceDescription] = useState("");
  const [audienceAttributes, setAudienceAttributes] = useState("{}");

  const [offerId, setOfferId] = useState("");
  const [offerName, setOfferName] = useState("");
  const [offerPromise, setOfferPromise] = useState("");
  const [offerProof, setOfferProof] = useState("");

  const [strategyId, setStrategyId] = useState("");
  const [strategyVersion, setStrategyVersion] = useState("1");
  const [positioning, setPositioning] = useState("");
  const [keyMessages, setKeyMessages] = useState("");
  const [contentPillars, setContentPillars] = useState("");
  const [channels, setChannels] = useState("facebook,instagram,linkedin");

  const load = async (): Promise<void> => {
    try {
      setError("");
      const [nextObjectives, nextAudiences, nextOffers, nextStrategies] =
        await Promise.all([
          native<ObjectiveView[]>("objective_list"),
          native<AudienceView[]>("audience_list"),
          native<OfferView[]>("offer_list"),
          native<StrategyView[]>("strategy_list"),
        ]);
      setObjectives(nextObjectives);
      setAudiences(nextAudiences);
      setOffers(nextOffers);
      setStrategies(nextStrategies);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل تحميل Strategy Studio",
      );
    }
  };

  useEffect(() => {
    if (workspaceId) void load();
  }, [workspaceId]);

  const saveObjective = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!objectiveId.trim() || !objectiveName.trim()) {
      setError("أدخل معرف واسم الهدف");
      return;
    }

    try {
      await native("objective_upsert", {
        id: objectiveId.trim(),
        name: objectiveName.trim(),
        metric: objectiveMetric.trim(),
        target: Number(objectiveTarget),
        periodStart: new Date().toISOString(),
        periodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        status: "active",
      });
      setObjectiveId("");
      setObjectiveName("");
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حفظ الهدف");
    }
  };

  const saveAudience = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!audienceId.trim() || !audienceName.trim()) {
      setError("أدخل معرف واسم الجمهور");
      return;
    }

    try {
      await native("audience_upsert", {
        id: audienceId.trim(),
        name: audienceName.trim(),
        description: audienceDescription.trim(),
        attributesJson: audienceAttributes.trim() || "{}",
        exclusionsJson: "[]",
      });
      setAudienceId("");
      setAudienceName("");
      setAudienceDescription("");
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حفظ الجمهور");
    }
  };

  const saveOffer = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!offerId.trim() || !offerName.trim() || !offerPromise.trim()) {
      setError("أدخل معرف واسم ووعد العرض");
      return;
    }

    try {
      const proof = offerProof
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      await native("offer_upsert", {
        id: offerId.trim(),
        name: offerName.trim(),
        promise: offerPromise.trim(),
        proofPointsJson: JSON.stringify(proof),
        constraintsJson: "[]",
      });
      setOfferId("");
      setOfferName("");
      setOfferPromise("");
      setOfferProof("");
      await load();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حفظ العرض");
    }
  };

  const saveStrategy = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!strategyId.trim() || !positioning.trim()) {
      setError("أدخل معرف الاستراتيجية والـpositioning");
      return;
    }

    const first = (value: string) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

    try {
      await native("strategy_upsert", {
        id: strategyId.trim(),
        version: Number(strategyVersion),
        objectiveIdsJson: JSON.stringify(
          objectives.slice(0, 10).map((item) => item.id),
        ),
        audienceIdsJson: JSON.stringify(
          audiences.slice(0, 10).map((item) => item.id),
        ),
        offerIdsJson: JSON.stringify(
          offers.slice(0, 10).map((item) => item.id),
        ),
        positioning: positioning.trim(),
        keyMessagesJson: JSON.stringify(first(keyMessages)),
        contentPillarsJson: JSON.stringify(first(contentPillars)),
        channelsJson: JSON.stringify(first(channels)),
        status: "active",
      });
      setStrategyId("");
      setPositioning("");
      setKeyMessages("");
      setContentPillars("");
      await load();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل حفظ الاستراتيجية",
      );
    }
  };

  return (
    <section className="card">
      <h2>Strategy Studio</h2>
      <p>
        طبقة ORBIT Brain: أهداف، جماهير، عروض، ورسالة استراتيجية تتحول إلى سياق
        قابل للتشغيل داخل الـOperating Graph.
      </p>

      {error ? <div className="result">{error}</div> : null}

      <div className="grid">
        <div className="card">
          <h3>Objectives</h3>
          <form className="vault-form" onSubmit={saveObjective}>
            <label>
              ID
              <input
                value={objectiveId}
                onChange={(e) => setObjectiveId(e.target.value)}
              />
            </label>
            <label>
              الاسم
              <input
                value={objectiveName}
                onChange={(e) => setObjectiveName(e.target.value)}
              />
            </label>
            <label>
              Metric
              <input
                value={objectiveMetric}
                onChange={(e) => setObjectiveMetric(e.target.value)}
              />
            </label>
            <label>
              Target
              <input
                inputMode="decimal"
                value={objectiveTarget}
                onChange={(e) => setObjectiveTarget(e.target.value)}
              />
            </label>
            <button className="button primary" type="submit">
              حفظ الهدف
            </button>
          </form>
          <div className="account-list">
            {objectives.slice(0, 6).map((item) => (
              <div className="account-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <div className="account-meta">
                    {item.metric} • {item.target} • {item.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Audiences</h3>
          <form className="vault-form" onSubmit={saveAudience}>
            <label>
              ID
              <input
                value={audienceId}
                onChange={(e) => setAudienceId(e.target.value)}
              />
            </label>
            <label>
              الاسم
              <input
                value={audienceName}
                onChange={(e) => setAudienceName(e.target.value)}
              />
            </label>
            <label>
              الوصف
              <textarea
                rows={3}
                value={audienceDescription}
                onChange={(e) => setAudienceDescription(e.target.value)}
              />
            </label>
            <label>
              Attributes JSON
              <textarea
                rows={3}
                value={audienceAttributes}
                onChange={(e) => setAudienceAttributes(e.target.value)}
              />
            </label>
            <button className="button primary" type="submit">
              حفظ الجمهور
            </button>
          </form>
          <div className="account-list">
            {audiences.slice(0, 6).map((item) => (
              <div className="account-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <div className="account-meta">{item.id}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Offers</h3>
          <form className="vault-form" onSubmit={saveOffer}>
            <label>
              ID
              <input
                value={offerId}
                onChange={(e) => setOfferId(e.target.value)}
              />
            </label>
            <label>
              الاسم
              <input
                value={offerName}
                onChange={(e) => setOfferName(e.target.value)}
              />
            </label>
            <label>
              الوعد
              <textarea
                rows={3}
                value={offerPromise}
                onChange={(e) => setOfferPromise(e.target.value)}
              />
            </label>
            <label>
              Proof points
              <input
                value={offerProof}
                onChange={(e) => setOfferProof(e.target.value)}
                placeholder="case-study, testimonial"
              />
            </label>
            <button className="button primary" type="submit">
              حفظ العرض
            </button>
          </form>
          <div className="account-list">
            {offers.slice(0, 6).map((item) => (
              <div className="account-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <div className="account-meta">{item.promise}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Strategy</h3>
          <form className="vault-form" onSubmit={saveStrategy}>
            <label>
              ID
              <input
                value={strategyId}
                onChange={(e) => setStrategyId(e.target.value)}
              />
            </label>
            <label>
              Version
              <input
                inputMode="numeric"
                value={strategyVersion}
                onChange={(e) => setStrategyVersion(e.target.value)}
              />
            </label>
            <label>
              Positioning
              <textarea
                rows={4}
                value={positioning}
                onChange={(e) => setPositioning(e.target.value)}
              />
            </label>
            <label>
              Key messages
              <input
                value={keyMessages}
                onChange={(e) => setKeyMessages(e.target.value)}
                placeholder="message 1, message 2"
              />
            </label>
            <label>
              Content pillars
              <input
                value={contentPillars}
                onChange={(e) => setContentPillars(e.target.value)}
                placeholder="education, proof, offer"
              />
            </label>
            <label>
              Channels
              <input
                value={channels}
                onChange={(e) => setChannels(e.target.value)}
              />
            </label>
            <button className="button primary" type="submit">
              حفظ الاستراتيجية
            </button>
          </form>
          <div className="account-list">
            {strategies.slice(0, 6).map((item) => (
              <div className="account-row" key={item.id}>
                <div>
                  <strong>
                    {item.id} • v{item.version}
                  </strong>
                  <div className="account-meta">
                    {item.status} • {item.positioning}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
