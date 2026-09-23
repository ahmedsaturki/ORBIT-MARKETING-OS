import React, { useState } from 'react';
import { 
  Users, UserPlus, Search, Filter, Phone, 
  Mail, Tag, Calendar, DollarSign, ArrowUpRight, 
  Clock, CheckCircle2, Trash2, Edit3, MessageSquare, 
  Sparkles, Download, Upload, Plus
} from 'lucide-react';
import { INITIAL_LEADS } from '../data/mockData';
import { ContactLead, Platform } from '../types';
import { safeGetStorage, safeSetStorage } from '../utils/storage';

interface CrmPipelineProps {
  onOpenChatWithLead?: (lead: ContactLead) => void;
}

const STAGES: { id: ContactLead['status']; label: string; color: string }[] = [
  { id: 'new', label: 'عميل جديد (New)', color: 'border-blue-500/40 text-blue-400 bg-blue-500/10' },
  { id: 'interested', label: 'مهتم بالخدمة (Interested)', color: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10' },
  { id: 'potential', label: 'عميل محتمل (Potential)', color: 'border-purple-500/40 text-purple-400 bg-purple-500/10' },
  { id: 'offer_sent', label: 'تم إرسال عرض (Offer Sent)', color: 'border-amber-500/40 text-amber-400 bg-amber-500/10' },
  { id: 'won', label: 'تمت الصفقة (Won)', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' },
  { id: 'lost', label: 'صفقة ملغية (Lost)', color: 'border-rose-500/40 text-rose-400 bg-rose-500/10' },
];

export default function CrmPipeline({ onOpenChatWithLead }: CrmPipelineProps) {
  const [leads, setLeads] = useState<ContactLead[]>(() => {
    return safeGetStorage<ContactLead[]>('orbit_leads', INITIAL_LEADS);
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<ContactLead | null>(leads[0] || null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // New Lead form state
  const [newName, setNewName] = useState('');
  const [newPlatform, setNewPlatform] = useState<Platform>('whatsapp');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newValue, setNewValue] = useState(199);
  const [newNotes, setNewNotes] = useState('');
  const [newTags, setNewTags] = useState('');

  const saveLeads = (newLeads: ContactLead[]) => {
    setLeads(newLeads);
    safeSetStorage('orbit_leads', newLeads);
  };

  const showToast = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 3000);
  };

  const handleAddLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const lead: ContactLead = {
      id: `lead_${Date.now()}`,
      name: newName.trim(),
      platform: newPlatform,
      phone: newPhone.trim() || undefined,
      email: newEmail.trim() || undefined,
      status: 'new',
      source: 'إدخال يدوي مباشر',
      tags: newTags ? newTags.split(',').map(t => t.trim()).filter(Boolean) : ['عميل مباشر'],
      lastMessage: 'تم إنشاء العميل يدوياً',
      lastMessageTime: 'الآن',
      unread: false,
      value: Number(newValue) || 0,
      notes: newNotes.trim() || undefined,
      history: [
        {
          id: `h_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          type: 'status_change',
          text: 'تمت إضافة جهة الاتصال إلى النظام'
        }
      ]
    };

    const updated = [lead, ...leads];
    saveLeads(updated);
    setSelectedLead(lead);
    setShowAddModal(false);
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewNotes('');
    setNewTags('');
    showToast('تمت إضافة العميل إلى خط الأنابيب (CRM Pipeline) بنجاح.');
  };

  const updateLeadStatus = (id: string, newStatus: ContactLead['status']) => {
    const updated = leads.map(l => {
      if (l.id === id) {
        const historyItem = {
          id: `h_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          type: 'status_change' as const,
          text: `تم تغيير الحالة إلى: ${STAGES.find(s => s.id === newStatus)?.label}`
        };
        return {
          ...l,
          status: newStatus,
          history: [...(l.history || []), historyItem]
        };
      }
      return l;
    });

    saveLeads(updated);
    if (selectedLead?.id === id) {
      setSelectedLead(updated.find(l => l.id === id) || null);
    }
    showToast('تم تحديث مرحلة العميل وسجل النشاط.');
  };

  const handleDeleteLead = (id: string) => {
    const updated = leads.filter(l => l.id !== id);
    saveLeads(updated);
    setSelectedLead(updated[0] || null);
    showToast('تم حذف العميل من قاعدة البيانات المحلية.');
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = 
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.phone && l.phone.includes(searchQuery)) ||
      (l.email && l.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.tags && l.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesPlatform = filterPlatform === 'all' || l.platform === filterPlatform;
    const matchesStage = filterStage === 'all' || l.status === filterStage;

    return matchesSearch && matchesPlatform && matchesStage;
  });

  const totalPipelineValue = leads.reduce((sum, l) => sum + (l.value || 0), 0);
  const wonValue = leads.filter(l => l.status === 'won').reduce((sum, l) => sum + (l.value || 0), 0);

  const exportContactsCsv = () => {
    const headers = ['Name', 'Platform', 'Phone', 'Email', 'Status', 'Value', 'Tags', 'Notes'];
    const rows = leads.map(l => [
      `"${l.name}"`,
      l.platform,
      `"${l.phone || ''}"`,
      `"${l.email || ''}"`,
      l.status,
      l.value || 0,
      `"${(l.tags || []).join(', ')}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `orbit_crm_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('تم تصدير ملف العملاء CSV بنجاح.');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-white">إدارة علاقات العملاء وخط الصفقات (Built-in CRM)</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                Local-First Database
              </span>
            </div>
            <p className="text-xs text-slate-400">
              تتبع جميع العملاء المحتملين القادمين من إعلانات فيسبوك، رسائل واتساب، إنستغرام، وتليجرام في مكان واحد مع سجل كامل للاتصالات.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportContactsCsv}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير CSV</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة عميل جديد</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
            <span className="text-[11px] text-slate-400">إجمالي جهات الاتصال</span>
            <div className="text-lg font-black text-white mt-0.5 font-mono">{leads.length} عميل</div>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
            <span className="text-[11px] text-slate-400">قيمة الفرص بالأنبوب</span>
            <div className="text-lg font-black text-emerald-400 mt-0.5 font-mono">${totalPipelineValue.toLocaleString()}</div>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
            <span className="text-[11px] text-slate-400">مبيعات مكتملة (Won)</span>
            <div className="text-lg font-black text-cyan-400 mt-0.5 font-mono">${wonValue.toLocaleString()}</div>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60">
            <span className="text-[11px] text-slate-400">معدل التحويل التقديري</span>
            <div className="text-lg font-black text-purple-400 mt-0.5 font-mono">
              {leads.length > 0 ? Math.round((leads.filter(l => l.status === 'won').length / leads.length) * 100) : 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث بالاسم، رقم الهاتف، الإيميل، أو الوسم (Tag)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">كافة المنصات</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="telegram">Telegram</option>
            <option value="linkedin">LinkedIn</option>
          </select>

          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">كافة المراحل</option>
            {STAGES.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main CRM Layout: Contacts List & Contact Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Leads Table / List */}
        <div className="lg:col-span-2 space-y-3">
          {filteredLeads.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
              لا توجد جهات اتصال تطابق معايير البحث الحالية.
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const stage = STAGES.find(s => s.id === lead.status) || STAGES[0];
              const isSelected = selectedLead?.id === lead.id;

              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={`bg-slate-900 border rounded-2xl p-4 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isSelected ? 'border-emerald-500 bg-slate-900/90 shadow-lg shadow-emerald-500/5' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 font-bold flex items-center justify-center text-sm shrink-0">
                      {lead.name.charAt(0)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{lead.name}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-800 text-slate-300 border border-slate-700">
                          {lead.platform}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        {lead.phone && <span>{lead.phone}</span>}
                        {lead.email && <span>• {lead.email}</span>}
                        {lead.source && <span className="text-slate-500">• المصدر: {lead.source}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-between sm:justify-end">
                    {lead.value ? (
                      <div className="text-left font-mono font-bold text-emerald-400 text-xs">
                        ${lead.value}
                      </div>
                    ) : null}

                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${stage.color}`}>
                      {stage.label.split('(')[0]}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right 1 Col: Selected Lead Detail Drawer */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl h-fit space-y-5 sticky top-20">
          {selectedLead ? (
            <>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">{selectedLead.name}</h3>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="uppercase font-bold text-emerald-400">{selectedLead.platform}</span>
                    <span>• القيمة: ${selectedLead.value || 0}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteLead(selectedLead.id)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                  title="حذف العميل"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Stage Transition Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1.5">مرحلة العميل الحالية:</label>
                <select
                  value={selectedLead.status}
                  onChange={(e) => updateLeadStatus(selectedLead.id, e.target.value as ContactLead['status'])}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                >
                  {STAGES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 text-xs text-slate-300 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                {selectedLead.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-mono">{selectedLead.phone}</span>
                  </div>
                )}
                {selectedLead.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>{selectedLead.email}</span>
                  </div>
                )}
                {selectedLead.notes && (
                  <div className="pt-2 border-t border-slate-800/80 text-slate-400 text-[11px] leading-relaxed">
                    <strong className="text-slate-300 block mb-0.5">ملاحظات:</strong>
                    {selectedLead.notes}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-1.5">الوسوم والتصنيفات:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedLead.tags || []).map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-lg text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Communication Timeline */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-2">سجل الأنشطة والتواصل:</span>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(selectedLead.history || []).map((h) => (
                    <div key={h.id} className="text-[11px] bg-slate-950 p-2.5 rounded-lg border border-slate-800/60">
                      <div className="flex justify-between text-slate-500 text-[10px] mb-0.5">
                        <span>{h.type}</span>
                        <span>{h.timestamp}</span>
                      </div>
                      <p className="text-slate-300">{h.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              {onOpenChatWithLead && (
                <button
                  onClick={() => onOpenChatWithLead(selectedLead)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>فتح المحادثة في الصندوق الموحد</span>
                </button>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              حدد عميلاً من القائمة لعرض التفاصيل وسجل المتابعة.
            </div>
          )}
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>إضافة عميل جديد لخط الصفقات</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddLead} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">اسم العميل / الشركة *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: شركة النور للتجارة"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">المنصة</label>
                  <select
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value as Platform)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="telegram">Telegram</option>
                    <option value="linkedin">LinkedIn</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">قيمة الصفقة المتوقعة ($)</label>
                  <input
                    type="number"
                    value={newValue}
                    onChange={(e) => setNewValue(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">رقم الهاتف / الواتساب</label>
                  <input
                    type="text"
                    placeholder="+9665..."
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    placeholder="client@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">الوسوم (مفصولة بفواصل)</label>
                <input
                  type="text"
                  placeholder="B2B, متجر إلكتروني, مهتم بـ Pro"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">ملاحظات العميل</label>
                <textarea
                  rows={2}
                  placeholder="أي تفاصيل عن اهتمام العميل وميزانيته..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/20"
                >
                  حفظ العميل
                </button>
              </div>
            </form>
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
