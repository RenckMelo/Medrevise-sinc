import { db, collection, addDoc, doc, updateDoc, deleteDoc } from '../firebase';
import { auth } from '../firebase';

export interface SystemErrorLog {
  id?: string;
  userId?: string;
  userEmail?: string;
  action: string;
  errorMessage: string;
  errorStack?: string;
  module?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  createdAt?: string;
  status?: 'new' | 'investigating' | 'resolved' | 'ignored';
  userAgent?: string;
  url?: string;
}

/**
 * Global Error Logger to store app & AI errors in Firestore for Admin diagnosis.
 */
export async function logSystemError(params: {
  action: string;
  error: any;
  module?: string;
  metadata?: Record<string, any>;
}) {
  try {
    const currentUser = auth.currentUser;
    const errorMsg = params.error instanceof Error ? params.error.message : String(params.error || 'Erro desconhecido');
    const errorStack = params.error instanceof Error ? params.error.stack : undefined;

    const errorPayload: SystemErrorLog = {
      userId: currentUser?.uid || 'guest',
      userEmail: currentUser?.email || 'Anônimo',
      action: params.action,
      errorMessage: errorMsg,
      errorStack: errorStack ? errorStack.slice(0, 1500) : undefined,
      module: params.module || 'Geral',
      metadata: params.metadata || {},
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      status: 'new',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Desconhecido',
      url: typeof window !== 'undefined' ? window.location.href : ''
    };

    if (params.metadata?.testMode) {
      console.info(`[SystemErrorLogger Test] Action: "${params.action}" | Module: "${params.module}"`, errorMsg, params.metadata);
    } else {
      console.error(`[SystemErrorLogger] Action: "${params.action}" | Module: "${params.module}"`, errorMsg, params.metadata);
    }
    await addDoc(collection(db, 'systemErrors'), errorPayload);
  } catch (err) {
    console.warn('[SystemErrorLogger] Falha ao gravar log de erro no Firestore:', err);
  }
}

export async function updateSystemErrorStatus(logId: string, status: 'new' | 'investigating' | 'resolved' | 'ignored') {
  try {
    const docRef = doc(db, 'systemErrors', logId);
    await updateDoc(docRef, {
      status,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error updating log status:', err);
    throw err;
  }
}

export async function deleteSystemErrorLog(logId: string) {
  try {
    const docRef = doc(db, 'systemErrors', logId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Error deleting log:', err);
    throw err;
  }
}
