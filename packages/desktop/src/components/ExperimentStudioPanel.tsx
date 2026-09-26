import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { Beaker, CircleHelp, RefreshCw, UserRound } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface ExperimentVariant {
  id: string;
  name: string;
  allocationPercent: number;
  contentId?: string;
  message?: string;
}
interface ExperimentView {
  id: string;
  name: string;
  hypothesis: string;
  objective_metric: string;
  status: "draft" | "running" | "paused" | "completed" | "archived";
  variants_json: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}
interface ExperimentVariantSummary {
  variant_id: string;
  exposure_count: number;
  engagement_count: number;
  conversion_count: number;
  total_value: number;
  engagement_rate: number;
  conversion_rate: number;
}
interface ExperimentSummary {
  experiment_id: string;
  workspace_id: string;
  observation_count: number;
  variants: ExperimentVariantSummary[];
  statistical_significance_claimed: boolean;
}

async function native<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}
const defaultVariants = (): ExperimentVariant[] => [
  { id: "control", name: "Control", allocationPercent: 50 },
  { id: "variant-b", name: "Variant B", allocationPercent: 50 },
];
function parseVariants(value: string): ExperimentVariant[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed))
    throw new Error("الـvariants يجب أن تكون JSON array.");
  return parsed as ExperimentVariant[];
}

export function ExperimentStudioPanel({
  workspaceId,
}: {
  workspaceId: string;
}): ReactElement {
  const [experiments, setExperiments] = useState<ExperimentView[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [objectiveMetric, setObjectiveMetric] = useState("conversion_rate");
  const [status, setStatus] = useState<ExperimentView["status"]>("draft");
  const [variants, setVariants] =
    useState<ExperimentVariant[]>(defaultVariants);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [summary, setSummary] = useState<ExperimentSummary | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [assignment, setAssignment] = useState<string | null>(null);
  const [observationId, setObservationId] = useState("");
  const [observationVariantId, setObservationVariantId] = useState("control");
  const [observationExposed, setObservationExposed] = useState(true);
  const [observationEngaged, setObservationEngaged] = useState(false);
  const [observationConverted, setObservationConverted] = useState(false);
  const [observationValue, setObservationValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const totalAllocation = useMemo(
    () =>
      variants.reduce(
        (sum, variant) => sum + Number(variant.allocationPercent || 0),
        0,
      ),
    [variants],
  );
  const load = useCallback(async (): Promise<void> => {
    try {
      setBusy(true);
      setMessage("");
      setExperiments(await native<ExperimentView[]>("experiment_list"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "فشل تحميل التجارب");
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
    setSelectedId("");
    setSummary(null);
  }, [load, workspaceId]);
  const reset = (): void => {
    setSelectedId("");
    setName("");
    setHypothesis("");
    setObjectiveMetric("conversion_rate");
    setStatus("draft");
    setVariants(defaultVariants());
    setStartsAt("");
    setEndsAt("");
    setSummary(null);
    setAssignment(null);
    setObservationVariantId("control");
  };
  const save = async (): Promise<void> => {
    if (!name.trim() || !hypothesis.trim()) {
      setMessage("أدخل اسم التجربة والفرضية.");
      return;
    }
    if (variants.length < 2 || Math.abs(totalAllocation - 100) > 0.0001) {
      setMessage(
        "يجب أن تحتوي التجربة على متغيرين على الأقل ومجموع توزيع 100%.",
      );
      return;
    }
    try {
      setBusy(true);
      setMessage("");
      const result = await native<ExperimentView>("experiment_upsert", {
        id: selectedId.trim() || "exp-" + Date.now(),
        name: name.trim(),
        hypothesis: hypothesis.trim(),
        objectiveMetric: objectiveMetric.trim() || "conversion_rate",
        status,
        variantsJson: JSON.stringify(variants),
        startsAt: startsAt.trim() || null,
        endsAt: endsAt.trim() || null,
      });
      setSelectedId(result.id);
      await load();
      setMessage("تم حفظ التجربة محليًا.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "فشل حفظ التجربة");
    } finally {
      setBusy(false);
    }
  };
  const refreshSummary = async (id = selectedId): Promise<void> => {
    if (!id) return;
    try {
      setBusy(true);
      setSummary(
        await native<ExperimentSummary>("experiment_summary", {
          experimentId: id,
        }),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "فشل تحميل ملخص التجربة",
      );
    } finally {
      setBusy(false);
    }
  };
  const select = async (experiment: ExperimentView): Promise<void> => {
    setSelectedId(experiment.id);
    setName(experiment.name);
    setHypothesis(experiment.hypothesis);
    setObjectiveMetric(experiment.objective_metric);
    setStatus(experiment.status);
    setVariants(parseVariants(experiment.variants_json));
    setStartsAt(experiment.starts_at ?? "");
    setEndsAt(experiment.ends_at ?? "");
    setAssignment(null);
    await refreshSummary(experiment.id);
  };
  const assign = async (): Promise<void> => {
    if (!selectedId || !subjectId.trim()) {
      setMessage("اختر تجربة وأدخل Subject ID.");
      return;
    }
    try {
      setBusy(true);
      const result = await native<{ variant_id: string }>(
        "experiment_assign_variant",
        { experimentId: selectedId, subjectId: subjectId.trim() },
      );
      setAssignment(result.variant_id);
      setObservationVariantId(result.variant_id);
      setMessage("تم التوزيع deterministic داخل الـworkspace الحالية.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "فشل تحديد الـvariant",
      );
    } finally {
      setBusy(false);
    }
  };
  const record = async (): Promise<void> => {
    if (!selectedId || !observationId.trim() || !subjectId.trim()) {
      setMessage("أدخل Experiment وObservation ID وSubject ID.");
      return;
    }
    try {
      setBusy(true);
      const value = observationValue.trim() ? Number(observationValue) : null;
      if (value !== null && !Number.isFinite(value))
        throw new Error("قيمة observation غير صالحة.");
      await native<boolean>("experiment_record_observation", {
        id: observationId.trim(),
        experimentId: selectedId,
        variantId: observationVariantId,
        subjectId: subjectId.trim(),
        observedAt: new Date().toISOString(),
        exposed: observationExposed,
        engaged: observationEngaged,
        converted: observationConverted,
        value,
      });
      await refreshSummary(selectedId);
      setMessage("تم تسجيل observation محليًا، بدون تنفيذ خارجي.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "فشل تسجيل observation",
      );
    } finally {
      setBusy(false);
    }
  };
  const updateVariant = (
    index: number,
    patch: Partial<ExperimentVariant>,
  ): void => {
    setVariants((current) =>
      current.map((variant, i) =>
        i === index ? { ...variant, ...patch } : variant,
      ),
    );
  };

  const updateOptionalVariantField = (
    index: number,
    field: "contentId" | "message",
    value: string,
  ): void => {
    setVariants((current) =>
      current.map((variant, i) => {
        if (i !== index) return variant;
        const next = { ...variant };
        if (value) next[field] = value;
        else delete next[field];
        return next;
      }),
    );
  };

  return (
    <section className="card" aria-labelledby="experiment-studio-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">EXPERIMENTATION • LEARNING</div>
          <h2 id="experiment-studio-title">
            <Beaker size={20} /> Experiment Studio
          </h2>
          <p>
            تجارب workspace-scoped مع assignment deterministic وقياس محلي. هذه
            الشاشة لا تنفذ نشرًا أو مراسلات خارجية.
          </p>
        </div>
        <button
          className="button secondary"
          type="button"
          onClick={() => void load()}
          disabled={busy}
        >
          <RefreshCw size={16} /> تحديث
        </button>
      </div>
      <div className="grid">
        <div className="card">
          <h3>تعريف التجربة</h3>
          <label>
            الاسم
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            الفرضية
            <textarea
              value={hypothesis}
              onChange={(event) => setHypothesis(event.target.value)}
              rows={4}
            />
          </label>
          <div className="actions">
            <label>
              Objective metric
              <input
                value={objectiveMetric}
                onChange={(event) => setObjectiveMetric(event.target.value)}
              />
            </label>
            <label>
              الحالة
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as ExperimentView["status"])
                }
              >
                <option value="draft">Draft</option>
                <option value="running">Running</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>
          <div className="actions">
            <label>
              Starts at
              <input
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                placeholder="2026-09-26T00:00:00Z"
              />
            </label>
            <label>
              Ends at
              <input
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                placeholder="2026-09-30T00:00:00Z"
              />
            </label>
          </div>
          <div className="result">
            توزيع المتغيرات: <strong>{totalAllocation.toFixed(2)}%</strong>
          </div>
          {variants.map((variant, index) => (
            <div className="card" key={variant.id || index}>
              <div className="actions">
                <label>
                  ID
                  <input
                    value={variant.id}
                    onChange={(event) =>
                      updateVariant(index, { id: event.target.value })
                    }
                  />
                </label>
                <label>
                  الاسم
                  <input
                    value={variant.name}
                    onChange={(event) =>
                      updateVariant(index, { name: event.target.value })
                    }
                  />
                </label>
                <label>
                  Allocation %
                  <input
                    value={String(variant.allocationPercent)}
                    inputMode="decimal"
                    onChange={(event) =>
                      updateVariant(index, {
                        allocationPercent: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <label>
                Content ID
                <input
                  value={variant.contentId ?? ""}
                  onChange={(event) =>
                    updateOptionalVariantField(
                      index,
                      "contentId",
                      event.target.value,
                    )
                  }
                />
              </label>
              <label>
                Message
                <textarea
                  value={variant.message ?? ""}
                  onChange={(event) =>
                    updateOptionalVariantField(
                      index,
                      "message",
                      event.target.value,
                    )
                  }
                  rows={2}
                />
              </label>
              {variants.length > 2 ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={() =>
                    setVariants((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                >
                  حذف المتغير
                </button>
              ) : null}
            </div>
          ))}
          <button
            className="button secondary"
            type="button"
            onClick={() =>
              setVariants((current) => [
                ...current,
                {
                  id: "variant-" + (current.length + 1),
                  name: "Variant " + (current.length + 1),
                  allocationPercent: 0,
                },
              ])
            }
          >
            إضافة Variant
          </button>
          <button
            className="button primary"
            type="button"
            onClick={() => void save()}
            disabled={busy}
          >
            حفظ التجربة
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={reset}
            disabled={busy}
          >
            تجربة جديدة
          </button>
        </div>
        <div className="card">
          <h3>التجارب الحالية</h3>
          {experiments.length === 0 ? (
            <div className="account-meta">
              <CircleHelp size={16} /> لا توجد تجارب محفوظة في الـworkspace
              الحالية.
            </div>
          ) : (
            <div className="result-list">
              {experiments.map((experiment) => (
                <article className="card" key={experiment.id}>
                  <strong>{experiment.name}</strong>
                  <div className="account-meta">
                    {experiment.status} • {experiment.objective_metric} •{" "}
                    {experiment.id}
                  </div>
                  <div className="actions">
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => void select(experiment)}
                    >
                      فتح
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => void refreshSummary(experiment.id)}
                    >
                      الملخص
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
      {selectedId ? (
        <div className="grid">
          <div className="card">
            <h3>
              <UserRound size={18} /> Deterministic assignment
            </h3>
            <label>
              Subject ID
              <input
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
              />
            </label>
            <button
              className="button primary"
              type="button"
              onClick={() => void assign()}
              disabled={busy}
            >
              تحديد الـVariant
            </button>
            {assignment ? (
              <div className="result">
                Variant: <strong>{assignment}</strong>
              </div>
            ) : null}
          </div>
          <div className="card">
            <h3>Record observation</h3>
            <label>
              Observation ID
              <input
                value={observationId}
                onChange={(event) => setObservationId(event.target.value)}
              />
            </label>
            <label>
              Variant
              <select
                value={observationVariantId}
                onChange={(event) =>
                  setObservationVariantId(event.target.value)
                }
              >
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions">
              <label>
                <input
                  type="checkbox"
                  checked={observationExposed}
                  onChange={(event) =>
                    setObservationExposed(event.target.checked)
                  }
                />{" "}
                Exposed
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={observationEngaged}
                  onChange={(event) =>
                    setObservationEngaged(event.target.checked)
                  }
                />{" "}
                Engaged
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={observationConverted}
                  onChange={(event) =>
                    setObservationConverted(event.target.checked)
                  }
                />{" "}
                Converted
              </label>
            </div>
            <label>
              Value
              <input
                value={observationValue}
                onChange={(event) => setObservationValue(event.target.value)}
                inputMode="decimal"
              />
            </label>
            <button
              className="button primary"
              type="button"
              onClick={() => void record()}
              disabled={busy}
            >
              تسجيل Observation
            </button>
          </div>
        </div>
      ) : null}
      {summary ? (
        <div className="card">
          <div className="section-heading">
            <div>
              <h3>Evidence & Learning</h3>
              <p>
                Observations: <strong>{summary.observation_count}</strong> •
                statistical significance claimed:{" "}
                <strong>
                  {summary.statistical_significance_claimed ? "yes" : "no"}
                </strong>
              </p>
            </div>
            <button
              className="button secondary"
              type="button"
              onClick={() => void refreshSummary()}
              disabled={busy}
            >
              تحديث الملخص
            </button>
          </div>
          <div className="grid">
            {summary.variants.map((variant) => (
              <article className="card" key={variant.variant_id}>
                <strong>{variant.variant_id}</strong>
                <div className="account-meta">
                  Exposure {variant.exposure_count} • Engagement{" "}
                  {(variant.engagement_rate * 100).toFixed(2)}% • Conversion{" "}
                  {(variant.conversion_rate * 100).toFixed(2)}% • Value{" "}
                  {variant.total_value.toFixed(2)}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
      {message ? (
        <div className="notice success" role="status">
          {message}
        </div>
      ) : null}
    </section>
  );
}
