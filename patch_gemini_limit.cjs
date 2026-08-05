const fs = require('fs');
let content = fs.readFileSync('src/internato/services/geminiService.ts', 'utf-8');

content = content.replace(
  'export async function generateWithAI(prompt: string, model: string = "gemini-3.1-flash-lite", credits: number = 1) {\n  try {\n    await checkUsageLimit();',
  'export async function generateWithAI(prompt: string, model: string = "gemini-3.1-flash-lite", credits: number = 1) {\n  try {\n    if (credits > 0) { await checkUsageLimit(); }'
);

fs.writeFileSync('src/internato/services/geminiService.ts', content);
