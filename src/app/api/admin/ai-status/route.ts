import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isZaiConfigured } from "@/lib/zai";

// GET /api/admin/ai-status — diagnostic endpoint that shows the AI configuration
// status without exposing secrets. Helps debug "AI service unavailable" errors.
//
// Usage (browser console, logged in as admin):
//   fetch('/api/admin/ai-status', {headers:{'Authorization':'Bearer '+localStorage.getItem('sylhn-session-token')}}).then(r=>r.json()).then(console.log)

export async function GET() {
  try { await requireAuth(); } catch (e: any) { return e as Response; }

  const aiBaseUrl = process.env.AI_BASE_URL;
  const aiApiKey = process.env.AI_API_KEY;
  const aiModel = process.env.AI_MODEL;
  const zaiApiKey = process.env.ZAI_API_KEY;
  const zaiBaseUrl = process.env.ZAI_BASE_URL;
  const zaiToken = process.env.ZAI_TOKEN;
  const zaiChatId = process.env.ZAI_CHAT_ID;
  const zaiUserId = process.env.ZAI_USER_ID;

  let zaiConfigured = false;
  try {
    zaiConfigured = await isZaiConfigured();
  } catch {
    zaiConfigured = false;
  }

  return NextResponse.json({
    // ===== Groq / OpenAI path (AI_BASE_URL + AI_API_KEY) =====
    groq: {
      configured: !!(aiBaseUrl && aiApiKey),
      baseUrl: aiBaseUrl ? aiBaseUrl.replace(/\/$/, '') : "(not set)",
      apiKey: aiApiKey ? `${aiApiKey.slice(0, 6)}...${aiApiKey.slice(-4)}` : "(not set)",
      model: aiModel || "(default: llama-3.3-70b-versatile)",
      endpoint: aiBaseUrl ? `${aiBaseUrl.replace(/\/$/, '')}/chat/completions` : "(not set)",
    },
    // ===== Z.AI SDK path (ZAI_API_KEY + optional ZAI_TOKEN) =====
    zai: {
      configured: zaiConfigured,
      apiKey: zaiApiKey ? `${zaiApiKey.slice(0, 4)}...` : "(not set)",
      baseUrl: zaiBaseUrl || "(default: https://internal-api.z.ai/v1)",
      hasToken: !!zaiToken,
      hasChatId: !!zaiChatId,
      hasUserId: !!zaiUserId,
    },
    // ===== Which path will be tried first? =====
    primaryPath: (aiBaseUrl && aiApiKey) ? "groq" : (zaiConfigured ? "zai" : "none"),
    // ===== Recommendations =====
    recommendations: getRecommendations(!!(aiBaseUrl && aiApiKey), zaiConfigured, !!zaiToken),
  });
}

function getRecommendations(groqConfigured: boolean, zaiConfigured: boolean, zaiHasToken: boolean): string[] {
  const recs: string[] = [];

  if (groqConfigured) {
    recs.push("✅ Groq/OpenAI is configured (AI_BASE_URL + AI_API_KEY). This is the primary path.");
    recs.push("   If AI still fails, check that AI_API_KEY is valid at https://console.groq.com/keys");
    recs.push("   Test: curl -X POST $AI_BASE_URL/chat/completions -H 'Authorization: Bearer $AI_API_KEY' -d '{\"model\":\"llama-3.3-70b-versatile\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"max_tokens\":10}'");
  } else {
    recs.push("❌ Groq/OpenAI NOT configured. Set these env vars in Railway:");
    recs.push("   AI_BASE_URL=https://api.groq.com/openai/v1");
    recs.push("   AI_API_KEY=<your Groq key from https://console.groq.com/keys>");
    recs.push("   AI_MODEL=llama-3.3-70b-versatile");
    recs.push("");
    recs.push("   OR use Z.AI instead (see below).");
  }

  recs.push("");

  if (zaiConfigured) {
    recs.push("✅ Z.AI SDK is also configured as a fallback.");
    if (!zaiHasToken) {
      recs.push("   ⚠️ ZAI_TOKEN is not set — Z.AI may reject requests without it.");
      recs.push("   Set ZAI_TOKEN + ZAI_CHAT_ID + ZAI_USER_ID for reliable Z.AI access.");
    }
  } else {
    recs.push("❌ Z.AI SDK NOT configured (fallback won't work either).");
    recs.push("   To use Z.AI instead of Groq, set these 5 env vars in Railway:");
    recs.push("   ZAI_API_KEY=Z.ai");
    recs.push("   ZAI_BASE_URL=https://internal-api.z.ai/v1");
    recs.push("   ZAI_TOKEN=<JWT token>");
    recs.push("   ZAI_CHAT_ID=<chat ID>");
    recs.push("   ZAI_USER_ID=<user ID>");
  }

  return recs;
}
