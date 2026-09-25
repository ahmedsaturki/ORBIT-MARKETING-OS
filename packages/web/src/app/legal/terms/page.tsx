import type { ReactElement } from "react";
import Link from "next/link";

export default function TermsPage(): ReactElement {
  return (
    <main className="container page prose">
      <Link href="/">← الرئيسية</Link>
      <h1>شروط الاستخدام</h1>
      <p>
        يستخدم العميل ORBIT على مسؤولية حساباته ومحتواه وتفويضاته على المنصات
        الخارجية.
      </p>
      <h2>الامتثال</h2>
      <p>
        يجب استخدام التكاملات وفق شروط كل منصة، والالتزام بحدود المعدل والأذونات
        ومتطلبات الموافقة.
      </p>
      <h2>العمليات الخارجية</h2>
      <p>
        قد تتطلب العمليات الحساسة تأكيد المستخدم أو تدخلاً بشرياً عند ظهور
        تحديات المصادقة أو تغيّر الواجهة.
      </p>
    </main>
  );
}
