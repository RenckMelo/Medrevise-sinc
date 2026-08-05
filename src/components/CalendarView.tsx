import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc, writeBatch, where, getDocs } from '../firebase';
import { CalendarEvent, Topic, CollegeClass, StudySession, Subject } from '../types';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO,
  isToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  RefreshCw, 
  GripVertical, 
  X, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  Sparkles,
  Info,
  Calendar,
  BookOpen,
  Brain,
  Eye,
  EyeOff,
  Check,
  Undo2
} from 'lucide-react';
import { useStudyData } from '../hooks/useStudyData';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';
import { accuracyToQuality, calculateNextReview } from '../utils/srs';
import { 
  DndContext, 
  DragOverlay, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  TouchSensor,
  DragStartEvent, 
  DragEndEvent,
  useDraggable,
  useDroppable
} from '@dnd-kit/core';

// Ebbinghaus Forgetting Curve Math formula:
// F = 1 - e^(-t / (S * EF))
// Where F is forgetting probability, t is elapsed days, S is spacing/interval, EF is easinessFactor
const calculateForgettingIndex = (topic: Topic, targetDate: Date) => {
  if (topic.completed) return 0;
  
  // Use lastReviewDate if available, or fall back to Topic creation time
  const lastReviewTime = topic.lastReviewDate 
    ? new Date(topic.lastReviewDate).getTime() 
    : new Date(topic.createdAt).getTime();
  
  const diffTime = targetDate.getTime() - lastReviewTime;
  const elapsedDays = Math.max(0.01, diffTime / (1000 * 60 * 60 * 24));
  
  const interval = Math.max(1, topic.interval || 1);
  const ef = Math.max(1.3, topic.easinessFactor || 2.5);
  
  // Exponential decay curve prediction
  const forgettingProbability = 1 - Math.exp(-elapsedDays / (interval * ef));
  return Math.min(0.99, Math.max(0, forgettingProbability));
};

const toLocalDatetimeString = (isoString: string) => {
  if (!isoString) return '';
  try {
    const date = parseISO(isoString);
    return format(date, "yyyy-MM-dd'T'HH:mm");
  } catch (error) {
    return isoString.substring(0, 16);
  }
};

const toUTCISOString = (localString: string) => {
  if (!localString) return '';
  try {
    return new Date(localString).toISOString();
  } catch (error) {
    return localString;
  }
};

const getCleanedTitle = (title: string) => {
  let clean = title || '';
  const prefixes = ['📖 [TEORIA] ', '✍️ [QUESTÕES] ', '🔄 [REVISÃO] ', '🎥 [AULA] ', '📝 [SIMULADO] '];
  prefixes.forEach(p => {
    if (clean.startsWith(p)) {
      clean = clean.substring(p.length);
    }
  });
  return clean.trim();
};

export default function CalendarView() {
  const { user, profile } = useAuth();
  const { subjects, topics, events, collegeSchedule, loading } = useStudyData();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const lastNavTime = useRef<number>(0);
  
  const [showEventForm, setShowEventForm] = useState(false);
  const [showTopicForm, setShowTopicForm] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleDays, setRescheduleDays] = useState(7);
  const [newEvent, setNewEvent] = useState({
    title: '',
    start: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    end: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    description: '',
    completed: false,
    subjectId: '',
    topicId: '',
    newTopicName: ''
  });

  const [editTopicData, setEditTopicData] = useState({
    name: '',
    nextReviewDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    description: '',
    completed: false
  });

  const [activeTopicTab, setActiveTopicTab] = useState<'log' | 'edit'>('log');
  const [calendarReviewMethod, setCalendarReviewMethod] = useState<'perception' | 'questions'>('perception');
  const [calendarReviewQuality, setCalendarReviewQuality] = useState<number | null>(null);
  const [calendarQuestionsCount, setCalendarQuestionsCount] = useState<number | string>('');
  const [calendarCorrectCount, setCalendarCorrectCount] = useState<number | string>('');
  const [calendarReviewTime, setCalendarReviewTime] = useState<number | string>(15);
  const [calendarNotes, setCalendarNotes] = useState<string>('');
  const [calendarReviewDate, setCalendarReviewDate] = useState<string>(format(new Date(), "yyyy-MM-dd'T'HH:mm"));

  const [showCronogramaEvents, setShowCronogramaEvents] = useState<boolean>(() => {
    const saved = localStorage.getItem('medinternato_show_cronograma_calendar');
    return saved !== null ? saved === 'true' : true;
  });

  const [undoHistory, setUndoHistory] = useState<{
    type: string;
    description: string;
    timestamp: number;
    edits: {
      collection: 'calendarEvents' | 'topics';
      docId: string;
      oldValue: any;
      newValue: any;
    }[];
  }[]>([]);

  const handleUndo = async () => {
    if (!user || undoHistory.length === 0) return;
    const nextHistory = [...undoHistory];
    const lastAction = nextHistory.pop();
    if (!lastAction) return;

    try {
      const batch = writeBatch(db);
      lastAction.edits.forEach(edit => {
        const docRef = doc(db, 'users', user.uid, edit.collection, edit.docId);
        batch.update(docRef, edit.oldValue);
      });
      await batch.commit();
      setUndoHistory(nextHistory);
      triggerNotification('Ação Desfeita', `Desfeito: ${lastAction.description}`, 'success');
    } catch (error) {
      console.error('Erro ao desfazer ação:', error);
      triggerNotification('Erro ao Desfazer', 'Não foi possível reverter a última alteração.', 'error');
    }
  };

  const isCronogramaEvent = (e: CalendarEvent) => {
    return (
      (e as any).isCronograma ||
      e.title.startsWith('🔄 [REVISÃO]') ||
      e.title.startsWith('📖 [') ||
      e.title.startsWith('📝 [SIMULADO]') ||
      (e.description && e.description.includes('Estudo programado')) ||
      (e.description && e.description.includes('Simulado programado'))
    );
  };

  const displayedEvents = events.filter(e => {
    if (!showCronogramaEvents && isCronogramaEvent(e)) {
      return false;
    }
    const activeScheduleId = localStorage.getItem('active_schedule_id');
    if (isCronogramaEvent(e) && (e as any).scheduleId && activeScheduleId) {
      if ((e as any).scheduleId !== activeScheduleId) {
        return false;
      }
    }
    return true;
  });

  const handleToggleEventCompleted = async (targetEvent: CalendarEvent) => {
    if (!user) return;
    const newCompleted = !targetEvent.completed;

    try {
      // 1. Update calendarEvents document in Firestore
      await updateDoc(doc(db, 'users', user.uid, 'calendarEvents', targetEvent.id), {
        completed: newCompleted
      });

      // 2. Clean title for topic/schedule matching
      const cronoTopicTitle = (targetEvent as any).cronogramaTopicTitle;
      const cleanTitle = cronoTopicTitle || getCleanedTitle(targetEvent.title);
      const targetCleanLower = cleanTitle.toLowerCase().trim();

      // 3. Sync completion to Cronograma schedules in Firestore
      const schedSnap = await getDocs(collection(db, 'users', user.uid, 'schedules'));
      for (const schedDoc of schedSnap.docs) {
        const schedData = schedDoc.data();
        let modified = false;
        const updatedWeeks = (schedData.weeks || []).map((week: any) => {
          let weekModified = false;

          // Check mock exam
          if (week.mockExam && (
            week.mockExam.title?.toLowerCase().trim() === targetCleanLower ||
            targetEvent.title.toLowerCase().includes(week.mockExam.title?.toLowerCase().trim() || '___')
          )) {
            week.mockExam.isCompleted = newCompleted;
            weekModified = true;
          }

          // Check daily topics
          const updatedDays: any = {};
          Object.entries(week.days || {}).forEach(([dayName, dayTopics]: [string, any]) => {
            updatedDays[dayName] = (dayTopics as any[]).map((topic: any) => {
              const topicClean = (topic.title || '').toLowerCase().trim();
              if (
                topicClean === targetCleanLower ||
                targetEvent.title.toLowerCase().includes(topicClean) ||
                (topicClean && targetCleanLower.includes(topicClean))
              ) {
                weekModified = true;
                return { ...topic, isCompleted: newCompleted };
              }
              return topic;
            });
          });

          if (weekModified) {
            modified = true;
            return { ...week, days: updatedDays };
          }
          return week;
        });

        if (modified) {
          let totalTopicsCount = 0;
          let completedCount = 0;
          updatedWeeks.forEach((w: any) => {
            Object.values(w.days || {}).forEach((arr: any) => {
              (arr as any[]).forEach((t: any) => {
                totalTopicsCount++;
                if (t.isCompleted) completedCount++;
              });
            });
          });
          const progress = totalTopicsCount > 0 ? Math.round((completedCount / totalTopicsCount) * 100) : 0;

          await updateDoc(doc(db, 'users', user.uid, 'schedules', schedDoc.id), {
            weeks: updatedWeeks,
            progress
          });
        }
      }

      // 4. Sync to topics collection in Firestore
      const foundTopic = topics.find(t => {
        const tTitle = ((t as any).title || (t as any).name || '').toLowerCase().trim();
        return tTitle === targetCleanLower || (tTitle && targetCleanLower.includes(tTitle));
      });

      if (foundTopic) {
        await updateDoc(doc(db, 'users', user.uid, 'topics', foundTopic.id), {
          completed: newCompleted
        });
      }

      triggerNotification(
        newCompleted ? 'Sincronizado: Concluído' : 'Sincronizado: Desmarcado',
        `O item "${cleanTitle}" foi atualizado no Calendário e no Cronograma com sucesso!`,
        'success'
      );
    } catch (err) {
      console.error('Erro ao sincronizar status do evento:', err);
    }
  };

  // State-driven overlay notification / modals custom replacement for blocked iframe window.alert & window.confirm
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmStyle?: 'danger' | 'default';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    confirmText: 'Confirmar',
    confirmStyle: 'default'
  });

  const [toastNotification, setToastNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const triggerNotification = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastNotification({
      isOpen: true,
      title,
      message,
      type
    });
    // Auto collapse banner
    const timer = setTimeout(() => {
      setToastNotification(prev => ({ ...prev, isOpen: false }));
    }, 5000);
    return () => clearTimeout(timer);
  };

  const triggerConfirm = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    confirmStyle: 'danger' | 'default' = 'default',
    confirmText: string = 'Confirmar'
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      confirmStyle,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Auto-migration to flag previously recalculated overdue topics
  useEffect(() => {
    if (!user || !topics || topics.length === 0) return;
    const topicsToUpgrade = topics.filter(t => {
      if (t.completed || t.wasRescheduledOverdue) return false;
      if (!t.nextReviewDate) return false;
      try {
        const d = new Date(t.nextReviewDate);
        return d.getMinutes() === 0 && d.getSeconds() === 0;
      } catch (err) {
        return false;
      }
    });

    if (topicsToUpgrade.length > 0) {
      const upgradeBatch = async () => {
        try {
          const batch = writeBatch(db);
          topicsToUpgrade.forEach(t => {
            const topicRef = doc(db, 'users', user.uid, 'topics', t.id);
            batch.update(topicRef, { wasRescheduledOverdue: true });
          });
          await batch.commit();
          console.log(`Auto-migrated ${topicsToUpgrade.length} previously recalculated topics to Ex-Atrasado status.`);
        } catch (e) {
          console.error("Error migrating rescheduled topics:", e);
        }
      };
      upgradeBatch();
    }
  }, [user, topics]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate
  });

  const handleAddEventForDay = (day: Date) => {
    const startObj = new Date(day);
    startObj.setHours(9, 0, 0, 0);
    const endObj = new Date(day);
    endObj.setHours(10, 0, 0, 0);

    setEditingEvent(null);
    setNewEvent({
      title: '',
      start: format(startObj, "yyyy-MM-dd'T'HH:mm"),
      end: format(endObj, "yyyy-MM-dd'T'HH:mm"),
      description: '',
      completed: false,
      subjectId: '',
      topicId: '',
      newTopicName: ''
    });
    setShowEventForm(true);
  };

  const addEvent = async () => {
    if (!user || !newEvent.title.trim()) return;
    
    try {
      let finalTopicId = newEvent.topicId;

      if (newEvent.subjectId) {
        let targetTopicName = '';
        
        if (newEvent.topicId === 'NEW_TOPIC' && (newEvent as any).newTopicName?.trim()) {
          targetTopicName = (newEvent as any).newTopicName.trim();
        } else if (!newEvent.topicId || newEvent.topicId === '') {
          targetTopicName = getCleanedTitle(newEvent.title);
        }

        if (targetTopicName) {
          // Check if a topic with this name (case-insensitive) already exists under this subject
          const existingTopic = topics?.find(
            t => t.subjectId === newEvent.subjectId && t.name.toLowerCase() === targetTopicName.toLowerCase()
          );

          if (existingTopic) {
            finalTopicId = existingTopic.id;
          } else {
            // Create a new topic!
            const newDocRef = await addDoc(collection(db, 'users', user.uid, 'topics'), {
              name: targetTopicName,
              subjectId: newEvent.subjectId,
              interval: 0,
              easinessFactor: 2.5,
              repetitions: 0,
              createdAt: new Date().toISOString(),
              nextReviewDate: ''
            });
            finalTopicId = newDocRef.id;
            triggerNotification('Tópico Criado', `O tópico "${targetTopicName}" foi criado e vinculado com sucesso!`, 'success');
          }
        }
      }

      // We should strip newTopicName from eventPayload because Firestore/isValidCalendarEvent schema doesn't need/want it
      const { newTopicName, ...cleanNewEvent } = newEvent as any;

      const eventPayload = {
        ...cleanNewEvent,
        topicId: finalTopicId,
        start: toUTCISOString(newEvent.start),
        end: toUTCISOString(newEvent.end)
      };

      if (editingEvent) {
        await updateDoc(doc(db, 'users', user.uid, 'calendarEvents', editingEvent.id), eventPayload);
        setEditingEvent(null);
        triggerNotification('Compromisso Atualizado', 'Sua programação foi reorganizada com sucesso!', 'success');
      } else {
        await addDoc(collection(db, 'users', user.uid, 'calendarEvents'), {
          ...eventPayload,
          createdAt: new Date().toISOString()
        });
        triggerNotification('Compromisso Adicionado', 'Seu compromisso foi incluído com sucesso.', 'success');
      }

      setNewEvent({
        title: '',
        start: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        end: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        description: '',
        completed: false,
        subjectId: '',
        topicId: '',
        newTopicName: ''
      } as any);
      setShowEventForm(false);
    } catch (error) {
      handleFirestoreError(error, editingEvent ? OperationType.UPDATE : OperationType.CREATE, `users/${user.uid}/calendarEvents`);
    }
  };

  const submitCalendarReview = async () => {
    if (!user || !editingTopic) return;

    let quality = calendarReviewQuality;
    let questions = 0;
    let correct = 0;

    if (calendarReviewMethod === 'questions') {
      questions = parseInt(calendarQuestionsCount as string) || 0;
      correct = parseInt(calendarCorrectCount as string) || 0;
      quality = accuracyToQuality(correct, questions);
    } else {
      if (quality === null) return;
    }

    try {
      const parsedReviewDate = calendarReviewDate ? new Date(calendarReviewDate) : new Date();
      const dateIso = parsedReviewDate.toISOString();

      const srsUpdate = calculateNextReview(
        quality,
        editingTopic.repetitions ?? 0,
        editingTopic.interval ?? 0,
        editingTopic.easinessFactor ?? 2.5,
        parsedReviewDate
      );

      const finalReviewTime = Number(calendarReviewTime) || 15;

      // Add study session
      await addDoc(collection(db, 'users', user.uid, 'studySessions'), {
        topicId: editingTopic.id,
        subjectId: editingTopic.subjectId,
        date: dateIso,
        questionsCount: questions,
        correctCount: correct,
        studyTimeMinutes: finalReviewTime,
        description: calendarReviewMethod === 'questions'
          ? `Revisão por Questões no Calendário (${correct}/${questions} acertos)${calendarNotes.trim() ? ` - ${calendarNotes.trim()}` : ''}`
          : `Revisão Ativa no Calendário (Autopercepção: ${quality}/5)${calendarNotes.trim() ? ` - ${calendarNotes.trim()}` : ''}`
      });

      // Update topic
      await updateDoc(doc(db, 'users', user.uid, 'topics', editingTopic.id), {
        interval: srsUpdate.interval,
        easinessFactor: srsUpdate.ease,
        repetitions: srsUpdate.repetitions,
        nextReviewDate: srsUpdate.nextReviewDate,
        lastReviewDate: dateIso,
        wasRescheduledOverdue: false,
        completed: false
      });

      setEditingTopic(null);
      setShowTopicForm(false);
      triggerNotification('Revisão Registrada', 'Parabéns! Sua sessão de repetição espaçada foi registrada com sucesso!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/studySessions`);
    }
  };

  const updateTopic = async () => {
    if (!user || !editingTopic || !editTopicData.name.trim()) return;
    
    try {
      await updateDoc(doc(db, 'users', user.uid, 'topics', editingTopic.id), {
        name: editTopicData.name,
        nextReviewDate: toUTCISOString(editTopicData.nextReviewDate),
        description: editTopicData.description,
        completed: editTopicData.completed,
        ...(editTopicData.completed ? { wasRescheduledOverdue: false } : {})
      });

      setEditingTopic(null);
      setShowTopicForm(false);
      triggerNotification('Revisão Reagendada', 'A prioridade da revisão foi recalculada para o novo horário!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/topics`);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!user) return;
    triggerConfirm(
      'Excluir Compromisso',
      'Tem certeza que deseja apagar permanentemente este compromisso de seu cronograma?',
      async () => {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'calendarEvents', id));
          setShowEventForm(false);
          setEditingEvent(null);
          triggerNotification('Compromisso Removido', 'Compromisso apagado com sucesso.', 'info');
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/calendarEvents/${id}`);
        }
      },
      'danger',
      'Excluir'
    );
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const [hasGoogleConnection, setHasGoogleConnection] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  useEffect(() => {
    if (!user) return;
    const credRef = doc(db, 'users', user.uid, 'googleCredentials', 'default');
    const unsub = onSnapshot(credRef, (docSnap) => {
      setHasGoogleConnection(docSnap.exists());
    }, (error) => {
      console.error('Error fetching google connection state:', error);
    });
    return () => unsub();
  }, [user]);

  const handleClearSync = async () => {
    if (!user) return;
    setIsCleaning(true);
    try {
      const batch = writeBatch(db);
      const syncedEvents = events.filter(e => e.googleEventId);
      console.log(`Cleaning up ${syncedEvents.length} synchronized Google Calendar events...`);

      syncedEvents.forEach(e => {
        batch.delete(doc(db, 'users', user.uid, 'calendarEvents', e.id));
      });

      const credRef = doc(db, 'users', user.uid, 'googleCredentials', 'default');
      batch.delete(credRef);

      await batch.commit();
      triggerNotification(
        'Sincronização Desfeita', 
        'A conexão foi encerrada e todos os compromissos criados via Google Calendar foram removidos de seu estudo.', 
        'success'
      );
    } catch (error: any) {
      console.error('Error clearing synchronization:', error);
      triggerNotification('Falha ao Desconectar', `Ocorreu um erro: ${error.message || error}`, 'error');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleRescheduleOverdue = () => {
    const overdueList = topics.filter(t => {
      if (t.completed || !t.nextReviewDate) return false;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return new Date(t.nextReviewDate).getTime() < todayStart.getTime();
    });

    if (overdueList.length === 0) return;
    
    // Auto calculate initial recommended days: up to 3 reviews per day
    const recommendedDays = Math.max(2, Math.min(14, Math.ceil(overdueList.length / 3)));
    setRescheduleDays(recommendedDays);
    setShowRescheduleDialog(true);
  };

  const executeRescheduleOverdue = async () => {
    const overdueList = topics.filter(t => {
      if (t.completed || !t.nextReviewDate) return false;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return new Date(t.nextReviewDate).getTime() < todayStart.getTime();
    });

    if (overdueList.length === 0) {
      setShowRescheduleDialog(false);
      return;
    }

    // Sort descending by calculated forgetting index: absolute highest score (most forgotten/highest risk) first
    const now = new Date();
    const overdueWithPriority = overdueList.map(topic => {
      const score = calculateForgettingIndex(topic, now);
      return { topic, score };
    });

    // Sort descending (highest score first)
    overdueWithPriority.sort((a, b) => b.score - a.score);

    try {
      const batch = writeBatch(db);
      const baseHour = 9; // starting 9:00 am
      const edits: any[] = [];
      
      overdueWithPriority.forEach(({ topic }, idx) => {
        // Distribute mathematically across the selected days
        const dayOffset = idx % rescheduleDays;
        // Stagger hours apart inside each day
        const hourOffset = Math.floor(idx / rescheduleDays);
        const targetDate = new Date();
        targetDate.setDate(now.getDate() + dayOffset);
        targetDate.setHours(baseHour + hourOffset, 0, 0, 0);
        
        const topicRef = doc(db, 'users', user.uid, 'topics', topic.id);
        batch.update(topicRef, {
          nextReviewDate: targetDate.toISOString(),
          wasRescheduledOverdue: true
        });

        edits.push({
          collection: 'topics',
          docId: topic.id,
          oldValue: { 
            nextReviewDate: topic.nextReviewDate || null,
            wasRescheduledOverdue: topic.wasRescheduledOverdue || false
          },
          newValue: { 
            nextReviewDate: targetDate.toISOString(),
            wasRescheduledOverdue: true
          }
        });
      });
      
      await batch.commit();
      setUndoHistory(prev => [
        ...prev,
        {
          type: 'batch_reschedule',
          description: `Reorganização de ${overdueList.length} revisões`,
          timestamp: Date.now(),
          edits
        }
      ]);
      setShowRescheduleDialog(false);
      triggerNotification(
        'Cronograma Reorganizado', 
        `${overdueList.length} revisões atrasadas foram reorganizadas por prioridade máxima (mais esquecidos primeiro) nos próximos ${rescheduleDays} dias!`, 
        'success'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/topics`);
    }
  };

  const saveGoogleCredentials = async (tokens: any) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'googleCredentials', 'default'), {
        tokens,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving credentials to Firestore:', error);
    }
  };

  const handleSync = async () => {
    if (!user) {
      console.log('Sync aborted: user is not defined.');
      return;
    }
    setIsSyncing(true);
    console.log('Starting handleSync diagnostic flow for user:', user.uid);
    try {
      // 1. Fetch credentials from Firestore
      console.log('Step 1: Fetching google credentials...');
      let credSnap;
      try {
        const credRef = doc(db, 'users', user.uid, 'googleCredentials', 'default');
        credSnap = await getDoc(credRef);
        console.log('Step 1 success! Credentials document exists:', credSnap.exists());
      } catch (err: any) {
        console.error('Step 1 error (Fetching credentials):', err);
        throw new Error(`Step 1 (Fetch credentials) failed: ${err.message || err}`);
      }
 
      if (!credSnap.exists()) {
        console.log('No credentials found. Fetching auth URL...');
        try {
          const urlRes = await fetch(`/api/auth/google/url?userId=${user.uid}`);
          if (!urlRes.ok) {
            const errData = await urlRes.json().catch(() => ({}));
            const msg = errData.error || 'Não foi possível obter a URL de autenticação.';
            triggerNotification('Erro de Autenticação', `Erro na configuração do Google Calendar:\n\n${msg}`, 'error');
            setIsSyncing(false);
            return;
          }
          const { url, redirectUri } = await urlRes.json();
          console.log('Google Auth URL:', url);
          console.log('Google Auth Configured redirectUri:', redirectUri);
          
          console.log('Opening auth popup window...');
          const authWindow = window.open(url, 'google_auth', 'width=600,height=700');
          if (!authWindow) {
            triggerNotification('Bloqueador Ativo', 'Por favor, permita popups para conseguir conectar ao Google Calendar.', 'info');
          }
        } catch (err: any) {
          console.error('Error opening auth URL:', err);
          triggerNotification('Erro de Conexão', 'Erro ao obter URL de autenticação com o Google.', 'error');
        }
        setIsSyncing(false);
        return;
      }
 
      const { tokens } = credSnap.data();
      console.log('Step 1: Retrieved tokens from database successfully.');
 
      // 2. Fetch Google Calendar events using stateless server proxy
      console.log('Step 2: Fetching calendar events from Google proxy...');
      let googleEvents;
      try {
        const fetchRes = await fetch('/api/calendar/fetch-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokens })
        });
 
        if (!fetchRes.ok) {
          const errMsg = await fetchRes.text();
          throw new Error(`Server returned status ${fetchRes.status}: ${errMsg}`);
        }
 
        const result = await fetchRes.json();
        googleEvents = result.items;
        console.log(`Step 2 success! Fetched ${googleEvents?.length || 0} events from Google.`);
      } catch (err: any) {
        console.error('Step 2 error (Fetching calendar events from Google API):', err);
        throw new Error(`Step 2 (Fetch from Google Calendar) failed: ${err.message || err}`);
      }
 
      // 3. Save incoming Google Calendar events to local Firestore
      console.log('Step 3: Processing incoming google events...');
      const batch = writeBatch(db);
      const eventsCol = collection(db, 'users', user.uid, 'calendarEvents');
 
      for (const gEvent of googleEvents || []) {
        if (!gEvent.id) continue;
 
        console.log(`Step 3.1: Querying local event for googleEventId: ${gEvent.id}...`);
        let qSnap;
        try {
          const q = query(eventsCol, where('googleEventId', '==', gEvent.id));
          qSnap = await getDocs(q);
        } catch (err: any) {
          console.error(`Step 3.1 error querying googleEventId ${gEvent.id}:`, err);
          throw new Error(`Step 3.1 (Query existing event ${gEvent.id}) failed: ${err.message || err}`);
        }
 
        const eventData = {
          title: gEvent.summary || 'Sem título',
          description: gEvent.description || '',
          start: gEvent.start?.dateTime || gEvent.start?.date || '',
          end: gEvent.end?.dateTime || gEvent.end?.date || '',
          googleEventId: gEvent.id,
          updatedAt: new Date().toISOString()
        };
 
        if (qSnap.empty) {
          const newDocRef = doc(eventsCol);
          console.log(`Step 3.2: Queued batch SET for new event: ${eventData.title}`);
          batch.set(newDocRef, eventData);
        } else {
          const existingDocRef = doc(db, 'users', user.uid, 'calendarEvents', qSnap.docs[0].id);
          console.log(`Step 3.2: Queued batch UPDATE for existing local document: ${qSnap.docs[0].id}`);
          batch.update(existingDocRef, eventData);
        }
      }
 
      // 4. Find local events without googleEventId which need to be pushed to Google Calendar
      console.log('Step 4: Fetching local events to push to Google...');
      let localSnap;
      try {
        localSnap = await getDocs(query(eventsCol));
      } catch (err: any) {
        console.error('Step 4 error (Querying local events):', err);
        throw new Error(`Step 4 (Query local events) failed: ${err.message || err}`);
      }
      
      const localToSync = localSnap.docs.filter(doc => !doc.data().googleEventId);
      console.log(`Found ${localToSync.length} local events to sync to Google Calendar.`);
 
      for (const lDoc of localToSync) {
        const lData = lDoc.data();
        console.log(`Syncing local event "${lData.title}" to Google...`);
        try {
          const createRes = await fetch('/api/calendar/create-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tokens,
              event: {
                title: lData.title,
                description: lData.description || '',
                start: lData.start,
                end: lData.end
              }
            })
          });
 
          if (createRes.ok) {
            const gCreatedEvent = await createRes.json();
            console.log(`Successfully created event on Google with ID: ${gCreatedEvent.id}. Queuing batch update...`);
            batch.update(doc(db, 'users', user.uid, 'calendarEvents', lDoc.id), {
              googleEventId: gCreatedEvent.id
            });
          } else {
            const errMsg = await createRes.text();
            console.warn(`Failed to create event "${lData.title}" in Google: ${errMsg}`);
          }
        } catch (err: any) {
          console.error(`Error syncing local event "${lData.title}":`, err);
        }
      }
 
      console.log('Step 5: Committing the batch modification to Firestore...');
      try {
        await batch.commit();
        console.log('Step 5 batch commit success!');
      } catch (err: any) {
        console.error('Step 5 batch commit failure:', err);
        throw new Error(`Step 5 (Batch Commit) failed: ${err.message || err}`);
      }
 
      triggerNotification('Agenda Sincronizada', 'A sincronização com o Google Calendar foi finalizada com êxito!', 'success');
    } catch (error: any) {
      console.error('Full Sync error details:', error);
      triggerNotification('Erro ao Sincronizar', `Erro ao sincronizar com o Google Calendar: ${error.message || error}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Listen to postMessage authentications (from popup flow)
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        if (event.data.tokens) {
          await saveGoogleCredentials(event.data.tokens);
        }
        handleSync();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  // Handle Hash redirect sync token storage (from same-window flow fallback)
  useEffect(() => {
    const checkHashAndSave = async () => {
      if (!user) return;
      const hash = window.location.hash;
      if (hash && hash.startsWith('#tokens=')) {
        try {
          const tokensStr = decodeURIComponent(hash.substring(8));
          const tokens = JSON.parse(tokensStr);
          await saveGoogleCredentials(tokens);
          // Clear URL hash securely
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          // Trigger sync operation
          handleSync();
        } catch (err) {
          console.error('Error parsing token hash:', err);
        }
      }
    };
    checkHashAndSave();
  }, [user]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragMove = (event: any) => {
    const { active } = event;
    if (!active || !active.rect.current.translated) return;

    const now = Date.now();
    if (now - lastNavTime.current < 1500) return; // 1.5s cooldown

    const rect = active.rect.current.translated;
    const centerX = rect.left + rect.width / 2;
    const width = window.innerWidth;
    const threshold = 60;

    if (centerX < threshold) {
      setCurrentMonth(prev => subMonths(prev, 1));
      lastNavTime.current = now;
    } else if (centerX > width - threshold) {
      setCurrentMonth(prev => addMonths(prev, 1));
      lastNavTime.current = now;
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const draggedId = active.id as string;
      const newDateStr = over.id as string; // "yyyy-MM-dd"
      
      if (!user) return;
      
      const calendarEvent = events.find(e => e.id === draggedId);
      if (calendarEvent) {
        const oldStartDate = parseISO(calendarEvent.start);
        const oldEndDate = parseISO(calendarEvent.end);
        const duration = oldEndDate.getTime() - oldStartDate.getTime();
        
        const newStartDate = parseISO(newDateStr);
        newStartDate.setHours(oldStartDate.getHours());
        newStartDate.setMinutes(oldStartDate.getMinutes());
        
        const newEndDate = new Date(newStartDate.getTime() + duration);

        try {
          const eventRef = doc(db, 'users', user.uid, 'calendarEvents', draggedId);
          await updateDoc(eventRef, {
            start: newStartDate.toISOString(),
            end: newEndDate.toISOString()
          });
          setUndoHistory(prev => [
            ...prev,
            {
              type: 'event_move',
              description: `Compromisso "${calendarEvent.title}" movido`,
              timestamp: Date.now(),
              edits: [
                {
                  collection: 'calendarEvents',
                  docId: draggedId,
                  oldValue: { start: calendarEvent.start, end: calendarEvent.end },
                  newValue: { start: newStartDate.toISOString(), end: newEndDate.toISOString() }
                }
              ]
            }
          ]);
          triggerNotification('Compromisso Movido', 'Modificado para ' + format(newStartDate, 'dd/MM'), 'info');
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/calendarEvents/${draggedId}`);
        }
        return;
      }

      const topic = topics.find(t => t.id === draggedId);
      if (topic) {
        try {
          const topicRef = doc(db, 'users', user.uid, 'topics', draggedId);
          let newDate = new Date(newDateStr + 'T12:00:00');
          
          // Preserva o horário anterior se já estava agendado
          if (topic.nextReviewDate) {
            const oldDate = parseISO(topic.nextReviewDate);
            newDate.setHours(oldDate.getHours());
            newDate.setMinutes(oldDate.getMinutes());
          }

          await updateDoc(topicRef, {
            nextReviewDate: newDate.toISOString()
          });
          setUndoHistory(prev => [
            ...prev,
            {
              type: 'topic_move',
              description: `Revisão de "${topic.name}" movida`,
              timestamp: Date.now(),
              edits: [
                {
                  collection: 'topics',
                  docId: draggedId,
                  oldValue: { nextReviewDate: topic.nextReviewDate || null },
                  newValue: { nextReviewDate: newDate.toISOString() }
                }
              ]
            }
          ]);
          triggerNotification('Revisão Priorizada', 'Revisão recalculada para ' + format(newDate, "dd/MM 'às' HH:mm"), 'success');
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/topics/${draggedId}`);
        }
      }
    }
  };

  const getOverdueTopics = () => {
    if (!topics) return [];
    return topics.filter(t => {
      if (t.completed || t.noMoreReviews || t.repetitions === 0 || !t.nextReviewDate) return false;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return new Date(t.nextReviewDate).getTime() < todayStart.getTime();
    });
  };
  const overdueTopics = getOverdueTopics();

  const getExOverdueTopics = () => {
    if (!topics) return [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return topics.filter(t => {
      if (t.completed || t.noMoreReviews || t.repetitions === 0 || !t.wasRescheduledOverdue) return false;
      const isOverdueNow = t.nextReviewDate && new Date(t.nextReviewDate).getTime() < todayStart.getTime();
      return !isOverdueNow;
    });
  };
  const exOverdueTopics = getExOverdueTopics();

  // Find the single absolute most critical review in the current display view to highlight (Enaltecer Globalmente)
  const getGlobalMostCriticalReview = () => {
    if (!topics || topics.length === 0) return null;
    const uncompleted = topics.filter(t => !t.completed && !t.noMoreReviews && t.repetitions > 0 && t.nextReviewDate);
    if (uncompleted.length === 0) return null;
    
    const now = new Date();
    const ranked = uncompleted.map(topic => {
      const index = calculateForgettingIndex(topic, now);
      return { topic, index };
    });
    
    ranked.sort((a, b) => b.index - a.index);
    return ranked[0].index > 0.05 ? ranked[0] : null; 
  };

  const globalCritical = getGlobalMostCriticalReview();
  const criticalSubject = globalCritical 
    ? subjects.find(s => s.id === globalCritical.topic.subjectId)
    : null;

  const activeEvent = activeId ? events.find(e => e.id === activeId) : null;
  const activeTopic = activeId ? topics.find(t => t.id === activeId) : null;

  return (
    <DndContext 
      sensors={sensors} 
      onDragStart={handleDragStart} 
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        
        {/* Memory Bottleneck Exaltation banner (Revisão Mais Importante Globalmente) */}
        {globalCritical && (
          <div className="bg-amber-50 border border-amber-250 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm rounded-none">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] tracking-wider uppercase font-bold text-amber-850 bg-amber-100 px-1.5 py-0.5 border border-amber-300">
                  Revisão Recomendada
                </span>
                <span className="text-[10px] text-amber-700 font-mono">
                  Índice de perda: {(globalCritical.index * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-neutral-700 font-serif">
                O tópico <strong className="font-semibold text-neutral-900">{globalCritical.topic.name}</strong> ({criticalSubject?.name || 'Geral'}) está se aproximando do limite de retenção.
              </p>
            </div>
            <button 
              onClick={() => {
                setEditingTopic(globalCritical.topic);
                setEditTopicData({
                  name: globalCritical.topic.name,
                  nextReviewDate: globalCritical.topic.nextReviewDate ? toLocalDatetimeString(globalCritical.topic.nextReviewDate) : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                  description: globalCritical.topic.description || '',
                  completed: globalCritical.topic.completed || false
                });
                setActiveTopicTab('log');
                setCalendarReviewMethod('perception');
                setCalendarReviewQuality(null);
                setCalendarQuestionsCount('');
                setCalendarCorrectCount('');
                setCalendarReviewTime(15);
                setCalendarNotes('');
                setCalendarReviewDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
                setShowTopicForm(true);
              }}
              className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 bg-[#141414] hover:bg-neutral-800 text-[#E4E3E0] font-mono text-[10px] uppercase font-bold py-2 px-4 transition-colors border border-[#141414]"
            >
              Revisar Agora
            </button>
          </div>
        )}

        {/* Custom Toast Banner */}
        {toastNotification.isOpen && (
          <div className="fixed top-5 right-5 z-50 max-w-sm w-full bg-white border border-[#141414] p-4 shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] transition-transform duration-300 transform translate-x-0 flex items-start gap-3 animate-slide-in">
            <div className={`p-1.5 rounded-none border border-[#141414] shrink-0 ${
              toastNotification.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-500' :
              toastNotification.type === 'error' ? 'bg-red-50 text-red-600 border-red-500' :
              'bg-blue-50 text-blue-600 border-blue-500'
            }`}>
              {toastNotification.type === 'success' ? <CheckCircle size={16} /> :
               toastNotification.type === 'error' ? <AlertTriangle size={16} /> :
               <Info size={16} />}
            </div>
            <div className="flex-1 space-y-0.5">
              <h4 className="font-serif font-bold text-xs text-[#141414] italic">{toastNotification.title}</h4>
              <p className="text-[10px] font-mono text-gray-500 leading-tight">{toastNotification.message}</p>
            </div>
            <button 
              onClick={() => setToastNotification(prev => ({ ...prev, isOpen: false }))}
              className="text-[#141414] hover:bg-gray-100 p-1 border border-transparent hover:border-[#141414]"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Custom Confirmation Modal */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-[#141414]/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-[#141414] p-6 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] animate-scale-up">
              <div className="flex items-center gap-2 text-amber-600 mb-3 font-serif italic text-lg font-bold">
                <AlertTriangle size={20} />
                <span>{confirmModal.title}</span>
              </div>
              <p className="text-xs font-mono text-gray-600 leading-relaxed mb-6">
                {confirmModal.message}
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 border border-[#141414] py-2.5 font-mono text-[10px] uppercase hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className={`flex-1 py-2.5 font-mono text-[10px] uppercase text-white ${
                    confirmModal.confirmStyle === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#141414] hover:bg-[#141414]/90'
                  }`}
                >
                  {confirmModal.confirmText || 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Reschedule Dialog with Slider */}
        {showRescheduleDialog && (
          <div className="fixed inset-0 bg-[#141414]/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-[#141414] p-5 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] animate-scale-up text-[#141414] overflow-y-auto max-h-[90vh]">
              <div className="flex items-center gap-2 text-[#141414] mb-3 font-serif italic text-lg font-bold">
                <RefreshCw size={18} className="text-amber-500 animate-spin-slow" />
                <span>Reorganização de Atrasados</span>
              </div>
              
              <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                Suas revisões atrasadas serão redistribuídas de forma equilibrada nos próximos dias, de forma que as <strong>mais esquecidas (maior risco de esquecimento) tenham prioridade máxima</strong> e apareçam primeiro no seu cronograma.
              </p>

              <div className="bg-indigo-50 border border-indigo-200 p-3 mb-4 space-y-1.5 rounded-none text-left">
                <p className="text-[10px] uppercase font-bold text-indigo-900 font-mono tracking-wider flex items-center gap-1">
                  <Brain size={12} className="text-indigo-650 animate-pulse" />
                  Conselho Científico de Retenção
                </p>
                <p className="text-[10px] text-indigo-950 leading-relaxed font-sans">
                  <strong>Prática Distribuída Estruturada (Rohrer et al., 2015):</strong> Dividir o volume acumulado em até 30 dias evita a sobrecarga cognitiva e reativa a indexação de traços de memória de longo prazo. Ao realizar essas revisões:
                </p>
                <ul className="text-[9.5px] text-indigo-900 list-disc list-inside space-y-1 font-sans leading-tight pl-1">
                  <li>Dedique de 15 a 20 minutos por tópico (foco micro-blocado).</li>
                  <li>Inicie pela autoavaliação (recordação ativa antes de reler a teoria).</li>
                  <li>Mantenha um intervalo de descanso saudável de 5 minutos entre temas para consolidar os neurônios.</li>
                </ul>
              </div>

              <div className="bg-emerald-50 border border-emerald-250 p-3 mb-4 space-y-1 rounded-none">
                <p className="text-[10px] uppercase font-bold text-emerald-850 font-mono tracking-wider">
                  ✓ Preservação garantida
                </p>
                <p className="text-[10px] text-emerald-800 leading-tight font-mono">
                  Seu cronograma atual e futuro permanecerá intacto. As revisões agendadas para hoje e dias posteriores não são modificadas.
                </p>
              </div>

              <div className="space-y-4 mb-5">
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono font-bold uppercase">
                    <span>Período de distribuição</span>
                    <span className="text-[#141414] bg-neutral-100 px-1 border border-neutral-200">
                      {rescheduleDays} {rescheduleDays === 1 ? 'dia' : 'dias'}
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="30" 
                    value={rescheduleDays}
                    onChange={(e) => setRescheduleDays(Number(e.target.value))}
                    className="w-full accent-[#141414] cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-gray-400">
                    <span>1 dia (Hoje)</span>
                    <span>15 dias</span>
                    <span>30 dias</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-neutral-50 border border-neutral-250 p-3 font-mono text-center">
                  <div>
                    <span className="text-[8px] uppercase text-gray-400 block">Total Vencido</span>
                    <span className="text-xs font-bold text-[#141414]">{overdueTopics.length}</span>
                  </div>
                  <div>
                    <span className="text-[8px] uppercase text-gray-400 block">Média por Dia</span>
                    <span className="text-xs font-bold text-[#10b981]">
                      ~{Math.ceil(overdueTopics.length / rescheduleDays)} / dia
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowRescheduleDialog(false)}
                  className="flex-1 border border-[#141414] py-2 font-mono text-[10px] uppercase hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeRescheduleOverdue}
                  className="flex-1 py-2 font-mono text-[10px] uppercase text-[#E4E3E0] bg-[#141414] hover:bg-[#141414]/90 cursor-pointer font-bold border border-[#141414]"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Header with Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-[#141414] p-4 gap-4 shadow-xs">
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <h2 className="font-serif italic text-xl sm:text-2xl capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <div className="flex gap-1">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-[#141414]/5 border border-[#141414]">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-[#141414]/5 border border-[#141414]">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-1.5 w-full sm:w-auto">
            <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
              <button 
                onClick={() => {
                  const nextVal = !showCronogramaEvents;
                  setShowCronogramaEvents(nextVal);
                  localStorage.setItem('medinternato_show_cronograma_calendar', String(nextVal));
                }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 border font-mono text-[9px] sm:text-[10px] uppercase font-bold transition-all cursor-pointer ${
                  showCronogramaEvents 
                    ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100' 
                    : 'bg-stone-100 text-stone-500 border-stone-300 hover:bg-stone-200'
                }`}
                title={showCronogramaEvents ? "Ocultar compromissos do Cronograma de Estudos" : "Exibir compromissos do Cronograma de Estudos"}
              >
                {showCronogramaEvents ? <Eye size={14} className="text-amber-700 shrink-0" /> : <EyeOff size={14} className="text-stone-400 shrink-0" />}
                <span>{showCronogramaEvents ? 'Cronograma Visível' : 'Cronograma Oculto'}</span>
              </button>

              <button 
                onClick={handleUndo}
                disabled={undoHistory.length === 0}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 border font-mono text-[9px] sm:text-[10px] uppercase font-bold transition-all cursor-pointer ${
                  undoHistory.length > 0
                    ? 'bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100 hover:border-indigo-400' 
                    : 'bg-stone-50 text-stone-300 border-stone-200 cursor-not-allowed opacity-60'
                }`}
                title={undoHistory.length > 0 ? `Desfazer última alteração: ${undoHistory[undoHistory.length - 1].description}` : "Nenhuma alteração para desfazer"}
              >
                <Undo2 size={14} className={undoHistory.length > 0 ? 'text-indigo-700 shrink-0' : 'text-stone-300 shrink-0'} />
                <span>Desfazer ({undoHistory.length})</span>
              </button>

              {hasGoogleConnection ? (
                <>
                  <button 
                    onClick={handleSync}
                    disabled={isSyncing || isCleaning}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 border border-[#141414] font-mono text-[9px] sm:text-[10px] uppercase hover:bg-[#141414]/5 ${(isSyncing || isCleaning) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                  </button>
                  <button 
                    onClick={() => triggerConfirm(
                      'Desfazer Sincronização?', 
                      'Deseja realmente desativar o Google Calendar? Todos os compromissos externos importados via API serão excluídos automaticamente do seu cronograma de estudos.',
                      handleClearSync,
                      'danger',
                      'Desfazer Sincronização'
                    )}
                    disabled={isCleaning || isSyncing}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-50 text-red-600 border border-red-200 px-3 sm:px-4 py-2 font-mono text-[9px] sm:text-[10px] uppercase hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 size={14} className={isCleaning ? 'animate-pulse' : ''} />
                    {isCleaning ? 'Limpando...' : 'Desfazer Sincronização'}
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 border border-dashed border-[#141414] text-[#141414] font-mono text-[9px] sm:text-[10px] uppercase hover:bg-[#141414]/5 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? 'Conectando...' : 'Conectar Google Calendar'}
                </button>
              )}
              {overdueTopics.length > 0 && (
                <button 
                  onClick={handleRescheduleOverdue}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 border border-amber-600 text-[#141414] px-3 sm:px-4 py-2 font-mono text-[9px] sm:text-[10px] uppercase font-bold cursor-pointer"
                >
                  <RefreshCw size={14} className="animate-pulse" />
                  Recalcular Atrasados ({overdueTopics.length})
                </button>
              )}
              <button 
                onClick={() => {
                  const now = new Date();
                  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
                  setEditingEvent(null);
                  setNewEvent({
                    title: '',
                    start: format(now, "yyyy-MM-dd'T'HH:mm"),
                    end: format(oneHourLater, "yyyy-MM-dd'T'HH:mm"),
                    description: '',
                    completed: false,
                    subjectId: '',
                    topicId: '',
                    newTopicName: ''
                  });
                  setShowEventForm(true);
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#141414] text-[#E4E3E0] dark:bg-[#E4E3E0] dark:text-[#141414] px-3 sm:px-4 py-2 font-mono text-[9px] sm:text-[10px] uppercase hover:bg-[#141414]/90 dark:hover:bg-[#E4E3E0]/90 cursor-pointer"
              >
                <Plus size={14} />
                Novo
              </button>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[8px] sm:text-[9px] text-stone-500 uppercase tracking-tight">
              <span className="font-bold text-indigo-600 bg-indigo-50 px-1 border border-indigo-200 rounded-sm">Desfazer (Ctrl+Z)</span>
              <span>Reverte retroativamente movimentos e reagendamentos de revisões do calendário</span>
            </div>
          </div>
        </div>

        {/* Legend & Status Indicators */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#F8F9FA] border-r border-l border-[#141414] p-3 text-xs font-mono">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[9px] uppercase font-bold text-gray-500">Legenda:</span>
            
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
              <span className="text-[9px] text-[#141414]">Em Dia</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="text-[9px] text-[#141414]">Atenção</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-[9px] text-[#141414]">Urgente</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-[9px] text-[#141414]">Crítico</span>
            </div>

            {overdueTopics.length > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 px-1.5 py-0.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-550"></span>
                <span className="text-[9px] font-bold text-amber-950">Atrasado ({overdueTopics.length})</span>
              </div>
            )}

            {exOverdueTopics.length > 0 && (
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                <span className="text-[9px] font-bold text-indigo-950">Ex-Atrasado ({exOverdueTopics.length}) ⏱️</span>
              </div>
            )}
          </div>

          {exOverdueTopics.length > 0 && (
            <div className="text-[8px] sm:text-[9px] text-indigo-900 bg-indigo-50/60 px-2 py-0.5 border border-dashed border-indigo-250 italic">
              ⏱️ {exOverdueTopics.length} ex-atrasados em progresso. Eles retornarão ao fluxo normal assim que estudados!
            </div>
          )}
        </div>

        {/* Sophisticated Calendar Grid */}
        <div className="overflow-x-auto border-l border-t border-[#141414] bg-white shadow-xs">
          <div className="min-w-[700px] grid grid-cols-7">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="p-2 sm:p-4 border-r border-b border-[#141414] bg-[#141414]/5 text-center font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">
                {day}
              </div>
            ))}
            {calendarDays.map((day, i) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayEvents = displayedEvents.filter(e => isSameDay(parseISO(e.start), day));
              const dayReviews = topics.filter(t => {
                if (t.noMoreReviews || t.repetitions === 0) return false;
                return t.nextReviewDate && isSameDay(parseISO(t.nextReviewDate), day);
              });
              
              return (
                <CalendarDay 
                  key={`cal-day-${dateKey}-${i}`}
                  day={day}
                  dateKey={dateKey}
                  monthStart={monthStart}
                  dayEvents={dayEvents}
                  dayReviews={dayReviews}
                  subjects={subjects}
                  onToggleEventComplete={handleToggleEventCompleted}
                  onEditEvent={(e) => {
                    setEditingEvent(e);
                    setNewEvent({
                      title: e.title,
                      start: toLocalDatetimeString(e.start),
                      end: toLocalDatetimeString(e.end),
                      description: e.description || '',
                      completed: e.completed || false,
                      subjectId: e.subjectId || '',
                      topicId: e.topicId || '',
                      newTopicName: ''
                    });
                    setShowEventForm(true);
                  }}
                  onEditReview={(t) => {
                    setEditingTopic(t);
                    setEditTopicData({
                      name: t.name,
                      nextReviewDate: t.nextReviewDate ? toLocalDatetimeString(t.nextReviewDate) : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                      description: t.description || '',
                      completed: t.completed || false
                    });
                    setActiveTopicTab('log');
                    setCalendarReviewMethod('perception');
                    setCalendarReviewQuality(null);
                    setCalendarQuestionsCount('');
                    setCalendarCorrectCount('');
                    setCalendarReviewTime(15);
                    setCalendarNotes('');
                    setCalendarReviewDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
                    setShowTopicForm(true);
                  }}
                  onClickDay={handleAddEventForDay}
                />
              );
            })}
          </div>
        </div>

        {/* Event Form Modal */}
        {showEventForm && (
          <div className="fixed inset-0 bg-[#141414]/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-[#141414] p-6 sm:p-7 max-w-sm sm:max-w-md w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] animate-scale-up text-[#141414]">
              <div className="flex justify-between items-center mb-5 border-b pb-3 border-[#141414]/15">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-[#141414]" />
                  <h3 className="font-serif italic text-xl font-bold">
                    {editingEvent ? 'Editar Compromisso' : 'Novo Compromisso'}
                  </h3>
                </div>
                {editingEvent && (
                  <button 
                    onClick={() => deleteEvent(editingEvent.id)}
                    title="Excluir compromisso"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 border border-red-200 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              
              <div className="space-y-4">
                {/* Study Presets */}
                <div>
                  <label className="block text-[9px] font-mono uppercase tracking-wider text-neutral-500 mb-1.5 font-bold">Presets de Estudo</label>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {[
                      { label: '📖 Teoria', prefix: '📖 [TEORIA] ', duration: 60 },
                      { label: '✍️ Questões', prefix: '✍️ [QUESTÕES] ', duration: 40 },
                      { label: '🔄 Revisão', prefix: '🔄 [REVISÃO] ', duration: 30 },
                      { label: '🎥 Vídeo-aula', prefix: '🎥 [AULA] ', duration: 90 },
                      { label: '📝 Simulado', prefix: '📝 [SIMULADO] ', duration: 120 },
                    ].map((preset, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          let cleanTitle = newEvent.title;
                          const prefixes = ['📖 [TEORIA] ', '✍️ [QUESTÕES] ', '🔄 [REVISÃO] ', '🎥 [AULA] ', '📝 [SIMULADO] '];
                          prefixes.forEach(p => {
                            if (cleanTitle.startsWith(p)) {
                              cleanTitle = cleanTitle.substring(p.length);
                            }
                          });
                          
                          const updatedTitle = preset.prefix + cleanTitle;
                          let updatedEnd = newEvent.end;
                          if (newEvent.start) {
                            try {
                              const startDateObj = new Date(newEvent.start);
                              const endDateObj = new Date(startDateObj.getTime() + preset.duration * 60 * 1000);
                              updatedEnd = format(endDateObj, "yyyy-MM-dd'T'HH:mm");
                            } catch (e) {}
                          }
                          
                          setNewEvent({
                            ...newEvent,
                            title: updatedTitle,
                            end: updatedEnd
                          });
                        }}
                        className="px-1.5 py-0.5 font-mono text-[8px] sm:text-[9px] border border-neutral-300 hover:border-[#141414] bg-neutral-50 hover:bg-neutral-100 transition-all cursor-pointer text-neutral-700"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">Título do Compromisso</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Aula de Anatomia, Prova de Cálculo..."
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                    className="w-full p-2.5 border border-[#141414] font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#141414] bg-neutral-50/50"
                  />
                </div>

                {/* Linked Subject & Topic */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">Matéria Relacionada</label>
                    <select
                      value={newEvent.subjectId}
                      onChange={(e) => {
                        const selectedSubId = e.target.value;
                        setNewEvent({
                          ...newEvent,
                          subjectId: selectedSubId,
                          topicId: ''
                        });
                      }}
                      className="w-full p-2 border border-[#141414] font-mono text-[11px] focus:outline-none bg-neutral-50/50"
                    >
                      <option value="">-- Nenhuma --</option>
                      {subjects?.map(sub => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">Tópico de Estudo</label>
                    <select
                      value={newEvent.topicId}
                      onChange={(e) => {
                        const selectedTopicId = e.target.value;
                        const selectedTopic = topics?.find(t => t.id === selectedTopicId);
                        
                        let updatedTitle = newEvent.title;
                        let hasPrefix = false;
                        const prefixes = ['📖 [TEORIA] ', '✍️ [QUESTÕES] ', '🔄 [REVISÃO] ', '🎥 [AULA] ', '📝 [SIMULADO] '];
                        let foundPrefix = '';
                        prefixes.forEach(p => {
                          if (updatedTitle.startsWith(p)) {
                            hasPrefix = true;
                            foundPrefix = p;
                          }
                        });
                        
                        if (selectedTopic) {
                          if (!updatedTitle || updatedTitle.trim() === '' || hasPrefix) {
                            updatedTitle = foundPrefix + selectedTopic.name;
                          }
                        }
                        
                        setNewEvent({
                          ...newEvent,
                          topicId: selectedTopicId,
                          title: updatedTitle
                        });
                      }}
                      disabled={!newEvent.subjectId}
                      className="w-full p-2 border border-[#141414] font-mono text-[11px] focus:outline-none bg-neutral-50/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Nenhum (Auto-criar por Título) --</option>
                      {topics
                        ?.filter(t => t.subjectId === newEvent.subjectId)
                        .map(topic => (
                          <option key={topic.id} value={topic.id}>
                            {topic.name}
                          </option>
                        ))}
                      <option value="NEW_TOPIC">+ Criar Novo Tópico...</option>
                    </select>
                  </div>
                </div>

                {/* Real-time automatic creation and linking feedback */}
                {newEvent.subjectId && (
                  <div className="space-y-2">
                    {newEvent.topicId === 'NEW_TOPIC' && (
                      <div className="animate-fade-in">
                        <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">Nome do Novo Tópico</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Teorema de Pitágoras, Crase..."
                          value={(newEvent as any).newTopicName || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            let updatedTitle = newEvent.title;
                            let hasPrefix = false;
                            const prefixes = ['📖 [TEORIA] ', '✍️ [QUESTÕES] ', '🔄 [REVISÃO] ', '🎥 [AULA] ', '📝 [SIMULADO] '];
                            let foundPrefix = '';
                            prefixes.forEach(p => {
                              if (updatedTitle.startsWith(p)) {
                                hasPrefix = true;
                                foundPrefix = p;
                              }
                            });

                            if (!updatedTitle || updatedTitle.trim() === '' || hasPrefix) {
                              updatedTitle = foundPrefix + val;
                            }

                            setNewEvent({
                              ...newEvent,
                              newTopicName: val,
                              title: updatedTitle
                            } as any);
                          }}
                          className="w-full p-2 border border-[#141414] font-mono text-[11px] focus:outline-none bg-neutral-50/50"
                        />
                      </div>
                    )}

                    <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 p-2.5 border border-dashed border-emerald-300 flex items-center gap-1.5 animate-fade-in">
                      <Sparkles size={12} className="shrink-0 text-emerald-600" />
                      <span>
                        {(() => {
                          const cleanTitle = getCleanedTitle(
                            newEvent.topicId === 'NEW_TOPIC' 
                              ? ((newEvent as any).newTopicName || '') 
                              : newEvent.title
                          );

                          if (!cleanTitle) {
                            return "Insira o título do compromisso ou nome do tópico para criar/vincular automaticamente.";
                          }

                          const existingTopic = topics?.find(
                            t => t.subjectId === newEvent.subjectId && t.name.toLowerCase() === cleanTitle.toLowerCase()
                          );

                          if (newEvent.topicId && newEvent.topicId !== 'NEW_TOPIC') {
                            return `Vinculado ao tópico existente: "${topics?.find(t => t.id === newEvent.topicId)?.name}"`;
                          }

                          if (existingTopic) {
                            return `Tópico encontrado: "${existingTopic.name}". Será vinculado automaticamente ao salvar!`;
                          }

                          return `Um novo tópico "${cleanTitle}" será criado e vinculado automaticamente ao salvar!`;
                        })()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Styled Toggle for Event Status */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500">Status do Compromisso</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewEvent({...newEvent, completed: false})}
                      className={`py-1.5 px-3 font-mono text-[9px] uppercase border transition-all flex items-center justify-center gap-1 ${
                        !newEvent.completed 
                          ? 'bg-[#141414] text-white border-[#141414] font-bold shadow-xs' 
                          : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      Pendente ⏳
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewEvent({...newEvent, completed: true})}
                      className={`py-1.5 px-3 font-mono text-[9px] uppercase border transition-all flex items-center justify-center gap-1 ${
                        newEvent.completed 
                          ? 'bg-emerald-600 text-white border-emerald-700 font-bold shadow-xs' 
                          : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      Concluído ✓
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1 font-bold font-mono">Horário de Início</label>
                    <input 
                      type="datetime-local" 
                      value={newEvent.start}
                      onChange={(e) => setNewEvent({...newEvent, start: e.target.value})}
                      className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none bg-neutral-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1 font-bold font-mono">Horário de Fim</label>
                    <input 
                      type="datetime-local" 
                      value={newEvent.end}
                      onChange={(e) => setNewEvent({...newEvent, end: e.target.value})}
                      className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none bg-neutral-50/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">Notas / Descrição</label>
                  <textarea 
                    placeholder="Adicione observações, links ou detalhes adicionais..."
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                    className="w-full p-2.5 border border-[#141414] font-mono text-xs focus:outline-none h-20 resize-none bg-neutral-50/50"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => { setShowEventForm(false); setEditingEvent(null); }}
                  className="flex-1 border border-[#141414] py-2 font-mono text-[10px] uppercase hover:bg-gray-50 cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button 
                  onClick={addEvent}
                  className="flex-1 bg-[#141414] text-[#E4E3E0] py-2 font-mono text-[10px] uppercase hover:bg-[#141414]/90 cursor-pointer text-center font-bold"
                >
                  {editingEvent ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Topic Form Modal */}
        {showTopicForm && (
          <div className="fixed inset-0 bg-[#141414]/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-[#141414] p-6 sm:p-7 max-w-sm sm:max-w-md w-full shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] animate-scale-up text-[#141414]">
              <div className="flex justify-between items-center mb-4 border-b pb-3 border-[#141414]/15">
                <div className="flex items-center gap-2">
                  <BookOpen size={18} className="text-[#141414]" />
                  <h3 className="font-serif italic text-xl font-bold">Revisão (SRS)</h3>
                </div>
                <button 
                  onClick={() => { setShowTopicForm(false); setEditingTopic(null); }}
                  className="p-1 hover:bg-neutral-100 border border-neutral-300 transition-all cursor-pointer text-neutral-600"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Colorful Context badge summary */}
              {editingTopic && (
                <div className="flex flex-wrap gap-2 mb-4 bg-neutral-50 border border-neutral-200 p-2.5">
                  {subjects.find(s => s.id === editingTopic.subjectId) && (
                    <span 
                      className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 border"
                      style={{ 
                        borderColor: subjects.find(s => s.id === editingTopic.subjectId)?.color, 
                        color: subjects.find(s => s.id === editingTopic.subjectId)?.color, 
                        backgroundColor: `${subjects.find(s => s.id === editingTopic.subjectId)?.color}08` 
                      }}
                    >
                      {subjects.find(s => s.id === editingTopic.subjectId)?.name}
                    </span>
                  )}
                  <span className="text-[8px] font-mono bg-neutral-100 text-neutral-600 px-1.5 py-0.5 border border-neutral-200 uppercase font-semibold">
                    Risco: {(calculateForgettingIndex(editingTopic, new Date()) * 100).toFixed(0)}%
                  </span>
                  {(() => {
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const isOverdueNow = editingTopic.nextReviewDate && new Date(editingTopic.nextReviewDate).getTime() < todayStart.getTime();
                    if (isOverdueNow) {
                      return (
                        <span className="text-[8px] font-mono bg-amber-50 border border-amber-300 text-amber-850 px-1.5 py-0.5 font-bold uppercase tracking-wider animate-pulse">
                          Atrasado ⏳
                        </span>
                      );
                    }
                    if (editingTopic.wasRescheduledOverdue) {
                      return (
                        <span className="text-[8px] font-mono bg-indigo-50 border border-indigo-200 text-indigo-700 px-1.5 py-0.5 font-bold uppercase tracking-wider animate-pulse">
                          Ex-Atrasado ⏱️
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              {/* Elegant Tab Selection */}
              <div className="flex border-2 border-[#141414] mb-4">
                <button
                  type="button"
                  onClick={() => setActiveTopicTab('log')}
                  className={`flex-1 py-1.5 font-mono text-[9px] uppercase font-bold text-center cursor-pointer transition-all border-r-2 border-[#141414] ${
                    activeTopicTab === 'log'
                      ? "bg-[#141414] text-white border-[#141414]"
                      : "bg-white text-neutral-700 hover:bg-neutral-50 border-transparent"
                  }`}
                >
                  📝 Registrar Revisão
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTopicTab('edit')}
                  className={`flex-1 py-1.5 font-mono text-[9px] uppercase font-bold text-center cursor-pointer transition-all ${
                    activeTopicTab === 'edit'
                      ? "bg-[#141414] text-white"
                      : "bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  ⚙️ Configurações
                </button>
              </div>

              {activeTopicTab === 'log' ? (
                /* Dynamic Review Logging Form inside Balloon */
                <div className="space-y-4">
                  {/* Select Method */}
                  <div className="flex border border-[#141414]">
                    <button
                      type="button"
                      onClick={() => setCalendarReviewMethod('perception')}
                      className={`flex-1 py-1 font-mono text-[8px] uppercase font-bold text-center cursor-pointer transition-all border-r border-[#141414] ${
                        calendarReviewMethod === 'perception'
                          ? "bg-[#141414] text-white"
                          : "bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      🧠 Autopercepção
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarReviewMethod('questions')}
                      className={`flex-1 py-1 font-mono text-[8px] uppercase font-bold text-center cursor-pointer transition-all ${
                        calendarReviewMethod === 'questions'
                          ? "bg-[#141414] text-white"
                          : "bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      📝 Questões
                    </button>
                  </div>

                  {calendarReviewMethod === 'perception' ? (
                    <div>
                      <label className="block text-[9px] font-mono uppercase mb-1.5 text-neutral-500 font-bold tracking-wider">Como foi o esforço de lembrança?</label>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { value: 0, label: "0 • Apagão" },
                          { value: 1, label: "1 • Vago" },
                          { value: 2, label: "2 • Superfi." },
                          { value: 3, label: "3 • Esforço" },
                          { value: 4, label: "4 • Sólido" },
                          { value: 5, label: "5 • Perfeito" }
                        ].map((lvl) => (
                          <button
                            key={lvl.value}
                            type="button"
                            onClick={() => setCalendarReviewQuality(lvl.value)}
                            className={`p-1.5 border text-center font-mono text-[8.5px] transition-all cursor-pointer ${
                              calendarReviewQuality === lvl.value 
                                ? "bg-indigo-900 text-white border-indigo-950 font-bold shadow-xs" 
                                : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50"
                            }`}
                          >
                            {lvl.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 p-2 bg-amber-50/50 border border-amber-250">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-mono uppercase mb-1 text-neutral-700 font-bold">Questões</label>
                          <input 
                            type="text" 
                            value={calendarQuestionsCount}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setCalendarQuestionsCount('');
                              } else {
                                const parsed = parseInt(val);
                                setCalendarQuestionsCount(isNaN(parsed) || parsed < 0 ? '' : parsed);
                              }
                            }}
                            placeholder="Ex: 10"
                            className="w-full p-1.5 border border-[#141414] font-mono text-xs focus:outline-none focus:bg-white bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-mono uppercase mb-1 text-neutral-700 font-bold">Acertos</label>
                          <input 
                            type="text" 
                            value={calendarCorrectCount}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setCalendarCorrectCount('');
                              } else {
                                const parsed = parseInt(val);
                                setCalendarCorrectCount(isNaN(parsed) || parsed < 0 ? '' : parsed);
                              }
                            }}
                            placeholder="Ex: 8"
                            className="w-full p-1.5 border border-[#141414] font-mono text-xs focus:outline-none focus:bg-white bg-white"
                          />
                        </div>
                      </div>
                      {Number(calendarQuestionsCount) > 0 && (
                        <div className="text-[9px] font-mono text-neutral-600 bg-white border border-dashed border-[#141414]/20 p-1.5">
                          Aproveitamento: <strong className="text-[#141414]">{Math.round((Number(calendarCorrectCount || 0) / Number(calendarQuestionsCount)) * 100)}%</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Date, Time and Notes */}
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[9px] font-mono uppercase text-neutral-500 font-bold">Data da Revisão</label>
                      <input 
                        type="datetime-local" 
                        value={calendarReviewDate}
                        onChange={(e) => setCalendarReviewDate(e.target.value)}
                        className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none bg-neutral-50/50"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-mono uppercase text-neutral-500 font-bold">Tempo (min)</label>
                        <input 
                          type="text" 
                          value={calendarReviewTime}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setCalendarReviewTime('');
                            } else {
                              const parsed = parseInt(val);
                              setCalendarReviewTime(isNaN(parsed) ? '' : parsed);
                            }
                          }}
                          className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none bg-neutral-50/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono uppercase text-neutral-500 font-bold">Comentários</label>
                        <input 
                          type="text" 
                          value={calendarNotes}
                          onChange={(e) => setCalendarNotes(e.target.value)}
                          placeholder="Ex: Ponto crítico"
                          className="w-full p-2 border border-[#141414] font-mono text-xs focus:outline-none bg-neutral-50/50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button 
                      onClick={() => { setShowTopicForm(false); setEditingTopic(null); }}
                      className="flex-1 border border-[#141414] py-2 font-mono text-[10px] uppercase hover:bg-gray-50 cursor-pointer text-center"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={submitCalendarReview}
                      disabled={
                        calendarReviewMethod === 'perception'
                          ? calendarReviewQuality === null
                          : (!calendarQuestionsCount || Number(calendarQuestionsCount) <= 0 || calendarCorrectCount === '' || Number(calendarCorrectCount) > Number(calendarQuestionsCount))
                      }
                      className={`flex-1 py-2 font-mono text-[10px] uppercase cursor-pointer text-center font-bold text-white transition-opacity ${
                        (calendarReviewMethod === 'perception' ? calendarReviewQuality === null : (!calendarQuestionsCount || Number(calendarQuestionsCount) <= 0 || calendarCorrectCount === '' || Number(calendarCorrectCount) > Number(calendarQuestionsCount)))
                          ? 'bg-neutral-300 cursor-not-allowed opacity-50 text-neutral-500 border-neutral-300'
                          : 'bg-indigo-700 hover:bg-indigo-800 border-indigo-700'
                      }`}
                    >
                      Gravar Revisão
                    </button>
                  </div>
                </div>
              ) : (
                /* Original Editing Form */
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">Nome do Tópico</label>
                    <input 
                      type="text" 
                      value={editTopicData.name}
                      onChange={(e) => setEditTopicData({...editTopicData, name: e.target.value})}
                      className="w-full p-2.5 border border-[#141414] font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#141414] bg-neutral-50/50"
                    />
                  </div>

                  {/* Styled Segmented toggle for topic completion */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500">Status do Tópico</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditTopicData({...editTopicData, completed: false})}
                        className={`py-1.5 px-3 font-mono text-[9px] uppercase border transition-all flex items-center justify-center gap-1 ${
                          !editTopicData.completed 
                            ? 'bg-[#141414] text-white border-[#141414] font-bold shadow-xs' 
                            : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        Revisão Pendente 📚
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditTopicData({...editTopicData, completed: true})}
                        className={`py-1.5 px-3 font-mono text-[9px] uppercase border transition-all flex items-center justify-center gap-1 ${
                          editTopicData.completed 
                            ? 'bg-emerald-600 text-white border-emerald-700 font-bold shadow-xs' 
                            : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        Concluído hoje ✓
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1 font-bold font-mono">Data Agendada</label>
                    <input 
                      type="datetime-local" 
                      value={editTopicData.nextReviewDate}
                      onChange={(e) => setEditTopicData({...editTopicData, nextReviewDate: e.target.value})}
                      className="w-full p-2.5 border border-[#141414] font-mono text-xs focus:outline-none bg-neutral-50/50"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-1">Anotações da Matéria</label>
                    <textarea 
                      placeholder="Principais fórmulas, dicas, lembretes ou pontos críticos para revisar..."
                      value={editTopicData.description}
                      onChange={(e) => setEditTopicData({...editTopicData, description: e.target.value})}
                      className="w-full p-2.5 border border-[#141414] font-mono text-xs focus:outline-none h-20 resize-none bg-neutral-50/50"
                    />
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button 
                      onClick={() => { setShowTopicForm(false); setEditingTopic(null); }}
                      className="flex-1 border border-[#141414] py-2 font-mono text-[10px] uppercase hover:bg-gray-50 cursor-pointer text-center"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={updateTopic}
                      className="flex-1 bg-[#141414] text-[#E4E3E0] py-2 font-mono text-[10px] uppercase hover:bg-[#141414]/90 cursor-pointer text-center font-bold"
                    >
                      Atualizar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <DragOverlay>
          {activeEvent ? (
            <div className="text-[9px] font-mono p-1 bg-[#141414] text-[#E4E3E0] truncate border border-[#141414] w-32 opacity-80">
              {activeEvent.title}
            </div>
          ) : activeTopic ? (
            <div className="text-[9px] font-mono p-1 border border-[#141414] text-[#141414] truncate italic bg-white w-32 opacity-80">
              REVISÃO: {activeTopic.name}
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

function CalendarDay({ 
  day, 
  dateKey, 
  monthStart, 
  dayEvents, 
  dayReviews, 
  subjects,
  onEditEvent, 
  onEditReview,
  onClickDay,
  onToggleEventComplete
}: { 
  day: Date, 
  dateKey: string, 
  monthStart: Date, 
  dayEvents: CalendarEvent[], 
  dayReviews: Topic[], 
  subjects: Subject[],
  onEditEvent: (e: CalendarEvent) => void, 
  onEditReview: (t: Topic) => void,
  onClickDay: (d: Date) => void,
  onToggleEventComplete?: (e: CalendarEvent) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dateKey,
  });

  // Calculate Forgetting Index for each review scheduled on this day
  const reviewsWithScores = dayReviews.map(topic => {
    const isCompletedOnDay = !!(topic.lastReviewDate && isSameDay(parseISO(topic.lastReviewDate), day) && (!topic.nextReviewDate || !isSameDay(parseISO(topic.nextReviewDate), day)));
    const score = calculateForgettingIndex(topic, day);
    return { topic, score, isCompletedOnDay };
  });

  // Sort reviews by highest risk first
  reviewsWithScores.sort((a, b) => b.score - a.score);

  // Custom sort events chronologically
  const sortedEvents = [...dayEvents].sort((a, b) => {
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });

  return (
    <div 
      ref={setNodeRef}
      onClick={() => isSameMonth(day, monthStart) && onClickDay(day)}
      className={cn(
        "min-h-[140px] p-2 border-r border-b border-[#141414] transition-colors flex flex-col justify-between group cursor-pointer",
        !isSameMonth(day, monthStart) ? "bg-[#141414]/5 opacity-[0.25]" : "bg-white hover:bg-neutral-50/40",
        isToday(day) && "bg-amber-50/25 relative overflow-hidden",
        isOver && "bg-[#141414]/10"
      )}
    >
      <div>
        <div className="flex justify-between items-start mb-2">
          <span className={cn(
            "text-[9px] font-mono font-bold tracking-wider rounded-none px-1 py-0.5",
            isToday(day) 
              ? "bg-[#141414] text-white font-extrabold" 
              : "text-gray-500"
          )}>
            {format(day, 'd')}
            {isToday(day) && ' (HOJE)'}
          </span>
          {isSameMonth(day, monthStart) && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onClickDay(day);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 border border-dashed border-[#141414]/30 hover:border-[#141414] hover:bg-[#141414]/5 text-[#141414] cursor-pointer"
              title="Adicionar compromisso de estudo"
            >
              <Plus size={10} />
            </button>
          )}
        </div>
        
        <div className="space-y-1 font-mono text-[9px] leading-tight">
          {/* Reviews list */}
          {reviewsWithScores.map(({ topic, score, isCompletedOnDay }, rIdx) => (
            <DraggableReview 
              key={`review-${topic.id}-${score}-${rIdx}`} 
              topic={topic} 
              onEdit={() => onEditReview(topic)} 
              forgettingScore={score}
              isCompletedOnSpecDay={isCompletedOnDay}
            />
          ))}
          
          {/* Events list */}
          {sortedEvents.map((event, eIdx) => {
            const eventSubject = subjects?.find(s => s.id === event.subjectId);
            return (
              <DraggableEvent 
                key={`event-${event.id}-${eIdx}`} 
                event={event} 
                subjectColor={eventSubject?.color}
                onEdit={() => onEditEvent(event)} 
                onToggleComplete={onToggleEventComplete}
              />
            );
          })}
        </div>
      </div>
      
      {isSameMonth(day, monthStart) && dayEvents.length === 0 && dayReviews.length === 0 && (
        <span className="text-[8px] font-mono text-gray-300 italic select-none">Sem tarefas</span>
      )}
    </div>
  );
}

function DraggableEvent({ 
  event, 
  subjectColor, 
  onEdit,
  onToggleComplete 
}: { 
  event: CalendarEvent, 
  subjectColor?: string, 
  onEdit: () => void,
  onToggleComplete?: (e: CalendarEvent) => void 
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const displayColor = (event as any).color || subjectColor;

  const combinedStyle = {
    ...style,
    ...(displayColor ? { borderLeft: `3px solid ${displayColor}` } : {})
  };

  let timeString = '';
  try {
    if (event.start) {
      const d = parseISO(event.start);
      timeString = format(d, 'HH:mm');
    }
  } catch (err) {}

  return (
    <div 
      ref={setNodeRef}
      style={combinedStyle}
      {...attributes}
      className={cn(
        "group/ev relative text-[9px] font-mono py-1 pr-1.5 pl-5 bg-[#f8fafc] text-slate-800 hover:bg-slate-100 transition-all border border-slate-200 cursor-pointer select-none touch-none",
        isDragging && "opacity-0",
        event.completed && "opacity-45 line-through bg-emerald-50/30 text-slate-500",
        displayColor && "pl-2.5"
      )}
    >
      <div 
        {...listeners} 
        className="absolute left-0 top-0 bottom-0 w-4 bg-slate-100 group-hover/ev:bg-slate-200/50 transition-colors flex items-center justify-center cursor-grab active:cursor-grabbing border-r border-slate-200"
      >
        <GripVertical size={9} className="text-slate-400" />
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete?.(event);
          }}
          className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
            event.completed 
              ? 'bg-emerald-600 border-emerald-600 text-white' 
              : 'border-slate-300 hover:border-emerald-500 bg-white'
          }`}
          title={event.completed ? "Desmarcar como concluído no Cronograma e Calendário" : "Marcar como concluído no Cronograma e Calendário"}
        >
          {event.completed && <Check size={8} strokeWidth={3} />}
        </button>
        <div onClick={(e) => { e.stopPropagation(); onEdit(); }} className="truncate flex-1 select-none hover:underline">
          <span className="truncate flex-1 font-semibold">{event.title}</span>
        </div>
      </div>
    </div>
  );
}

function DraggableReview({ 
  topic, 
  onEdit, 
  forgettingScore,
  isCompletedOnSpecDay
}: { 
  topic: Topic, 
  onEdit: () => void,
  forgettingScore?: number,
  isCompletedOnSpecDay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: topic.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  let timeString = '12:00';
  try {
    if (topic.nextReviewDate) {
      const d = parseISO(topic.nextReviewDate);
      timeString = format(d, 'HH:mm');
    }
  } catch (err) {}

  const score = forgettingScore || 0;
  const isHighRisk = score >= 0.75;

  let isOverdue = false;
  if (!(topic.completed || isCompletedOnSpecDay) && topic.nextReviewDate) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    isOverdue = new Date(topic.nextReviewDate).getTime() < todayStart.getTime();
  }

  const getScoreStyles = () => {
    if (topic.completed || isCompletedOnSpecDay) {
      return "bg-neutral-50 border-neutral-200 text-neutral-400 line-through";
    }
    if (isOverdue) {
      return "bg-amber-50/70 border-amber-300 hover:bg-amber-100/65 text-amber-950 shadow-xs";
    }
    if (topic.wasRescheduledOverdue) {
      return "bg-indigo-50/90 border-indigo-200 hover:bg-indigo-100/60 text-indigo-950 shadow-xs border-dashed";
    }
    if (score >= 0.85) {
      return "bg-red-50/85 border-red-200 hover:bg-red-100/60 text-red-950";
    }
    if (score >= 0.60) {
      return "bg-amber-50/85 border-amber-250 hover:bg-amber-100/60 text-amber-950";
    }
    if (score >= 0.35) {
      return "bg-stone-50/90 border-stone-200 hover:bg-stone-100/60 text-stone-850";
    }
    return "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50/50 shadow-[1px_1px_0px_0px_rgba(0,0,0,0.01)]";
  };

  const getDotColor = () => {
    if (topic.completed || isCompletedOnSpecDay) return "bg-neutral-300";
    if (isOverdue) return "bg-amber-500 animate-pulse";
    if (topic.wasRescheduledOverdue) return "bg-indigo-500";
    if (score >= 0.85) return "bg-red-500 animate-pulse";
    if (score >= 0.60) return "bg-amber-500";
    if (score >= 0.35) return "bg-amber-400";
    return "bg-[#10b981]";
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "group relative text-[9px] font-mono py-1 pr-1.5 pl-5 border transition-all cursor-pointer select-none touch-none",
        isDragging && "opacity-0",
        getScoreStyles()
      )}
    >
      <div 
        {...listeners} 
        className="absolute left-0 top-0 bottom-0 w-4.5 bg-neutral-50/50 group-hover:bg-neutral-100/80 transition-colors flex items-center justify-center cursor-grab active:cursor-grabbing border-r border-neutral-200 text-neutral-400"
      >
        <GripVertical size={10} />
      </div>

      <div onClick={(e) => { e.stopPropagation(); onEdit(); }} className="w-full space-y-0.5">
        <div className="flex items-center gap-1 select-none flex-wrap">
          {!(topic.completed || isCompletedOnSpecDay) && (
            <>
              {isOverdue && (
                <span className="bg-amber-500 text-white border border-amber-600 text-[7px] px-0.5 shrink-0 font-bold uppercase tracking-wider">
                  Atrasado ⏳
                </span>
              )}
              {topic.wasRescheduledOverdue && !isOverdue && (
                <span className="bg-indigo-600 text-white border border-indigo-700 text-[7px] px-0.5 shrink-0 font-bold uppercase tracking-wider">
                  Ex-Atrasado ⏱️
                </span>
              )}
              {score >= 0.85 && !topic.wasRescheduledOverdue ? (
                <span className="bg-red-100 text-red-800 border border-red-200 text-[7px] px-0.5 shrink-0 font-bold uppercase tracking-wider">
                  Crítico
                </span>
              ) : score >= 0.60 && !topic.wasRescheduledOverdue ? (
                <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[7px] px-0.5 shrink-0 font-bold uppercase tracking-wider">
                  Urgente
                </span>
              ) : score >= 0.35 && !topic.wasRescheduledOverdue ? (
                <span className="bg-stone-150 text-stone-700 border border-stone-200 text-[7px] px-0.5 shrink-0 font-bold uppercase tracking-wider">
                  Atenção
                </span>
              ) : null}
              {forgettingScore !== undefined && forgettingScore > 0 && (
                <span className="text-[7px] font-bold text-neutral-550 shrink-0">
                  {(forgettingScore * 100).toFixed(0)}% risco
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1 truncate">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            getDotColor()
          )}></div>
          <span className="truncate flex-1 font-medium">
            {topic.name}
          </span>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
