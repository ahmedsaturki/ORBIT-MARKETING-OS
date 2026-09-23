import React, { useState } from 'react';
import { 
  Database, Server, Laptop, ShieldCheck, Download, 
  Upload, Check, Copy, Code, DollarSign, Layers, Cpu
} from 'lucide-react';
import { safeGetStorage, safeCopy } from '../utils/storage';

export default function LocalArchitecture() {
  const [activeSubTab, setActiveSubTab] = useState<'pricing' | 'schema' | 'rules' | 'backup'>('pricing');
  const [copiedSql, setCopiedSql] = useState(false);
  const [licenseType, setLicenseType] = useState<'one-time' | 'subscription'>('subscription');

  const sqliteSchemaCode = `-- Orbit Marketing OS - Local SQLite Database Schema
CREATE TABLE social_accounts (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL, -- facebook, whatsapp, telegram, instagram, linkedin
    account_name TEXT NOT NULL,
    username TEXT,
    session_data TEXT, -- AES-256 encrypted local cookies
    proxy_config TEXT, -- { host, port, user, pass }
    status TEXT DEFAULT 'active',
    health_score INTEGER DEFAULT 100,
    warm_up_level INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    target TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    content TEXT NOT NULL,
    delay_min INTEGER DEFAULT 4,
    delay_max INTEGER DEFAULT 9,
    scheduled_at TIMESTAMP,
    successful_actions INTEGER DEFAULT 0,
    total_actions INTEGER DEFAULT 0
);

CREATE TABLE contacts (
    id TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT,
    platform TEXT,
    status TEXT DEFAULT 'new', -- new, interested, offer_sent, won, lost
    last_message TEXT,
    notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

  const dynamicRulesCode = `{
  "platform": "facebook",
  "version": "2.4.1",
  "selectors": {
    "composer_button": "[aria-label='Create a post'], [data-pagelet='composer']",
    "text_area": "[contenteditable='true'][role='textbox']",
    "submit_button": "[aria-label='Post'], [data-testid='react-composer-post-button']"
  },
  "safety": {
    "min_delay_ms": 3500,
    "max_delay_ms": 11000,
    "circuit_breaker_errors": 3,
    "bezier_mouse_curve": true
  }
}`;

  const copySql = async () => {
    await safeCopy(sqliteSchemaCode);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleExportBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      accounts: safeGetStorage('orbit_accounts', []),
      campaigns: safeGetStorage('orbit_campaigns', []),
      leads: safeGetStorage('orbit_leads', []),
      chatHistory: safeGetStorage('orbit_chat_history', []),
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orbit_marketing_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              هندسة البنية التحتية المحلية (Local-First Engineering)
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white">الهندسة المعمارية، قواعد البيانات، والترخيص التجاري</h2>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            نظام تشغيل محلي بدون الاعتماد على سيرفرات خارجية مركزية لحفظ الجلسات، مع دعم التصدير والنسخ الاحتياطي ومختلف نماذج البيع والتسعير.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportBackup}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyan-600/20"
          >
            <Download className="w-4 h-4" />
            <span>تصدير نسخة احتياطية (JSON)</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('pricing')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'pricing'
              ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>خطط التسعير ونماذج البيع (Commercial Models)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('schema')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'schema'
              ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>مخطط SQLite المحلي (Database Schema)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('rules')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'rules'
              ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Code className="w-4 h-4" />
          <span>محرك القواعد الديناميكية (Rules Engine)</span>
        </button>
      </div>

      {/* Sub Tab Contents */}
      {activeSubTab === 'pricing' && (
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 inline-flex text-xs">
              <button
                onClick={() => setLicenseType('subscription')}
                className={`px-4 py-1.5 rounded-lg font-bold transition-all ${
                  licenseType === 'subscription' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                الاشتراكات المرنة (SaaS Subscription)
              </button>
              <button
                onClick={() => setLicenseType('one-time')}
                className={`px-4 py-1.5 rounded-lg font-bold transition-all ${
                  licenseType === 'one-time' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                الدفع لمرة واحدة (One-Time Purchase)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Starter */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white text-lg">باقة المبتدئ (Starter)</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">Individual</span>
                </div>
                <div className="text-3xl font-extrabold text-white mb-4">
                  {licenseType === 'subscription' ? '$19' : '$99'}
                  <span className="text-xs font-normal text-slate-400">
                    {licenseType === 'subscription' ? ' / شهرياً' : ' (شراء لمرة واحدة)'}
                  </span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">✓ وكيل محلي واحد (1 Local Agent)</li>
                  <li className="flex items-center gap-2">✓ حتى 5 حسابات اجتماعية</li>
                  <li className="flex items-center gap-2">✓ أتمتة وجدولة المنشورات</li>
                  <li className="flex items-center gap-2">✓ الذكاء الاصطناعي الأساسي</li>
                  <li className="flex items-center gap-2">✓ تشفير محلي للجلسات</li>
                </ul>
              </div>
              <button className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-xl font-bold text-xs transition-all border border-slate-700">
                اختيار باقة المبتدئ
              </button>
            </div>

            {/* Card 2: Pro (Featured) */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-cyan-500/50 rounded-2xl p-6 shadow-2xl relative flex flex-col justify-between">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
                الأكثر طلباً للمسوقين
              </span>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white text-lg">باقة المحترف (Pro)</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">Power Marketer</span>
                </div>
                <div className="text-3xl font-extrabold text-cyan-400 mb-4">
                  {licenseType === 'subscription' ? '$39' : '$199'}
                  <span className="text-xs font-normal text-slate-400">
                    {licenseType === 'subscription' ? ' / شهرياً' : ' (شراء لمرة واحدة)'}
                  </span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-200">
                  <li className="flex items-center gap-2">✓ وكيلان محليان (2 Local Agents)</li>
                  <li className="flex items-center gap-2">✓ حتى 15 حساباً اجتماعياً</li>
                  <li className="flex items-center gap-2">✓ استوديو المحتوى والرؤية عبر مزود AI محلي قابل للتهيئة</li>
                  <li className="flex items-center gap-2">✓ قاطع دائرة وحدود تشغيل وموافقة مستخدم</li>
                  <li className="flex items-center gap-2">✓ CRM المحادثات الموحد مع مقترحات الذكاء الاصطناعي</li>
                  <li className="flex items-center gap-2">✓ تحديثات القواعد التلقائية</li>
                </ul>
              </div>
              <button className="w-full mt-6 bg-cyan-600 hover:bg-cyan-500 text-white py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-cyan-600/20">
                اختيار باقة المحترف
              </button>
            </div>

            {/* Card 3: Agency */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white text-lg">باقة الوكالات (Agency)</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">White Label</span>
                </div>
                <div className="text-3xl font-extrabold text-white mb-4">
                  {licenseType === 'subscription' ? '$99' : '$499'}
                  <span className="text-xs font-normal text-slate-400">
                    {licenseType === 'subscription' ? ' / شهرياً' : ' (شراء لمرة واحدة)'}
                  </span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">✓ حسابات ووكلاء محليين غير محدودة</li>
                  <li className="flex items-center gap-2">✓ ميزة White Label وهوية الوكالة للتقارير</li>
                  <li className="flex items-center gap-2">✓ مزامنة فرق العمل (Team P2P Sync)</li>
                  <li className="flex items-center gap-2">✓ عزل كامل لبيانات كل عميل (Workspace Isolation)</li>
                  <li className="flex items-center gap-2">✓ دعم فني ذو أولوية عبر Discord/Telegram</li>
                </ul>
              </div>
              <button className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-xl font-bold text-xs transition-all border border-slate-700">
                اختيار باقة الوكالة
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'schema' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">مخطط قاعدة بيانات SQLite المدمجة</h3>
              <p className="text-xs text-slate-400">تُخزن جميع البيانات محلياً على جهاز المستخدم دون نقل ملفات تعريف الارتباط</p>
            </div>
            <button
              onClick={copySql}
              className="text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? 'تم النسخ' : 'نسخ كود SQL'}</span>
            </button>
          </div>
          <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 text-emerald-400 text-xs font-mono overflow-x-auto leading-relaxed">
            {sqliteSchemaCode}
          </pre>
        </div>
      )}

      {activeSubTab === 'rules' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">محرك القواعد الديناميكية القابلة للتحديث السريع (Rules Engine)</h3>
              <p className="text-xs text-slate-400">
                إذا غير فيسبوك أو واتساب محددات الأزرار (Selectors)، يتم تحديث ملف القواعد فورياً دون الحاجة لإعادة تنصيب البرنامج
              </p>
            </div>
          </div>
          <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 text-cyan-300 text-xs font-mono overflow-x-auto leading-relaxed">
            {dynamicRulesCode}
          </pre>
        </div>
      )}
    </div>
  );
}
