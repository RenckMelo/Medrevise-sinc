import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, collection, query, onSnapshot, orderBy, doc, updateDoc } from '../firebase';
import { Subject, Topic, StudySession, CalendarEvent, MockExam, CollegeClass } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

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

    // Try to load user-isolated cache instantly
    try {
      const cachedSubs = localStorage.getItem(`cache_medrevise_subjects_${user.uid}`);
      if (cachedSubs) {
        setSubjects(JSON.parse(cachedSubs));
      } else {
        setSubjects([]);
      }
      
      const cachedTopics = localStorage.getItem(`cache_medrevise_topics_${user.uid}`);
      if (cachedTopics) {
        setTopics(JSON.parse(cachedTopics));
      } else {
        setTopics([]);
      }
    } catch {
      setSubjects([]);
      setTopics([]);
    }

    setLoading(true);

    const subQuery = query(collection(db, 'users', user.uid, 'subjects'));
    const topicQuery = query(collection(db, 'users', user.uid, 'topics'));
    const sessionQuery = query(collection(db, 'users', user.uid, 'studySessions'));
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
        return { 
          id: d.id, 
          ...data,
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

    const unsubSessions = onSnapshot(sessionQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudySession));
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setSessions(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/studySessions`);
    });

    const unsubEvents = onSnapshot(eventQuery, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/calendarEvents`);
    });

    const unsubCollege = onSnapshot(collegeQuery, (snap) => {
      setCollegeSchedule(snap.docs.map(d => ({ id: d.id, ...d.data() } as CollegeClass)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/collegeSchedule`);
    });

    const unsubExams = onSnapshot(examQuery, (snap) => {
      setMockExams(snap.docs.map(d => ({ id: d.id, ...d.data() } as MockExam)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/mockExams`);
      setLoading(false);
    });

    return () => {
      unsubSubs();
      unsubTopics();
      unsubSessions();
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
        for (const topic of topics) {
          const topicSessions = sessions.filter(s => s.topicId === topic.id);
          if (topicSessions.length > 0) {
            const hasZeroReps = !topic.repetitions || topic.repetitions === 0;
            const hasNoLastReview = !topic.lastReviewDate;
            
            if (hasZeroReps || hasNoLastReview) {
              // Find latest session date
              const sortedSessions = [...topicSessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              const latestSession = sortedSessions[0];
              const repsCount = topicSessions.length;
              const latestDate = latestSession.date;

              console.log(`[Self-Healing] Automatically repair out of sync topic "${topic.name}" (${topic.id}) -> repetitions: ${repsCount}, lastReviewDate: ${latestDate}`);
              
              const updatePayload: any = {
                repetitions: repsCount,
                lastReviewDate: latestDate
              };

              // Restore nextReviewDate if missing
              if (!topic.nextReviewDate) {
                const nextDate = new Date(latestDate);
                nextDate.setDate(nextDate.getDate() + (topic.interval || 1));
                updatePayload.nextReviewDate = nextDate.toISOString();
              }

              const topicRef = doc(db, 'users', user.uid, 'topics', topic.id);
              await updateDoc(topicRef, updatePayload);
            }
          }
        }
      } catch (err) {
        console.error('[Self-Healing] Error during auto-synchronization of topics:', err);
      }
    };

    autoSyncTopics();
  }, [user?.uid, loading, topics, sessions]);

  return { subjects, topics, sessions, events, mockExams, collegeSchedule, loading };
}
