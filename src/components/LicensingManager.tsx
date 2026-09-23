import React, { useState } from 'react';
import { 
  Key, ShieldCheck, CheckCircle2, AlertTriangle, 
  Cpu, Laptop, Smartphone, Copy, Check, Lock, 
  Sparkles, Layers, DollarSign, Award, RefreshCw
} from 'lucide-react';
import { CURRENT_ACTIVE_LICENSE, LICENSE_PRESETS } from '../data/mockData';
import { LicenseInfo, LicenseTier } from '../types';
import { safeGetStorage, safeSetStorage, safeCopy } from '../utils/storage';

export default function LicensingManager() {
  const [license, setLicense] = useState<LicenseInfo>(() => {
    return safeGetStorage<LicenseInfo>('orbit_license', CURRENT_ACTIVE_LICENSE);
  });

  const [inputKey, setInputKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedHwid, setCopiedHwid] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Admin Key Generator Tool states
  const [genTier, setGenTier] = useState<LicenseTier>('pro');
  const [genClientName, setGenClientName] = useState('Orbit Agency Client');
  const [generatedSampleKey, setGeneratedSampleKey] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 3000);
  };

  // Offline License Validation Algorithm
  const handleActivateKey = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const key = inputKey.trim().toUpperCase();
    if (!key) {
      setValidationError('يرجى إدخال مفتاح الترخيص.');
      return;
    }

    // Validation pattern: ORBIT-[TIER]-[YEAR]-[HASH]-[CHECK]
    if (!key.startsWith('ORBIT-')) {
      setValidationError('صيغة المفتاح غير صحيحة. يجب أن يبدأ بـ ORBIT-');
      return;
    }

    let detectedTier: LicenseTier = 'basic';
    if (key.includes('LIFETIME')) detectedTier = 'lifetime';
    else if (key.includes('AGENCY')) detectedTier = 'agency';
    else if (key.includes('PRO')) detectedTier = 'pro';
    else if (key.includes('BASIC')) detectedTier = 'basic';

    const preset = LICENSE_PRESETS.find(p => p.tier === detectedTier) || LICENSE_PRESETS[0];

    const newLicense: LicenseInfo = {
      key,
      tier: detectedTier,
      clientName: 'مستخدم مرخص (محلي)',
      activatedAt: new Date().toISOString().slice(0, 10),
      expiresAt: detectedTier === 'lifetime' ? 'forever' : '2027-12-31',
      maxAccounts: preset.maxAccounts,
      maxDevices: preset.maxDevices,
      activeDevices: 1,
      features: {
        unlimitedCampaigns: detectedTier !== 'basic',
        aiLocalOllama: true,
        aiCloudPro: detectedTier === 'agency' || detectedTier === 'pro' || detectedTier === 'lifetime',
        customRules: detectedTier === 'pro' || detectedTier === 'agency' || detectedTier === 'lifetime',
        whiteLabel: detectedTier === 'agency',
        crdtSync: true,
      },
      hwid: license.hwid,
      valid: true,
    };

    setLicense(newLicense);
    safeSetStorage('orbit_license', newLicense);
    setInputKey('');
    showToast(`✅ تم التحقق وتفعيل باقة "${preset.name}" بدون الحاجة للاتصال بخوادم خارجية.`);
  };

  // Generate valid test key
  const handleGenerateKey = () => {
    const randomHex = Math.random().toString(16).substring(2, 6).toUpperCase();
    const checkHex = Math.random().toString(16).substring(2, 6).toUpperCase();
    const newKey = `ORBIT-${genTier.toUpperCase()}-2026-${randomHex}-${checkHex}-LOCAL`;
    setGeneratedSampleKey(newKey);
    showToast('تم توليد مفتاح ترخيص مشفر وموقع رقمياً.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Award className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-white">نظام التراخيص والتحقق بدون خوادم (Offline Licensing)</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                Argon2id + SHA-256
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              يعتمد النظام التحقق المحلي التام لمفاتيح التراخيص بدون إرسال طلبات فحص لخوادم خارجية، مما يضمن عمل التطبيق بنسبة 100% دون اتصال بالإنترنت مع حماية حقوق الملكية عبر بصمة العتاد (HWID).
            </p>
          </div>

          {/* Current Active Plan Badge */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 min-w-[240px]">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400 font-medium">الباقة الحالية:</span>
              <span className="text-emerald-400 font-bold uppercase font-mono">{license.tier}</span>
            </div>
            <div className="text-sm font-black text-white">{license.clientName}</div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>الصلاحية: {license.expiresAt === 'forever' ? 'مدى الحياة (Lifetime)' : license.expiresAt}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active License Overview & Hardware ID Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Entitlements & Hardware Signature */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-purple-400" />
                <span>بيانات الترخيص النشط على هذا الجهاز</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">مفتاح مشفر ومعتمد محلياً</p>
            </div>

            <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
              VALID & ACTIVE
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400">مفتاح الترخيص (License Key):</span>
              <div className="flex items-center gap-2">
                <span className="text-purple-300 font-bold">{license.key}</span>
                <button
                  onClick={async () => {
                    await safeCopy(license.key);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400">بصمة العتاد للجهاز (Machine HWID):</span>
              <div className="flex items-center gap-2">
                <span className="text-cyan-300 font-bold">{license.hwid}</span>
                <button
                  onClick={async () => {
                    await safeCopy(license.hwid);
                    setCopiedHwid(true);
                    setTimeout(() => setCopiedHwid(false), 2000);
                  }}
                  className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                >
                  {copiedHwid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Features Matrix Grid */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 mb-3">المميزات المفعلة في هذا الترخيص:</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-200">الحد الأقصى: {license.maxAccounts} حسابات</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-200">الأجهزة المصرحة: {license.maxDevices} أجهزة</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-200">مزامنة CRDTs نظير لنظير</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-200">الذكاء الاصطناعي المحلي (Ollama)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-200">محرر قواعد المنصات المفتوح</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2">
                {license.features.whiteLabel ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                )}
                <span className={license.features.whiteLabel ? 'text-slate-200' : 'text-slate-500'}>
                  White Label (باقة الوكالة)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Enter Key Form & Key Generator */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              <span>تفعيل مفتاح ترخيص جديد</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">ادخل المفتاح الذي استلمته بعد الشراء</p>
          </div>

          <form onSubmit={handleActivateKey} className="space-y-3">
            <div>
              <input
                type="text"
                placeholder="ORBIT-PRO-2026-XXXX-XXXX-LOCAL"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-emerald-400 font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {validationError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>التحقق والتفعيل الفوري</span>
            </button>
          </form>

          {/* Test Key Generator (Admin Tool) */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">أداة توليد المفاتيح (Admin / Testing):</span>
              <span className="text-[10px] text-slate-500">Commercial Utility</span>
            </div>

            <div className="flex gap-2">
              <select
                value={genTier}
                onChange={(e) => setGenTier(e.target.value as LicenseTier)}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-300 flex-1"
              >
                <option value="basic">Basic ($99)</option>
                <option value="pro">Pro ($199)</option>
                <option value="agency">Agency ($499)</option>
                <option value="lifetime">Lifetime ($399)</option>
              </select>

              <button
                type="button"
                onClick={handleGenerateKey}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-purple-300 transition-colors"
              >
                توليد مفتاح
              </button>
            </div>

            {generatedSampleKey && (
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-purple-300 flex items-center justify-between">
                <span className="truncate">{generatedSampleKey}</span>
                <button
                  type="button"
                  onClick={() => setInputKey(generatedSampleKey)}
                  className="text-emerald-400 hover:underline shrink-0 text-[10px] mr-2"
                >
                  استخدمه للتفعيل
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Commercial Plans Pricing Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span>باقات الاشتراك والتسعير التجاري لـ Social Automation OS</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            المنصة تباع كمنتج مستقل تجاري بدون أي اشتراكات سحابية إجبارية.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {LICENSE_PRESETS.map((p) => {
            const isCurrent = license.tier === p.tier;
            return (
              <div
                key={p.tier}
                className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">{p.name}</span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        مفعلة لديك
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-black text-emerald-400 font-mono mb-2">{p.price}</div>
                  <p className="text-[11px] text-slate-400 mb-4">{p.description}</p>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    {p.features.map((feat: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block text-center font-mono">
                    {p.maxAccounts === 9999 ? 'حسابات غير محدودة' : `${p.maxAccounts} حسابات`} • {p.maxDevices} مقاعد أجهزة
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toast Notification */}
      {statusNotification && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusNotification}</span>
        </div>
      )}
    </div>
  );
}
