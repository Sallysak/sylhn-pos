// Quick test: does the AI assistant actually work?
import ZAI from 'z-ai-web-dev-sdk';

const zai = await ZAI.create();
const response = await zai.chat.completions.create({
  messages: [
    { role: 'system', content: 'You are a helpful assistant. Reply with one short sentence.' },
    { role: 'user', content: 'Say hello' },
  ],
  thinking: { type: 'disabled' },
});

console.log('Response:', response.choices[0]?.message?.content);
