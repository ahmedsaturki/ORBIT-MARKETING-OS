import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  Activity,
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  RefreshCw,
} from 'lucide-react';
import {
  canStartExecution,
  recordExecutionFailure,
  recordExecutionSuccess,
} from '../../packages/core/src/security/executePolicy';
import type {
  ExecutionPolicy,
  ExecutionState,
} from '../../packages/core/src/security/executePolicy';
import { safeGetStorage, safeSetStorage } from '../utils/storage';

const POLICY: ExecutionPolicy = {
  dailyLimit: 10,
  maxConsecutiveFailures: 3,
  requireExplicitConfirmation: true,
};

const DAY_KEY = new Date().toISOString().slice(0, 10);
const DEFAULT_STATE: ExecutionState = {
  dayKey: DAY_KEY,
  completedToday: 0,
  consecutiveFailures: 0,
  blocked: false,
};

function normalizeState(state: ExecutionState): ExecutionState {
  return state.dayKey === DAY_KEY
    ? state
    : { ...DEFAULT_STATE, dayKey: DAY_KEY };
}

export default function SafetyShield() {
  const [state, setState] = useState<ExecutionState>(() =>
    normalizeState(safeGetStorage<ExecutionState>('orbit_execution_state', DEFAULT_STATE)),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [blockedByChallenge, setBlockedByChallenge] = useState(false);

  const decision = useMemo(
    () => canStartExecution(POLICY, state, confirmed),
    [state, confirmed],
  );

  const persist = (next: ExecutionState) => {
    setState(next);
    safeSetStorage('orbit_execution_state', next);
  };

  const handleSuccess = () => {
    if (!decision.allowed) return;
    persist(recordExecutionSuccess(state, DAY_KEY));
    setConfirmed(false);
  };

  const handleFailure = () => {
    if (!decision.allowed) return;
    persist(recordExecutionFailure(state, DAY_KEY));
    setConfirmed(false);
  };

  const resetCircuit = () => {
    const next = {
      ...state,
      consecutiveFailures: 0,
      blocked: false,
    };
    persist(next);
    setBlockedByChallenge(false);
    setConfirmed(false);
  };

  const triggerChallenge = () => {
    setBlockedByChallenge(true);
    setConfirmed(false);
  };

  const challengeActive = blockedByChallenge || state.blocked;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">طبقة سلامة التشغيل وقاطع الدائرة</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                حدود محلية تمنع التشغيل الزائد وتطلب تأكيد المستخدم وتوقف المهام عند الأخطاء أو تحديات المصادقة.
              </p>
            </div>
          </div>
          <div className="text-xs font-mono px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400">
            {decision.allowed && !challengeActive ? 'READY' : 'BLOCKED'}
          </div>
        </div>
      </div>

      {challengeActive && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/50 text-amber-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm">التنفيذ متوقف ويتطلب تدخلاً بشرياً</div>
            <p className="text-xs text-amber-300/80 mt-1">
              تم تسجيل تحدٍ أو حالة غير موثوقة. لا يتم تجاوز التحدي أو محاولة إخفاء النشاط؛ راجع الحساب/الاتصال ثم أعد التفعيل يدوياً.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs text-slate-500">الحد اليومي</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-black text-white">{state.completedToday}</span>
            <span className="text-sm text-slate-500 mb-1">/ {POLICY.dailyLimit}</span>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs text-slate-500">أخطاء متتالية</div>
          <div className="mt-2 text-3xl font-black text-white">{state.consecutiveFailures}</div>
          <div className="text-[11px] text-slate-500 mt-1">يفتح القاطع عند {POLICY.maxConsecutiveFailures}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="text-xs text-slate-500">تاريخ الحالة</div>
          <div className="mt-2 text-lg font-bold text-white">{state.dayKey}</div>
          <div className="text-[11px] text-slate-500 mt-1">كل جهاز يحتفظ بالحالة محلياً في النموذج الحالي</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">اختبار بوابة التنفيذ</h3>
        </div>

        <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="accent-emerald-500"
          />
          أؤكد أنني أريد بدء العملية الخارجية الآن.
        </label>

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={handleSuccess}
            disabled={!decision.allowed || challengeActive}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            تسجيل نجاح
          </button>
          <button
            type="button"
            onClick={handleFailure}
            disabled={!decision.allowed || challengeActive}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            تسجيل فشل
          </button>
          <button
            type="button"
            onClick={triggerChallenge}
            className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold flex items-center gap-2"
          >
            <PauseCircle className="w-4 h-4" />
            محاكاة تحدي
          </button>
          <button
            type="button"
            onClick={resetCircuit}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة ضبط القاطع
          </button>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
          <span className="text-slate-500">القرار الحالي: </span>
          <span className={decision.allowed && !challengeActive ? 'text-emerald-400' : 'text-amber-400'}>
            {challengeActive ? 'متوقف لتدخل بشري' :
              !decision.allowed
                ? ({
                    daily_limit: 'تم بلوغ الحد اليومي',
                    circuit_breaker: 'قاطع الدائرة مفتوح',
                    confirmation_required: 'بانتظار تأكيد المستخدم',
                    blocked: 'الحالة محجوبة',
                  } as const)[decision.reason]
                : 'مسموح وفق السياسة الحالية'}
          </span>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 text-xs text-slate-400">
        هذه الطبقة هي حواجز سلامة تشغيلية، وليست آلية لتجاوز أنظمة مكافحة الإساءة أو تغيير بصمة المتصفح أو إخفاء الأتمتة.
      </div>
    </div>
  );
}
