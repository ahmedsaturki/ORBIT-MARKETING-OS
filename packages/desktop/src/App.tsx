import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent, ReactElement } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Platform } from "@orbit/core";
import {
  Bot,
  CheckCircle2,
  Image as ImageIcon,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { OutcomesPanel } from "./components/OutcomesPanel";
import { MissionControlPanel } from "./components/MissionControlPanel";
import { OperatingGraphPanel } from "./components/OperatingGraphPanel";
import { OperationalEventTimelinePanel } from "./components/OperationalEventTimelinePanel";
import { StrategyStudioPanel } from "./components/StrategyStudioPanel";
import { ExperimentStudioPanel } from "./components/ExperimentStudioPanel";
import {
  analyzeLocalImage,
  DEFAULT_RUNTIME_URL,
  fetchLocalRuntimeHealth,
  generateLocalContent,
  sendLocalChat,
  type RuntimeChatMessage,
  type RuntimeHealth,
} from "./lib/runtimeClient";

interface Health {
  readonly status: string;
  readonly database: string;
}

interface WorkspaceView {
  readonly id: string;
  readonly name: string;
  readonly created_at: string;
}

interface VaultResult {
  readonly label: string;
  readonly payload_version: number;
}

interface AccountView {
  readonly id: string;
  readonly platform: string;
  readonly display_name: string;
  readonly username: string | null;
  readonly status: string;
  readonly has_encrypted_session: boolean;
}

interface CampaignView {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly task_count: number;
  readonly created_at: string;
}

interface ContentView {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly approval_status: string;
  readonly tags_json: string;
  readonly updated_at: string;
}

interface ApprovalView {
  readonly id: string;
  readonly content_id: string;
  readonly requested_by: string;
  readonly status: string;
  readonly decided_by: string | null;
  readonly decided_at: string | null;
  readonly note: string | null;
}

interface MediaAssetView {
  readonly id: string;
  readonly kind: string;
  readonly filename: string;
  readonly mime_type: string;
  readonly size_bytes: number;
  readonly sha256: string | null;
  readonly local_path: string;
  readonly tags_json: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface AutomationRulePackView {
  readonly id: string;
  readonly platform: string;
  readonly version: string;
  readonly schema_version: number;
  readonly rules_json: string;
  readonly enabled: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ContentVariantView {
  readonly content_id: string;
  readonly platform: Platform;
  readonly body: string | null;
}

interface ContactView {
  readonly id: string;
  readonly display_name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly source_platform: string | null;
  readonly status: string;
  readonly notes: string | null;
  readonly updated_at: string;
}

interface ConversationView {
  readonly id: string;
  readonly account_id: string | null;
  readonly contact_id: string | null;
  readonly platform: string;
  readonly external_thread_id: string | null;
  readonly status: string;
  readonly message_count: number;
  readonly updated_at: string;
}

interface TaskView {
  readonly id: string;
  readonly campaign_id: string;
  readonly content_id: string | null;
  readonly destination_id: string | null;
  readonly account_id: string;
  readonly platform: string;
  readonly kind: string;
  readonly priority: number;
  readonly status: string;
  readonly attempts: number;
  readonly max_attempts: number;
  readonly idempotency_key: string;
  readonly available_at: string;
  readonly created_at: string;
}

interface AnalyticsSummaryView {
  readonly attempted: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly blocked: number;
  readonly pending: number;
  readonly running: number;
  readonly completion_rate: number;
  readonly success_rate: number;
  readonly failure_rate: number;
}

interface AuditView {
  readonly id: string;
  readonly timestamp: string;
  readonly category: string;
  readonly action: string;
  readonly outcome: string;
  readonly actor: string;
  readonly entity_id: string | null;
  readonly previous_hash: string;
  readonly hash: string;
}

interface MessageView {
  readonly id: string;
  readonly conversation_id: string;
  readonly direction: string;
  readonly body: string;
  readonly sent_at: string;
}

interface TelegramExecutionView {
  readonly task_id: string;
  readonly status: string;
  readonly external_message_id: number | null;
  readonly message: string;
  readonly retry_at: string | null;
}

const SUPPORTED_PLATFORMS: readonly Platform[] = [
  "facebook",
  "instagram",
  "telegram",
  "whatsapp",
  "linkedin",
  "tiktok",
];

function isPlatform(value: string): value is Platform {
  return SUPPORTED_PLATFORMS.includes(value as Platform);
}

interface LicenseStatus {
  readonly installed: boolean;
  readonly valid: boolean;
  readonly reason: string;
  readonly license_id: string | null;
  readonly plan: string | null;
  readonly subject: string | null;
  readonly expires_at: string | null;
  readonly max_devices: number | null;
  readonly account_limit: number | null;
  readonly feature_count: number;
  readonly account_count: number;
}

async function callNative<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args);
}

export function App(): ReactElement {
  const [health, setHealth] = useState<Health | null>(null);
  const [workspaces, setWorkspaces] = useState<readonly WorkspaceView[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceView | null>(
    null,
  );
  const [newWorkspaceId, setNewWorkspaceId] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [label, setLabel] = useState("demo");
  const [secret, setSecret] = useState("");
  const [password, setPassword] = useState("");
  const [stored, setStored] = useState(false);
  const [recovered, setRecovered] = useState("");
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<readonly AccountView[]>([]);
  const [accountId, setAccountId] = useState("");
  const [accountPlatform, setAccountPlatform] = useState<Platform>("facebook");
  const [accountName, setAccountName] = useState("");
  const [accountUsername, setAccountUsername] = useState("");
  const [accountSession, setAccountSession] = useState("");
  const [backups, setBackups] = useState<readonly string[]>([]);
  const [selectedBackup, setSelectedBackup] = useState("");
  const [backupStatus, setBackupStatus] = useState("");
  const [campaigns, setCampaigns] = useState<readonly CampaignView[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [campaignAccountId, setCampaignAccountId] = useState("");
  const [contentItems, setContentItems] = useState<readonly ContentView[]>([]);
  const [contentVariants, setContentVariants] = useState<
    readonly ContentVariantView[]
  >([]);
  const [variantPlatform, setVariantPlatform] = useState<Platform>("facebook");
  const [variantBody, setVariantBody] = useState("");
  const [mediaAssets, setMediaAssets] = useState<readonly MediaAssetView[]>([]);
  const [mediaId, setMediaId] = useState("");
  const [mediaKind, setMediaKind] = useState("image");
  const [mediaFilename, setMediaFilename] = useState("");
  const [mediaMimeType, setMediaMimeType] = useState("image/png");
  const [mediaSizeBytes, setMediaSizeBytes] = useState("1");
  const [mediaSha256, setMediaSha256] = useState("");
  const [mediaLocalPath, setMediaLocalPath] = useState("");
  const [mediaTags, setMediaTags] = useState("");
  const [rulePacks, setRulePacks] = useState<readonly AutomationRulePackView[]>(
    [],
  );
  const [rulePackId, setRulePackId] = useState("");
  const [rulePackPlatform, setRulePackPlatform] = useState("facebook");
  const [rulePackVersion, setRulePackVersion] = useState("1.0.0");
  const [rulePackRules, setRulePackRules] = useState(
    '[\n  {\n    "id": "publish",\n    "taskKinds": ["publish"],\n    "enabled": true,\n    "requiresConfirmation": true,\n    "maxAttempts": 3,\n    "timeoutMs": 30000\n  }\n]',
  );

  const [contentId, setContentId] = useState("");
  const [contentTitle, setContentTitle] = useState("");
  const [contentBody, setContentBody] = useState("");
  const [contentTags, setContentTags] = useState("");
  const [contentCampaignId, setContentCampaignId] = useState("");
  const [selectedContentId, setSelectedContentId] = useState("");
  const [approvalId, setApprovalId] = useState("");
  const [approvals, setApprovals] = useState<readonly ApprovalView[]>([]);
  const [tasks, setTasks] = useState<readonly TaskView[]>([]);
  const [taskCampaignId, setTaskCampaignId] = useState("");
  const [taskAccountId, setTaskAccountId] = useState("");
  const [taskKind, setTaskKind] = useState("publish");
  const [taskId, setTaskId] = useState("");
  const [taskIdempotencyKey, setTaskIdempotencyKey] = useState("");
  const [taskContentId, setTaskContentId] = useState("");
  const [taskDestinationId, setTaskDestinationId] = useState("");
  const [executionMessage, setExecutionMessage] = useState("");
  const [contacts, setContacts] = useState<readonly ContactView[]>([]);
  const [conversations, setConversations] = useState<
    readonly ConversationView[]
  >([]);
  const [conversationId, setConversationId] = useState("");
  const [conversationAccountId, setConversationAccountId] = useState("");
  const [conversationPlatform, setConversationPlatform] = useState("facebook");
  const [conversationStatus, setConversationStatus] = useState("new");
  const [externalThreadId, setExternalThreadId] = useState("");
  const [messageConversationId, setMessageConversationId] = useState("");
  const [messageDirection, setMessageDirection] = useState("inbound");
  const [messageBody, setMessageBody] = useState("");
  const [messages, setMessages] = useState<readonly MessageView[]>([]);
  const [contactId, setContactId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactStatus, setContactStatus] = useState("new");
  const [contactNotes, setContactNotes] = useState("");
  const [auditEntries, setAuditEntries] = useState<readonly AuditView[]>([]);
  const [analyticsSummary, setAnalyticsSummary] =
    useState<AnalyticsSummaryView | null>(null);
  const [auditIntegrity, setAuditIntegrity] = useState<
    "unknown" | "valid" | "invalid"
  >("unknown");
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [licenseToken, setLicenseToken] = useState("");
  const [licenseMessage, setLicenseMessage] = useState("");

  const [runtimeHealth, setRuntimeHealth] = useState<RuntimeHealth | null>(
    null,
  );
  const [aiRuntimeBusy, setAiRuntimeBusy] = useState(false);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatMessages, setAiChatMessages] = useState<
    readonly RuntimeChatMessage[]
  >([]);
  const [aiChatRole, setAiChatRole] = useState("marketing_strategist");
  const [aiChatProfile, setAiChatProfile] = useState("balanced");

  const [aiTopic, setAiTopic] = useState("");
  const [aiDialect, setAiDialect] = useState("فصحى مبسطة");
  const [aiTone, setAiTone] = useState("احترافي");
  const [aiAudience, setAiAudience] = useState("الجمهور العام");
  const [aiGeneratedContent, setAiGeneratedContent] = useState("");

  const [aiImageData, setAiImageData] = useState("");
  const [aiImageName, setAiImageName] = useState("");
  const [aiImageType, setAiImageType] = useState<
    "ad_critique" | "ocr_copy" | "platform_fit" | "comprehensive"
  >("comprehensive");
  const [aiImagePrompt, setAiImagePrompt] = useState("");
  const [aiImageAnalysis, setAiImageAnalysis] = useState("");

  const loadWorkspaces = async (): Promise<void> => {
    const items = await callNative<WorkspaceView[]>("workspace_list");
    const current = await callNative<WorkspaceView>("workspace_current");
    setWorkspaces(items);
    setActiveWorkspace(current);
  };

  const createWorkspace = async (): Promise<void> => {
    if (!newWorkspaceName.trim()) {
      setError("أدخل اسم مساحة العمل الجديدة");
      return;
    }
    try {
      setError("");
      const created = await callNative<WorkspaceView>("workspace_create", {
        id: newWorkspaceId.trim() || null,
        name: newWorkspaceName.trim(),
      });
      await callNative<WorkspaceView>("workspace_select", { id: created.id });
      resetWorkspaceTransientState();
      setNewWorkspaceId("");
      setNewWorkspaceName("");
      await checkHealth();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل إنشاء مساحة العمل",
      );
    }
  };

  const resetWorkspaceTransientState = (): void => {
    setSelectedContentId("");
    setApprovalId("");
    setMessageConversationId("");
    setMessages([]);
    setAiChatMessages([]);
    setAiChatInput("");
    setAiGeneratedContent("");
    setAiImageData("");
    setAiImageName("");
    setAiImageAnalysis("");
    setAiImagePrompt("");
  };

  const selectWorkspace = async (id: string): Promise<void> => {
    if (!id || id === activeWorkspace?.id) return;
    try {
      setError("");
      await callNative<WorkspaceView>("workspace_select", { id });
      resetWorkspaceTransientState();
      await checkHealth();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل تبديل مساحة العمل",
      );
    }
  };

  const loadCampaigns = async (): Promise<void> => {
    try {
      setCampaigns(await callNative<CampaignView[]>("campaign_list"));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل تحميل الحملات");
    }
  };

  const deleteMediaAsset = async (id: string): Promise<void> => {
    try {
      setError("");
      await callNative<boolean>("media_asset_delete", { id });
      await loadMediaAssets();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل حذف بيانات الوسيط",
      );
    }
  };

  const importMediaAsset = async (): Promise<void> => {
    if (!mediaId.trim() || !mediaLocalPath.trim()) {
      setError("أدخل معرف الوسيط والمسار المحلي قبل الاستيراد");
      return;
    }
    try {
      setError("");
      const result = await callNative<MediaAssetView>("media_asset_import", {
        id: mediaId.trim(),
        path: mediaLocalPath.trim(),
        tagsJson: JSON.stringify(
          mediaTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      });
      setMediaFilename(result.filename);
      setMediaMimeType(result.mime_type);
      setMediaSizeBytes(String(result.size_bytes));
      setMediaSha256(result.sha256 ?? "");
      setMediaAssets((current) => [
        result,
        ...current.filter((item) => item.id !== result.id),
      ]);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل استيراد الملف المحلي",
      );
    }
  };

  const loadMediaAssets = async (): Promise<void> => {
    try {
      setMediaAssets(
        await callNative<MediaAssetView[]>("media_asset_list", {}),
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل تحميل مكتبة الوسائط",
      );
    }
  };

  const saveMediaAsset = async (): Promise<void> => {
    const size = Number(mediaSizeBytes);
    if (
      !mediaId.trim() ||
      !mediaFilename.trim() ||
      !mediaLocalPath.trim() ||
      !Number.isSafeInteger(size) ||
      size <= 0
    ) {
      setError("أدخل بيانات الوسيط وحجمه ومساره المحلي بشكل صحيح");
      return;
    }

    try {
      setError("");
      await callNative<MediaAssetView>("media_asset_upsert", {
        id: mediaId.trim(),
        kind: mediaKind,
        filename: mediaFilename.trim(),
        mimeType: mediaMimeType.trim(),
        sizeBytes: size,
        sha256: mediaSha256.trim() || null,
        localPath: mediaLocalPath.trim(),
        tagsJson: JSON.stringify(
          mediaTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      });
      setMediaId("");
      setMediaFilename("");
      setMediaSha256("");
      setMediaLocalPath("");
      setMediaTags("");
      await loadMediaAssets();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حفظ الوسيط");
    }
  };

  const loadRulePacks = async (): Promise<void> => {
    try {
      setRulePacks(
        await callNative<AutomationRulePackView[]>(
          "automation_rule_pack_list",
          {},
        ),
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل تحميل قواعد الأتمتة",
      );
    }
  };

  const toggleRulePack = async (
    id: string,
    enabled: boolean,
  ): Promise<void> => {
    try {
      setError("");
      await callNative<boolean>("automation_rule_pack_set_enabled", {
        id,
        enabled,
      });
      await loadRulePacks();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل تغيير حالة Rule Pack",
      );
    }
  };

  const saveRulePack = async (): Promise<void> => {
    if (
      !rulePackId.trim() ||
      !rulePackVersion.trim() ||
      !rulePackRules.trim()
    ) {
      setError("أدخل معرف الإصدار وقواعد الأتمتة");
      return;
    }
    try {
      const parsed: unknown = JSON.parse(rulePackRules);
      if (!Array.isArray(parsed)) {
        setError("قواعد الأتمتة يجب أن تكون مصفوفة JSON");
        return;
      }
    } catch {
      setError("قواعد الأتمتة يجب أن تكون JSON صالحًا");
      return;
    }

    try {
      setError("");
      await callNative<AutomationRulePackView>("automation_rule_pack_upsert", {
        id: rulePackId.trim(),
        platform: rulePackPlatform,
        version: rulePackVersion.trim(),
        schemaVersion: 1,
        rulesJson: rulePackRules,
        enabled: true,
      });
      await loadRulePacks();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل حفظ حزمة قواعد الأتمتة",
      );
    }
  };

  const loadContent = async (): Promise<void> => {
    try {
      const items = await callNative<ContentView[]>("content_list");
      setContentItems(items);
      setSelectedContentId((current) => current || items[0]?.id || "");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل تحميل المحتوى");
    }
  };

  const loadVariants = async (contentId = selectedContentId): Promise<void> => {
    if (!contentId) {
      setContentVariants([]);
      return;
    }
    try {
      const items = await callNative<ContentVariantView[]>(
        "content_variant_list",
        {
          contentId: contentId,
        },
      );
      setContentVariants(items);
      const current = items.find((item) => item.platform === variantPlatform);
      setVariantBody(current?.body ?? "");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل تحميل نسخ المحتوى",
      );
    }
  };

  const saveVariant = async (): Promise<void> => {
    if (!selectedContentId || !variantBody.trim()) {
      setError("اختر محتوى واكتب النسخة الخاصة بالمنصة");
      return;
    }
    try {
      setError("");
      await callNative<ContentVariantView>("content_variant_upsert", {
        contentId: selectedContentId,
        platform: variantPlatform,
        body: variantBody.trim(),
      });
      await loadVariants(selectedContentId);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل حفظ نسخة المحتوى",
      );
    }
  };

  const loadApprovals = async (): Promise<void> => {
    try {
      const items = await callNative<ApprovalView[]>("approval_list");
      setApprovals(items);
      setApprovalId((current) => current || items[0]?.id || "");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل تحميل الموافقات",
      );
    }
  };

  const saveContent = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!contentId.trim() || !contentTitle.trim() || !contentBody.trim()) {
      setError("أدخل معرف المحتوى والعنوان والنص");
      return;
    }
    try {
      setError("");
      await callNative<ContentView>("content_upsert", {
        id: contentId.trim(),
        title: contentTitle.trim(),
        body: contentBody.trim(),
        approvalStatus: "draft",
        tagsJson: JSON.stringify(
          contentTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      });
      setContentId("");
      setContentTitle("");
      setContentBody("");
      setContentTags("");
      await loadContent();
      await loadVariants(selectedContentId);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حفظ المحتوى");
    }
  };

  const attachContent = async (): Promise<void> => {
    if (!contentCampaignId || !selectedContentId) {
      setError("اختر الحملة والمحتوى قبل الربط");
      return;
    }
    try {
      setError("");
      await callNative<boolean>("campaign_attach_content", {
        campaignId: contentCampaignId,
        contentId: selectedContentId,
      });
      await loadCampaigns();
      setError("");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل ربط المحتوى بالحملة",
      );
    }
  };

  const requestApproval = async (): Promise<void> => {
    if (!selectedContentId) {
      setError("اختر محتوى لطلب الموافقة");
      return;
    }
    try {
      setError("");
      const result = await callNative<ApprovalView>("approval_request", {
        id: "approval-" + Date.now(),
        contentId: selectedContentId,
        reviewerIdsJson: JSON.stringify(["local-user"]),
        note: "طلب موافقة من مساحة العمل المحلية",
      });
      setApprovalId(result.id);
      await loadContent();
      await loadApprovals();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل طلب الموافقة");
    }
  };

  const decideApproval = async (
    status: "approved" | "rejected" | "changes_requested",
  ): Promise<void> => {
    if (!approvalId) {
      setError("اختر موافقة أولاً");
      return;
    }
    try {
      setError("");
      await callNative<ApprovalView>("approval_decide", {
        id: approvalId,
        status,
        note: "تم اتخاذ القرار من تطبيق ORBIT المحلي",
      });
      await loadContent();
      await loadApprovals();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل اتخاذ قرار الموافقة",
      );
    }
  };

  const loadTasks = async (): Promise<void> => {
    try {
      setTasks(await callNative<TaskView[]>("task_list", {}));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل تحميل المهام");
    }
  };

  const enqueueTask = async (): Promise<void> => {
    if (!taskCampaignId || !taskAccountId) {
      setError("اختر الحملة والحساب قبل إنشاء المهمة");
      return;
    }

    const selectedAccount = accounts.find(
      (account) => account.id === taskAccountId,
    );
    if (!selectedAccount) {
      setError("الحساب المحدد غير موجود في مساحة العمل الحالية");
      return;
    }

    try {
      setError("");
      const content = taskKind === "sync" ? null : selectedContentId || null;
      if (taskKind !== "sync" && !content) {
        setError("اختر محتوى للمهمة الخارجية");
        return;
      }
      const destination = taskDestinationId.trim() || null;
      if (taskKind !== "sync" && !destination) {
        setError("أدخل معرّف وجهة المهمة الخارجية");
        return;
      }
      await callNative<TaskView>("task_enqueue", {
        id: taskId.trim() || "task-" + Date.now(),
        campaignId: taskCampaignId,
        accountId: taskAccountId,
        platform: selectedAccount.platform,
        kind: taskKind,
        priority: 10,
        availableAt: new Date().toISOString(),
        maxAttempts: 3,
        idempotencyKey: taskIdempotencyKey.trim() || null,
        contentId: content,
        destinationId: destination,
      });
      setTaskId("");
      setTaskIdempotencyKey("");
      setTaskDestinationId("");
      await loadTasks();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل إضافة المهمة");
    }
  };

  const claimNextTask = async (): Promise<void> => {
    try {
      setError("");
      await callNative<TaskView | null>("task_claim_next", {
        now: new Date().toISOString(),
      });
      await loadTasks();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل سحب المهمة التالية",
      );
    }
  };

  const failTask = async (id: string): Promise<void> => {
    try {
      setError("");
      await callNative<TaskView>("task_fail", {
        id,
        now: new Date().toISOString(),
      });
      await loadTasks();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل تسجيل فشل المهمة",
      );
    }
  };

  const executeTelegramTask = async (taskId: string): Promise<void> => {
    if (!password) {
      setError("أدخل كلمة مرور الخزنة قبل تنفيذ Telegram");
      return;
    }

    const confirmed = window.confirm(
      "سيتم إرسال المهمة إلى Telegram الآن. تأكد أن المحتوى والوجهة صحيحان. هل تريد المتابعة؟",
    );
    if (!confirmed) return;

    try {
      setError("");
      setExecutionMessage("جاري تنفيذ مهمة Telegram...");
      const result = await callNative<TelegramExecutionView>(
        "telegram_execute_task",
        {
          taskId: taskId,
          vaultPassword: password,
          userConfirmed: true,
        },
      );
      setExecutionMessage(result.message);
      await loadTasks();
      await loadAccounts();
    } catch (caught: unknown) {
      setExecutionMessage("");
      setError(caught instanceof Error ? caught.message : "فشل تنفيذ Telegram");
      await loadTasks();
    }
  };

  const loadAnalytics = async (): Promise<void> => {
    try {
      setAnalyticsSummary(
        await callNative<AnalyticsSummaryView>("analytics_summary"),
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل تحميل التحليلات",
      );
    }
  };

  const loadAudit = async (): Promise<void> => {
    try {
      setAuditEntries(
        await callNative<AuditView[]>("audit_list", { limit: 25 }),
      );
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل تحميل سجل التدقيق",
      );
    }
  };

  const verifyAudit = async (): Promise<void> => {
    try {
      setError("");
      const valid = await callNative<boolean>("audit_verify");
      setAuditIntegrity(valid ? "valid" : "invalid");
      await loadAudit();
    } catch (caught: unknown) {
      setAuditIntegrity("invalid");
      setError(
        caught instanceof Error
          ? caught.message
          : "فشل التحقق من سلامة سجل التدقيق",
      );
    }
  };

  const loadInbox = async (): Promise<void> => {
    try {
      const items = await callNative<ConversationView[]>("inbox_list");
      setConversations(items);
      setMessageConversationId((current) => current || items[0]?.id || "");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل تحميل صندوق المحادثات",
      );
    }
  };

  const saveConversation = async (): Promise<void> => {
    if (!conversationId.trim()) {
      setError("أدخل معرف المحادثة");
      return;
    }
    try {
      setError("");
      if (!conversationAccountId) {
        setError("اختر الحساب المرتبط بالمحادثة");
        return;
      }
      const selectedConversationAccount = accounts.find(
        (item) => item.id === conversationAccountId,
      );
      if (
        !selectedConversationAccount ||
        selectedConversationAccount.platform !== conversationPlatform
      ) {
        setError("حساب المحادثة يجب أن يطابق منصة المحادثة");
        return;
      }
      await callNative<ConversationView>("conversation_upsert", {
        id: conversationId.trim(),
        accountId: conversationAccountId,
        contactId: contactId.trim() || null,
        platform: conversationPlatform,
        externalThreadId: externalThreadId.trim() || null,
        status: conversationStatus,
      });
      setConversationId("");
      setConversationAccountId("");
      setExternalThreadId("");
      await loadInbox();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حفظ المحادثة");
    }
  };

  const saveMessage = async (): Promise<void> => {
    if (!messageConversationId || !messageBody.trim()) {
      setError("اختر محادثة واكتب الرسالة");
      return;
    }
    try {
      setError("");
      await callNative<MessageView>("message_add", {
        id: "msg-" + Date.now(),
        conversationId: messageConversationId,
        direction: messageDirection,
        body: messageBody.trim(),
      });
      setMessageBody("");
      await loadInbox();
      await loadMessages(messageConversationId);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل إضافة الرسالة");
    }
  };

  const loadMessages = async (id: string): Promise<void> => {
    try {
      setMessageConversationId(id);
      setMessages(
        await callNative<MessageView[]>("message_list", {
          conversationId: id,
        }),
      );
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل تحميل الرسائل");
    }
  };

  const loadContacts = async (): Promise<void> => {
    try {
      setContacts(await callNative<ContactView[]>("contact_list", {}));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل تحميل العملاء");
    }
  };

  const createCampaign = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!campaignName.trim() || !campaignAccountId) {
      setError("أدخل اسم الحملة واختر حساباً مستهدفاً");
      return;
    }
    try {
      setError("");
      await callNative<CampaignView>("campaign_create", {
        name: campaignName.trim(),
        accountIds: [campaignAccountId],
      });
      setCampaignName("");
      await loadCampaigns();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل إنشاء الحملة");
    }
  };

  const saveContact = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!contactId.trim() || !contactName.trim()) {
      setError("أدخل معرف العميل والاسم");
      return;
    }
    try {
      setError("");
      const result = await callNative<ContactView>("contact_upsert", {
        id: contactId.trim(),
        displayName: contactName.trim(),
        phone: contactPhone.trim() || null,
        email: contactEmail.trim() || null,
        sourcePlatform: null,
        status: contactStatus,
        notes: contactNotes.trim() || null,
      });
      setContacts((current) => [
        result,
        ...current.filter((item) => item.id !== result.id),
      ]);
      setContactId("");
      setContactName("");
      setContactPhone("");
      setContactEmail("");
      setContactNotes("");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حفظ العميل");
    }
  };

  const loadBackups = async (): Promise<void> => {
    try {
      const items = await callNative<string[]>("backup_list");
      setBackups(items);
      setSelectedBackup((current) => current || items[0] || "");
    } catch (caught: unknown) {
      setBackupStatus(
        caught instanceof Error ? caught.message : "فشل تحميل النسخ المحلية",
      );
    }
  };

  const createBackup = async (): Promise<void> => {
    if (!password) {
      setBackupStatus("أدخل كلمة مرور الخزنة أولاً.");
      return;
    }
    try {
      setBackupStatus("جاري إنشاء نسخة مشفرة...");
      const filename = await callNative<string>("backup_create", { password });
      setBackupStatus("تم إنشاء: " + filename);
      await loadBackups();
    } catch (caught: unknown) {
      setBackupStatus(
        caught instanceof Error ? caught.message : "فشل إنشاء النسخة المشفرة",
      );
    }
  };

  const restoreBackup = async (): Promise<void> => {
    if (!selectedBackup || !password) {
      setBackupStatus("اختر نسخة وأدخل كلمة المرور.");
      return;
    }
    try {
      setBackupStatus("جاري فحص النسخة والاسترجاع...");
      await callNative<boolean>("backup_restore", {
        filename: selectedBackup,
        password,
      });
      setBackupStatus("تم استرجاع النسخة بعد اجتياز integrity check.");
      await checkHealth();
    } catch (caught: unknown) {
      setBackupStatus(
        caught instanceof Error ? caught.message : "فشل استرجاع النسخة",
      );
    }
  };

  const loadAccounts = async (): Promise<void> => {
    try {
      setError("");
      setAccounts(await callNative<AccountView[]>("account_list"));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل تحميل الحسابات المحلية",
      );
    }
  };

  const checkHealth = async (): Promise<void> => {
    try {
      setError("");
      setHealth(await callNative<Health>("app_health"));
      await loadWorkspaces();
      await loadAccounts();
      await loadCampaigns();
      await loadTasks();
      await loadContent();
      await loadApprovals();
      await loadContacts();
      await loadInbox();
      await loadAnalytics();
      await loadMediaAssets();
      await loadRulePacks();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل فحص التطبيق المحلي",
      );
    }
  };

  const storeAccount = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!accountId.trim() || !accountName.trim()) {
      setError("أدخل معرف الحساب واسم الحساب");
      return;
    }
    if (accountSession && !password) {
      setError("أدخل كلمة مرور الخزنة قبل حفظ بيانات الجلسة المشفرة");
      return;
    }
    try {
      setError("");
      const result = await callNative<AccountView>("account_upsert", {
        id: accountId.trim(),
        platform: accountPlatform,
        displayName: accountName.trim(),
        username: accountUsername.trim() || null,
        session: accountSession || null,
        password: accountSession ? password : null,
      });
      setAccounts((current) => [
        result,
        ...current.filter((item) => item.id !== result.id),
      ]);
      setAccountSession("");
      setAccountId("");
      setAccountName("");
      setAccountUsername("");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل حفظ الحساب المحلي",
      );
    }
  };

  const deleteAccount = async (id: string): Promise<void> => {
    try {
      setError("");
      const deleted = await callNative<boolean>("account_delete", { id });
      if (deleted)
        setAccounts((current) => current.filter((item) => item.id !== id));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حذف الحساب");
    }
  };

  const storeSecret = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!label.trim() || !secret || !password) {
      setError("أدخل اسم السجل والقيمة وكلمة المرور");
      return;
    }
    try {
      setError("");
      const result = await callNative<VaultResult>("vault_put", {
        label: label.trim(),
        plaintext: secret,
        password,
      });
      setStored(result.payload_version === 1);
      setSecret("");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل حفظ السجل المشفر",
      );
    }
  };

  const loadSecret = async (): Promise<void> => {
    if (!label.trim() || !password) {
      setError("أدخل اسم السجل وكلمة المرور");
      return;
    }
    try {
      setError("");
      const result = await callNative<string>("vault_get", {
        label: label.trim(),
        password,
      });
      setRecovered(result);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل فك السجل المشفر",
      );
    }
  };

  const loadLicense = async (): Promise<void> => {
    try {
      const result = await callNative<LicenseStatus>("license_status");
      setLicense(result);
    } catch (caught: unknown) {
      setLicense(null);
      setLicenseMessage(
        caught instanceof Error ? caught.message : "فشل قراءة حالة الترخيص",
      );
    }
  };

  const installLicense = async (): Promise<void> => {
    const token = licenseToken.trim();
    if (!token) {
      setLicenseMessage("ألصق license token أولاً.");
      return;
    }
    try {
      setError("");
      const result = await callNative<LicenseStatus>("license_install", {
        token,
      });
      setLicense(result);
      setLicenseMessage(
        result.valid ? "تم التفعيل والتحقق من توقيع الترخيص." : result.reason,
      );
      if (result.valid) setLicenseToken("");
    } catch (caught: unknown) {
      setLicenseMessage(
        caught instanceof Error ? caught.message : "فشل تثبيت الترخيص",
      );
    }
  };

  const removeLicense = async (): Promise<void> => {
    try {
      await callNative<boolean>("license_delete");
      await loadLicense();
      setLicenseMessage("تم حذف الترخيص المحلي.");
    } catch (caught: unknown) {
      setLicenseMessage(
        caught instanceof Error ? caught.message : "فشل حذف الترخيص",
      );
    }
  };

  const checkLocalAiRuntime = async (): Promise<void> => {
    try {
      setAiRuntimeBusy(true);
      const result = await fetchLocalRuntimeHealth(DEFAULT_RUNTIME_URL);
      setRuntimeHealth(result);
    } catch (caught: unknown) {
      setRuntimeHealth(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "تعذر الاتصال بـAI Runtime المحلي",
      );
    } finally {
      setAiRuntimeBusy(false);
    }
  };

  const sendAiChatMessage = async (): Promise<void> => {
    const clean = aiChatInput.trim();
    if (!clean || aiRuntimeBusy) return;

    const nextMessages = [
      ...aiChatMessages,
      { role: "user" as const, text: clean },
    ];
    setAiChatMessages(nextMessages);
    setAiChatInput("");

    try {
      setAiRuntimeBusy(true);
      setError("");
      const result = await sendLocalChat(
        nextMessages,
        aiChatRole,
        aiChatProfile,
        DEFAULT_RUNTIME_URL,
      );
      setAiChatMessages([
        ...nextMessages,
        { role: "assistant", text: result.text },
      ]);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "فشل إرسال الرسالة إلى AI المحلي",
      );
      setAiChatMessages(nextMessages);
    } finally {
      setAiRuntimeBusy(false);
    }
  };

  const generateAiContent = async (): Promise<void> => {
    if (!aiTopic.trim() || aiRuntimeBusy) {
      setError("اكتب موضوعًا لتوليد المحتوى.");
      return;
    }

    try {
      setAiRuntimeBusy(true);
      setError("");
      const result = await generateLocalContent({
        topic: aiTopic,
        dialect: aiDialect,
        tone: aiTone,
        targetAudience: aiAudience,
      });
      setAiGeneratedContent(result.content);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "فشل توليد المحتوى محليًا",
      );
    } finally {
      setAiRuntimeBusy(false);
    }
  };

  const chooseAiImage = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10_000_000) {
      setError("حجم الصورة يجب ألا يتجاوز 10MB.");
      event.currentTarget.value = "";
      return;
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
        reader.onload = () => {
          const result = reader.result;
          if (typeof result !== "string") {
            reject(new Error("تعذر تحويل الصورة"));
            return;
          }
          resolve(result);
        };
        reader.readAsDataURL(file);
      });
      setAiImageData(dataUrl);
      setAiImageName(file.name);
      setAiImageAnalysis("");
      setError("");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل تحميل الصورة");
    }
  };

  const analyzeAiImage = async (): Promise<void> => {
    if (!aiImageData || aiRuntimeBusy) {
      setError("اختر صورة أولًا.");
      return;
    }

    try {
      setAiRuntimeBusy(true);
      setError("");
      const result = await analyzeLocalImage({
        imageBase64: aiImageData,
        analysisType: aiImageType,
        prompt: aiImagePrompt,
      });
      setAiImageAnalysis(result.analysis);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "فشل تحليل الصورة عبر AI المحلي",
      );
    } finally {
      setAiRuntimeBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initialize = async (): Promise<void> => {
      await checkHealth();
      if (cancelled) return;
      await loadAudit();
      if (cancelled) return;
      await loadLicense();
    };

    void initialize().catch((caught: unknown) => {
      if (cancelled) return;
      setError(
        caught instanceof Error ? caught.message : "فشل تهيئة تطبيق ORBIT",
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="shell">
      {activeWorkspace ? (
        <MissionControlPanel
          workspaceName={activeWorkspace.name}
          accounts={accounts}
          campaigns={campaigns}
          tasks={tasks}
          approvals={approvals}
          conversations={conversations}
          analytics={analyticsSummary}
          runtimeOnline={runtimeHealth?.status === "ok"}
        />
      ) : null}

      {activeWorkspace ? (
        <ExperimentStudioPanel workspaceId={activeWorkspace.id} />
      ) : null}

      <header className="hero">
        <div>
          <div className="eyebrow">LOCAL-FIRST • TAURI V2</div>
          <h1>ORBIT Marketing OS</h1>
          <p>
            سطح تشغيل محلي لإدارة البيانات الحساسة، الحملات، والاتصالات المصرح
            بها.
          </p>
        </div>
        <button
          className="button secondary"
          type="button"
          onClick={() => void checkHealth()}
        >
          فحص التشغيل المحلي
        </button>
      </header>

      {error ? <div className="notice error">{error}</div> : null}
      {health ? (
        <div className="notice success">
          <CheckCircle2 size={18} />
          <span>
            الخدمة: {health.status} • قاعدة البيانات: {health.database}
          </span>
        </div>
      ) : null}

      <section className="card">
        <div className="eyebrow">SECURE SESSION</div>
        <h2>جلسة الخزنة المحلية</h2>
        <p>
          كلمة المرور تبقى في ذاكرة التطبيق لهذه الجلسة فقط، ولا يتم عرضها أو
          تخزينها في واجهة الويب.
        </p>
        <label>
          كلمة مرور الخزنة
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            spellCheck={false}
          />
        </label>
        {password ? (
          <div className="account-meta">
            مضبوطة لهذه الجلسة — لا يتم عرض القيمة.
          </div>
        ) : (
          <div className="account-meta">
            غير مضبوطة بعد. مطلوبة لتشفير الجلسات والنسخ الاحتياطية وتنفيذ
            Telegram.
          </div>
        )}
      </section>

      <section className="card">
        <div className="eyebrow">LOCAL AI STUDIO</div>
        <div className="section-heading">
          <div>
            <h2>
              <Bot size={20} /> مساعد ORBIT المحلي
            </h2>
            <p>
              Chat وتوليد محتوى وتحليل صور عبر Ollama على الجهاز. لا يتم إرسال
              محتوى AI إلى السحابة من هذا السطح.
            </p>
          </div>
          <button
            className="button secondary"
            type="button"
            onClick={() => void checkLocalAiRuntime()}
            disabled={aiRuntimeBusy}
          >
            {aiRuntimeBusy ? "جاري الفحص..." : "فحص AI"}
          </button>
        </div>

        {runtimeHealth ? (
          <div className="result">
            AI: <strong>{runtimeHealth.status}</strong> • النموذج:{" "}
            {runtimeHealth.model ?? "غير معروف"} • رؤية:{" "}
            {runtimeHealth.visionConfigured ? "مفعلة" : "غير مفعلة"}
          </div>
        ) : (
          <div className="account-meta">
            Runtime المحلي الافتراضي: {DEFAULT_RUNTIME_URL}
          </div>
        )}

        <div className="grid">
          <section className="card">
            <div className="icon">
              <Sparkles size={20} />
            </div>
            <h3>محادثة محلية</h3>
            <div className="actions">
              <label>
                الدور
                <select
                  value={aiChatRole}
                  onChange={(event) => setAiChatRole(event.target.value)}
                >
                  <option value="marketing_strategist">
                    Marketing Strategist
                  </option>
                  <option value="copywriter">Copywriter</option>
                  <option value="crm_closer">CRM & Sales</option>
                  <option value="safety_specialist">Safety Specialist</option>
                </select>
              </label>
              <label>
                النمط
                <select
                  value={aiChatProfile}
                  onChange={(event) => setAiChatProfile(event.target.value)}
                >
                  <option value="balanced">Balanced</option>
                  <option value="fast">Fast</option>
                  <option value="reasoning">Reasoning</option>
                </select>
              </label>
            </div>
            <div className="result-list">
              {aiChatMessages.length === 0 ? (
                <div className="account-meta">
                  ابدأ بسؤال عن حملة أو محتوى أو متابعة عميل.
                </div>
              ) : (
                aiChatMessages.map((message, index) => (
                  <article className="card" key={String(index) + message.role}>
                    <strong>
                      {message.role === "user" ? "أنت" : "ORBIT AI"}
                    </strong>
                    <p style={{ whiteSpace: "pre-wrap" }}>{message.text}</p>
                  </article>
                ))
              )}
            </div>
            <label>
              رسالتك
              <textarea
                value={aiChatInput}
                onChange={(event) => setAiChatInput(event.target.value)}
                placeholder="مثال: اقترح لي 5 زوايا لحملة عقارية محلية..."
                rows={4}
                disabled={aiRuntimeBusy}
              />
            </label>
            <button
              className="button primary"
              type="button"
              onClick={() => void sendAiChatMessage()}
              disabled={!aiChatInput.trim() || aiRuntimeBusy}
            >
              إرسال إلى AI المحلي
            </button>
          </section>

          <section className="card">
            <div className="icon">
              <Sparkles size={20} />
            </div>
            <h3>توليد حزمة محتوى</h3>
            <label>
              الموضوع
              <input
                value={aiTopic}
                onChange={(event) => setAiTopic(event.target.value)}
                placeholder="موضوع الحملة"
              />
            </label>
            <div className="actions">
              <label>
                اللهجة
                <input
                  value={aiDialect}
                  onChange={(event) => setAiDialect(event.target.value)}
                />
              </label>
              <label>
                النبرة
                <input
                  value={aiTone}
                  onChange={(event) => setAiTone(event.target.value)}
                />
              </label>
            </div>
            <label>
              الجمهور
              <input
                value={aiAudience}
                onChange={(event) => setAiAudience(event.target.value)}
              />
            </label>
            <button
              className="button primary"
              type="button"
              onClick={() => void generateAiContent()}
              disabled={aiRuntimeBusy || !aiTopic.trim()}
            >
              توليد المحتوى
            </button>
            {aiGeneratedContent ? (
              <pre className="result" style={{ whiteSpace: "pre-wrap" }}>
                {aiGeneratedContent}
              </pre>
            ) : (
              <div className="account-meta">
                الناتج يظهر هنا ويمكن نسخه إلى Content Studio يدويًا.
              </div>
            )}
          </section>

          <section className="card">
            <div className="icon">
              <ImageIcon size={20} />
            </div>
            <h3>تحليل صورة محلي</h3>
            <label>
              الصورة
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void chooseAiImage(event)}
                disabled={aiRuntimeBusy}
              />
            </label>
            {aiImageName ? (
              <div className="account-meta">المحدد: {aiImageName}</div>
            ) : null}
            {aiImageData ? (
              <img
                src={aiImageData}
                alt={aiImageName || "صورة للتحليل"}
                style={{
                  maxHeight: 240,
                  width: "100%",
                  objectFit: "contain",
                  borderRadius: 12,
                }}
              />
            ) : null}
            <label>
              نوع التحليل
              <select
                value={aiImageType}
                onChange={(event) =>
                  setAiImageType(event.target.value as typeof aiImageType)
                }
              >
                <option value="comprehensive">مراجعة شاملة</option>
                <option value="ad_critique">نقد الإعلان</option>
                <option value="ocr_copy">استخراج النص</option>
                <option value="platform_fit">ملاءمة المنصات</option>
              </select>
            </label>
            <label>
              طلب إضافي
              <textarea
                value={aiImagePrompt}
                onChange={(event) => setAiImagePrompt(event.target.value)}
                rows={3}
                placeholder="ملاحظة اختيارية"
              />
            </label>
            <button
              className="button secondary"
              type="button"
              onClick={() => void analyzeAiImage()}
              disabled={!aiImageData || aiRuntimeBusy}
            >
              تحليل الصورة
            </button>
            {aiImageAnalysis ? (
              <pre className="result" style={{ whiteSpace: "pre-wrap" }}>
                {aiImageAnalysis}
              </pre>
            ) : null}
            {!runtimeHealth?.visionConfigured ? (
              <div className="account-meta">
                تحليل الصور يحتاج ضبط OLLAMA_VISION_MODEL في runtime.
              </div>
            ) : null}
          </section>
        </div>
      </section>

      <section className="grid">
        <section className="card workspace-switcher">
          <div>
            <div className="eyebrow">WORKSPACE</div>
            <h2>مساحة العمل الحالية</h2>
            <p>
              كل الحسابات والحملات والمحتوى والـCRM وصندوق المحادثات معزولة حسب
              مساحة العمل المحلية.
            </p>
          </div>
          <div className="actions">
            <label>
              المساحة النشطة
              <select
                value={activeWorkspace?.id ?? ""}
                onChange={(event) => void selectWorkspace(event.target.value)}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              اسم مساحة جديدة
              <input
                value={newWorkspaceName}
                onChange={(event) => setNewWorkspaceName(event.target.value)}
                placeholder="مثال: فريق التسويق"
              />
            </label>
            <label>
              معرف اختياري
              <input
                value={newWorkspaceId}
                onChange={(event) => setNewWorkspaceId(event.target.value)}
                placeholder="marketing-team"
              />
            </label>
            <button
              className="button primary"
              type="button"
              onClick={() => void createWorkspace()}
            >
              إنشاء وتفعيل
            </button>
          </div>
          {activeWorkspace ? (
            <div className="result">
              النشطة الآن: <strong>{activeWorkspace.name}</strong> •{" "}
              {activeWorkspace.id}
            </div>
          ) : null}
        </section>

        <article className="card">
          <div className="icon">
            <ShieldCheck size={22} />
          </div>
          <h2>الخزنة المحلية</h2>
          <p>
            البيانات الحساسة تُشفّر داخل Rust باستخدام Argon2id + AES-256-GCM
            قبل التخزين.
          </p>
        </article>
        <article className="card">
          <div className="icon">
            <LockKeyhole size={22} />
          </div>
          <h2>لا أسرار في السجل</h2>
          <p>
            الأوامر المحلية لا تكتب كلمات المرور أو الجلسات أو المفاتيح في سجل
            التطبيق.
          </p>
        </article>
        <article className="card">
          <div className="icon">
            <KeyRound size={22} />
          </div>
          <h2>تحكم صريح</h2>
          <p>
            عمليات التكامل الخارجية تُفصل عن التخزين المحلي وتحتاج إلى تفويض
            المستخدم.
          </p>
        </article>
      </section>

      <section className="grid workspace-grid">
        <div className="card">
          <h2>مكتبة الوسائط المحلية</h2>
          <p>
            يُحفظ Metadata محليًا داخل SQLite. الملف نفسه لا يُرفع إلى أي خدمة
            تلقائيًا.
          </p>
          <div className="vault-form">
            <label>
              معرف الوسيط
              <input
                value={mediaId}
                onChange={(event) => setMediaId(event.target.value)}
                placeholder="media-001"
              />
            </label>
            <label>
              النوع
              <select
                value={mediaKind}
                onChange={(event) => setMediaKind(event.target.value)}
              >
                <option value="image">صورة</option>
                <option value="video">فيديو</option>
                <option value="audio">صوت</option>
                <option value="document">مستند</option>
              </select>
            </label>
            <label>
              اسم الملف
              <input
                value={mediaFilename}
                onChange={(event) => setMediaFilename(event.target.value)}
                placeholder="launch.png"
              />
            </label>
            <label>
              MIME
              <input
                value={mediaMimeType}
                onChange={(event) => setMediaMimeType(event.target.value)}
                placeholder="image/png"
              />
            </label>
            <label>
              الحجم بالبايت
              <input
                value={mediaSizeBytes}
                onChange={(event) => setMediaSizeBytes(event.target.value)}
                inputMode="numeric"
              />
            </label>
            <label>
              SHA-256 (اختياري)
              <input
                value={mediaSha256}
                onChange={(event) => setMediaSha256(event.target.value)}
              />
            </label>
            <label>
              المسار المحلي
              <input
                value={mediaLocalPath}
                onChange={(event) => setMediaLocalPath(event.target.value)}
                placeholder="C:\media\launch.png"
              />
            </label>
            <label>
              الوسوم
              <input
                value={mediaTags}
                onChange={(event) => setMediaTags(event.target.value)}
                placeholder="launch, campaign"
              />
            </label>
            <div className="actions">
              <button
                className="button primary"
                type="button"
                onClick={() => void saveMediaAsset()}
              >
                حفظ بيانات الوسيط
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => void importMediaAsset()}
              >
                استيراد وفحص الملف
              </button>
            </div>
          </div>
          <div className="account-list">
            {mediaAssets.slice(0, 10).map((asset) => (
              <div className="account-row" key={asset.id}>
                <div>
                  <strong>{asset.filename}</strong>
                  <div className="account-meta">
                    {asset.kind} • {asset.size_bytes} bytes • {asset.local_path}
                  </div>
                </div>
                <button
                  className="button danger"
                  type="button"
                  onClick={() => void deleteMediaAsset(asset.id)}
                >
                  حذف Metadata
                </button>
              </div>
            ))}
            {!mediaAssets.length ? (
              <div className="result">لا توجد وسائط محفوظة.</div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <h2>حزم قواعد الأتمتة</h2>
          <p>
            قواعد versioned محفوظة محليًا، والقواعد الخارجية يجب أن تتطلب تأكيد
            المستخدم.
          </p>
          <div className="vault-form">
            <label>
              المعرف
              <input
                value={rulePackId}
                onChange={(event) => setRulePackId(event.target.value)}
                placeholder="facebook-default"
              />
            </label>
            <label>
              المنصة
              <select
                value={rulePackPlatform}
                onChange={(event) => setRulePackPlatform(event.target.value)}
              >
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="telegram">Telegram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="linkedin">LinkedIn</option>
                <option value="tiktok">TikTok</option>
              </select>
            </label>
            <label>
              الإصدار
              <input
                value={rulePackVersion}
                onChange={(event) => setRulePackVersion(event.target.value)}
              />
            </label>
            <label>
              القواعد JSON
              <textarea
                value={rulePackRules}
                onChange={(event) => setRulePackRules(event.target.value)}
                rows={10}
              />
            </label>
            <button
              className="button primary"
              type="button"
              onClick={() => void saveRulePack()}
            >
              حفظ Rule Pack
            </button>
          </div>
          <div className="account-list">
            {rulePacks.slice(0, 8).map((pack) => (
              <div className="account-row" key={pack.id + ":" + pack.platform}>
                <div>
                  <strong>
                    {pack.id} • {pack.platform}
                  </strong>
                  <div className="account-meta">
                    v{pack.version} • schema {pack.schema_version} •{" "}
                    {pack.enabled ? "مفعلة" : "متوقفة"}
                  </div>
                </div>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => void toggleRulePack(pack.id, !pack.enabled)}
                >
                  {pack.enabled ? "تعطيل" : "تفعيل"}
                </button>
              </div>
            ))}
            {!rulePacks.length ? (
              <div className="result">لا توجد Rule Packs محفوظة.</div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid workspace-grid">
        <div className="card">
          <h2>المحتوى والموافقات</h2>
          <p>
            أنشئ المحتوى محلياً، اربطه بحملة، ثم مرره عبر approval gate قبل أي
            مهمة خارجية.
          </p>
          <form className="vault-form" onSubmit={saveContent}>
            <label>
              معرف المحتوى
              <input
                value={contentId}
                onChange={(event) => setContentId(event.target.value)}
                placeholder="content-001"
              />
            </label>
            <label>
              العنوان
              <input
                value={contentTitle}
                onChange={(event) => setContentTitle(event.target.value)}
              />
            </label>
            <label>
              النص
              <textarea
                value={contentBody}
                onChange={(event) => setContentBody(event.target.value)}
                rows={6}
              />
            </label>
            <label>
              الوسوم (مفصولة بفواصل)
              <input
                value={contentTags}
                onChange={(event) => setContentTags(event.target.value)}
                placeholder="launch, real-estate, arabic"
              />
            </label>
            <button className="button primary" type="submit">
              حفظ مسودة المحتوى
            </button>
          </form>

          <label>
            المحتوى المحدد
            <select
              value={selectedContentId}
              onChange={(event) => {
                const id = event.target.value;
                setSelectedContentId(id);
                void loadVariants(id);
              }}
            >
              <option value="">اختر محتوى</option>
              {contentItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} • {item.approval_status}
                </option>
              ))}
            </select>
          </label>

          <div className="vault-form">
            <label>
              منصة النسخة
              <select
                value={variantPlatform}
                onChange={(event) => {
                  const platform = event.target.value;
                  if (!isPlatform(platform)) return;
                  setVariantPlatform(platform);
                  const current = contentVariants.find(
                    (item) => item.platform === platform,
                  );
                  setVariantBody(current?.body ?? "");
                }}
              >
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="telegram">Telegram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="linkedin">LinkedIn</option>
                <option value="tiktok">TikTok</option>
              </select>
            </label>
            <label>
              النص الخاص بالمنصة
              <textarea
                value={variantBody}
                onChange={(event) => setVariantBody(event.target.value)}
                rows={5}
                placeholder="نسخة معدلة لهذه المنصة..."
              />
            </label>
            <div className="actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => void loadVariants()}
              >
                تحميل النسخ
              </button>
              <button
                className="button primary"
                type="button"
                onClick={() => void saveVariant()}
                disabled={!selectedContentId}
              >
                حفظ نسخة المنصة
              </button>
            </div>
          </div>

          <div className="account-list">
            {contentVariants.map((variant) => (
              <button
                className="account-row"
                type="button"
                key={variant.content_id + ":" + variant.platform}
                onClick={() => {
                  setVariantPlatform(variant.platform);
                  setVariantBody(variant.body ?? "");
                }}
              >
                <div>
                  <strong>{variant.platform}</strong>
                  <div className="account-meta">
                    {variant.body ? variant.body.slice(0, 180) : "نسخة فارغة"}
                  </div>
                </div>
              </button>
            ))}
            {!contentVariants.length ? (
              <div className="result">لا توجد نسخ مخصصة لهذا المحتوى.</div>
            ) : null}
          </div>

          <label>
            الحملة لربط المحتوى
            <select
              value={contentCampaignId}
              onChange={(event) => setContentCampaignId(event.target.value)}
            >
              <option value="">اختر حملة</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>

          <div className="actions">
            <button
              className="button secondary"
              type="button"
              onClick={() => void attachContent()}
            >
              ربط بالحملة
            </button>
            <button
              className="button primary"
              type="button"
              onClick={() => void requestApproval()}
              disabled={!selectedContentId}
            >
              طلب موافقة
            </button>
          </div>

          <div className="account-list">
            {contentItems.slice(0, 8).map((item) => (
              <button
                className="account-row"
                type="button"
                key={item.id}
                onClick={() => setSelectedContentId(item.id)}
              >
                <div>
                  <strong>{item.title}</strong>
                  <div className="account-meta">
                    {item.id} • {item.approval_status} • {item.updated_at}
                  </div>
                </div>
              </button>
            ))}
            {!contentItems.length ? (
              <div className="result">لا يوجد محتوى محفوظ.</div>
            ) : null}
          </div>

          <label>
            الموافقة المحددة
            <select
              value={approvalId}
              onChange={(event) => setApprovalId(event.target.value)}
            >
              <option value="">اختر موافقة</option>
              {approvals.map((approval) => (
                <option key={approval.id} value={approval.id}>
                  {approval.id} • {approval.status} • {approval.content_id}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button
              className="button primary"
              type="button"
              onClick={() => void decideApproval("approved")}
            >
              اعتماد
            </button>
            <button
              className="button danger"
              type="button"
              onClick={() => void decideApproval("rejected")}
            >
              رفض
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => void decideApproval("changes_requested")}
            >
              طلب تعديلات
            </button>
          </div>
        </div>

        <div className="card">
          <h2>الحملات</h2>
          <p>الحملة تُحفظ محلياً وتُربط بالحسابات المستهدفة داخل SQLite.</p>
          <form className="vault-form" onSubmit={createCampaign}>
            <label>
              اسم الحملة
              <input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                placeholder="حملة سبتمبر"
              />
            </label>
            <label>
              الحساب المستهدف
              <select
                value={campaignAccountId}
                onChange={(event) => setCampaignAccountId(event.target.value)}
              >
                <option value="">اختر حساباً</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.display_name} • {account.platform}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button primary"
              type="submit"
              disabled={!accounts.length}
            >
              إنشاء حملة
            </button>
          </form>
          <div className="account-list">
            {campaigns.slice(0, 8).map((campaign) => (
              <div className="account-row" key={campaign.id}>
                <div>
                  <strong>{campaign.name}</strong>
                  <div className="account-meta">
                    {campaign.status} • {campaign.task_count} مهام
                  </div>
                </div>
              </div>
            ))}
            {!campaigns.length ? (
              <div className="result">لا توجد حملات محفوظة.</div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <h2>المهام</h2>
          <p>
            Queue native: pending / running / succeeded / failed / blocked /
            cancelled.
          </p>
          <div className="vault-form">
            <label>
              الحملة
              <select
                value={taskCampaignId}
                onChange={(event) => setTaskCampaignId(event.target.value)}
              >
                <option value="">اختر حملة</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name} • {campaign.status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              الحساب
              <select
                value={taskAccountId}
                onChange={(event) => setTaskAccountId(event.target.value)}
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
              نوع المهمة
              <select
                value={taskKind}
                onChange={(event) => setTaskKind(event.target.value)}
              >
                <option value="publish">نشر</option>
                <option value="message">رسالة</option>
                <option value="comment">تعليق</option>
                <option value="sync">مزامنة</option>
                <option value="engage">تفاعل</option>
              </select>
            </label>
            {taskKind !== "sync" ? (
              <label>
                المحتوى للمهمة
                <select
                  value={selectedContentId}
                  onChange={(event) => setSelectedContentId(event.target.value)}
                >
                  <option value="">اختر محتوى معتمد للمهمة</option>
                  {contentItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} • {item.approval_status}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {taskKind !== "sync" ? (
              <label>
                معرّف وجهة المهمة
                <input
                  value={taskDestinationId}
                  onChange={(event) => setTaskDestinationId(event.target.value)}
                  placeholder="مثال Telegram chat_id"
                />
              </label>
            ) : null}
            <label>
              معرف المهمة (اختياري)
              <input
                value={taskId}
                onChange={(event) => setTaskId(event.target.value)}
                placeholder="task-001"
              />
            </label>
            <label>
              Idempotency Key (اختياري)
              <input
                value={taskIdempotencyKey}
                onChange={(event) => setTaskIdempotencyKey(event.target.value)}
              />
            </label>
            {taskKind !== "sync" ? (
              <>
                <label>
                  Content ID
                  <input
                    value={taskContentId}
                    onChange={(event) => setTaskContentId(event.target.value)}
                    placeholder="content-001"
                  />
                </label>
                <label>
                  Destination ID
                  <input
                    value={taskDestinationId}
                    onChange={(event) =>
                      setTaskDestinationId(event.target.value)
                    }
                    placeholder="page-or-channel-001"
                  />
                </label>
              </>
            ) : null}
            <div className="actions">
              <button
                className="button primary"
                type="button"
                onClick={() => void enqueueTask()}
              >
                إضافة للمحلية
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => void claimNextTask()}
              >
                سحب التالية
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => void loadTasks()}
              >
                تحديث
              </button>
            </div>
          </div>
          {executionMessage ? (
            <div className="notice success">{executionMessage}</div>
          ) : null}
          <div className="account-list">
            {tasks.slice(0, 10).map((task) => (
              <div className="account-row" key={task.id}>
                <div>
                  <strong>
                    {task.kind} • {task.platform}
                  </strong>
                  <div className="account-meta">
                    {task.status} • {task.attempts}/{task.max_attempts} • أولوية{" "}
                    {task.priority} • {task.idempotency_key}
                  </div>
                </div>
                <div className="actions">
                  {task.status === "running" && task.platform === "telegram" ? (
                    <button
                      className="button primary"
                      type="button"
                      onClick={() => void executeTelegramTask(task.id)}
                    >
                      تنفيذ Telegram
                    </button>
                  ) : null}
                  {task.status === "running" ? (
                    <button
                      className="button danger"
                      type="button"
                      onClick={() => void failTask(task.id)}
                    >
                      تسجيل فشل / إعادة المحاولة
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {!tasks.length ? (
              <div className="result">لا توجد مهام محفوظة.</div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <h2>CRM المحلي</h2>
          <p>سجلات العملاء تُحفظ محلياً مع الحالة والملاحظات.</p>
          <form className="vault-form" onSubmit={saveContact}>
            <label>
              معرف العميل
              <input
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
                placeholder="lead-001"
              />
            </label>
            <label>
              الاسم
              <input
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
              />
            </label>
            <label>
              الهاتف
              <input
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
              />
            </label>
            <label>
              البريد الإلكتروني
              <input
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                type="email"
              />
            </label>
            <label>
              الحالة
              <select
                value={contactStatus}
                onChange={(event) => setContactStatus(event.target.value)}
              >
                <option value="new">جديد</option>
                <option value="interested">مهتم</option>
                <option value="sold">تم البيع</option>
                <option value="lost">خسرنا العميل</option>
              </select>
            </label>
            <label>
              ملاحظات
              <textarea
                value={contactNotes}
                onChange={(event) => setContactNotes(event.target.value)}
                rows={3}
              />
            </label>
            <button className="button primary" type="submit">
              حفظ العميل
            </button>
          </form>
          <div className="account-list">
            {contacts.slice(0, 8).map((contact) => (
              <div className="account-row" key={contact.id}>
                <div>
                  <strong>{contact.display_name}</strong>
                  <div className="account-meta">
                    {contact.status} {contact.phone ? "• " + contact.phone : ""}
                  </div>
                </div>
              </div>
            ))}
            {!contacts.length ? (
              <div className="result">لا توجد جهات اتصال.</div>
            ) : null}
          </div>
        </div>
      </section>

      {activeWorkspace ? (
        <OutcomesPanel
          workspaceId={activeWorkspace.id}
          contacts={contacts}
          campaigns={campaigns}
        />
      ) : null}

      {activeWorkspace ? (
        <StrategyStudioPanel workspaceId={activeWorkspace.id} />
      ) : null}

      {activeWorkspace ? (
        <OperatingGraphPanel workspaceId={activeWorkspace.id} />
      ) : null}

      {activeWorkspace ? (
        <OperationalEventTimelinePanel workspaceId={activeWorkspace.id} />
      ) : null}

      <section className="card">
        <h2>Inbox محلي</h2>
        <p>
          المحادثات والرسائل تُحفظ محلياً، ويُرفض أي ربط خارج مساحة العمل
          الحالية.
        </p>
        <div className="vault-form">
          <label>
            معرف المحادثة
            <input
              value={conversationId}
              onChange={(event) => setConversationId(event.target.value)}
              placeholder="thread-001"
            />
          </label>
          <label>
            الحساب المرتبط
            <select
              value={conversationAccountId}
              onChange={(event) => {
                const id = event.target.value;
                setConversationAccountId(id);
                const account = accounts.find((item) => item.id === id);
                if (account) setConversationPlatform(account.platform);
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
            العميل المرتبط (اختياري)
            <select
              value={contactId}
              onChange={(event) => setContactId(event.target.value)}
            >
              <option value="">بدون ربط</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            المنصة
            <select
              value={conversationPlatform}
              onChange={(event) => setConversationPlatform(event.target.value)}
            >
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="linkedin">LinkedIn</option>
              <option value="tiktok">TikTok</option>
            </select>
          </label>
          <label>
            External Thread ID (اختياري)
            <input
              value={externalThreadId}
              onChange={(event) => setExternalThreadId(event.target.value)}
            />
          </label>
          <label>
            الحالة
            <select
              value={conversationStatus}
              onChange={(event) => setConversationStatus(event.target.value)}
            >
              <option value="new">جديدة</option>
              <option value="interested">مهتم</option>
              <option value="potential_customer">عميل محتمل</option>
              <option value="complaint">شكوى</option>
              <option value="closed">مغلقة</option>
            </select>
          </label>
          <button
            className="button primary"
            type="button"
            onClick={() => void saveConversation()}
          >
            حفظ المحادثة
          </button>
        </div>

        <div className="account-list">
          {conversations.slice(0, 10).map((conversation) => (
            <button
              className="account-row"
              type="button"
              key={conversation.id}
              onClick={() => void loadMessages(conversation.id)}
            >
              <div>
                <strong>
                  {conversation.platform} • {conversation.id}
                </strong>
                <div className="account-meta">
                  {conversation.status} • {conversation.message_count} رسائل
                </div>
              </div>
            </button>
          ))}
          {!conversations.length ? (
            <div className="result">لا توجد محادثات محلية.</div>
          ) : null}
        </div>

        <div className="vault-form">
          <label>
            المحادثة المحددة
            <select
              value={messageConversationId}
              onChange={(event) => void loadMessages(event.target.value)}
            >
              <option value="">اختر محادثة</option>
              {conversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>
                  {conversation.id}
                </option>
              ))}
            </select>
          </label>
          <label>
            اتجاه الرسالة
            <select
              value={messageDirection}
              onChange={(event) => setMessageDirection(event.target.value)}
            >
              <option value="inbound">واردة</option>
              <option value="outbound">صادرة</option>
            </select>
          </label>
          <label>
            الرسالة
            <textarea
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              rows={3}
            />
          </label>
          <button
            className="button primary"
            type="button"
            onClick={() => void saveMessage()}
          >
            إضافة رسالة
          </button>
        </div>

        <div className="account-list">
          {messages.slice(-10).map((message) => (
            <div className="account-row" key={message.id}>
              <div>
                <strong>
                  {message.direction === "inbound" ? "واردة" : "صادرة"}
                </strong>
                <div className="account-meta">{message.sent_at}</div>
                <div className="result">{message.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>النسخ الاحتياطي المشفّر</h2>
        <p>
          نسخ SQLite تُشفّر محلياً قبل حفظها في مجلد backups داخل بيانات
          التطبيق.
        </p>
        <div className="actions">
          <button
            className="button primary"
            type="button"
            onClick={() => void createBackup()}
          >
            إنشاء نسخة
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => void loadBackups()}
          >
            تحديث القائمة
          </button>
        </div>
        <label>
          النسخة
          <select
            value={selectedBackup}
            onChange={(event) => setSelectedBackup(event.target.value)}
          >
            <option value="">اختر نسخة</option>
            {backups.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary"
          type="button"
          onClick={() => void restoreBackup()}
          disabled={!selectedBackup}
        >
          استرجاع بعد الفحص
        </button>
        {backupStatus ? <div className="result">{backupStatus}</div> : null}
      </section>

      <section className="card">
        <h2>الحسابات المحلية</h2>
        <p>
          بيانات التعريف تُحفظ في SQLite. أي session blob اختياري يُشفر داخل
          Rust بـ Argon2id + AES-256-GCM.
        </p>
        <form className="vault-form" onSubmit={storeAccount}>
          <label>
            معرف الحساب
            <input
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              placeholder="facebook-main"
            />
          </label>
          <label>
            المنصة
            <select
              value={accountPlatform}
              onChange={(event) => {
                const platform = event.target.value;
                if (isPlatform(platform)) setAccountPlatform(platform);
              }}
            >
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="linkedin">LinkedIn</option>
              <option value="tiktok">TikTok</option>
            </select>
          </label>
          <label>
            اسم العرض
            <input
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
            />
          </label>
          <label>
            اسم المستخدم (اختياري)
            <input
              value={accountUsername}
              onChange={(event) => setAccountUsername(event.target.value)}
            />
          </label>
          <label>
            بيانات جلسة مُصرح بها (اختياري)
            <input
              type="password"
              value={accountSession}
              onChange={(event) => setAccountSession(event.target.value)}
            />
          </label>
          <button className="button primary" type="submit">
            حفظ الحساب محلياً
          </button>
        </form>

        <div className="account-list">
          {accounts.length === 0 ? (
            <div className="result">لا توجد حسابات محفوظة بعد.</div>
          ) : (
            accounts.map((account) => (
              <div className="account-row" key={account.id}>
                <div>
                  <strong>{account.display_name}</strong>
                  <div className="account-meta">
                    {account.platform}{" "}
                    {account.username ? "• @" + account.username : ""} •{" "}
                    {account.status}
                    {account.has_encrypted_session ? " • جلسة مشفرة" : ""}
                  </div>
                </div>
                <button
                  className="button danger"
                  type="button"
                  onClick={() => void deleteAccount(account.id)}
                >
                  حذف
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="card">
        <h2>الترخيص المحلي</h2>
        <p>
          الترخيص يُتحقق منه محلياً بتوقيع Ed25519. لا توجد مفاتيح توقيع خاصة
          داخل التطبيق.
        </p>
        <div className="account-meta">
          الحالة:{" "}
          {license?.valid
            ? "فعال"
            : license?.installed
              ? "غير صالح"
              : "غير مثبت"}
          {license?.plan ? " • " + license.plan : ""}
          {license?.account_limit
            ? " • حد الحسابات " + license.account_limit
            : ""}
        </div>
        {license?.license_id ? (
          <div className="result">
            {license.license_id} • {license.subject ?? "بدون subject"} •{" "}
            {license.reason}
          </div>
        ) : null}
        <label>
          License Token
          <textarea
            value={licenseToken}
            onChange={(event) => setLicenseToken(event.target.value)}
            rows={4}
            placeholder="ألصق token الموقّع هنا"
            spellCheck={false}
          />
        </label>
        <div className="actions">
          <button
            className="button primary"
            type="button"
            onClick={() => void installLicense()}
          >
            تحقق وفعّل محلياً
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => void loadLicense()}
          >
            تحديث الحالة
          </button>
          <button
            className="button danger"
            type="button"
            onClick={() => void removeLicense()}
            disabled={!license?.installed}
          >
            إزالة الترخيص
          </button>
        </div>
        {licenseMessage ? <div className="result">{licenseMessage}</div> : null}
      </section>

      <section className="card">
        <h2>التحليلات التشغيلية</h2>
        <p>الملخص محسوب من حالة المهام المحلية ضمن مساحة العمل الحالية.</p>
        {analyticsSummary ? (
          <div className="grid">
            <div className="card">
              <strong>المحاولات</strong>
              <div className="price">{analyticsSummary.attempted}</div>
            </div>
            <div className="card">
              <strong>نجح</strong>
              <div className="price">{analyticsSummary.succeeded}</div>
            </div>
            <div className="card">
              <strong>فشل</strong>
              <div className="price">{analyticsSummary.failed}</div>
            </div>
            <div className="card">
              <strong>محجوب</strong>
              <div className="price">{analyticsSummary.blocked}</div>
            </div>
            <div className="card">
              <strong>قيد الانتظار</strong>
              <div className="price">{analyticsSummary.pending}</div>
            </div>
            <div className="card">
              <strong>قيد التنفيذ</strong>
              <div className="price">{analyticsSummary.running}</div>
            </div>
          </div>
        ) : (
          <div className="result">لا تتوفر بيانات تحليلات بعد.</div>
        )}
        {analyticsSummary ? (
          <div className="account-meta">
            Completion: {(analyticsSummary.completion_rate * 100).toFixed(1)}% •
            Success: {(analyticsSummary.success_rate * 100).toFixed(1)}% •
            Failure: {(analyticsSummary.failure_rate * 100).toFixed(1)}%
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2>سجل التدقيق</h2>
        <p>أحداث التشغيل المحلية تُحفظ دون أسرار أو قيم الجلسات الحساسة.</p>
        <div className="actions">
          <button
            className="button secondary"
            type="button"
            onClick={() => void loadAudit()}
          >
            تحديث السجل
          </button>
          <button
            className="button primary"
            type="button"
            onClick={() => void verifyAudit()}
          >
            تحقق من سلامة السجل
          </button>
          <span className="account-meta">
            الحالة:{" "}
            {auditIntegrity === "valid"
              ? "سليم"
              : auditIntegrity === "invalid"
                ? "يحتاج مراجعة"
                : "غير متحقق"}
          </span>
        </div>
        <div className="account-list">
          {auditEntries.slice(0, 25).map((entry) => (
            <div className="account-row" key={entry.id}>
              <div>
                <strong>{entry.action}</strong>
                <div className="account-meta">
                  {entry.category} • {entry.outcome} • {entry.actor} •{" "}
                  {entry.timestamp}
                  {entry.entity_id ? " • " + entry.entity_id : ""}
                </div>
              </div>
            </div>
          ))}
          {!auditEntries.length ? (
            <div className="result">لا توجد أحداث تدقيق بعد.</div>
          ) : null}
        </div>
      </section>

      {import.meta.env.DEV ? (
        <form className="card vault-form" onSubmit={storeSecret}>
          <h2>اختبار خزنة محلية حقيقية</h2>
          <p>
            هذا الاختبار يكتب السجل المشفر في قاعدة SQLite المحلية الخاصة
            بالتطبيق.
          </p>
          <label>
            اسم السجل
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label>
            القيمة الحساسة
            <input
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
          </label>
          <label>
            كلمة مرور الخزنة
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <div className="actions">
            <button className="button primary" type="submit">
              تشفير وحفظ
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => void loadSecret()}
            >
              فك وقراءة
            </button>
          </div>
          {stored ? (
            <div className="result">تم حفظ السجل المشفر محلياً.</div>
          ) : null}
          {recovered ? (
            <div className="result">القيمة المستعادة: {recovered}</div>
          ) : null}
        </form>
      ) : null}
    </main>
  );
}
