import { SocialAccount, Campaign, ContactLead, RoleConfig } from '../types';

export const CHATBOT_ROLES: RoleConfig[] = [
  {
    id: 'marketing_strategist',
    name: 'خبير استراتيجيات النمو والتسويق',
    badge: 'Senior Strategist',
    description: 'تحليل المنافسين، تخطيط الحملات متكاملة القنوات، وابتكار عروض بيع فريدة بالسوق العربي.',
    recommendedModel: 'reasoning',
    systemPrompt: 'أنت خبير تسويق واستراتيجيات رقمية مخضرم متخصص في نمو الشركات والمشاريع في الشرق الأوسط ومصر والخليج العربي.',
    starterPrompts: [
      'ضع لي خطة إطلاق حملة بيع كورس/منتج رقمي عبر فيسبوك وواتساب بدون إعلانات ممولة باهظة',
      'كيف أوزع محتوى حملتي على 5 منصات (فيسبوك، إنستغرام، تليجرام، تيك توك، واتساب) بطريقة متناسقة؟',
      'قارن بين أسلوب استهداف مجموعات فيسبوك وحملات البرودكاست في واتساب من حيث معدل التحويل',
      'ما هي أفضل استراتيجية لإعادة استهداف العملاء الذين تفاعلوا ولم يشتروا؟',
    ],
  },
  {
    id: 'copywriter',
    name: 'كاتب نصوص إعلانية محترف (Copywriter)',
    badge: 'Conversion Copy',
    description: 'صياغة عناوين إعلانية خاطفة، رسائل واتساب تسويقية، وسيناريوهات ريلز وتيك توك سريعة التحويل.',
    recommendedModel: 'balanced',
    systemPrompt: 'أنت كاتب إعلانات ونصوص تسويقية استثنائي تعتمد صيغ التحويل المباشر مثل AIDA و PAS بمختلف اللهجات العربية.',
    starterPrompts: [
      'اكتب لي 3 صيغ لرسالة واتساب ترويجية لعرض نهاية الأسبوع مع خطاف قوي وزر إجراء',
      'اكتب سيناريو ريلز/تيك توك 30 ثانية لترويج أداة إنتاجية أو متجر إلكتروني',
      'صغ 5 عناوين فيسبوك مثيرة للفضول لخدمة استشارات تسويقية',
      'حول هذه الميزة التقنية إلى 3 فوائد ملموسة تلامس مشاعر العميل',
    ],
  },
  {
    id: 'safety_specialist',
    name: 'مستشار سلامة التشغيل',
    badge: 'Safety & Limits',
    description: 'إرشادات التشغيل الآمن، الحدود اليومية، وإيقاف التنفيذ عند التحديات.',
    recommendedModel: 'reasoning',
    systemPrompt: 'أنت مستشار سلامة وأتمتة ملتزم بحدود المنصات؛ ركّز على التوقف عند التحديات، الموافقات، والمعدلات المحافظة، ولا تقدّم طرقاً لتجاوز أنظمة مكافحة الإساءة.',
    starterPrompts: [
      'ما هي خطوات جدول الإحماء (Warm-up Schedule) لحساب فيسبوك جديد لنشر عروض في المجموعات؟',
      'كيف أضبط التأخيرات الزمنية العشوائية بين الرسائل على واتساب ويب لتفادي قيود الـ Spam؟',
      'ما الفرق بين كشف بصمة المتصفح (Browser Fingerprint) وتكرار عنوان الـ IP؟',
      'ما الذي يجب فعله فور ظهور تنبيه أمني أو طلب كابتشا لحساب نشط؟',
    ],
  },
  {
    id: 'crm_closer',
    name: 'مسؤول المبيعات وإغلاق الصفقات (Closer)',
    badge: 'Deal Closer',
    description: 'الردود الذكية الفورية على اعتراضات العملاء، التسعير، ومتابعة المحادثات المفتوحة.',
    recommendedModel: 'fast',
    systemPrompt: 'أنت مسؤول مبيعات محترف وسريع البديهة في قنوات الدردشة الفورية، تجيد معالجة الاعتراضات وتحفيز الشراء الفوري.',
    starterPrompts: [
      'العميل يقول: "سعرك غالي مقارنة بالمنافسين"، كيف أرد عليه باحترافية وأقنعه؟',
      'اكتب رد متابعة لطيف لعميل سأل عن السعر واختفى منذ يومين',
      'كيف أصيغ رسالة تأكيد الطلب للواتساب مع رفع فرصة الشراء الإضافي (Upsell)؟',
      'العميل متردد ويسأل: "هل تضمنون النتيجة؟"، ما هو أفضل رد مقنع؟',
    ],
  },
];

export const INITIAL_ACCOUNTS: SocialAccount[] = [
  {
    id: 'acc_1',
    platform: 'facebook',
    accountName: 'حساب المسوق المصري - وكالة أوربت',
    username: 'orbit.marketing.eg',
    status: 'active',
    healthScore: 94,
    warmUpLevel: 8,
    dailyActionsDone: 14,
    dailyLimit: 35,
    lastActivity: 'منذ 8 دقائق (نشر في 3 جروبات)',
    proxy: 'Resident-Cairo-IP:8080 (نشط)',
    sessionEncrypted: true,
  },
  {
    id: 'acc_2',
    platform: 'whatsapp',
    accountName: 'واتساب خدمة المبيعات والمتابعة',
    username: '+201099887766',
    status: 'active',
    healthScore: 98,
    warmUpLevel: 10,
    dailyActionsDone: 42,
    dailyLimit: 120,
    lastActivity: 'منذ 3 دقائق (إرسال رد آلي)',
    proxy: 'Direct Local Device Session',
    sessionEncrypted: true,
  },
  {
    id: 'acc_3',
    platform: 'telegram',
    accountName: 'قناة عروض التجارة الإلكترونية VIP',
    username: '@OrbitDealsVIP',
    status: 'active',
    healthScore: 100,
    warmUpLevel: 10,
    dailyActionsDone: 8,
    dailyLimit: 200,
    lastActivity: 'منذ 25 دقيقة (نشر منشور جدول)',
    proxy: 'Proxy-Global-TLS:443',
    sessionEncrypted: true,
  },
  {
    id: 'acc_4',
    platform: 'instagram',
    accountName: 'صفحة البراند - إنستغرام بيزنس',
    username: '@orbit_growth_hub',
    status: 'warming_up',
    healthScore: 82,
    warmUpLevel: 4,
    dailyActionsDone: 6,
    dailyLimit: 20,
    lastActivity: 'منذ ساعة (تفاعل طبيعي مع ستوري)',
    proxy: 'Mobile-LTE-Node:9090',
    sessionEncrypted: true,
  },
  {
    id: 'acc_5',
    platform: 'linkedin',
    accountName: 'حساب المدير التنفيذي (B2B Lead Gen)',
    username: 'ahmed-turki-growth',
    status: 'active',
    healthScore: 96,
    warmUpLevel: 9,
    dailyActionsDone: 11,
    dailyLimit: 30,
    lastActivity: 'منذ ساعتين (طلب تواصل ذكي)',
    proxy: 'Corporate Dedicated IP',
    sessionEncrypted: true,
  },
];

export const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp_1',
    name: 'إطلاق عرض باقة الوكالات والمسوقين',
    platform: 'facebook',
    target: '18 مجموعة تجارة إلكترونية وتسويق',
    status: 'running',
    content: '🚀 لأصحاب المتاجر والوكالات: نظام تشغيل شامل يدير حملاتك ومحادثاتك بدون قيود وبمحاكاة بشرية دقيقة. خصم 40% للأعضاء الأوائل!',
    scheduledAt: '2026-09-23 18:00',
    successfulActions: 14,
    totalActions: 18,
    delayRange: [4, 9],
  },
  {
    id: 'camp_2',
    name: 'حملة برودكاست متابعة السلات المتروكة',
    platform: 'whatsapp',
    target: 'قائمة 65 عميلاً محتملاً مهتماً',
    status: 'running',
    content: 'أهلاً بك يا غالي! لاحظنا اهتمامك بباقة الأتمتة الشاملة. هل واجهتك أي صعوبة؟ جهزنا لك كود خصم خاص صالح لمدة 24 ساعة فقط 🔥',
    scheduledAt: '2026-09-23 15:30',
    successfulActions: 42,
    totalActions: 65,
    delayRange: [5, 12],
  },
  {
    id: 'camp_3',
    name: 'نشر دراسة حالة: كيف ضاعفنا المبيعات',
    platform: 'telegram',
    target: 'قنوات ومجموعات التسويق الرقمي',
    status: 'completed',
    content: '📊 دراسة حالة مفصلة: كيف استطاع متجر أزياء زيادة عوائد المبيعات 300% عبر مزامنة النشر في المجموعات مع متابعة واتساب الفورية.',
    scheduledAt: '2026-09-23 12:00',
    successfulActions: 25,
    totalActions: 25,
    delayRange: [3, 6],
  },
];

export const INITIAL_LEADS: ContactLead[] = [
  {
    id: 'lead_1',
    name: 'م. كريم محمود (مدير وكالة)',
    platform: 'whatsapp',
    phone: '+201123456789',
    status: 'interested',
    lastMessage: 'محتاج أعرف هل باقة الوكالة تسمح لي بربط 10 حسابات فيسبوك في نفس الوقت؟',
    lastMessageTime: 'منذ 10 دقائق',
    unread: true,
    value: 499,
    notes: 'وكالة ناشئة بالقاهرة تدير 8 علامات تجارية محلية.',
  },
  {
    id: 'lead_2',
    name: 'سارة العتيبي (متجر إلكتروني)',
    platform: 'instagram',
    handle: '@sara_boutique_sa',
    status: 'offer_sent',
    lastMessage: 'أرسلت لك رابط الدفع مع كود الخصم للباقة الاحترافية مدى الحياة.',
    lastMessageTime: 'منذ 35 دقيقة',
    unread: false,
    value: 399,
    notes: 'متجر عبايات بالرياض، تريد أتمتة الردود وجدولة العروض الأسبوعية.',
  },
  {
    id: 'lead_3',
    name: 'طارق عبد العزيز (مسوق أفلييت)',
    platform: 'telegram',
    handle: '@tarek_growth',
    status: 'won',
    lastMessage: 'تم تفعيل مفتاح الترخيص بنجاح، الأداة مذهلة جداً وسريعة!',
    lastMessageTime: 'منذ ساعتين',
    unread: false,
    value: 199,
    notes: 'تم الدفع بنجاح واشترى باقة المحترف.',
  },
  {
    id: 'lead_4',
    name: 'عمر القحطاني',
    platform: 'facebook',
    handle: 'omar.qht',
    status: 'new',
    lastMessage: 'السلام عليكم، هل النظام يحتاج خوادم أو يشتغل على اللابتوب فقط؟',
    lastMessageTime: 'منذ 3 ساعات',
    unread: true,
    value: 99,
    notes: 'مهتم بالنسخة المحلية Local-First لضمان الخصوصية.',
  },
];

// Helper function to safely convert SVG string to base64 Data URI supporting Arabic/UTF-8
function svgToDataUri(svgString: string): string {
  try {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      // UTF-8 to Base64
      const utf8Bytes = encodeURIComponent(svgString.trim()).replace(
        /%([0-9A-F]{2})/g,
        function toSolidBytes(_match, p1) {
          return String.fromCharCode(parseInt(p1, 16));
        }
      );
      return 'data:image/svg+xml;base64,' + window.btoa(utf8Bytes);
    }
  } catch (e) {
    void e;
  }
  // Standard SVG Data URI fallback
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString.trim());
}

// Pre-built sample marketing ad images (Data URIs) so users can analyze immediately with 1 click
export const SAMPLE_MARKETING_IMAGES = [
  {
    id: 'sample_ad_ecommerce',
    title: 'إعلان عرض تخفيضات لمتجر أحذية وساعات (Flash Sale)',
    description: 'تصميم إعلاني ترويجي مع خصم 50% وزر تسوق الآن وشعار وعناصر تحفيز.',
    category: 'E-Commerce Sale',
    dataUri: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="50%" stop-color="#1e1b4b"/>
            <stop offset="100%" stop-color="#311042"/>
          </linearGradient>
          <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#ef4444"/>
          </linearGradient>
        </defs>
        <rect width="800" height="800" fill="url(#bg)"/>
        <circle cx="650" cy="150" r="220" fill="#6366f1" opacity="0.15"/>
        <circle cx="100" cy="700" r="200" fill="#ec4899" opacity="0.12"/>
        
        <!-- Badge -->
        <rect x="250" y="70" width="300" height="50" rx="25" fill="#f59e0b" opacity="0.2"/>
        <rect x="250" y="70" width="300" height="50" rx="25" fill="none" stroke="#f59e0b" stroke-width="2"/>
        <text x="400" y="102" font-family="sans-serif" font-weight="bold" font-size="20" fill="#fbbf24" text-anchor="middle">🔥 عروض نهاية الأسبوع الكبرى</text>
        
        <!-- Big Headline -->
        <text x="400" y="190" font-family="sans-serif" font-weight="900" font-size="52" fill="#ffffff" text-anchor="middle">خصم حصري يصل إلى</text>
        <text x="400" y="290" font-family="sans-serif" font-weight="900" font-size="95" fill="url(#accent)" text-anchor="middle">50% OFF</text>
        
        <!-- Product card mockup -->
        <rect x="150" y="340" width="500" height="260" rx="24" fill="#1e293b" stroke="#334155" stroke-width="2"/>
        <circle cx="280" cy="470" r="80" fill="#3b82f6" opacity="0.3"/>
        <text x="280" y="475" font-size="70" text-anchor="middle">👟</text>
        <text x="500" y="430" font-family="sans-serif" font-weight="bold" font-size="28" fill="#f8fafc" text-anchor="middle">حذاء رياضي برو ماكس</text>
        <text x="500" y="475" font-family="sans-serif" font-weight="bold" font-size="36" fill="#10b981" text-anchor="middle">199 ر.س</text>
        <text x="500" y="520" font-family="sans-serif" font-size="18" fill="#cbd5e1" text-anchor="middle">شحن سريع مجاني لجميع المناطق 🚚</text>
        
        <!-- CTA Button -->
        <rect x="250" y="640" width="300" height="65" rx="32" fill="url(#accent)"/>
        <text x="400" y="682" font-family="sans-serif" font-weight="bold" font-size="26" fill="#ffffff" text-anchor="middle">اطلب الآن قبل نفاد الكمية 🛒</text>
        
        <text x="400" y="745" font-family="sans-serif" font-size="16" fill="#64748b" text-anchor="middle">ضمان استرجاع لمدة 14 يوماً | الدفع عند الاستلام متاح</text>
      </svg>
    `),
  },
  {
    id: 'sample_ad_saas',
    title: 'إعلان أداة رقمية B2B لزيادة مبيعات الواتساب',
    description: 'بوستر تسويقي يوضح مميزات أتمتة الرسائل وخدمة العملاء على واتساب ويب.',
    category: 'B2B Software',
    dataUri: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
        <defs>
          <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#022c22"/>
            <stop offset="60%" stop-color="#064e3b"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        <rect width="800" height="800" fill="url(#bg2)"/>
        
        <!-- Header -->
        <rect x="220" y="60" width="360" height="40" rx="20" fill="#10b981" opacity="0.2"/>
        <text x="400" y="87" font-family="sans-serif" font-weight="bold" font-size="18" fill="#34d399" text-anchor="middle">🚀 حلول الأعمال وأتمتة الواتساب 2026</text>
        
        <!-- Main Headline -->
        <text x="400" y="160" font-family="sans-serif" font-weight="900" font-size="44" fill="#ffffff" text-anchor="middle">ضاعف مبيعاتك وأدر محادثاتك</text>
        <text x="400" y="220" font-family="sans-serif" font-weight="900" font-size="46" fill="#22c55e" text-anchor="middle">من شاشة واحدة بدون حظر</text>
        
        <!-- Feature 1 -->
        <rect x="120" y="270" width="560" height="80" rx="16" fill="#042f2e" stroke="#115e59" stroke-width="2"/>
        <text x="640" y="320" font-size="28" text-anchor="middle">⚡</text>
        <text x="420" y="305" font-family="sans-serif" font-weight="bold" font-size="20" fill="#f0fdf4" text-anchor="middle">إرسال حملات مخصصة بأسماء العملاء تلقائياً</text>
        <text x="420" y="333" font-family="sans-serif" font-size="15" fill="#a7f3d0" text-anchor="middle">معدل قراءة يتجاوز 92% وسرعة تسليم خيالية</text>
        
        <!-- Feature 2 -->
        <rect x="120" y="370" width="560" height="80" rx="16" fill="#042f2e" stroke="#115e59" stroke-width="2"/>
        <text x="640" y="420" font-size="28" text-anchor="middle">🛡️</text>
        <text x="420" y="405" font-family="sans-serif" font-weight="bold" font-size="20" fill="#f0fdf4" text-anchor="middle">محاكاة سلوك بشري وتأخيرات ذكية مع الالتزام بحدود المنصة</text>
        <text x="420" y="433" font-family="sans-serif" font-size="15" fill="#a7f3d0" text-anchor="middle">تشفير محلي تام لجلساتك بدون رفعها لخوادم خارجية</text>
        
        <!-- Feature 3 -->
        <rect x="120" y="470" width="560" height="80" rx="16" fill="#042f2e" stroke="#115e59" stroke-width="2"/>
        <text x="640" y="520" font-size="28" text-anchor="middle">🤖</text>
        <text x="420" y="505" font-family="sans-serif" font-weight="bold" font-size="20" fill="#f0fdf4" text-anchor="middle">ردود آلية ذكية تدعم اللهجات العربية ومراحل الـ CRM</text>
        <text x="420" y="533" font-family="sans-serif" font-size="15" fill="#a7f3d0" text-anchor="middle">إغلاق صفقات ومتابعة العملاء على مدار 24 ساعة</text>
        
        <!-- CTA -->
        <rect x="230" y="600" width="340" height="65" rx="32" fill="#22c55e"/>
        <text x="400" y="642" font-family="sans-serif" font-weight="bold" font-size="24" fill="#022c22" text-anchor="middle">جرب النسخة المجانية الآن 👈</text>
        <text x="400" y="700" font-family="sans-serif" font-size="16" fill="#6ee7b7" text-anchor="middle">لا تحتاج بطاقة بنكية • متوافق مع ويندوز وماك والموبايل</text>
      </svg>
    `),
  },
];
