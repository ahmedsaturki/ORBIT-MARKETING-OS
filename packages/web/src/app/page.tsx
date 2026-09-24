import Link from "next/link";

const features = [
  "امتلاك البيانات التشغيلية على جهازك",
  "تخطيط الحملات وطوابير المهام",
  "CRM وصندوق محادثات موحد",
  "ذكاء اصطناعي محلي عبر Ollama",
  "تأكيدات المستخدم وقواطع السلامة",
  "سطح مكتبي للعمليات الحساسة",
];

export default function HomePage(): JSX.Element {
  return (
    <main data-release="0.2.0">
      <header className="topbar">
        <div className="container nav">
          <strong>ORBIT</strong>
          <nav aria-label="التنقل الرئيسي">
            <Link href="/pricing/">الأسعار</Link>
            <Link href="/legal/privacy/">الخصوصية</Link>
            <Link href="/legal/terms/">الشروط</Link>
          </nav>
        </div>
      </header>

      <section className="hero container">
        <div className="eyebrow">LOCAL-FIRST MARKETING OPERATIONS</div>
        <h1>مركز تشغيل تسويقك، مع ملكية بياناتك على جهازك.</h1>
        <p>
          ORBIT يجمع التخطيط، المحتوى، CRM، صندوق المحادثات، والمهام في مساحة واحدة،
          مع تشغيل محلي للبيانات الحساسة ومساعد AI عبر Ollama.
        </p>
        <div className="actions">
          <Link className="button primary" href="/pricing/">استكشف الخطط</Link>
          <a className="button secondary" href="https://github.com/ahmedsaturki/ORBIT-MARKETING-OS">المستودع</a>
        </div>
      </section>

      <section className="container feature-grid" aria-label="المزايا">
        {features.map((feature) => (
          <article key={feature} className="card">
            <div className="check">✓</div>
            <h2>{feature}</h2>
          </article>
        ))}
      </section>

      <section className="container note">
        <h2>السطح السحابي ليس خزنة جلسات</h2>
        <p>
          Web مخصص للتعريف والشراء والوصول السريع. كلمات المرور، الكوكيز،
          وبيانات الجلسات الحساسة لا تُخزن في الموقع العام.
        </p>
      </section>

      <footer className="container footer">ORBIT Marketing OS • v0.2.0 • Local-first</footer>
    </main>
  );
}
