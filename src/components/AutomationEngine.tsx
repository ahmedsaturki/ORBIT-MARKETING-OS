import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RefreshCw, ShieldAlert, Cpu, 
  Terminal, Sliders, CheckCircle2, AlertTriangle, 
  MousePointer, Keyboard, Clock, Globe, Code, 
  FileText, Sparkles, Layers, ArrowRight, RotateCcw
} from 'lucide-react';
import { DEFAULT_AUTOMATION_RULES, INITIAL_TASK_QUEUE } from '../data/mockData';
import { AutomationRule, Platform, TaskQueueItem } from '../types';
import { safeGetStorage, safeSetStorage, safeCopy } from '../utils/storage';

export default function AutomationEngine() {
  const [rules, setRules] = useState<Record<string, AutomationRule>>(() => {
    return safeGetStorage('orbit_automation_rules', DEFAULT_AUTOMATION_RULES);
  });

  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('facebook');
  const [tasks, setTasks] = useState<TaskQueueItem[]>(() => {
    return safeGetStorage('orbit_task_queue', INITIAL_TASK_QUEUE);
  });

  const [activeSubTab, setActiveSubTab] = useState<'queue' | 'rules' | 'stealth' | 'circuit'>('queue');
  const [isEngineRunning, setIsEngineRunning] = useState(true);
  const [circuitTripped, setCircuitTripped] = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [captchaModalOpen, setCaptchaModalOpen] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Stealth simulator states
  const [typingSpeed, setTypingSpeed] = useState(85); // ms per char
  const [minDelay, setMinDelay] = useState(3);
  const [maxDelay, setMaxDelay] = useState(11);
  const [stealthTesting, setStealthTesting] = useState(false);
  const [typingOutput, setTypingOutput] = useState('');
  const [mouseCanvasPoints, setMouseCanvasPoints] = useState<{ x: number; y: number }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // JSON editor state for rules
  const currentRule = rules[selectedPlatform] || DEFAULT_AUTOMATION_RULES[selectedPlatform];
  const [jsonText, setJsonText] = useState(JSON.stringify(currentRule, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    setJsonText(JSON.stringify(rules[selectedPlatform] || DEFAULT_AUTOMATION_RULES[selectedPlatform], null, 2));
    setJsonError(null);
  }, [selectedPlatform, rules]);

  // Draw Bezier curves on canvas
  const drawBezier = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Points for cubic bezier
    const p0 = { x: 30, y: canvas.height - 30 };
    const p1 = { x: Math.random() * (canvas.width * 0.4) + 20, y: Math.random() * (canvas.height * 0.6) };
    const p2 = { x: Math.random() * (canvas.width * 0.4) + (canvas.width * 0.4), y: Math.random() * canvas.height };
    const p3 = { x: canvas.width - 30, y: 30 };

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Control point guides
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.moveTo(p3.x, p3.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw nodes
    [p0, p1, p2, p3].forEach((p, idx) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, idx === 0 || idx === 3 ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = idx === 0 ? '#10b981' : idx === 3 ? '#ef4444' : '#6366f1';
      ctx.fill();
    });
  };

  useEffect(() => {
    if (activeSubTab === 'stealth') {
      drawBezier();
    }
  }, [activeSubTab]);

  const showToast = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 3000);
  };

  // Run human-like typing simulation
  const runTypingTest = () => {
    setStealthTesting(true);
    setTypingOutput('');
    const sampleText = 'مرحباً بك! هذا فحص لمحاكاة سرعة الكتابة البشرية مع فترات التوقف العشوائية.';
    let index = 0;

    const interval = setInterval(() => {
      if (index < sampleText.length) {
        setTypingOutput((prev) => prev + sampleText.charAt(index));
        index++;
      } else {
        clearInterval(interval);
        setStealthTesting(false);
        drawBezier();
      }
    }, typingSpeed);
  };

  // Save rules
  const handleSaveRules = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const updated = { ...rules, [selectedPlatform]: parsed };
      setRules(updated);
      safeSetStorage('orbit_automation_rules', updated);
      setJsonError(null);
      showToast(`تم حفظ وتحديث قواعد أتمتة ${selectedPlatform.toUpperCase()} محلياً.`);
    } catch (e: any) {
      setJsonError(`خطأ في صياغة JSON: ${e.message}`);
    }
  };

  const handleResetRuleToDefault = () => {
    const updated = { ...rules, [selectedPlatform]: DEFAULT_AUTOMATION_RULES[selectedPlatform] };
    setRules(updated);
    safeSetStorage('orbit_automation_rules', updated);
    setJsonText(JSON.stringify(DEFAULT_AUTOMATION_RULES[selectedPlatform], null, 2));
    setJsonError(null);
    showToast(`تمت استعادة الإعدادات الافتراضية لـ ${selectedPlatform.toUpperCase()}`);
  };

  // Trigger test failure to demonstrate circuit breaker
  const triggerSimulatedError = () => {
    const newCount = consecutiveErrors + 1;
    setConsecutiveErrors(newCount);
    if (newCount >= 3) {
      setCircuitTripped(true);
      setIsEngineRunning(false);
      showToast('⚠️ تم فصل قاطع الدائرة تلقائياً بعد 3 أخطاء متتالية لحماية الحساب من الحظر!');
    } else {
      showToast(`تنبيه: تم تسجيل خطأ رقم ${newCount}/3 في محرك الأتمتة.`);
    }
  };

  const resetCircuitBreaker = () => {
    setConsecutiveErrors(0);
    setCircuitTripped(false);
    setIsEngineRunning(true);
    showToast('تم إعادة تهيئة قاطع الدائرة واستئناف محرك المهام.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Cpu className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-white">محرك الأتمتة وقواعد التشغيل (Playwright Stealth Engine)</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                Tauri Core v2.x
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              تنفيذ المهام عبر متصفح محلي مخفي بمحاكاة سلوك بشري كامل: تأخيرات عشوائية (3-12 ثانية)، منحنيات بيزيه لحركة الماوس، سرعة كتابة متغيرة، وقواعد محددات محدثة بدون إعادة تثبيت التطبيق.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEngineRunning(!isEngineRunning)}
              disabled={circuitTripped}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg ${
                circuitTripped
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : isEngineRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
              }`}
            >
              {isEngineRunning ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>إيقاف المحرك مؤقتاً</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>تشغيل محرك المهام</span>
                </>
              )}
            </button>

            {circuitTripped && (
              <button
                onClick={resetCircuitBreaker}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-rose-600/20 animate-pulse"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة ضبط قاطع الدائرة</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Indicators Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-[11px] text-slate-400">حالة المشغل المحلي</div>
            <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5 font-mono">
              <span className={`w-2 h-2 rounded-full ${isEngineRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {circuitTripped ? 'مفصول أمنياً' : isEngineRunning ? 'نشط ويعالج المهام' : 'متوقف مؤقتاً'}
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-[11px] text-slate-400">قاطع الدائرة (Circuit Breaker)</div>
            <div className={`text-sm font-bold mt-1 font-mono ${circuitTripped ? 'text-rose-400' : 'text-emerald-400'}`}>
              {consecutiveErrors} / 3 أخطاء متتالية
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-[11px] text-slate-400">وضع التخفي (Playwright Stealth)</div>
            <div className="text-sm font-bold text-cyan-400 mt-1 font-mono">
              بصمة عشوائية (Active)
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
            <div className="text-[11px] text-slate-400">طابور الانتظار (Queue)</div>
            <div className="text-sm font-bold text-purple-400 mt-1 font-mono">
              {tasks.filter(t => t.status === 'queued').length} مهام معلقة
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('queue')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'queue'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>طابور المهام الذكي ({tasks.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('stealth')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'stealth'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <MousePointer className="w-4 h-4" />
          <span>محاكاة السلوك البشري والتخفي</span>
        </button>

        <button
          onClick={() => setActiveSubTab('rules')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'rules'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Code className="w-4 h-4" />
          <span>محرر قواعد المنصات (JSON Rules)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('circuit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'circuit'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>اختبار قاطع الدائرة والكابتشا</span>
        </button>
      </div>

      {/* Sub-Tab 1: Task Queue */}
      {activeSubTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>المهام المجدولة وقيد التنفيذ المباشر</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              تحديث آلي كل 5 ثوانٍ مع تراجع أسي (Exponential Backoff)
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="p-3.5">معرف المهمة</th>
                    <th className="p-3.5">المنصة</th>
                    <th className="p-3.5">نوع الإجراء</th>
                    <th className="p-3.5">الهدف المستهدف</th>
                    <th className="p-3.5">الأولوية</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">التأخير المطبق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5 font-mono text-slate-300">{task.id}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                          {task.platform}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-200">{task.actionType}</td>
                      <td className="p-3.5 text-slate-300 max-w-xs truncate">{task.target}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          task.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {task.priority === 'high' ? 'أولوية عالية' : 'عادية'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {task.status === 'running' && (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            جاري التنفيذ
                          </span>
                        )}
                        {task.status === 'queued' && (
                          <span className="text-amber-400 font-medium">في الانتظار ({task.scheduledTime})</span>
                        )}
                        {task.status === 'completed' && (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            تم بنجاح ({task.executedTime})
                          </span>
                        )}
                        {task.status === 'failed' && (
                          <span className="text-rose-400 font-bold">فشل ({task.retries} محاولات)</span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">
                        {task.delayAppliedSeconds ? `${task.delayAppliedSeconds}s` : 'عشوائي'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Stealth Simulator */}
      {activeSubTab === 'stealth' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mouse Bezier Curve Visualizer */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MousePointer className="w-4 h-4 text-emerald-400" />
                  <span>محاكاة حركة الماوس المنحنية (Cubic Bezier Trajectory)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  حركات الماوس ليست خطوطاً مستقيمة كالبوتات، بل منحنيات تكعيبية مع سرعة تسارع وتباطؤ طبيعية.
                </p>
              </div>
              <button
                onClick={drawBezier}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold flex items-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>توليد مسار جديد</span>
              </button>
            </div>

            <div className="bg-slate-950 rounded-xl border border-slate-800 p-2 flex items-center justify-center">
              <canvas ref={canvasRef} width={460} height={220} className="w-full max-w-full h-auto rounded-lg" />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>نقطة البداية (P0)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span>نقاط التحكم (P1, P2)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>نقطة النقر على الزر (P3)</span>
              </div>
            </div>
          </div>

          {/* Typing & Delay Simulator */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-emerald-400" />
                <span>محاكي سرعة الكتابة والتأخير البشري (Human Typing)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                كتابة الحروف بفترات 50-150ms مع تصحيح أخطاء إملائية عشوائية لتجاوز أنظمة كشف السلوك الآلي.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-300 font-medium mb-1">
                  <span>سرعة الكتابة:</span>
                  <span className="font-mono text-emerald-400 font-bold">{typingSpeed} ms / حرف</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={200}
                  value={typingSpeed}
                  onChange={(e) => setTypingSpeed(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
                />
              </div>

              <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 min-h-[90px] font-mono text-xs text-slate-200 relative">
                {typingOutput || <span className="text-slate-600">اضغط "تجربة الكتابة الحية" لمشاهدة المحاكاة...</span>}
                {stealthTesting && <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse mr-1 align-middle" />}
              </div>

              <button
                onClick={runTypingTest}
                disabled={stealthTesting}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
              >
                <Sparkles className="w-4 h-4" />
                <span>{stealthTesting ? 'جاري محاكاة الكتابة...' : 'تجربة الكتابة الحية'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: JSON Rules Editor */}
      {activeSubTab === 'rules' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" />
                <span>محرر محددات المنصات (Updatable Selectors Rules)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                تحديث محددات الـ DOM (CSS / XPath) فوري بدون الحاجة لإعادة ترجمة أو تثبيت التطبيق عند تحديث منصات التواصل لواجهاتها.
              </p>
            </div>

            {/* Platform Selector Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {(['facebook', 'whatsapp', 'instagram', 'telegram', 'linkedin', 'tiktok'] as Platform[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPlatform(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${
                    selectedPlatform === p
                      ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {jsonError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{jsonError}</span>
            </div>
          )}

          <div className="relative">
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={14}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-emerald-300 focus:outline-none focus:border-emerald-500/50 leading-relaxed"
              spellCheck={false}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleResetRuleToDefault}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة القواعد الافتراضية</span>
            </button>

            <button
              onClick={handleSaveRules}
              className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>حفظ وتطبيق القواعد فوراً</span>
            </button>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Circuit Breaker & CAPTCHA Test */}
      {activeSubTab === 'circuit' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>قاطع الدائرة الآلي (Smart Circuit Breaker)</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              إذا واجه محرك الأتمتة 3 أخطاء متتالية (مثل تغيير فيسبوك لمحدد صندوق النشر، أو استجابة غير متوقعة)، يتوقف المحرك فوراً ويقطع الاتصال لتفادي حظر الحساب.
            </p>

            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">عداد الأخطاء المتتالية:</span>
                <span className="font-mono font-bold text-rose-400">{consecutiveErrors} / 3</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    consecutiveErrors >= 3 ? 'bg-rose-500' : consecutiveErrors === 2 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${(consecutiveErrors / 3) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={triggerSimulatedError}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-900/30 hover:text-rose-300 text-slate-300 font-bold text-xs border border-slate-700 transition-all"
              >
                محاكاة خطأ استجابة (+1)
              </button>
              <button
                onClick={resetCircuitBreaker}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all"
              >
                تصفير العداد
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>كشف الكابتشا والتدخل البشري (CAPTCHA Detection)</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              عند ظهور اختبار تحقق أمني (CAPTCHA/Challenge)، لا يخمن المحرك بل يوقف المهمة مؤقتاً ويصدر إشعاراً فورياً للمستخدم للتدخل وحل الاختبار يدوياً ثم استئناف الأتمتة.
            </p>

            <button
              onClick={() => setCaptchaModalOpen(true)}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>تجربة ظهور تنبيه كابتشا فوري</span>
            </button>
          </div>
        </div>
      )}

      {/* CAPTCHA Modal Simulation */}
      {captchaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">تنبيه أمني: مطلوب تدخل بشري لحل كابتشا</h3>
              <p className="text-xs text-slate-400 mt-1">
                اكتشف المحرك ظهور نافذة فحص أمان على حساب Facebook. تم إيقاف الأتمتة مؤقتاً لحماية الحساب.
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 text-right space-y-1 font-mono">
              <div>• الحساب المستهدف: orbit.marketing.eg</div>
              <div>• نوع الفحص: Cloudflare / Turnstile Checkpoint</div>
              <div>• الإجراء: تم حفظ حالة الجلسة بانتظار إشارتك</div>
            </div>

            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => {
                  setCaptchaModalOpen(false);
                  showToast('✅ تم تأكيد الحل اليدوي بنجاح واستئناف المهام.');
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
              >
                حللت الاختبار يدوياً • استأنف الأتمتة
              </button>
              <button
                onClick={() => setCaptchaModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800 transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

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
