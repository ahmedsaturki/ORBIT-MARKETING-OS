import React, { useState } from 'react';
import { 
  Database, Server, Laptop, ShieldCheck, Download, 
  Upload, Check, Copy, Code, DollarSign, Layers, Cpu,
  FolderTree, Terminal, Smartphone, Globe, Lock, FileCode
} from 'lucide-react';
import { safeGetStorage, safeCopy } from '../utils/storage';

export default function LocalArchitecture() {
  const [activeSubTab, setActiveSubTab] = useState<'monorepo' | 'rust_tauri' | 'schema' | 'security'>('monorepo');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const copyCode = async (code: string, id: string) => {
    await safeCopy(code);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const monorepoTree = `social-automation-os/
├── packages/
│   ├── core/                    # Shared business logic (TypeScript)
│   │   ├── src/
│   │   │   ├── database/        # SQLite schema + migrations
│   │   │   ├── encryption/      # AES-256-GCM + Argon2id
│   │   │   ├── sync/            # CRDTs with Yjs + WebRTC Mesh
│   │   │   ├── campaigns/       # Campaign & Task Queue
│   │   │   ├── messaging/       # Unified Inbox & Closers
│   │   │   ├── queue/           # Exponential Backoff Queue
│   │   │   ├── licensing/       # Offline License Validator
│   │   │   └── types/           # TypeScript Shared Interfaces
│   │   └── package.json
│   │
│   ├── desktop/                 # Desktop application (Tauri v2)
│   │   ├── src-tauri/           # Rust Backend & Native Stealth
│   │   │   ├── src/
│   │   │   │   ├── main.rs      # IPC Command Handlers
│   │   │   │   ├── automation/  # Playwright + Stealth Engine
│   │   │   │   ├── database/    # SQLite Connection Pool
│   │   │   │   └── licensing.rs # Offline Hardware ID Signatures
│   │   │   ├── Cargo.toml
│   │   │   └── tauri.conf.json
│   │   ├── src/                 # React 18 + Tailwind RTL Frontend
│   │   └── package.json
│   │
│   ├── mobile/                  # Mobile app (React Native + Expo SDK 51)
│   │   ├── app/                 # Expo Router
│   │   ├── src/                 # Monitoring & Quick CRM Controls
│   │   └── package.json
│   │
│   ├── web/                     # Web app (Next.js 14 App Router + PWA)
│   │   ├── src/app/             # Landing, Pricing & PWA Cache
│   │   ├── public/manifest.json # Progressive Web App
│   │   └── package.json
│   │
│   └── shared-ui/               # Reusable Tailwind RTL Components
│
├── rules/                       # Updatable JSON Rules (Zero Recompile)
│   ├── facebook.json
│   ├── whatsapp.json
│   ├── instagram.json
│   ├── telegram.json
│   ├── linkedin.json
│   └── tiktok.json
│
├── turbo.json                   # Turborepo Monorepo Pipelines
└── package.json                 # pnpm workspaces root`;

  const rustMainCode = `// packages/desktop/src-tauri/src/main.rs
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod automation;
mod encryption;
mod licensing;
mod database;

use tauri::{Manager, State};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct TaskResult {
    pub success: bool,
    pub task_id: String,
    pub latency_ms: u64,
    pub error: Option<String>,
}

#[tauri::command]
async fn execute_stealth_task(
    platform: String,
    action: String,
    payload: serde_json::Value,
) -> Result<TaskResult, String> {
    // 1. Verify Offline License
    licensing::verify_entitlement(&platform)?;

    // 2. Spawn Playwright Stealth Engine with Bezier Curve Mouse
    let result = automation::engine::run_task(&platform, &action, payload).await
        .map_err(|e| format!("Automation error: {}", e))?;

    Ok(result)
}

#[tauri::command]
fn get_machine_hwid() -> Result<String, String> {
    licensing::calculate_hwid()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            execute_stealth_task,
            get_machine_hwid
        ])
        .run(tauri::generate_context!())
        .expect("error while running Social Automation OS desktop application");
}`;

  const sqliteSchemaCode = `-- packages/core/src/database/schema.sql
-- Social Automation OS Local SQLite Database Schema

CREATE TABLE IF NOT EXISTS social_accounts (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL, -- facebook, whatsapp, telegram, instagram, linkedin, tiktok
    account_name TEXT NOT NULL,
    username TEXT,
    session_data TEXT,      -- AES-256-GCM Encrypted Local Cookies & Auth Token
    proxy_config TEXT,      -- { host, port, username, password, country }
    status TEXT DEFAULT 'active',
    health_score INTEGER DEFAULT 100,
    warm_up_level INTEGER DEFAULT 1,
    daily_actions_done INTEGER DEFAULT 0,
    daily_limit INTEGER DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    target TEXT NOT NULL,
    status TEXT DEFAULT 'draft', -- draft, running, scheduled, completed, paused
    content TEXT NOT NULL,
    delay_min_sec INTEGER DEFAULT 4,
    delay_max_sec INTEGER DEFAULT 11,
    schedule_type TEXT DEFAULT 'once', -- once, daily, weekly, cron
    cron_expr TEXT,
    successful_actions INTEGER DEFAULT 0,
    total_actions INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_queue (
    id TEXT PRIMARY KEY,
    campaign_id TEXT REFERENCES campaigns(id),
    platform TEXT NOT NULL,
    account_id TEXT REFERENCES social_accounts(id),
    action_type TEXT NOT NULL,
    target TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT DEFAULT 'queued', -- queued, running, completed, failed, retrying
    priority TEXT DEFAULT 'normal', -- high, normal, low
    retries INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_at TIMESTAMP NOT NULL,
    executed_at TIMESTAMP,
    delay_applied_seconds REAL
);

CREATE TABLE IF NOT EXISTS crm_contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'new', -- new, interested, potential, offer_sent, won, lost
    deal_value REAL DEFAULT 0,
    notes TEXT,
    tags_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <FolderTree className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-black text-white">الهندسة المعمارية وهيكل الأكواد (Monorepo Architecture)</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                Turborepo + Tauri v2 + Rust
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              تصفح الهيكل الكامل للمشروع ومكونات Rust Tauri v2، قاعدة بيانات SQLite المحلية، وقواعد الأتمتة المفتوحة بدون إعادة ترجمة.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono text-emerald-400">
              Zero Server Dependency
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('monorepo')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'monorepo'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>هيكل الـ Monorepo الكامل</span>
        </button>

        <button
          onClick={() => setActiveSubTab('rust_tauri')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'rust_tauri'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>كود Rust Tauri v2 Backend</span>
        </button>

        <button
          onClick={() => setActiveSubTab('schema')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'schema'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>مخطط SQLite المحلي الكامل</span>
        </button>

        <button
          onClick={() => setActiveSubTab('security')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'security'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>بروتوكول التشفير Zero-Trust</span>
        </button>
      </div>

      {/* Sub-Tab 1: Monorepo Tree */}
      {activeSubTab === 'monorepo' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-emerald-400" />
              <span>شجرة ملفات المستودع الأحادي (Monorepo File Hierarchy)</span>
            </h3>
            <button
              onClick={() => copyCode(monorepoTree, 'tree')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5"
            >
              {copiedIndex === 'tree' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedIndex === 'tree' ? 'تم النسخ' : 'نسخ الهيكل'}</span>
            </button>
          </div>

          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed">
            {monorepoTree}
          </pre>
        </div>
      )}

      {/* Sub-Tab 2: Rust Tauri Code */}
      {activeSubTab === 'rust_tauri' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Rust Tauri v2 Desktop Engine (src-tauri/src/main.rs)</span>
            </h3>
            <button
              onClick={() => copyCode(rustMainCode, 'rust')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5"
            >
              {copiedIndex === 'rust' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedIndex === 'rust' ? 'تم النسخ' : 'نسخ كود Rust'}</span>
            </button>
          </div>

          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto leading-relaxed">
            {rustMainCode}
          </pre>
        </div>
      )}

      {/* Sub-Tab 3: SQLite Schema */}
      {activeSubTab === 'schema' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span>مخطط قاعدة بيانات SQLite المحلية (Local SQLite DDL)</span>
            </h3>
            <button
              onClick={() => copyCode(sqliteSchemaCode, 'sql')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5"
            >
              {copiedIndex === 'sql' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedIndex === 'sql' ? 'تم النسخ' : 'نسخ SQL'}</span>
            </button>
          </div>

          <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-purple-300 overflow-x-auto leading-relaxed">
            {sqliteSchemaCode}
          </pre>
        </div>
      )}

      {/* Sub-Tab 4: Zero-Trust Security */}
      {activeSubTab === 'security' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>معايير الأمان والتشفير العسكري (Zero-Trust Security Standard)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <h4 className="font-bold text-emerald-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                تشفير البيانات الحساسة (AES-256-GCM)
              </h4>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                جميع ملفات الجلسات (Cookies)، مفاتيح التوثيق، وسجلات العملاء تخزن مشفرة محلياً بمفتاح مشتق من كلمة مرور المستخدم باستخدام خوارزمية Argon2id المقاومة لهجمات القوة الغاشمة (Brute Force).
              </p>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <h4 className="font-bold text-cyan-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                عزل كامل لجلسات الحسابات (Data Isolation)
              </h4>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                كل حساب يعمل داخل WebView معزول ببصمة رقمية مختلفة (User-Agent, Canvas Fingerprint, WebGL Vendor, Timezone) وموجه عبر عنوان Proxy سكني مخصص لمنع أي ارتباط بين الحسابات.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
