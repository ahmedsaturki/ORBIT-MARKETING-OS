import { useState } from "react";
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

  const checkHealth = async (): Promise<void> => {
    try {
      setError("");
      setHealth(await callNative<Health>("app_health"));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "فشل فحص التطبيق المحلي");
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
