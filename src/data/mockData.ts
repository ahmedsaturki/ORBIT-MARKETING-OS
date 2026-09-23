import { SocialAccount, Campaign, ContactLead, RoleConfig } from '../types';

export const CHATBOT_ROLES: RoleConfig[] = [
  {
    id: 'marketing_strategist',
    name: 'خبير استراتيجيات النمو والتسويق',
    badge: 'Senior Strategist',
    description: 'تحليل المنافسين، تخطيط الحملات متكاملة القنوات، وابتكار عروض بيع فريدة بالسوق العربي.',
    recommendedModel: 'gemini-3.1-pro-preview',
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
    recommendedModel: 'gemini-3.5-flash',
    systemPrompt: 'أنت كاتب إعلانات ونصوص تسويقية استثنائي تعتمد صيغ التحويل المباشر مثل AIDA و PAS بمختلف اللهجات العربية.',
    starterPrompts: [
      'اكتب لي 3 صيغ لرسالة واتساب ترويجية لعرض نهاية الأسبوع مع خطاف قوي وزر إجراء',
      'اكتب سيناريو ريلز/تيك توك 30 ثانية لترويج أداة إنتاجية أو متجر إلكتروني',
      'صغ 5 عناوين فيسبوك مثيرة للفضول لخدمة استشارات تسويقية',
      'حول هذه الميزة التقنية إلى 3 فوائد ملموسة تلامس مشاعر العميل',
    ],
  },
  {
    id: 'antiban_specialist',
    name: 'مستشار حماية الحسابات والتخفي',
    badge: 'Stealth & Safety',
    description: 'إرشادات منع الحظر، ضبط التأخيرات العشوائية، إحماء الحسابات وقواعد محاكاة السلوك البشري.',
    recommendedModel: 'gemini-3.1-pro-preview',
    systemPrompt: 'أنت مهندس أمان وأتمتة خبير في خوارزميات كشف البوتات لدى Meta وواتساب وتليجرام وبروتوكولات التخفي الذكية.',
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
    recommendedModel: 'gemini-3.1-flash-lite',
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
    source: 'إعلان واتساب مباشر',
    tags: ['وكالة تسويق', 'عميل محتمل B2B', 'مهتم بـ Agency'],
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
    source: 'رسائل إنستغرام التلقائية',
    tags: ['متجر إلكتروني', 'أزياء', 'مهتم بـ Lifetime'],
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
    source: 'قناة تليجرام VIP',
    tags: ['مسوق بالعمولة', 'تم الشراء', 'باقة Pro'],
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
    email: 'omar.qht@outlook.com',
    phone: '+966501234567',
    status: 'new',
    source: 'مجموعة رواد الأعمال الخليجية',
    tags: ['استفسار تقني', 'B2B', 'مهتم محلي'],
    lastMessage: 'السلام عليكم، هل النظام يحتاج خوادم أو يشتغل على اللابتوب فقط؟',
    lastMessageTime: 'منذ 3 ساعات',
    unread: true,
    value: 99,
    notes: 'مهتم بالنسخة المحلية Local-First لضمان الخصوصية.',
    history: [
      {
        id: 'h_1',
        timestamp: '14:20',
        type: 'message_received',
        text: 'السلام عليكم، هل النظام يحتاج خوادم أو يشتغل على اللابتوب فقط؟'
      }
    ]
  },
  {
    id: 'lead_5',
    name: 'د. ياسمين الشريف',
    platform: 'whatsapp',
    phone: '+971509876543',
    email: 'dr.yasmeen@aesthetic-hub.ae',
    status: 'potential',
    source: 'إعلان إنستغرام استوديو',
    tags: ['عيادات تجميل', 'حملات دورية', 'VIP'],
    lastMessage: 'أريد نظاماً يرسل تذكيرات المواعيد للمراجعين تلقائياً عبر واتساب بدون خطر الحظر.',
    lastMessageTime: 'منذ 5 ساعات',
    unread: false,
    value: 499,
    notes: 'مجمع عيادات في دبي يحتاج 15 حساباً ورسائل تذكير يومية.',
    history: [
      {
        id: 'h_2',
        timestamp: '11:15',
        type: 'message_received',
        text: 'أريد نظاماً يرسل تذكيرات المواعيد للمراجعين تلقائياً عبر واتساب بدون خطر الحظر.'
      }
    ]
  }
];

// Feature 2: Platform Automation Rules (Updatable JSON Engine)
export const DEFAULT_AUTOMATION_RULES: Record<string, any> = {
  facebook: {
    platform: 'facebook',
    version: '3.4.1',
    lastUpdated: '2026-09-22',
    selectors: {
      postBox: 'div[role="textbox"][contenteditable="true"]',
      commentBox: 'div[aria-label="اكتب تعليقاً..."][contenteditable="true"]',
      dmInput: 'div[aria-label="الرسالة"][role="textbox"]',
      sendButton: 'div[aria-label="اضغط مفتاح الإدخال للإرسال"]',
      mediaUploadInput: 'input[type="file"][accept*="image"]',
      captchaDetection: 'div[data-pagelet*="checkpoint"], div[id*="recaptcha"]',
    },
    timeouts: {
      elementWaitMs: 8000,
      typingDelayMs: [60, 140],
      actionDelaySec: [4, 11],
    },
    circuitBreaker: {
      maxConsecutiveErrors: 3,
      pauseDurationMinutes: 45,
    },
  },
  whatsapp: {
    platform: 'whatsapp',
    version: '2.32.0',
    lastUpdated: '2026-09-20',
    selectors: {
      postBox: 'div[contenteditable="true"][data-tab="10"]',
      commentBox: 'div[contenteditable="true"][data-tab="10"]',
      dmInput: 'footer div[contenteditable="true"]',
      sendButton: 'button[aria-label="إرسال"], span[data-icon="send"]',
      mediaUploadInput: 'input[accept="image/*,video/mp4,video/3gpp,video/quicktime"]',
      captchaDetection: 'div[data-animate-modal-popup="true"]',
    },
    timeouts: {
      elementWaitMs: 12000,
      typingDelayMs: [70, 160],
      actionDelaySec: [5, 14],
    },
    circuitBreaker: {
      maxConsecutiveErrors: 2,
      pauseDurationMinutes: 60,
    },
  },
  instagram: {
    platform: 'instagram',
    version: '2.18.5',
    lastUpdated: '2026-09-21',
    selectors: {
      postBox: 'textarea[aria-label="اكتب شرحاً توضيحياً..."]',
      commentBox: 'textarea[aria-label="إضافة تعليق..."]',
      dmInput: 'div[role="textbox"][aria-label="رسالة"]',
      sendButton: 'button:has-text("إرسال"), div[role="button"]:has-text("نشر")',
      mediaUploadInput: 'input[type="file"][multiple]',
      captchaDetection: 'form#challenge-form',
    },
    timeouts: {
      elementWaitMs: 9000,
      typingDelayMs: [50, 130],
      actionDelaySec: [4, 10],
    },
    circuitBreaker: {
      maxConsecutiveErrors: 3,
      pauseDurationMinutes: 30,
    },
  },
  telegram: {
    platform: 'telegram',
    version: '1.9.0',
    lastUpdated: '2026-09-18',
    selectors: {
      postBox: 'div.input-message-input',
      commentBox: 'div.input-message-input',
      dmInput: 'div.input-message-input',
      sendButton: 'button.btn-send',
      mediaUploadInput: 'input.file-input',
      captchaDetection: 'div.flood-wait-modal',
    },
    timeouts: {
      elementWaitMs: 6000,
      typingDelayMs: [40, 110],
      actionDelaySec: [3, 8],
    },
    circuitBreaker: {
      maxConsecutiveErrors: 4,
      pauseDurationMinutes: 20,
    },
  },
  linkedin: {
    platform: 'linkedin',
    version: '2.4.0',
    lastUpdated: '2026-09-19',
    selectors: {
      postBox: 'div.ql-editor[contenteditable="true"]',
      commentBox: 'div.comments-comment-box__editor',
      dmInput: 'div.msg-form__contenteditable',
      sendButton: 'button.msg-form__send-button',
      mediaUploadInput: 'input[type="file"][name="file"]',
      captchaDetection: 'div.checkpoint-challenge',
    },
    timeouts: {
      elementWaitMs: 10000,
      typingDelayMs: [80, 180],
      actionDelaySec: [6, 15],
    },
    circuitBreaker: {
      maxConsecutiveErrors: 2,
      pauseDurationMinutes: 90,
    },
  },
  tiktok: {
    platform: 'tiktok',
    version: '1.5.2',
    lastUpdated: '2026-09-15',
    selectors: {
      postBox: 'div.notranslate[contenteditable="true"]',
      commentBox: 'div.DraftEditor-root',
      dmInput: 'div[role="textbox"]',
      sendButton: 'button:has-text("Post")',
      mediaUploadInput: 'input[type="file"][accept="video/*"]',
      captchaDetection: 'div#captcha-verify-image',
    },
    timeouts: {
      elementWaitMs: 11000,
      typingDelayMs: [60, 150],
      actionDelaySec: [5, 12],
    },
    circuitBreaker: {
      maxConsecutiveErrors: 2,
      pauseDurationMinutes: 45,
    },
  },
};

// Feature 2 & 4: Initial Tasks Queue
export const INITIAL_TASK_QUEUE: any[] = [
  {
    id: 'task_101',
    campaignId: 'camp_1',
    platform: 'facebook',
    accountId: 'acc_1',
    actionType: 'post_group',
    target: 'مجموعة تجار دروب شيبنج مصر (120k)',
    payload: {
      text: '🚀 لأصحاب المتاجر: منصة التشغيل المتكاملة تدير إعلاناتك ورسائل عملائك بدون قيود. خصم 40% للأعضاء!',
    },
    status: 'running',
    priority: 'high',
    retries: 0,
    maxRetries: 3,
    scheduledTime: '18:00',
    executedTime: '18:02:14',
    delayAppliedSeconds: 6.4,
  },
  {
    id: 'task_102',
    campaignId: 'camp_1',
    platform: 'facebook',
    accountId: 'acc_1',
    actionType: 'post_group',
    target: 'تجمع رواد الأعمال والتسويق العربي',
    payload: {
      text: '🚀 لأصحاب المتاجر: منصة التشغيل المتكاملة تدير إعلاناتك ورسائل عملائك بدون قيود. خصم 40% للأعضاء!',
    },
    status: 'queued',
    priority: 'high',
    retries: 0,
    maxRetries: 3,
    scheduledTime: '18:08',
  },
  {
    id: 'task_103',
    campaignId: 'camp_2',
    platform: 'whatsapp',
    accountId: 'acc_2',
    actionType: 'whatsapp_msg',
    target: '+201123456789 (كريم محمود)',
    payload: {
      text: 'أهلاً يا باشا! لاحظنا اهتمامك بباقة الأتمتة الشاملة. كود الخصم جاهز للاستخدام اليوم.',
      recipient: '+201123456789',
    },
    status: 'completed',
    priority: 'normal',
    retries: 0,
    maxRetries: 2,
    scheduledTime: '15:30',
    executedTime: '15:31:05',
    delayAppliedSeconds: 8.2,
  },
  {
    id: 'task_104',
    campaignId: 'camp_2',
    platform: 'whatsapp',
    accountId: 'acc_2',
    actionType: 'whatsapp_msg',
    target: '+966501234567 (عمر القحطاني)',
    payload: {
      text: 'مرحباً أخي عمر، بخصوص استفسارك عن الخصوصية، التطبيق يعمل بنظام Local-First بالكامل.',
      recipient: '+966501234567',
    },
    status: 'queued',
    priority: 'normal',
    retries: 0,
    maxRetries: 2,
    scheduledTime: '15:42',
  },
  {
    id: 'task_105',
    campaignId: 'camp_3',
    platform: 'telegram',
    accountId: 'acc_3',
    actionType: 'telegram_post',
    target: '@OrbitDealsVIP',
    payload: {
      text: '📊 دراسة حالة: زيادة عوائد المبيعات 300% عبر مزامنة النشر مع المتابعة الفورية.',
    },
    status: 'completed',
    priority: 'low',
    retries: 0,
    maxRetries: 3,
    scheduledTime: '12:00',
    executedTime: '12:00:15',
    delayAppliedSeconds: 4.1,
  },
];

// Feature 3: Digital Asset Management (Local Media Library)
export const INITIAL_MEDIA_ASSETS: any[] = [
  {
    id: 'asset_1',
    name: 'تصميم عروض الفلاش سيل 50% (Flash Sale)',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
    category: 'E-Commerce',
    tags: ['أحذية', 'عروض صيفية', 'خصومات', '50%'],
    sizeMb: 1.4,
    createdAt: '2026-09-20',
  },
  {
    id: 'asset_2',
    name: 'بوستر خدمة العملاء وحلول أتمتة واتساب',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&q=80',
    category: 'B2B Software',
    tags: ['واتساب', 'أتمتة', 'خدمة عملاء', 'CRM'],
    sizeMb: 2.1,
    createdAt: '2026-09-21',
  },
  {
    id: 'asset_3',
    name: 'قالب فيديو ريلز/تيك توك: 3 أخطاء شائعة بالإعلانات',
    type: 'template',
    url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80',
    category: 'Video Hooks',
    tags: ['ريلز', 'تيك توك', 'نصائح تسويق', 'Hooks'],
    sizeMb: 0.8,
    createdAt: '2026-09-22',
  },
  {
    id: 'asset_4',
    name: 'شعار وهوية وكالة أوربت الرقمية بدقة عالية',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
    category: 'Branding',
    tags: ['لوجو', 'شعار', 'هوية بصرية', 'Brand'],
    sizeMb: 3.5,
    createdAt: '2026-09-19',
  },
];

// Feature 7: CRDTs Sync Peers (P2P Local Network & WebRTC)
export const INITIAL_CRDT_PEERS: any[] = [
  {
    id: 'peer_desktop_main',
    name: 'جهاز المكتب الرئيسي (MacBook Pro M3 Max)',
    deviceType: 'desktop',
    status: 'connected',
    lastSync: 'منذ دقيقة واحدة',
    ip: '192.168.1.104',
    vectorClock: 1420,
  },
  {
    id: 'peer_mobile_phone',
    name: 'الهاتف المحمول (iPhone 15 Pro Max)',
    deviceType: 'mobile',
    status: 'connected',
    lastSync: 'منذ 3 دقائق',
    ip: '192.168.1.182',
    vectorClock: 1419,
  },
  {
    id: 'peer_laptop_travel',
    name: 'لابتوب العمل الميداني (ThinkPad X1)',
    deviceType: 'desktop',
    status: 'offline',
    lastSync: 'منذ يومين',
    ip: '10.0.0.45',
    vectorClock: 1205,
  },
];

// Feature 8: Licensing System Presets
export const LICENSE_PRESETS: any[] = [
  {
    tier: 'basic',
    name: 'باقة المبتدئين (Basic)',
    price: '$99 / $19 شهرياً',
    maxAccounts: 5,
    maxDevices: 1,
    description: 'أتمتة أساسية، CRM متكامل، ونماذج ذكاء اصطناعي مدمجة.',
    features: ['5 حسابات متزامنة', 'محاكاة السلوك البشري', 'صندوق محادثات موحد', 'تشفير AES-256 محلي'],
  },
  {
    tier: 'pro',
    name: 'باقة المحترفين (Pro)',
    price: '$199 / $39 شهرياً',
    maxAccounts: 15,
    maxDevices: 3,
    description: 'تحليلات متقدمة، تعديل قواعد المنصات، دعم البروكسي السكني، ومزامنة P2P.',
    features: ['15 حساباً نشطاً', 'مزامنة CRDTs عبر 3 أجهزة', 'محرر قواعد المنصات (JSON)', 'دعم بروكسي مخصص لكل حساب'],
  },
  {
    tier: 'agency',
    name: 'باقة الوكالات (Agency)',
    price: '$499 / $99 شهرياً',
    maxAccounts: 9999,
    maxDevices: 10,
    description: 'حسابات غير محدودة، وايت ليبل (White Label)، وإدارة صلاحيات فريق العمل.',
    features: ['حسابات غير محدودة', 'تخصيص الهوية (White Label)', 'توزيع المهام والمحادثات على 10 مستخدمين', 'أولوية في تحديث قواعد المنصات'],
  },
  {
    tier: 'lifetime',
    name: 'ترخيص مدى الحياة (Lifetime Deal)',
    price: '$399 دفعة واحدة',
    maxAccounts: 15,
    maxDevices: 5,
    description: 'وصول دائم لكافة التحديثات والمميزات بدون أي اشتراكات دورية.',
    features: ['15 حساباً للأبد', 'تحديثات مجانية مدى الحياة', '5 مقاعد أجهزة', 'دعم فني خاص ومجتمع مغلق'],
  },
];

export const CURRENT_ACTIVE_LICENSE: any = {
  key: 'ORBIT-PRO-2026-88A7-B91F-LOCAL',
  tier: 'pro',
  clientName: 'Ahmed Turki - Agency Growth',
  activatedAt: '2026-09-01',
  expiresAt: '2027-09-01',
  maxAccounts: 15,
  maxDevices: 3,
  activeDevices: 2,
  features: {
    unlimitedCampaigns: true,
    aiLocalOllama: true,
    aiCloudPro: true,
    customRules: true,
    whiteLabel: false,
    crdtSync: true,
  },
  hwid: 'HWID-9F81-22BC-441A-70EE',
  valid: true,
};


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
    console.warn('Base64 encoding fallback:', e);
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
        <text x="420" y="405" font-family="sans-serif" font-weight="bold" font-size="20" fill="#f0fdf4" text-anchor="middle">محاكاة سلوك بشري وتأخيرات ذكية ضد الحظر</text>
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
