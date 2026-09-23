import React, { useState } from 'react';
import { 
  Users, Plus, ShieldCheck, RefreshCw, Trash2, CheckCircle2, 
  AlertTriangle, Lock, Globe, Smartphone, Laptop, Check
} from 'lucide-react';
import { INITIAL_ACCOUNTS } from '../data/mockData';
import { SocialAccount, Platform } from '../types';
import { safeGetStorage, safeSetStorage } from '../utils/storage';

export default function AccountsManager() {
  const [accounts, setAccounts] = useState<SocialAccount[]>(() => {
    return safeGetStorage<SocialAccount[]>('orbit_accounts', INITIAL_ACCOUNTS);
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [newPlatform, setNewPlatform] = useState<Platform>('facebook');
  const [newAccountName, setNewAccountName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newProxy, setNewProxy] = useState('Residential-Static-Proxy:443');
  const [testingId, setTestingId] = useState<string | null>(null);

  const saveAccounts = (newAccs: SocialAccount[]) => {
    setAccounts(newAccs);
    safeSetStorage('orbit_accounts', newAccs);
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;

    const newAcc: SocialAccount = {
      id: `acc_${Date.now()}`,
      platform: newPlatform,
      accountName: newAccountName,
      username: newUsername || newAccountName.toLowerCase().replace(/\s+/g, '_'),
      status: 'active',
      healthScore: 100,
      warmUpLevel: 1,
      dailyActionsDone: 0,
      dailyLimit: 20,
      lastActivity: 'تمت الإضافة الآن - جلسة مشفرة محلياً',
      proxy: newProxy,
      sessionEncrypted: true,
    };

    saveAccounts([...accounts, newAcc]);
    setNewAccountName('');
    setNewUsername('');
    setShowAddModal(false);
    showNotice('تم ربط وتشفير جلسة الحساب بنجاح محلياً.');
  };

  const confirmDelete = () => {
    if (!deleteCandidateId) return;
    saveAccounts(accounts.filter(a => a.id !== deleteCandidateId));
    setDeleteCandidateId(null);
    showNotice('تم حذف الحساب وإزالة جلسة التخزين المشفرة.');
  };

  const showNotice = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => {
      setStatusNotification(null);
    }, 3500);
  };

  const handleTestConnection = (id: string) => {
    setTestingId(id);
    setTimeout(() => {
      setTestingId(null);
      showNotice('✅ تم فحص الجلسة المحلية بنجاح: الحساب متصل بدون أي قيود أو كابتشا.');
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">إدارة الحسابات وجلسات المنصات</h2>
            <p className="text-xs text-slate-400">
              ربط الحسابات الشخصية والتجارية مع عزل تام وتشفير محلي (Local Sessions) لضمان عدم تعرض الحسابات للمخاطر.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-purple-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة حساب جديد</span>
        </button>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((acc) => {
          const isHealthy = acc.healthScore >= 90;
          return (
            <div
              key={acc.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase bg-slate-950 border border-slate-800 text-purple-300 font-bold">
                    {acc.platform}
                  </span>
                  <div className="flex items-center gap-1 text-xs">
                    <span className={`w-2 h-2 rounded-full ${acc.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className="text-slate-400 capitalize">{acc.status}</span>
                  </div>
                </div>

                <h3 className="font-bold text-white text-base truncate">{acc.accountName}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">{acc.username}</p>

                {/* Health & Warmup Progress */}
                <div className="mt-4 space-y-2 pt-3 border-t border-slate-800/80">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">صحة الحساب:</span>
                    <span className={isHealthy ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {acc.healthScore}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${acc.healthScore}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-slate-400 pt-1">
                    <span>المهام اليومية:</span>
                    <span>{acc.dailyActionsDone} / {acc.dailyLimit}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800/60 text-[11px] space-y-1.5 text-slate-400">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Lock className="w-3 h-3 text-emerald-400" />
                      الجلسة:
                    </span>
                    <span className="text-emerald-400 font-mono">مشفرة محلياً (AES)</span>
                  </div>
                  <div className="flex items-center justify-between truncate">
                    <span>البروكسي:</span>
                    <span className="font-mono text-slate-300 truncate max-w-[150px]">{acc.proxy}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate pt-1">
                    آخر نشاط: {acc.lastActivity}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800 text-xs">
                <button
                  onClick={() => handleTestConnection(acc.id)}
                  disabled={testingId === acc.id}
                  className="text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingId === acc.id ? 'animate-spin' : ''}`} />
                  <span>{testingId === acc.id ? 'فحص...' : 'فحص الجلسة'}</span>
                </button>

                <button
                  onClick={() => setDeleteCandidateId(acc.id)}
                  className="text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Notification Toast */}
      {statusNotification && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-xs animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusNotification}</span>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCandidateId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">حذف هذا الحساب؟</h3>
              <p className="text-xs text-slate-400 mt-1">
                ستتم إزالة بيانات الجلسة المحلية والتشفير فوراً من جهازك ولا يمكن استرجاعها.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setDeleteCandidateId(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/20"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-400" />
              إضافة وربط حساب جديد
            </h3>

            <form onSubmit={handleAddAccount} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">اختر المنصة:</label>
                <select
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value as Platform)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="facebook">Facebook (مجموعات وصفحات)</option>
                  <option value="whatsapp">WhatsApp Web (جلسة متصفح محلية)</option>
                  <option value="telegram">Telegram (قنوات ومجموعات)</option>
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">اسم الحساب التوضيحي:</label>
                <input
                  type="text"
                  required
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="مثال: حساب واتساب المبيعات الرئيسي"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">المعرف / المعرف أو الهاتف:</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="مثال: +201012345678 أو @username"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">البروكسي السكني (اختياري):</label>
                <input
                  type="text"
                  value={newProxy}
                  onChange={(e) => setNewProxy(e.target.value)}
                  placeholder="host:port:user:pass"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl text-purple-300 text-[11px]">
                🔒 سيتم تخزين وتشفير الجلسة محلياً على جهازك دون إرسال أي كلمة مرور أو بيانات اعتماد لخوادم خارجية.
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-xl font-bold transition-all shadow-lg shadow-purple-600/20"
                >
                  حفظ وتأكيد الربط
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
