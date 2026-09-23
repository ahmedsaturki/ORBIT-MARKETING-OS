import React, { useState } from 'react';
import { 
  PenTool, Sparkles, Copy, Check, Send, RefreshCw, 
  Share2, MessageCircle, Instagram, Facebook, Video, Twitter,
  Image as ImageIcon, Folder, Tag, Search, Plus, Repeat, CheckCircle2, ArrowRight
} from 'lucide-react';
import { safeCopy } from '../utils/storage';
import { INITIAL_MEDIA_ASSETS } from '../data/mockData';
import { MediaAsset } from '../types';

interface ContentStudioProps {
  onSendToCampaign?: (content: string, platform: string) => void;
}

export default function ContentStudio({ onSendToCampaign }: ContentStudioProps) {
  const [activeSubTab, setActiveSubTab] = useState<'generator' | 'dam' | 'recycling'>('generator');

  // Generator states
  const [topic, setTopic] = useState('');
  const [dialect, setDialect] = useState('فصحى مبسطة');
  const [tone, setTone] = useState('حماسي ومحفز للتحويل (Direct Response)');
  const [targetAudience, setTargetAudience] = useState('أصحاب المتاجر والمشاريع الصغيرة');
  const [aiEngine, setAiEngine] = useState<'gemini_cloud' | 'ollama_llama3' | 'ollama_arabert'>('gemini_cloud');
  const [loading, setLoading] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Media DAM states
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>(INITIAL_MEDIA_ASSETS);
  const [searchMedia, setSearchMedia] = useState('');
  const [mediaCategory, setMediaCategory] = useState('all');
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);

  // Content recycling states
  const [recyclingInput, setRecyclingInput] = useState(
    'عالم التسويق الرقمي يتغير بسرعة، وتكرار نفس الرسالة لكل العملاء هو أكبر سبب لضعف المبيعات. التخصيص والمتابعة الفورية على واتساب هما سر النجاح اليوم.'
  );
  const [recycledResults, setRecycledResults] = useState<{
    tweet: string;
    reelScript: string;
    whatsapp: string;
    fbPost: string;
  } | null>(null);

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
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ أثناء استدعاء الذكاء الاصطناعي');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    if (!text) return;
    await safeCopy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunRecycle = () => {
    setRecycledResults({
      tweet: `السر ليس في كثرة الإعلانات، بل في تخصيص الرسالة ومتابعة العميل فوراً! 💡\n\nتكرار نفس الكلام = مبيعات ضعيفة.\nأتمتة ذكية + رد شخصي = تحويل 300% 🚀\n\n#تسويق_رقمي #مبيعات #تجارة_إلكترونية`,
      reelScript: `[المشهد 1: تصوير شاشة الموبايل مع إشعارات متراكمة]\nالخطاف (أول ثانيتين): "ليه إعلاناتك شغالة ومبيعاتك لسه واقفة مكانها؟"\n[المشهد 2: شرح سريع 10 ثوانٍ]\n"لأنك بتبعت نفس الرسالة الجافة لكل الناس! العميل محتاج يحس إنك بتكلمه هو شخصياً."\n[المشهد 3: الحل والدعوة للإجراء]\n"جرب نظام المتابعة المؤتمتة على واتساب وشوف الفرق بنفسك. اكتب 'أتمتة' في التعليقات لأرسل لك التجربة مجاناً!"`,
      whatsapp: `*أهلاً بك يا غالي!* 🌟\n\nلاحظت أن أغلب المتاجر تفقد أكثر من 60% من عملائها بسبب تأخر الرد وعدم التخصيص.\n\nجهزنا لك دليلاً مجانياً سريعاً لكيفية مضاعفة تحويل محادثات الواتساب إلى مبيعات مؤكدة في 3 خطوات عملية.\n\nاضغط هنا لمعرفة التفاصيل: https://orbit.io/guide`,
      fbPost: `هل تلاحظ أن تكلفة الإعلانات في صعود مستمر بينما المبيعات لا تتناسب مع هذا الصرف؟ 📉\n\nالسبب الحقيقي الذي يغفل عنه 90% من المسوقين هو غياب "التخصيص الفوري". العميل الحديث لا ينتظر 4 ساعات لترد عليه، بل ينتقل للمنافس فوراً.\n\nنظام Orbit Marketing OS يمنحك القوة لأتمتة محادثاتك وحملاتك بدون مخاطر الحظر وبمحاكاة بشرية ذكية.\n\n👇 شاركنا في التعليقات: ما هي أكبر منصة تجلب لك مبيعات حالياً؟`
    });
  };

  return (
    <div className="space-y-6">
      {/* Main Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">استوديو صياغة المحتوى وإدارة الأصول (Content Studio & DAM)</h2>
              <p className="text-xs text-slate-400">
                توليد محتوى متعدد المنصات، مكتبة وسائط محلية مشفرة، ونظام إعادة تدوير المنشورات الرابحة.
              </p>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('generator')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'generator'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>المولد الفوري</span>
            </button>

            <button
              onClick={() => setActiveSubTab('dam')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'dam'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>مكتبة الوسائط (DAM)</span>
            </button>

            <button
              onClick={() => setActiveSubTab('recycling')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeSubTab === 'recycling'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>إعادة تدوير المحتوى</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: Generator */}
      {activeSubTab === 'generator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Form (5 Cols) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 h-fit">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>إعدادات الصياغة والجمهور المستهدف</span>
            </h3>

            {/* AI Engine Selection */}
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1.5">محرك الذكاء الاصطناعي (AI Engine):</label>
              <select
                value={aiEngine}
                onChange={(e) => setAiEngine(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-emerald-400 font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="gemini_cloud">Google Gemini 3.5 Flash (سريع ودقيق)</option>
                <option value="ollama_llama3">محلي: Local Ollama (Llama 3.1 8B - Offline)</option>
                <option value="ollama_arabert">محلي: AraBERT & Jais-13b (مخصص للهجات العربية)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1.5">موضوع المنشور أو العرض *</label>
              <textarea
                rows={3}
                placeholder="اكتب فكرة الإعلان، العرض، أو الرسالة الرئيسية..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Quick Prompts */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 block mb-1.5">أفكار ومواضيع سريعة:</span>
              <div className="space-y-1.5">
                {sampleTopics.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTopic(s)}
                    className="w-full text-right text-[11px] text-slate-300 hover:text-emerald-400 bg-slate-950 hover:bg-slate-800/80 p-2 rounded-xl border border-slate-800/80 transition-colors truncate block"
                  >
                    • {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">اللهجة</label>
                <select
                  value={dialect}
                  onChange={(e) => setDialect(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white focus:outline-none"
                >
                  <option value="فصحى مبسطة">فصحى مبسطة</option>
                  <option value="مصرية دارجة">لهجة مصرية</option>
                  <option value="خليجية بيضاء">لهجة خليجية</option>
                  <option value="شامية راقية">لهجة شامية</option>
                  <option value="مغاربية">لهجة مغاربية</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">النبرة (Tone)</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white focus:outline-none"
                >
                  <option value="حماسي ومحفز للتحويل (Direct Response)">حماسي ومحفز للتحويل</option>
                  <option value="احترافي ورسمي (B2B)">احترافي ومؤسسي</option>
                  <option value="ودود وفكاهي خفيف">ودود وعفوي</option>
                  <option value="ملح ومحدود بالوقت (FOMO)">شعور بالندرة والسرعة</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !topic.trim()}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 mt-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{loading ? 'جاري توليد الصيغ المتعددة...' : 'توليد المحتوى لكافة المنصات الآن'}</span>
            </button>
          </div>

          {/* Generated Result Display (7 Cols) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">المحتوى المولد مخصص لكل منصة:</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400">
                  5 صيغ تسويقية جاهزة
                </span>
              </div>

              {generatedOutput && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(generatedOutput)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-bold"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'تم النسخ' : 'نسخ الكل'}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-4 min-h-[360px] max-h-[550px] overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs py-16 space-y-3">
                  <RefreshCw className="w-7 h-7 animate-spin text-emerald-400" />
                  <p>الذكاء الاصطناعي يصوغ المحتوى الآن وفق الخصائص الثقافية لكل منصة...</p>
                </div>
              ) : generatedOutput ? (
                <div className="prose prose-invert prose-xs max-w-none text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {generatedOutput}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs py-20 space-y-2">
                  <PenTool className="w-8 h-8 text-slate-700" />
                  <p>أدخل فكرة إعلانك على اليمين ثم اضغط "توليد المحتوى" للحصول على الصيغ فوراً.</p>
                </div>
              )}
            </div>

            {generatedOutput && onSendToCampaign && (
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">نقل النص مباشرة إلى:</span>
                <button
                  onClick={() => onSendToCampaign(generatedOutput, 'facebook')}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1.5 hover:bg-emerald-400 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال لجدول الحملات (Campaign Hub)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Digital Asset Management (DAM) */}
      {activeSubTab === 'dam' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Folder className="w-4 h-4 text-emerald-400" />
                <span>مكتبة الأصول الرقمية المحلية (Local Media DAM)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                تخزين محلي مشفر للتصاميم، مقاطع الفيديو، والشعارات مع وسم سريع وفلترة لسهولة إرفاقها بالحملات.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="بحث في الوسائط..."
                value={searchMedia}
                onChange={(e) => setSearchMedia(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {mediaAssets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => setSelectedAsset(asset)}
                className={`bg-slate-950 rounded-2xl border overflow-hidden cursor-pointer transition-all ${
                  selectedAsset?.id === asset.id ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="h-36 bg-slate-900 relative overflow-hidden flex items-center justify-center">
                  <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-950/80 text-white border border-slate-700">
                    {asset.type}
                  </span>
                </div>

                <div className="p-3 space-y-2">
                  <h4 className="text-xs font-bold text-white truncate">{asset.name}</h4>
                  <div className="flex flex-wrap gap-1">
                    {asset.tags.map((t, i) => (
                      <span key={i} className="text-[9px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded">
                        #{t}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900 font-mono">
                    <span>{asset.category}</span>
                    <span>{asset.sizeMb} MB</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Content Recycling */}
      {activeSubTab === 'recycling' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Repeat className="w-4 h-4 text-emerald-400" />
              <span>إعادة تدوير المحتوى الرابح (Content Recycling Engine)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              ضع أي منشور قديم حقق تفاعلاً عالياً، وسيقوم المحرك بإعادة كتابته في 4 صيغ جديدة تماماً: تغريدة إكس، سيناريو ريلز/تيك توك 30 ثانية، رسالة برودكاست واتساب، ومنشور فيسبوك تفاعلي.
            </p>
          </div>

          <div className="space-y-3">
            <textarea
              rows={3}
              value={recyclingInput}
              onChange={(e) => setRecyclingInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
              placeholder="الصق هنا النص أو المنشور المراد إعادة تدويره..."
            />

            <button
              onClick={handleRunRecycle}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
            >
              <Repeat className="w-4 h-4" />
              <span>إعادة تدوير إلى 4 قوالب جديدة</span>
            </button>
          </div>

          {recycledResults && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-cyan-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Twitter className="w-3.5 h-3.5" />
                    تغريدة إكس مكثفة
                  </span>
                  <button onClick={() => copyToClipboard(recycledResults.tweet)} className="text-[10px] text-slate-400 hover:text-white">نسخ</button>
                </div>
                <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">{recycledResults.tweet}</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-purple-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5" />
                    سيناريو ريلز / تيك توك 30 ثانية
                  </span>
                  <button onClick={() => copyToClipboard(recycledResults.reelScript)} className="text-[10px] text-slate-400 hover:text-white">نسخ</button>
                </div>
                <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">{recycledResults.reelScript}</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-emerald-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" />
                    رسالة واتساب مباشرة
                  </span>
                  <button onClick={() => copyToClipboard(recycledResults.whatsapp)} className="text-[10px] text-slate-400 hover:text-white">نسخ</button>
                </div>
                <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">{recycledResults.whatsapp}</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-blue-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Facebook className="w-3.5 h-3.5" />
                    منشور فيسبوك تفاعلي
                  </span>
                  <button onClick={() => copyToClipboard(recycledResults.fbPost)} className="text-[10px] text-slate-400 hover:text-white">نسخ</button>
                </div>
                <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">{recycledResults.fbPost}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
