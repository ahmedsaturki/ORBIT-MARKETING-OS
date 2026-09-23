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
      await loadAccounts();
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
