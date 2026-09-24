import { useEffect, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle2, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";

interface Health {
  readonly status: string;
  readonly database: string;
}

interface VaultResult {
  readonly label: string;
  readonly payloadVersion: number;
}

interface AccountView {
  readonly id: string;
  readonly platform: string;
  readonly display_name: string;
  readonly username?: string;
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

interface ContactView {
  readonly id: string;
  readonly display_name: string;
  readonly phone?: string;
  readonly email?: string;
  readonly source_platform?: string;
  readonly status: string;
  readonly notes?: string;
  readonly updated_at: string;
}

interface ConversationView {
  readonly id: string;
  readonly contact_id?: string;
  readonly platform: string;
  readonly external_thread_id?: string;
  readonly status: string;
  readonly message_count: number;
  readonly updated_at: string;
}

interface TaskView {
  readonly id: string;
  readonly campaign_id: string;
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

interface AuditView {
  readonly id: string;
  readonly timestamp: string;
  readonly category: string;
  readonly action: string;
  readonly outcome: string;
  readonly actor: string;
  readonly entity_id?: string;
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

async function callNative<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(command, args);
}

export function App(): ReactElement {
  const [health, setHealth] = useState<Health | null>(null);
  const [label, setLabel] = useState("demo");
  const [secret, setSecret] = useState("");
  const [password, setPassword] = useState("");
  const [stored, setStored] = useState(false);
  const [recovered, setRecovered] = useState("");
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<readonly AccountView[]>([]);
  const [accountId, setAccountId] = useState("");
  const [accountPlatform, setAccountPlatform] = useState("facebook");
  const [accountName, setAccountName] = useState("");
  const [accountUsername, setAccountUsername] = useState("");
  const [accountSession, setAccountSession] = useState("");
  const [backups, setBackups] = useState<readonly string[]>([]);
  const [selectedBackup, setSelectedBackup] = useState("");
  const [backupStatus, setBackupStatus] = useState("");
  const [campaigns, setCampaigns] = useState<readonly CampaignView[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [campaignAccountId, setCampaignAccountId] = useState("");
  const [tasks, setTasks] = useState<readonly TaskView[]>([]);
  const [taskCampaignId, setTaskCampaignId] = useState("");
  const [taskAccountId, setTaskAccountId] = useState("");
  const [taskKind, setTaskKind] = useState("publish");
  const [taskId, setTaskId] = useState("");
  const [taskIdempotencyKey, setTaskIdempotencyKey] = useState("");
  const [contacts, setContacts] = useState<readonly ContactView[]>([]);
  const [conversations, setConversations] = useState<readonly ConversationView[]>([]);
  const [conversationId, setConversationId] = useState("");
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
  const [auditIntegrity, setAuditIntegrity] = useState<"unknown" | "valid" | "invalid">("unknown");

  const loadCampaigns = async (): Promise<void> => {
    try {
      setCampaigns(await callNative<CampaignView[]>("campaign_list"));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل تحميل الحملات");
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

    const selectedAccount = accounts.find((account) => account.id === taskAccountId);
    if (!selectedAccount) {
      setError("الحساب المحدد غير موجود في مساحة العمل الحالية");
      return;
    }

    try {
      setError("");
      await callNative<TaskView>("task_enqueue", {
        id: taskId.trim() || "task-" + Date.now(),
        campaign_id: taskCampaignId,
        account_id: taskAccountId,
        platform: selectedAccount.platform,
        kind: taskKind,
        priority: 10,
        available_at: new Date().toISOString(),
        max_attempts: 3,
        idempotency_key: taskIdempotencyKey.trim() || null,
      });
      setTaskId("");
      setTaskIdempotencyKey("");
      await loadTasks();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل إضافة المهمة");
    }
  };

  const claimNextTask = async (): Promise<void> => {
    try {
      setError("");
      await callNative<TaskView | null>("task_claim_next", { now: new Date().toISOString() });
      await loadTasks();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل سحب المهمة التالية");
    }
  };

  const loadAudit = async (): Promise<void> => {
    try {
      setAuditEntries(await callNative<AuditView[]>("audit_list", { limit: 25 }));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل تحميل سجل التدقيق");
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
      setError(caught instanceof Error ? caught.message : "فشل التحقق من سلامة سجل التدقيق");
    }
  };

  const loadInbox = async (): Promise<void> => {
    try {
      const items = await callNative<ConversationView[]>("inbox_list");
      setConversations(items);
      setMessageConversationId((current) => current || items[0]?.id || "");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل تحميل صندوق المحادثات");
    }
  };

  const saveConversation = async (): Promise<void> => {
    if (!conversationId.trim()) {
      setError("أدخل معرف المحادثة");
      return;
    }
    try {
      setError("");
      await callNative<ConversationView>("conversation_upsert", {
        id: conversationId.trim(),
        contact_id: contactId.trim() || null,
        platform: conversationPlatform,
        external_thread_id: externalThreadId.trim() || null,
        status: conversationStatus,
      });
      setConversationId("");
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
        conversation_id: messageConversationId,
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
      setMessages(await callNative<MessageView[]>("message_list", { conversation_id: id }));
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

  const createCampaign = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!campaignName.trim() || !campaignAccountId) {
      setError("أدخل اسم الحملة واختر حساباً مستهدفاً");
      return;
    }
    try {
      setError("");
      await callNative<CampaignView>("campaign_create", {
        name: campaignName.trim(),
        account_ids: [campaignAccountId],
      });
      setCampaignName("");
      await loadCampaigns();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل إنشاء الحملة");
    }
  };

  const saveContact = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!contactId.trim() || !contactName.trim()) {
      setError("أدخل معرف العميل والاسم");
      return;
    }
    try {
      setError("");
      const result = await callNative<ContactView>("contact_upsert", {
        id: contactId.trim(),
        display_name: contactName.trim(),
        phone: contactPhone.trim() || null,
        email: contactEmail.trim() || null,
        source_platform: null,
        status: contactStatus,
        notes: contactNotes.trim() || null,
      });
      setContacts((current) => [result, ...current.filter((item) => item.id !== result.id)]);
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
      setBackupStatus(caught instanceof Error ? caught.message : "فشل تحميل النسخ المحلية");
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
      setBackupStatus(caught instanceof Error ? caught.message : "فشل إنشاء النسخة المشفرة");
    }
  };

  const restoreBackup = async (): Promise<void> => {
    if (!selectedBackup || !password) {
      setBackupStatus("اختر نسخة وأدخل كلمة المرور.");
      return;
    }
    try {
      setBackupStatus("جاري فحص النسخة والاسترجاع...");
      await callNative<boolean>("backup_restore", { filename: selectedBackup, password });
      setBackupStatus("تم استرجاع النسخة بعد اجتياز integrity check.");
      await checkHealth();
    } catch (caught: unknown) {
      setBackupStatus(caught instanceof Error ? caught.message : "فشل استرجاع النسخة");
    }
  };

  const loadAccounts = async (): Promise<void> {
    try {
      setError("");
      setAccounts(await callNative<AccountView[]>("account_list"));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل تحميل الحسابات المحلية");
    }
  };

  const checkHealth = async (): Promise<void> => {
    try {
      setError("");
      setHealth(await callNative<Health>("app_health"));
      await loadAccounts();
      await loadCampaigns();
      await loadTasks();
      await loadContacts();
      await loadInbox();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل فحص التطبيق المحلي");
    }
  };

  const storeAccount = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accountId.trim() || !accountName.trim()) {
      setError("أدخل معرف الحساب واسم الحساب");
      return;
    }
    try {
      setError("");
      const result = await callNative<AccountView>("account_upsert", {
        id: accountId.trim(),
        platform: accountPlatform,
        display_name: accountName.trim(),
        username: accountUsername.trim() || null,
        session: accountSession || null,
        password: accountSession ? password : null,
      });
      setAccounts((current) => [result, ...current.filter((item) => item.id !== result.id)]);
      setAccountSession("");
      setAccountId("");
      setAccountName("");
      setAccountUsername("");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حفظ الحساب المحلي");
    }
  };

  const deleteAccount = async (id: string): Promise<void> => {
    try {
      setError("");
      const deleted = await callNative<boolean>("account_delete", { id });
      if (deleted) setAccounts((current) => current.filter((item) => item.id !== id));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حذف الحساب");
    }
  };

  const storeSecret = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
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
      setStored(result.payloadVersion === 1);
      setSecret("");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل حفظ السجل المشفر");
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
      setError(caught instanceof Error ? caught.message : "فشل فك السجل المشفر");
    }
  };

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <div className="eyebrow">LOCAL-FIRST • TAURI V2</div>
          <h1>ORBIT Marketing OS</h1>
          <p>سطح تشغيل محلي لإدارة البيانات الحساسة، الحملات، والاتصالات المصرح بها.</p>
        </div>
        <button className="button secondary" type="button" onClick={() => void checkHealth()}>
          فحص التشغيل المحلي
        </button>
      </header>

      {error ? <div className="notice error">{error}</div> : null}
      {health ? (
        <div className="notice success">
          <CheckCircle2 size={18} />
          <span>الخدمة: {health.status} • قاعدة البيانات: {health.database}</span>
        </div>
      ) : null}

      <section className="grid">
        <article className="card">
          <div className="icon"><ShieldCheck size={22} /></div>
          <h2>الخزنة المحلية</h2>
          <p>البيانات الحساسة تُشفّر داخل Rust باستخدام Argon2id + AES-256-GCM قبل التخزين.</p>
        </article>
        <article className="card">
          <div className="icon"><LockKeyhole size={22} /></div>
          <h2>لا أسرار في السجل</h2>
          <p>الأوامر المحلية لا تكتب كلمات المرور أو الجلسات أو المفاتيح في سجل التطبيق.</p>
        </article>
        <article className="card">
          <div className="icon"><KeyRound size={22} /></div>
          <h2>تحكم صريح</h2>
          <p>عمليات التكامل الخارجية تُفصل عن التخزين المحلي وتحتاج إلى تفويض المستخدم.</p>
        </article>
      </section>




      <section className="grid workspace-grid">
        <div className="card">
          <h2>الحملات</h2>
          <p>الحملة تُحفظ محلياً وتُربط بالحسابات المستهدفة داخل SQLite.</p>
          <form className="vault-form" onSubmit={createCampaign}>
            <label>
              اسم الحملة
              <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="حملة سبتمبر" />
            </label>
            <label>
              الحساب المستهدف
              <select value={campaignAccountId} onChange={(event) => setCampaignAccountId(event.target.value)}>
                <option value="">اختر حساباً</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.display_name} • {account.platform}</option>
                ))}
              </select>
            </label>
            <button className="button primary" type="submit" disabled={!accounts.length}>إنشاء حملة</button>
          </form>
          <div className="account-list">
            {campaigns.slice(0, 8).map((campaign) => (
              <div className="account-row" key={campaign.id}>
                <div>
                  <strong>{campaign.name}</strong>
                  <div className="account-meta">{campaign.status} • {campaign.task_count} مهام</div>
                </div>
              </div>
            ))}
            {!campaigns.length ? <div className="result">لا توجد حملات محفوظة.</div> : null}
          </div>
        </div>

        <div className="card">
          <h2>المهام</h2>
          <p>Queue native: pending / running / succeeded / failed / blocked / cancelled.</p>
          <div className="vault-form">
            <label>
              الحملة
              <select value={taskCampaignId} onChange={(event) => setTaskCampaignId(event.target.value)}>
                <option value="">اختر حملة</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name} • {campaign.status}</option>
                ))}
              </select>
            </label>
            <label>
              الحساب
              <select value={taskAccountId} onChange={(event) => setTaskAccountId(event.target.value)}>
                <option value="">اختر حساباً</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.display_name} • {account.platform}</option>
                ))}
              </select>
            </label>
            <label>
              نوع المهمة
              <select value={taskKind} onChange={(event) => setTaskKind(event.target.value)}>
                <option value="publish">نشر</option>
                <option value="message">رسالة</option>
                <option value="comment">تعليق</option>
                <option value="sync">مزامنة</option>
                <option value="engage">تفاعل</option>
              </select>
            </label>
            <label>
              معرف المهمة (اختياري)
              <input value={taskId} onChange={(event) => setTaskId(event.target.value)} placeholder="task-001" />
            </label>
            <label>
              Idempotency Key (اختياري)
              <input value={taskIdempotencyKey} onChange={(event) => setTaskIdempotencyKey(event.target.value)} />
            </label>
            <div className="actions">
              <button className="button primary" type="button" onClick={() => void enqueueTask()}>إضافة للمحلية</button>
              <button className="button secondary" type="button" onClick={() => void claimNextTask()}>سحب التالية</button>
              <button className="button secondary" type="button" onClick={() => void loadTasks()}>تحديث</button>
            </div>
          </div>
          <div className="account-list">
            {tasks.slice(0, 10).map((task) => (
              <div className="account-row" key={task.id}>
                <div>
                  <strong>{task.kind} • {task.platform}</strong>
                  <div className="account-meta">{task.status} • {task.attempts}/{task.max_attempts} • أولوية {task.priority} • {task.idempotency_key}</div>
                </div>
              </div>
            ))}
            {!tasks.length ? <div className="result">لا توجد مهام محفوظة.</div> : null}
          </div>
        </div>

        <div className="card">
          <h2>CRM المحلي</h2>
          <p>سجلات العملاء تُحفظ محلياً مع الحالة والملاحظات.</p>
          <form className="vault-form" onSubmit={saveContact}>
            <label>
              معرف العميل
              <input value={contactId} onChange={(event) => setContactId(event.target.value)} placeholder="lead-001" />
            </label>
            <label>
              الاسم
              <input value={contactName} onChange={(event) => setContactName(event.target.value)} />
            </label>
            <label>
              الهاتف
              <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
            </label>
            <label>
              البريد الإلكتروني
              <input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} type="email" />
            </label>
            <label>
              الحالة
              <select value={contactStatus} onChange={(event) => setContactStatus(event.target.value)}>
                <option value="new">جديد</option>
                <option value="interested">مهتم</option>
                <option value="sold">تم البيع</option>
                <option value="lost">خسرنا العميل</option>
              </select>
            </label>
            <label>
              ملاحظات
              <textarea value={contactNotes} onChange={(event) => setContactNotes(event.target.value)} rows={3} />
            </label>
            <button className="button primary" type="submit">حفظ العميل</button>
          </form>
          <div className="account-list">
            {contacts.slice(0, 8).map((contact) => (
              <div className="account-row" key={contact.id}>
                <div>
                  <strong>{contact.display_name}</strong>
                  <div className="account-meta">{contact.status} {contact.phone ? "• " + contact.phone : ""}</div>
                </div>
              </div>
            ))}
            {!contacts.length ? <div className="result">لا توجد جهات اتصال.</div> : null}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Inbox محلي</h2>
        <p>المحادثات والرسائل تُحفظ محلياً، ويُرفض أي ربط خارج مساحة العمل الحالية.</p>
        <div className="vault-form">
          <label>
            معرف المحادثة
            <input value={conversationId} onChange={(event) => setConversationId(event.target.value)} placeholder="thread-001" />
          </label>
          <label>
            العميل المرتبط (اختياري)
            <select value={contactId} onChange={(event) => setContactId(event.target.value)}>
              <option value="">بدون ربط</option>
              {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.display_name}</option>)}
            </select>
          </label>
          <label>
            المنصة
            <select value={conversationPlatform} onChange={(event) => setConversationPlatform(event.target.value)}>
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
            <input value={externalThreadId} onChange={(event) => setExternalThreadId(event.target.value)} />
          </label>
          <label>
            الحالة
            <select value={conversationStatus} onChange={(event) => setConversationStatus(event.target.value)}>
              <option value="new">جديدة</option>
              <option value="interested">مهتم</option>
              <option value="potential_customer">عميل محتمل</option>
              <option value="complaint">شكوى</option>
              <option value="closed">مغلقة</option>
            </select>
          </label>
          <button className="button primary" type="button" onClick={() => void saveConversation()}>حفظ المحادثة</button>
        </div>

        <div className="account-list">
          {conversations.slice(0, 10).map((conversation) => (
            <button className="account-row" type="button" key={conversation.id} onClick={() => void loadMessages(conversation.id)}>
              <div>
                <strong>{conversation.platform} • {conversation.id}</strong>
                <div className="account-meta">{conversation.status} • {conversation.message_count} رسائل</div>
              </div>
            </button>
          ))}
          {!conversations.length ? <div className="result">لا توجد محادثات محلية.</div> : null}
        </div>

        <div className="vault-form">
          <label>
            المحادثة المحددة
            <select value={messageConversationId} onChange={(event) => void loadMessages(event.target.value)}>
              <option value="">اختر محادثة</option>
              {conversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.id}</option>)}
            </select>
          </label>
          <label>
            اتجاه الرسالة
            <select value={messageDirection} onChange={(event) => setMessageDirection(event.target.value)}>
              <option value="inbound">واردة</option>
              <option value="outbound">صادرة</option>
            </select>
          </label>
          <label>
            الرسالة
            <textarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} rows={3} />
          </label>
          <button className="button primary" type="button" onClick={() => void saveMessage()}>إضافة رسالة</button>
        </div>

        <div className="account-list">
          {messages.slice(-10).map((message) => (
            <div className="account-row" key={message.id}>
              <div>
                <strong>{message.direction === "inbound" ? "واردة" : "صادرة"}</strong>
                <div className="account-meta">{message.sent_at}</div>
                <div className="result">{message.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>النسخ الاحتياطي المشفّر</h2>
        <p>نسخ SQLite تُشفّر محلياً قبل حفظها في مجلد backups داخل بيانات التطبيق.</p>
        <div className="actions">
          <button className="button primary" type="button" onClick={() => void createBackup()}>إنشاء نسخة</button>
          <button className="button secondary" type="button" onClick={() => void loadBackups()}>تحديث القائمة</button>
        </div>
        <label>
          النسخة
          <select value={selectedBackup} onChange={(event) => setSelectedBackup(event.target.value)}>
            <option value="">اختر نسخة</option>
            {backups.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button className="button secondary" type="button" onClick={() => void restoreBackup()} disabled={!selectedBackup}>
          استرجاع بعد الفحص
        </button>
        {backupStatus ? <div className="result">{backupStatus}</div> : null}
      </section>

      <section className="card">
        <h2>الحسابات المحلية</h2>
        <p>بيانات التعريف تُحفظ في SQLite. أي session blob اختياري يُشفر داخل Rust بـ Argon2id + AES-256-GCM.</p>
        <form className="vault-form" onSubmit={storeAccount}>
          <label>
            معرف الحساب
            <input value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="facebook-main" />
          </label>
          <label>
            المنصة
            <select value={accountPlatform} onChange={(event) => setAccountPlatform(event.target.value)}>
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
            <input value={accountName} onChange={(event) => setAccountName(event.target.value)} />
          </label>
          <label>
            اسم المستخدم (اختياري)
            <input value={accountUsername} onChange={(event) => setAccountUsername(event.target.value)} />
          </label>
          <label>
            بيانات جلسة مُصرح بها (اختياري)
            <input type="password" value={accountSession} onChange={(event) => setAccountSession(event.target.value)} />
          </label>
          <button className="button primary" type="submit">حفظ الحساب محلياً</button>
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
                    {account.platform} {account.username ? "• @" + account.username : ""} • {account.status}
                    {account.has_encrypted_session ? " • جلسة مشفرة" : ""}
                  </div>
                </div>
                <button className="button danger" type="button" onClick={() => void deleteAccount(account.id)}>
                  حذف
                </button>
              </div>
            ))
          )}
        </div>
      </section>


      <section className="card">
        <h2>سجل التدقيق</h2>
        <p>أحداث التشغيل المحلية تُحفظ دون أسرار أو قيم الجلسات الحساسة.</p>
        <div className="actions">
          <button className="button secondary" type="button" onClick={() => void loadAudit()}>تحديث السجل</button>
          <button className="button primary" type="button" onClick={() => void verifyAudit()}>تحقق من سلامة السجل</button>
          <span className="account-meta">
            الحالة: {auditIntegrity === "valid" ? "سليم" : auditIntegrity === "invalid" ? "يحتاج مراجعة" : "غير متحقق"}
          </span>
        </div>
        <div className="account-list">
          {auditEntries.slice(0, 25).map((entry) => (
            <div className="account-row" key={entry.id}>
              <div>
                <strong>{entry.action}</strong>
                <div className="account-meta">
                  {entry.category} • {entry.outcome} • {entry.actor} • {entry.timestamp}
                  {entry.entity_id ? " • " + entry.entity_id : ""}
                </div>
              </div>
            </div>
          ))}
          {!auditEntries.length ? <div className="result">لا توجد أحداث تدقيق بعد.</div> : null}
        </div>
      </section>

      <form className="card vault-form" onSubmit={storeSecret}>
        <h2>اختبار خزنة محلية حقيقية</h2>
        <p>هذا الاختبار يكتب السجل المشفر في قاعدة SQLite المحلية الخاصة بالتطبيق.</p>
        <label>
          اسم السجل
          <input value={label} onChange={(event) => setLabel(event.target.value)} />
        </label>
        <label>
          القيمة الحساسة
          <input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} />
        </label>
        <label>
          كلمة مرور الخزنة
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <div className="actions">
          <button className="button primary" type="submit">تشفير وحفظ</button>
          <button className="button secondary" type="button" onClick={() => void loadSecret()}>فك وقراءة</button>
        </div>
        {stored ? <div className="result">تم حفظ السجل المشفر محلياً.</div> : null}
        {recovered ? <div className="result">القيمة المستعادة: {recovered}</div> : null}
      </form>
    </main>
  );
}
