import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, Send, User, Sparkles, RefreshCw, Trash2, Copy, Check, 
  Settings2, ShieldAlert, Cpu, Zap, Brain, MessageSquare
} from 'lucide-react';
import { CHATBOT_ROLES } from '../data/mockData';
import { ChatMessage } from '../types';
import { safeGetStorage, safeSetStorage, safeCopy } from '../utils/storage';

export default function AiChatbot() {
  const [selectedRole, setSelectedRole] = useState(CHATBOT_ROLES[0].id);
  const [selectedModel, setSelectedModel] = useState<'reasoning' | 'balanced' | 'fast'>('balanced');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const initialWelcomeMessage: ChatMessage = {
    id: 'msg_welcome',
    role: 'model',
    text: 'مرحباً بك في غرفة القيادة التسويقية لـ Orbit Marketing OS! أنا مساعدك الذكي متعدد الأدوار. يمكنك استشارتي في تخطيط الحملات، صياغة نصوص إعلانية محوّلة، ضبط بروتوكولات حماية الحسابات من الحظر، وإغلاق صفقات المبيعات.',
    timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    modelUsed: 'ollama-local',
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return safeGetStorage<ChatMessage[]>('orbit_chat_history', [initialWelcomeMessage]);
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentRole = CHATBOT_ROLES.find(r => r.id === selectedRole) || CHATBOT_ROLES[0];

  useEffect(() => {
    safeSetStorage('orbit_chat_history', messages);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRoleChange = (roleId: string) => {
    setSelectedRole(roleId);
    const roleObj = CHATBOT_ROLES.find(r => r.id === roleId);
    if (roleObj) {
      setSelectedModel(roleObj.recommendedModel);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setLoading(true);

    try {
      // Send conversation history to the server-side proxy
      const payloadMessages = updatedMessages.map(m => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          roleId: selectedRole,
          customSystemInstruction: customPrompt,
          profile: selectedModel,
        }),
      });

      if (!res.ok) {
        let errMessage = 'فشل الاتصال بالذكاء الاصطناعي';
        try {
          const errData = await res.json();
          if (errData?.error) errMessage = errData.error;
        } catch {
          // ignore json parse error
        }
        throw new Error(errMessage);
      }

      const data = await res.json();
      const botMessage: ChatMessage = {
        id: `bot_${Date.now()}`,
        role: 'model',
        text: data.text || 'عذراً، لم أتلقَ رداً واضحاً.',
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.modelUsed || 'ollama-local',
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء معالجة الطلب.';
      const errorMessage: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'model',
        text: `⚠️ تنبيه: ${message}`,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'ollama-local',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    await safeCopy(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const executeClearChat = () => {
    const resetMsg: ChatMessage[] = [
      {
        id: `msg_${Date.now()}`,
        role: 'model',
        text: `تم بدء جلسة جديدة كـ "${currentRole.name}". كيف يمكنني خدمتك في حملاتك التسويقية اليوم؟`,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        modelUsed: selectedModel,
      }
    ];
    setMessages(resetMsg);
    safeSetStorage('orbit_chat_history', resetMsg);
    setShowClearConfirm(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Top Bar: Roles & Model Configuration */}
      <div className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-bold">
              <Bot className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-white text-lg">{currentRole.name}</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  {currentRole.badge}
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-1">{currentRole.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Model Selector Badge */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedModel('reasoning')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-medium ${
                  selectedModel === 'reasoning'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="وضع التفكير للمهام المعقدة والتخطيط"
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Reasoning</span>
                <span className="text-[10px] opacity-75 hidden sm:inline">(مهام معقدة)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedModel('balanced')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-medium ${
                  selectedModel === 'balanced'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="الوضع المتوازن للمحتوى والمهام العامة"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Balanced</span>
                <span className="text-[10px] opacity-75 hidden sm:inline">(عام)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedModel('fast')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-medium ${
                  selectedModel === 'fast'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="الوضع السريع للمهام القصيرة"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Fast</span>
                <span className="text-[10px] opacity-75 hidden sm:inline">(سريع)</span>
              </button>
            </div>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-xl border transition-all ${
                showSettings 
                  ? 'bg-slate-800 border-slate-700 text-white' 
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="تخصيص تعليمات الدور والنظام"
            >
              <Settings2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowClearConfirm(true)}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-900/50 transition-all"
              title="مسح سجل المحادثة"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Roles Quick Switch Bar */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-500 whitespace-nowrap">تبديل دور الروبوت:</span>
          {CHATBOT_ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => handleRoleChange(role.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                selectedRole === role.id
                  ? 'bg-slate-800 text-emerald-400 border-emerald-500/30 font-semibold'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>{role.name}</span>
            </button>
          ))}
        </div>

        {/* Custom System Instruction Drawer */}
        {showSettings && (
          <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
                تخصيص تعليمات النظام (System Instruction):
              </span>
              <span className="text-[11px] text-slate-400">تُحقن تلقائياً مع دور {currentRole.name}</span>
            </div>
            <textarea
              rows={2}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="أضف معلومات خاصة عن متجرك، منتجاتك، أسعارك، أو أسلوب التواصل الذي تفضله (اختياري)..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none text-xs"
            />
          </div>
        )}
      </div>

      {/* Scrollable Chat Thread */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                  isUser
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-slate-800 border border-slate-700 text-emerald-400'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-md transition-all ${
                  isUser
                    ? 'bg-emerald-600 text-white rounded-tl-sm'
                    : 'bg-slate-950/80 border border-slate-800 text-slate-200 rounded-tr-sm'
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed font-sans">{msg.text}</div>

                <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>{msg.timestamp}</span>
                    {msg.modelUsed && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-emerald-400">
                        {msg.modelUsed}
                      </span>
                    )}
                  </div>
                  {!isUser && (
                    <button
                      onClick={() => handleCopy(msg.text, msg.id)}
                      className="hover:text-emerald-400 transition-colors flex items-center gap-1"
                      title="نسخ النص"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-[10px] text-emerald-400">تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span className="text-[10px]">نسخ</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-slate-400 flex items-center gap-3">
              <div className="flex gap-1.5 items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]"></span>
              </div>
              <span className="text-xs">جاري التفكير وصياغة الاستجابة عبر {selectedModel}...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Starter Prompts Bar */}
      <div className="bg-slate-950/70 border-t border-slate-800/80 px-4 py-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-500 shrink-0 font-medium">أسئلة مقترحة:</span>
          {currentRole.starterPrompts.map((prompt, idx) => (
            <button
              key={idx}
              disabled={loading}
              onClick={() => handleSendMessage(prompt)}
              className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-slate-700 whitespace-nowrap text-xs transition-all disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Input Field */}
      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`اطرح سؤالك أو اطلب خطة تسويقية من ${currentRole.name}...`}
              disabled={loading}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm disabled:opacity-50 pr-4 pl-10"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">
              {selectedModel}
            </div>
          </div>

          <button
            type="submit"
            disabled={!inputMessage.trim() || loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20 shrink-0"
            title="إرسال"
          >
            <Send className="w-5 h-5 rtl:rotate-180" />
          </button>
        </form>
      </div>

      {/* Confirmation Modal for Clearing Chat */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">مسح سجل المحادثة؟</h3>
              <p className="text-xs text-slate-400 mt-1">
                سيتم حذف الرسائل السابقة وبدء جلسة جديدة مع {currentRole.name}. لن تتمكن من استرجاع الرسائل.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={executeClearChat}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/20"
              >
                تأكيد المسح
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
