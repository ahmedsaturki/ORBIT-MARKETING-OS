import React, { useState } from 'react';
import { 
  ShieldCheck, ShieldAlert, Zap, Lock, AlertTriangle, 
  Cpu, Sliders, CheckCircle2, RotateCcw, Activity
} from 'lucide-react';

export default function AntiBanShield() {
  const [warmUpLevel, setWarmUpLevel] = useState(8);
  const [minDelay, setMinDelay] = useState(4);
  const [maxDelay, setMaxDelay] = useState(11);
  const [circuitBreakerThreshold, setCircuitBreakerThreshold] = useState(3);
  const [stealthBrowser, setStealthBrowser] = useState(true);
  const [localEncryption, setLocalEncryption] = useState(true);
  const [proxyRotation, setProxyRotation] = useState(true);
  const [naturalMouseTrack, setNaturalMouseTrack] = useState(true);

  // Status simulation
  const [circuitBreakerTriggered, setCircuitBreakerTriggered] = useState(false);

  const resetCircuitBreaker = () => {
    setCircuitBreakerTriggered(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/20 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              درع الأمان ومحاكاة السلوك البشري نشط (100% Stealth Active)
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white">بروتوكول الحماية من الحظر \"قاطع الدائرة الذكي\"</h2>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            هندسة الحماية المعتمدة على محاكاة تصرفات الإنسان الحقيقي (Human Mimicry) بدلاً من أنماط البوتات المكشوفة، مع قاطع دائرة يوقف العمليات تلقائياً عند أي إشارة خطر.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-lg">
            96%
          </div>
          <div>
            <div className="text-xs text-slate-400">متوسط صحة الحسابات</div>
            <div className="text-sm font-bold text-emerald-400">آمن ومستقر جداً</div>
          </div>
        </div>
      </div>

      {/* Grid: Anti-Ban Rules & Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Safety Rule 1: Human Delay Simulation */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">التأخير الزمني العشوائي (Randomized Pacing)</h3>
                <p className="text-xs text-slate-400">منع الفترات الزمنية المتطابقة التي تكشفها خوارزميات الذكاء الاصطناعي</p>
              </div>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md">
              {minDelay}s - {maxDelay}s
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>الحد الأدنى للانتظار بين النقرات:</span>
                <span>{minDelay} ثانية</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={minDelay}
                onChange={(e) => setMinDelay(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>الحد الأقصى للانتظار العشوائي:</span>
                <span>{maxDelay} ثانية</span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                value={maxDelay}
                onChange={(e) => setMaxDelay(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Safety Rule 2: Account Warm-up Matrix */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">مستوى الإحماء التدريجي (Account Warm-up)</h3>
                <p className="text-xs text-slate-400">التدرج من 5 مهام يومياً إلى 50 مهمة خلال 14 يوماً</p>
              </div>
            </div>
            <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md">
              مستوى {warmUpLevel} / 10
            </span>
          </div>

          <div className="pt-2">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>درجة نضج الحساب وحصانته:</span>
              <span className="text-emerald-400 font-semibold">{warmUpLevel * 10}% جاهزية قصوى</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={warmUpLevel}
              onChange={(e) => setWarmUpLevel(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 mt-2">
              الحسابات في المستوى 8+ تستطيع النشر في 35 مجموعة وإرسال 80 رسالة يومياً بأمان تام.
            </p>
          </div>
        </div>

        {/* Safety Rule 3: Smart Circuit Breaker */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">قاطع الدائرة الذكي (Circuit Breaker)</h3>
                <p className="text-xs text-slate-400">الإيقاف الفوري قبل حدوث الحظر عند مواجهة كابتشا أو خطأ متكرر</p>
              </div>
            </div>
            <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md">
              {circuitBreakerThreshold} محاولات
            </span>
          </div>

          <div className="pt-2 space-y-3">
            <div className="flex justify-between text-xs text-slate-400">
              <span>عتبة الإيقاف التلقائي للطابور:</span>
              <span>{circuitBreakerThreshold} أخطاء متتالية</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              value={circuitBreakerThreshold}
              onChange={(e) => setCircuitBreakerThreshold(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />

            {circuitBreakerTriggered ? (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  تم تفعيل القاطع: إيقاف الحملات لحماية الحساب.
                </span>
                <button
                  onClick={resetCircuitBreaker}
                  className="bg-rose-900/60 hover:bg-rose-900 text-white px-3 py-1 rounded-lg text-xs"
                >
                  إعادة التشغيل
                </button>
              </div>
            ) : (
              <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-emerald-400 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                القاطع في وضع المراقبة النشطة بدون أي مؤشرات خطر حالياً.
              </div>
            )}
          </div>
        </div>

        {/* Safety Rule 4: Toggles Matrix */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <h3 className="text-sm font-bold text-white mb-2">إعدادات الخصوصية والتخفي المتقدمة:</h3>

          <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700">
            <span className="text-xs text-slate-200">تشفير الجلسات محلياً (AES-256) بدون رفع للسحابة</span>
            <input
              type="checkbox"
              checked={localEncryption}
              onChange={(e) => setLocalEncryption(e.target.checked)}
              className="w-4 h-4 accent-emerald-500"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700">
            <span className="text-xs text-slate-200">محاكاة حركة الماوس المنحنية (Natural Bezier Movement)</span>
            <input
              type="checkbox"
              checked={naturalMouseTrack}
              onChange={(e) => setNaturalMouseTrack(e.target.checked)}
              className="w-4 h-4 accent-emerald-500"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700">
            <span className="text-xs text-slate-200">تبديل بصمات المتصفح (Browser Fingerprint Cloaking)</span>
            <input
              type="checkbox"
              checked={stealthBrowser}
              onChange={(e) => setStealthBrowser(e.target.checked)}
              className="w-4 h-4 accent-emerald-500"
            />
          </label>

          <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 cursor-pointer hover:border-slate-700">
            <span className="text-xs text-slate-200">عزل البروكسي السكني لكل حساب (Residential IP Isolation)</span>
            <input
              type="checkbox"
              checked={proxyRotation}
              onChange={(e) => setProxyRotation(e.target.checked)}
              className="w-4 h-4 accent-emerald-500"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
