import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Layers3, ShieldCheck } from "lucide-react";
import { buildBulkPlan, type BulkPlanItem } from "@orbit/core";

interface AccountOption {
  readonly id: string;
  readonly platform: string;
  readonly display_name: string;
}

interface CampaignOption {
  readonly id: string;
  readonly name: string;
}

interface ContentOption {
  readonly id: string;
  readonly title: string;
  readonly approval_status: string;
}

interface BulkPlannerProps {
  readonly accounts: readonly AccountOption[];
  readonly campaigns: readonly CampaignOption[];
  readonly contentItems: readonly ContentOption[];
  readonly onTasksChanged: () => Promise<void>;
}

function parsePositiveInteger(
  value: string,
  fallback: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function toLocalInputValue(date: Date): string {
  const adjusted = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000,
  );
  return adjusted.toISOString().slice(0, 16);
}

export function BulkPlannerPanel({
  accounts,
  campaigns,
  contentItems,
  onTasksChanged,
}: BulkPlannerProps): ReactElement {
  const [campaignId, setCampaignId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [contentId, setContentId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [startAt, setStartAt] = useState(() =>
    toLocalInputValue(new Date(Date.now() + 15 * 60_000)),
  );
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [count, setCount] = useState("5");
  const [priority, setPriority] = useState("10");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<readonly BulkPlanItem[]>([]);
  const [planSeed, setPlanSeed] = useState(() => `bulk-${Date.now()}`);

  const selectedContent = useMemo(
    () => contentItems.find((item) => item.id === contentId),
    [contentId, contentItems],
  );

  const invalidatePreview = (): void => {
    setPreview([]);
  };

  const buildPlan = (): readonly BulkPlanItem[] | null => {
    try {
      return buildBulkPlan({
        startAt: new Date(startAt).toISOString(),
        intervalMinutes: Number(intervalMinutes),
        count: Number(count),
        seed: planSeed,
      });
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "خطة النشر الجماعي غير صالحة.",
      );
      return null;
    }
  };

  const previewPlan = (): void => {
    setError("");
    setMessage("");

    if (!campaignId || !accountId || !contentId || !destinationId.trim()) {
      setError("اختر الحملة والحساب والمحتوى وأدخل الوجهة قبل المعاينة.");
      return;
    }

    if (selectedContent?.approval_status !== "approved") {
      setError(
        "Bulk Planner يسمح فقط بالمحتوى المعتمد؛ مرّر المحتوى عبر Approval أولاً.",
      );
      return;
    }

    const plan = buildPlan();
    if (plan) setPreview(plan);
  };

  const enqueuePlan = async (): Promise<void> => {
    setError("");
    setMessage("");

    if (!campaignId || !accountId || !contentId || !destinationId.trim()) {
      setError("أكمل الحملة والحساب والمحتوى والوجهة أولاً.");
      return;
    }

    const account = accounts.find((item) => item.id === accountId);
    if (!account) {
      setError("الحساب المحدد غير موجود.");
      return;
    }

    if (selectedContent?.approval_status !== "approved") {
      setError("لا يمكن إنشاء خطة نشر جماعي لمحتوى غير معتمد.");
      return;
    }

    const plan = preview.length > 0 ? preview : buildPlan();
    if (!plan) return;

    try {
      setBusy(true);
      const results: string[] = [];

      for (const item of plan) {
        await invoke("task_enqueue", {
          id: item.idempotencyKey,
          campaignId,
          accountId,
          platform: account.platform,
          kind: "publish",
          priority: parsePositiveInteger(priority, 10, 100),
          availableAt: item.availableAt,
          maxAttempts: 3,
          idempotencyKey: item.idempotencyKey,
          contentId,
          destinationId: destinationId.trim(),
        });
        results.push(item.idempotencyKey);
      }

      setMessage(
        `تمت إضافة ${results.length} مهمة للنظام. التنفيذ نفسه يظل خاضعًا للـqueue والسياسات والموافقة.`,
      );
      setPreview([]);
      setPlanSeed(`bulk-${Date.now()}`);
      await onTasksChanged();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "فشل إنشاء خطة النشر الجماعي",
      );
      await onTasksChanged();
    } finally {
      setBusy(false);
    }
  };

  const selectedAccount = accounts.find((item) => item.id === accountId);

  return (
    <section className="card" aria-labelledby="bulk-planner-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">PUBLISHING WORKBENCH • BULK PLANNER</div>
          <h2 id="bulk-planner-title">
            <Layers3 size={20} /> مخطط النشر الجماعي
          </h2>
          <p>
            أنشئ حتى 50 مهمة نشر مجدولة فوق طابور ORBIT الحالي. تتم معاينة الخطة
            أولاً، والمحتوى غير المعتمد لا يُقبل.
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
          الحملة
          <select
            value={campaignId}
            onChange={(event) => {
              setCampaignId(event.target.value);
              invalidatePreview();
            }}
          >
            <option value="">اختر حملة</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          الحساب
          <select
            value={accountId}
            onChange={(event) => {
              setAccountId(event.target.value);
              invalidatePreview();
            }}
          >
            <option value="">اختر حساباً</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.display_name} • {account.platform}
              </option>
            ))}
          </select>
        </label>

        <label>
          المحتوى المعتمد
          <select
            value={contentId}
            onChange={(event) => {
              setContentId(event.target.value);
              invalidatePreview();
            }}
          >
            <option value="">اختر محتوى</option>
            {contentItems.map((content) => (
              <option key={content.id} value={content.id}>
                {content.title} • {content.approval_status}
              </option>
            ))}
          </select>
        </label>

        <label>
          الوجهة
          <input
            value={destinationId}
            onChange={(event) => {
              setDestinationId(event.target.value);
              invalidatePreview();
            }}
            placeholder="page-or-channel-001"
          />
        </label>

        <label>
          أول نشر
          <input
            type="datetime-local"
            value={startAt}
            onChange={(event) => {
              setStartAt(event.target.value);
              invalidatePreview();
            }}
          />
        </label>

        <label>
          الفاصل بالدقائق
          <input
            inputMode="numeric"
            value={intervalMinutes}
            onChange={(event) => {
              setIntervalMinutes(event.target.value);
              invalidatePreview();
            }}
          />
        </label>

        <label>
          عدد المنشورات
          <input
            inputMode="numeric"
            max={50}
            value={count}
            onChange={(event) => {
              setCount(event.target.value);
              invalidatePreview();
            }}
          />
        </label>

        <label>
          الأولوية
          <input
            inputMode="numeric"
            max={100}
            value={priority}
            onChange={(event) => {
              setPriority(event.target.value);
              invalidatePreview();
            }}
          />
        </label>
      </div>

      <div className="actions">
        <button
          className="button secondary"
          type="button"
          onClick={previewPlan}
          disabled={busy}
        >
          معاينة الخطة
        </button>
        <button
          className="button primary"
          type="button"
          onClick={() => void enqueuePlan()}
          disabled={busy || !selectedAccount}
        >
          {busy ? "جاري إنشاء المهام..." : "إضافة كل المهام للطابور"}
        </button>
      </div>

      {preview.length > 0 ? (
        <div className="result-list">
          {preview.map((item) => (
            <div className="result" key={item.idempotencyKey}>
              <strong>#{item.index}</strong>
              <div className="account-meta">
                {new Date(item.availableAt).toLocaleString("ar-EG")} •{" "}
                {selectedAccount?.platform}
              </div>
              <div className="account-meta">{item.idempotencyKey}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
