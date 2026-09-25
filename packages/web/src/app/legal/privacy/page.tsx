import type { ReactElement } from "react";
import Link from "next/link";

export default function PrivacyPage(): ReactElement {
  return (
    <main className="container page prose">
      <Link href="/">← الرئيسية</Link>
      <h1>سياسة الخصوصية</h1>
      <p>ORBIT مصمم ليحتفظ بالبيانات التشغيلية الحساسة على جهاز المستخدم قدر الإمكان.</p>
      <h2>ما الذي يُخزّن محلياً؟</h2>
      <p>بيانات الحسابات المتصلة، المهام، الحملات، سجلات التدقيق، وبيانات CRM الخاصة بالعميل في runtime المحلي.</p>
      <h2>الذكاء الاصطناعي</h2>
      <p>المسار الافتراضي يستخدم Ollama محلياً. أي تكامل خارجي اختياري يجب أن يكون ظاهراً للمستخدم ومفصولاً عن أسرار الجلسات.</p>
      <h2>الأسرار</h2>
      <p>لا ينبغي وضع كلمات المرور أو الجلسات أو مفاتيح API في صفحات الويب أو مستودع الكود.</p>
    </main>
  );
}
