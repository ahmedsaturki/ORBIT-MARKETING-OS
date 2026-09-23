import React, { useState } from 'react';
import { 
  Rocket, Calendar, Clock, Play, Pause, Plus, Eye, 
  CheckCircle2, AlertCircle, Share2, Facebook, MessageCircle, 
  Send, Instagram, Linkedin, ShieldCheck, Filter
} from 'lucide-react';
import { INITIAL_CAMPAIGNS } from '../data/mockData';
import { Campaign, Platform } from '../types';
import { safeGetStorage, safeSetStorage } from '../utils/storage';

export default function CampaignHub() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    return safeGetStorage<Campaign[]>('orbit_campaigns', INITIAL_CAMPAIGNS);
  });

  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [selectedPreviewPlatform, setSelectedPreviewPlatform] = useState<Platform>('facebook');

  // New campaign form state
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newPlatform, setNewPlatform] = useState<Platform>('facebook');
  const [newTarget, setNewTarget] = useState('12 مجموعة فيسبوك مستهدفة');
  const [newContent, setNewContent] = useState('🔥 عرض الأسبوع الحصري: اشترك الآن في باقة النمو الشاملة واحصل على استشارة تسويقية مجانية + كود خصم 30%! الرابط بالتعليق الأول 🚀');
  const [minDelay, setMinDelay] = useState(4);
  const [maxDelay, setMaxDelay] = useState(9);

  const saveCampaigns = (newCamps: Campaign[]) => {
    setCampaigns(newCamps);
    safeSetStorage('orbit_campaigns', newCamps);
  };

  const handleToggleStatus = (id: string) => {
    const updated = campaigns.map(c => {
      if (c.id === id) {
        const nextStatus = c.status === 'running' ? 'paused' : 'running';
        return { ...c, status: nextStatus };
      }
      return c;
    });
    saveCampaigns(updated);
  };

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName.trim()) return;

    const newCamp: Campaign = {
      id: `camp_${Date.now()}`,
      name: newCampaignName,
      platform: newPlatform,
      target: newTarget,
      status: 'scheduled',
      content: newContent,
      scheduledAt: new Date(Date.now() + 3600000).toLocaleString('ar-EG'),
      successfulActions: 0,
      totalActions: 25,
      delayRange: [minDelay, maxDelay],
    };

    saveCampaigns([newCamp, ...campaigns]);
    setNewCampaignName('');
    setActiveTab('list');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">إدارة وجدولة الحملات متعددة المنصات</h2>
            <p className="text-xs text-slate-400">
              تنظيم المحتوى والمهام المجدولة مع حدود تشغيل واضحة وقاطع دائرة للتوقف عند الأخطاء أو التحديات.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'list'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            الحملات الحالية ({campaigns.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'create'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إنشاء حملة جديدة</span>
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        /* Create Campaign Form + Real-time Preview */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              تفاصيل الحملة الجديدة
            </h3>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">اسم الحملة:</label>
                <input
                  type="text"
                  required
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="مثال: حملة عروض الجمعة البيضاء - جروبات القاهرة"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">المنصة المستهدفة:</label>
                  <select
                    value={newPlatform}
                    onChange={(e) => {
                      setNewPlatform(e.target.value as Platform);
                      setSelectedPreviewPlatform(e.target.value as Platform);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="facebook">فيسبوك (مجموعات وصفحات شخصية)</option>
                    <option value="whatsapp">واتساب ويب (قوائم برودكاست ومجموعات)</option>
                    <option value="telegram">تليجرام (قنوات ومجموعات تسويق)</option>
                    <option value="instagram">إنستغرام (منشورات ورسائل مباشرة DMs)</option>
                    <option value="linkedin">لينكد إن (رسائل مهنية B2B)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">الهدف / الشريحة:</label>
                  <input
                    type="text"
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    placeholder="مثال: 20 مجموعة، 50 عميل سابق..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">نص المنشور أو الرسالة:</label>
                <textarea
                  rows={4}
                  required
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="اكتب المحتوى الذي سيتم نشره أو إرساله تلقائياً..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none font-sans"
                />
              </div>

              {/* Human Mimicry Safe Delays */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    محاكاة السلوك البشري والتأخير العشوائي (Anti-Ban Protection):
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    بين {minDelay} و {maxDelay} ثوانٍ
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">أدنى تأخير (ثواني):</label>
                    <input
                      type="number"
                      min={2}
                      max={30}
                      value={minDelay}
                      onChange={(e) => setMinDelay(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">أقصى تأخير (ثواني):</label>
                    <input
                      type="number"
                      min={minDelay + 1}
                      max={60}
                      value={maxDelay}
                      onChange={(e) => setMaxDelay(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 transition-all"
                >
                  حفظ وجدولة الحملة
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Platform Live Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-blue-400" />
                  معاينة مباشرة لشكل النشر:
                </span>
                <span className="text-[11px] uppercase font-mono px-2 py-0.5 rounded bg-slate-950 text-blue-400 border border-slate-800">
                  {selectedPreviewPlatform}
                </span>
              </div>

              {/* Preview Containers */}
              {selectedPreviewPlatform === 'whatsapp' ? (
                /* WhatsApp Preview */
                <div className="bg-[#0b141a] rounded-xl p-4 border border-[#202c33] text-right space-y-2">
                  <div className="text-[11px] text-[#8696a0] flex items-center justify-between pb-2 border-b border-[#202c33]">
                    <span>واتساب ويب للأعمال</span>
                    <span className="text-[10px]">محادثة مباشرة</span>
                  </div>
                  <div className="bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-sm p-3 text-xs leading-relaxed max-w-[90%] mr-auto shadow">
                    <p className="whitespace-pre-wrap">{newContent || 'اكتب نص الحملة للمعاينة...'}</p>
                    <div className="text-left text-[9px] text-[#8696a0] mt-1">12:45 م ✓✓</div>
                  </div>
                </div>
              ) : selectedPreviewPlatform === 'telegram' ? (
                /* Telegram Preview */
                <div className="bg-[#17212b] rounded-xl p-4 border border-[#242f3d] text-right space-y-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#242f3d]">
                    <div className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-bold">
                      O
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">قناة العروض الرسمية</div>
                      <div className="text-[10px] text-slate-400">12,450 مشترك</div>
                    </div>
                  </div>
                  <div className="bg-[#242f3d] text-white rounded-xl p-3 text-xs leading-relaxed shadow">
                    <p className="whitespace-pre-wrap">{newContent || 'اكتب نص الحملة للمعاينة...'}</p>
                    <div className="text-left text-[10px] text-slate-400 mt-2">1.2K مشاهدة • 12:45</div>
                  </div>
                </div>
              ) : (
                /* Facebook Preview */
                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-right space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                      F
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">المسوق المحترف في {newTarget}</div>
                      <div className="text-[10px] text-slate-500">الآن • 🌐 عام</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {newContent || 'اكتب نص الحملة للمعاينة...'}
                  </p>
                  <div className="pt-2 border-t border-slate-900 flex justify-around text-slate-500 text-xs">
                    <span>👍 إعجاب</span>
                    <span>💬 تعليق</span>
                    <span>↗️ مشاركة</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* List of Campaigns */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-base">قائمة الحملات والعمليات المجدولة</h3>
            <span className="text-xs text-slate-400">
              إجمالي المهام المنجزة: {campaigns.reduce((acc, c) => acc + c.successfulActions, 0)} من أصل {campaigns.reduce((acc, c) => acc + c.totalActions, 0)}
            </span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {campaigns.map((camp) => {
              const progress = Math.round((camp.successfulActions / camp.totalActions) * 100);
              const isRunning = camp.status === 'running';

              return (
                <div key={camp.id} className="p-5 hover:bg-slate-950/40 transition-colors">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          isRunning ? 'bg-emerald-400 animate-pulse' : camp.status === 'completed' ? 'bg-blue-400' : 'bg-amber-400'
                        }`} />
                        <h4 className="font-bold text-white text-sm">{camp.name}</h4>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono uppercase">
                          {camp.platform}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          isRunning 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isRunning ? 'قيد التنفيذ التلقائي' : camp.status === 'completed' ? 'مكتملة' : 'متوقفة مؤقتاً'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-1">{camp.content}</p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                        <span>🎯 الهدف: {camp.target}</span>
                        <span>⏱️ التأخير: {camp.delayRange[0]}-{camp.delayRange[1]} ثوانٍ</span>
                        <span>📅 الجدولة: {camp.scheduledAt}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                      {/* Progress Bar */}
                      <div className="w-36 text-left">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span>{progress}%</span>
                          <span>{camp.successfulActions}/{camp.totalActions}</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              progress === 100 ? 'bg-blue-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(camp.id)}
                          className={`p-2.5 rounded-xl border transition-all text-xs flex items-center gap-1.5 ${
                            isRunning
                              ? 'bg-amber-950/30 border-amber-800/40 text-amber-400 hover:bg-amber-950/60'
                              : 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400 hover:bg-emerald-950/60'
                          }`}
                          title={isRunning ? 'إيقاف مؤقت' : 'استئناف التنفيذ'}
                        >
                          {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          <span>{isRunning ? 'إيقاف' : 'تشغيل'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
