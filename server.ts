import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1:8b";
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL ?? "";

interface ChatMessageInput {
  readonly role: "user" | "assistant" | "model";
  readonly text: string;
}

interface OllamaTextMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
  readonly images?: readonly string[];
}

interface OllamaResponse {
  readonly message?: {
    readonly content?: string;
  };
  readonly response?: string;
  readonly model?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function sanitizeModelName(value: unknown, fallback: string): string {
  const candidate = getString(value, fallback).trim();
  if (!/^[a-zA-Z0-9._:@/-]{1,100}$/.test(candidate)) return fallback;
  return candidate;
}

function mapRole(role: ChatMessageInput["role"]): "user" | "assistant" {
  return role === "user" ? "user" : "assistant";
}

function extractOllamaText(payload: unknown): string {
  if (!isRecord(payload)) return "";
  const message = isRecord(payload.message) ? payload.message : undefined;
  const messageContent = message ? getString(message.content) : "";
  return messageContent || getString(payload.response);
}

async function ollamaRequest(
  body: Readonly<Record<string, unknown>>,
): Promise<{ readonly model: string; readonly text: string }> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stream: false, ...body }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Ollama request failed (${response.status})${errorText ? `: ${errorText.slice(0, 300)}` : ""}`);
  }

  const payload: unknown = await response.json();
  const model = isRecord(payload) ? getString(payload.model, OLLAMA_MODEL) : OLLAMA_MODEL;
  const text = extractOllamaText(payload);

  if (!text.trim()) {
    throw new Error("Ollama returned an empty response");
  }

  return { model, text };
}

const ROLE_SYSTEM_INSTRUCTIONS: Readonly<Record<string, string>> = {
  marketing_strategist:
    "أنت استراتيجي تسويق رقمي. قدّم خططاً عملية، قابلة للقياس، ومناسبة للسوق العربي. لا تخترع أرقاماً أو نتائج غير موثقة.",
  copywriter:
    "أنت كاتب محتوى وتسويق عربي. اكتب بصياغة واضحة وملائمة للمنصة، وتجنب الادعاءات غير المثبتة.",
  antiban_specialist:
    "أنت مستشار سلامة وتشغيل للمنصات. اشرح حدود المنصة، معدلات التشغيل المحافظة، وإيقاف التنفيذ عند التحديات. لا تقدّم طرقاً لتجاوز أنظمة مكافحة الإساءة أو كشف الأتمتة.",
  crm_closer:
    "أنت مستشار نجاح عملاء ومبيعات. صنّف العملاء، اقترح أسئلة متابعة، وصغ ردوداً واضحة دون تضليل أو ضغط غير مناسب.",
};

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.post("/api/chat", async (req, res) => {
  try {
    const body: unknown = req.body;
    if (!isRecord(body)) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const messages: ChatMessageInput[] = rawMessages
      .filter(isRecord)
      .map((message) => ({
        role:
          message.role === "model" || message.role === "assistant"
            ? message.role
            : "user",
        text: getString(message.text),
      }))
      .filter((message) => message.text.trim().length > 0);

    if (messages.length === 0) {
      return res.status(400).json({ error: "قائمة الرسائل فارغة أو غير صحيحة" });
    }

    const roleId = getString(body.roleId, "marketing_strategist");
    const customInstruction = getString(body.customSystemInstruction).trim();
    const profile = getString(body.profile, "balanced");
    const requestedModel = sanitizeModelName(body.model, OLLAMA_MODEL);
    const selectedModel =
      profile === "default" || profile === "balanced" ? OLLAMA_MODEL : requestedModel;

    const instruction = ROLE_SYSTEM_INSTRUCTIONS[roleId] ?? ROLE_SYSTEM_INSTRUCTIONS.marketing_strategist;
    const systemContent = customInstruction
      ? `${instruction}\n\nتعليمات إضافية:\n${customInstruction}`
      : instruction;

    const contents: OllamaTextMessage[] = [
      { role: "system", content: systemContent },
      ...messages.map((message) => ({
        role: mapRole(message.role),
        content: message.text,
      })),
    ];

    const result = await ollamaRequest({ model: selectedModel, messages: contents });
    return res.json({ text: result.text, modelUsed: result.model, provider: "ollama-local" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "حدث خطأ أثناء معالجة الطلب";
    return res.status(502).json({ error: message });
  }
});

app.post("/api/generate-content", async (req, res) => {
  try {
    const body: unknown = req.body;
    if (!isRecord(body)) return res.status(400).json({ error: "Invalid request body" });

    const topic = getString(body.topic).trim();
    if (!topic) return res.status(400).json({ error: "يرجى كتابة فكرة أو موضوع المحتوى" });

    const dialect = getString(body.dialect, "فصحى مبسطة");
    const tone = getString(body.tone, "احترافي");
    const audience = getString(body.targetAudience, "الجمهور العام");

    const prompt = `أنشئ حزمة محتوى تسويقية عربية متعددة المنصات بناءً على:
الموضوع: ${topic}
اللهجة: ${dialect}
النبرة: ${tone}
الجمهور: ${audience}

اكتب أقساماً منفصلة لـ:
1) Facebook
2) Instagram
3) WhatsApp
4) Reels/TikTok script
5) Telegram/X

التزم بالحقائق التي أعطاها المستخدم، ولا تضف أرقام أداء أو ضمانات غير مثبتة.`;

    const result = await ollamaRequest({
      model: OLLAMA_MODEL,
      messages: [{ role: "user", content: prompt }],
      options: { temperature: 0.8 },
    });

    return res.json({
      content: result.text,
      modelUsed: result.model,
      provider: "ollama-local",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "فشل توليد المحتوى";
    return res.status(502).json({ error: message });
  }
});

app.post("/api/analyze-image", async (req, res) => {
  try {
    if (!OLLAMA_VISION_MODEL) {
      return res.status(503).json({
        error: "لم يتم إعداد نموذج رؤية محلي. اضبط OLLAMA_VISION_MODEL في .env.",
      });
    }

    const body: unknown = req.body;
    if (!isRecord(body)) return res.status(400).json({ error: "Invalid request body" });

    const rawImage = getString(body.imageBase64).trim();
    if (!rawImage) return res.status(400).json({ error: "لم يتم إرسال الصورة" });

    const imageBase64 = rawImage.includes(",") ? rawImage.split(",").at(-1) ?? "" : rawImage;
    if (!imageBase64 || imageBase64.length > 15_000_000) {
      return res.status(400).json({ error: "حجم الصورة غير صالح" });
    }

    const analysisType = getString(body.analysisType, "comprehensive");
    const extraPrompt = getString(body.prompt).trim();

    const basePrompt: Readonly<Record<string, string>> = {
      ad_critique:
        "حلل الإعلان من حيث الرسالة، التسلسل البصري، CTA، نقاط القوة، نقاط الضعف، وتحسينات عملية.",
      ocr_copy:
        "استخرج النصوص الظاهرة، ثم صنفها إلى عنوان وعرض وCTA وبيانات تواصل، واقترح صياغة أوضح.",
      platform_fit:
        "قيّم ملاءمة التصميم لأحجام وممارسات المحتوى الشائعة على Instagram وFacebook وTikTok وWhatsApp.",
      comprehensive:
        "قدّم مراجعة شاملة للفكرة، التصميم، النص، وضوح العرض، الجمهور المحتمل، وتحسينات عملية قابلة للاختبار.",
    };

    const prompt = `${basePrompt[analysisType] ?? basePrompt.comprehensive}
${extraPrompt ? `\nطلبات إضافية:\n${extraPrompt}` : ""}`;

    const result = await ollamaRequest({
      model: OLLAMA_VISION_MODEL,
      messages: [{
        role: "user",
        content: prompt,
        images: [imageBase64],
      }],
    });

    return res.json({
      analysis: result.text,
      modelUsed: result.model,
      provider: "ollama-local",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "فشل تحليل الصورة";
    return res.status(502).json({ error: message });
  }
});

app.get("/api/health", async (_req, res) => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    });

    return res.status(response.ok ? 200 : 503).json({
      status: response.ok ? "ok" : "degraded",
      service: "Orbit Marketing OS Local Runtime",
      provider: "ollama-local",
      model: OLLAMA_MODEL,
      visionConfigured: Boolean(OLLAMA_VISION_MODEL),
    });
  } catch {
    return res.status(503).json({
      status: "offline",
      service: "Orbit Marketing OS Local Runtime",
      provider: "ollama-local",
      model: OLLAMA_MODEL,
      visionConfigured: Boolean(OLLAMA_VISION_MODEL),
    });
  }
});

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, () => {
    process.stdout.write(`Orbit Marketing OS local runtime listening on ${PORT}\n`);
  });
}

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Failed to start server";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
