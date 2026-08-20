/**
 * ZAI API wrapper — production-grade AI integration with graceful fallback.
 *
 * Config discovery (in priority order):
 *   1. ENV VARS: ZAI_API_KEY + ZAI_BASE_URL + ZAI_TOKEN (Railway/production)
 *   2. CONFIG FILE: .z-ai-config in CWD/home/etc (dev sandbox)
 *   3. Returns null if neither is available (caller uses fallback)
 *
 * Fallback: if AI isn't configured, callers should use a rule-based response
 * generator (see `generateRuleBasedResponse` in ai-rules.ts) so the assistant
 * ALWAYS returns useful business insights — never a 503.
 */

import ZAI from "z-ai-web-dev-sdk";

let cachedClient: any = null;
let cachedConfigured: boolean | null = null;

/**
 * Initialize the ZAI client. Tries env vars first (production), then
 * the SDK's built-in config file discovery (dev sandbox).
 * Returns null if neither is configured.
 */
async function getClient(): Promise<any | null> {
  if (cachedClient) return cachedClient;

  // ===== PATH 1: Build client from env vars (Railway/production) =====
  // The Z.AI SDK's built-in ZAI.create() only reads from a config FILE,
  // which doesn't exist on Railway. So we build the client manually from
  // env vars using the SDK's constructor directly.
  const envApiKey = process.env.ZAI_API_KEY;
  const envBaseUrl = process.env.ZAI_BASE_URL || "https://internal-api.z.ai/v1";
  const envToken = process.env.ZAI_TOKEN;
  const envChatId = process.env.ZAI_CHAT_ID;
  const envUserId = process.env.ZAI_USER_ID;

  if (envApiKey) {
    try {
      // The ZAI constructor takes a config object — we build it from env vars
      // instead of relying on the config file discovery.
      cachedClient = new (ZAI as any)({
        apiKey: envApiKey,
        baseUrl: envBaseUrl,
        ...(envToken && { token: envToken }),
        ...(envChatId && { chatId: envChatId }),
        ...(envUserId && { userId: envUserId }),
      });
      return cachedClient;
    } catch (e: any) {
      console.warn("[zai] Failed to build client from env vars:", e?.message);
      // Fall through to config file path
    }
  }

  // ===== PATH 2: SDK's built-in config file discovery (dev sandbox) =====
  // In the dev sandbox, /etc/.z-ai-config exists with valid credentials.
  // On Railway, this file doesn't exist — ZAI.create() will throw.
  try {
    cachedClient = await ZAI.create();
    return cachedClient;
  } catch (e) {
    // Not configured — this is expected on Railway if env vars aren't set
    return null;
  }
}

/**
 * Check if ZAI is configured (without throwing).
 */
export async function isZaiConfigured(): Promise<boolean> {
  if (cachedConfigured !== null) return cachedConfigured;
  const client = await getClient();
  cachedConfigured = client !== null;
  return cachedConfigured;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionOptions {
  messages: ChatMessage[];
  thinking?: { type: "disabled" | "enabled" };
  temperature?: number;
  maxTokens?: number;
}

/**
 * Create a chat completion (OpenAI-compatible interface).
 * Throws if ZAI is not configured — callers should check isZaiConfigured() first.
 */
export async function createChatCompletion(opts: ChatCompletionOptions): Promise<{
  choices: Array<{
    finish_reason: string;
    index: number;
    message: { content: string; role: string };
  }>;
  created: number;
  id: string;
  model: string;
  usage: { completion_tokens: number; prompt_tokens: number; total_tokens: number };
}> {
  const client = await getClient();
  if (!client) {
    throw new Error("ZAI not configured. Set ZAI_API_KEY env var in Railway.");
  }
  return await client.chat.completions.create({
    messages: opts.messages,
    thinking: opts.thinking || { type: "disabled" },
    ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    ...(opts.maxTokens !== undefined && { max_tokens: opts.maxTokens }),
  });
}

/**
 * Convenience: send messages and get back the assistant's text response.
 */
export async function chat(opts: ChatCompletionOptions): Promise<string> {
  const result = await createChatCompletion(opts);
  return result.choices[0]?.message?.content || "";
}
