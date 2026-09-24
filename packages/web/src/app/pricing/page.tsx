import Link from "next/link";

const plans = [
  { name: "Basic", price: "$19/mo", accounts: "5 حسابات", details: "تخطيط الحملات، CRM، صندوق محادثات محلي، وAI محلي" },
  { name: "Pro", price: "$39/mo", accounts: "15 حساباً", details: "كل الأساسيات مع قواعد تشغيل وتحليلات موسعة" },
  { name: "Agency", price: "$99/mo", accounts: "غير محدود", details: "خطة مخصصة للفرق؛ التفعيل التجاري الكامل قيد الإكمال" },
  { name: "Lifetime", price: "$399", accounts: "15 حساباً", details: "وصول طويل الأمد إلى الميزات الأساسية الحالية" },
];

function checkoutUrl(planName: string): string {
  const key = "NEXT_PUBLIC_CHECKOUT_" + planName.toUpperCase();
  return process.env[key] ?? "#";
}

export default function PricingPage(): JSX.Element {
  return (
    <main className="container page">
      <Link href="/">← الرئيسية</Link>
      <p><Link href="/legal/refunds/">سياسة الاسترداد</Link></p>
      <h1>الخطط والأسعار</h1>
      <p className="muted">الأسعار الحالية هي إعدادات إطلاق قابلة للمراجعة؛ الشراء الفعلي لا يتفعل قبل ربط مزود الدفع والتحقق من الخطة.</p>

      <section className="pricing-grid">
        {plans.map((plan) => {
          const url = checkoutUrl(plan.name);
          const configured = url !== "#";
          return (
            <article className="card price-card" key={plan.name}>
              <h2>{plan.name}</h2>
              <div className="price">{plan.price}</div>
              <strong>{plan.accounts}</strong>
              <p>{plan.details}</p>
              {configured ? (
                <a className="button primary" href={url}>الشراء</a>
              ) : (
                <span className="button secondary disabled" aria-disabled="true">
                  رابط الشراء غير مضبوط
                </span>
              )}
            </article>
          );
        })}
      </section>

      <div className="note">
        تفعيل الدفع الفعلي يحتاج مزود دفع وحساباً تجارياً قبل الإنتاج. لا توجد أسرار دفع داخل المستودع.
      </div>
    </main>
  );
}
