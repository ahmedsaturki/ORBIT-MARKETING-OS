import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// High payload limit for image analysis (base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize GoogleGenAI SDK with required telemetry User-Agent
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// System instructions for specific roles
const ROLE_SYSTEM_INSTRUCTIONS: Record<string, string> = {
  marketing_strategist: `أنت خبير استراتيجي أول في التسويق الرقمي ونمو الشركات (Senior Growth & Marketing Strategist) متخصص في السوق العربي والخليجي والشرق الأوسط، وخبير في أدوات التشغيل والأتمتة الاجتماعية بدون قيود.
مهمتك:
1. تقديم خطط تسويقية واضحة، حملات إعلانية فعالة، واستراتيجيات نمو بدون تكاليف إعلانية مبالغ فيها.
2. فهم طبيعة كل منصة (Facebook, Instagram, WhatsApp, TikTok, Telegram, LinkedIn).
3. تقديم نصائح قابلة للتطبيق مباشرة مع خطوات محددة وأرقام وتوقيتات.
4. الرد بلغة عربية احترافية راقية وواضحة تناسب رواد الأعمال والمسوقين.`,

  copywriter: `أنت كاتب إعلانات ونصوص تسويقية محترف (Direct-Response Arabic Copywriter).
مهمتك:
1. صياغة نصوص إعلانية ذات معدل تحويل عالٍ (High-Converting Copy) بمختلف اللهجات (المصرية، الخليجية، الشامية، أو الفصحى المبسطة).
2. استخدام صيغ تسويقية مثبتة (AIDA, PAS, BAB, Hook-Story-Offer).
3. كتابة رسائل واتساب جذابة، ومنشورات فيسبوك تفاعلية، وسيناريوهات فيديو قصيرة (Reels/TikTok).
4. إضافة دعوات واضحة لاتخاذ إجراء (Call To Action - CTA) ورموز تعبيرية متوازنة.`,

  antiban_specialist: `أنت كبير مهندسي أمان الحسابات والتخفي الرقمي (Anti-Ban & Stealth Automation Architect).
مهمتك:
1. تقديم استشارات تقنية لحماية الحسابات من الحظر والتقييد (Facebook Groups, WhatsApp, Telegram, Instagram).
2. شرح بروتوكولات محاكاة السلوك البشري (Random Delays, Circuit Breakers, Warm-up Cycles, Session Encryption).
3. تقديم حلول هندسية للمشاكل الشائعة مثل تحديات CAPTCHA وتغييرات DOM في المنصات.
4. توضيح معايير التشغيل الآمن وقاعدة 80% نشاط طبيعي مقابل 20% نشاط تسويقي.`,

  crm_closer: `أنت خبير في إدارة علاقات العملاء وإغلاق الصفقات (Customer Success & High-Ticket Closer).
مهمتك:
1. مساعدة الفرق في إدارة صندوق المحادثات والرد على استفسارات العملاء المترددين وإغلاق المبيعات بسرعة.
2. تحويل الشكاوى أو الاعتراضات إلى فرص بيع حقيقية.
3. صياغة ردود سريعة ومقنعة للواتساب والمحادثات المباشرة.
4. تصنيف مراحل العملاء (Lead Scoring) ومتابعة العربات المتروكة.`,
};

// 1. Multi-turn Chat API
app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages = [],
      roleId = 'marketing_strategist',
      customSystemInstruction = '',
      model = 'gemini-3.5-flash',
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'قائمة الرسائل فارغة أو غير صحيحة' });
    }

    // Role system prompt
    const baseInstruction = ROLE_SYSTEM_INSTRUCTIONS[roleId] || ROLE_SYSTEM_INSTRUCTIONS.marketing_strategist;
    const systemInstruction = customSystemInstruction
      ? `${baseInstruction}\n\nتعليمات إضافية مخصصة من المستخدم:\n${customSystemInstruction}`
      : baseInstruction;

    // Supported models per user request specification:
    // gemini-3.1-pro-preview for complex tasks
    // gemini-3.5-flash for general tasks
    // gemini-3.1-flash-lite for tasks that should happen fast
    const validModels = ['gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    const chosenModel = validModels.includes(model) ? model : 'gemini-3.5-flash';

    // Format contents into GoogleGenAI format
    const contents = messages.map((m: { role: string; text: string }) => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text || '' }],
    }));

    try {
      const response = await ai.models.generateContent({
        model: chosenModel,
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      return res.json({
        text: response.text || '',
        modelUsed: chosenModel,
      });
    } catch (modelErr: any) {
      // If gemini-3.1-pro-preview fails due to key tier/quota, fall back to gemini-3.5-flash
      if (chosenModel === 'gemini-3.1-pro-preview') {
        console.warn('Fallback from gemini-3.1-pro-preview to gemini-3.5-flash:', modelErr?.message);
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });
        return res.json({
          text: fallbackResponse.text || '',
          modelUsed: 'gemini-3.5-flash',
          fallbackNotice: 'تم التبديل تلقائياً إلى نموذج gemini-3.5-flash لضمان استمرار الاستجابة.',
        });
      }
      throw modelErr;
    }
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return res.status(500).json({
      error: error?.message || 'حدث خطأ أثناء معالجة المحادثة مع الذكاء الاصطناعي',
    });
  }
});

// 2. Image Analysis API using gemini-3.1-pro-preview (Mandated by user prompt)
app.post('/api/analyze-image', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', prompt = '', analysisType = 'comprehensive' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'لم يتم إرسال بيانات الصورة (Base64)' });
    }

    // Clean base64 string if data url header was included
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    let defaultPrompt = '';
    switch (analysisType) {
      case 'ad_critique':
        defaultPrompt = `حلل هذا البوستر/الإعلان التسويقي تحليلاً دقيقاً:
1. تقييم التسلسل البصري (Visual Hierarchy) والخطاف الإعلاني (Hook).
2. استخراج وفحص النصوص والرسائل الرئيسية والعرض المقدم (Offer).
3. تقييم وضوح زر أو دعوة الإجراء (CTA).
4. نقاط القوة ونقاط الضعف الجوهرية.
5. 3 نصائح عملية فورية لرفع معدل التحويل (CTR & Conversion Rate) لهذا الإعلان.`;
        break;

      case 'ocr_copy':
        defaultPrompt = `استخرج بدقة جميع النصوص المكتوبة في هذه الصورة وصنفها:
1. العنوان الرئيسي (Headline)
2. العروض والأسعار (Pricing / Offers)
3. بيانات التواصل وحسابات التواصل الاجتماعي
4. إعادة صياغة للنصوص بأسلوب إعلاني عربي أكثر جاذبية وقوة.`;
        break;

      case 'platform_fit':
        defaultPrompt = `قيم مدى ملائمة هذا التصميم للمنصات الرقمية المختلفة (Instagram Feed/Stories, Facebook Feed, TikTok, WhatsApp Catalog):
1. أبعاد التصميم ومدى مناسبتها لكل منصة.
2. هل كمية النصوص تتوافق مع معايير إعلانات Meta؟
3. كيف يمكن تعديل هذا المحتوى ليناسب ستوري إنستغرام أو رسالة واتساب مباشرة؟`;
        break;

      default:
        defaultPrompt = `أنت خبير تسويق وتحليل إعلانات بصري بالذكاء الاصطناعي.
حلل هذه الصورة الإعلانية/التسويقية بدقة شاملة:
- الفكرة والرسالة الأساسية
- نقد التصميم والألوان والخطوط
- الجمهور المستهدف المحتمل
- تقييم الجاذبية البصرية ومعدل التحويل المتوقع (من 1 إلى 10) مع التعليل
- مقترحات تحسين ملموسة وعينات نصوص بديلة (A/B Testing Variants)`;
        break;
    }

    const finalPrompt = prompt ? `${defaultPrompt}\n\nطلب خاص إضافي من المستخدم:\n${prompt}` : defaultPrompt;

    // Use model gemini-3.1-pro-preview as explicitly required
    const primaryModel = 'gemini-3.1-pro-preview';

    const imagePart = {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: cleanBase64,
      },
    };

    try {
      const response = await ai.models.generateContent({
        model: primaryModel,
        contents: {
          parts: [imagePart, { text: finalPrompt }],
        },
      });

      return res.json({
        analysis: response.text || '',
        modelUsed: primaryModel,
      });
    } catch (proErr: any) {
      console.warn('gemini-3.1-pro-preview vision error, falling back to gemini-3.5-flash:', proErr?.message);
      // Fallback to gemini-3.5-flash if pro preview requires billing activation
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: {
          parts: [imagePart, { text: finalPrompt }],
        },
      });

      return res.json({
        analysis: fallbackResponse.text || '',
        modelUsed: 'gemini-3.5-flash',
        fallbackNotice: 'تم إتمام التحليل بنجاح عبر نموذج gemini-3.5-flash.',
      });
    }
  } catch (error: any) {
    console.error('Image Analysis API Error:', error);
    return res.status(500).json({
      error: error?.message || 'فشل في تحليل الصورة بالذكاء الاصطناعي',
    });
  }
});

// 3. Multi-Format Content Studio Generator API
app.post('/api/generate-content', async (req, res) => {
  try {
    const {
      topic = '',
      dialect = 'فصحى مبسطة',
      tone = 'حماسي وجذاب',
      targetAudience = 'الجمهور العام',
      platforms = ['facebook', 'instagram', 'whatsapp', 'telegram'],
    } = req.body;

    if (!topic) {
      return res.status(400).json({ error: 'يرجى كتابة فكرة أو موضوع المحتوى' });
    }

    const prompt = `أنت أفضل كاتب محتوى تسويقي عربي متعدد المنصات.
الموضوع: "${topic}"
اللهجة المطلوبة: ${dialect}
النبرة: ${tone}
الجمهور المستهدف: ${targetAudience}

المطلوب: قم بإنشاء محتوى مخصص لكل منصة من المنصات التالية بشكل احترافي مع الحفاظ على روح كل منصة:
1. منشور فيسبوك طويل (Facebook Post): مع عنوان قوي، قصة أو شرح للقيمة، دعوة للتفاعل والتعليق، وهاشتاجات مناسبة.
2. منشور إنستغرام (Instagram Caption): نص بصري جذاب، خطاف أول 3 كلمات، تنسيق مريح، وهاشتاجات قوية.
3. رسالة واتساب تسويقية (WhatsApp Broadcast): رسالة مختصرة ومباشرة، تستخدم التنسيق (*عريض*، _مائل_)، مع عرض واضح ورابط أو زر إجراء (CTA).
4. نص فيديو قصير (Reels / TikTok Script): خطاف بصري وصوتي في أول 3 ثوانٍ، 3 نقاط سريعة، وخاتمة سريعة تدعو للمتابعة أو الشراء.
5. رسالة تليجرام أو تغريدة إكس (Telegram / Twitter-X): نص فوري ومكثف مع روابط واضحة ورموز تعبيرية.

أجب بتنسيق منظم ومحدد لكل منصة.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        temperature: 0.8,
      },
    });

    return res.json({
      content: response.text || '',
      modelUsed: 'gemini-3.5-flash',
    });
  } catch (error: any) {
    console.error('Generate Content API Error:', error);
    return res.status(500).json({
      error: error?.message || 'فشل في توليد المحتوى التسويقي',
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Orbit Marketing OS Backend',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

// Setup Vite middleware in development or serve static in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static files
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`🚀 Orbit Marketing OS Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
