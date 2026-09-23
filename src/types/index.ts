export type Platform = 'facebook' | 'whatsapp' | 'telegram' | 'instagram' | 'tiktok' | 'linkedin';

export interface SocialAccount {
  id: string;
  platform: Platform;
  accountName: string;
  username: string;
  status: 'active' | 'paused' | 'restricted' | 'warming_up';
  healthScore: number;
  warmUpLevel: number;
  dailyActionsDone: number;
  dailyLimit: number;
  lastActivity: string;
  proxy: string;
  sessionEncrypted: boolean;
  fingerprint?: {
    userAgent: string;
    viewport: string;
    webglVendor: string;
    canvasHash: string;
    timezone: string;
  };
}

export interface TaskQueueItem {
  id: string;
  campaignId?: string;
  platform: Platform;
  accountId: string;
  actionType: 'post_group' | 'post_page' | 'send_dm' | 'comment' | 'follow' | 'like' | 'whatsapp_msg' | 'telegram_post';
  target: string;
  payload: {
    text?: string;
    mediaUrl?: string;
    recipient?: string;
  };
  status: 'queued' | 'running' | 'completed' | 'failed' | 'retrying';
  priority: 'high' | 'normal' | 'low';
  retries: number;
  maxRetries: number;
  lastError?: string;
  scheduledTime: string;
  executedTime?: string;
  delayAppliedSeconds?: number;
}

export interface AutomationRule {
  platform: Platform;
  version: string;
  lastUpdated: string;
  selectors: {
    postBox: string;
    commentBox: string;
    dmInput: string;
    sendButton: string;
    mediaUploadInput: string;
    captchaDetection?: string;
  };
  timeouts: {
    elementWaitMs: number;
    typingDelayMs: [number, number];
    actionDelaySec: [number, number];
  };
  circuitBreaker: {
    maxConsecutiveErrors: number;
    pauseDurationMinutes: number;
  };
}

export interface Campaign {
  id: string;
  name: string;
  platform: Platform;
  target: string;
  status: 'running' | 'scheduled' | 'draft' | 'completed' | 'paused';
  content: string;
  mediaUrl?: string;
  scheduledAt: string;
  successfulActions: number;
  totalActions: number;
  delayRange: [number, number]; // seconds, e.g. [3, 8]
  accountsTargeted?: string[];
  scheduleType?: 'once' | 'daily' | 'weekly' | 'cron';
  cronExpression?: string;
}

export interface ContactLead {
  id: string;
  name: string;
  platform: Platform;
  phone?: string;
  email?: string;
  handle?: string;
  status: 'new' | 'interested' | 'potential' | 'offer_sent' | 'won' | 'lost';
  source?: string;
  tags?: string[];
  lastMessage: string;
  lastMessageTime: string;
  unread: boolean;
  value?: number;
  notes?: string;
  followUpDate?: string;
  history?: Array<{
    id: string;
    timestamp: string;
    type: 'message_received' | 'message_sent' | 'status_change' | 'note_added';
    text: string;
    author?: string;
  }>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: string;
}

export interface RoleConfig {
  id: string;
  name: string;
  badge: string;
  description: string;
  recommendedModel: 'gemini-3.1-pro-preview' | 'gemini-3.5-flash' | 'gemini-3.1-flash-lite';
  systemPrompt: string;
  starterPrompts: string[];
}

export type LicenseTier = 'basic' | 'pro' | 'agency' | 'lifetime';

export interface LicenseInfo {
  key: string;
  tier: LicenseTier;
  clientName: string;
  activatedAt: string;
  expiresAt: string | 'forever';
  maxAccounts: number;
  maxDevices: number;
  activeDevices: number;
  features: {
    unlimitedCampaigns: boolean;
    aiLocalOllama: boolean;
    aiCloudPro: boolean;
    customRules: boolean;
    whiteLabel: boolean;
    crdtSync: boolean;
  };
  hwid: string;
  valid: boolean;
}

export interface MediaAsset {
  id: string;
  name: string;
  type: 'image' | 'video' | 'template';
  url: string;
  category: string;
  tags: string[];
  sizeMb: number;
  createdAt: string;
}

export interface CrdtPeer {
  id: string;
  name: string;
  deviceType: 'desktop' | 'mobile' | 'web';
  status: 'connected' | 'syncing' | 'offline';
  lastSync: string;
  ip: string;
  vectorClock: number;
}

