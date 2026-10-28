import express from 'express';
import path from 'path';
import fs from 'fs';
import net from 'net';
import dns from 'dns';
import http from 'http';
import https from 'https';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// ============================================================================
// 1. VALIDAÇÃO ESTRITA DE AMBIENTE (ISOLAMENTO DE PRODUÇÃO E TESTE)
// ============================================================================
const APP_ENV = process.env.APP_ENV;
const PROD_FIRESTORE_DB_ID = 'ai-studio-91f1d7eb-cec1-4159-8148-4ba7d6a63b82';
const PROD_SUPABASE_URL = 'https://jhttjndhjzpfphqxjiao.supabase.co';

if (APP_ENV !== 'test' && APP_ENV !== 'production' && APP_ENV !== undefined && APP_ENV !== '') {
  console.error('[FATAL] APP_ENV inválido. Deve ser "test" ou "production".');
  process.exit(1);
}

// Detecção segura do ambiente AI Studio Preview
let appletConfig: any = null;
const appletConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (fs.existsSync(appletConfigPath)) {
  try {
    appletConfig = JSON.parse(fs.readFileSync(appletConfigPath, 'utf8'));
  } catch (err) {
    console.warn('[Preview Mode] Não foi possível ler firebase-applet-config.json:', err);
  }
}
const isAIStudio = Boolean(appletConfig?.projectId || fs.existsSync(appletConfigPath));

// Bloqueio de segurança: impede que a ausência de APP_ENV assuma silenciosamente produção fora do Preview
if (!APP_ENV) {
  if (!isAIStudio) {
    console.error('[FATAL] APP_ENV não configurado fora do AI Studio Preview. Em ambientes de hospedagem como Netlify, configure APP_ENV="production".');
    process.exit(1);
  }

  const candidateSupaUrl = process.env.SUPABASE_URL;
  if ((candidateSupaUrl === PROD_SUPABASE_URL || process.env.FIREBASE_SERVICE_ACCOUNT?.includes('gen-lang-client-0128984368')) && !isAIStudio) {
    console.error('[Security Error] Anti-production lock: Credenciais de produção do backend não podem ser usadas fora do AI Studio Preview ou sem APP_ENV="production".');
    process.exit(1);
  }
  console.log('[Preview Mode] Servidor iniciando em modo AI Studio Preview seguro.');
}

interface EnvironmentConfig {
  firebaseProjectId: string;
  supabaseUrl: string;
  firestoreDbId: string;
}

const PROD_CONFIG: EnvironmentConfig = {
  firebaseProjectId: 'gen-lang-client-0128984368',
  supabaseUrl: PROD_SUPABASE_URL,
  firestoreDbId: PROD_FIRESTORE_DB_ID
};

const TEST_CONFIG: EnvironmentConfig = {
  firebaseProjectId: 'teste-migracao-e7027',
  supabaseUrl: 'https://xoijnmpadomzxoftjune.supabase.co',
  firestoreDbId: process.env.FIRESTORE_DATABASE_ID?.trim() || ''
};

let EXPECTED_CONFIG: EnvironmentConfig;

if (APP_ENV === 'production') {
  EXPECTED_CONFIG = PROD_CONFIG;
} else if (APP_ENV === 'test') {
  EXPECTED_CONFIG = TEST_CONFIG;
} else if (!APP_ENV && isAIStudio) {
  EXPECTED_CONFIG = {
    firebaseProjectId: appletConfig?.projectId || PROD_CONFIG.firebaseProjectId,
    supabaseUrl: PROD_CONFIG.supabaseUrl,
    firestoreDbId: appletConfig?.firestoreDatabaseId || PROD_CONFIG.firestoreDbId
  };
} else {
  console.error('[FATAL] Não foi possível determinar EXPECTED_CONFIG para o ambiente atual.');
  process.exit(1);
  throw new Error('Ambiente inválido');
}

const currentSupabaseUrl = process.env.SUPABASE_URL;
if (!currentSupabaseUrl || !EXPECTED_CONFIG || currentSupabaseUrl !== EXPECTED_CONFIG.supabaseUrl) {
  console.error(`[FATAL] SUPABASE_URL incompatível ou ausente para o ambiente (${APP_ENV || 'preview'}).`);
  process.exit(1);
}

// Validação de correspondência de projeto para SUPABASE_SERVICE_ROLE_KEY (sem expor credenciais)
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const parts = process.env.SUPABASE_SERVICE_ROLE_KEY.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      if (payload.ref && !EXPECTED_CONFIG.supabaseUrl.includes(payload.ref)) {
        console.error(`[FATAL] SUPABASE_SERVICE_ROLE_KEY pertence ao projeto "${payload.ref}", divergindo da SUPABASE_URL esperada.`);
        process.exit(1);
      }
    }
  } catch {
    // Chave em formato não-JWT ou opaca, prossegue normalmente
  }
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.error(`[FATAL] FIREBASE_SERVICE_ACCOUNT é obrigatória em ambiente ${APP_ENV || 'preview'}. ADC e arquivos locais são proibidos.`);
      process.exit(1);
    }

    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (parseErr) {
      console.error(`[FATAL] Falha crítica ao processar JSON de FIREBASE_SERVICE_ACCOUNT em ${APP_ENV || 'preview'}.`);
      process.exit(1);
    }

    if (!serviceAccount || serviceAccount.project_id !== EXPECTED_CONFIG.firebaseProjectId) {
      console.error(`[FATAL] Projeto do Firebase Admin diverge do esperado para ${APP_ENV || 'preview'}. Esperado: "${EXPECTED_CONFIG.firebaseProjectId}".`);
      process.exit(1);
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
  } catch (e) {
    console.error('Failed to load firebase config for admin:', e);
    process.exit(1);
  }
}

// Validação rigorosa da instância efetiva do Firebase Admin
const defaultAdminApp = admin.apps[0];
if (!defaultAdminApp || defaultAdminApp.options.projectId !== EXPECTED_CONFIG.firebaseProjectId) {
  console.error('[FATAL] Instância ativa do Firebase Admin diverge do projeto esperado para o ambiente.');
  process.exit(1);
}

let db: admin.firestore.Firestore | null = null;
try {
  const targetDbId = EXPECTED_CONFIG.firestoreDbId;
  if (APP_ENV === 'test') {
    if (!targetDbId) {
      console.error('[FATAL] FIRESTORE_DATABASE_ID é obrigatório em ambiente de teste.');
      process.exit(1);
    }
    if (targetDbId === PROD_FIRESTORE_DB_ID) {
      console.error('[FATAL] FIRESTORE_DATABASE_ID em teste não pode apontar para o banco de produção.');
      process.exit(1);
    }
    db = targetDbId === '(default)' ? getFirestore(defaultAdminApp) : getFirestore(defaultAdminApp, targetDbId);
  } else {
    // production: exige estritamente o banco nomeado original
    db = getFirestore(defaultAdminApp, targetDbId);
  }
} catch (err) {
  console.error('[FATAL] Falha ao selecionar instância do Firestore Database sem fallback:', err);
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============================================================================
// 2. TRAVAS DE SEGURANÇA EM AMBIENTE DE TESTE (BLOQUEIO TOTAL DE EXTERNOS)
// ============================================================================
if (APP_ENV === 'test') {
  app.use((req, res, next) => {
    const p = req.path;
    const matchesRouteOrSubpath = (base: string) => p === base || p.startsWith(base + '/');

    const isBlocked =
      matchesRouteOrSubpath('/api/gemini') ||
      matchesRouteOrSubpath('/api/admin/test-key-billing') ||
      matchesRouteOrSubpath('/api/ai-provider-stats') ||
      matchesRouteOrSubpath('/api/mercadopago');

    if (isBlocked) {
      return res.status(403).json({
        error: '[Isolamento de Teste] Operações de IA e Mercado Pago estão estritamente bloqueadas no ambiente de teste.'
      });
    }
    next();
  });
}

// API health endpoint
app.get('/api/health', (req, res) => {
  const host = currentSupabaseUrl ? new URL(currentSupabaseUrl).hostname : 'not-configured';
  res.json({
    status: 'ok',
    env: APP_ENV || 'preview',
    supabaseHost: host,
    firebaseProjectId: EXPECTED_CONFIG?.firebaseProjectId || 'unknown',
    mercadopago: !!process.env.MERCADO_PAGO_ACCESS_TOKEN
  });
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
async function callGroqApi(apiKey: string, action: string, promptText: string, payload: any): Promise<{ text: string; model: string }> {
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

  const modelsToTry = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b"
  ];
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
            if (text.trim().length > 0) return { text, model: modelName };
          }
        }
        lastErr = new Error(`[Groq API HTTP ${response.status}] ${errText}`);
        continue;
      }

      const data = await response.json();
      const textResult = data.choices?.[0]?.message?.content || "";
      if (textResult && textResult.trim().length > 0) {
        return { text: textResult, model: modelName };
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
    const { keyTarget } = req.body;

    // Verificação OBRIGATÓRIA de autenticação via Header Authorization (Bearer token)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Autenticação necessária. Cabeçalho Authorization ausente ou inválido." });
    }

    const idToken = authHeader.substring(7);
    let userEmail = "";
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      if (decodedToken && decodedToken.email) {
        userEmail = decodedToken.email.toLowerCase().trim();
      } else {
        return res.status(401).json({ error: "Token de autenticação não possui e-mail associado." });
      }
    } catch (tokenErr) {
      console.warn('[Admin Security] ID Token fornecido é inválido:', tokenErr);
      return res.status(401).json({ error: "Token de autenticação inválido ou expirado." });
    }

    const ALLOWED_ADMINS = ['ysabelleosaraiva@gmail.com', 'yasabelleosaraiva@gmail.com', 'lucas1renck2melo@gmail.com'];
    const isSpecialUser = ALLOWED_ADMINS.includes(userEmail);
    
    if (!isSpecialUser) {
      return res.status(403).json({ error: "Acesso negado. Apenas administradores autorizados podem testar a chave." });
    }

    const allEnv = process.env;
    const key1 = allEnv['GEMINI_API_KEY_1'] || allEnv['GEMINI_API_KEY'] || process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
    const key2 = allEnv['GEMINI_API_KEY_2'] || process.env.GEMINI_API_KEY_2;
    const key3 = allEnv['GEMINI_API_KEY_3'] || process.env.GEMINI_API_KEY_3;
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
              model: "llama-3.3-70b-versatile",
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
    
    // Support parameters both within "payload" or at the root of req.body robustly
    const payloadToUse = {
      ...(payload || {}),
      prompt: req.body.prompt || (payload || {}).prompt || (payload || {}).promptText || req.body.promptText || "",
      promptText: req.body.promptText || (payload || {}).promptText || (payload || {}).prompt || req.body.prompt || "",
      model: req.body.model || (payload || {}).model || "gemini-3.1-flash-lite",
      parts: req.body.parts || (payload || {}).parts,
      tools: req.body.tools || (payload || {}).tools,
      preferredProvider: req.body.preferredProvider || (payload || {}).preferredProvider || req.body.preferredEngine || (payload || {}).preferredEngine || "",
      fileData: req.body.fileData || (payload || {}).fileData,
      mimeType: req.body.mimeType || (payload || {}).mimeType,
    };

    const { prompt, model } = payloadToUse;
    let modelToUse = model || "gemini-3.1-flash-lite";
    const promptText = prompt || payloadToUse.promptText || "";

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

    const preferredProvider = (payloadToUse.preferredProvider || payloadToUse.preferredEngine || "").toLowerCase().trim();

    let providerSteps: { provider: 'groq' | 'gemini', keys?: string[] }[] = [];

    // Strictly prioritize requested fixed Gemini Key / Groq if explicitly selected
    if (preferredProvider === 'gemini_key2' && isValidKey(key2)) {
      providerSteps.push({ provider: 'gemini', keys: [key2!] });
    } else if (preferredProvider === 'gemini_key3' && isValidKey(key3)) {
      providerSteps.push({ provider: 'gemini', keys: [key3!] });
    } else if (preferredProvider === 'groq' && isValidKey(groqKey)) {
      providerSteps.push({ provider: 'groq' });
    } else if (preferredProvider === 'gemini_key1' && isValidKey(key1)) {
      providerSteps.push({ provider: 'gemini', keys: [key1!] });
    } else if (preferredProvider === 'gemini' && uniqueGeminiKeys.length > 0) {
      providerSteps.push({ provider: 'gemini', keys: uniqueGeminiKeys });
    }

    // Default "AUTO" mode sequence requested by user:
    // Priority 1: Free Gemini Keys (Key 2 & Key 3)
    // Priority 2: Free Groq Key
    // Priority 3: Paid Gemini Key 1 (Fallback after Keys 2/3 & Groq fail)
    if (providerSteps.length === 0) {
      // 1. Free Gemini Keys 2 and 3
      const freeGeminiKeys = [key2, key3].filter(k => isValidKey(k)) as string[];
      if (freeGeminiKeys.length > 0) {
        providerSteps.push({ provider: 'gemini', keys: freeGeminiKeys });
      }

      // 2. Free Groq LPU
      if (isValidKey(groqKey)) {
        providerSteps.push({ provider: 'groq' });
      }

      // 3. Paid Gemini Key 1 (Primary paid fallback)
      if (isValidKey(key1)) {
        providerSteps.push({ provider: 'gemini', keys: [key1!] });
      }

      // Safety: If somehow key1/2/3/groq weren't caught above, include any available keys
      if (providerSteps.length === 0 && uniqueGeminiKeys.length > 0) {
        providerSteps.push({ provider: 'gemini', keys: uniqueGeminiKeys });
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
    let capturedGroundingMetadata: any = null;
    let capturedProviderInfo: { provider: 'gemini' | 'groq'; model: string } | null = null;

    // Execute provider steps in up to 3 rounds (initial attempt + retries with progressive delay)
    const MAX_ROUNDS = 3;
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      if (success) break;

      if (round > 1) {
        const delayMs = (round - 1) * 1500; // 1.5s na rodada 2, 3.0s na rodada 3
        console.warn(`[AI Engine] Rodada ${round}/${MAX_ROUNDS} de retentativas do rodízio... Aguardando ${delayMs / 1000}s...`);
        await new Promise(r => setTimeout(r, delayMs));
      }

      for (const step of providerSteps) {
        if (success) break;

        if (step.provider === 'groq') {
          try {
            console.log(`[AI Engine - Rodada ${round}] Tentando Groq LPU para ${userEmail}...`);
            const groqRes = await callGroqApi(groqKey!, action, promptText, payloadToUse);
            resultText = groqRes.text;
            success = true;
            capturedGroundingMetadata = { provider: 'groq', searchAvailable: false, message: 'Web search grounding not supported by non-Gemini provider' };
            capturedProviderInfo = { provider: 'groq', model: groqRes.model };
            aiUsageStats.groq.requestsToday++;
            aiUsageStats.groq.status = "OK";
            aiUsageStats.groq.lastError = null;
            aiUsageStats.groq.lastUsed = new Date().toISOString();
            aiUsageStats.lastActiveProvider = "Groq Cloud";
            aiUsageStats.lastActiveModel = groqRes.model;
            aiUsageStats.lastCallTime = new Date().toLocaleTimeString('pt-BR');
            console.log(`[AI Engine] Sucesso total com Groq (${groqRes.model})!`);
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

          // Support dynamic model from payload, defaulting to gemini-3.1-flash-lite
          const candidateModels = [model || "gemini-3.1-flash-lite"];

          for (let i = 0; i < keysInOrder.length; i++) {
            if (success) break;
            const apiKey = keysInOrder[i];
            const keyObfuscated = apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 4);
            
            let contentsToUse: any = [{ role: "user", parts: [{ text: promptText }] }];
            if (payloadToUse.parts && Array.isArray(payloadToUse.parts)) {
              const cleanParts = payloadToUse.parts.map((p: any) => {
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
              const { fileData, mimeType, promptText: pText } = payloadToUse;
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
                console.log(`[AI Engine - Rodada ${round}] Tentando Gemini (${keyObfuscated}) com modelo ${currentModelName}...`);
                let currentResult = "";

                if (action === 'generateImage') {
                  const imageModels = ["gemini-2.5-flash", "gemini-2.0-flash"];
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
                        capturedProviderInfo = { provider: 'gemini', model: imgModel };
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
                    tools: payloadToUse.tools || undefined
                  });

                  const result = await modelInstance.generateContent({ contents: contentsToUse });
                  currentResult = result.response.text() || "";
                  capturedGroundingMetadata = result.response.candidates?.[0]?.groundingMetadata || null;
                  capturedProviderInfo = { provider: 'gemini', model: currentModelName };
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
              }
            }
          }
        }
      }
    }

    if (!success) {
      throw lastError || new Error("Todos os provedores de IA (Gemini e Groq) falharam ou atingiram limite temporário de requisições após 3 rodadas.");
    }

    const text = resultText;
    const trimmed = text.trim();

    // Check if JSON object parsing is expected or if response is valid JSON
    const isJsonExpected = action === 'generateJson' || (typeof promptText === 'string' && (promptText.includes('"weeks":') || promptText.toLowerCase().includes('retorne estritamente um objeto json')));

    if (isJsonExpected || (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return res.json({ result: parsed, groundingMetadata: capturedGroundingMetadata, providerInfo: capturedProviderInfo });
      } catch (e) {
        // Fallback for markdown JSON blocks ```json { ... } ```
        const cleanJsonText = trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
        try {
          const parsed = JSON.parse(cleanJsonText);
          return res.json({ result: parsed, groundingMetadata: capturedGroundingMetadata, providerInfo: capturedProviderInfo });
        } catch (e2) {
          if (action === 'generateJson') {
            console.warn("[Server] Falha ao converter resposta em JSON:", text.substring(0, 100));
          }
        }
      }
    }

    return res.json({ result: text, groundingMetadata: capturedGroundingMetadata, providerInfo: capturedProviderInfo });
  } catch (error: any) {
    console.error("AI Proxy Error:", error.message);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// ============================================================================
// HELPERS DE SEGURANÇA IPV4 / IPV6 & SSRF PROTECTION (IANA COMPLIANT)
// ============================================================================

// Converter IPv4 para Uint32 (32-bit unsigned integer)
function ipv4ToUint32(ip: string): number | null {
  if (typeof ip !== 'string') return null;
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let res = 0;
  for (let i = 0; i < 4; i++) {
    const pStr = parts[i];
    if (!/^\d+$/.test(pStr)) return null;
    const num = parseInt(pStr, 10);
    if (num < 0 || num > 255 || (pStr.length > 1 && pStr.startsWith('0'))) return null;
    res = (res * 256) + num;
  }
  return res >>> 0;
}

// Validador IANA para IPv4
function isPrivateOrReservedIPv4(ip: string): boolean {
  const ipInt = ipv4ToUint32(ip);
  if (ipInt === null) return true;

  const p1 = (ipInt >>> 24) & 0xFF;
  const p2 = (ipInt >>> 16) & 0xFF;

  if (p1 === 0) return true;
  if (p1 === 10) return true;
  if (p1 === 100 && p2 >= 64 && p2 <= 127) return true;
  if (p1 === 127) return true;
  if (p1 === 169 && p2 === 254) return true;
  if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
  if (p1 === 192 && p2 === 0 && ((ipInt >>> 8 & 0xFF) === 0 || (ipInt >>> 8 & 0xFF) === 2)) return true;
  if (p1 === 192 && p2 === 88 && (ipInt >>> 8 & 0xFF) === 99) return true;
  if (p1 === 192 && p2 === 168) return true;
  if (p1 === 198 && (p2 === 18 || p2 === 19)) return true;
  if (p1 === 198 && p2 === 51 && (ipInt >>> 8 & 0xFF) === 100) return true;
  if (p1 === 203 && p2 === 0 && (ipInt >>> 8 & 0xFF) === 113) return true;
  if (p1 >= 224) return true;

  return false;
}

// Parser completo IPv6 para 8 palavras de 16 bits
function parseIPv6Words(ip: string): number[] | null {
  if (typeof ip !== 'string') return null;
  let str = ip.trim().toLowerCase();

  const lastColon = str.lastIndexOf(':');
  if (lastColon !== -1) {
    const possibleIpv4 = str.substring(lastColon + 1);
    if (possibleIpv4.includes('.')) {
      const v4Int = ipv4ToUint32(possibleIpv4);
      if (v4Int === null) return null;
      const w7 = (v4Int >>> 16) & 0xFFFF;
      const w8 = v4Int & 0xFFFF;
      const hexV4 = `${w7.toString(16)}:${w8.toString(16)}`;
      str = str.substring(0, lastColon + 1) + hexV4;
    }
  }

  const doubleColonCount = (str.match(/::/g) || []).length;
  if (doubleColonCount > 1) return null;

  let parts: string[];
  if (doubleColonCount === 1) {
    const [leftStr, rightStr] = str.split('::');
    const leftParts = leftStr ? leftStr.split(':') : [];
    const rightParts = rightStr ? rightStr.split(':') : [];

    const missing = 8 - (leftParts.length + rightParts.length);
    if (missing < 1) return null;

    const zeros = new Array(missing).fill('0');
    parts = [...leftParts, ...zeros, ...rightParts];
  } else {
    parts = str.split(':');
  }

  if (parts.length !== 8) return null;

  const words: number[] = [];
  for (const p of parts) {
    if (!/^[0-9a-f]{1,4}$/i.test(p)) return null;
    const val = parseInt(p, 16);
    if (isNaN(val) || val < 0 || val > 0xFFFF) return null;
    words.push(val);
  }

  return words;
}

// Classificador rigoroso de IP (IPv4 e IPv6)
function isPrivateOrReservedIP(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    return isPrivateOrReservedIPv4(ip);
  } else if (family === 6) {
    const words = parseIPv6Words(ip);
    if (!words) return true;

    const [w1, w2, w3, w4, w5, w6, w7, w8] = words;

    if (w1 === 0 && w2 === 0 && w3 === 0 && w4 === 0 && w5 === 0 && w6 === 0 && w7 === 0) {
      if (w8 === 0 || w8 === 1) return true;
    }

    if (w1 === 0 && w2 === 0 && w3 === 0 && w4 === 0 && w5 === 0 && w6 === 0xFFFF) {
      const v4Int = (w7 << 16) | w8;
      const p1 = (v4Int >>> 24) & 0xFF;
      const p2 = (v4Int >>> 16) & 0xFF;
      const p3 = (v4Int >>> 8) & 0xFF;
      const p4 = v4Int & 0xFF;
      return isPrivateOrReservedIPv4(`${p1}.${p2}.${p3}.${p4}`);
    }

    if (w1 === 0 && w2 === 0 && w3 === 0 && w4 === 0 && w5 === 0xFFFF && w6 === 0) {
      const v4Int = (w7 << 16) | w8;
      const p1 = (v4Int >>> 24) & 0xFF;
      const p2 = (v4Int >>> 16) & 0xFF;
      const p3 = (v4Int >>> 8) & 0xFF;
      const p4 = v4Int & 0xFF;
      return isPrivateOrReservedIPv4(`${p1}.${p2}.${p3}.${p4}`);
    }

    if (w1 === 0x0064 && w2 === 0xFF9B && w3 === 0 && w4 === 0 && w5 === 0 && w6 === 0) {
      const v4Int = (w7 << 16) | w8;
      const p1 = (v4Int >>> 24) & 0xFF;
      const p2 = (v4Int >>> 16) & 0xFF;
      const p3 = (v4Int >>> 8) & 0xFF;
      const p4 = v4Int & 0xFF;
      return isPrivateOrReservedIPv4(`${p1}.${p2}.${p3}.${p4}`);
    }

    if (w1 === 0x2002) {
      const v4Int = (w2 << 16) | w3;
      const p1 = (v4Int >>> 24) & 0xFF;
      const p2 = (v4Int >>> 16) & 0xFF;
      const p3 = (v4Int >>> 8) & 0xFF;
      const p4 = v4Int & 0xFF;
      return isPrivateOrReservedIPv4(`${p1}.${p2}.${p3}.${p4}`);
    }

    if (w1 === 0x2001 && w2 === 0x0000) {
      return true;
    }

    if ((w1 & 0xFE00) === 0xFC00) return true;
    if ((w1 & 0xFFC0) === 0xFE80) return true;
    if ((w1 & 0xFF00) === 0xFF00) return true;

    if ((w1 & 0xE000) !== 0x2000) return true;

    return false;
  }

  return true;
}

// Helper assíncrono para validação rigorosa de URL e resolução DNS completa
async function validateAndResolveUrl(urlStr: string): Promise<{
  safe: boolean;
  reason?: string;
  parsedUrl?: URL;
  resolvedIps?: string[];
  targetIp?: string;
  family?: 4 | 6;
}> {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, reason: 'Apenas os protocolos HTTP e HTTPS são permitidos.' };
    }

    if (parsed.username || parsed.password) {
      return { safe: false, reason: 'URLs contendo credenciais embutidas não são permitidas.' };
    }

    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.localhost')
    ) {
      return { safe: false, reason: 'Acesso a domínios locais e internos não é permitido.' };
    }

    const ipFamily = net.isIP(hostname);
    if (ipFamily !== 0) {
      if (isPrivateOrReservedIP(hostname)) {
        return { safe: false, reason: 'O endereço IP especificado é privado, de loopback ou reservado.' };
      }
      return {
        safe: true,
        parsedUrl: parsed,
        resolvedIps: [hostname],
        targetIp: hostname,
        family: ipFamily as 4 | 6
      };
    }

    let addresses: dns.LookupAddress[] = [];
    try {
      addresses = await dns.promises.lookup(hostname, { all: true });
    } catch (dnsErr) {
      return { safe: false, reason: 'Não foi possível resolver o nome de domínio no servidor DNS.' };
    }

    if (!addresses || addresses.length === 0) {
      return { safe: false, reason: 'O servidor DNS não retornou nenhum endereço IP para este domínio.' };
    }

    const resolvedIps: string[] = [];
    let selectedIp: string | null = null;
    let selectedFamily: 4 | 6 = 4;

    for (const addr of addresses) {
      if (isPrivateOrReservedIP(addr.address)) {
        return { safe: false, reason: `O domínio resolve para o IP não permitido (${addr.address}).` };
      }
      resolvedIps.push(addr.address);
      if (!selectedIp) {
        selectedIp = addr.address;
        selectedFamily = addr.family as 4 | 6;
      }
    }

    return {
      safe: true,
      parsedUrl: parsed,
      resolvedIps,
      targetIp: selectedIp!,
      family: selectedFamily
    };
  } catch (err) {
    return { safe: false, reason: 'URL malformatada ou inválida.' };
  }
}

// Helper para verificação de Magic Bytes em imagens recebidas
function validateImageContent(buffer: Buffer): { safe: boolean; detectedType?: string; error?: string } {
  if (!buffer || buffer.length === 0) {
    return { safe: false, error: 'Buffer de imagem vazio ou nulo.' };
  }

  // 1. JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { safe: true, detectedType: 'image/jpeg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
      buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
    return { safe: true, detectedType: 'image/png' };
  }

  // 3. GIF: GIF87a ou GIF89a (47 49 46 38 37/39 61)
  if (buffer.length >= 6 &&
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61) {
    return { safe: true, detectedType: 'image/gif' };
  }

  // 4. WEBP: RIFF + 4 bytes tamanho + WEBP
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return { safe: true, detectedType: 'image/webp' };
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').toLowerCase();
  if (sample.includes('<html') || sample.includes('<script') || sample.includes('<?php') || sample.includes('<svg')) {
    return { safe: false, error: 'O conteúdo remoto contém HTML, script ou vetor não permitido em proxy binário.' };
  }

  return { safe: false, error: 'Formato de imagem não reconhecido ou assinatura mágica inválida.' };
}

// Helper para executar requisições HTTP/HTTPS com fixação nativa de IP (IP Pinning)
function fetchPinnedResource(
  val: { parsedUrl: URL; targetIp: string; family: 4 | 6 },
  headers: Record<string, string>,
  maxBytes: number,
  timeoutMs: number
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const isHttps = val.parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const cleanHost = val.parsedUrl.hostname;
    const isHostIp = net.isIP(cleanHost) !== 0;

    const reqOptions: http.RequestOptions = {
      protocol: val.parsedUrl.protocol,
      hostname: cleanHost,
      port: val.parsedUrl.port ? parseInt(val.parsedUrl.port, 10) : (isHttps ? 443 : 80),
      path: val.parsedUrl.pathname + val.parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers
      },
      lookup: (_dom, opts, cb: any) => {
        if (opts && opts.all) {
          cb(null, [{ address: val.targetIp, family: val.family }], val.family);
        } else {
          cb(null, val.targetIp, val.family);
        }
      }
    };

    if (isHttps && !isHostIp) {
      (reqOptions as any).servername = cleanHost;
    }

    let isSettled = false;
    let timer: NodeJS.Timeout | null = null;
    let req: http.ClientRequest | null = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    timer = setTimeout(() => {
      if (isSettled) return;
      isSettled = true;
      if (req) req.destroy(new Error('TIMEOUT'));
      reject(new Error('TIMEOUT'));
    }, timeoutMs);

    req = transport.request(reqOptions, (res) => {
      const statusCode = res.statusCode || 500;

      if (statusCode >= 300 && statusCode < 400) {
        cleanup();
        res.resume();
        if (!isSettled) {
          isSettled = true;
          reject(new Error('REDIRECT_BLOCKED'));
        }
        return;
      }

      const contentLengthHeader = res.headers['content-length'];
      if (contentLengthHeader) {
        const parsedLen = parseInt(contentLengthHeader, 10);
        if (!isNaN(parsedLen) && parsedLen > maxBytes) {
          cleanup();
          res.resume();
          if (!isSettled) {
            isSettled = true;
            reject(new Error('MAX_SIZE_EXCEEDED'));
          }
          return;
        }
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;

      res.on('data', (chunk: Buffer) => {
        if (isSettled) return;
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          isSettled = true;
          cleanup();
          res.destroy();
          reject(new Error('MAX_SIZE_EXCEEDED'));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        resolve({
          statusCode,
          headers: res.headers,
          buffer: Buffer.concat(chunks, totalBytes)
        });
      });

      res.on('error', (err) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        reject(err);
      });
    });

    req.on('error', (err) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      reject(err);
    });

    req.end();
  });
}

// Proxy endpoint to securely download a file from a URL for admin PDF import
app.post("/api/download-file", async (req, res) => {
  try {
    // 1. Verificação OBRIGATÓRIA de autenticação administrativa via Firebase ID Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Autenticação necessária. Cabeçalho Authorization ausente ou inválido." });
    }

    const idToken = authHeader.substring(7);
    let userEmail = "";
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      if (decodedToken && decodedToken.email) {
        userEmail = decodedToken.email.toLowerCase().trim();
      } else {
        return res.status(401).json({ error: "Token de autenticação não possui e-mail associado." });
      }
    } catch (tokenErr) {
      console.warn('[Download Security] ID Token fornecido é inválido:', tokenErr);
      return res.status(401).json({ error: "Token de autenticação inválido ou expirado." });
    }

    const ALLOWED_ADMINS = ['ysabelleosaraiva@gmail.com', 'yasabelleosaraiva@gmail.com', 'lucas1renck2melo@gmail.com'];
    if (!ALLOWED_ADMINS.includes(userEmail)) {
      return res.status(403).json({ error: "Acesso negado. Apenas administradores autorizados podem importar arquivos." });
    }

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "A URL do arquivo é obrigatória." });
    }

    // 2. Validação rigorosa de SSRF / DNS
    const val = await validateAndResolveUrl(url);
    if (!val.safe || !val.parsedUrl || !val.targetIp) {
      console.warn(`[Proxy Download] Requisição bloqueada por segurança (SSRF Protection): ${url} - ${val.reason}`);
      return res.status(400).json({ error: `URL inválida ou não permitida: ${val.reason}` });
    }

    console.log(`[Proxy Download] Admin ${userEmail} baixando arquivo via IP Pinned (${val.targetIp}): ${url}`);

    const MAX_BYTES = 25 * 1024 * 1024; // 25 MiB
    const TIMEOUT_MS = 15000; // 15 segundos

    try {
      const result = await fetchPinnedResource(
        { parsedUrl: val.parsedUrl, targetIp: val.targetIp, family: val.family || 4 },
        {},
        MAX_BYTES,
        TIMEOUT_MS
      );

      if (result.statusCode !== 200) {
        return res.status(result.statusCode).json({ error: `Falha ao baixar arquivo remoto (HTTP ${result.statusCode}).` });
      }

      const base64 = result.buffer.toString('base64');
      const contentType = (result.headers['content-type'] as string) || 'application/pdf';

      console.log(`[Proxy Download] Download concluído com sucesso. MimeType: ${contentType}, Tamanho: ${(result.buffer.byteLength / (1024 * 1024)).toFixed(2)} MB`);

      return res.json({
        success: true,
        base64,
        contentType
      });
    } catch (fetchErr: any) {
      if (fetchErr.message === 'REDIRECT_BLOCKED') {
        return res.status(400).json({ error: "Redirecionamentos HTTP (3xx) não são permitidos por motivos de segurança (SSRF)." });
      }
      if (fetchErr.message === 'TIMEOUT') {
        return res.status(408).json({ error: "O tempo limite para o download do arquivo foi excedido (15 segundos)." });
      }
      if (fetchErr.message === 'MAX_SIZE_EXCEEDED') {
        return res.status(400).json({ error: "O arquivo excede o limite máximo permitido de 25 MB." });
      }
      throw fetchErr;
    }
  } catch (err: any) {
    console.error("[Proxy Download] Erro ao baixar arquivo:", err);
    return res.status(500).json({ error: err.message || "Erro interno ao realizar o download do arquivo." });
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
        const response = await fetch(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(8000) });
        if (!response.ok) return res.status(200).json({ list: [] });
        const text = await response.text();
        const trimmed = text.trim();
        if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
          return res.status(200).json({ list: [] });
        }
        const data = JSON.parse(trimmed);
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
        return res.status(200).json({ list: [] });
      }
    }

    if (source === 'internetarchive') {
      try {
        const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(qStr)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=year&rows=${limit || 15}&page=1&output=json`;
        const response = await fetch(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(8000) });
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
        const response = await fetch(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(8000) });
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
        const response = await fetch(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(8000) });
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
        const response = await fetch(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(8000) });
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
        const response = await fetch(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(8000) });
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
          },
          signal: AbortSignal.timeout(8000)
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
        const response = await fetch(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(8000) });
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

// Endpoint for Web Image Search (DuckDuckGo Web Images) with optional Clinical Filter
app.get("/api/search-web-images", async (req, res) => {
  try {
    const query = (req.query.query || req.query.q || '') as string;
    const filterClinical = req.query.filter_clinical !== 'false' && req.query.filter_clinical !== '0';
    const limit = Math.min(parseInt((req.query.limit || '30') as string) || 30, 60);

    if (!query || query.trim().length === 0) {
      return res.status(200).json({ query: "", filter_clinical: filterClinical, count: 0, results: [] });
    }

    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
    
    let searchTerms = [query.trim()];
    if (!/medical|clinical|medicina|foto|lesion|exam/i.test(query)) {
      searchTerms.push(`${query.trim()} medical clinical photo`);
    }

    const rawResults: any[] = [];
    const seenUrls = new Set<string>();

    for (const qTerm of searchTerms) {
      try {
        const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(qTerm)}`;
        const initRes = await fetch(searchUrl, {
          headers: { "User-Agent": userAgent },
          signal: AbortSignal.timeout(5000)
        });
        if (!initRes.ok) continue;
        const html = await initRes.text();
        const vqdMatch = html.match(/vqd=["\x27]?([0-9a-zA-Z_\-]+)["\x27]?/) || html.match(/vqd=([0-9a-zA-Z_\-]+)/);
        if (!vqdMatch) continue;

        const vqd = vqdMatch[1];
        const imgApiUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(qTerm)}&vqd=${vqd}&f=,,,`;
        const imgRes = await fetch(imgApiUrl, {
          headers: {
            "User-Agent": userAgent,
            "Accept": "application/json",
            "Referer": "https://duckduckgo.com/"
          },
          signal: AbortSignal.timeout(6000)
        });

        if (!imgRes.ok) continue;
        const data = await imgRes.json();
        const list = data.results || [];

        for (const item of list) {
          if (!item.image) continue;
          const norm = item.image.split('?')[0].toLowerCase();
          if (seenUrls.has(norm)) continue;
          seenUrls.add(norm);
          rawResults.push(item);
        }
      } catch (err) {
        console.warn("[search-web-images] Term search warning:", qTerm, err);
      }
    }

    const BLOCKED_DOMAINS = [
      'fbsbx.com', 'facebook.com', 'fbcdn.net', 'instagram.com', 'tiktok.com',
      'twimg.com', 'pinterest.com', 'ytimg.com', 'youtube.com', 'vimeocdn.com', 'vimeo.com'
    ];
    const NON_CLINICAL_KEYWORDS = [
      'chart', 'graph', 'diagram', 'table', 'algorithm', 'schema', 'flowchart',
      'vector', 'icon', 'drawing', 'cartoon', 'infographic', 'structure',
      'pathway', 'tree', 'logo', 'slide', 'presentation', 'mindmap', 'clipart',
      'slidetodoc', 'slideplayer', 'slideshare', 'freepik', 'stock-vector'
    ];

    let filtered = rawResults.filter((item: any) => {
      const imgUrl = (item.image || '').toLowerCase();
      return !BLOCKED_DOMAINS.some(domain => imgUrl.includes(domain));
    });

    if (filterClinical) {
      filtered = filtered.filter((item: any) => {
        const imgUrl = (item.image || '').toLowerCase();
        const title = (item.title || '').toLowerCase();
        const source = (item.source || '').toLowerCase();
        const combined = `${title} ${imgUrl} ${source}`;

        if (imgUrl.endsWith('.svg')) return false;

        for (const kw of NON_CLINICAL_KEYWORDS) {
          if (combined.includes(kw)) return false;
        }

        return true;
      });
    }

    const finalResults = filtered.slice(0, limit).map((item: any, idx: number) => {
      let sourceDomain = item.source || '';
      if (!sourceDomain && item.url) {
        try {
          sourceDomain = new URL(item.url).hostname.replace('www.', '');
        } catch (e) {
          sourceDomain = 'Web';
        }
      }
      if (!sourceDomain) sourceDomain = 'Web';

      return {
        id: `web-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        title: item.title || query,
        url: item.image,
        thumbUrl: item.thumbnail || item.image,
        sourceUrl: item.url,
        sourceType: 'web',
        sourceName: `Busca Web (${sourceDomain})`,
        specialty: filterClinical ? 'Fotografia / Exame Clínico Real' : 'Resultado Web',
        authors: sourceDomain,
        caption: `Imagem obtida da web (${sourceDomain}). ${item.title || ''}`,
        width: item.width,
        height: item.height,
        score: filterClinical ? 140 : 100
      };
    });

    return res.json({
      query,
      filter_clinical: filterClinical,
      count: finalResults.length,
      results: finalResults
    });
  } catch (err: any) {
    console.error("[search-web-images error]", err.message);
    return res.status(200).json({ query: "", filter_clinical: false, count: 0, results: [] });
  }
});

// Proxy endpoint for summary images with IP Pinning, Magic Bytes validation, and size/timeout limits
app.get("/api/proxy-image", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    let imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send("Parameter 'url' is required.");
    }

    imageUrl = imageUrl.trim();

    if (imageUrl.includes("%25")) {
      imageUrl = decodeURIComponent(imageUrl);
    }

    if (imageUrl.startsWith("//")) {
      imageUrl = `https:${imageUrl}`;
    } else if (!/^https?:\/\//i.test(imageUrl)) {
      imageUrl = `https://${imageUrl}`;
    }

    const val = await validateAndResolveUrl(imageUrl);
    if (!val.safe || !val.parsedUrl || !val.targetIp) {
      console.warn(`[Proxy Image] URL recusada (SSRF Protection): ${imageUrl} - ${val.reason}`);
      return res.status(400).send(`Invalid image URL or non-permitted destination: ${val.reason}`);
    }

    const reqHeaders: Record<string, string> = {
      "Accept": "image/webp,image/apng,image/png,image/jpeg,image/*;q=0.8"
    };

    if (val.parsedUrl.hostname.includes("wikimedia.org") || val.parsedUrl.hostname.includes("wikipedia.org")) {
      reqHeaders["Referer"] = "https://commons.wikimedia.org/";
    } else if (val.parsedUrl.hostname.includes("nih.gov")) {
      reqHeaders["Referer"] = "https://openi.nlm.nih.gov/";
    } else if (val.parsedUrl.hostname.includes("plos.org")) {
      reqHeaders["Referer"] = "https://journals.plos.org/";
    }

    const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MiB
    const TIMEOUT_MS = 8000; // 8 segundos

    try {
      const result = await fetchPinnedResource(
        { parsedUrl: val.parsedUrl, targetIp: val.targetIp, family: val.family || 4 },
        reqHeaders,
        MAX_IMAGE_BYTES,
        TIMEOUT_MS
      );

      if (result.statusCode !== 200) {
        console.error(`[Proxy Image] Remote host returned status ${result.statusCode} for ${imageUrl}`);
        return res.status(result.statusCode).send(`Failed to read remote image resource (HTTP ${result.statusCode}).`);
      }

      // Validação estrita de Magic Bytes no buffer da imagem
      const imgVal = validateImageContent(result.buffer);
      if (!imgVal.safe) {
        console.error(`[Proxy Image] Magic bytes check failed for ${imageUrl}: ${imgVal.error}`);
        return res.status(415).send(`URL returned non-image or invalid format: ${imgVal.error}`);
      }

      const finalContentType = imgVal.detectedType || (result.headers['content-type'] as string) || 'image/jpeg';

      res.setHeader("Content-Type", finalContentType);
      res.setHeader("Cache-Control", "public, max-age=604800, s-maxage=604800, immutable");
      res.setHeader("Content-Length", result.buffer.length.toString());

      return res.send(result.buffer);
    } catch (fetchErr: any) {
      if (fetchErr.message === 'REDIRECT_BLOCKED') {
        return res.status(400).send("HTTP redirects (3xx) are blocked for security.");
      }
      if (fetchErr.message === 'TIMEOUT') {
        return res.status(504).send("Proxy timeout fetching remote image (8s exceeded).");
      }
      if (fetchErr.message === 'MAX_SIZE_EXCEEDED') {
        return res.status(400).send("Image file exceeds maximum permitted size of 10 MB.");
      }
      throw fetchErr;
    }
  } catch (err: any) {
    console.error("[Proxy Image Exception]", err.message);
    return res.status(504).send("Proxy server-side error: " + err.message);
  }
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
            newUntilDate = new Date(baseMs + 30 * 24 * 60 * 60 * 1000);
          } else {
            newUntilDate = new Date(nowMs + 30 * 24 * 60 * 60 * 1000);
          }

          const currentNotifications = Array.isArray(friendData?.referralNotifications) ? friendData.referralNotifications : [];
          const newNotification = {
            id: Math.random().toString(36).substring(2, 9),
            fromName: userData.displayName || userData.email || 'Um usuário indicado',
            date: new Date().toISOString(),
            type: 'bonus_received',
            daysGranted: 30
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
            daysGranted: 30
          });

          console.log(`[Referral Process] Successfully granted +30 days extended plan access to key owner ${friendUid}`);
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
        } else if (desc.includes('combo ouro') || desc.includes('combo')) {
          planId = 'combo_ouro';
        }
        const defaultUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        try {
          await db.collection('users').doc(paymentUserId).update({
            isPremium: true,
            planType: planId,
            premiumPlan: planId,
            premiumPaymentId: String(paymentId),
            premiumProvider: 'MercadoPago',
            premiumSince: admin.firestore.FieldValue.serverTimestamp(),
            premiumUntil: defaultUntil,
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
        } else if (desc.includes('combo ouro') || desc.includes('combo')) {
          planId = 'combo_ouro';
        }
        const defaultUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        try {
          await db.collection('users').doc(userId).update({
            isPremium: true,
            planType: planId,
            premiumPlan: planId,
            premiumPaymentId: String(paymentId),
            premiumProvider: 'MercadoPago',
            premiumSince: admin.firestore.FieldValue.serverTimestamp(),
            premiumUntil: defaultUntil,
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

// MedRevise Staging Persistence Endpoint
// MedRevise Staging Persistence Endpoint
app.post('/api/admin/staging/save-batch', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autorização ausente.' });
    }
    const token = authHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (tokErr) {
      console.warn('[Staging Auth] Token verification failed:', tokErr);
      return res.status(401).json({ error: 'Token de autorização inválido ou expirado.' });
    }

    const userEmail = (decodedToken.email || '').toLowerCase().trim();
    const isSpecialUser = userEmail === 'lucas1renck2melo@gmail.com' || userEmail === 'ysabelleosaraiva@gmail.com';

    if (!isSpecialUser) {
      return res.status(403).json({ error: 'Acesso negado. Usuário não possui privilégios administrativos.' });
    }

    const { batchId, questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Nenhuma questão fornecida no payload para persistência.' });
    }

    if (questions.length > 200) {
      return res.status(400).json({ error: 'Lote excede o limite máximo permitido de 200 questões por requisição.' });
    }

    const stagingUrl = currentSupabaseUrl;
    const stagingKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!stagingKey) {
      console.error('[Staging Save Batch] SUPABASE_SERVICE_ROLE_KEY não configurada. Persistência indisponível.');
      return res.status(503).json({ error: 'Serviço de persistência temporariamente indisponível (configuração pendente).' });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const stagingClient = createClient(stagingUrl, stagingKey);

    const results: any[] = [];
    let insertedCount = 0;
    let conflictCount = 0;
    let errorCount = 0;

    for (const q of questions) {
      try {
        const { data: rpcResult, error: rpcError } = await stagingClient
          .rpc('upsert_question_atomic', {
            p_batch_id: batchId,
            p_question_id: q.id,
            p_statement: q.statement,
            p_question_type: q.questionType,
            p_is_discursive: q.isDiscursive,
            p_correct_option_index: q.correctOptionIndex,
            p_correct_answer: q.correctAnswer,
            p_alternatives: q.alternatives,
            p_explanation: q.explanation,
            p_topic: q.topic,
            p_sub_subject: q.subSubject,
            p_source_document_id: q.sourceDocumentId,
            p_content_hash: q.contentHash,
            p_dry_run: false,
          });

        if (rpcError) {
          throw rpcError;
        }

        results.push({ questionId: q.id, status: 'SUCCESS' });
        insertedCount++;
      } catch (err: any) {
        console.error(`[Staging Save Batch] Erro ao gravar questão ${q.id}:`, err);
        results.push({ questionId: q.id, status: 'ERROR', message: err.message });
        errorCount++;
      }
    }

    return res.json({
      status: errorCount === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS',
      summary: { total: questions.length, inserted: insertedCount, error: errorCount },
      results
    });

  } catch (error: any) {
    console.error('[Staging Save Batch] Erro inesperado:', error);
    res.status(500).json({ error: 'Erro interno ao processar o lote de persistência.' });
  }
});// ============================================================================
// ENDPOINTS DE PROTOCOLO DE SEGURANÇA PARA DADOS PRIVADOS DO USUÁRIO
// ============================================================================
const getSupabaseAdmin = () => {
  return createClient(
    EXPECTED_CONFIG.supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
};

async function verifyFirebaseTokenMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '[Security] Token de autenticação não fornecido.' });
  }
  const token = authHeader.split('Bearer ')[1].trim();
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (err) {
    return res.status(401).json({ error: '[Security] Token de autenticação inválido ou expirado.' });
  }
}

const CANONICAL_ADMIN_EMAILS = [
  'lucas1renck2melo@gmail.com',
  'ysabelleosaraiva@gmail.com',
  'yasabelleosaraiva@gmail.com'
];

async function verifyAdminAuthorizationMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '[Admin Security] Token de autenticação não fornecido.' });
  }
  const token = authHeader.split('Bearer ')[1].trim();
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userEmail = (decodedToken.email || '').toLowerCase().trim();
    
    let isAdmin = CANONICAL_ADMIN_EMAILS.includes(userEmail) || decodedToken.admin === true;

    if (!isAdmin) {
      return res.status(403).json({ error: '[Admin Security] Acesso negado. Requer privilégios de administrador.' });
    }

    (req as any).user = decodedToken;
    next();
  } catch (err) {
    return res.status(401).json({ error: '[Admin Security] Token de autenticação inválido ou expirado.' });
  }
}

const PRIVILEGED_PROFILE_KEYS = new Set([
  'role',
  'admin',
  'isadmin',
  'is_admin',
  'ispremium',
  'is_premium',
  'islifetimepremium',
  'is_lifetime_premium',
  'lifetimepremium',
  'premiumprovider',
  'premium_provider',
  'premiumpaymentid',
  'premium_payment_id',
  'premiumsince',
  'premium_since',
  'premiumuntil',
  'premium_until',
  'premiumplan',
  'premium_plan',
  'plantype',
  'plan_type',
  'referralrewardgranted',
  'referral_reward_granted'
]);

function normalizeProfileKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findPrivilegedFields(obj: any, parentPath = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const violations: string[] = [];

  for (const rawKey of Object.keys(obj)) {
    const fullPath = parentPath ? `${parentPath}.${rawKey}` : rawKey;
    const leafKey = rawKey.includes('.') ? rawKey.split('.').pop()! : rawKey;
    const normalizedRaw = normalizeProfileKey(rawKey);
    const normalizedLeaf = normalizeProfileKey(leafKey);

    if (PRIVILEGED_PROFILE_KEYS.has(normalizedRaw) || PRIVILEGED_PROFILE_KEYS.has(normalizedLeaf)) {
      violations.push(fullPath);
    }

    const val = obj[rawKey];
    if (val && typeof val === 'object' && !(val instanceof Date) && !Array.isArray(val)) {
      violations.push(...findPrivilegedFields(val, fullPath));
    }
  }

  return violations;
}

function checkUserDocumentAuthorization(collection: string, docId: string, authUid: string, docDataInDb?: any): boolean {
  if (!authUid) return false;
  if (collection === 'userProgress' || collection === 'users') {
    return docId === authUid;
  }
  if (collection.startsWith('users/')) {
    const parts = collection.split('/');
    return parts[1] === authUid;
  }
  if (collection === 'quizAttempts' || collection === 'flashcardSessions' || collection === 'userSuggestions' || collection === 'studySessions') {
    if (docDataInDb) {
      const owner = docDataInDb.userId || docDataInDb.uid || docDataInDb.userEmail;
      if (owner === authUid) return true;
      if (typeof docId === 'string' && (docId.startsWith(authUid + '_') || docId === authUid)) return true;
      return false;
    }
    if (typeof docId === 'string' && (docId.startsWith(authUid + '_') || docId === authUid)) {
      return true;
    }
    return false;
  }
  return false;
}

app.post('/api/user-documents/get-doc', verifyFirebaseTokenMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { collection, id } = req.body;
    const uid = (req as any).user.uid;
    const userEmail = ((req as any).user.email || '').toLowerCase().trim();
    const isReqAdmin = CANONICAL_ADMIN_EMAILS.includes(userEmail) || (req as any).user.admin === true;

    if (!collection || !id) {
      return res.status(400).json({ error: 'Parâmetros collection e id são obrigatórios.' });
    }

    const supaAdmin = getSupabaseAdmin();
    const { data, error } = await supaAdmin
      .from('firestore_documents')
      .select('*')
      .eq('collection', collection)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.json({ data: null, exists: false });

    if (!isReqAdmin && !checkUserDocumentAuthorization(collection, id, uid, data.data)) {
      return res.status(403).json({ error: '[Security] Acesso negado a documento de outro usuário.' });
    }

    return res.json({ data: data.data || null, exists: true });
  } catch (err: any) {
    console.error('[UserDoc Get Error]:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao buscar documento de usuário.' });
  }
});

app.post('/api/user-documents/set-doc', verifyFirebaseTokenMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { collection, id, docData, merge } = req.body;
    const uid = (req as any).user.uid;
    const userEmail = ((req as any).user.email || '').toLowerCase().trim();
    const isReqAdmin = CANONICAL_ADMIN_EMAILS.includes(userEmail) || (req as any).user.admin === true;

    if (!collection || !id || !docData) {
      return res.status(400).json({ error: 'Parâmetros collection, id e docData são obrigatórios.' });
    }

    if (!isReqAdmin) {
      if (docData.userId && docData.userId !== uid) {
        return res.status(403).json({ error: '[Security] userId no payload diverge do usuário autenticado.' });
      }
      if (docData.uid && docData.uid !== uid) {
        return res.status(403).json({ error: '[Security] uid no payload diverge do usuário autenticado.' });
      }
      if (collection === 'users' && id !== uid) {
        return res.status(403).json({ error: '[Security] Acesso negado para gravar dados no perfil de outro usuário.' });
      }

      if (collection === 'users') {
        const violations = findPrivilegedFields(docData);
        if (violations.length > 0) {
          return res.status(403).json({
            error: `[Security] Tentativa não autorizada de alterar campos privilegiados do perfil: ${violations.join(', ')}.`
          });
        }
      }
    }

    const supaAdmin = getSupabaseAdmin();
    const { data: existing } = await supaAdmin
      .from('firestore_documents')
      .select('data')
      .eq('collection', collection)
      .eq('id', id)
      .maybeSingle();

    if (!isReqAdmin) {
      if (!checkUserDocumentAuthorization(collection, id, uid, existing?.data)) {
        return res.status(403).json({ error: '[Security] Acesso negado para gravar em outro usuário.' });
      }
    }

    let payloadWithUid = { ...docData };
    if (collection !== 'users') {
      payloadWithUid.userId = uid;
    } else {
      payloadWithUid.uid = uid;
    }

    let finalData = payloadWithUid;

    if (merge && existing?.data) {
      finalData = { ...existing.data, ...payloadWithUid };
    }

    // Preserve existing privileged fields on user profile if non-admin writes
    if (!isReqAdmin && collection === 'users' && existing?.data) {
      for (const privKey of ['role', 'admin', 'isPremium', 'isLifetimePremium', 'premiumProvider', 'premiumPaymentId', 'premiumSince', 'premiumUntil', 'premiumPlan', 'planType', 'referralRewardGranted']) {
        if (existing.data[privKey] !== undefined && finalData[privKey] === undefined) {
          finalData[privKey] = existing.data[privKey];
        }
      }
    }

    const { error } = await supaAdmin
      .from('firestore_documents')
      .upsert({
        collection,
        id,
        data: finalData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'collection,id' });

    if (error) throw error;
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[UserDoc Set Error]:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao gravar documento do usuário.' });
  }
});

app.post('/api/user-documents/add-doc', verifyFirebaseTokenMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { collection, docData } = req.body;
    const uid = (req as any).user.uid;
    const userEmail = ((req as any).user.email || '').toLowerCase().trim();
    const isReqAdmin = CANONICAL_ADMIN_EMAILS.includes(userEmail) || (req as any).user.admin === true;

    if (!collection || !docData) {
      return res.status(400).json({ error: 'Parâmetros collection e docData são obrigatórios.' });
    }

    const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    if (!isReqAdmin && !checkUserDocumentAuthorization(collection, id, uid)) {
      return res.status(403).json({ error: '[Security] Acesso negado para criar documento.' });
    }

    const payloadWithUid = { ...docData, userId: uid };
    const supaAdmin = getSupabaseAdmin();
    const { error } = await supaAdmin
      .from('firestore_documents')
      .insert({
        collection,
        id,
        data: payloadWithUid,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    return res.json({ id });
  } catch (err: any) {
    console.error('[UserDoc Add Error]:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao adicionar documento do usuário.' });
  }
});

app.post('/api/user-documents/update-doc', verifyFirebaseTokenMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { collection, id, updateFields } = req.body;
    const uid = (req as any).user.uid;
    const userEmail = ((req as any).user.email || '').toLowerCase().trim();
    const isReqAdmin = CANONICAL_ADMIN_EMAILS.includes(userEmail) || (req as any).user.admin === true;

    if (!collection || !id || !updateFields) {
      return res.status(400).json({ error: 'Parâmetros collection, id e updateFields são obrigatórios.' });
    }

    if (!isReqAdmin) {
      if (updateFields.userId && updateFields.userId !== uid) {
        return res.status(403).json({ error: '[Security] Tentativa de alterar o proprietário userId.' });
      }
      if (updateFields.uid && updateFields.uid !== uid) {
        return res.status(403).json({ error: '[Security] Tentativa de alterar o proprietário uid.' });
      }
      if (collection === 'users' && id !== uid) {
        return res.status(403).json({ error: '[Security] Acesso negado para atualizar perfil de outro usuário.' });
      }

      if (collection === 'users') {
        const violations = findPrivilegedFields(updateFields);
        if (violations.length > 0) {
          return res.status(403).json({
            error: `[Security] Tentativa não autorizada de alterar campos privilegiados do perfil: ${violations.join(', ')}.`
          });
        }
      }
    }

    const supaAdmin = getSupabaseAdmin();
    const { data: existing } = await supaAdmin
      .from('firestore_documents')
      .select('data')
      .eq('collection', collection)
      .eq('id', id)
      .maybeSingle();

    if (!isReqAdmin) {
      if (!checkUserDocumentAuthorization(collection, id, uid, existing?.data)) {
        return res.status(403).json({ error: '[Security] Acesso negado para atualizar outro usuário.' });
      }
    }

    const mergedData = existing?.data ? { ...existing.data } : {};

    for (const [key, val] of Object.entries(updateFields)) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let current = mergedData;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current[part] || typeof current[part] !== 'object') {
            current[part] = {};
          }
          current = current[part];
        }
        current[parts[parts.length - 1]] = val;
      } else {
        mergedData[key] = val;
      }
    }

    if (collection !== 'users') {
      mergedData.userId = uid;
    } else {
      mergedData.uid = uid;
    }

    const { error } = await supaAdmin
      .from('firestore_documents')
      .upsert({
        collection,
        id,
        data: mergedData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'collection,id' });

    if (error) throw error;
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[UserDoc Update Error]:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao atualizar documento do usuário.' });
  }
});

app.post('/api/user-documents/delete-doc', verifyFirebaseTokenMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { collection, id } = req.body;
    const uid = (req as any).user.uid;
    const userEmail = ((req as any).user.email || '').toLowerCase().trim();
    const isReqAdmin = CANONICAL_ADMIN_EMAILS.includes(userEmail) || (req as any).user.admin === true;

    if (!collection || !id) {
      return res.status(400).json({ error: 'Parâmetros collection e id são obrigatórios.' });
    }

    if (!isReqAdmin) {
      if (collection === 'users' && id !== uid) {
        return res.status(403).json({ error: '[Security] Acesso negado para excluir perfil de outro usuário.' });
      }
    }

    const supaAdmin = getSupabaseAdmin();
    const { data: existing } = await supaAdmin
      .from('firestore_documents')
      .select('data')
      .eq('collection', collection)
      .eq('id', id)
      .maybeSingle();

    if (!isReqAdmin) {
      if (!checkUserDocumentAuthorization(collection, id, uid, existing?.data)) {
        return res.status(403).json({ error: '[Security] Acesso negado para excluir documento de outro usuário.' });
      }
    }

    const { error } = await supaAdmin
      .from('firestore_documents')
      .delete()
      .eq('collection', collection)
      .eq('id', id);

    if (error) throw error;
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[UserDoc Delete Error]:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao excluir documento de usuário.' });
  }
});

app.post('/api/user-documents/get-docs', verifyFirebaseTokenMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { collection } = req.body;
    const uid = (req as any).user.uid;

    if (!collection) {
      return res.status(400).json({ error: 'Parâmetro collection é obrigatório.' });
    }

    const supaAdmin = getSupabaseAdmin();
    let supaQuery = supaAdmin
      .from('firestore_documents')
      .select('id, data')
      .eq('collection', collection);

    if (collection === 'userProgress' || collection === 'users') {
      supaQuery = supaQuery.eq('id', uid);
    } else if (collection.startsWith('users/')) {
      const parts = collection.split('/');
      if (parts[1] !== uid) {
        return res.status(403).json({ error: '[Security] Acesso negado.' });
      }
    } else {
      // Force strict UID isolation
      supaQuery = supaQuery.or(`id.eq.${uid},id.like.${uid}_%,data->>userId.eq.${uid}`);
    }

    const { data, error } = await supaQuery;
    if (error) throw error;

    return res.json({ docs: data || [] });
  } catch (err: any) {
    console.error('[UserDoc GetDocs Error]:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao buscar documentos do usuário.' });
  }
});

// ============================================================================
// ENDPOINTS ADMINISTRATIVOS PROTEGIDOS (REQUEREM CANONICAL ADMIN EMAIL OU ROLE)
// ============================================================================
const ALLOWED_ADMIN_COLLECTIONS = [
  'questions',
  'topics',
  'subjects',
  'semesters',
  'sourceDocuments',
  'source_documents',
  'examSets',
  'simulados',
  'imported_exams'
];

app.post('/api/admin/content/add-doc', verifyAdminAuthorizationMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { collection, docData } = req.body;

    if (!collection || !docData) {
      return res.status(400).json({ error: 'Parâmetros collection e docData são obrigatórios.' });
    }

    if (!ALLOWED_ADMIN_COLLECTIONS.includes(collection)) {
      return res.status(403).json({ error: `[Admin Security] A coleção "${collection}" não é uma coleção administrativa autorizada.` });
    }

    const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const supaAdmin = getSupabaseAdmin();
    const { error } = await supaAdmin
      .from('firestore_documents')
      .insert({
        collection,
        id,
        data: docData,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    return res.json({ id });
  } catch (err: any) {
    console.error('[Admin Add Error]:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao adicionar conteúdo administrativo.' });
  }
});

app.post('/api/admin/content/set-doc', verifyAdminAuthorizationMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { collection, id, docData, merge } = req.body;

    if (!collection || !id || !docData) {
      return res.status(400).json({ error: 'Parâmetros collection, id e docData são obrigatórios.' });
    }

    if (!ALLOWED_ADMIN_COLLECTIONS.includes(collection)) {
      return res.status(403).json({ error: `[Admin Security] A coleção "${collection}" não é uma coleção administrativa autorizada.` });
    }

    const supaAdmin = getSupabaseAdmin();
    let finalData = docData;

    if (merge) {
      const { data: existing } = await supaAdmin
        .from('firestore_documents')
        .select('data')
        .eq('collection', collection)
        .eq('id', id)
        .maybeSingle();

      if (existing?.data) {
        finalData = { ...existing.data, ...docData };
      }
    }

    const { error } = await supaAdmin
      .from('firestore_documents')
      .upsert({
        collection,
        id,
        data: finalData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'collection,id' });

    if (error) throw error;
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Admin Set Error]:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao gravar conteúdo administrativo.' });
  }
});

app.post('/api/admin/content/update-doc', verifyAdminAuthorizationMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { collection, id, updateFields } = req.body;

    if (!collection || !id || !updateFields) {
      return res.status(400).json({ error: 'Parâmetros collection, id e updateFields são obrigatórios.' });
    }

    if (!ALLOWED_ADMIN_COLLECTIONS.includes(collection)) {
      return res.status(403).json({ error: `[Admin Security] A coleção "${collection}" não é uma coleção administrativa autorizada.` });
    }

    const supaAdmin = getSupabaseAdmin();
    const { data: existing } = await supaAdmin
      .from('firestore_documents')
      .select('data')
      .eq('collection', collection)
      .eq('id', id)
      .maybeSingle();

    const mergedData = existing?.data ? { ...existing.data, ...updateFields } : { ...updateFields };

    const { error } = await supaAdmin
      .from('firestore_documents')
      .upsert({
        collection,
        id,
        data: mergedData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'collection,id' });

    if (error) throw error;
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Admin Update Error]:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao atualizar conteúdo administrativo.' });
  }
});

app.post('/api/admin/content/delete-doc', verifyAdminAuthorizationMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { collection, id } = req.body;

    if (!collection || !id) {
      return res.status(400).json({ error: 'Parâmetros collection e id são obrigatórios.' });
    }

    if (!ALLOWED_ADMIN_COLLECTIONS.includes(collection)) {
      return res.status(403).json({ error: `[Admin Security] A coleção "${collection}" não é uma coleção administrativa autorizada.` });
    }

    const supaAdmin = getSupabaseAdmin();
    const { error } = await supaAdmin
      .from('firestore_documents')
      .delete()
      .eq('collection', collection)
      .eq('id', id);

    if (error) throw error;
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[Admin Delete Error]:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao excluir conteúdo administrativo.' });
  }
});


// Handle AI Studio internal control plane file reads directly
app.get('/__aistudio_internal_control_plane/fs/read', (req, res) => {
  const relPath = req.query.path as string;
  if (!relPath) return res.status(400).send('Missing path parameter');
  const fullPath = path.resolve(process.cwd(), relPath);
  if (fs.existsSync(fullPath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.sendFile(fullPath);
  }
  return res.status(404).send('File not found');
});

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
