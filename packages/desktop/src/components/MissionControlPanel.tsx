import type { ReactElement } from "react";

interface Account {
  readonly id: string;
  readonly display_name: string;
  readonly status: string;
  readonly platform: string;
}

interface Campaign {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly task_count: number;
}

interface Task {
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly attempts: number;
  readonly max_attempts: number;
}

interface Approval {
  readonly id: string;
  readonly status: string;
}

interface Conversation {
  readonly id: string;
  readonly status: string;
}

interface Analytics {
  readonly attempted: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly blocked: number;
  readonly pending: number;
  readonly running: number;
  readonly success_rate: number;
}

interface MissionControlProps {
  readonly workspaceName: string;
  readonly accounts: readonly Account[];
  readonly campaigns: readonly Campaign[];
  readonly tasks: readonly Task[];
  readonly approvals: readonly Approval[];
  readonly conversations: readonly Conversation[];
  readonly analytics: Analytics | null;
  readonly runtimeOnline: boolean;
}

function Metric({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly detail?: string;
}): ReactElement {
  return (
    <div className="card">
      <strong>{label}</strong>
      <div className="price">{value}</div>
      {detail ? <div className="account-meta">{detail}</div> : null}
    </div>
  );
}

export function MissionControlPanel({
  workspaceName,
  accounts,
  campaigns,
  tasks,
  approvals,
  conversations,
  analytics,
  runtimeOnline,
}: MissionControlProps): ReactElement {
  const blocked = tasks.filter(
    (task) => task.status === "blocked" || task.status === "waiting",
  );
  const failed = tasks.filter((task) => task.status === "failed");
  const pendingApprovals = approvals.filter(
    (approval) => approval.status === "pending",
  );
  const disconnected = accounts.filter(
    (account) => account.status !== "connected",
  );
  const activeCampaigns = campaigns.filter(
    (campaign) =>
      campaign.status === "active" || campaign.status === "scheduled",
  );
  const activeConversations = conversations.filter(
    (conversation) => conversation.status === "open",
  );

  const priorities: string[] = [];
  if (!runtimeOnline) priorities.push("Runtime الذكاء المحلي يحتاج مراجعة");
  if (pendingApprovals.length) {
    priorities.push(pendingApprovals.length + " موافقة تنتظر قراراً بشرياً");
  }
  if (blocked.length) {
    priorities.push(blocked.length + " مهمة متوقفة وتحتاج تدخلاً");
  }
  if (disconnected.length) {
    priorities.push(disconnected.length + " حساب/Connector غير متصل");
  }
  if (failed.length) {
    priorities.push(failed.length + " مهمة فاشلة تحتاج مراجعة");
  }
  if (!priorities.length) priorities.push("لا توجد حواجز تشغيلية واضحة الآن");

  return (
    <section className="card">
      <div className="actions">
        <div>
          <h2>ORBIT Mission Control</h2>
          <p>
            مساحة العمل: <strong>{workspaceName}</strong> • الصورة التشغيلية
            الحالية من الـlocal runtime.
          </p>
        </div>
        <span className="account-meta">
          Local AI: {runtimeOnline ? "متصل" : "غير متصل"}
        </span>
      </div>

      <div className="grid">
        <Metric label="الحملات النشطة" value={activeCampaigns.length} />
        <Metric
          label="الموافقات"
          value={pendingApprovals.length}
          detail="تنتظر قراراً"
        />
        <Metric label="المهام المتوقفة" value={blocked.length} />
        <Metric label="المحادثات المفتوحة" value={activeConversations.length} />
        <Metric label="الحسابات غير المتصلة" value={disconnected.length} />
        <Metric
          label="معدل النجاح"
          value={
            analytics ? (analytics.success_rate * 100).toFixed(1) + "%" : "—"
          }
          detail={
            analytics
              ? analytics.succeeded + " ناجح / " + analytics.failed + " فشل"
              : "لا توجد بيانات"
          }
        />
      </div>

      <div className="card">
        <h3>Priority Queue</h3>
        <div className="account-list">
          {priorities.slice(0, 5).map((item) => (
            <div className="account-row" key={item}>
              <div>{item}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
