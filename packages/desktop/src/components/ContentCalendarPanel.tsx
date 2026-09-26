import { useMemo } from "react";
import { CalendarDays } from "lucide-react";

export interface PublishingCalendarTask {
  readonly id: string;
  readonly accountId: string;
  readonly platform: string;
  readonly kind: string;
  readonly status: string;
  readonly priority: number;
  readonly availableAt: string;
}

interface ContentCalendarPanelProps {
  readonly tasks: readonly PublishingCalendarTask[];
}

interface CalendarDay {
  readonly key: string;
  readonly date: Date;
  readonly tasks: readonly PublishingCalendarTask[];
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function dayKey(value: Date): string {
  const day = startOfDay(value);
  return [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, "0"),
    String(day.getDate()).padStart(2, "0"),
  ].join("-");
}

function toDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    queued: "في الانتظار",
    running: "قيد التشغيل",
    succeeded: "نجح",
    failed: "فشل",
    blocked: "متوقف",
    awaiting_approval: "بانتظار الموافقة",
    awaiting_user_action: "بانتظار تدخل المستخدم",
  };
  return labels[status] ?? status;
}

export function ContentCalendarPanel({
  tasks,
}: ContentCalendarPanelProps): React.ReactElement {
  const days = useMemo<readonly CalendarDay[]>(() => {
    const now = new Date();
    const today = startOfDay(now);
    const dayMap = new Map<string, PublishingCalendarTask[]>();

    for (const task of tasks) {
      const date = toDate(task.availableAt);
      if (!date) continue;

      const day = startOfDay(date);
      const diffDays = Math.round(
        (day.getTime() - today.getTime()) / 86_400_000,
      );

      if (diffDays < -1 || diffDays > 6) continue;

      const key = dayKey(day);
      const bucket = dayMap.get(key) ?? [];
      bucket.push(task);
      dayMap.set(key, bucket);
    }

    return Array.from({ length: 8 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index - 1);
      const key = dayKey(date);
      return {
        key,
        date,
        tasks: [...(dayMap.get(key) ?? [])].sort(
          (left, right) =>
            new Date(left.availableAt).getTime() -
              new Date(right.availableAt).getTime() ||
            right.priority - left.priority ||
            left.id.localeCompare(right.id),
        ),
      };
    });
  }, [tasks]);

  const locale = "ar-EG";
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    [],
  );
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <div className="eyebrow">PUBLISHING WORKBENCH • QUEUE VIEW</div>
          <h2>
            <CalendarDays size={20} /> تقويم التشغيل والنشر
          </h2>
          <p>
            رؤية أسبوعية للمهام الموجودة بالفعل في طابور ORBIT. لا ينشئ هذا
            التقويم جدولة ثانية؛ كل مهمة تظل خاضعة للموافقة والسياسات وطابور
            التشغيل الموحّد.
          </p>
        </div>
        <div className="account-meta">
          {tasks.length} مهمة في الذاكرة الحالية
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
          gap: 12,
        }}
      >
        {days.map((day, index) => {
          const isToday = index === 1;
          const isYesterday = index === 0;
          return (
            <article
              className="card"
              key={day.key}
              style={{
                minHeight: 150,
                border: isToday ? "2px solid currentColor" : undefined,
              }}
            >
              <div className="section-heading">
                <div>
                  <strong>{dateFormatter.format(day.date)}</strong>
                  {isToday ? (
                    <div className="eyebrow">اليوم</div>
                  ) : isYesterday ? (
                    <div className="eyebrow">أمس</div>
                  ) : null}
                </div>
                <span className="account-meta">{day.tasks.length}</span>
              </div>

              {day.tasks.length === 0 ? (
                <div className="account-meta">لا توجد مهام</div>
              ) : (
                <div className="result-list">
                  {day.tasks.slice(0, 8).map((task) => {
                    const date = toDate(task.availableAt);
                    return (
                      <div className="result" key={task.id}>
                        <strong>
                          {task.platform} • {task.kind}
                        </strong>
                        <div className="account-meta">
                          {date ? timeFormatter.format(date) : "وقت غير صالح"} •{" "}
                          {statusLabel(task.status)}
                        </div>
                      </div>
                    );
                  })}
                  {day.tasks.length > 8 ? (
                    <div className="account-meta">
                      +{day.tasks.length - 8} مهام إضافية في الطابور
                    </div>
                  ) : null}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
