/**
 * ZAI API wrapper — calls the Z.AI chat completions API directly via fetch.
 *
 * Why not use the `z-ai-web-dev-sdk` package?
 * The SDK requires a `.z-ai-config` file in cwd/home//etc, which doesn't
 * exist on Vercel serverless. This wrapper reads from env vars instead,
 * so it works in any deployment.
 *
 * Required env vars:
 *   ZAI_API_KEY   — API key (default: "Z.ai" for the public Z.AI playground)
 *   ZAI_TOKEN     — JWT auth token (X-Token header)
 *   ZAI_BASE_URL  — API base URL (default: https://internal-api.z.ai/v1)
 *
 * Optional:
 *   ZAI_CHAT_ID   — chat session ID (X-Chat-Id header)
 *   ZAI_USER_ID   — user ID (X-User-Id header)
 *
 * On the dev sandbox, falls back to /etc/.z-ai-config if env vars are missing.
 */

interface ZaiConfig {
  baseUrl: string;
  apiKey: string;
  token: string;
  chatId?: string;
  userId?: string;
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

interface ChatCompletionResponse {
  choices: Array<{
    finish_reason: string;
    index: number;
    message: { content: string; role: string };
  }>;
  created: number;
  id: string;
  model: string;
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
}

let cachedConfig: ZaiConfig | null = null;

async function loadConfig(): Promise<ZaiConfig> {
  if (cachedConfig) return cachedConfig;

  // 1. Env vars take priority
  if (process.env.ZAI_API_KEY && process.env.ZAI_TOKEN) {
    cachedConfig = {
      baseUrl: process.env.ZAI_BASE_URL || "https://internal-api.z.ai/v1",
      apiKey: process.env.ZAI_API_KEY,
      token: process.env.ZAI_TOKEN,
      chatId: process.env.ZAI_CHAT_ID,
      userId: process.env.ZAI_USER_ID,
    };
    return cachedConfig;
  }

  // 2. Fall back to .z-ai-config file (dev sandbox)
  const fs = await import("fs");
  const path = await import("path");
  const os = await import("os");
  const configPaths = [
    path.join(process.cwd(), ".z-ai-config"),
    path.join(os.default.homedir(), ".z-ai-config"),
    "/etc/.z-ai-config",
  ];
  for (const filePath of configPaths) {
    try {
      const configStr = fs.default.readFileSync(filePath, "utf-8");
      const config = JSON.parse(configStr);
      if (config.baseUrl && config.apiKey && config.token) {
        cachedConfig = config as ZaiConfig;
        return cachedConfig;
      }
    } catch {
      // file doesn't exist or invalid — try next
    }
  }

  throw new Error(
    "ZAI not configured. Set ZAI_API_KEY and ZAI_TOKEN env vars, " +
    "or create .z-ai-config with {baseUrl, apiKey, token}."
  );
}

/**
 * Check if ZAI is configured (without throwing).
 * Used by API routes to return a helpful error to the client.
 */
export async function isZaiConfigured(): Promise<boolean> {
  try {
    await loadConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a chat completion (OpenAI-compatible interface).
 * Mirrors the z-ai-web-dev-sdk's `zai.chat.completions.create()` method.
 */
export async function createChatCompletion(opts: ChatCompletionOptions): Promise<ChatCompletionResponse> {
  const config = await loadConfig();
  const url = `${config.baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
    "X-Z-AI-from": "Z",
    "X-Token": config.token,
  };
  if (config.chatId) headers["X-Chat-Id"] = config.chatId;
  if (config.userId) headers["X-User-Id"] = config.userId;

  const requestBody = {
    messages: opts.messages,
    thinking: opts.thinking || { type: "disabled" },
    ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    ...(opts.maxTokens !== undefined && { max_tokens: opts.maxTokens }),
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`ZAI API request failed: ${response.status} ${errorBody.slice(0, 500)}`);
  }

  return (await response.json()) as ChatCompletionResponse;
}

/**
 * Convenience: send messages and get back the assistant's text response.
 */
export async function chat(opts: ChatCompletionOptions): Promise<string> {
  const result = await createChatCompletion(opts);
  return result.choices[0]?.message?.content || "";
}
