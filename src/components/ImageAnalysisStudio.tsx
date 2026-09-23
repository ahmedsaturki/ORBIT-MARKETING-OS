import React, { useState } from 'react';
import { 
  UploadCloud, Image as ImageIcon, Sparkles, CheckCircle, 
  AlertTriangle, Copy, Check, Eye, RefreshCw, Layers, Target, Compass
} from 'lucide-react';
import { SAMPLE_MARKETING_IMAGES } from '../data/mockData';
import { safeCopy } from '../utils/storage';

export default function ImageAnalysisStudio() {
  const [selectedImage, setSelectedImage] = useState<string>(SAMPLE_MARKETING_IMAGES[0].dataUri);
  const [selectedTitle, setSelectedTitle] = useState<string>(SAMPLE_MARKETING_IMAGES[0].title);
  const [analysisType, setAnalysisType] = useState<'comprehensive' | 'ad_critique' | 'ocr_copy' | 'platform_fit'>('ad_critique');
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [modelUsed, setModelUsed] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('يرجى اختيار ملف صورة صالح (JPEG, PNG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setSelectedImage(event.target.result as string);
        setSelectedTitle(file.name);
        setAnalysisResult('');
        setErrorMsg('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSample = (sample: typeof SAMPLE_MARKETING_IMAGES[0]) => {
    setSelectedImage(sample.dataUri);
    setSelectedTitle(sample.title);
    setAnalysisResult('');
    setErrorMsg('');
  };

  const runAnalysis = async () => {
    if (!selectedImage || loading) return;

    setLoading(true);
    setErrorMsg('');
    setAnalysisResult('');

    try {
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: selectedImage,
          analysisType,
          prompt: customPrompt,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'فشل تحليل الصورة عبر نموذج الذكاء الاصطناعي');
      }

      const data = await res.json();
      setAnalysisResult(data.analysis || 'تم اكتمال الفحص بنجاح بدون تفاصيل إضافية.');
      setModelUsed(data.modelUsed || 'ollama-local');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء التواصل مع نموذج تحليل الصور.');
    } finally {
      setLoading(false);
    }
  };

  const copyResult = async () => {
    if (!analysisResult) return;
    await safeCopy(analysisResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900/40 via-slate-900 to-slate-900 border border-purple-500/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                مدعوم بنموذج رؤية محلي عبر Ollama (اختياري)
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white">استوديو تحليل وتدقيق الإعلانات والصور</h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              ارفع أي بوستر إعلاني، صورة منتج، أو لقطة شاشة لحملتك التسويقية لتحليل النصوص والجاذبية البصرية وتقديم اقتراحات فورية لرفع معدل التحويل (CTR & CRO).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-purple-600/20">
              <UploadCloud className="w-4 h-4" />
              <span>رفع صورة من جهازك</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {/* Grid: Left Image & Samples, Right: Analysis Options & Result */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image Preview & Sample Selector (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-purple-400" />
                معاينة الصورة الحالية
              </span>
              <span className="truncate max-w-[200px] text-slate-500">{selectedTitle}</span>
            </div>

            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center p-2 group">
              <img
                src={selectedImage}
                alt="Selected preview"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>

            {/* Quick Upload Alternative */}
            <div className="mt-3 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">تغيير الصورة:</span>
              <label className="text-purple-400 hover:text-purple-300 cursor-pointer font-medium">
                استعراض ملف آخر
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>

          {/* Preset Sample Cards */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-purple-400" />
              نماذج إعلانية تسويقية جاهزة للتجربة الفورية:
            </h3>
            <div className="space-y-2">
              {SAMPLE_MARKETING_IMAGES.map((sample) => (
                <div
                  key={sample.id}
                  onClick={() => handleSelectSample(sample)}
                  className={`p-3 rounded-xl border text-right cursor-pointer transition-all ${
                    selectedTitle === sample.title
                      ? 'bg-purple-950/40 border-purple-500/40 text-purple-200 ring-1 ring-purple-500/20'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{sample.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {sample.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{sample.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Controls & AI Analysis Output (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">نوع التحليل المطلوب:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setAnalysisType('ad_critique')}
                  className={`p-2.5 rounded-xl border text-center font-medium transition-all ${
                    analysisType === 'ad_critique'
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  نقد إعلاني وتحويل CRO
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisType('ocr_copy')}
                  className={`p-2.5 rounded-xl border text-center font-medium transition-all ${
                    analysisType === 'ocr_copy'
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  استخراج النصوص OCR
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisType('platform_fit')}
                  className={`p-2.5 rounded-xl border text-center font-medium transition-all ${
                    analysisType === 'platform_fit'
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ملاءمة المنصات (Meta/TikTok)
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisType('comprehensive')}
                  className={`p-2.5 rounded-xl border text-center font-medium transition-all ${
                    analysisType === 'comprehensive'
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  فحص وتقييم شامل
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                توجيهات أو أسئلة إضافية خاصة بالصورة (اختياري):
              </label>
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="مثال: هل اللون الأحمر للزر مناسب؟ ما هو أفضل سعر بديل يمكن اقتراحه؟"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-purple-400" />
                النموذج المستخدم: <code className="text-purple-300 font-mono">Ollama Vision</code>
              </span>
              <button
                type="button"
                onClick={runAnalysis}
                disabled={loading || !selectedImage}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-purple-600/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري التحليل المعمق...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>بدء التحليل البصري بالذكاء الاصطناعي</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl min-h-[350px] flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">تقرير التحليل البصري والإعلاني</h3>
                {modelUsed && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                    {modelUsed}
                  </span>
                )}
              </div>

              {analysisResult && (
                <button
                  onClick={copyResult}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ التقرير</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-start gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">تنبيه أثناء التحليل:</p>
                  <p className="mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto max-h-[460px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-purple-400 animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">جاري قراءة واستيعاب أبعاد وعناصر الإعلان...</h4>
                    <p className="text-xs text-slate-500 mt-1">يقوم نموذج Ollama Vision بتفكيك التسلسل البصري والنصوص الآن.</p>
                  </div>
                </div>
              ) : analysisResult ? (
                <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {analysisResult}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center text-slate-500 space-y-2">
                  <ImageIcon className="w-12 h-12 stroke-[1.2] text-slate-600" />
                  <p className="text-sm">اختر صورة أو استخدم النموذج الجاهز واضغط على &quot;بدء التحليل البصري&quot;.</p>
                  <p className="text-xs text-slate-600">ستظهر النتائج، استخراج النصوص، ونقاط القوة والضعف هنا مباشرة.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
