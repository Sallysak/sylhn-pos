/**
 * ZAI API wrapper — production-grade AI integration with graceful fallback.
 *
 * Primary path: z-ai-web-dev-sdk (handles config discovery automatically).
 *   - In dev sandbox: reads /etc/.z-ai-config
 *   - In Vercel prod: reads ZAI_API_KEY + ZAI_TOKEN env vars (if set)
 *
 * Fallback: if AI isn't configured, callers should use a rule-based response
 * generator (see `generateRuleBasedResponse` in ai-rules.ts) so the assistant
 * ALWAYS returns useful business insights — never a 503.
 */

import ZAI from "z-ai-web-dev-sdk";

let cachedClient: any = null;
let cachedConfigured: boolean | null = null;

/**
 * Initialize the ZAI client. Reads from env vars or .z-ai-config file.
 * Returns null if not configured (caller should use fallback).
 */
async function getClient(): Promise<any | null> {
  if (cachedClient) return cachedClient;
  try {
    cachedClient = await ZAI.create();
    return cachedClient;
  } catch (e) {
    // Not configured
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
    throw new Error("ZAI not configured. Set ZAI_API_KEY + ZAI_TOKEN env vars, or create .z-ai-config.");
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
