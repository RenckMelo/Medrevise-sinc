import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
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
import firebaseConfig from '../firebase-applet-config.json';
import { createClient } from '@supabase/supabase-js';

// Initialize standard client-side Firebase for Authentication and Firestore migration
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Supabase client
const metaEnv = (import.meta as any).env || {};
export const supabaseUrl = metaEnv.VITE_SUPABASE_URL || 'https://jhttjndhjzpfphqxjiao.supabase.co';
export const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || 'sb_publishable_8LJFpXcEqbr4qkbPaC-jmw_wjmwuaN9';
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

export async function getDoc(docRef: any): Promise<any> {
  const collectionName = docRef.collectionName;
  const id = docRef.id;
  
  let { data, error } = await supabase
    .from('firestore_documents')
    .select('*')
    .eq('collection', collectionName)
    .eq('id', id)
    .maybeSingle();
    
  if (error) {
    console.warn(`[Supabase] Note on loading doc ${collectionName}/${id}:`, error?.message || error);
  }

  // Fallback 1: users/${userId}/progress/main -> userProgress/${userId}
  if (!data?.data && collectionName.startsWith('users/') && collectionName.split('/').length === 3) {
    const parts = collectionName.split('/');
    const subCol = parts[2];
    if (subCol === 'progress' && id === 'main') {
      const { data: mainProgress } = await supabase
        .from('firestore_documents')
        .select('*')
        .eq('collection', 'userProgress')
        .eq('id', parts[1])
        .maybeSingle();
      if (mainProgress?.data) data = mainProgress;
    }
  }

  // Fallback 2: userProgress/${userId} -> users/${userId}/progress/main
  if (!data?.data && collectionName === 'userProgress') {
    const { data: altProgress } = await supabase
      .from('firestore_documents')
      .select('*')
      .eq('collection', `users/${id}/progress`)
      .eq('id', 'main')
      .maybeSingle();
    if (altProgress?.data) data = altProgress;
  }
  
  const docData = data?.data || null;
  
  return {
    id,
    exists: () => !!data,
    data: () => docData
  };
}

export async function getDocFromServer(docRef: any): Promise<any> {
  return getDoc(docRef);
}

export async function getDocs(queryOrColl: any): Promise<any> {
  const collectionName = queryOrColl.collectionName;
  const constraints = queryOrColl.constraints || [];
  
  const { data: primaryData, error: primaryError } = await supabase
    .from('firestore_documents')
    .select('*')
    .eq('collection', collectionName);
    
  if (primaryError) {
    console.warn(`[Supabase] Note on loading docs for ${collectionName}:`, primaryError?.message || primaryError);
  }

  let data = primaryData || [];
  
  let docs = (data || []).map(row => ({
    id: row.id,
    ...row.data
  }));
  
  // Apply in-memory filters
  for (const constraint of constraints) {
    if (constraint.type === 'where') {
      const { fieldPath, opStr, value } = constraint;
      
      docs = docs.filter(doc => {
        let docVal = doc[fieldPath];
        
        if (fieldPath.includes('.')) {
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
        const valA = a[fieldPath];
        const valB = b[fieldPath];
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
  
  let mergedData = docData;
  
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
    
    mergedData = existing?.data ? { ...existing.data, ...docData } : docData;
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
  }
}

export async function addDoc(collRef: any, docData: any): Promise<any> {
  const collectionName = collRef.collectionName;
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
  }
  
  return { id };
}

export async function updateDoc(docRef: any, updateFields: any): Promise<void> {
  const collectionName = docRef.collectionName;
  const id = docRef.id;
  
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
  
  const resolveValue = (key: string, val: any) => {
    if (val && typeof val === 'object' && (val as any).type) {
      const type = (val as any).type;
      if (type === 'increment') {
        const incVal = (val as any).value || 0;
        const existingVal = mergedData[key] || 0;
        return existingVal + incVal;
      } else if (type === 'arrayUnion') {
        const elems = (val as any).elements || [];
        const existingArr = Array.isArray(mergedData[key]) ? mergedData[key] : [];
        const newSet = new Set([...existingArr, ...elems]);
        return Array.from(newSet);
      } else if (type === 'arrayRemove') {
        const elems = (val as any).elements || [];
        const existingArr = Array.isArray(mergedData[key]) ? mergedData[key] : [];
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
  }
}

export async function deleteDoc(docRef: any): Promise<void> {
  const collectionName = docRef.collectionName;
  const id = docRef.id;
  
  const { error } = await supabase
    .from('firestore_documents')
    .delete()
    .eq('collection', collectionName)
    .eq('id', id);
    
  if (error) {
    console.error(`Error deleteDoc for ${collectionName}/${id} on Supabase:`, error);
    throw error;
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
  
  const triggerFetch = async () => {
    if (isUnsubscribed) return;
    try {
      if (docRefOrQuery.type === 'doc') {
        const snap = await getDoc(docRefOrQuery);
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
  const channel = supabase
    .channel(`pub-firestore-${docRefOrQuery.collectionName}-${uniqueId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'firestore_documents',
      filter: `collection=eq.${docRefOrQuery.collectionName}`
    }, () => {
      triggerFetch();
    })
    .subscribe();
    
  return () => {
    isUnsubscribed = true;
    channel.unsubscribe();
  };
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

const realDb = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

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
        console.error(`[Migration] Error saving user profile ${targetUid} to Supabase:`, error);
      } else {
        console.log(`[Migration] User profile ${targetUid} successfully migrated.`);
      }
    }
  } catch (err) {
    console.error(`[Migration] Error reading user profile ${sourceUid} from Firestore:`, err);
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
  } catch (err) {
    console.error(`[Migration] Error migrating subcollection ${subcolName} for user ${sourceUid}:`, err);
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
  } catch (err) {
    console.error(`[Migration] Error reading userProgress for ${sourceUid} from Firestore:`, err);
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
  } catch (err) {
    console.error(`[Migration] Error migrating quizAttempts for user ${sourceUid}:`, err);
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
    const { data: userDoc, error: userError } = await supabase
      .from('firestore_documents')
      .select('*')
      .eq('collection', 'users')
      .eq('id', userId)
      .maybeSingle();
      
    if (userError) {
      console.error(`[Migration] Error checking migration flag in Supabase:`, userError);
    }

    let targetUserEmail = (userDoc?.data?.email || '').toLowerCase().trim();
    if (!targetUserEmail && auth.currentUser?.uid === userId && auth.currentUser?.email) {
      targetUserEmail = auth.currentUser.email.toLowerCase().trim();
    }

    console.log(`[Migration] Starting checkAndMigrateUser for target user: ${userId} (email: ${targetUserEmail}, force=${force})`);

    const isMigrated = userDoc?.data?.migrated_from_firestore === true;
    if (isMigrated && !force) {
      console.log(`[Migration] User ${userId} is already marked as migrated in Supabase. Skipping automatic migration.`);
      return;
    }

    // Collect only the exact authenticated user's UID to prevent cross-account data leaks
    const targetUids = new Set<string>([userId]);

    console.log(`[Migration] Commencing secure data sync to Supabase for target user ${userId} (${targetUserEmail}).`);

    for (const sourceUid of Array.from(targetUids)) {
      // 1. Profile
      await migrateUserProfile(sourceUid, userId);
      
      // 2. User Progress
      await migrateUserProgress(sourceUid, userId);

      // 3. Calendar Events & Study Sessions
      await migrateCalendarEvents(sourceUid, userId);
      await migrateStudySessions(sourceUid, userId);

      // 4. Subcollections
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

      // 5. Quiz attempts
      await migrateQuizAttempts(sourceUid, userId);
    }

    // Save migration flag on user doc in Supabase
    const existingData = userDoc?.data || {};
    const updatedData = { ...existingData, migrated_from_firestore: true };
    
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
      
    console.log(`[Migration] All Firestore data checked and safely synced/migrated to Supabase for user ${userId}.`);
  } catch (err) {
    console.error(`[Migration] Error during checkAndMigrateUser for user ${userId}:`, err);
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

export {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
};

export type { User };
