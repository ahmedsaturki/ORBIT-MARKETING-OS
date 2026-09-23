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
}

export interface ContactLead {
  id: string;
  name: string;
  platform: Platform;
  phone?: string;
  handle?: string;
  status: 'new' | 'interested' | 'offer_sent' | 'won' | 'lost';
  lastMessage: string;
  lastMessageTime: string;
  unread: boolean;
  value?: number;
  notes?: string;
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
  recommendedModel: 'reasoning' | 'balanced' | 'fast';
  systemPrompt: string;
  starterPrompts: string[];
}
