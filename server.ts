import express from 'express';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id
        });
        console.log('Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT environment variable');
      } catch (jsonErr) {
        console.error('FIREBASE_SERVICE_ACCOUNT parsing failed, trying ADC instead:', jsonErr);
        admin.initializeApp();
      }
    } else {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        admin.initializeApp({
          projectId: firebaseConfig.projectId,
        });
        console.log('Firebase Admin initialized from JSON config file');
      } else if (process.env.FIREBASE_PROJECT_ID) {
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
        console.log('Firebase Admin initialized from FIREBASE_PROJECT_ID environment variable');
      } else {
        admin.initializeApp();
        console.log('Firebase Admin initialized using Application Default Credentials (ADC)');
      }
    }
  } catch (e) {
    console.error('Failed to load firebase config for admin:', e);
  }
}

let db: admin.firestore.Firestore | null = null;
if (admin.apps.length) {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const firebaseConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : null;
    const databaseId = firebaseConfig?.firestoreDatabaseId || process.env.FIRESTORE_DATABASE_ID;
    
    const app = admin.apps[0];
    if (databaseId) {
      db = getFirestore(app, databaseId);
      console.log(`Firestore Database instance selected: ${databaseId}`);
    } else {
      db = getFirestore(app);
      console.log('Firestore Database default instance selected');
    }
  } catch (err) {
    console.error('Failed to initialize specific Firestore database instance. Falling back to default:', err);
    db = getFirestore();
  }
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mercadopago: !!process.env.MERCADO_PAGO_ACCESS_TOKEN });
});

// AI Usage Stats and Status Tracking
const aiUsageStats = {
  groq: { requestsToday: 0, errorsToday: 0, lastUsed: null as string | null, status: "OK", lastError: null as string | null },
  gemini: { requestsToday: 0, errorsToday: 0, lastUsed: null as string | null, status: "OK", lastError: null as string | null },
  lastActiveProvider: "Nenhum ainda",
  lastActiveModel: "Nenhum ainda",
  lastCallTime: null as string | null
};

// Helper to atomicaly update provider request counts in Firestore
async function persistProviderCall(provider: string, email: string) {
  if (!db || !email) return;
  try {
    const today = new Date().toISOString().split('T')[0];
    const userEmail = email.toLowerCase().trim();
    const isSpecialUser = userEmail === 'ysabelleosaraiva@gmail.com' || userEmail === 'lucas1renck2melo@gmail.com';

    if (isSpecialUser) {
      const globalStatsRef = db.collection('global').doc('stats');
      await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(globalStatsRef);
        let providerStats: any = {};
        if (docSnap.exists) {
          const data = docSnap.data();
          providerStats = data?.providerStats || {};
        }
        if (!providerStats[today]) {
          providerStats[today] = { groq: 0, gemini: 0 };
        }
        providerStats[today][provider] = (providerStats[today][provider] || 0) + 1;
        transaction.set(globalStatsRef, { providerStats }, { merge: true });
      });
      console.log(`[Persist Provider] Updated VIP global/stats providerStats.${today}.${provider}`);
    } else {
      const userQuery = await db.collection('users').where('email', '==', userEmail).get();
      if (!userQuery.empty) {
        const userDocRef = userQuery.docs[0].ref;
        await db.runTransaction(async (transaction) => {
          const docSnap = await transaction.get(userDocRef);
          let providerStats: any = {};
          if (docSnap.exists) {
            const data = docSnap.data();
            providerStats = data?.providerStats || {};
          }
          if (!providerStats[today]) {
            providerStats[today] = { groq: 0, gemini: 0 };
          }
          providerStats[today][provider] = (providerStats[today][provider] || 0) + 1;
          transaction.set(userDocRef, { providerStats }, { merge: true });
        });
        console.log(`[Persist Provider] Updated user ${userEmail} providerStats.${today}.${provider}`);
      }
    }
  } catch (err: any) {
    const isPermissionError = err?.code === 7 || (err?.message && (err.message.includes('PERMISSION_DENIED') || err.message.includes('insufficient permissions')));
    if (!isPermissionError) {
      console.log(`[Persist Provider Call] Firestore provider stats update skipped:`, err.message);
    }
  }
}

// Helper for Groq API Call (Llama 3.3 70B, Llama 3.1 8B, Mixtral Fallback)
async function callGroqApi(apiKey: string, action: string, promptText: string, payload: any): Promise<string> {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  let contentToUse: string = promptText || payload?.prompt || "";

  if (action === 'importPdf') {
    const { fileData, promptText: pText } = payload || {};
    if (typeof fileData === 'string' && (fileData.startsWith('JVBERi0') || fileData.startsWith('iVBORw0') || fileData.startsWith('/9j/'))) {
      throw new Error("Provedor de texto simples não suporta PDF binário sem camada de texto. Redirecionando para Gemini Multimodal...");
    }
    contentToUse = `${pText || "Analise este documento de medicina e crie um resumo de cronograma em JSON."}\n\nDOCUMENTO:\n${fileData || ''}`;
  }

  // Safety truncation for Groq free tier per-request token limits
  if (typeof contentToUse === 'string' && contentToUse.length > 14000) {
    console.log(`[Groq] Truncando prompt de ${contentToUse.length} para 14000 caracteres para adequação ao Groq.`);
    contentToUse = contentToUse.substring(0, 14000) + "\n\n[...Texto otimizado para limite de tokens do Groq...]";
  }

  const isJsonRequest = action === 'generateJson' || (typeof promptText === 'string' && (promptText.includes('"weeks":') || promptText.toLowerCase().includes('retorne estritamente um objeto json')));

  const systemMessage = isJsonRequest
    ? "Você é um assistente e preceptor médico de internato de alto nível. Responda exclusivamente em formato JSON válido."
    : "Você é um assistente médico especialista e preceptor de internato de alto nível em medicina. Responda em Markdown claro e estruturado.";

  const modelsToTry = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  let lastErr: any = null;

  for (const modelName of modelsToTry) {
    try {
      const body: any = {
        model: modelName,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: contentToUse }
        ],
        temperature: 0.3,
        max_tokens: 4000
      };

      if (isJsonRequest) {
        body.response_format = { type: "json_object" };
      }

      console.log(`[Groq ${modelName}] Disparando requisição...`);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 429) {
          console.warn(`[Groq] Rate limit (429) em ${modelName}. Aguardando 800ms antes do próximo modelo...`);
          await new Promise(r => setTimeout(r, 800));
        }
        if (response.status === 400 && errText.includes("messages") && contentToUse.length > 7000) {
          console.warn(`[Groq] HTTP 400 em ${modelName}. Re-tentando com conteúdo reduzido...`);
          const shorterContent = contentToUse.substring(0, 7000) + "\n\n[...Texto resumido para cota do Groq...]";
          const retryBody = { ...body, messages: [{ role: "system", content: systemMessage }, { role: "user", content: shorterContent }] };
          const retryResp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify(retryBody)
          });
          if (retryResp.ok) {
            const retryData = await retryResp.json();
            const text = retryData.choices?.[0]?.message?.content || "";
            if (text.trim().length > 0) return text;
          }
        }
        lastErr = new Error(`[Groq API HTTP ${response.status}] ${errText}`);
        continue;
      }

      const data = await response.json();
      const textResult = data.choices?.[0]?.message?.content || "";
      if (textResult && textResult.trim().length > 0) {
        return textResult;
      }
    } catch (err: any) {
      lastErr = err;
      console.warn(`[Groq] Falha no modelo ${modelName}: ${err.message}`);
    }
  }

  throw lastErr || new Error("Falha no serviço Groq.");
}

// Endpoint para consultar status e estatísticas dos provedores de IA
app.get("/api/ai-provider-stats", async (req, res) => {
  const allEnv = process.env;
  const groqKey = allEnv['GROQ_API_KEY'];
  const geminiKey1 = allEnv['GEMINI_API_KEY_1'] || allEnv['GEMINI_API_KEY'];
  const geminiKey2 = allEnv['GEMINI_API_KEY_2'];
  const geminiKey3 = 'AIzaSyAWH3Rvgzj2ku_i-Vy7iizZ1TeqGFVKMSo';

  const emailParam = (req.query.email || "").toString().toLowerCase().trim();
  const today = new Date().toISOString().split('T')[0];

  let requestsTodayGroq = aiUsageStats.groq.requestsToday;
  let requestsTodayGemini = aiUsageStats.gemini.requestsToday;

  if (db && emailParam) {
    try {
      const isSpecialUser = emailParam === 'ysabelleosaraiva@gmail.com' || emailParam === 'lucas1renck2melo@gmail.com';
      if (isSpecialUser) {
        const globalStatsDoc = await db.collection('global').doc('stats').get();
        if (globalStatsDoc.exists) {
          const data = globalStatsDoc.data();
          const providerStats = data?.providerStats?.[today];
          if (providerStats) {
            requestsTodayGroq = Math.max(requestsTodayGroq, providerStats.groq || 0);
            requestsTodayGemini = Math.max(requestsTodayGemini, providerStats.gemini || 0);
          }
        }
      } else {
        const userQuery = await db.collection('users').where('email', '==', emailParam).get();
        if (!userQuery.empty) {
          const userData = userQuery.docs[0].data();
          const providerStats = userData?.providerStats?.[today];
          if (providerStats) {
            requestsTodayGroq = Math.max(requestsTodayGroq, providerStats.groq || 0);
            requestsTodayGemini = Math.max(requestsTodayGemini, providerStats.gemini || 0);
          }
        }
      }
    } catch (err: any) {
      const isPermissionError = err?.code === 7 || (err?.message && (err.message.includes('PERMISSION_DENIED') || err.message.includes('insufficient permissions')));
      if (!isPermissionError) {
        console.log('[Stats API] Optional persisted provider stats skipped:', err.message);
      }
    }
  }

  return res.json({
    providers: {
      groq: {
        id: "groq",
        name: "Groq Cloud (Llama 3.3 70B)",
        configured: Boolean(groqKey && groqKey.length > 10),
        status: aiUsageStats.groq.status,
        lastError: aiUsageStats.groq.lastError,
        requestsToday: requestsTodayGroq,
        errorsToday: aiUsageStats.groq.errorsToday,
        lastUsed: aiUsageStats.groq.lastUsed,
        pricing: "Gratuito no Tier de Teste",
        limits: "30 RPM / 14.400 RPD",
        freeTierStatus: "Inferência de ultra velocidade em LPU",
        priorityForSpecialUsers: "Prioridade #1 se configurada"
      },
      gemini: {
        id: "gemini",
        name: "Google Gemini (2.0 Flash / Lite / 1.5)",
        configured: Boolean((geminiKey1 && geminiKey1.length > 10) || (geminiKey2 && geminiKey2.length > 10) || (geminiKey3 && geminiKey3.length > 10)),
        status: aiUsageStats.gemini.status,
        lastError: aiUsageStats.gemini.lastError,
        key1Configured: Boolean(geminiKey1 && geminiKey1.length > 10),
        key2Configured: Boolean(geminiKey2 && geminiKey2.length > 10),
        key3Configured: Boolean(geminiKey3 && geminiKey3.length > 10),
        requestsToday: requestsTodayGemini,
        errorsToday: aiUsageStats.gemini.errorsToday,
        lastUsed: aiUsageStats.gemini.lastUsed,
        pricing: "Tier Gratuito (15 RPM por chave / com rotação automática)",
        limits: "15 RPM (Free) / 1.000 RPM (Pay-as-you-go)",
        freeTierStatus: "Multi-chave em Rotação Automática com Fallback de Modelos",
        priorityForSpecialUsers: "Chaves VIP 2 & 3"
      }
    },
    lastActiveProvider: aiUsageStats.lastActiveProvider,
    lastActiveModel: aiUsageStats.lastActiveModel,
    lastCallTime: aiUsageStats.lastCallTime
  });
});

// API route for AI Execution with Gemini Multi-Key / Multi-Model & Groq Fallback
app.post("/api/admin/test-key-billing", async (req, res) => {
  try {
    const { email, keyTarget } = req.body;
    const userEmail = (email || "").toLowerCase().trim();
    const isSpecialUser = userEmail === 'ysabelleosaraiva@gmail.com' || userEmail === 'yasabelleosaraiva@gmail.com' || userEmail === 'lucas1renck2melo@gmail.com';
    
    if (!isSpecialUser) {
      return res.status(403).json({ error: "Não autorizado." });
    }

    const allEnv = process.env;
    const key1 = allEnv['GEMINI_API_KEY_1'] || allEnv['GEMINI_API_KEY'] || process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
    const key2 = allEnv['GEMINI_API_KEY_2'] || process.env.GEMINI_API_KEY_2;
    const key3 = 'AIzaSyAWH3Rvgzj2ku_i-Vy7iizZ1TeqGFVKMSo';
    const groqKey = allEnv['GROQ_API_KEY'] || process.env.GROQ_API_KEY;

    const keysToTest: { name: string; key: string | undefined; code: string; type: 'gemini' | 'groq' }[] = [];

    if (!keyTarget || keyTarget === 'all' || keyTarget === 'key1') {
      keysToTest.push({ name: "Chave 1 (Principal)", key: key1, code: 'key1', type: 'gemini' });
    }
    if (!keyTarget || keyTarget === 'all' || keyTarget === 'key2') {
      keysToTest.push({ name: "Chave 2 (VIP 1)", key: key2, code: 'key2', type: 'gemini' });
    }
    if (!keyTarget || keyTarget === 'all' || keyTarget === 'key3') {
      keysToTest.push({ name: "Chave 3 (VIP 2)", key: key3, code: 'key3', type: 'gemini' });
    }
    if (!keyTarget || keyTarget === 'all' || keyTarget === 'groq') {
      keysToTest.push({ name: "Groq Cloud (LPU)", key: groqKey, code: 'groq', type: 'groq' });
    }

    const testSingleKey = async (apiKey: string | undefined, name: string, code: string, type: 'gemini' | 'groq') => {
      if (!apiKey || apiKey.trim().length < 10 || apiKey === "MY_GEMINI_API_KEY" || apiKey === "GROQ_API_KEY") {
        return {
          code,
          name,
          configured: false,
          maskedKey: "Não configurada",
          isPaid: false,
          hitRateLimit: false,
          successCount: 0,
          failureCount: 0,
          averageLatencyMs: 0,
          diagnosis: "Esta chave não foi configurada no ambiente do servidor."
        };
      }

      const maskedKey = `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`;
      
      if (type === 'groq') {
        console.log(`[Billing Test] Running test on Groq (${maskedKey})...`);
        const start = Date.now();
        try {
          const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: "llama-3.1-8b-instant",
              messages: [{ role: "user", content: "OK" }],
              max_tokens: 5
            })
          });
          const latency = Date.now() - start;
          if (!response.ok) {
            const errText = await response.text();
            return {
              code,
              name,
              configured: true,
              maskedKey,
              isPaid: false,
              hitRateLimit: response.status === 429,
              successCount: 0,
              failureCount: 1,
              averageLatencyMs: latency,
              diagnosis: `Groq retornou erro HTTP ${response.status}: ${errText}`
            };
          }
          return {
            code,
            name,
            configured: true,
            maskedKey,
            isPaid: true,
            hitRateLimit: false,
            successCount: 1,
            failureCount: 0,
            averageLatencyMs: latency,
            diagnosis: `Groq LPU ativo e respondendo perfeitamente em ${latency}ms!`
          };
        } catch (err: any) {
          return {
            code,
            name,
            configured: true,
            maskedKey,
            isPaid: false,
            hitRateLimit: false,
            successCount: 0,
            failureCount: 1,
            averageLatencyMs: Date.now() - start,
            diagnosis: `Erro ao testar Groq: ${err.message}`
          };
        }
      }

      console.log(`[Billing Test] Running burst test on ${name} (${maskedKey})...`);
      
      const ai = new GoogleGenerativeAI(apiKey);
      const modelInstance = ai.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

      const burstCount = 18;
      const promises = Array.from({ length: burstCount }).map(async () => {
        const start = Date.now();
        try {
          const response = await modelInstance.generateContent({
            contents: [{ role: 'user', parts: [{ text: 'OK' }] }],
            generationConfig: { maxOutputTokens: 2 }
          });
          const text = response.response.text();
          return { success: true, latency: Date.now() - start, text };
        } catch (err: any) {
          return { success: false, latency: Date.now() - start, error: err.message || "Erro" };
        }
      });

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      const errors = results.filter(r => !r.success).map(r => r.error);
      const averageLatency = results.filter(r => r.success).reduce((acc, r) => acc + r.latency, 0) / (successCount || 1);

      const hitRateLimit = errors.some(e => 
        e.toLowerCase().includes("quota") || 
        e.toLowerCase().includes("rate limit") || 
        e.toLowerCase().includes("exhausted") || 
        e.includes("429")
      );

      const isPaid = successCount === burstCount && !hitRateLimit;

      let diagnosis = "";
      if (isPaid) {
        diagnosis = `Excelente! A ${name} (${maskedKey}) está se comportando como PAGA (Pay-As-You-Go). Superou 18 requisições simultâneas sem nenhum bloqueio de taxa.`;
      } else if (hitRateLimit) {
        diagnosis = `A ${name} (${maskedKey}) está ativa, mas no plano GRATUITO (Free Tier). Atingiu o limite de 15 RPM (erros 429).`;
      } else if (failureCount > 0) {
        diagnosis = `A ${name} (${maskedKey}) retornou erros: ${Array.from(new Set(errors)).slice(0, 2).join(" | ")}.`;
      } else {
        diagnosis = `Teste concluído para a ${name}.`;
      }

      return {
        code,
        name,
        configured: true,
        maskedKey,
        isPaid,
        hitRateLimit,
        successCount,
        failureCount,
        averageLatencyMs: Math.round(averageLatency),
        diagnosis
      };
    };

    const keyResults = [];
    for (const item of keysToTest) {
      const resKey = await testSingleKey(item.key, item.name, item.code, item.type);
      keyResults.push(resKey);
    }

    const primaryResult = keyResults[0] || {};

    return res.json({
      success: true,
      keyResults,
      isPaid: primaryResult.isPaid ?? false,
      hitRateLimit: primaryResult.hitRateLimit ?? false,
      successCount: primaryResult.successCount ?? 0,
      failureCount: primaryResult.failureCount ?? 0,
      averageLatencyMs: primaryResult.averageLatencyMs ?? 0,
      diagnosis: primaryResult.diagnosis ?? ""
    });

  } catch (err: any) {
    console.error("[Billing Test Error] Exception:", err);
    return res.status(500).json({ error: err.message || "Erro interno ao realizar o teste de faturamento." });
  }
});

// API route for AI Execution with Gemini Multi-Key / Multi-Model & Groq Fallback
app.post("/api/gemini", async (req, res) => {
  try {
    const allEnv = process.env;
    const { action, email, payload } = req.body;
    
    const userEmail = (email || "").toLowerCase().trim();
    const isSpecialUser = userEmail === 'ysabelleosaraiva@gmail.com' || userEmail === 'yasabelleosaraiva@gmail.com' || userEmail === 'lucas1renck2melo@gmail.com';
    const { prompt, model } = payload;
    let modelToUse = model || "gemini-3.1-flash-lite";
    if (typeof modelToUse === 'string') {
      const lowerModel = modelToUse.toLowerCase();
      if (lowerModel.includes("1.5") || lowerModel.includes("2.5-flash-lite") || lowerModel === "gemini-1.5-flash-8b") {
        modelToUse = "gemini-3.1-flash-lite";
      }
    }
    const promptText = prompt || payload.promptText || "";

    const groqKey = allEnv['GROQ_API_KEY'];

    // Collect all valid Gemini keys
    const keyNames = ['GEMINI_API_KEY_1', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY'];
    const allAvailableGeminiKeys = keyNames
      .map(name => allEnv[name])
      .filter(val => val && val !== "MY_GEMINI_API_KEY" && val.trim().length > 10) as string[];

    let vipGeminiKeys: string[] = [];
    let publicGeminiKeys: string[] = [];

    const key1 = allEnv['GEMINI_API_KEY_1'] || allEnv['GEMINI_API_KEY'] || process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
    const key2 = allEnv['GEMINI_API_KEY_2'] || process.env.GEMINI_API_KEY_2;
    const key3 = allEnv['GEMINI_API_KEY_3'] || process.env.GEMINI_API_KEY_3 || key2 || key1;

    if (key2 && key2 !== "MY_GEMINI_API_KEY" && key2.trim().length > 10) vipGeminiKeys.push(key2);
    if (key3 && key3.trim().length > 10) vipGeminiKeys.push(key3);
    if (key1 && key1 !== "MY_GEMINI_API_KEY" && key1.trim().length > 10) publicGeminiKeys.push(key1);
    
    if (vipGeminiKeys.length === 0 && allAvailableGeminiKeys.length > 0) vipGeminiKeys = [...allAvailableGeminiKeys];
    if (publicGeminiKeys.length === 0 && allAvailableGeminiKeys.length > 0) publicGeminiKeys = [...allAvailableGeminiKeys];

    // Deduplicate keys array
    const uniqueGeminiKeys = Array.from(new Set([...publicGeminiKeys, ...vipGeminiKeys, ...allAvailableGeminiKeys]));

    const isValidKey = (k?: string) => Boolean(k && k !== "MY_GEMINI_API_KEY" && k.trim().length > 10);

    const preferredProvider = (payload?.preferredProvider || payload?.preferredEngine || "").toLowerCase().trim();

    let providerSteps: { provider: 'groq' | 'gemini', keys?: string[] }[] = [];

    // Strictly prioritize requested Gemini Key without unwanted fallbacks
    if (preferredProvider === 'gemini_key1' && isValidKey(key1)) {
      providerSteps.push({ provider: 'gemini', keys: [key1!] });
    } else if (preferredProvider === 'gemini_key2' && isValidKey(key2)) {
      providerSteps.push({ provider: 'gemini', keys: [key2!] });
    } else if (preferredProvider === 'gemini_key3' && isValidKey(key3)) {
      providerSteps.push({ provider: 'gemini', keys: [key3!] });
    } else if (preferredProvider === 'groq' && isValidKey(groqKey)) {
      providerSteps.push({ provider: 'groq' });
    } else if (preferredProvider === 'gemini' && uniqueGeminiKeys.length > 0) {
      providerSteps.push({ provider: 'gemini', keys: uniqueGeminiKeys });
    }

    if (providerSteps.length === 0) {
      if (isSpecialUser) {
        // Sequência padrão inteligente para usuários especiais: Chave 1 -> Chave 2 -> Chave 3
        if (isValidKey(key1)) providerSteps.push({ provider: 'gemini', keys: [key1!] });
        if (isValidKey(key2)) providerSteps.push({ provider: 'gemini', keys: [key2!] });
        if (isValidKey(key3)) providerSteps.push({ provider: 'gemini', keys: [key3!] });
        if (isValidKey(groqKey)) providerSteps.push({ provider: 'groq' });
      } else {
        if (uniqueGeminiKeys.length > 0) providerSteps.push({ provider: 'gemini', keys: uniqueGeminiKeys });
        if (isValidKey(groqKey)) providerSteps.push({ provider: 'groq' });
      }
    }

    if (providerSteps.length === 0) {
      console.error("Nenhum provedor de IA configurado no ambiente.");
      return res.status(500).json({ 
        error: "Nenhum provedor de IA está disponível. Configure suas chaves no painel.",
      });
    }

    let success = false;
    let resultText = "";
    let lastError: any = null;

    // Execute provider steps sequentially
    for (const step of providerSteps) {
      if (success) break;

      if (step.provider === 'groq') {
        try {
          console.log(`[AI Engine] Tentando Groq LPU para ${userEmail}...`);
          resultText = await callGroqApi(groqKey!, action, promptText, payload);
          success = true;
          aiUsageStats.groq.requestsToday++;
          aiUsageStats.groq.status = "OK";
          aiUsageStats.groq.lastError = null;
          aiUsageStats.groq.lastUsed = new Date().toISOString();
          aiUsageStats.lastActiveProvider = "Groq Cloud";
          aiUsageStats.lastActiveModel = "llama-3.3-70b-versatile";
          aiUsageStats.lastCallTime = new Date().toLocaleTimeString('pt-BR');
          console.log(`[AI Engine] Sucesso total com Groq Llama 3.3 70B!`);
          await persistProviderCall('groq', userEmail);
        } catch (err: any) {
          lastError = err;
          aiUsageStats.groq.errorsToday++;
          aiUsageStats.groq.lastError = err.message || "Erro";
          aiUsageStats.groq.status = `Erro: ${err.message?.substring(0, 30)}`;
          console.warn(`[AI Engine] Falha no Groq (${err.message}).`);
        }
      } else if (step.provider === 'gemini') {
        const keysToTry = step.keys || [];
        const keysInOrder = keysToTry.length === 1 ? keysToTry : [...keysToTry].sort(() => Math.random() - 0.5);

        // Only gemini-3.1-flash-lite as requested
        const candidateModels = ["gemini-3.1-flash-lite"];

        // Try keys and models intelligently with rate limit backoff
        for (let i = 0; i < keysInOrder.length; i++) {
          if (success) break;
          const apiKey = keysInOrder[i];
          const keyObfuscated = apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 4);
          
          let contentsToUse: any = [{ role: "user", parts: [{ text: promptText }] }];
          if (payload.parts && Array.isArray(payload.parts)) {
            const cleanParts = payload.parts.map((p: any) => {
              const part: any = {};
              if (p.text) part.text = p.text;
              if (p.inlineData) {
                part.inlineData = {
                  data: p.inlineData.data,
                  mimeType: p.inlineData.mimeType
                };
              }
              return part;
            });
            contentsToUse = [{ role: "user", parts: cleanParts }];
          } else if (action === 'importPdf') {
            const { fileData, mimeType, promptText: pText } = payload;
            const isBase64Binary = typeof fileData === 'string' && (
              fileData.startsWith('JVBERi0') || 
              fileData.startsWith('iVBORw0') || 
              fileData.startsWith('/9j/') ||
              fileData.startsWith('R0lGOD')
            );
            
            if (isBase64Binary) {
              const cleanMime = (mimeType || '').toLowerCase();
              const finalMime = cleanMime.includes('image') ? cleanMime : 'application/pdf';
              contentsToUse = [{
                role: "user",
                parts: [
                  { inlineData: { data: fileData, mimeType: finalMime } },
                  { text: pText || "Analise este documento de medicina e extraia as semanas e tópicos." }
                ]
              }];
            } else {
              contentsToUse = [{
                role: "user",
                parts: [{ text: `${pText || "Analise este documento de medicina e extraia as semanas e tópicos."}\n\nCONTEÚDO DO DOCUMENTO:\n${fileData}` }]
              }];
            }
          }

          const ai = new GoogleGenerativeAI(apiKey);

          for (const currentModelName of candidateModels) {
            try {
              console.log(`[AI Engine] Tentando Gemini (${keyObfuscated}) com modelo ${currentModelName}...`);
              let currentResult = "";

              if (action === 'generateImage') {
                const imageModels = ["gemini-3.1-flash-lite"];
                let imageSuccess = false;
                for (const imgModel of imageModels) {
                  try {
                    const modelInstance = ai.getGenerativeModel({ model: imgModel });
                    const result = await modelInstance.generateContent(promptText);
                    const response = result.response;
                    let imageBase64 = "";
                    const parts = response.candidates?.[0]?.content?.parts || [];
                    for (const part of parts) {
                      if (part.inlineData?.data) {
                        imageBase64 = part.inlineData.data;
                        break;
                      }
                    }
                    if (imageBase64) {
                      currentResult = `data:image/png;base64,${imageBase64}`;
                      imageSuccess = true;
                      break;
                    }
                  } catch (imgErr) {
                    // continue
                  }
                }
                if (!imageSuccess) throw new Error("Não foi possível gerar imagem.");
              } else {
                const isJsonReq = action === 'generateJson' || (typeof promptText === 'string' && (promptText.includes('"weeks":') || promptText.toLowerCase().includes('retorne estritamente um objeto json')));
                const genConfig: any = isJsonReq ? { responseMimeType: "application/json" } : {};
                if (action === 'importPdf') genConfig.maxOutputTokens = 65536;

                const modelInstance = ai.getGenerativeModel({
                  model: currentModelName,
                  generationConfig: genConfig,
                });

                const result = await modelInstance.generateContent({ contents: contentsToUse });
                currentResult = result.response.text() || "";
              }

              if (currentResult && currentResult.trim().length > 0) {
                success = true;
                resultText = currentResult;
                aiUsageStats.gemini.requestsToday++;
                aiUsageStats.gemini.status = "OK";
                aiUsageStats.gemini.lastError = null;
                aiUsageStats.gemini.lastUsed = new Date().toISOString();
                aiUsageStats.lastActiveProvider = "Google Gemini";
                aiUsageStats.lastActiveModel = currentModelName;
                aiUsageStats.lastCallTime = new Date().toLocaleTimeString('pt-BR');
                console.log(`[AI Engine] Sucesso total com Gemini (${currentModelName})!`);
                await persistProviderCall('gemini', userEmail);
                break;
              }
            } catch (mErr: any) {
              lastError = mErr;
              const isRateLimit = mErr?.message?.includes('429') || mErr?.message?.includes('RESOURCE_EXHAUSTED') || mErr?.message?.includes('quota');
              console.warn(`[Gemini] Falha (${isRateLimit ? '429 Rate Limit' : 'Erro'}) no modelo ${currentModelName} da chave ${keyObfuscated}: ${mErr?.message || 'Erro'}.`);
              
              if (isRateLimit) {
                // Short pause to allow rate limit bucket to reset
                await new Promise(r => setTimeout(r, 1000));
                continue;
              }
            }
          }
        }
      }
    }

    // Outer retry if all providers failed due to rate limits or transient errors
    if (!success) {
      console.warn("[AI Engine] Primeira rodada de provedores falhou. Tentando rodada rápida de emergência (1s pause)...");
      await new Promise(r => setTimeout(r, 1000));
      
      for (const step of providerSteps) {
        if (success) break;
        if (step.provider === 'gemini') {
          const keys = step.keys || [];
          for (const apiKey of keys) {
            if (success) break;
            const ai = new GoogleGenerativeAI(apiKey);
            const models = ["gemini-3.1-flash-lite"];
            
            for (const currentModelName of models) {
              try {
                let currentResult = "";
                const isJsonReq = action === 'generateJson' || (typeof promptText === 'string' && (promptText.includes('"weeks":') || promptText.toLowerCase().includes('retorne estritamente um objeto json')));
                const genConfig: any = isJsonReq ? { responseMimeType: "application/json" } : {};
                
                const modelInstance = ai.getGenerativeModel({ model: currentModelName, generationConfig: genConfig });
                let contentsToUse: any = [{ role: "user", parts: [{ text: promptText }] }];
                if (payload.parts && Array.isArray(payload.parts)) {
                  contentsToUse = [{ role: "user", parts: payload.parts }];
                }
                const result = await modelInstance.generateContent({ contents: contentsToUse });
                currentResult = result.response.text() || "";

                if (currentResult && currentResult.trim().length > 0) {
                  success = true;
                  resultText = currentResult;
                  aiUsageStats.gemini.requestsToday++;
                  aiUsageStats.gemini.status = "OK";
                  aiUsageStats.gemini.lastUsed = new Date().toISOString();
                  aiUsageStats.lastActiveProvider = "Google Gemini (Emergency Fallback)";
                  aiUsageStats.lastActiveModel = currentModelName;
                  await persistProviderCall('gemini', userEmail);
                  break;
                }
              } catch (e: any) {
                lastError = e;
              }
            }
          }
        } else if (step.provider === 'groq' && groqKey) {
          try {
            resultText = await callGroqApi(groqKey, action, promptText, payload);
            if (resultText && resultText.trim().length > 0) {
              success = true;
              aiUsageStats.groq.requestsToday++;
              aiUsageStats.groq.status = "OK";
              aiUsageStats.lastActiveProvider = "Groq Cloud (Emergency Fallback)";
              aiUsageStats.lastActiveModel = "llama-3.3-70b-versatile";
              await persistProviderCall('groq', userEmail);
              break;
            }
          } catch (e: any) {
            lastError = e;
          }
        }
      }
    }

    if (!success) {
      throw lastError || new Error("Todos os provedores de IA (Gemini e Groq) falharam ou atingiram limite temporário de requisições.");
    }

    const text = resultText;
    const trimmed = text.trim();

    // Check if JSON object parsing is expected or if response is valid JSON
    const isJsonExpected = action === 'generateJson' || (typeof promptText === 'string' && (promptText.includes('"weeks":') || promptText.toLowerCase().includes('retorne estritamente um objeto json')));

    if (isJsonExpected || (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return res.json({ result: parsed });
      } catch (e) {
        // Fallback for markdown JSON blocks ```json { ... } ```
        const cleanJsonText = trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
        try {
          const parsed = JSON.parse(cleanJsonText);
          return res.json({ result: parsed });
        } catch (e2) {
          if (action === 'generateJson') {
            console.warn("[Server] Falha ao converter resposta em JSON:", text.substring(0, 100));
          }
        }
      }
    }

    return res.json({ result: text });
  } catch (error: any) {
    console.error("AI Proxy Error:", error.message);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// Proxy to avoid CORS and rate limits for Open-i, Zenodo, Europe PMC, Open Library and Google Books
app.get("/api/proxy-scientific", async (req, res) => {
  try {
    const { source, query, limit, search_for, item_type } = req.query;
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const qStr = (query || search_for || '') as string;
    
    if (source === 'openi') {
      try {
        const url = `https://openi.nlm.nih.gov/api/search?query=${encodeURIComponent(qStr)}&m=1&n=${limit || 25}`;
        const response = await fetch(url, { headers: { "User-Agent": userAgent } });
        if (!response.ok) return res.status(200).json({ list: [] });
        const text = await response.text();
        const data = JSON.parse(text);
        if (data.list && Array.isArray(data.list)) {
          data.list = data.list.map((item: any) => {
            let imgLarge = item.imgLarge || item.imgThumb || '';
            let imgThumb = item.imgThumb || item.imgLarge || '';
            if (imgLarge && !imgLarge.startsWith('http')) {
              imgLarge = `https://openi.nlm.nih.gov/${imgLarge.replace(/^\//, '')}`;
            }
            if (imgThumb && !imgThumb.startsWith('http')) {
              imgThumb = `https://openi.nlm.nih.gov/${imgThumb.replace(/^\//, '')}`;
            }
            return { ...item, imgLarge, imgThumb };
          });
        }
        return res.json(data);
      } catch (e: any) {
        console.warn("[Proxy-Open-i] Request or parse warning:", e.message);
        return res.status(200).json({ list: [] });
      }
    }

    if (source === 'internetarchive') {
      try {
        const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(qStr)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=year&rows=${limit || 15}&page=1&output=json`;
        const response = await fetch(url, { headers: { "User-Agent": userAgent } });
        if (!response.ok) return res.status(200).json({ docs: [] });
        const data = await response.json();
        return res.json(data.response || { docs: [] });
      } catch (e: any) {
        console.warn("[Proxy-InternetArchive] Request warning:", e.message);
        return res.status(200).json({ docs: [] });
      }
    }

    if (source === 'plos') {
      try {
        const url = `https://api.plos.org/search?q=everything:${encodeURIComponent(qStr)}&fl=id,title_display,author_display,publication_date,journal&rows=${limit || 15}`;
        const response = await fetch(url, { headers: { "User-Agent": userAgent } });
        if (!response.ok) return res.status(200).json({ response: { docs: [] } });
        const data = await response.json();
        return res.json(data);
      } catch (e: any) {
        console.warn("[Proxy-PLOS] Request warning:", e.message);
        return res.status(200).json({ response: { docs: [] } });
      }
    }

    if (source === 'zenodo') {
      try {
        const url = `https://zenodo.org/api/records?q=${encodeURIComponent(qStr)}&type=image&size=${limit || 20}`;
        const response = await fetch(url, { headers: { "User-Agent": userAgent } });
        if (!response.ok) return res.status(200).json({ hits: { hits: [] } });
        const data = await response.json();
        return res.json(data);
      } catch (e: any) {
        console.warn("[Proxy-Zenodo] Request warning:", e.message);
        return res.status(200).json({ hits: { hits: [] } });
      }
    }

    if (source === 'europepmc') {
      try {
        const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(qStr + ' HAS_FT:Y')}&format=json&pageSize=${limit || 20}`;
        const response = await fetch(url, { headers: { "User-Agent": userAgent } });
        if (!response.ok) return res.status(200).json({ resultList: { result: [] } });
        const data = await response.json();
        return res.json(data);
      } catch (e: any) {
        console.warn("[Proxy-EuropePMC] Request warning:", e.message);
        return res.status(200).json({ resultList: { result: [] } });
      }
    }

    if (source === 'openlibrary') {
      try {
        const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(qStr)}&limit=${limit || 12}`;
        const response = await fetch(url, { headers: { "User-Agent": userAgent } });
        if (!response.ok) return res.status(200).json({ docs: [] });
        const data = await response.json();
        return res.json(data);
      } catch (e: any) {
        console.warn("[Proxy-OpenLibrary] Request warning:", e.message);
        return res.status(200).json({ docs: [] });
      }
    }
    
    if (source === 'figshare') {
      try {
        const url = `https://api.figshare.com/v2/articles?search=${encodeURIComponent(qStr)}&page_size=${limit || 20}&item_type=3`;
        const response = await fetch(url, {
          headers: { 
            'Accept': 'application/json',
            'User-Agent': userAgent
          }
        });
        if (!response.ok) {
          return res.status(200).json({ items: [] });
        }
        const data = await response.json();
        return res.json(data);
      } catch (e: any) {
        console.warn("[Proxy-FigShare] Request warning:", e.message);
        return res.status(200).json({ items: [] });
      }
    }
    
    if (source === 'googlebooks') {
      try {
        const apiKey = process.env.GEMINI_API_KEY ? `&key=${process.env.GEMINI_API_KEY}` : '';
        const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(qStr)}&maxResults=${limit || 8}${apiKey}`;
        const response = await fetch(url, { headers: { "User-Agent": userAgent } });
        if (!response.ok) return res.status(200).json({ items: [] });
        const data = await response.json();
        return res.json(data);
      } catch (e: any) {
        console.warn("[Proxy-GoogleBooks] Request warning:", e.message);
        return res.status(200).json({ items: [] });
      }
    }

    res.status(400).json({ error: "Invalid source" });
  } catch (err: any) {
    console.error("[Scientific Proxy Error]", err.message);
    res.status(200).json({ items: [], docs: [], list: [] });
  }
});

// Proxy endpoint to prevent browser Referer header issues with Wikimedia Commons, Open-i, and PLOS
app.get("/api/proxy-image", async (req, res) => {
  try {
    let imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send("Parameter 'url' is required.");
    }

    imageUrl = imageUrl.trim();
    
    // Decodes if double-encoded
    if (imageUrl.includes("%25")) {
      imageUrl = decodeURIComponent(imageUrl);
    }
    
    // If it has no protocol, default to https://
    if (imageUrl.startsWith("//")) {
      imageUrl = `https:${imageUrl}`;
    } else if (!/^https?:\/\//i.test(imageUrl)) {
      imageUrl = `https://${imageUrl}`;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch (e) {
      return res.status(400).send("Invalid image URL.");
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).send("Only HTTP and HTTPS image URLs are supported.");
    }

    console.log(`[Proxy] Server-side fetching image: ${imageUrl}`);
    
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 MedicalAtlasBot/1.0",
      "Accept": "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
    };

    if (parsedUrl.hostname.includes("wikimedia.org") || parsedUrl.hostname.includes("wikipedia.org")) {
      headers["Referer"] = "https://commons.wikimedia.org/";
    } else if (parsedUrl.hostname.includes("nih.gov")) {
      headers["Referer"] = "https://openi.nlm.nih.gov/";
    } else if (parsedUrl.hostname.includes("plos.org")) {
      headers["Referer"] = "https://journals.plos.org/";
    }

    let response = await fetch(imageUrl, { headers, redirect: 'follow' });

    // Fallback: If a Wikimedia thumbnail URL fails, try to fetch the full resolution file directly
    if (!response.ok && (parsedUrl.hostname.includes("wikimedia.org") || parsedUrl.hostname.includes("wikipedia.org"))) {
      if (imageUrl.includes('/thumb/')) {
        const parts = imageUrl.split('/');
        const thumbIdx = parts.indexOf('thumb');
        if (thumbIdx !== -1 && parts.length > thumbIdx + 3) {
          const fullResUrl = [...parts.slice(0, thumbIdx), ...parts.slice(thumbIdx + 1, thumbIdx + 4)].join('/');
          console.log(`[Proxy Fallback] Attempting direct full-res Wikimedia URL: ${fullResUrl}`);
          const fallbackRes = await fetch(fullResUrl, { headers, redirect: 'follow' });
          if (fallbackRes.ok) {
            response = fallbackRes;
          }
        }
      }
    }

    if (!response.ok) {
      console.error(`[Proxy] Remote image host returned status ${response.status} for ${imageUrl}`);
      return res.status(response.status).send(`Failed to read remote image resource: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    
    // Validate that the remote resource returned actual image data and not an HTML error/page
    if (!contentType.toLowerCase().includes("image/") && !contentType.toLowerCase().includes("application/octet-stream") && !contentType.toLowerCase().includes("binary")) {
      console.error(`[Proxy] Remote host returned non-image content-type '${contentType}' for ${imageUrl}`);
      return res.status(415).send(`URL returned non-image content-type '${contentType}'.`);
    }

    res.setHeader("Content-Type", contentType.includes("image/") ? contentType : "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=604800, s-maxage=604800, immutable"); // Cache for 7 days

    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error("[Proxy Exception]", err.message);
    res.status(500).send("Proxy server-side error: " + err.message);
  }
});

// Configure Google OAuth Client
// Helper to calculate Google OAuth Redirect URI consistently
const getRedirectUri = (req: express.Request) => {
  const host = req.headers.host || '';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('3000');
  const protocol = isLocal ? 'http' : 'https';
  
  let baseUrl = process.env.APP_URL;
  if (baseUrl) {
    if (!isLocal && baseUrl.startsWith('http://')) {
      baseUrl = baseUrl.replace('http://', 'https://');
    }
  } else if (host) {
    baseUrl = `${protocol}://${host}`;
  } else {
    baseUrl = 'http://localhost:3000';
  }

  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  return `${baseUrl}/api/auth/google/callback`;
};

// Helper to get Google OAuth Client dynamically based on request, supporting Netlify function routing under /api/*
const getOAuth2Client = (req: express.Request) => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri(req)
  );
};

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Google Calendar sync will not work.');
}

// Auth URL endpoint
app.get('/api/auth/google/url', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) return res.status(400).send('userId required');

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_ID.includes('MY_GOOGLE_CLIENT_ID')) {
    return res.status(400).json({
      error: 'As credenciais do Google OAuth não estão configuradas no servidor de produção (Netlify). Por favor, configure as variáveis de ambiente GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nas configurações do seu site no painel da Netlify.'
    });
  }

  const client = getOAuth2Client(req);
  const redirectUri = getRedirectUri(req);
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: userId, // Pass userId in state to associate tokens on callback
    prompt: 'consent'
  });
  res.json({ url, redirectUri });
});

// Unified OAuth Callback handler
const handleOAuthCallback = async (req: express.Request, res: express.Response) => {
  const { code, state: userId } = req.query;
  
  if (!code || !userId) {
    return res.status(400).send('Missing code or userId');
  }

  try {
    const client = getOAuth2Client(req);
    const { tokens } = await client.getToken(code as string);
    
    // Pass tokens back to client securely via postMessage.
    // If opened as same-window, pass via URL hash.
    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #E4E3E0;">
          <div style="text-align: center; border: 1px solid #141414; padding: 2rem; background: white; box-shadow: 8px 8px 0 0 #141414;">
            <h1 style="font-style: italic;">Conectado!</h1>
            <p>O Google Calendar foi autorizado.</p>
            <p>Sincronizando os dados no aplicativo... Esta janela fechará automaticamente.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'OAUTH_AUTH_SUCCESS',
                  tokens: ${JSON.stringify(tokens)}
                }, '*');
                setTimeout(() => window.close(), 1500);
              } else {
                window.location.href = '/?google_sync_success=true&userId=' + encodeURIComponent("${userId}") + '#tokens=' + encodeURIComponent(JSON.stringify(${JSON.stringify(tokens)}));
              }
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error exchanging code:', error);
    res.status(500).send('Authentication failed');
  }
};

app.get(['/auth/callback', '/auth/callback/'], handleOAuthCallback);
app.get(['/api/auth/google/callback', '/api/auth/google/callback/'], handleOAuthCallback);

// Stateless endpoint to fetch events from Google Calendar API
app.post('/api/calendar/fetch-events', async (req, res) => {
  const { tokens } = req.body;
  if (!tokens) return res.status(400).json({ error: 'tokens required' });

  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: client });

    const googleEvents = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    res.json({ items: googleEvents.data.items || [] });
  } catch (error: any) {
    console.error('Error fetching calendar events from Google API:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch calendar events' });
  }
});

// Stateless endpoint to create a Google Calendar event
app.post('/api/calendar/create-event', async (req, res) => {
  const { tokens, event } = req.body;
  if (!tokens) return res.status(400).json({ error: 'tokens required' });
  if (!event) return res.status(400).json({ error: 'event required' });

  console.log('Incoming request to create-event:', JSON.stringify({
    title: event.title,
    start: event.start,
    end: event.end
  }));

  try {
    const client = getOAuth2Client(req);
    client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: client });

    // Validate and normalize start & end dates
    let startStr = (event.start || '').trim();
    let endStr = (event.end || '').trim();

    let startDate = new Date(startStr);
    if (isNaN(startDate.getTime())) {
      startDate = new Date(startStr.replace(' ', 'T'));
    }
    if (isNaN(startDate.getTime())) {
      startDate = new Date();
    }

    let endDate = new Date(endStr);
    if (isNaN(endDate.getTime())) {
      endDate = new Date(endStr.replace(' ', 'T'));
    }
    if (isNaN(endDate.getTime())) {
      endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1hr
    }

    // Google Calendar requires end time to be strictly after start time.
    // If end time is before or equal to start time, adjust end time to be start time + 1 hour.
    if (endDate.getTime() <= startDate.getTime()) {
      console.log(`Adjusting end date from ${endDate.toISOString()} to be 1 hour after start date ${startDate.toISOString()}`);
      endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    }

    const startPayload = { dateTime: startDate.toISOString() };
    const endPayload = { dateTime: endDate.toISOString() };

    console.log('Normalized Event payload to insert:', JSON.stringify({
      summary: event.title,
      description: event.description,
      start: startPayload,
      end: endPayload
    }));

    const createdEvent = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.title || 'Sem título',
        description: event.description || '',
        start: startPayload,
        end: endPayload,
      },
    });

    res.json(createdEvent.data);
  } catch (error: any) {
    if (error.response && error.response.data) {
      console.error('Detailed Google Calendar API Error response data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('Error creating calendar event in Google API:', error);
    const apiErrorDetail = error.response?.data?.error?.message || error.message || 'Failed to create calendar event';
    res.status(500).json({ error: apiErrorDetail });
  }
});

// Deprecated old sync endpoint supporting legacy client calls
app.post('/api/calendar/sync', async (req, res) => {
  res.status(400).json({ error: 'This endpoint is deprecated. Please perform client-side sync.' });
});

// Mercado Pago: Create Preference Endpoint
app.post('/api/mercadopago/create-preference', async (req, res) => {
  const { userId, email, planType } = req.body;
  
  if (!userId || !email) {
    return res.status(400).json({ error: 'userId and email are required fields.' });
  }

  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  let appUrl = process.env.APP_URL || `${protocol}://${host}`;
  // Strip trailing slash if present to avoid double-slashes in back_urls or init points
  appUrl = appUrl.replace(/\/+$/, '');

  const planDetails: Record<string, { id: string; title: string; price: number; desc: string }> = {
    med_revise_pro: {
      id: 'med_revise_pro',
      title: 'Assinatura MedRevise Pro',
      price: 19.90,
      desc: 'Matérias, assuntos e simulações de estudos ilimitados no MedRevise baseados no método Ebbinghaus.'
    },
    med_internato_premium: {
      id: 'med_internato_premium',
      title: 'Assinatura Internato Premium',
      price: 39.90,
      desc: 'Banco de questões clínicas, flashcards, revisões de internato e resumos de coordenadores no MedInternato.'
    },
    combo_ouro: {
      id: 'combo_ouro',
      title: 'Assinatura Combo Ouro (MedRevise + MedInternato)',
      price: 49.90,
      desc: 'Acesso Pro ilimitado integrado a AMBAS as plataformas de estudo MedRevise e MedInternato com super desconto.'
    }
  };

  const selectedPlan = planDetails[planType] || planDetails['med_revise_pro'];

  if (!token) {
    console.warn('[MercadoPago] MERCADO_PAGO_ACCESS_TOKEN is missing. Emulating sandbox checkout redirect.');
    // Let the frontend know this is sandboxed simulator mode
    return res.json({
      id: 'sandbox_simulator_preference',
      init_point: `${appUrl}/?status=success&sandbox_upgrade=true&uid=${userId}&plan_type=${selectedPlan.id}`
    });
  }

  // Check if token format matches a Public Key (TEST/APP_USR followed by standard UUID structure)
  const isPublicKey = token.length === 41 && (token.startsWith('TEST-') || token.startsWith('APP_USR-'));
  if (isPublicKey) {
    console.warn('[MercadoPago] Crucial Configuration Error: MERCADO_PAGO_ACCESS_TOKEN is holding a Public Key instead of an Access Token.');
    return res.status(400).json({
      error: 'Erro de Configuração: O token MERCADO_PAGO_ACCESS_TOKEN configurado é uma Chave Pública (Public Key) e não um Token de Acesso (Access Token). Por favor, acesse suas credenciais no Mercado Pago, copie o "Access Token" de Produção (que é muito mais longo) e configure-o nas Configurações do AI Studio.'
    });
  }

  try {
    const mpClient = new MercadoPagoConfig({ accessToken: token });
    const preference = new Preference(mpClient);

    const preferenceResponse = await preference.create({
      body: {
        items: [
          {
            id: selectedPlan.id,
            title: selectedPlan.title,
            description: selectedPlan.desc,
            quantity: 1,
            unit_price: selectedPlan.price,
            currency_id: 'BRL'
          }
        ],
        payer: {
          email: email
        },
        external_reference: userId,
        back_urls: {
          success: `${appUrl}/?status=success&plan_type=${selectedPlan.id}`,
          failure: `${appUrl}/?status=failure`,
          pending: `${appUrl}/?status=pending`
        },
        auto_return: 'approved',
        notification_url: `${appUrl}/api/mercadopago/webhook`
      }
    });

    res.json({ 
      id: preferenceResponse.id, 
      init_point: preferenceResponse.init_point || preferenceResponse.sandbox_init_point 
    });
  } catch (error: any) {
    console.error('[MercadoPago] Error generating purchase preference:', error);
    res.status(500).json({ error: error.message || 'Error occurred while creating payment preference.' });
  }
});

function isValidCPF(cpf: string): boolean {
  const clean = (cpf || '').replace(/\D/g, '');
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 1; i <= 9; i++) sum = sum + parseInt(clean.substring(i - 1, i)) * (11 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum = sum + parseInt(clean.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.substring(10, 11))) return false;
  return true;
}

// Server-side helper: Grant +30 days free premium to referrer ONLY after paying user's payment is confirmed
async function processReferralRewardForUser(userId: string) {
  if (!db || !userId) return;
  try {
    const userDocRef = db.collection('users').doc(userId);
    const userSnap = await userDocRef.get();
    if (!userSnap.exists) return;
    const userData = userSnap.data();

    if (userData?.usedReferralKey && !userData?.referralRewardGranted) {
      const cleanKey = String(userData.usedReferralKey).trim().toUpperCase();
      console.log(`[Referral Process] User ${userId} payment confirmed! Processing referral key: ${cleanKey}`);

      const friendQuery = await db.collection('users').where('referralKey', '==', cleanKey).limit(1).get();
      if (!friendQuery.empty) {
        const friendDoc = friendQuery.docs[0];
        const friendUid = friendDoc.id;
        const friendData = friendDoc.data();

        if (friendUid !== userId) {
          let newUntilDate: Date;
          const nowMs = Date.now();
          if (friendData?.premiumUntil) {
            const currentUntilMs = new Date(friendData.premiumUntil).getTime();
            const baseMs = currentUntilMs > nowMs ? currentUntilMs : nowMs;
            newUntilDate = new Date(baseMs + 5 * 24 * 60 * 60 * 1000);
          } else {
            newUntilDate = new Date(nowMs + 5 * 24 * 60 * 60 * 1000);
          }

          const currentNotifications = Array.isArray(friendData?.referralNotifications) ? friendData.referralNotifications : [];
          const newNotification = {
            id: Math.random().toString(36).substring(2, 9),
            fromName: userData.displayName || userData.email || 'Um usuário indicado',
            date: new Date().toISOString(),
            type: 'bonus_received',
            daysGranted: 5
          };

          await db.collection('users').doc(friendUid).update({
            isPremium: true,
            premiumUntil: newUntilDate.toISOString(),
            referralNotifications: [...currentNotifications, newNotification]
          });

          await db.collection('referralLogs').add({
            usedByUid: userId,
            usedByName: userData.displayName || 'Usuário Desconhecido',
            usedByEmail: userData.email || 'N/A',
            friendUid: friendUid,
            friendName: friendData?.displayName || 'Amigo Desconhecido',
            friendEmail: friendData?.email || 'N/A',
            referralKey: cleanKey,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'reward_granted',
            type: 'payment_confirmed',
            daysGranted: 5
          });

          console.log(`[Referral Process] Successfully granted +5 days extended plan access to key owner ${friendUid}`);
        }
      }

      await userDocRef.update({
        referralRewardGranted: true
      });
    }
  } catch (err: any) {
    console.error(`[Referral Process Error] Failed to process referral for ${userId}:`, err?.message || err);
  }
}

// Mercado Pago: Create Real Pix Payment via API de Pagamentos Transparentes
app.post('/api/mercadopago/create-pix', async (req, res) => {
  const { userId, email, cpf, firstName, lastName, planType } = req.body;
  
  if (!userId || !email) {
    return res.status(400).json({ error: 'userId and email are required fields.' });
  }

  const cleanCPF = (cpf || '').replace(/\D/g, '');
  if (!cleanCPF || !isValidCPF(cleanCPF)) {
    return res.status(400).json({
      error: 'CPF inválido. Por favor, informe um CPF válido de 11 dígitos para a emissão do Pix no Mercado Pago.'
    });
  }

  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  let appUrl = process.env.APP_URL || `${protocol}://${host}`;
  appUrl = appUrl.replace(/\/+$/, '');

  const planDetails: Record<string, { id: string; title: string; price: number; desc: string }> = {
    med_revise_pro: {
      id: 'med_revise_pro',
      title: 'Assinatura MedRevise Pro',
      price: 19.90,
      desc: 'Matérias, assuntos e simulações de estudos ilimitados no MedRevise baseados no método Ebbinghaus.'
    },
    med_internato_premium: {
      id: 'med_internato_premium',
      title: 'Assinatura Internato Premium',
      price: 39.90,
      desc: 'Banco de questões clínicas, flashcards, revisões de internato e resumos de coordenadores no MedInternato.'
    },
    combo_ouro: {
      id: 'combo_ouro',
      title: 'Assinatura Combo Ouro (MedRevise + MedInternato)',
      price: 49.90,
      desc: 'Acesso Pro ilimitado integrado a AMBAS as plataformas de estudo MedRevise e MedInternato com super desconto.'
    }
  };

  const selectedPlan = planDetails[planType] || planDetails['med_revise_pro'];

  if (!token) {
    console.warn('[MercadoPago Pix] MERCADO_PAGO_ACCESS_TOKEN is missing. Emulating sandbox Pix payment details.');
    // If not configured, we return a simulated real-looking sandbox payment
    return res.json({
      id: 'pix_sandbox_simulator_payment',
      status: 'pending',
      qr_code: "00020101021226870014br.gov.bcb.pix2565medrevise-pix-production-gateway.pix.com.br/qr/v2/as893hf8923hc23u794r7289f3849f8231948",
      qr_code_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      simulated: true,
      plan_type: selectedPlan.id
    });
  }

  // Check if token format matches a Public Key
  const isPublicKey = token.length === 41 && (token.startsWith('TEST-') || token.startsWith('APP_USR-'));
  if (isPublicKey) {
    return res.status(400).json({
      error: 'Erro de Configuração: O token MERCADO_PAGO_ACCESS_TOKEN configurado é uma Chave Pública (Public Key) e não um Token de Acesso (Access Token).'
    });
  }

  try {
    const mpClient = new MercadoPagoConfig({ accessToken: token });
    const payment = new Payment(mpClient);

    const cleanFirstName = firstName || 'Lucas';
    const cleanLastName = lastName || 'Melo';

    console.log('[MercadoPago Pix] Creating payment payload for external reference:', userId, 'Plan:', selectedPlan.id);

    const response = await payment.create({
      body: {
        transaction_amount: selectedPlan.price,
        description: selectedPlan.title,
        payment_method_id: 'pix',
        payer: {
          email: email,
          first_name: cleanFirstName,
          last_name: cleanLastName,
          identification: {
            type: 'CPF',
            number: cleanCPF,
          }
        },
        external_reference: userId,
        notification_url: `${appUrl}/api/mercadopago/webhook`
      }
    });

    if (response.point_of_interaction?.transaction_data) {
      const { qr_code, qr_code_base64, ticket_url } = response.point_of_interaction.transaction_data;
      res.json({
        id: response.id,
        status: response.status,
        qr_code,
        qr_code_base64,
        ticket_url,
        simulated: false,
        plan_type: selectedPlan.id
      });
    } else {
      console.error('[MercadoPago Pix Error] Response did not contain transaction_data:', response);
      throw new Error('O Mercado Pago não retornou os dados de transação Pix. Verifique se o Pix está ativado no painel de sua conta do Mercado Pago.');
    }
  } catch (error: any) {
    console.error('[MercadoPago Pix] Error generating Pix payment:', error);
    res.status(500).json({ error: error.message || 'Erro ao criar faturamento Pix no Mercado Pago.' });
  }
});

// Mercado Pago: Direct Receipt Status Verification (Fallback for Webhooks)
app.get('/api/mercadopago/check-payment/:paymentId', async (req, res) => {
  const { paymentId } = req.params;
  const { userId } = req.query;

  console.log(`[Check Payment API] Checking status for paymentId: ${paymentId}, userId: ${userId}`);

  if (!paymentId) {
    return res.status(400).json({ error: 'O ID do faturamento Pix é obrigatório.' });
  }

  // Pre-emptive check: if the user database is already upgraded, return approved instantly!
  if (db && userId) {
    try {
      const userDoc = await db.collection('users').doc(String(userId)).get();
      if (userDoc.exists && userDoc.data()?.isPremium) {
        console.log(`[Check Payment API] Pre-emptive success: User ${userId} is already Premium in Firestore.`);
        return res.json({ status: 'approved', isPremium: true });
      }
    } catch (fsErr: any) {
      const isPermissionError = fsErr?.code === 7 || (fsErr?.message && (fsErr.message.includes('PERMISSION_DENIED') || fsErr.message.includes('insufficient permissions')));
      if (!isPermissionError) {
        console.log('[Check Payment API] Pre-emptive Firestore read skipped:', fsErr?.message || fsErr);
      }
    }
  }

  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) {
    console.warn('[Check Payment API] Access token not configured. Emulating approval for testing if requested.');
    // Under testing simulator/offline mode
    return res.json({ status: 'approved', isPremium: true });
  }

  try {
    const mpClient = new MercadoPagoConfig({ accessToken: token });
    const payment = new Payment(mpClient);

    let paymentDetails;
    try {
      paymentDetails = await payment.get({ id: String(paymentId) });
    } catch (mpErr: any) {
      console.warn(`[Check Payment API] Mercado Pago payment.get native call failed for ID: ${paymentId}. Error:`, mpErr.message);
      
      // Secondary fallback check on Firestore in case payment existed/updated earlier
      if (db && userId) {
        const userDoc2 = await db.collection('users').doc(String(userId)).get();
        if (userDoc2.exists && userDoc2.data()?.isPremium) {
          return res.json({ status: 'approved', isPremium: true });
        }
      }
      return res.status(200).json({
        status: 'pending',
        isPremium: false,
        warning: 'Transação não encontrada ou token sem acesso direto a esta transação.'
      });
    }

    const paymentStatus = paymentDetails.status;
    const paymentUserId = paymentDetails.external_reference || (userId as string);

    console.log(`[Check Payment API] Mercado Pago status: ${paymentStatus} for Ref: ${paymentUserId}`);

    if (paymentStatus === 'approved' && paymentUserId) {
      if (db) {
        let planId = 'med_revise_pro';
        const desc = (paymentDetails.description || '').toLowerCase();
        if (desc.includes('internato premium')) {
          planId = 'med_internato_premium';
        } else if (desc.includes('combo ouro')) {
          planId = 'combo_ouro';
        }
        try {
          await db.collection('users').doc(paymentUserId).update({
            isPremium: true,
            premiumPlan: planId,
            premiumPaymentId: String(paymentId),
            premiumProvider: 'MercadoPago',
            premiumSince: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`[Check Payment API] Upgraded user ${paymentUserId} to ${planId} status successfully in Firestore.`);
          await processReferralRewardForUser(paymentUserId);
        } catch (dbErr: any) {
          console.warn(`[Check Payment API] Failed to update Firestore user document from server-side. Proceeding with approval because Mercado Pago confirmation succeeded. Error:`, dbErr.message);
        }
        return res.json({ status: 'approved', isPremium: true, premiumPlan: planId });
      } else {
        console.error('[Check Payment API] Firestore instance not initialized.');
        return res.status(500).json({ error: 'Database not initialized.' });
      }
    }

    return res.json({ status: paymentStatus, isPremium: false });
  } catch (error: any) {
    console.error('[Check Payment API Error] Exception details:', error);
    return res.status(500).json({ error: error.message || 'Erro ao consultar transação no Mercado Pago.' });
  }
});

// Mercado Pago: Notification Webhook
app.post('/api/mercadopago/webhook', async (req, res) => {
  const { action, type, data } = req.body;
  const paymentId = data?.id || req.query.id;
  const topic = type || req.query.topic;

  console.log('[MercadoPago Webhook] Received webhook notification:', JSON.stringify({ body: req.body, query: req.query }));

  if (!paymentId) {
    // Return 200 OK to stop retries from Mercado Pago gateway
    return res.status(200).send('Notification received with no action required.');
  }

  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) {
    console.warn('[MercadoPago Webhook] Received notification but MERCADO_PAGO_ACCESS_TOKEN is not configured.');
    return res.status(200).send('Webhook completed in simulator mode.');
  }

  try {
    const mpClient = new MercadoPagoConfig({ accessToken: token });
    const payment = new Payment(mpClient);

    // Dynamic extraction of transaction details from Mercado Pago API integration
    const paymentDetails = await payment.get({ id: String(paymentId) });
    const paymentStatus = paymentDetails.status;
    const userId = paymentDetails.external_reference;

    console.log(`[MercadoPago webhook] Payment #${paymentId} status: ${paymentStatus}, User: ${userId}`);

    if (paymentStatus === 'approved' && userId) {
      if (db) {
        let planId = 'med_revise_pro';
        const desc = (paymentDetails.description || '').toLowerCase();
        if (desc.includes('internato premium')) {
          planId = 'med_internato_premium';
        } else if (desc.includes('combo ouro')) {
          planId = 'combo_ouro';
        }
        try {
          await db.collection('users').doc(userId).update({
            isPremium: true,
            premiumPlan: planId,
            premiumPaymentId: String(paymentId),
            premiumProvider: 'MercadoPago',
            premiumSince: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`[MercadoPago webhook] Upgraded user ${userId} to ${planId} status successfully in Firestore.`);
          await processReferralRewardForUser(userId);
        } catch (dbErr: any) {
          console.warn(`[MercadoPago webhook] Webhook Firestore update warning:`, dbErr.message);
        }
      } else {
        console.error('[MercadoPago webhook] Firestore reference db is not initialized.');
      }
    }

    res.status(200).send('Webhook Processed OK');
  } catch (error) {
    console.error('[MercadoPago webhook] Webhook processing exception error:', error);
    // If external service fails, we return 500 so Mercado Pago can retry the webhook safely
    res.status(500).send('Webhook server error');
  }
});

// Setup dev server or fallback static routes
async function configureAndListen() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production' && !process.env.NETLIFY) {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(vitePkg);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

configureAndListen();

export default app;
