import React, { useState } from 'react';
import { 
  Inbox, MessageCircle, Send, CheckCheck, Sparkles, 
  User, Tag, DollarSign, Filter, RefreshCw, Phone, Clock
} from 'lucide-react';
import { INITIAL_LEADS } from '../data/mockData';
import { ContactLead, Platform } from '../types';
import { safeGetStorage, safeSetStorage } from '../utils/storage';

export default function UnifiedInbox() {
  const [leads, setLeads] = useState<ContactLead[]>(() => {
    return safeGetStorage<ContactLead[]>('orbit_leads', INITIAL_LEADS);
  });

  const [selectedLeadId, setSelectedLeadId] = useState<string>(() => {
    const list = safeGetStorage<ContactLead[]>('orbit_leads', INITIAL_LEADS);
    return list?.[0]?.id || '';
  });
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [replyText, setReplyText] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  const selectedLead = leads.find(l => l.id === selectedLeadId) || leads[0] || null;

  const updateLeadStatus = (id: string, status: ContactLead['status']) => {
    const updated = leads.map(l => l.id === id ? { ...l, status } : l);
    setLeads(updated);
    safeSetStorage('orbit_leads', updated);
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedLead) return;

    const updated = leads.map(l => {
      if (l.id === selectedLead.id) {
        return {
          ...l,
          lastMessage: `أنت: ${replyText}`,
          lastMessageTime: 'الآن',
          unread: false,
        };
      }
      return l;
    });

    setLeads(updated);
    safeSetStorage('orbit_leads', updated);
    setReplyText('');
  };

  const handleAiSuggestReply = async () => {
    if (!selectedLead || aiGenerating) return;

    setAiGenerating(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              text: `العميل: ${selectedLead.name}\nالمنصة: ${selectedLead.platform}\nمرحلة العميل: ${selectedLead.status}\nملاحظات عنه: ${selectedLead.notes || 'لا يوجد'}\nآخر رسالة منه: "${selectedLead.lastMessage}"\n\nالمطلوب: اقترح رداً فورياً ذكياً وموجزاً باللغة العربية المناسبة لمنصة ${selectedLead.platform} يدفعه للخطوة التالية ويجيب عن سؤاله بلباقة.`,
            },
          ],
          roleId: 'crm_closer',
          profile: 'fast',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReplyText(data.text || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiGenerating(false);
    }
  };

  const filteredLeads = leads.filter(l => filterPlatform === 'all' || l.platform === filterPlatform);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">صندوق المحادثات الموحد وإدارة علاقات العملاء (CRM)</h2>
            <p className="text-xs text-slate-400">
              استقبال رسائل واتساب ويب، إنستغرام، وفيسبوك وتليجرام في شاشة واحدة مع مقترحات ردود ذكية بالـ AI.
            </p>
          </div>
        </div>

        {/* Filter by platform */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">تصفية القناة:</span>
          {['all', 'whatsapp', 'instagram', 'telegram', 'facebook'].map(plat => (
            <button
              key={plat}
              onClick={() => setFilterPlatform(plat)}
              className={`px-3 py-1.5 rounded-lg border uppercase transition-all ${
                filterPlatform === plat
                  ? 'bg-teal-600 text-white border-teal-500 font-semibold'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {plat === 'all' ? 'الكل' : plat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Inbox split view */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden min-h-[550px]">
        {/* Left: Lead list (4 cols) */}
        <div className="lg:col-span-4 border-l border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 bg-slate-950/40 text-xs text-slate-400 flex justify-between items-center">
            <span className="font-bold text-slate-200">جهات الاتصال ({filteredLeads.length})</span>
            <span>مرتب حسب الأحدث</span>
          </div>

          <div className="divide-y divide-slate-800/80 overflow-y-auto flex-1 max-h-[500px]">
            {filteredLeads.map((lead) => {
              const isSelected = lead.id === selectedLead?.id;
              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`p-4 cursor-pointer transition-colors text-right ${
                    isSelected ? 'bg-slate-800/70 border-r-4 border-r-teal-500' : 'hover:bg-slate-950/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-white">{lead.name}</span>
                    <span className="text-[10px] text-slate-500">{lead.lastMessageTime}</span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-1 mb-2">{lead.lastMessage}</p>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[10px] uppercase">
                      {lead.platform}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      lead.status === 'won' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      lead.status === 'offer_sent' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      lead.status === 'interested' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {lead.status === 'won' ? 'صفقة مغلقة ✓' :
                       lead.status === 'offer_sent' ? 'تم إرسال عرض' :
                       lead.status === 'interested' ? 'مهتم' : 'عميل جديد'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Active Conversation & Lead CRM Info (8 cols) */}
        {selectedLead ? (
          <div className="lg:col-span-8 flex flex-col justify-between">
            {/* Lead Details Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold">
                  {selectedLead.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{selectedLead.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{selectedLead.phone || selectedLead.handle}</span>
                    <span>•</span>
                    <span className="uppercase font-mono text-teal-400">{selectedLead.platform}</span>
                  </div>
                </div>
              </div>

              {/* Status Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">مرحلة البيع:</span>
                <select
                  value={selectedLead.status}
                  onChange={(e) => updateLeadStatus(selectedLead.id, e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                >
                  <option value="new">عميل جديد (New)</option>
                  <option value="interested">مهتم (Interested)</option>
                  <option value="offer_sent">تم إرسال العرض (Offer Sent)</option>
                  <option value="won">تم البيع بنجاح (Deal Won)</option>
                  <option value="lost">غير مهتم / ملغي (Lost)</option>
                </select>
              </div>
            </div>

            {/* Conversation Window Mock */}
            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div className="text-center">
                <span className="text-[10px] bg-slate-950 px-3 py-1 rounded-full border border-slate-800 text-slate-500">
                  بداية المحادثة المؤتمتة عبر {selectedLead.platform}
                </span>
              </div>

              {/* Inbound Customer Message */}
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-300 shrink-0 font-bold">
                  {selectedLead.name.charAt(0)}
                </div>
                <div className="bg-slate-800 text-slate-100 p-3.5 rounded-2xl rounded-tr-sm text-sm max-w-[80%] leading-relaxed shadow">
                  <p>{(selectedLead.lastMessage || '').replace('أنت: ', '')}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block text-left">
                    {selectedLead.lastMessageTime || 'الآن'}
                  </span>
                </div>
              </div>

              {selectedLead.notes && (
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-teal-400" />
                  <span>ملاحظات الـ CRM: {selectedLead.notes}</span>
                </div>
              )}
            </div>

            {/* Reply and AI Suggestions Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleAiSuggestReply}
                  disabled={aiGenerating}
                  className="text-xs bg-teal-500/10 border border-teal-500/30 text-teal-300 hover:bg-teal-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {aiGenerating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري صياغة الرد الذكي محلياً...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>اقتراح رد ذكي للإغلاق والمتابعة</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] text-slate-500">جاهز للإرسال المباشر</span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendReply();
                  }}
                  placeholder="اكتب ردك هنا أو استخدم الاقتراح الذكي أعلاه..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim()}
                  className="bg-teal-600 hover:bg-teal-500 text-white p-2.5 rounded-xl transition-all disabled:opacity-50"
                  title="إرسال"
                >
                  <Send className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 flex items-center justify-center text-slate-500 text-sm">
            اختر جهة اتصال لعرض المحادثة
          </div>
        )}
      </div>
    </div>
  );
}
