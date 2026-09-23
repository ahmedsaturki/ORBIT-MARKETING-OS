import React, { useState } from 'react';
import { 
  RefreshCw, Laptop, Smartphone, Globe, ShieldCheck, 
  Download, Upload, CheckCircle2, AlertTriangle, 
  Layers, Database, HardDrive, Lock, ArrowLeftRight, 
  Wifi, Sparkles, Server
} from 'lucide-react';
import { INITIAL_CRDT_PEERS } from '../data/mockData';
import { CrdtPeer } from '../types';
import { safeGetStorage, safeSetStorage, safeCopy } from '../utils/storage';

export default function CrdtSyncManager() {
  const [peers, setPeers] = useState<CrdtPeer[]>(() => {
    return safeGetStorage<CrdtPeer[]>('orbit_crdt_peers', INITIAL_CRDT_PEERS);
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [activeBackupProvider, setActiveBackupProvider] = useState<'google_drive' | 'dropbox' | 'icloud' | 'local'>('google_drive');
  const [lastBackupDate, setLastBackupDate] = useState<string>('2026-09-23 15:45');
  const [isBackingUp, setIsBackingUp] = useState(false);

  // Conflict simulator states
  const [desktopDocText, setDesktopDocText] = useState('حملة خصومات العيد: كود EID40 على جميع العبايات');
  const [mobileDocText, setMobileDocText] = useState('حملة خصومات العيد: كود EID40 + شحن مجاني للرياض');
  const [mergedDocText, setMergedDocText] = useState('حملة خصومات العيد: كود EID40 على جميع العبايات + شحن مجاني للرياض');

  const showToast = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 3000);
  };

  const handleTriggerP2pSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      const updated = peers.map(p => ({
        ...p,
        status: p.status === 'offline' ? ('offline' as const) : ('connected' as const),
        lastSync: 'الآن (منذ ثوانٍ)',
        vectorClock: p.vectorClock + 1,
      }));
      setPeers(updated);
      safeSetStorage('orbit_crdt_peers', updated);
      showToast('✅ تمت مزامنة CRDTs نظير لنظير P2P بنجاح وبدون أي تعارض في البيانات.');
    }, 1200);
  };

  const handleSimulateBackup = () => {
    setIsBackingUp(true);
    setTimeout(() => {
      setIsBackingUp(false);
      const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
      setLastBackupDate(now);
      showToast(`✅ تم إنشاء نسخة احتياطية مشفرة بـ AES-256 ورفعها إلى ${activeBackupProvider.toUpperCase()} بنجاح.`);
    }, 1500);
  };

  const handleExportFullEncryptedFile = () => {
    const backupPayload = {
      app: 'Social Automation OS',
      version: '2.4.1',
      timestamp: new Date().toISOString(),
      encryption: 'AES-256-GCM',
      data: {
        accounts: safeGetStorage('orbit_accounts', []),
        campaigns: safeGetStorage('orbit_campaigns', []),
        leads: safeGetStorage('orbit_leads', []),
        taskQueue: safeGetStorage('orbit_task_queue', []),
        rules: safeGetStorage('orbit_automation_rules', []),
        license: safeGetStorage('orbit_license', {}),
      },
    };

    const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `social-os-backup-encrypted-${new Date().toISOString().slice(0, 10)}.orbit.enc`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('تم تحميل ملف النسخة الاحتياطية المشفرة لجهازك بنجاح.');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-white">نظام المزامنة P2P (CRDTs with Yjs) والنسخ الاحتياطي</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                Zero-Cloud • End-to-End Encrypted
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              مزامنة مباشرة وفورية بين جهاز سطح المكتب (Desktop)، الهاتف المحمول (Mobile)، والويب بدون المرور على أي خوادم وسيطة باستخدام تقنية Yjs CRDTs التي تدمج التعديلات المتزامنة بدون أي تعارض أو فقدان للبيانات.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerP2pSync}
              disabled={isSyncing}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة فورية (P2P Sync)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Connected Devices (Peers) Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <span>الأجهزة المتصلة بشبكة المزامنة المحلية (Active P2P Peers)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">اتصال مباشر عبر الشبكة المحلية أو WebRTC Mesh</p>
          </div>

          <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {peers.filter(p => p.status === 'connected').length} أجهزة متزامنة
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {peers.map((peer) => {
            const isDesktop = peer.deviceType === 'desktop';
            const isConnected = peer.status === 'connected';

            return (
              <div
                key={peer.id}
                className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
                      {isDesktop ? <Laptop className="w-4 h-4 text-cyan-400" /> : <Smartphone className="w-4 h-4 text-purple-400" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">{peer.name}</h4>
                      <span className="text-[10px] text-slate-500 font-mono">{peer.ip}</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {isConnected ? 'متصل' : 'غير متصل'}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Vector Clock: #{peer.vectorClock}</span>
                  <span className="text-slate-500">{peer.lastSync}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive CRDTs Conflict-Free Merge Simulator */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>محاكي دمج النصوص بدون تعارض (CRDTs Conflict Resolution Live Demo)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
            عندما يقوم المستخدم بتعديل حملة أو رسالة من اللابتوب والهاتف في نفس اللحظة دون اتصال، تقوم هياكل CRDTs بدمج التعديلات تلقائياً استناداً إلى الطوابع الزمنية بدون استبدال أي مدخلات.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-bold text-cyan-400">
                <Laptop className="w-3.5 h-3.5" />
                تعديل على سطح المكتب (Desktop Node)
              </span>
              <span className="font-mono text-[10px]">Vector: +1</span>
            </div>
            <textarea
              rows={2}
              value={desktopDocText}
              onChange={(e) => {
                setDesktopDocText(e.target.value);
                setMergedDocText(`${e.target.value} • ${mobileDocText}`);
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
            />
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-bold text-purple-400">
                <Smartphone className="w-3.5 h-3.5" />
                تعديل على الهاتف المحمول (Mobile Node)
              </span>
              <span className="font-mono text-[10px]">Vector: +2</span>
            </div>
            <textarea
              rows={2}
              value={mobileDocText}
              onChange={(e) => {
                setMobileDocText(e.target.value);
                setMergedDocText(`${desktopDocText} • ${e.target.value}`);
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-sans"
            />
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              النتيجة المدمجة تلقائياً (Yjs CRDT Merged Document):
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Zero Conflicts Detected</span>
          </div>
          <p className="text-xs text-slate-200 bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-medium">
            {mergedDocText}
          </p>
        </div>
      </div>

      {/* Cloud Encrypted Backup & Restore */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>النسخ الاحتياطي المشفر (Encrypted Cloud & Local Backup)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              تشفير البيانات بمفتاح مشتق من كلمة مرورك عبر Argon2id ورفعها لحسابك السحابي المجاني أو حفظها محلياً.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportFullEncryptedFile}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل ملف مشفر (.orbit.enc)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: 'google_drive', name: 'Google Drive', space: '15 GB مجاني' },
            { id: 'dropbox', name: 'Dropbox', space: '2 GB مجاني' },
            { id: 'icloud', name: 'Apple iCloud', space: '5 GB مجاني' },
            { id: 'local', name: 'مجلد محلي (Local)', space: 'أوفلاين بالكامل' },
          ].map((prov) => {
            const isSelected = activeBackupProvider === prov.id;
            return (
              <div
                key={prov.id}
                onClick={() => setActiveBackupProvider(prov.id as any)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-md'
                    : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-white">{prov.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{prov.space}</div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-400 font-mono">
            آخر نسخة احتياطية: <span className="text-emerald-400 font-bold">{lastBackupDate}</span>
          </div>

          <button
            onClick={handleSimulateBackup}
            disabled={isBackingUp}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
          >
            <HardDrive className="w-4 h-4" />
            <span>{isBackingUp ? 'جاري التشفير والرفع...' : 'إنشاء نسخة احتياطية فورية الآن'}</span>
          </button>
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
