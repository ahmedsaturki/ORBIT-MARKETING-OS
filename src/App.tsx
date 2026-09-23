import React, { useState } from 'react';
import { 
  Bot, Image as ImageIcon, PenTool, Rocket, Inbox, 
  ShieldCheck, Users, Database, Sparkles, Activity, 
  Terminal, Laptop, Lock, Globe, ExternalLink
} from 'lucide-react';

import AiChatbot from './components/AiChatbot';
import ImageAnalysisStudio from './components/ImageAnalysisStudio';
import ContentStudio from './components/ContentStudio';
import CampaignHub from './components/CampaignHub';
import UnifiedInbox from './components/UnifiedInbox';
import SafetyShield from './components/SafetyShield';
import AccountsManager from './components/AccountsManager';
import LocalArchitecture from './components/LocalArchitecture';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'vision' | 'content' | 'campaigns' | 'inbox' | 'safety' | 'accounts' | 'architecture'>('chat');

  const handleSendContentToCampaign = (content: string, platform: string) => {
    setActiveTab('campaigns');
  };

  const navItems = [
    { id: 'chat', label: 'المساعد الذكي (AI Chatbot)', icon: Bot, badge: 'متعدد الأدوار' },
    { id: 'vision', label: 'تحليل الإعلانات (Vision AI)', icon: ImageIcon, badge: '3.1 Pro' },
    { id: 'content', label: 'استوديو المحتوى', icon: PenTool },
    { id: 'campaigns', label: 'إدارة الحملات والجدولة', icon: Rocket },
    { id: 'inbox', label: 'صندوق المحادثات والـ CRM', icon: Inbox },
    { id: 'safety', label: 'درع الحماية وقاطع الدائرة', icon: ShieldCheck, badge: 'Safety' },
    { id: 'accounts', label: 'الحسابات الاجتماعية', icon: Users },
    { id: 'architecture', label: 'الهندسة والتسعير', icon: Database },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Main Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-black text-xl tracking-wider">
                O
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-lg tracking-tight text-white">ORBIT MARKETING OS</h1>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                    v2.4.1 Local-First
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">منصة تشغيل تسويق وأتمتة شاملة متعددة القنوات</p>
              </div>
            </div>

            {/* Quick Status Badges */}
            <div className="hidden lg:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-slate-300 font-medium">الوكيل المحلي:</span>
                <span className="text-emerald-400 font-mono font-bold">وضع الويب التجريبي</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300 font-medium">قاطع الدائرة:</span>
                <span className="text-emerald-400 font-bold">نشط وآمن (96%)</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
                <Lock className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-slate-300 font-medium">الجلسات:</span>
                <span className="text-purple-300 font-mono font-semibold">التخزين الحساس: مشفّر محلياً</span>
              </div>
            </div>
          </div>

          {/* Sub Navigation Bar Tabs */}
          <nav className="flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-800/60 no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {'badge' in item && item.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                        isActive
                          ? 'bg-slate-950/20 text-slate-950 font-bold'
                          : 'bg-slate-800 text-emerald-400 border border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main App Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'chat' && <AiChatbot />}
        {activeTab === 'vision' && <ImageAnalysisStudio />}
        {activeTab === 'content' && <ContentStudio onSendToCampaign={handleSendContentToCampaign} />}
        {activeTab === 'campaigns' && <CampaignHub />}
        {activeTab === 'inbox' && <UnifiedInbox />}
        {activeTab === 'safety' && <SafetyShield />}
        {activeTab === 'accounts' && <AccountsManager />}
        {activeTab === 'architecture' && <LocalArchitecture />}
      </main>

      {/* Platform Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 text-slate-500 text-xs py-4 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
          <div>
            Orbit Marketing OS — منصة تشغيل تسويق وأتمتة متكاملة • Local-First • بدون خوادم مركزية • خصوصية مطلقة 100%
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>الذكاء الاصطناعي: مزود محلي عبر Ollama (النموذج قابل للتهيئة)</span>
            <span>•</span>
            <span className="text-emerald-400 font-mono">حالة النظام: طبقة الواجهة جاهزة</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
