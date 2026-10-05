import type { ReactElement } from "react";
import Link from "next/link";
import { releaseSha, SiteFooter, SiteHeader } from "../components/site-chrome";

const features = [
  "امتلاك البيانات التشغيلية على جهازك",
  "تخطيط الحملات وطوابير المهام",
  "CRM وصندوق محادثات موحد",
  "ذكاء اصطناعي محلي عبر Ollama",
  "تأكيدات المستخدم وقواطع السلامة",
  "سطح مكتبي للعمليات الحساسة",
];

export default function HomePage(): ReactElement {
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        tabIndex={-1}
        data-release="1.0.0"
        data-release-sha={releaseSha}
      >
        <section className="hero container">
          <div className="eyebrow">LOCAL-FIRST MARKETING OPERATIONS</div>
          <h1>مركز تشغيل تسويقك، مع ملكية بياناتك على جهازك.</h1>
          <p>
            ORBIT يجمع التخطيط، المحتوى، CRM، صندوق المحادثات، والمهام في مساحة
            واحدة، مع تشغيل محلي للبيانات الحساسة ومساعد AI عبر Ollama.
          </p>
          <div className="actions">
            <Link className="button primary" href="/pricing/">
              استكشف الخطط
            </Link>
            <a
              className="button secondary"
              href="https://github.com/ahmedsaturki/ORBIT-MARKETING-OS"
            >
              المستودع
            </a>
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
      </main>
      <SiteFooter />
    </>
  );
}
