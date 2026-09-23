import React, { useState } from 'react';
import { 
  PenTool, Sparkles, Copy, Check, Send, RefreshCw, 
  Share2, MessageCircle, Instagram, Facebook, Video, Twitter
} from 'lucide-react';
import { safeCopy } from '../utils/storage';

interface ContentStudioProps {
  onSendToCampaign?: (content: string, platform: string) => void;
}

export default function ContentStudio({ onSendToCampaign }: ContentStudioProps) {
  const [topic, setTopic] = useState('');
  const [dialect, setDialect] = useState('فصحى مبسطة');
  const [tone, setTone] = useState('حماسي ومحفز للتحويل (Direct Response)');
  const [targetAudience, setTargetAudience] = useState('أصحاب المتاجر والمشاريع الصغيرة');
  const [loading, setLoading] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const sampleTopics = [
    'خصم 40% على نظام إدارة الحملات والمحادثات بمناسبة نهاية الشهر',
    'كيف تضاعف مبيعات متجرك الإلكتروني عبر رسائل الواتساب الذكية',
    'إطلاق خدمة التوصيل السريع مجاناً لكافة الطلبات فوق 200 جنيه/ريال',
    'نصائح ذهبية لتجنب حظر حساباتك الإعلانية ومجموعات فيسبوك في 2026',
  ];

  const handleGenerate = async () => {
    if (!topic.trim() || loading) return;

    setLoading(true);
    setError('');
    setGeneratedOutput('');

    try {
      const res = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          dialect,
          tone,
          targetAudience,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'فشل توليد المحتوى التسويقي');
      }

      const data = await res.json();
      setGeneratedOutput(data.content || '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء استدعاء الذكاء الاصطناعي');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedOutput) return;
    await safeCopy(generatedOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <PenTool className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">استوديو صياغة المحتوى متعدد المنصات</h2>
            <p className="text-xs text-slate-400">
              اكتب فكرة واحدة وسيقوم الذكاء الاصطناعي بتوليد منشور فيسبوك، كابشن إنستغرام، رسالة واتساب، وسيناريو ريلز/تيك توك وتغريدة إكس دفعة واحدة.
            </p>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              فكرة المنشور أو تفاصيل العرض التسويقي:
            </label>
            <textarea
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="اكتب العرض، الفكرة، اسم المنتج، الخصم أو الميزة الرئيسية هنا بالتفصيل..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
            {/* Quick topics */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[11px] text-slate-500">أفكار جاهزة:</span>
              {sampleTopics.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTopic(s)}
                  className="text-[11px] bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 px-2.5 py-1 rounded-md transition-all text-right"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">اللهجة / اللغة:</label>
            <select
              value={dialect}
              onChange={(e) => setDialect(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="فصحى مبسطة">فصحى تسويقية مبسطة (عالمية)</option>
              <option value="مصرية عامية">لهجة مصرية عامية وجذابة</option>
              <option value="خليجية (سعودية/إماراتية)">لهجة خليجية بيضاء (سعودية/إماراتية)</option>
              <option value="شامية">لهجة شامية دافئة</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">نبرة الخطاب (Tone):</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="حماسي ومحفز للتحويل (Direct Response)">حماسي ومحفز للتحويل (Direct Response)</option>
              <option value="احترافي مؤسسي رصين">احترافي ومؤسسي رصين (B2B)</option>
              <option value="قصصي وتشويقي (Storytelling)">قصصي وتشويقي (Storytelling)</option>
              <option value="عرض عاجل وفوري (FOMO / Urgency)">عرض عاجل ومحدود الوقت (FOMO)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">الجمهور المستهدف:</label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="مثال: أصحاب المتاجر، شباب الجامعات، الأمهات..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>جاري صياغة المحتوى للمنصات...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>توليد المحتوى لجميع المنصات</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Generated Content Result */}
      {generatedOutput && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl animate-in fade-in duration-300">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-white text-base">المحتوى المتولد لكافة المنصات</h3>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Facebook className="w-4 h-4 text-blue-400" />
                <Instagram className="w-4 h-4 text-pink-400" />
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <Video className="w-4 h-4 text-violet-400" />
                <Twitter className="w-4 h-4 text-sky-400" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyToClipboard}
                className="text-xs bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">تم النسخ بالكامل</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ الكل</span>
                  </>
                )}
              </button>

              {onSendToCampaign && (
                <button
                  onClick={() => onSendToCampaign(generatedOutput, 'facebook')}
                  className="text-xs bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال لجدولة الحملة</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-950 rounded-xl p-5 border border-slate-800/80 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-sans max-h-[500px] overflow-y-auto">
            {generatedOutput}
          </div>
        </div>
      )}
    </div>
  );
}
