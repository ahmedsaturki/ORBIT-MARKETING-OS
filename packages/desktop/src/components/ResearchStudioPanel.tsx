import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface KnowledgeSourceView {
  readonly id: string;
  readonly source_type: string;
  readonly title: string;
  readonly locator: string | null;
  readonly collected_at: string;
}

interface ResearchBriefView {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly question: string;
  readonly objectives_json: string;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ResearchFindingView {
  readonly id: string;
  readonly brief_id: string;
  readonly title: string;
  readonly statement: string;
  readonly source_ids_json: string;
  readonly confidence: number;
  readonly observed_at: string;
  readonly expires_at: string | null;
  readonly tags_json: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ResearchStudioProps {
  readonly workspaceId: string;
}

async function native<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

const kindOptions = [
  ["competitor", "Competitor"],
  ["market", "Market"],
  ["audience", "Audience"],
  ["content", "Content"],
  ["channel", "Channel"],
  ["offer", "Offer"],
  ["customer_voice", "Customer voice"],
  ["general", "General"],
] as const;

function splitComma(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseIds(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) &&
    parsed.every((item) => typeof item === "string")
    ? parsed
    : [];
}

export function ResearchStudioPanel({ workspaceId }: ResearchStudioProps) {
  const [sources, setSources] = useState<readonly KnowledgeSourceView[]>([]);
  const [briefs, setBriefs] = useState<readonly ResearchBriefView[]>([]);
  const [findings, setFindings] = useState<readonly ResearchFindingView[]>([]);
  const [selectedBriefId, setSelectedBriefId] = useState("");
  const [briefName, setBriefName] = useState("");
  const [briefKind, setBriefKind] = useState("competitor");
  const [briefQuestion, setBriefQuestion] = useState("");
  const [briefObjectives, setBriefObjectives] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceLocator, setSourceLocator] = useState("");
  const [findingId, setFindingId] = useState("");
  const [findingTitle, setFindingTitle] = useState("");
  const [findingStatement, setFindingStatement] = useState("");
  const [findingSourceIds, setFindingSourceIds] = useState("");
  const [findingConfidence, setFindingConfidence] = useState("0.8");
  const [findingObservedAt, setFindingObservedAt] = useState(
    new Date().toISOString(),
  );
  const [findingExpiresAt, setFindingExpiresAt] = useState("");
  const [findingTags, setFindingTags] = useState("research");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      setBusy(true);
      setError("");
      const [nextSources, nextBriefs, nextFindings] = await Promise.all([
        native<KnowledgeSourceView[]>("knowledge_source_list"),
        native<ResearchBriefView[]>("research_brief_list"),
        native<ResearchFindingView[]>("research_finding_list", {}),
      ]);
      setSources(
        nextSources.filter((source) => source.source_type === "research"),
      );
      setBriefs(nextBriefs);
      setFindings(nextFindings);
      setSelectedBriefId((current) =>
        current && nextBriefs.some((brief) => brief.id === current)
          ? current
          : (nextBriefs[0]?.id ?? ""),
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل تحميل Research Studio",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (workspaceId) void load();
  }, [load, workspaceId]);

  const saveSource = async (): Promise<void> => {
    const id = sourceId.trim() || "research-source-" + Date.now();
    const title = sourceTitle.trim();
    if (!title) {
      setError("أدخل عنوان المصدر.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      setMessage("");
      await native("knowledge_source_upsert", {
        id,
        sourceType: "research",
        title,
        locator: sourceLocator.trim() || null,
      });
      setSourceId("");
      setSourceTitle("");
      setSourceLocator("");
      await load();
      setMessage("تم حفظ مصدر البحث.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حفظ المصدر");
    } finally {
      setBusy(false);
    }
  };

  const saveBrief = async (): Promise<void> => {
    const id =
      "research-brief-" +
      (briefName.trim().toLowerCase().replace(/\s+/g, "-") || Date.now());
    if (!briefName.trim() || !briefQuestion.trim()) {
      setError("أدخل اسم البحث والسؤال الرئيسي.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      setMessage("");
      const result = await native<ResearchBriefView>("research_brief_upsert", {
        id,
        name: briefName.trim(),
        kind: briefKind,
        question: briefQuestion.trim(),
        objectivesJson: JSON.stringify(splitComma(briefObjectives)),
        status: "active",
      });
      setSelectedBriefId(result.id);
      setBriefName("");
      setBriefQuestion("");
      setBriefObjectives("");
      await load();
      setMessage("تم حفظ Research Brief وربطه بالـworkspace الحالية.");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل حفظ الـResearch Brief",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveFinding = async (): Promise<void> => {
    if (!selectedBriefId || !findingTitle.trim() || !findingStatement.trim()) {
      setError("اختر Research Brief وأدخل عنوان ونتيجة بحث.");
      return;
    }

    const ids = splitComma(findingSourceIds);
    if (ids.length === 0) {
      setError("كل Finding يجب أن يكون مرتبطًا بمصدر واحد على الأقل.");
      return;
    }

    const confidence = Number(findingConfidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      setError("الثقة يجب أن تكون بين 0 و1.");
      return;
    }

    try {
      setBusy(true);
      setError("");
      setMessage("");
      await native("research_finding_upsert", {
        id: findingId.trim() || "research-finding-" + Date.now(),
        briefId: selectedBriefId,
        title: findingTitle.trim(),
        statement: findingStatement.trim(),
        sourceIdsJson: JSON.stringify(ids),
        confidence,
        observedAt: findingObservedAt,
        expiresAt: findingExpiresAt.trim() || null,
        tagsJson: JSON.stringify(splitComma(findingTags)),
      });
      setFindingId("");
      setFindingTitle("");
      setFindingStatement("");
      setFindingSourceIds("");
      setFindingObservedAt(new Date().toISOString());
      setFindingExpiresAt("");
      await load();
      setMessage("تم حفظ Finding موثّق بالمصادر.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حفظ الـFinding");
    } finally {
      setBusy(false);
    }
  };

  const publish = async (id: string): Promise<void> => {
    try {
      setBusy(true);
      setError("");
      setMessage("");
      await native("research_publish_to_knowledge", { findingId: id });
      setMessage("تم نقل الـFinding إلى ORBIT Knowledge بعد التحقق من مصادره.");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "فشل نشر الـFinding إلى Knowledge",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-labelledby="research-studio-title">
      <div className="section-heading">
        <div>
          <div className="eyebrow">RESEARCH • INTELLIGENCE • EVIDENCE</div>
          <h2 id="research-studio-title">
            <Search size={20} /> Research Studio
          </h2>
          <p>
            طبقة بحث حقيقية فوق ORBIT Brain: سؤال → مصادر → Findings →
            Knowledge. لا يتم اعتماد Finding بدون مصدر ولا تخرج بيانات خارج
            الـworkspace.
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

      {error ? (
        <div className="notice error" role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="notice success" role="status">
          <CheckCircle2 size={16} /> {message}
        </div>
      ) : null}

      <div className="grid">
        <div className="card">
          <h3>
            <BookOpen size={18} /> Research Brief
          </h3>
          <label>
            الاسم
            <input
              value={briefName}
              onChange={(event) => setBriefName(event.target.value)}
              placeholder="Competitive positioning scan"
            />
          </label>
          <label>
            النوع
            <select
              value={briefKind}
              onChange={(event) => setBriefKind(event.target.value)}
            >
              {kindOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            السؤال الرئيسي
            <textarea
              value={briefQuestion}
              onChange={(event) => setBriefQuestion(event.target.value)}
              rows={4}
              placeholder="ما الذي تغير في السوق أو المنافسين؟"
            />
          </label>
          <label>
            أهداف البحث
            <input
              value={briefObjectives}
              onChange={(event) => setBriefObjectives(event.target.value)}
              placeholder="price, positioning, channel"
            />
          </label>
          <button
            className="button primary"
            type="button"
            onClick={() => void saveBrief()}
            disabled={busy}
          >
            إنشاء Research Brief
          </button>

          <div className="account-list">
            {briefs.slice(0, 8).map((brief) => (
              <button
                className="account-row"
                key={brief.id}
                type="button"
                onClick={() => setSelectedBriefId(brief.id)}
                aria-pressed={selectedBriefId === brief.id}
              >
                <strong>{brief.name}</strong>
                <span className="account-meta">
                  {brief.kind} • {brief.status}
                </span>
              </button>
            ))}
            {!briefs.length ? (
              <div className="result">لا توجد Research Briefs بعد.</div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <h3>
            <ShieldCheck size={18} /> Evidence Sources
          </h3>
          <p>
            المصدر يُخزن كـresearch source، ويظل منفصلًا عن الأسرار وبيانات
            الحسابات.
          </p>
          <label>
            Source ID
            <input
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
            />
          </label>
          <label>
            عنوان المصدر
            <input
              value={sourceTitle}
              onChange={(event) => setSourceTitle(event.target.value)}
              placeholder="Competitor homepage / customer interview"
            />
          </label>
          <label>
            URL / Locator
            <input
              value={sourceLocator}
              onChange={(event) => setSourceLocator(event.target.value)}
              placeholder="https://..."
            />
          </label>
          <button
            className="button primary"
            type="button"
            onClick={() => void saveSource()}
            disabled={busy}
          >
            إضافة مصدر
          </button>
          <div className="account-list">
            {sources.slice(0, 8).map((source) => (
              <div className="account-row" key={source.id}>
                <div>
                  <strong>{source.title}</strong>
                  <div className="account-meta">
                    {source.id} {source.locator ? "• " + source.locator : ""}
                  </div>
                </div>
              </div>
            ))}
            {!sources.length ? (
              <div className="result">
                أضف أول مصدر بحث ثم استخدمه في Finding.
              </div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <h3>Research Finding</h3>
          <label>
            الـBrief
            <select
              value={selectedBriefId}
              onChange={(event) => setSelectedBriefId(event.target.value)}
              disabled={!briefs.length}
            >
              <option value="">اختر Research Brief</option>
              {briefs.map((brief) => (
                <option key={brief.id} value={brief.id}>
                  {brief.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Finding ID
            <input
              value={findingId}
              onChange={(event) => setFindingId(event.target.value)}
            />
          </label>
          <label>
            العنوان
            <input
              value={findingTitle}
              onChange={(event) => setFindingTitle(event.target.value)}
              placeholder="Observed market signal"
            />
          </label>
          <label>
            النتيجة
            <textarea
              value={findingStatement}
              onChange={(event) => setFindingStatement(event.target.value)}
              rows={5}
              placeholder="سجل ما تدعمه المصادر فعليًا، وليس استنتاجًا غير مثبت."
            />
          </label>
          <label>
            Source IDs
            <input
              value={findingSourceIds}
              onChange={(event) => setFindingSourceIds(event.target.value)}
              placeholder="source-1, source-2"
            />
          </label>
          <div className="actions">
            <label>
              Confidence
              <input
                value={findingConfidence}
                onChange={(event) => setFindingConfidence(event.target.value)}
                inputMode="decimal"
              />
            </label>
            <label>
              Observed at
              <input
                value={findingObservedAt}
                onChange={(event) => setFindingObservedAt(event.target.value)}
              />
            </label>
          </div>
          <label>
            Expiry (optional)
            <input
              value={findingExpiresAt}
              onChange={(event) => setFindingExpiresAt(event.target.value)}
              placeholder="2026-10-26T00:00:00Z"
            />
          </label>
          <label>
            Tags
            <input
              value={findingTags}
              onChange={(event) => setFindingTags(event.target.value)}
              placeholder="positioning, price"
            />
          </label>
          <button
            className="button primary"
            type="button"
            onClick={() => void saveFinding()}
            disabled={busy || !briefs.length}
          >
            حفظ Finding
          </button>
        </div>
      </div>

      <div className="card">
        <div className="section-heading">
          <div>
            <h3>Evidence Ledger</h3>
            <p>
              {findings.length} findings • {sources.length} research sources
            </p>
          </div>
        </div>
        <div className="result-list">
          {findings.slice(0, 12).map((finding) => {
            const sourceCount = parseIds(finding.source_ids_json).length;
            return (
              <article className="card" key={finding.id}>
                <div className="eyebrow">
                  {finding.brief_id} • confidence{" "}
                  {finding.confidence.toFixed(2)}
                </div>
                <strong>{finding.title}</strong>
                <p>{finding.statement}</p>
                <div className="account-meta">
                  {sourceCount} source(s) • observed {finding.observed_at}
                  {finding.expires_at ? " • expires " + finding.expires_at : ""}
                </div>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => void publish(finding.id)}
                  disabled={busy}
                >
                  نشر إلى Knowledge
                </button>
              </article>
            );
          })}
          {!findings.length ? (
            <div className="result">لا توجد Findings موثقة بعد.</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
