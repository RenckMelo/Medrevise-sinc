import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, collection, query, onSnapshot, orderBy, doc, updateDoc } from '../firebase';
import { Subject, Topic, StudySession, CalendarEvent, MockExam, CollegeClass } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

export interface TopicRepairCalculation {
  needsRepair: boolean;
  repsCount: number;
  latestDate: string;
  updatePayload: {
    repetitions: number;
    lastReviewDate: string;
    nextReviewDate?: string;
  };
}

/**
 * Determines whether automatic self-healing routines should run in dry-run mode.
 * In Google AI Studio Preview (development mode, dev server, or non-production environment),
 * it returns true so that no automatic background writes occur against the production database.
 * Only genuine production builds (e.g. Netlify with PROD === true and VITE_APP_ENV === 'production')
 * are permitted to perform real writes. Default is always fail-safe dry-run.
 */
export function isSelfHealingDryRun(envOverride?: Record<string, any>): boolean {
  try {
    const metaEnv = envOverride ?? ((import.meta as any)?.env || {});
    const isExplicitProduction = metaEnv.PROD === true && metaEnv.VITE_APP_ENV === 'production';
    return !isExplicitProduction;
  } catch {
    return true;
  }
}

/**
 * Pure calculation logic for topic repair: checks for repetitions === 0 or missing lastReviewDate
 * and calculates repaired repetitions, lastReviewDate, and nextReviewDate using the existing SRS algorithm.
 */
export function calculateTopicRepair(
  topic: Pick<Topic, 'id' | 'name' | 'repetitions' | 'lastReviewDate' | 'nextReviewDate' | 'interval'>,
  topicSessions: Pick<StudySession, 'id' | 'topicId' | 'date'>[]
): TopicRepairCalculation | null {
  if (!topicSessions || topicSessions.length === 0) return null;
  const hasZeroReps = !topic.repetitions || topic.repetitions === 0;
  const hasNoLastReview = !topic.lastReviewDate;

  if (!hasZeroReps && !hasNoLastReview) return null;

  // Find latest session date
  const sortedSessions = [...topicSessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const latestSession = sortedSessions[0];
  const repsCount = topicSessions.length;
  const latestDate = latestSession.date;

  const updatePayload: {
    repetitions: number;
    lastReviewDate: string;
    nextReviewDate?: string;
  } = {
    repetitions: repsCount,
    lastReviewDate: latestDate,
  };

  // Restore nextReviewDate if missing
  if (!topic.nextReviewDate) {
    const nextDate = new Date(latestDate);
    nextDate.setDate(nextDate.getDate() + (topic.interval || 1));
    updatePayload.nextReviewDate = nextDate.toISOString();
  }

  return {
    needsRepair: true,
    repsCount,
    latestDate,
    updatePayload,
  };
}

/**
 * Executes the auto-sync topics process.
 * In Preview (dry-run mode): logs intended repair details with prefix [Self-Healing: DRY RUN - Preview]
 * and never executes write operations.
 * In Production: executes updateDoc preserving existing behavior.
 */
export async function executeTopicAutoSync(
  topicsList: Topic[],
  sessionsList: StudySession[],
  userId: string,
  options?: {
    isDryRun?: boolean;
    updateDocFn?: (ref: any, data: any) => Promise<any>;
    docFn?: (dbInstance: any, ...pathSegments: string[]) => any;
    dbInstance?: any;
    logFn?: (msg: string, ...args: any[]) => void;
  }
): Promise<number> {
  const isDryRun = options?.isDryRun ?? isSelfHealingDryRun();
  const updateFn = options?.updateDocFn ?? updateDoc;
  const makeDocRef = options?.docFn ?? doc;
  const database = options?.dbInstance ?? db;
  const log = options?.logFn ?? console.log;

  let repairsProcessed = 0;

  for (const topic of topicsList) {
    const topicSessions = sessionsList.filter(s => s.topicId === topic.id);
    const repair = calculateTopicRepair(topic, topicSessions);

    if (repair) {
      repairsProcessed++;
      if (isDryRun) {
        log(
          `[Self-Healing: DRY RUN - Preview] Topic "${topic.name}" (${topic.id}) out of sync. Planned payload -> repetitions: ${repair.repsCount}, lastReviewDate: ${repair.latestDate}${repair.updatePayload.nextReviewDate ? `, nextReviewDate: ${repair.updatePayload.nextReviewDate}` : ''}`,
          repair.updatePayload
        );
      } else {
        log(
          `[Self-Healing] Automatically repair out of sync topic "${topic.name}" (${topic.id}) -> repetitions: ${repair.repsCount}, lastReviewDate: ${repair.latestDate}`
        );
        const topicRef = makeDocRef(database, 'users', userId, 'topics', topic.id);
        await updateFn(topicRef, repair.updatePayload);
      }
    }
  }

  return repairsProcessed;
}

export function useStudyData() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [mockExams, setMockExams] = useState<MockExam[]>([]);
  const [collegeSchedule, setCollegeSchedule] = useState<CollegeClass[]>([]);
  const [loading, setLoading] = useState(true);
  const autoSyncedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!user) {
      setSubjects([]);
      setTopics([]);
      setSessions([]);
      setEvents([]);
      setMockExams([]);
      setCollegeSchedule([]);
      setLoading(false);
      autoSyncedRef.current = false;
      return;
    }

    let hasCache = false;
    // Try to load user-isolated cache instantly
    try {
      const cachedSubs = localStorage.getItem(`cache_medrevise_subjects_${user.uid}`);
      const cachedTopics = localStorage.getItem(`cache_medrevise_topics_${user.uid}`);
      
      if (cachedSubs && cachedTopics) {
        setSubjects(JSON.parse(cachedSubs));
        setTopics(JSON.parse(cachedTopics));
        
        const cachedSessions = localStorage.getItem(`cache_medrevise_sessions_${user.uid}`);
        if (cachedSessions) setSessions(JSON.parse(cachedSessions));

        const cachedEvents = localStorage.getItem(`cache_medrevise_events_${user.uid}`);
        if (cachedEvents) setEvents(JSON.parse(cachedEvents));

        const cachedCollege = localStorage.getItem(`cache_medrevise_college_${user.uid}`);
        if (cachedCollege) setCollegeSchedule(JSON.parse(cachedCollege));

        const cachedExams = localStorage.getItem(`cache_medrevise_exams_${user.uid}`);
        if (cachedExams) setMockExams(JSON.parse(cachedExams));
        
        hasCache = true;
      } else {
        setSubjects([]);
        setTopics([]);
        setSessions([]);
        setEvents([]);
        setCollegeSchedule([]);
        setMockExams([]);
      }
    } catch {
      setSubjects([]);
      setTopics([]);
      setSessions([]);
      setEvents([]);
      setCollegeSchedule([]);
      setMockExams([]);
    }

    setLoading(!hasCache);

    const subQuery = query(collection(db, 'users', user.uid, 'subjects'));
    const topicQuery = query(collection(db, 'users', user.uid, 'topics'));
    const eventQuery = query(collection(db, 'users', user.uid, 'calendarEvents'));
    const examQuery = query(collection(db, 'users', user.uid, 'mockExams'));
    const collegeQuery = query(collection(db, 'users', user.uid, 'collegeSchedule'));

    const unsubSubs = onSnapshot(subQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setSubjects(list);
      try { localStorage.setItem(`cache_medrevise_subjects_${user.uid}`, JSON.stringify(list)); } catch {}
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/subjects`);
    });

    const unsubTopics = onSnapshot(topicQuery, (snap) => {
      const list = snap.docs.map(d => {
        const data = d.data() as any;
        const hasSummary = !!(
          data.content || data.content_standard || data.content_deep || data.content_elite ||
          data.content_master || data.content_monograph || data.content_custom_analyzed ||
          data.content_resumo_expansao || data.content_resumo_lacunas
        );
        // Strip heavy content fields to avoid massive initial payload size
        const {
          content,
          content_standard,
          content_deep,
          content_elite,
          content_master,
          content_monograph,
          content_custom_analyzed,
          content_resumo_expansao,
          content_resumo_lacunas,
          ...metadata
        } = data;
        return { 
          id: d.id, 
          ...metadata,
          hasSummary,
          name: data.name || data.title || '',
          title: data.title || data.name || ''
        } as Topic;
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setTopics(list);
      setLoading(false);
      try { localStorage.setItem(`cache_medrevise_topics_${user.uid}`, JSON.stringify(list)); } catch {}
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/topics`);
      setLoading(false);
    });

    const sessionQuery = query(collection(db, 'users', user.uid, 'studySessions'));
    const quizQuery = query(collection(db, 'users', user.uid, 'quizAttempts'));
    const flashcardQuery = query(collection(db, 'users', user.uid, 'flashcardSessions'));
    const progressDocRef = doc(db, 'userProgress', user.uid);

    let rawDbSessions: any[] = [];
    let rawProgressSessions: any[] = [];
    let rawProgressQuizHistory: any[] = [];
    let rawQuizAttempts: any[] = [];
    let rawFlashcardSessions: any[] = [];

    const combineAndSetSessions = () => {
      const uniqueSessionsMap = new Map<string, StudySession>();
      const coveredOriginSessionIds = new Set<string>();

      // 1. Primary source: dbStudySessions (users/{userId}/studySessions subcollection)
      rawDbSessions.forEach(s => {
        if (!s.id) return;
        let mins = Number(s.studyTimeMinutes || 0);
        if (mins >= 180 && (s.description?.includes('via Cronograma Inteligente') || (s.questionsCount === 0 && mins >= 240))) {
          mins = 25;
        }
        const durSecs = s.durationSeconds ? Number(s.durationSeconds) : (mins * 60);
        const stTime = s.date || s.startTime || s.createdAt;

        // Register identifiers covered by primary source
        const cleanDocId = String(s.id).trim();
        coveredOriginSessionIds.add(cleanDocId);

        if (typeof s.originSessionId === 'string' && s.originSessionId.trim()) {
          coveredOriginSessionIds.add(s.originSessionId.trim());
        }
        if (typeof s.sessionId === 'string' && s.sessionId.trim()) {
          coveredOriginSessionIds.add(s.sessionId.trim());
        }

        // Conservative historical rule: syncQuizResultToMedRevise writes documents with ID `${topicId}_${sessionId}`
        if (typeof s.topicId === 'string' && s.topicId.trim().length > 0) {
          const prefix = `${s.topicId.trim()}_`;
          if (cleanDocId.startsWith(prefix)) {
            const rawOriginId = cleanDocId.slice(prefix.length).trim();
            if (rawOriginId.length > 0) {
              coveredOriginSessionIds.add(rawOriginId);
            }
          }
        }

        uniqueSessionsMap.set(s.id, {
          id: s.id,
          subjectId: s.subjectId || 'geral',
          topicId: s.topicId,
          date: stTime || new Date().toISOString(),
          durationSeconds: durSecs,
          studyTimeMinutes: mins || Math.max(1, Math.round(durSecs / 60)),
          questionsCount: Number(s.questionsCount) || 0,
          correctCount: Number(s.correctCount) || 0,
          description: s.description
        } as StudySession);
      });

      // 2. Secondary source: userProgress.studySessions (only include if not already covered by dbStudySessions)
      rawProgressSessions.forEach(s => {
        if (!s.id) return;
        const cleanId = String(s.id).trim();

        // Check if this session is already represented in primary dbStudySessions
        if (uniqueSessionsMap.has(s.id) || coveredOriginSessionIds.has(cleanId)) return;
        if (typeof s.sessionId === 'string' && coveredOriginSessionIds.has(s.sessionId.trim())) return;

        let mins = Number(s.studyTimeMinutes || 0);
        if (mins >= 180 && (s.description?.includes('via Cronograma Inteligente') || (s.questionsCount === 0 && mins >= 240))) {
          mins = 25;
        }
        const durSecs = s.durationSeconds ? Number(s.durationSeconds) : (mins * 60);
        const stTime = s.startTime || s.date || s.createdAt;

        uniqueSessionsMap.set(s.id, {
          id: s.id,
          subjectId: s.subjectId || 'geral',
          topicId: s.topicId,
          date: stTime || new Date().toISOString(),
          durationSeconds: durSecs,
          studyTimeMinutes: mins || Math.max(1, Math.round(durSecs / 60)),
          questionsCount: Number(s.questionsCount) || 0,
          correctCount: Number(s.correctCount) || 0,
          description: s.description
        } as StudySession);
      });

      const list = Array.from(uniqueSessionsMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setSessions(list);
      try { localStorage.setItem(`cache_medrevise_sessions_${user.uid}`, JSON.stringify(list)); } catch {}
    };

    const unsubSessions = onSnapshot(sessionQuery, (snap) => {
      rawDbSessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      combineAndSetSessions();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/studySessions`);
    });

    const unsubProgressDoc = onSnapshot(progressDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const pData = docSnap.data();
        const pSessions = Array.isArray(pData?.studySessions) ? pData.studySessions : [];
        rawProgressSessions = pSessions.filter((s: any) => {
          if (!s) return false;
          if (typeof s.id === 'string' && (s.id.startsWith('mock_') || s.id.startsWith('seed_') || s.id.startsWith('demo_'))) return false;
          return true;
        });
        rawProgressQuizHistory = Array.isArray(pData?.quizHistory) ? pData.quizHistory : [];
      } else {
        rawProgressSessions = [];
        rawProgressQuizHistory = [];
      }
      combineAndSetSessions();
    }, () => {});

    const unsubQuiz = onSnapshot(quizQuery, (snap) => {
      rawQuizAttempts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      combineAndSetSessions();
    }, () => {});

    const unsubFlashcard = onSnapshot(flashcardQuery, (snap) => {
      rawFlashcardSessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      combineAndSetSessions();
    }, () => {});

    const unsubEvents = onSnapshot(eventQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent));
      setEvents(list);
      try { localStorage.setItem(`cache_medrevise_events_${user.uid}`, JSON.stringify(list)); } catch {}
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/calendarEvents`);
    });

    const unsubCollege = onSnapshot(collegeQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as CollegeClass));
      setCollegeSchedule(list);
      try { localStorage.setItem(`cache_medrevise_college_${user.uid}`, JSON.stringify(list)); } catch {}
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/collegeSchedule`);
    });

    const unsubExams = onSnapshot(examQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as MockExam));
      setMockExams(list);
      setLoading(false);
      try { localStorage.setItem(`cache_medrevise_exams_${user.uid}`, JSON.stringify(list)); } catch {}
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/mockExams`);
      setLoading(false);
    });

    return () => {
      unsubSubs();
      unsubTopics();
      unsubSessions();
      unsubProgressDoc();
      unsubQuiz();
      unsubFlashcard();
      unsubEvents();
      unsubCollege();
      unsubExams();
    };
  }, [user?.uid]);


  // Self-healing synchronization: correct topics out of sync with actual study sessions
  useEffect(() => {
    if (!user || loading || topics.length === 0 || autoSyncedRef.current) return;

    const autoSyncTopics = async () => {
      autoSyncedRef.current = true;
      try {
        await executeTopicAutoSync(topics, sessions, user.uid);
      } catch (err) {
        console.error('[Self-Healing] Error during auto-synchronization of topics:', err);
      }
    };

    autoSyncTopics();
  }, [user?.uid, loading, topics, sessions]);
  const sanitizeInt = (val: any): number => {
    const num = Number(val);
    if (!Number.isFinite(num)) return 0;
    return Math.floor(Math.max(0, num));
  };

  const sanitizeTime = (val: any): number => {
    const num = Number(val);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, num);
  };

  const totalQuestions = sessions.reduce((acc, s) => acc + sanitizeInt(s.questionsCount), 0) + 
                         (mockExams || []).reduce((acc, e) => acc + sanitizeInt(e.totalQuestions), 0);
  
  const totalStudyMinutes = sessions.reduce((acc, s) => acc + sanitizeTime(s.studyTimeMinutes), 0) + 
                            (mockExams || []).reduce((acc, e) => acc + sanitizeTime(e.timeSpentMinutes), 0);
  
  const totalCorrect = sessions.reduce((acc, s) => {
    const q = sanitizeInt(s.questionsCount);
    const c = sanitizeInt(s.correctCount);
    return acc + Math.min(q, c);
  }, 0) + (mockExams || []).reduce((acc, e) => {
    const q = sanitizeInt(e.totalQuestions);
    const c = sanitizeInt(e.correctAnswers);
    return acc + Math.min(q, c);
  }, 0);
  
  const overallAccuracy = totalQuestions > 0 ? Math.min(100, Math.max(0, Math.round((totalCorrect / totalQuestions) * 100))) : 0;

  const metrics = {
    totalQuestions,
    totalStudyMinutes,
    totalCorrect,
    overallAccuracy
  };

  return { subjects, topics, sessions, events, mockExams, collegeSchedule, loading, metrics };
}
