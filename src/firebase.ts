import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as realSignOut, 
  signInAnonymously, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile, 
  onAuthStateChanged as realOnAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  collection as realCollection,
  getDocs as realGetDocs,
  doc as realDoc,
  getDoc as realGetDoc,
  query as realQuery,
  where as realWhere
} from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

// Carregamento estático da configuração do applet via macro de compilação do Vite
// Sem verificação em runtime de import.meta.glob, garantindo que o bundle resolva estaticamente o JSON
const appletConfigs: Record<string, any> = (import.meta as any).glob('../firebase-applet-config.json', { eager: true });
const rawAppletConfig = appletConfigs['../firebase-applet-config.json'];
const firebaseConfig: Record<string, any> | null = (rawAppletConfig && (rawAppletConfig.default || rawAppletConfig)) || null;
export { firebaseConfig };

// Validacao estrita de ambiente de execucao
const metaEnv = (import.meta as any).env || (typeof process !== 'undefined' ? process.env : {});
const appEnv = metaEnv.VITE_APP_ENV;

const TEST_FIREBASE_PROJECT_ID = 'teste-migracao-e7027';
const TEST_SUPABASE_URL = 'https://xoijnmpadomzxoftjune.supabase.co';

const PROD_FIREBASE_PROJECT_ID = 'gen-lang-client-0128984368';
const PROD_SUPABASE_URL = 'https://jhttjndhjzpfphqxjiao.supabase.co';
const PROD_FIRESTORE_DATABASE_ID = 'ai-studio-91f1d7eb-cec1-4159-8148-4ba7d6a63b82';

interface ActiveFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

let activeFirebaseConfig: ActiveFirebaseConfig;
let activeSupabaseUrl: string;
let activeSupabaseAnonKey: string;

const isTestConfigured = metaEnv.VITE_TEST_FIREBASE_API_KEY && 
                        metaEnv.VITE_TEST_FIREBASE_AUTH_DOMAIN && 
                        metaEnv.VITE_TEST_FIREBASE_PROJECT_ID && 
                        metaEnv.VITE_TEST_FIREBASE_APP_ID;

if (appEnv === 'test') {
  if (!isTestConfigured) {
    throw new Error('[Environment Error] VITE_APP_ENV="test" configurado, mas as credenciais de teste (VITE_TEST_FIREBASE_*) não foram fornecidas. Fallback para produção bloqueado.');
  }
  const testApiKey = metaEnv.VITE_TEST_FIREBASE_API_KEY;
  const testAuthDomain = metaEnv.VITE_TEST_FIREBASE_AUTH_DOMAIN;
  const testProjectId = metaEnv.VITE_TEST_FIREBASE_PROJECT_ID;
  const testAppId = metaEnv.VITE_TEST_FIREBASE_APP_ID;
  const testDbId = metaEnv.VITE_TEST_FIREBASE_DATABASE_ID;
  const testSupaUrl = metaEnv.VITE_TEST_SUPABASE_URL;
  const testSupaAnonKey = metaEnv.VITE_TEST_SUPABASE_ANON_KEY;

  if (testProjectId !== TEST_FIREBASE_PROJECT_ID) {
    throw new Error('[Environment Error] Test Firebase Project ID mismatch. Expected "teste-migracao-e7027".');
  }

  if (!testSupaUrl || testSupaUrl !== TEST_SUPABASE_URL) {
    throw new Error('[Environment Error] Test Supabase URL mismatch. Expected "https://xoijnmpadomzxoftjune.supabase.co".');
  }

  if (!testSupaAnonKey) {
    throw new Error('[Environment Error] Missing required test Supabase anon key.');
  }

  const trimmedTestDbId = typeof testDbId === 'string' ? testDbId.trim() : '';
  if (!trimmedTestDbId) {
    throw new Error('[Environment Error] Missing or empty required test Firestore database ID (VITE_TEST_FIREBASE_DATABASE_ID).');
  }

  activeFirebaseConfig = {
    apiKey: testApiKey,
    authDomain: testAuthDomain,
    projectId: testProjectId,
    appId: testAppId,
    firestoreDatabaseId: trimmedTestDbId
  };
  activeSupabaseUrl = testSupaUrl;
  activeSupabaseAnonKey = testSupaAnonKey;
} else if (appEnv === 'production') {
  const prodApiKey = metaEnv.VITE_FIREBASE_API_KEY;
  const prodAuthDomain = metaEnv.VITE_FIREBASE_AUTH_DOMAIN;
  const prodProjectId = metaEnv.VITE_FIREBASE_PROJECT_ID;
  const prodAppId = metaEnv.VITE_FIREBASE_APP_ID;
  const prodDbId = metaEnv.VITE_FIREBASE_DATABASE_ID;
  const prodSupaUrl = metaEnv.VITE_SUPABASE_URL;
  const prodSupaAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY;

  if (!prodApiKey || !prodAuthDomain || !prodProjectId || !prodAppId) {
    throw new Error('[Environment Error] Missing required production Firebase configuration (API key, authDomain, projectId, appId).');
  }

  if (typeof prodApiKey === 'string' && prodApiKey.startsWith('GOCSPX-')) {
    throw new Error('[Security Error] Invalid production Firebase API Key: Detected Google OAuth Client Secret ("GOCSPX-..."). A Firebase Web API Key must start with "AIzaSy".');
  }

  if (prodProjectId !== PROD_FIREBASE_PROJECT_ID) {
    throw new Error('[Environment Error] Production Firebase Project ID mismatch. Expected "gen-lang-client-0128984368".');
  }

  if (!prodDbId) {
    throw new Error('[Environment Error] Missing required production Firestore database ID (VITE_FIREBASE_DATABASE_ID).');
  }

  if (prodDbId !== PROD_FIRESTORE_DATABASE_ID) {
    throw new Error('[Environment Error] Production Firestore Database ID mismatch. Expected "ai-studio-91f1d7eb-cec1-4159-8148-4ba7d6a63b82".');
  }

  if (!prodSupaUrl || prodSupaUrl !== PROD_SUPABASE_URL) {
    throw new Error('[Environment Error] Production Supabase URL mismatch. Expected "https://jhttjndhjzpfphqxjiao.supabase.co".');
  }

  if (!prodSupaAnonKey) {
    throw new Error('[Environment Error] Missing required production Supabase anon key.');
  }

  activeFirebaseConfig = {
    apiKey: prodApiKey,
    authDomain: prodAuthDomain,
    projectId: prodProjectId,
    appId: prodAppId,
    firestoreDatabaseId: prodDbId
  };
  activeSupabaseUrl = prodSupaUrl;
  activeSupabaseAnonKey = prodSupaAnonKey;
} else {
  // Safe Preview Mode (AI Studio): utiliza a infraestrutura de produção definida
  const appletApiKey = firebaseConfig?.apiKey || firebaseConfig?.default?.apiKey;
  const appletProjectId = firebaseConfig?.projectId || firebaseConfig?.default?.projectId;
  const appletAuthDomain = firebaseConfig?.authDomain || firebaseConfig?.default?.authDomain;
  const appletAppId = firebaseConfig?.appId || firebaseConfig?.default?.appId;
  const appletDbId = firebaseConfig?.firestoreDatabaseId || firebaseConfig?.default?.firestoreDatabaseId;

  const candidateProjectId = appletProjectId
    ? appletProjectId
    : (metaEnv.VITE_FIREBASE_PROJECT_ID === PROD_FIRESTORE_DATABASE_ID ? PROD_FIREBASE_PROJECT_ID : (metaEnv.VITE_FIREBASE_PROJECT_ID || ''));
  const candidateSupaUrl = metaEnv.VITE_SUPABASE_URL || PROD_SUPABASE_URL;

  // Verificação estrita de divergência no Preview
  if (candidateSupaUrl !== PROD_SUPABASE_URL) {
    throw new Error('[Environment Error] Divergência no Preview: VITE_SUPABASE_URL não corresponde ao Supabase esperado.');
  }

  if (candidateProjectId && candidateProjectId !== PROD_FIREBASE_PROJECT_ID) {
    throw new Error('[Environment Error] Divergência no Preview: Firebase Project ID não corresponde ao projeto esperado.');
  }

  if (appletApiKey && typeof appletApiKey === 'string' && !appletApiKey.startsWith('GOCSPX-')) {
    activeFirebaseConfig = {
      apiKey: appletApiKey,
      authDomain: appletAuthDomain || `${PROD_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: appletProjectId || PROD_FIREBASE_PROJECT_ID,
      appId: appletAppId || '',
      firestoreDatabaseId: appletDbId || PROD_FIRESTORE_DATABASE_ID
    };
  } else if (metaEnv.VITE_FIREBASE_API_KEY && (metaEnv.VITE_FIREBASE_PROJECT_ID || metaEnv.VITE_FIREBASE_AUTH_DOMAIN)) {
    if (typeof metaEnv.VITE_FIREBASE_API_KEY === 'string' && metaEnv.VITE_FIREBASE_API_KEY.startsWith('GOCSPX-')) {
      throw new Error('[Security Error] Invalid Firebase Web API Key in VITE_FIREBASE_API_KEY: Detected Google OAuth Client Secret ("GOCSPX-..."). A Firebase Web API Key must start with "AIzaSy".');
    }
    activeFirebaseConfig = {
      apiKey: metaEnv.VITE_FIREBASE_API_KEY,
      authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || `${PROD_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: (metaEnv.VITE_FIREBASE_PROJECT_ID === PROD_FIRESTORE_DATABASE_ID || !metaEnv.VITE_FIREBASE_PROJECT_ID) ? PROD_FIREBASE_PROJECT_ID : metaEnv.VITE_FIREBASE_PROJECT_ID,
      appId: metaEnv.VITE_FIREBASE_APP_ID || '',
      firestoreDatabaseId: metaEnv.VITE_FIREBASE_DATABASE_ID || PROD_FIRESTORE_DATABASE_ID
    };
  } else {
    throw new Error(
      '[Environment Error] Missing Firebase configuration. For production, set VITE_APP_ENV="production" and configure all required VITE_FIREBASE_* variables.'
    );
  }

  activeSupabaseUrl = PROD_SUPABASE_URL;
  activeSupabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';
}

function getOrInitializeFirebaseApp(config: ActiveFirebaseConfig): FirebaseApp {
  if (typeof config.apiKey === 'string' && config.apiKey.startsWith('GOCSPX-')) {
    throw new Error('[Security Error] Refusing to initialize Firebase with Google OAuth Client Secret (starts with "GOCSPX-"). A Firebase Web API Key starting with "AIzaSy" is required.');
  }
  const existingApps = getApps();
  if (existingApps.length === 0) {
    return initializeApp(config);
  }

  if (existingApps.length > 1) {
    throw new Error(
      `[Security Error] Multiple Firebase app instances detected (${existingApps.length}). Ambiguous state, initialization aborted.`
    );
  }

  const singleApp = existingApps[0];
  if (singleApp.name !== '[DEFAULT]') {
    throw new Error(
      `[Security Error] Pre-existing Firebase app is not the default instance (name: "${singleApp.name}"). Expected "[DEFAULT]".`
    );
  }

  const defaultOptions = singleApp.options;

  if (
    defaultOptions.projectId !== config.projectId ||
    defaultOptions.apiKey !== config.apiKey ||
    defaultOptions.authDomain !== config.authDomain ||
    defaultOptions.appId !== config.appId
  ) {
    throw new Error(
      `[Security Error] Existing Firebase app instance does not match active environment configuration for project "${config.projectId}". Initialization aborted.`
    );
  }

  return singleApp;
}

// Inicializa a aplicacao Firebase estritamente isolada
const app = getOrInitializeFirebaseApp(activeFirebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Inicializa o cliente Supabase isolado e exporta valores compativeis
export const supabaseUrl = activeSupabaseUrl;
export const supabaseAnonKey = activeSupabaseAnonKey;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const db = { type: 'firestore_db' }; // Placeholder for DB reference

// REDIRECT ALL FIRESTORE CALLS TO SUPABASE FOR UNIFIED APP PLATFORM WITH FULL PATH ISOLATION
export function collection(dbInstance: any, ...pathSegments: string[]): any {
  const collectionName = pathSegments.join('/');
  return {
    type: 'collection',
    collectionName
  };
}

export function doc(dbInstance: any, ...pathSegments: string[]): any {
  let collectionName = '';
  let id = '';
  
  if (pathSegments.length % 2 === 0) {
    id = pathSegments[pathSegments.length - 1];
    collectionName = pathSegments.slice(0, -1).join('/');
  } else {
    collectionName = pathSegments.join('/');
    id = '';
  }

  // Canonicalize userProgress paths so users/${userId}/progress/main and userProgress/${userId} are 100% unified
  if (collectionName.startsWith('users/') && collectionName.split('/').length === 3) {
    const parts = collectionName.split('/');
    if (parts[2] === 'progress' && id === 'main') {
      collectionName = 'userProgress';
      id = parts[1];
    }
  }
  
  return {
    type: 'doc',
    collectionName,
    id
  };
}

export function query(collRef: any, ...queryConstraints: any[]): any {
  return {
    type: 'query',
    collectionName: collRef.collectionName,
    constraints: queryConstraints
  };
}

export function where(fieldPath: string, opStr: string, value: any) {
  return { type: 'where', fieldPath, opStr, value };
}

export function documentId() {
  return '__name__';
}

export function orderBy(fieldPath: string, directionStr: string = 'asc') {
  return { type: 'orderBy', fieldPath, directionStr };
}

export function limit(limitValue: number) {
  return { type: 'limit', limitValue };
}

export function increment(value: number) {
  return { type: 'increment', value };
}

export function arrayUnion(...elements: any[]) {
  return { type: 'arrayUnion', elements };
}

export function arrayRemove(...elements: any[]) {
  return { type: 'arrayRemove', elements };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

export const Timestamp = {
  now: () => ({
    toDate: () => new Date(),
    toISOString: () => new Date().toISOString()
  }),
  fromDate: (date: Date) => ({
    toDate: () => date,
    toISOString: () => date.toISOString()
  })
};

// Simple in-memory document & collection cache to eliminate redundant bandwidth
const docCache = new Map<string, { data: any; timestamp: number }>();
const queryCache = new Map<string, { docs: any[]; timestamp: number }>();
const CACHE_TTL_MS = 25000; // 25 seconds cache for static content (topics, semesters, questions)

function isUserStateCollection(collectionName: string): boolean {
  if (!collectionName) return false;
  return collectionName === 'userProgress' ||
         collectionName === 'users' ||
         collectionName.startsWith('users/') ||
         collectionName === 'quizAttempts' ||
         collectionName === 'flashcardSessions';
}

function isAdminContentCollection(collectionName: string): boolean {
  if (!collectionName) return false;
  return [
    'questions',
    'topics',
    'subjects',
    'semesters',
    'sourceDocuments',
    'source_documents',
    'examSets',
    'simulados',
    'imported_exams'
  ].includes(collectionName);
}

function invalidateCacheForDoc(collectionName: string, id: string) {
  if (id) {
    docCache.delete(`${collectionName}/${id}`);
  }
  for (const key of queryCache.keys()) {
    if (key.startsWith(`${collectionName}:`)) {
      queryCache.delete(key);
    }
  }
}

export function clearDataCache(): void {
  docCache.clear();
  queryCache.clear();
}

export async function getDoc(docRef: any): Promise<any> {
  const collectionName = docRef.collectionName;
  const id = docRef.id;
  const cacheKey = `${collectionName}/${id}`;

  const isUserMutable = isUserStateCollection(collectionName);

  const cached = docCache.get(cacheKey);
  const ttl = isUserMutable ? 4000 : CACHE_TTL_MS;
  if (cached && Date.now() - cached.timestamp < ttl) {
    return {
      id,
      exists: () => !!cached.data,
      data: () => cached.data
    };
  }

  let data: any = null;

  if (isUserMutable && (collectionName !== 'users' || (auth.currentUser && id === auth.currentUser.uid))) {
    if (!auth.currentUser) {
      return { id, exists: () => false, data: () => null };
    }
    try {
      const token = await auth.currentUser.getIdToken();
      const resp = await fetch('/api/user-documents/get-doc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ collection: collectionName, id })
      });
      if (resp.ok) {
        const body = await resp.json();
        data = body.exists ? { data: body.data } : null;
      } else {
        // Fallback for reading public fields if doc is outside current user
        let { data: supaRes } = await supabase
          .from('firestore_documents')
          .select('*')
          .eq('collection', collectionName)
          .eq('id', id)
          .maybeSingle();
        data = supaRes;
      }
    } catch (apiErr) {
      console.warn(`[UserDoc API Get Note]:`, apiErr);
      return { id, exists: () => false, data: () => null };
    }
  } else {
    let { data: supaRes, error } = await supabase
      .from('firestore_documents')
      .select('*')
      .eq('collection', collectionName)
      .eq('id', id)
      .maybeSingle();
      
    if (error) {
      console.warn(`[Supabase] Note on loading doc ${collectionName}/${id}:`, error?.message || error);
    }
    data = supaRes;
  }

  // Merging legacy progress records if userProgress is loaded
  if (collectionName === 'userProgress') {
    const { data: altProgress } = await supabase
      .from('firestore_documents')
      .select('*')
      .eq('collection', `users/${id}/progress`)
      .eq('id', 'main')
      .maybeSingle();

    const mainData = data?.data || {};
    const legacyData = altProgress?.data || {};

    const mergedAttempts = { ...(legacyData.attempts || {}), ...(mainData.attempts || {}) };
    const mergedFlashcardReviews = { ...(legacyData.flashcardReviews || {}), ...(mainData.flashcardReviews || {}) };
    const mergedAnswered = Array.from(new Set([...(legacyData.answeredQuestionIds || []), ...(mainData.answeredQuestionIds || [])]));
    const mergedCorrect = Array.from(new Set([...(legacyData.correctQuestionIds || []), ...(mainData.correctQuestionIds || [])]));
    const mergedCompleted = Array.from(new Set([...(legacyData.completedTopicIds || []), ...(mainData.completedTopicIds || [])]));
    
    const dedupeItems = (arr: any[]) => {
      const seen = new Set();
      return (arr || []).filter(item => {
        if (!item) return false;
        const key = typeof item === 'string' 
          ? item 
          : (item.id || item.sessionId || item.createdAt || item.date || item.timestamp);
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const mergedSessions = dedupeItems([...(mainData.studySessions || []), ...(legacyData.studySessions || [])]);
    const mergedQuizHistory = dedupeItems([...(mainData.quizHistory || []), ...(legacyData.quizHistory || [])]);
    const totalTime = Math.max(
      Number(mainData.totalStudyTimeSeconds) || 0,
      Number(legacyData.totalStudyTimeSeconds) || 0
    );

    data = {
      ...data,
      data: {
        ...legacyData,
        ...mainData,
        attempts: mergedAttempts,
        flashcardReviews: mergedFlashcardReviews,
        answeredQuestionIds: mergedAnswered,
        correctQuestionIds: mergedCorrect,
        completedTopicIds: mergedCompleted,
        studySessions: mergedSessions,
        quizHistory: mergedQuizHistory,
        totalStudyTimeSeconds: totalTime
      }
    };
  }
  
  const docData = data?.data || null;

  if (docData && !isUserMutable) {
    docCache.set(cacheKey, { data: docData, timestamp: Date.now() });
  }
  
  return {
    id,
    exists: () => !!data,
    data: () => docData
  };
}

export async function getDocFromServer(docRef: any): Promise<any> {
  // Force bypass cache
  docCache.delete(`${docRef.collectionName}/${docRef.id}`);
  return getDoc(docRef);
}

function serializeQueryValue(val: any, seen?: Set<any>): string {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (typeof val !== 'object') return JSON.stringify(val);
  if (val instanceof Date) return `Date(${val.toISOString()})`;
  if (typeof val.toISOString === 'function') {
    try {
      return `time(${val.toISOString()})`;
    } catch {
      // fallback
    }
  }
  if (typeof val.id === 'string' && val.collectionName) {
    return `ref(${val.collectionName}/${val.id})`;
  }
  if (!seen) seen = new Set();
  if (seen.has(val)) return '[Circular]';
  seen.add(val);
  try {
    if (Array.isArray(val)) {
      return `[${val.map(item => serializeQueryValue(item, seen)).join(',')}]`;
    }
    const keys = Object.keys(val).sort();
    return '{' + keys.map(k => `${JSON.stringify(k)}:${serializeQueryValue(val[k], seen)}`).join(',') + '}';
  } catch {
    return String(val);
  } finally {
    seen.delete(val);
  }
}

export async function getDocs(queryOrColl: any): Promise<any> {
  const collectionName = queryOrColl.collectionName;
  const constraints = queryOrColl.constraints || [];
  const isUserMutable = isUserStateCollection(collectionName) && collectionName !== 'users';
  
  // Construct a deterministic query cache key
  const safeConstraintsKey = constraints.map((c: any) => {
    if (!c || typeof c !== 'object') return String(c);
    if (c.type === 'where') {
      return `where:${c.fieldPath}:${c.opStr}:${serializeQueryValue(c.value)}`;
    }
    if (c.type === 'orderBy') {
      return `orderBy:${c.fieldPath}:${c.directionStr || 'asc'}`;
    }
    if (c.type === 'limit') {
      return `limit:${c.limitValue}`;
    }
    return `${c.type || 'unknown'}:${serializeQueryValue(c)}`;
  }).join('|');
  const queryKey = `${collectionName}:${safeConstraintsKey}`;
  if (!isUserMutable) {
    const cachedQuery = queryCache.get(queryKey);
    if (cachedQuery && Date.now() - cachedQuery.timestamp < CACHE_TTL_MS) {
      const mappedDocs = cachedQuery.docs.map(docData => ({
        id: docData.id,
        data: () => {
          const { id, ...rest } = docData;
          return rest;
        }
      }));
      return {
        docs: mappedDocs,
        size: mappedDocs.length,
        empty: mappedDocs.length === 0,
        forEach: (callback: any) => mappedDocs.forEach(callback)
      };
    }
  }

  if (isUserMutable) {
    if (!auth.currentUser) {
      return { docs: [], size: 0, empty: true, forEach: () => {} };
    }
    try {
      const token = await auth.currentUser.getIdToken();
      const resp = await fetch('/api/user-documents/get-docs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ collection: collectionName })
      });
      if (resp.ok) {
        const body = await resp.json();
        const mappedDocs = (body.docs || []).map((row: any) => ({
          id: row.id,
          data: () => row.data
        }));
        return {
          docs: mappedDocs,
          size: mappedDocs.length,
          empty: mappedDocs.length === 0,
          forEach: (callback: any) => mappedDocs.forEach(callback)
        };
      }
      return { docs: [], size: 0, empty: true, forEach: () => {} };
    } catch (apiErr) {
      console.warn(`[UserDoc API GetDocs Note]:`, apiErr);
      return { docs: [], size: 0, empty: true, forEach: () => {} };
    }
  }

  let supaQuery = supabase
    .from('firestore_documents')
    .select('id, data')
    .eq('collection', collectionName);

  let hasClientOnlyConstraint = false;
  let limitValue: number | null = null;

  for (const constraint of constraints) {
    if (constraint.type === 'where') {
      const { opStr, value } = constraint;
      if (opStr !== '==' && opStr !== '===' && opStr !== 'in') {
        hasClientOnlyConstraint = true;
      } else if (opStr === 'in' && (!Array.isArray(value) || value.length === 0)) {
        hasClientOnlyConstraint = true;
      } else if (value === undefined || value === null) {
        hasClientOnlyConstraint = true;
      }
    } else if (constraint.type === 'orderBy') {
      // Order is processed in JavaScript; remote limit before sort would corrupt result order
      hasClientOnlyConstraint = true;
    } else if (constraint.type === 'limit') {
      limitValue = constraint.limitValue;
    }
  }

  // Push server-side filters to Supabase query to minimize Egress
  for (const constraint of constraints) {
    if (constraint.type === 'where') {
      const { fieldPath, opStr, value } = constraint;
      if (fieldPath === '__name__' || fieldPath === 'id') {
        if (opStr === '==' || opStr === '===') {
          supaQuery = supaQuery.eq('id', value);
        } else if (opStr === 'in' && Array.isArray(value) && value.length > 0) {
          supaQuery = supaQuery.in('id', value);
        }
      } else if (typeof fieldPath === 'string' && value !== undefined && value !== null) {
        const jsonPath = fieldPath.includes('.')
          ? 'data->' + fieldPath.split('.').slice(0, -1).join('->') + '->>' + fieldPath.split('.').pop()
          : `data->>${fieldPath}`;

        if (opStr === '==' || opStr === '===') {
          supaQuery = supaQuery.eq(jsonPath, String(value));
        } else if (opStr === 'in' && Array.isArray(value) && value.length > 0) {
          supaQuery = supaQuery.in(jsonPath, value.map(v => String(v)));
        }
      }
    }
  }

  // Apply server-side limit safely only when no client-only constraints could exclude rows
  if (limitValue !== null && !hasClientOnlyConstraint) {
    supaQuery = supaQuery.limit(limitValue);
  }
  
  let { data: primaryData, error: primaryError } = await supaQuery;
    
  if (primaryError) {
    console.error(`[Supabase] Error loading docs for ${collectionName}:`, primaryError);
    throw primaryError;
  }

  let data = primaryData || [];
  
  let docs = (data || []).map(row => ({
    id: row.id,
    ...row.data
  }));
  
  // Apply in-memory filters as a second-pass safety net
  for (const constraint of constraints) {
    if (constraint.type === 'where') {
      const { fieldPath, opStr, value } = constraint;
      
      docs = docs.filter(doc => {
        let docVal = doc[fieldPath];
        
        if (fieldPath === '__name__') {
          docVal = doc.id;
        } else if (fieldPath.includes('.')) {
          const parts = fieldPath.split('.');
          docVal = doc;
          for (const part of parts) {
            docVal = docVal ? docVal[part] : undefined;
          }
        }
        
        if (opStr === '==' || opStr === '===') return docVal === value;
        if (opStr === '!=' || opStr === '!==') return docVal !== value;
        if (opStr === '>') return docVal > value;
        if (opStr === '>=') return docVal >= value;
        if (opStr === '<') return docVal < value;
        if (opStr === '<=') return docVal <= value;
        if (opStr === 'in') {
          return Array.isArray(value) && value.includes(docVal);
        }
        if (opStr === 'array-contains') {
          return Array.isArray(docVal) && docVal.includes(value);
        }
        return true;
      });
    } else if (constraint.type === 'orderBy') {
      const { fieldPath, directionStr } = constraint;
      docs.sort((a, b) => {
        const valA = fieldPath === '__name__' ? a.id : a[fieldPath];
        const valB = fieldPath === '__name__' ? b.id : b[fieldPath];
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;
        if (valA < valB) return directionStr === 'desc' ? 1 : -1;
        if (valA > valB) return directionStr === 'desc' ? -1 : 1;
        return 0;
      });
    } else if (constraint.type === 'limit') {
      const { limitValue } = constraint;
      docs = docs.slice(0, limitValue);
    }
  }

  // Cache results
  queryCache.set(queryKey, { docs, timestamp: Date.now() });

  // Pre-fill docCache for each loaded item to speed up subsequent getDoc calls
  for (const item of docs) {
    const { id, ...itemData } = item;
    docCache.set(`${collectionName}/${id}`, { data: itemData, timestamp: Date.now() });
  }
  
  const mappedDocs = docs.map(docData => ({
    id: docData.id,
    data: () => {
      const { id, ...rest } = docData;
      return rest;
    }
  }));

  return {
    docs: mappedDocs,
    size: mappedDocs.length,
    empty: mappedDocs.length === 0,
    forEach: (callback: any) => mappedDocs.forEach(callback)
  };
}

export async function setDoc(docRef: any, docData: any, options?: { merge?: boolean }): Promise<void> {
  const collectionName = docRef.collectionName;
  const id = docRef.id;
  const isUserMutable = isUserStateCollection(collectionName);
  const isAdminContent = isAdminContentCollection(collectionName);
  
  let mergedData = docData;

  if (isUserMutable) {
    if (!auth.currentUser) {
      throw new Error('[Security] Usuário não autenticado para gravar documento privado.');
    }
    const token = await auth.currentUser.getIdToken();
    const resp = await fetch('/api/user-documents/set-doc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ collection: collectionName, id, docData, merge: options?.merge })
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error || '[Security] Falha ao gravar documento privado.');
    }
    invalidateCacheForDoc(collectionName, id);
    docCache.set(`${collectionName}/${id}`, { data: mergedData, timestamp: Date.now() });
    return;
  }

  if (isAdminContent) {
    if (!auth.currentUser) {
      throw new Error('[Admin Security] Autenticação de administrador necessária para alterar conteúdo educacional.');
    }
    const token = await auth.currentUser.getIdToken();
    const resp = await fetch('/api/admin/content/set-doc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ collection: collectionName, id, docData, merge: options?.merge })
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error || '[Admin Security] Falha ao gravar conteúdo administrativo.');
    }
    invalidateCacheForDoc(collectionName, id);
    docCache.set(`${collectionName}/${id}`, { data: mergedData, timestamp: Date.now() });
    return;
  }

  if (options?.merge) {
    const { data: existing, error: loadError } = await supabase
      .from('firestore_documents')
      .select('*')
      .eq('collection', collectionName)
      .eq('id', id)
      .maybeSingle();
      
    if (loadError) {
      console.warn(`[Supabase] Note on loading existing doc for setDoc with merge ${collectionName}/${id}:`, loadError?.message || loadError);
    }
    
    if (existing?.data) {
      mergedData = { ...existing.data, ...docData };
      if (existing.data.flashcardReviews && docData.flashcardReviews) {
        mergedData.flashcardReviews = { ...existing.data.flashcardReviews, ...docData.flashcardReviews };
      }
      if (existing.data.attempts && docData.attempts) {
        mergedData.attempts = { ...existing.data.attempts, ...docData.attempts };
      }
      if (existing.data.stats && docData.stats) {
        mergedData.stats = { ...existing.data.stats, ...docData.stats };
      }
    } else {
      mergedData = docData;
    }
  }
  
  const { error } = await supabase
    .from('firestore_documents')
    .upsert({
      collection: collectionName,
      id,
      data: mergedData,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'collection,id'
    });
    
  if (error) {
    console.warn(`[Supabase] Note on setDoc for ${collectionName}/${id}:`, error?.message || error);
  } else {
    invalidateCacheForDoc(collectionName, id);
    docCache.set(`${collectionName}/${id}`, { data: mergedData, timestamp: Date.now() });
  }
}

export async function addDoc(collRef: any, docData: any): Promise<any> {
  const collectionName = collRef.collectionName;
  const isUserMutable = isUserStateCollection(collectionName);
  const isAdminContent = isAdminContentCollection(collectionName);

  if (isUserMutable) {
    if (!auth.currentUser) {
      throw new Error('[Security] Usuário não autenticado para criar documento privado.');
    }
    const token = await auth.currentUser.getIdToken();
    const resp = await fetch('/api/user-documents/add-doc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ collection: collectionName, docData })
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error || '[Security] Falha ao adicionar documento.');
    }
    const body = await resp.json();
    invalidateCacheForDoc(collectionName, body.id);
    return { id: body.id };
  }

  if (isAdminContent) {
    if (!auth.currentUser) {
      throw new Error('[Admin Security] Autenticação de administrador necessária para criar conteúdo educacional.');
    }
    const token = await auth.currentUser.getIdToken();
    const resp = await fetch('/api/admin/content/add-doc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ collection: collectionName, docData })
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error || '[Admin Security] Falha ao criar conteúdo administrativo.');
    }
    const body = await resp.json();
    invalidateCacheForDoc(collectionName, body.id);
    return { id: body.id };
  }

  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const { error } = await supabase
    .from('firestore_documents')
    .insert({
      collection: collectionName,
      id,
      data: docData,
      updated_at: new Date().toISOString()
    });
    
  if (error) {
    console.warn(`[Supabase] Note on addDoc for ${collectionName}:`, error?.message || error);
  } else {
    invalidateCacheForDoc(collectionName, id);
  }
  
  return { id };
}

export async function updateDoc(docRef: any, updateFields: any): Promise<void> {
  const collectionName = docRef.collectionName;
  const id = docRef.id;
  const isUserMutable = isUserStateCollection(collectionName);
  const isAdminContent = isAdminContentCollection(collectionName);

  if (isUserMutable) {
    if (!auth.currentUser) {
      throw new Error('[Security] Usuário não autenticado para atualizar documento privado.');
    }
    const token = await auth.currentUser.getIdToken();
    const resp = await fetch('/api/user-documents/update-doc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ collection: collectionName, id, updateFields })
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error || '[Security] Falha ao atualizar documento privado.');
    }
    invalidateCacheForDoc(collectionName, id);
    return;
  }

  if (isAdminContent) {
    if (!auth.currentUser) {
      throw new Error('[Admin Security] Autenticação de administrador necessária para atualizar conteúdo educacional.');
    }
    const token = await auth.currentUser.getIdToken();
    const resp = await fetch('/api/admin/content/update-doc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ collection: collectionName, id, updateFields })
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error || '[Admin Security] Falha ao atualizar conteúdo administrativo.');
    }
    invalidateCacheForDoc(collectionName, id);
    return;
  }
  
  let { data: existing, error: loadError } = await supabase
    .from('firestore_documents')
    .select('*')
    .eq('collection', collectionName)
    .eq('id', id)
    .maybeSingle();
    
  if (loadError) {
    console.warn(`[Supabase] Note on loading existing doc for update ${collectionName}/${id}:`, loadError?.message || loadError);
  }
  
  const mergedData = existing?.data ? { ...existing.data } : {};

  const getNestedValue = (obj: any, path: string): any => {
    if (!obj || typeof obj !== 'object' || obj === null) return undefined;
    if (!path.includes('.')) return obj[path];
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current && typeof current === 'object' && current !== null && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    return current;
  };
  
  const resolveValue = (key: string, val: any) => {
    if (val && typeof val === 'object' && (val as any).type) {
      const type = (val as any).type;
      const existingVal = getNestedValue(mergedData, key);
      if (type === 'increment') {
        const incVal = (val as any).value || 0;
        const baseNum = typeof existingVal === 'number' ? existingVal : 0;
        return baseNum + incVal;
      } else if (type === 'arrayUnion') {
        const elems = (val as any).elements || [];
        const existingArr = Array.isArray(existingVal) ? existingVal : [];
        const newSet = new Set([...existingArr, ...elems]);
        return Array.from(newSet);
      } else if (type === 'arrayRemove') {
        const elems = (val as any).elements || [];
        const existingArr = Array.isArray(existingVal) ? existingVal : [];
        return existingArr.filter((item: any) => !elems.includes(item));
      }
    }
    return val;
  };
  
  for (const [key, val] of Object.entries(updateFields)) {
    const resolvedVal = resolveValue(key, val);
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
      current[parts[parts.length - 1]] = resolvedVal;
    } else {
      mergedData[key] = resolvedVal;
    }
  }
  
  const { error } = await supabase
    .from('firestore_documents')
    .upsert({
      collection: collectionName,
      id,
      data: mergedData,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'collection,id'
    });
    
  if (error) {
    console.warn(`[Supabase] Note on updateDoc for ${collectionName}/${id}:`, error?.message || error);
  } else {
    invalidateCacheForDoc(collectionName, id);
    docCache.set(`${collectionName}/${id}`, { data: mergedData, timestamp: Date.now() });
  }
}

export async function deleteDoc(docRef: any): Promise<void> {
  const collectionName = docRef.collectionName;
  const id = docRef.id;
  const isUserMutable = isUserStateCollection(collectionName);
  const isAdminContent = isAdminContentCollection(collectionName);

  if (isUserMutable) {
    if (!auth.currentUser) {
      throw new Error('[Security] Usuário não autenticado para excluir documento privado.');
    }
    const token = await auth.currentUser.getIdToken();
    const resp = await fetch('/api/user-documents/delete-doc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ collection: collectionName, id })
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error || '[Security] Falha ao excluir documento.');
    }
    invalidateCacheForDoc(collectionName, id);
    return;
  }

  if (isAdminContent) {
    if (!auth.currentUser) {
      throw new Error('[Admin Security] Autenticação de administrador necessária para excluir conteúdo educacional.');
    }
    const token = await auth.currentUser.getIdToken();
    const resp = await fetch('/api/admin/content/delete-doc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ collection: collectionName, id })
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error || '[Admin Security] Falha ao excluir conteúdo administrativo.');
    }
    invalidateCacheForDoc(collectionName, id);
    return;
  }

  const { error } = await supabase
    .from('firestore_documents')
    .delete()
    .eq('collection', collectionName)
    .eq('id', id);
    
  if (error) {
    console.error(`Error deleteDoc for ${collectionName}/${id} on Supabase:`, error);
    throw error;
  } else {
    invalidateCacheForDoc(collectionName, id);
  }
}

export async function getCountFromServer(collRef: any): Promise<any> {
  const collectionName = collRef.collectionName;
  
  const { count, error } = await supabase
    .from('firestore_documents')
    .select('*', { count: 'exact', head: true })
    .eq('collection', collectionName);
    
  if (error) {
    console.error(`Error getCountFromServer for ${collectionName}:`, error);
  }
  
  return {
    data: () => ({
      count: count || 0
    })
  };
}

export function onSnapshot(docRefOrQuery: any, callback: (snapshot: any) => void, onError?: (err: any) => void): () => void {
  let isUnsubscribed = false;
  let debounceTimer: any = null;
  
  const triggerFetch = async () => {
    if (isUnsubscribed) return;
    try {
      if (docRefOrQuery.type === 'doc') {
        const snap = await getDocFromServer(docRefOrQuery);
        if (!isUnsubscribed) callback(snap);
      } else {
        const snap = await getDocs(docRefOrQuery);
        if (!isUnsubscribed) callback(snap);
      }
    } catch (err) {
      if (onError && !isUnsubscribed) onError(err);
    }
  };
  
  triggerFetch();
  
  const uniqueId = Math.random().toString(36).substring(2, 11);
  const isDoc = docRefOrQuery.type === 'doc' && docRefOrQuery.id;
  const filter = isDoc 
    ? `collection=eq.${docRefOrQuery.collectionName}&id=eq.${docRefOrQuery.id}` 
    : `collection=eq.${docRefOrQuery.collectionName}`;

  const channel = supabase
    .channel(`pub-firestore-${docRefOrQuery.collectionName}-${uniqueId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'firestore_documents',
      filter: filter
    }, (payload: any) => {
      if (isDoc && payload?.new?.id) {
        invalidateCacheForDoc(docRefOrQuery.collectionName, payload.new.id);
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        triggerFetch();
      }, 150);
    })
    .subscribe();
    
  return () => {
    isUnsubscribed = true;
    clearTimeout(debounceTimer);
    channel.unsubscribe();
  };
}


export async function runTransaction(dbInstance: any, updateFunction: (transaction: any) => Promise<any>): Promise<any> {
  const readOperations: Map<string, any> = new Map();
  const writeOperations: Array<() => Promise<void>> = [];

  const transaction = {
    get: async (docRef: any) => {
      const snap = await getDoc(docRef);
      readOperations.set(`${docRef.collectionName}/${docRef.id}`, snap);
      return snap;
    },
    set: (docRef: any, data: any, options?: any) => {
      writeOperations.push(() => setDoc(docRef, data, options));
    },
    update: (docRef: any, data: any) => {
      writeOperations.push(() => updateDoc(docRef, data));
    },
    delete: (docRef: any) => {
      writeOperations.push(() => deleteDoc(docRef));
    }
  };

  const result = await updateFunction(transaction);

  for (const op of writeOperations) {
    await op();
  }

  return result;
}

export function writeBatch(dbInstance: any): any {
  const operations: Array<() => Promise<void>> = [];
  return {
    set: (docRef: any, data: any, options?: any) => {
      operations.push(() => setDoc(docRef, data, options));
    },
    update: (docRef: any, data: any) => {
      operations.push(() => updateDoc(docRef, data));
    },
    delete: (docRef: any) => {
      operations.push(() => deleteDoc(docRef));
    },
    commit: async () => {
      for (const op of operations) {
        await op();
      }
    }
  };
}

function getFirestoreInstance(firebaseApp: FirebaseApp, databaseId?: string) {
  if (!databaseId || databaseId === '(default)') {
    if (appEnv === 'production') {
      throw new Error('[Security Error] Default Firestore database "(default)" is not authorized for production environment.');
    }
    return getFirestore(firebaseApp);
  }
  return getFirestore(firebaseApp, databaseId);
}

const realDb = getFirestoreInstance(app, activeFirebaseConfig.firestoreDatabaseId);

async function migrateUserProfile(sourceUid: string, targetUid: string) {
  try {
    const realDocRef = realDoc(realDb, 'users', sourceUid);
    const snap = await realGetDoc(realDocRef);
    if (snap.exists()) {
      const docData = snap.data();
      console.log(`[Migration] Found user profile in Firestore for source UID ${sourceUid}. Merging to target ${targetUid}...`);
      
      const { data: existingSupa } = await supabase
        .from('firestore_documents')
        .select('*')
        .eq('collection', 'users')
        .eq('id', targetUid)
        .maybeSingle();

      const supaData = existingSupa?.data || {};
      const mergedData = { ...supaData, ...docData, migrated_from_firestore: true };

      const { error } = await supabase
        .from('firestore_documents')
        .upsert({
          collection: 'users',
          id: targetUid,
          data: mergedData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'collection,id'
        });
        
      if (error) {
        console.warn(`[Migration] Note saving user profile ${targetUid} to Supabase:`, error?.message || error);
      } else {
        console.log(`[Migration] User profile ${targetUid} successfully migrated.`);
      }
    }
  } catch (err: any) {
    console.warn(`[Migration] User profile sync skipped (${err?.message || 'Offline/Network unavailable'})`);
  }
}

async function migrateSubcollection(sourceUid: string, targetUid: string, subcolName: string) {
  try {
    const realColRef = realCollection(realDb, 'users', sourceUid, subcolName);
    const snap = await realGetDocs(realColRef);
    if (!snap.empty) {
      console.log(`[Migration] Found ${snap.size} documents in users/${sourceUid}/${subcolName} on Firestore. Migrating to users/${targetUid}/${subcolName}...`);
      for (const docSnap of snap.docs) {
        const docId = docSnap.id;
        const docData = docSnap.data();
        const collectionPathInSupabase = `users/${targetUid}/${subcolName}`;
        
        const { error } = await supabase
          .from('firestore_documents')
          .upsert({
            collection: collectionPathInSupabase,
            id: docId,
            data: docData,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'collection,id'
          });
          
        if (error) {
          console.warn(`[Migration] Note saving doc ${collectionPathInSupabase}/${docId} to Supabase:`, error?.message || error);
        }
      }
      console.log(`[Migration] Successfully migrated subcollection users/${sourceUid}/${subcolName} to target ${targetUid}`);
    }
  } catch (err: any) {
    console.warn(`[Migration] Subcollection ${subcolName} sync skipped (${err?.message || 'Offline/Network unavailable'})`);
  }
}

async function migrateUserProgress(sourceUid: string, targetUid: string) {
  try {
    // Check both userProgress/${sourceUid} and users/${sourceUid}/progress/main
    let fsData: any = {};
    const realDocRef = realDoc(realDb, 'userProgress', sourceUid);
    const snap = await realGetDoc(realDocRef);
    if (snap.exists()) {
      fsData = { ...fsData, ...(snap.data() || {}) };
    }

    try {
      const altDocRef = realDoc(realDb, 'users', sourceUid, 'progress', 'main');
      const altSnap = await realGetDoc(altDocRef);
      if (altSnap.exists()) {
        fsData = { ...fsData, ...(altSnap.data() || {}) };
      }
    } catch (e) {
      // Ignore subcollection progress fallback error
    }

    if (Object.keys(fsData).length > 0) {
      console.log(`[Migration] Found userProgress in Firestore for ${sourceUid}. Merging to Supabase for target ${targetUid}...`);
      
      const { data: supaDoc } = await supabase
        .from('firestore_documents')
        .select('*')
        .eq('collection', 'userProgress')
        .eq('id', targetUid)
        .maybeSingle();

      const supaData = supaDoc?.data || {};

      const mergedAttempts = { ...(supaData.attempts || {}), ...(fsData.attempts || {}) };
      const mergedCompletedTopics = Array.from(new Set([
        ...(supaData.completedTopicIds || []),
        ...(fsData.completedTopicIds || [])
      ]));
      const mergedAnsweredIds = Array.from(new Set([
        ...(supaData.answeredQuestionIds || []),
        ...(fsData.answeredQuestionIds || [])
      ]));
      const mergedCorrectIds = Array.from(new Set([
        ...(supaData.correctQuestionIds || []),
        ...(fsData.correctQuestionIds || [])
      ]));
      const mergedFlaggedIds = Array.from(new Set([
        ...(supaData.flaggedQuestionIds || []),
        ...(fsData.flaggedQuestionIds || [])
      ]));

      const supaTime = Number(supaData.totalStudyTimeSeconds) || 0;
      const fsTime = Number(fsData.totalStudyTimeSeconds) || 0;

      const supaSessions = supaData.studySessions || [];
      const fsSessions = fsData.studySessions || [];
      const sessionMap = new Map();
      [...supaSessions, ...fsSessions].forEach((s: any) => {
        const key = s.id || `${s.date}_${s.topicId || s.subjectId}`;
        sessionMap.set(key, s);
      });
      const mergedSessions = Array.from(sessionMap.values());

      const mergedDoc = {
        ...supaData,
        ...fsData,
        attempts: mergedAttempts,
        completedTopicIds: mergedCompletedTopics,
        answeredQuestionIds: mergedAnsweredIds,
        correctQuestionIds: mergedCorrectIds,
        flaggedQuestionIds: mergedFlaggedIds,
        totalStudyTimeSeconds: Math.max(supaTime, fsTime, supaTime + fsTime > 0 ? Math.max(supaTime, fsTime) : 0),
        studySessions: mergedSessions,
        topicAnnotations: {
          ...(supaData.topicAnnotations || {}),
          ...(fsData.topicAnnotations || {})
        }
      };

      // Save to userProgress/${targetUid}
      await supabase
        .from('firestore_documents')
        .upsert({
          collection: 'userProgress',
          id: targetUid,
          data: mergedDoc,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'collection,id'
        });

      // Save to users/${targetUid}/progress/main
      await supabase
        .from('firestore_documents')
        .upsert({
          collection: `users/${targetUid}/progress`,
          id: 'main',
          data: mergedDoc,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'collection,id'
        });

      console.log(`[Migration] userProgress for target ${targetUid} successfully merged into both paths.`);
    }
  } catch (err: any) {
    console.warn(`[Migration] userProgress sync skipped (${err?.message || 'Offline/Network unavailable'})`);
  }
}

async function migrateCalendarEvents(sourceUid: string, targetUid: string) {
  try {
    const realColRef = realCollection(realDb, 'calendarEvents');
    const q = realQuery(realColRef, realWhere('userId', '==', sourceUid));
    const snap = await realGetDocs(q);
    if (!snap.empty) {
      console.log(`[Migration] Found ${snap.size} top-level calendarEvents in Firestore for ${sourceUid}. Migrating...`);
      for (const docSnap of snap.docs) {
        const docId = docSnap.id;
        const docData = docSnap.data();
        
        await supabase
          .from('firestore_documents')
          .upsert({
            collection: 'calendarEvents',
            id: docId,
            data: { ...docData, userId: targetUid },
            updated_at: new Date().toISOString()
          }, { onConflict: 'collection,id' });

        await supabase
          .from('firestore_documents')
          .upsert({
            collection: `users/${targetUid}/calendarEvents`,
            id: docId,
            data: docData,
            updated_at: new Date().toISOString()
          }, { onConflict: 'collection,id' });
      }
    }
  } catch (err) {
    console.warn(`[Migration] Top-level calendarEvents query skipped or unpermitted:`, err);
  }

  try {
    const userColRef = realCollection(realDb, 'users', sourceUid, 'calendarEvents');
    const userSnap = await realGetDocs(userColRef);
    if (!userSnap.empty) {
      console.log(`[Migration] Found ${userSnap.size} subcollection calendarEvents in Firestore for ${sourceUid}. Migrating...`);
      for (const docSnap of userSnap.docs) {
        const docId = docSnap.id;
        const docData = docSnap.data();

        await supabase
          .from('firestore_documents')
          .upsert({
            collection: `users/${targetUid}/calendarEvents`,
            id: docId,
            data: docData,
            updated_at: new Date().toISOString()
          }, { onConflict: 'collection,id' });

        await supabase
          .from('firestore_documents')
          .upsert({
            collection: 'calendarEvents',
            id: docId,
            data: { ...docData, userId: targetUid },
            updated_at: new Date().toISOString()
          }, { onConflict: 'collection,id' });
      }
    }
  } catch (err) {
    console.warn(`[Migration] Subcollection users/${sourceUid}/calendarEvents query error:`, err);
  }
}

async function migrateStudySessions(sourceUid: string, targetUid: string) {
  try {
    const realColRef = realCollection(realDb, 'studySessions');
    const q = realQuery(realColRef, realWhere('userId', '==', sourceUid));
    const snap = await realGetDocs(q);
    if (!snap.empty) {
      console.log(`[Migration] Found ${snap.size} top-level studySessions in Firestore for ${sourceUid}. Migrating...`);
      for (const docSnap of snap.docs) {
        const docId = docSnap.id;
        const docData = docSnap.data();
        await supabase.from('firestore_documents').upsert({
          collection: 'studySessions',
          id: docId,
          data: { ...docData, userId: targetUid },
          updated_at: new Date().toISOString()
        }, { onConflict: 'collection,id' });
        await supabase.from('firestore_documents').upsert({
          collection: `users/${targetUid}/studySessions`,
          id: docId,
          data: docData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'collection,id' });
      }
    }
  } catch (err) {
    console.warn(`[Migration] Top-level studySessions query skipped or unpermitted:`, err);
  }

  try {
    const userColRef = realCollection(realDb, 'users', sourceUid, 'studySessions');
    const userSnap = await realGetDocs(userColRef);
    if (!userSnap.empty) {
      console.log(`[Migration] Found ${userSnap.size} subcollection studySessions in Firestore for ${sourceUid}. Migrating...`);
      for (const docSnap of userSnap.docs) {
        const docId = docSnap.id;
        const docData = docSnap.data();
        await supabase.from('firestore_documents').upsert({
          collection: `users/${targetUid}/studySessions`,
          id: docId,
          data: docData,
          updated_at: new Date().toISOString()
        }, { onConflict: 'collection,id' });
        await supabase.from('firestore_documents').upsert({
          collection: 'studySessions',
          id: docId,
          data: { ...docData, userId: targetUid },
          updated_at: new Date().toISOString()
        }, { onConflict: 'collection,id' });
      }
    }
  } catch (err) {
    console.warn(`[Migration] Subcollection users/${sourceUid}/studySessions query error:`, err);
  }
}

async function migrateQuizAttempts(sourceUid: string, targetUid: string) {
  try {
    const realColRef = realCollection(realDb, 'quizAttempts');
    const q = realQuery(realColRef, realWhere('userId', '==', sourceUid));
    const snap = await realGetDocs(q);
    if (!snap.empty) {
      console.log(`[Migration] Found ${snap.size} quizAttempts in Firestore for ${sourceUid}. Migrating...`);
      for (const docSnap of snap.docs) {
        const docId = docSnap.id;
        const docData = docSnap.data();
        
        await supabase
          .from('firestore_documents')
          .upsert({
            collection: 'quizAttempts',
            id: docId,
            data: { ...docData, userId: targetUid },
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'collection,id'
          });
      }
      console.log(`[Migration] Successfully migrated quizAttempts for user ${sourceUid} to target ${targetUid}`);
    }
  } catch (err: any) {
    console.warn(`[Migration] QuizAttempts sync skipped (${err?.message || 'Offline/Network unavailable'})`);
  }
}

async function migrateGlobalCollections() {
  const globalCols = ['semesters', 'subjects', 'topics', 'questions', 'flashcards'];
  for (const colName of globalCols) {
    try {
      const realColRef = realCollection(realDb, colName);
      const snap = await realGetDocs(realColRef);
      if (!snap.empty) {
        console.log(`[Migration] Syncing ${snap.size} documents from Firestore collection '${colName}' to Supabase...`);
        for (const docSnap of snap.docs) {
          await supabase
            .from('firestore_documents')
            .upsert({
              collection: colName,
              id: docSnap.id,
              data: docSnap.data(),
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'collection,id'
            });
        }
      }
    } catch (e) {
      console.error(`[Migration] Error syncing global collection ${colName}:`, e);
    }
  }
}

export async function checkAndMigrateUser(userId: string, force: boolean = false) {
  try {
    let userDoc: any = null;
    let userError: any = null;
    try {
      const res = await supabase
        .from('firestore_documents')
        .select('*')
        .eq('collection', 'users')
        .eq('id', userId)
        .maybeSingle();
      userDoc = res.data;
      userError = res.error;
    } catch (fetchErr: any) {
      console.warn(`[Migration] Supabase endpoint connection skipped. Operating with local/Firestore data.`);
      return;
    }
      
    if (userError) {
      console.warn(`[Migration] Supabase flag check skipped:`, userError?.message || userError);
      return;
    }

    let targetUserEmail = (userDoc?.data?.email || '').toLowerCase().trim();
    if (!targetUserEmail && auth.currentUser?.uid === userId && auth.currentUser?.email) {
      targetUserEmail = auth.currentUser.email.toLowerCase().trim();
    }

    const isMigrated = userDoc?.data?.migrated_from_firestore === true;
    if (isMigrated && !force) {
      return;
    }

    const targetUids = new Set<string>([userId]);

    for (const sourceUid of Array.from(targetUids)) {
      await migrateUserProfile(sourceUid, userId);
      await migrateUserProgress(sourceUid, userId);
      await migrateCalendarEvents(sourceUid, userId);
      await migrateStudySessions(sourceUid, userId);

      const subcollections = [
        'subjects',
        'topics',
        'semesters',
        'schedules',
        'subjectLinks',
        'studySessions',
        'calendarEvents',
        'mockExams',
        'collegeSchedule',
        'userTopics',
        'userFlashcards',
        'userQuestions',
        'userNotes',
        'userHighlightings',
        'userSettings',
        'flashcards',
        'questions',
        'quizAttempts',
        'progress'
      ];
      
      for (const subcol of subcollections) {
        await migrateSubcollection(sourceUid, userId, subcol);
      }

      await migrateQuizAttempts(sourceUid, userId);
    }

    // Save migration flag on user doc in Supabase
    const existingData = userDoc?.data || {};
    const updatedData = { ...existingData, migrated_from_firestore: true };
    
    try {
      await supabase
        .from('firestore_documents')
        .upsert({
          collection: 'users',
          id: userId,
          data: updatedData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'collection,id'
        });
    } catch (e) {
      // Ignore upsert error when offline
    }
  } catch (err: any) {
    console.warn(`[Migration] Auto-migration check paused:`, err?.message || err);
  }
}

export async function syncSurplusFirestoreToSupabase(userId?: string) {
  console.log(`[Migration] Explicit syncSurplusFirestoreToSupabase triggered...`);
  if (userId) {
    await checkAndMigrateUser(userId, true);
  } else {
    await migrateGlobalCollections();
  }
}

export function onAuthStateChanged(authInstance: any, callback: (user: User | null) => void, ...args: any[]): () => void {
  const customCallback = (firebaseUser: User | null) => {
    if (!firebaseUser) {
      clearDataCache();
    }
    // Notify application immediately so UI loads instantly
    callback(firebaseUser);

    if (firebaseUser) {
      // Run migration check in background without blocking system startup
      setTimeout(() => {
        checkAndMigrateUser(firebaseUser.uid).catch(err => {
          console.error("Background migration check error:", err);
        });
      }, 0);
    }
  };
  return realOnAuthStateChanged(authInstance, customCallback, ...args);
}

export async function signOut(authInstance: any): Promise<void> {
  clearDataCache();
  return realSignOut(authInstance);
}

export {
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
};

export type { User };
