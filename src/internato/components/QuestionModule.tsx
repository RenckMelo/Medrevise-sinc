import React, { useState, useEffect, useRef } from 'react';
import { Subject, Topic, Question, UserProgress, QuestionAttempt, QuizAttempt } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, ChevronRight, ChevronLeft, ArrowLeft, HelpCircle, Trophy, RefreshCcw, Sparkles, Loader2, Clock, Filter, Layers, Brain, BookCheck, RotateCcw, List, Bookmark, Trash2, SlidersHorizontal, AlertCircle, Building2, Calendar, Eye, Search, Plus, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

import { db, collection, query, getDocs, where, doc, updateDoc, arrayUnion, arrayRemove, addDoc, setDoc, getDoc, increment, orderBy, limit, deleteDoc } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { explainQuestion, generateQuestions, analyzeBancaYearAvailability } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { markdownComponents, parseMarkdownAlerts } from '../utils/markdownUtils';
import { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove } from '../utils/storageUtils';
import { accuracyToQuality, calculateNextReview } from '../../utils/srs';

const findTopicAndSubject = (tid: string, topicsList: Topic[], subjectsList: Subject[]) => {
  const cleanTid = String(tid || '').trim().toLowerCase();
  
  const topic = topicsList.find(t => {
    if (!t) return false;
    if (t.id && String(t.id).trim().toLowerCase() === cleanTid) return true;
    if (t.title && t.title.trim().toLowerCase() === cleanTid) return true;
    if ((t as any).topicId && String((t as any).topicId).trim().toLowerCase() === cleanTid) return true;
    return false;
  });

  const targetSubjectId = topic?.subjectId || '';
  const cleanSubjId = String(targetSubjectId).trim().toLowerCase();

  const subject = subjectsList.find(s => {
    if (!s) return false;
    if (s.id && String(s.id).trim().toLowerCase() === cleanSubjId) return true;
    if (s.name && s.name.trim().toLowerCase() === cleanSubjId) return true;
    return false;
  });

  const topicTitle = topic?.title || (topic as any)?.name || tid;
  const subjectName = subject?.name || 'Medicina Geral';
  const topicId = topic?.id || tid;
  const subjectId = subject?.id || targetSubjectId || '';

  return { topic, subject, topicTitle, subjectName, topicId, subjectId };
};


interface QuestionModuleProps {
  subjects: Subject[];
  topics: Topic[];
  userProgress: UserProgress | null;
  userId: string;
  initialTopicId?: string;
  initialTopicIds?: string[];
  initialQuestionsCount?: number;
  initialMode?: 'study' | 'exam';
  onProgressUpdate?: (updates: Partial<UserProgress>) => void;
  availableCredits?: number;
  setAvailableCredits?: React.Dispatch<React.SetStateAction<number>>;
}

export default function QuestionModule({ 
  subjects, 
  topics, 
  userProgress, 
  userId, 
  initialTopicId, 
  initialTopicIds,
  initialQuestionsCount,
  initialMode,
  onProgressUpdate,
  availableCredits,
  setAvailableCredits
}: QuestionModuleProps) {
   const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>(
    initialTopicIds && initialTopicIds.length > 0 
      ? initialTopicIds 
      : initialTopicId 
        ? [initialTopicId] 
        : []
  );
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [filterUnanswered, setFilterUnanswered] = useState(false);
  const [filterFlagged, setFilterFlagged] = useState(false);
  const [isSelecting, setIsSelecting] = useState(true);
  const [numQuestionsPerTopic, setNumQuestionsPerTopic] = useState(5);
  const [currentQuizResults, setCurrentQuizResults] = useState<QuestionAttempt[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [quizHistory, setQuizHistory] = useState<QuizAttempt[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showAnswered, setShowAnswered] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Question[]>([]);
  const [loadingAnswered, setLoadingAnswered] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [savedQuestions, setSavedQuestions] = useState<Question[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [selectedQuizForDetail, setSelectedQuizForDetail] = useState<QuizAttempt | null>(null);
  const [detailQuestions, setDetailQuestions] = useState<Question[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const lastInitKeyRef = useRef<string | null>(null);
  const lastStatsKeyRef = useRef<string | null>(null);

  // Topic Preparation states
  const [isTopicPreparing, setIsTopicPreparing] = useState(false);
  const [topicPrepQuestions, setTopicPrepQuestions] = useState<Question[]>([]);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [isGeneratingTopicQuestions, setIsGeneratingTopicQuestions] = useState(false);
  const [selectedCountFromExisting, setSelectedCountFromExisting] = useState(10);

  // Selected Topics Questions & Stats State
  const [topicStatsMap, setTopicStatsMap] = useState<Record<string, {
    topicId: string;
    topicTitle: string;
    subjectName: string;
    questions: Question[];
    total: number;
    correct: number;
    incorrect: number;
    accuracy: number;
    loading: boolean;
  }>>({});
  const [viewingTopicModal, setViewingTopicModal] = useState<string | null>(null);
  const [topicModalSearch, setTopicModalSearch] = useState('');
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [generatingTopicId, setGeneratingTopicId] = useState<string | null>(null);

  // Customized Simulado configs
  const [subjectQuestionCounts, setSubjectQuestionCounts] = useState<Record<string, number>>({});
  const [filterOnlyErrors, setFilterOnlyErrors] = useState(false);
  const [quizMode, setQuizMode] = useState<'study' | 'exam'>('study');
  const [timerType, setTimerType] = useState<'up' | 'down'>('up');
  const [countdownMinutes, setCountdownMinutes] = useState(15);
  const [secondsRemaining, setSecondsRemaining] = useState(15 * 60);
  const [examAnswers, setExamAnswers] = useState<Record<string, number>>({});
  const [seconds, setSeconds] = useState(0);

  // MedRevise Integration State
  const [medReviseMinutes, setMedReviseMinutes] = useState<number>(15);
  const [isSavingMedRevise, setIsSavingMedRevise] = useState(false);
  const [medReviseResult, setMedReviseResult] = useState<{ isFirst: boolean; nextDate: string; topicTitle: string } | null>(null);

  // MedRevise Auto-Sync Mode ('auto' vs 'manual')
  const [questionsSyncMode, setQuestionsSyncMode] = useState<'auto' | 'manual'>(() => {
    try {
      const saved = localStorage.getItem('medinternato_questions_sync_mode');
      if (saved === 'auto' || saved === 'manual') return saved;
      const syncModeSaved = localStorage.getItem('medinternato_sync_medrevise_mode');
      if (syncModeSaved === 'internato_only') return 'manual';
    } catch (e) {}
    return 'auto';
  });

  const updateQuestionsSyncMode = (mode: 'auto' | 'manual') => {
    setQuestionsSyncMode(mode);
    try {
      localStorage.setItem('medinternato_questions_sync_mode', mode);
      localStorage.setItem('medinternato_sync_medrevise_mode', mode === 'auto' ? 'sync' : 'internato_only');
    } catch (e) {}
  };

  useEffect(() => {
    if (showResults) {
      setMedReviseMinutes(Math.max(1, Math.round((seconds || 0) / 60)));
    }
  }, [showResults, seconds]);

  // Multi-Topic MedRevise Sync Logic
  const syncQuizResultToMedRevise = async (
    quizQuestions: Question[],
    finalScore: number,
    durationSeconds: number,
    customMinutes?: number,
    resultsToUse?: QuestionAttempt[]
  ) => {
    if (!userId) return null;

    try {
      // 1. Collect all candidate topic IDs
      const topicIdsFromParams = (selectedTopicIds || []).filter(Boolean);
      const topicIdsFromQuestions = Array.from(new Set(quizQuestions.map(q => q.topicId).filter(Boolean) as string[]));
      const allTopicIds = Array.from(new Set([...topicIdsFromParams, ...topicIdsFromQuestions]));

      let targetTopics: Topic[] = [];

      if (allTopicIds.length > 0) {
        targetTopics = topics.filter(t => allTopicIds.includes(t.id));
      }

      // Check if any candidate topic IDs were missing from in-memory topics state array
      for (const tid of allTopicIds) {
        if (!targetTopics.some(t => t.id === tid) && typeof tid === 'string' && !tid.startsWith('local_')) {
          try {
            const snap = await getDoc(doc(db, 'users', userId, 'topics', tid));
            if (snap.exists()) {
              targetTopics.push({ id: snap.id, ...snap.data() } as Topic);
            }
          } catch (e) {}
        }
      }

      // Fallback: if no topics matched by ID, try matching by subject
      if (targetTopics.length === 0 && quizQuestions.length > 0) {
        const subIds = Array.from(new Set(quizQuestions.map(q => q.subjectId).filter(Boolean) as string[]));
        for (const sid of subIds) {
          const matchedBySubj = topics.find(t => t.subjectId === sid);
          if (matchedBySubj && !targetTopics.some(t => t.id === matchedBySubj.id)) {
            targetTopics.push(matchedBySubj);
          }
        }
      }

      if (targetTopics.length === 0) return null;

      const dateIso = new Date().toISOString();
      const calcMinutes = customMinutes || Math.max(1, Math.round(durationSeconds / 60));
      const minutesPerTopic = Math.max(1, Math.round(calcMinutes / Math.max(1, targetTopics.length)));

      const updatedTopicTitles: string[] = [];
      let lastIsFirst = false;
      let lastNextDateStr = '';

      const attemptsToUse = resultsToUse || currentQuizResults;

      for (const tObj of targetTopics) {
        const topicQs = quizQuestions.filter(q => q.topicId === tObj.id);
        const qCount = topicQs.length > 0 ? topicQs.length : Math.max(1, Math.round(quizQuestions.length / targetTopics.length));
        
        let cCount = 0;
        if (topicQs.length > 0) {
          cCount = topicQs.filter(q => {
            const attempt = attemptsToUse.find(r => r.questionId === q.id);
            return attempt ? attempt.isCorrect : false;
          }).length;
        } else {
          cCount = Math.round((finalScore / Math.max(1, quizQuestions.length)) * qCount);
        }

        const tTitle = tObj.title || (tObj as any).name || 'Tópico';
        updatedTopicTitles.push(tTitle);

        const topicRef = doc(db, 'users', userId, 'topics', tObj.id);
        let currentReps = 0;
        let prevInterval = 0;
        let prevEase = 2.5;

        try {
          const topicSnap = await getDoc(topicRef);
          if (topicSnap.exists()) {
            const data = topicSnap.data();
            currentReps = typeof data.repetitions === 'number' ? data.repetitions : 0;
            prevInterval = typeof data.interval === 'number' ? data.interval : 0;
            prevEase = typeof data.easinessFactor === 'number' ? data.easinessFactor : 2.5;
          } else {
            currentReps = typeof tObj.repetitions === 'number' ? tObj.repetitions : 0;
            prevInterval = typeof tObj.interval === 'number' ? tObj.interval : 0;
            prevEase = typeof tObj.easinessFactor === 'number' ? tObj.easinessFactor : 2.5;
          }
        } catch (e) {
          currentReps = typeof tObj.repetitions === 'number' ? tObj.repetitions : 0;
        }

        const isFirstRegistration = currentReps === 0;
        lastIsFirst = isFirstRegistration;

        const quality = accuracyToQuality(cCount, qCount);
        const srsUpdate = calculateNextReview(
          quality,
          currentReps,
          prevInterval,
          prevEase,
          new Date()
        );

        lastNextDateStr = new Date(srsUpdate.nextReviewDate).toLocaleDateString('pt-BR');

        // Add studySession entry in Firestore
        await addDoc(collection(db, 'users', userId, 'studySessions'), {
          topicId: tObj.id,
          subjectId: tObj.subjectId,
          date: dateIso,
          questionsCount: qCount,
          correctCount: cCount,
          studyTimeMinutes: minutesPerTopic,
          description: isFirstRegistration
            ? `Estudo Inicial por Questões (${cCount}/${qCount} acertos)`
            : `Revisão por Questões (${cCount}/${qCount} acertos)`
        });

        // Update topic SM-2 and completion in MedRevise
        await setDoc(topicRef, {
          name: tTitle,
          subjectId: tObj.subjectId,
          completed: true,
          repetitions: srsUpdate.repetitions,
          interval: srsUpdate.interval,
          easinessFactor: srsUpdate.ease,
          lastReviewDate: dateIso,
          nextReviewDate: srsUpdate.nextReviewDate,
          wasRescheduledOverdue: false,
          updatedAt: dateIso
        }, { merge: true });
      }

      const summaryObj = {
        isFirst: lastIsFirst,
        nextDate: lastNextDateStr,
        topicTitle: updatedTopicTitles.length > 1 
          ? `${updatedTopicTitles.length} tópicos (${updatedTopicTitles.slice(0, 3).join(', ')}${updatedTopicTitles.length > 3 ? '...' : ''})`
          : updatedTopicTitles[0] || 'Tópico'
      };

      setMedReviseResult(summaryObj);
      return summaryObj;
    } catch (err) {
      console.error("Erro ao sincronizar com o MedRevise:", err);
      return null;
    }
  };

  const handleRegisterMedRevise = async () => {
    if (!userId) {
      alert("Usuário não autenticado.");
      return;
    }
    setIsSavingMedRevise(true);
    try {
      const res = await syncQuizResultToMedRevise(questions, score, seconds, medReviseMinutes);
      if (!res) {
        alert("Selecione ou vincule a um tema do MedRevise para registrar seu progresso.");
      }
    } catch (err) {
      console.error("Erro ao registrar no MedRevise:", err);
      alert("Ocorreu um erro ao salvar o registro no MedRevise.");
    } finally {
      setIsSavingMedRevise(false);
    }
  };

  // METODOLOGIAS DE SIMULADOS DE PESO OFICIAL E IA
  const [simuladoMode, setSimuladoMode] = useState<'custom' | 'banca-year' | 'ai-errors' | 'official-ratio'>('custom');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('ses-df');
  const [totalPresetQuestions, setTotalPresetQuestions] = useState<number>(20);

  // SELEÇÃO E MATRIZ POR BANCA & ANO
  const [bancaYearSelection, setBancaYearSelection] = useState<Record<string, number>>({});
  const [bancaYearCounts, setBancaYearCounts] = useState<Record<string, number>>({});
  const [bancaYearAnsweredCounts, setBancaYearAnsweredCounts] = useState<Record<string, number>>({});
  const [aiArchiveYearCounts, setAiArchiveYearCounts] = useState<Record<string, number>>({});
  const [loadingBancaYearCounts, setLoadingBancaYearCounts] = useState(false);
  const [runningAudit, setRunningAudit] = useState(false);
  const [auditExecuted, setAuditExecuted] = useState(false);
  const [bancaSearchTerm, setBancaSearchTerm] = useState('');

  const handleRunAvailabilityAudit = async () => {
    setRunningAudit(true);
    try {
      // 1. Audit local database counts
      let qDocs: Question[] = [];
      if (selectedTopicIds.length > 0) {
        for (let i = 0; i < selectedTopicIds.length; i += 10) {
          const chunk = selectedTopicIds.slice(i, i + 10);
          const q = query(collection(db, 'questions'), where('topicId', 'in', chunk), limit(200));
          const snap = await getDocs(q);
          qDocs.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Question)));
        }
      } else if (selectedSubjectIds.length > 0) {
        for (let i = 0; i < selectedSubjectIds.length; i += 10) {
          const chunk = selectedSubjectIds.slice(i, i + 10);
          const q = query(collection(db, 'questions'), where('subjectId', 'in', chunk), limit(200));
          const snap = await getDocs(q);
          qDocs.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Question)));
        }
      } else {
        const q = query(collection(db, 'questions'), limit(250));
        const snap = await getDocs(q);
        qDocs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Question));
      }

      const localCounts: Record<string, number> = {};
      const answeredCounts: Record<string, number> = {};
      const userAnsIds = userProgress?.answeredQuestionIds || [];

      for (const qObj of qDocs) {
        const { banca, year } = parseBancaAndYear(qObj.source);
        if (banca && year) {
          const key = `${banca.toUpperCase()}_${year}`;
          localCounts[key] = (localCounts[key] || 0) + 1;
          if (userAnsIds.includes(qObj.id)) {
            answeredCounts[key] = (answeredCounts[key] || 0) + 1;
          }
        }
      }
      setBancaYearCounts(localCounts);
      setBancaYearAnsweredCounts(answeredCounts);

      // 2. Audit AI / Official archive (cost: 5 credits)
      const selectedTopicTitles = topics.filter(t => selectedTopicIds.includes(t.id)).map(t => t.title);
      const selectedSubjectNames = subjects.filter(s => selectedSubjectIds.includes(s.id)).map(s => s.name);

      const { availabilityMap } = await analyzeBancaYearAvailability(selectedTopicTitles, selectedSubjectNames);
      setAiArchiveYearCounts(availabilityMap);
      setAuditExecuted(true);
    } catch (err: any) {
      console.error("Audit error:", err);
      alert(err?.message || "Erro ao executar auditoria de disponibilidade de acervo.");
    } finally {
      setRunningAudit(false);
    }
  };

  const getBancaYearTotalAvailable = (key: string) => {
    const local = bancaYearCounts[key] || 0;
    const ai = aiArchiveYearCounts[key] || 0;
    return Math.max(local, ai);
  };

  const getBancaYearUnanswered = (key: string) => {
    const total = getBancaYearTotalAvailable(key);
    const answered = bancaYearAnsweredCounts[key] || 0;
    return Math.max(0, total - answered);
  };

  const selectAllAvailableGlobal = (bancasToApply?: string[]) => {
    const next: Record<string, number> = { ...bancaYearSelection };
    const targetBancas = bancasToApply && bancasToApply.length > 0 ? bancasToApply : ALL_NATIONAL_BANCAS;
    targetBancas.forEach(banca => {
      [2026, 2025, 2024, 2023, 2022, 2021].forEach(year => {
        const key = `${banca.toUpperCase()}_${year}`;
        const avail = getBancaYearTotalAvailable(key);
        if (avail > 0) {
          next[key] = avail;
        }
      });
    });
    setBancaYearSelection(next);
  };

  const selectUnansweredGlobal = (bancasToApply?: string[]) => {
    const next: Record<string, number> = { ...bancaYearSelection };
    const targetBancas = bancasToApply && bancasToApply.length > 0 ? bancasToApply : ALL_NATIONAL_BANCAS;
    targetBancas.forEach(banca => {
      [2026, 2025, 2024, 2023, 2022, 2021].forEach(year => {
        const key = `${banca.toUpperCase()}_${year}`;
        const unans = getBancaYearUnanswered(key);
        if (unans > 0) {
          next[key] = unans;
        } else {
          delete next[key];
        }
      });
    });
    setBancaYearSelection(next);
  };

  const candidatePreferredBancas = React.useMemo(() => {
    let focus = (userProgress as any)?.settings?.residencyFocus;
    if (!focus) {
      try {
        focus = safeLocalStorageGet('user_residency_focus') || '';
      } catch (e) {}
    }
    if (!focus || !focus.trim()) {
      focus = "Centro-Oeste (UFG, SES-GO, SES-DF, UnB, ENARE)";
    }
    const knownBancas = [
      'ENARE', 'SES-DF', 'SES-GO', 'SUS-GO', 'UFG', 'UnB', 'HBDF',
      'USP', 'UNIFESP', 'UNICAMP', 'SUS-SP', 'PSU-MG', 'AMRIGS', 'AMP',
      'SURCE', 'ISCMBP', 'FCMSCSP', 'UERJ', 'IAMSPE'
    ];
    const upper = focus.toUpperCase();
    const matched = knownBancas.filter(b => upper.includes(b.toUpperCase()));
    if (matched.length > 0) return Array.from(new Set(matched));
    
    const parts = focus.split(/[,;\/]+/).map(s => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : ['ENARE', 'SES-DF', 'SES-GO', 'UFG', 'UnB'];
  }, [userProgress]);

  const ALL_NATIONAL_BANCAS = [
    'ENARE', 'SES-DF', 'SES-GO', 'USP', 'UNIFESP', 'UNICAMP', 'SUS-SP',
    'PSU-MG', 'AMRIGS', 'AMP', 'SURCE', 'UFG', 'UnB', 'HBDF', 'UERJ', 'IAMSPE'
  ];

  const parseBancaAndYear = (source?: string): { banca: string; year: number | null } => {
    if (!source) return { banca: 'Geral', year: null };
    const yearMatch = source.match(/(20\d\d)/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
    const upper = source.toUpperCase();
    const knownBancas = [
      'ENARE', 'SES-DF', 'SES-GO', 'SUS-GO', 'UFG', 'UnB', 'HBDF',
      'USP', 'UNIFESP', 'UNICAMP', 'SUS-SP', 'PSU-MG', 'AMRIGS', 'AMP',
      'SURCE', 'ISCMBP', 'FCMSCSP', 'UERJ', 'IAMSPE'
    ];
    for (const b of knownBancas) {
      if (upper.includes(b.toUpperCase())) {
        return { banca: b, year };
      }
    }
    const match = source.match(/^([A-Za-z0-9\s()\/,-]+)/);
    const banca = match && match[1].trim() ? match[1].trim() : 'Outras';
    return { banca, year };
  };

  const setBancaYearCount = (banca: string, year: number, val: number) => {
    const key = `${banca.toUpperCase()}_${year}`;
    const count = Math.max(0, val);
    setBancaYearSelection(prev => {
      const next = { ...prev };
      if (count === 0) {
        delete next[key];
      } else {
        next[key] = count;
      }
      return next;
    });
  };

  const applyPreferredBancasPreset = (qtyPerYear: number = 2) => {
    const next: Record<string, number> = { ...bancaYearSelection };
    candidatePreferredBancas.forEach(banca => {
      [2026, 2025, 2024, 2023, 2022].forEach(year => {
        const key = `${banca.toUpperCase()}_${year}`;
        next[key] = (next[key] || 0) + qtyPerYear;
      });
    });
    setBancaYearSelection(next);
  };

  const totalBancaYearSelectedCount = Object.values(bancaYearSelection).reduce((a, b) => a + (b || 0), 0);

  useEffect(() => {
    if (simuladoMode === 'banca-year') {
      let isMounted = true;
      const loadCounts = async () => {
        setLoadingBancaYearCounts(true);
        try {
          let qDocs: Question[] = [];
          if (selectedTopicIds.length > 0) {
            for (let i = 0; i < selectedTopicIds.length; i += 10) {
              const chunk = selectedTopicIds.slice(i, i + 10);
              const q = query(collection(db, 'questions'), where('topicId', 'in', chunk), limit(200));
              const snap = await getDocs(q);
              qDocs.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Question)));
            }
          } else if (selectedSubjectIds.length > 0) {
            for (let i = 0; i < selectedSubjectIds.length; i += 10) {
              const chunk = selectedSubjectIds.slice(i, i + 10);
              const q = query(collection(db, 'questions'), where('subjectId', 'in', chunk), limit(200));
              const snap = await getDocs(q);
              qDocs.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Question)));
            }
          } else {
            const q = query(collection(db, 'questions'), limit(250));
            const snap = await getDocs(q);
            qDocs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Question));
          }

          const counts: Record<string, number> = {};
          for (const qObj of qDocs) {
            const { banca, year } = parseBancaAndYear(qObj.source);
            if (banca && year) {
              const key = `${banca.toUpperCase()}_${year}`;
              counts[key] = (counts[key] || 0) + 1;
            }
          }
          if (isMounted) {
            setBancaYearCounts(counts);
          }
        } catch (err) {
          console.error("Error loading banca year counts:", err);
        } finally {
          if (isMounted) setLoadingBancaYearCounts(false);
        }
      };

      loadCounts();
      return () => { isMounted = false; };
    }
  }, [simuladoMode, selectedTopicIds, selectedSubjectIds]);

  const EXAM_PRESETS = [
    {
      id: 'ses-df',
      name: 'SES-DF (Secretaria de Saúde do DF)',
      description: 'Reflete rigorosamente os pesos do edital mais recente da SES-DF: Forte destaque em Saúde Coletiva/Preventiva, Ginecologia & Obstetrícia e Pediatria.',
      weights: {
        'Saúde Coletiva': 0.30,
        'Medicina de Família e Comunidade': 0.10,
        'Ginecologia e Obstetrícia': 0.25,
        'Pediatria': 0.25,
        'Ortopedia': 0.10
      }
    },
    {
      id: 'ses-go',
      name: 'SES-GO (Secretaria de Estado da Saúde de Goiás)',
      description: 'Pesos de residência médica da SES-GO com ampla cobertura em Saúde Coletiva, Ginecologia & Obstetrícia, Pediatria e Medicina de Família.',
      weights: {
        'Saúde Coletiva': 0.25,
        'Medicina de Família e Comunidade': 0.15,
        'Ginecologia e Obstetrícia': 0.20,
        'Pediatria': 0.20,
        'Ortopedia': 0.20
      }
    },
    {
      id: 'psu-go',
      name: 'PSU-GO (Processo Seletivo Unificado de Goiás)',
      description: 'Processo Seletivo Unificado do Estado de Goiás (CEREM-GO). Excelente enfoque equilibrado nas grandes áreas do edital oficial.',
      weights: {
        'Ginecologia e Obstetrícia': 0.25,
        'Pediatria': 0.25,
        'Saúde Coletiva': 0.20,
        'Medicina de Família e Comunidade': 0.15,
        'Ortopedia': 0.15
      }
    },
    {
      id: 'enare',
      name: 'ENARE (Exame Nacional de Residência)',
      description: 'Distribuição simétrica pelas grandes especialidades conforme o edital oficial da Ebserh/ENARE.',
      weights: {
        'Saúde Coletiva': 0.20,
        'Medicina de Família e Comunidade': 0.20,
        'Ginecologia e Obstetrícia': 0.20,
        'Pediatria': 0.20,
        'Ortopedia': 0.20
      }
    },
    {
      id: 'ufg-go',
      name: 'UFG (Universidade Federal de Goiás)',
      description: 'Pesos correspondentes à banca UFG: Grande enfoque prático em Saúde da Mulher, Ginecologia/Obstetrícia e Puericultura.',
      weights: {
        'Ginecologia e Obstetrícia': 0.35,
        'Pediatria': 0.25,
        'Saúde Coletiva': 0.15,
        'Ortopedia': 0.15,
        'Medicina de Família e Comunidade': 0.10
      }
    },
    {
      id: 'usp',
      name: 'USP (Linha de Clássicos de São Paulo)',
      description: 'Relação de cobrância integrada e equilibrada entre Saúde Coletiva, Emergências Clínicas e Ortopedia.',
      weights: {
        'Saúde Coletiva': 0.25,
        'Ortopedia': 0.25,
        'Ginecologia e Obstetrícia': 0.20,
        'Pediatria': 0.20,
        'Medicina de Família e Comunidade': 0.10
      }
    }
  ];

  const getPresetSubjectCounts = (preset: typeof EXAM_PRESETS[0], totalCount: number) => {
    const counts: Record<string, number> = {};
    let distributed = 0;
    
    // Resolve subject ids present in the current database
    const resolvedWeights = Object.entries(preset.weights).map(([name, weight]) => {
      const sub = subjects.find(s => s.name.toLowerCase() === name.toLowerCase());
      return {
        id: sub?.id,
        name,
        weight
      };
    }).filter(w => w.id !== undefined);
    
    // If no subjects resolved, fall back equally
    if (resolvedWeights.length === 0) {
      subjects.forEach((s) => {
        counts[s.id] = Math.ceil(totalCount / subjects.length);
      });
      return counts;
    }

    // Allocate based on resolved weights
    resolvedWeights.forEach((w, idx) => {
      if (!w.id) return;
      if (idx === resolvedWeights.length - 1) {
        counts[w.id] = Math.max(1, totalCount - distributed);
      } else {
        const qty = Math.round(totalCount * w.weight);
        counts[w.id] = Math.max(1, qty);
        distributed += qty;
      }
    });
    
    return counts;
  };

  const computeAiErrorsStats = () => {
    const attempts = Object.values(userProgress?.attempts || {});
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    // Filter attempts from last 30 days
    let targetAttempts = attempts.filter(a => {
      if (!a.timestamp) return false;
      const attemptDate = new Date(a.timestamp);
      return attemptDate >= thirtyDaysAgo;
    });
    
    let isFallback = false;
    // Fallback to all attempts if last month is empty
    if (targetAttempts.length === 0) {
      targetAttempts = attempts;
      isFallback = true;
    }
    
    const stats: Record<string, { total: number; correct: number; name: string }> = {};
    
    targetAttempts.forEach(a => {
      const sid = a.subjectId || 'unknown';
      const isCorrect = a.isCorrect;
      
      if (!stats[sid]) {
        const sName = subjects.find(s => s.id === sid)?.name || 'Outras';
        stats[sid] = { total: 0, correct: 0, name: sName };
      }
      stats[sid].total += 1;
      if (isCorrect) {
        stats[sid].correct += 1;
      }
    });
    
    const result = Object.entries(stats).map(([sid, info]) => {
      const rate = info.total > 0 ? (info.correct / info.total) : 1;
      return {
        subjectId: sid,
        name: info.name,
        total: info.total,
        correct: info.correct,
        rate: rate,
        percent: Math.round(rate * 100)
      };
    }).filter(item => item.subjectId !== 'unknown');
    
    // Sort ascending (lowest success rate first)
    result.sort((a, b) => {
      if (a.rate === b.rate) {
        return b.total - a.total; // Prefer sorting subjects with more attempts if rates match
      }
      return a.rate - b.rate;
    });
    
    return {
      stats: result,
      isFallback,
      hasData: result.length > 0
    };
  };
  
  // Synchronize subject question counts when selected subjects change
  useEffect(() => {
    setSubjectQuestionCounts(prev => {
      const updated = { ...prev };
      let changed = false;
      selectedSubjectIds.forEach(sid => {
        if (updated[sid] === undefined) {
          updated[sid] = 5; // Default to 5 questions per selected subject
          changed = true;
        }
      });
      // clean up old keys
      Object.keys(updated).forEach(sid => {
        if (!selectedSubjectIds.includes(sid)) {
          delete updated[sid];
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [selectedSubjectIds]);

  // Update secondsRemaining when countdownMinutes changes
  useEffect(() => {
    if (timerType === 'down') {
      setSecondsRemaining(countdownMinutes * 60);
    }
  }, [countdownMinutes, timerType]);
  
  // Timer state
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (showHistory) {
      const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
          const q = query(
            collection(db, 'quizAttempts'), 
            where('userId', '==', userId),
            orderBy('timestamp', 'desc'),
            limit(20) // Otimização: limitar histórico para economizar unidades de leitura
          );
          const snapshot = await getDocs(q);
          const dbAttempts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizAttempt));
          
          const progressHistory = userProgress?.quizHistory || [];
          const allAttemptsMap = new Map<string, QuizAttempt>();
          
          progressHistory.forEach(att => {
            if (att && att.id) allAttemptsMap.set(att.id, att);
          });
          dbAttempts.forEach(att => {
            if (att && att.id) allAttemptsMap.set(att.id, att);
          });
          
          const sortedHistory = Array.from(allAttemptsMap.values()).sort((a, b) => {
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          });
          
          setQuizHistory(sortedHistory);
        } catch (err) {
          console.error('Error fetching history:', err);
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [showHistory, userId, userProgress?.quizHistory]);

  const answeredQuestionsRef = useRef<Question[]>([]);

  useEffect(() => {
    if (showAnswered && userProgress?.answeredQuestionIds?.length) {
      if (answeredQuestionsRef.current.length === (userProgress?.answeredQuestionIds?.length || 0)) {
        setAnsweredQuestions(answeredQuestionsRef.current);
        return;
      }

      const fetchAnswered = async () => {
        setLoadingAnswered(true);
        try {
          const ids = userProgress.answeredQuestionIds || [];
          
          // Only fetch IDs we don't have in cache yet
          const cachedIds = answeredQuestionsRef.current.map(q => q.id);
          const missingIds = ids.filter(id => !cachedIds.includes(id));
          
          if (missingIds.length === 0) {
            setAnsweredQuestions(answeredQuestionsRef.current);
            setLoadingAnswered(false);
            return;
          }

          const newFetched: Question[] = [];
          for (let i = 0; i < missingIds.length; i += 10) {
            const chunk = missingIds.slice(i, i + 10);
            const q = query(collection(db, 'questions'), where('__name__', 'in', chunk));
            const snapshot = await getDocs(q);
            newFetched.push(...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
          }
          
          const finalResult = [...answeredQuestionsRef.current, ...newFetched];
          answeredQuestionsRef.current = finalResult;
          setAnsweredQuestions(finalResult);
        } catch (err) {
          console.error('Error fetching answered questions:', err);
        } finally {
          setLoadingAnswered(false);
        }
      };
      fetchAnswered();
    }
  }, [showAnswered, userProgress?.answeredQuestionIds?.length]);

  const savedQuestionsRef = useRef<Question[]>([]);

  useEffect(() => {
    if (showSaved && userProgress?.flaggedQuestionIds?.length) {
      const ids = userProgress.flaggedQuestionIds || [];
      
      // Filter out cached questions that are no longer flagged
      savedQuestionsRef.current = savedQuestionsRef.current.filter(q => ids.includes(q.id));

      if (savedQuestionsRef.current.length === ids.length) {
        setSavedQuestions(savedQuestionsRef.current);
        return;
      }

      const fetchSaved = async () => {
        setLoadingSaved(true);
        try {
          // Only fetch IDs we don't have in cache yet
          const cachedIds = savedQuestionsRef.current.map(q => q.id);
          const missingIds = ids.filter(id => !cachedIds.includes(id));
          
          if (missingIds.length === 0) {
            setSavedQuestions(savedQuestionsRef.current);
            setLoadingSaved(false);
            return;
          }

          const newFetched: Question[] = [];
          for (let i = 0; i < missingIds.length; i += 10) {
            const chunk = missingIds.slice(i, i + 10);
            const q = query(collection(db, 'questions'), where('__name__', 'in', chunk));
            const snapshot = await getDocs(q);
            newFetched.push(...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
          }
          
          const finalResult = [...savedQuestionsRef.current, ...newFetched].filter(q => ids.includes(q.id));
          savedQuestionsRef.current = finalResult;
          setSavedQuestions(finalResult);
        } catch (err) {
          console.error('Error fetching saved questions:', err);
        } finally {
          setLoadingSaved(false);
        }
      };
      fetchSaved();
    } else if (showSaved) {
      setSavedQuestions([]);
    }
  }, [showSaved, userProgress?.flaggedQuestionIds?.length]);

  const handleToggleFlagForQuestion = async (qId: string) => {
    if (!userId || !qId) return;
    const isCurrentlyFlagged = userProgress?.flaggedQuestionIds?.includes(qId) || false;
    const newFlags = isCurrentlyFlagged
      ? (userProgress?.flaggedQuestionIds || []).filter(id => id !== qId)
      : [...(userProgress?.flaggedQuestionIds || []), qId];

    if (onProgressUpdate && userProgress) {
      onProgressUpdate({ flaggedQuestionIds: newFlags });
    }

    try {
      const progressRef = doc(db, 'userProgress', userId);
      await updateDoc(progressRef, {
        flaggedQuestionIds: isCurrentlyFlagged
          ? arrayRemove(qId)
          : arrayUnion(qId)
      });
      // Synchronously update local states
      setSavedQuestions(prev => prev.filter(q => q.id !== qId));
      savedQuestionsRef.current = savedQuestionsRef.current.filter(q => q.id !== qId);
    } catch (e) {
      console.error('Error toggling flagged state:', e);
    }
  };

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1);
        if (timerType === 'down') {
          setSecondsRemaining(prev => {
            if (prev <= 1) {
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timerType]);

  const handleExamTimeout = async () => {
    setIsActive(false);
    alert('🚨 O tempo limite do simulado terminou! Suas respostas foram computadas e enviadas.');
    await submitExam();
  };

  useEffect(() => {
    if (isActive && timerType === 'down' && secondsRemaining <= 0) {
      handleExamTimeout();
    }
  }, [secondsRemaining, isActive, timerType]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      let fetched: Question[] = [];

      if (filterFlagged) {
        const flaggedIds = userProgress?.flaggedQuestionIds || [];
        if (flaggedIds.length === 0) {
          alert('Você não possui nenhuma questão marcada ainda!');
          setLoading(false);
          return;
        }

        // Fetch user's flagged questions in chunks of 10 to respect Firestore 'in' limit
        for (let i = 0; i < flaggedIds.length; i += 10) {
          const chunk = flaggedIds.slice(i, i + 10);
          const q = query(collection(db, 'questions'), where('__name__', 'in', chunk));
          const snapshot = await getDocs(q);
          fetched.push(...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
        }

        // Apply filters locally on the flagged questions
        if (selectedTopicIds.length > 0) {
          fetched = fetched.filter(q => selectedTopicIds.includes(q.topicId || ''));
        } else if (selectedSubjectIds.length > 0) {
          fetched = fetched.filter(q => selectedSubjectIds.includes(q.subjectId || ''));
        }

        if (filterUnanswered && userProgress) {
          const answeredIds = userProgress.answeredQuestionIds || [];
          fetched = fetched.filter(q => !answeredIds.includes(q.id));
        }
        if (filterOnlyErrors && userProgress?.attempts) {
          fetched = fetched.filter(q => {
            const attempt = userProgress.attempts?.[q.id];
            return attempt && !attempt.isCorrect;
          });
        }
        fetched = fetched.sort(() => Math.random() - 0.5);
      } else if (selectedTopicIds.length > 0 && simuladoMode === 'custom') {
        // If topics are selected in Custom Mode: check cache first for each topic to avoid reads
        const neededTopicIds = [...selectedTopicIds];
        const cachedQuestions: Question[] = [];
        const missingTopicIds: string[] = [];

        neededTopicIds.forEach(tid => {
          const cached = safeLocalStorageGet(`questions_topic_${tid}`);
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                cachedQuestions.push(...parsed);
              } else {
                missingTopicIds.push(tid);
              }
            } catch (e) {
              missingTopicIds.push(tid);
            }
          } else {
            missingTopicIds.push(tid);
          }
        });

        if (missingTopicIds.length > 0) {
          // Fetch missing topics from Firestore
          for (let i = 0; i < missingTopicIds.length; i += 10) {
            const chunk = missingTopicIds.slice(i, i + 10);
            const q = query(collection(db, 'questions'), where('topicId', 'in', chunk), limit(150));
            const snapshot = await getDocs(q);
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
            
            // Cache fetched questions individually by topicId
            chunk.forEach(tid => {
              const topicDocs = docs.filter(q => q.topicId === tid || String(q.topicId) === String(tid));
              if (topicDocs.length > 0) {
                safeLocalStorageSet(`questions_topic_${tid}`, JSON.stringify(topicDocs));
              }
            });
            cachedQuestions.push(...docs);
          }
        }

        fetched = cachedQuestions;
        
        // Auto-generate fallback if no questions exist in Firestore for selected topics
        if (fetched.length === 0 && selectedTopicIds.length > 0) {
          const preset = EXAM_PRESETS.find(p => p.id === selectedPresetId);
          const targetExam = preset ? preset.name : undefined;
          for (const tid of selectedTopicIds) {
            const { topicTitle, subjectName, topicId, subjectId } = findTopicAndSubject(tid, topics, subjects);
            try {
              const newQuestions = await generateQuestions(topicTitle, subjectName, numQuestionsPerTopic || 5, [], userId, targetExam);
              if (newQuestions && Array.isArray(newQuestions)) {
                for (const qData of newQuestions) {
                  const docRef = await addDoc(collection(db, 'questions'), {
                    ...qData,
                    topicId: topicId,
                    subjectId: subjectId
                  });
                  fetched.push({ id: docRef.id, ...qData, topicId: topicId, subjectId: subjectId } as Question);
                }
                safeLocalStorageRemove(`questions_topic_${topicId}`);
              }
            } catch (genErr) {
              console.warn('Auto AI question generation fallback failed in fetchQuestions:', genErr);
            }
          }
        }

        if (filterUnanswered && userProgress) {
          const answeredIds = userProgress.answeredQuestionIds || [];
          const unansweredOnly = fetched.filter(q => !answeredIds.includes(q.id));
          if (unansweredOnly.length > 0) fetched = unansweredOnly;
        }
        if (filterOnlyErrors && userProgress?.attempts) {
          const errorsOnly = fetched.filter(q => {
            const attempt = userProgress.attempts?.[q.id];
            return attempt && !attempt.isCorrect;
          });
          if (errorsOnly.length > 0) fetched = errorsOnly;
        }
        fetched = fetched.sort(() => Math.random() - 0.5);
      } else if (simuladoMode === 'ai-errors' || simuladoMode === 'official-ratio' || (selectedSubjectIds.length > 0 && simuladoMode === 'custom')) {
        let activeSubjectIds = selectedSubjectIds;
        let activeCounts = subjectQuestionCounts;
        const isAiMode = simuladoMode === 'ai-errors';

        if (simuladoMode === 'ai-errors') {
          const { stats, hasData } = computeAiErrorsStats();
          if (hasData) {
            // Poorest performing subjects (up to 3)
            const poorSubjects = stats.slice(0, 3);
            activeSubjectIds = poorSubjects.map(s => s.subjectId);
            activeCounts = {};
            poorSubjects.forEach(s => {
              activeCounts[s.subjectId] = 5; // 5 questions each
            });
          } else {
            // Fallback: all subjects 5 questions each
            activeSubjectIds = subjects.map(s => s.id);
            activeCounts = {};
            subjects.forEach(s => {
              activeCounts[s.id] = 5;
            });
          }
        } else if (simuladoMode === 'official-ratio') {
          const preset = EXAM_PRESETS.find(p => p.id === selectedPresetId) || EXAM_PRESETS[0];
          activeCounts = getPresetSubjectCounts(preset, totalPresetQuestions);
          activeSubjectIds = Object.keys(activeCounts);
        }

        // Query each subject individually (with caching support) based on custom/dynamic counts!
        const promises = activeSubjectIds.map(async (subjId) => {
          const qty = activeCounts[subjId] || 5;
          const cacheKey = `questions_subject_${subjId}`;
          const cached = safeLocalStorageGet(cacheKey);
          let subjQuestions: Question[] = [];

          if (cached) {
            try {
              subjQuestions = JSON.parse(cached) as Question[];
            } catch (e) {
              console.warn('Error parsing cached questions for subject:', subjId, e);
            }
          }

          if (subjQuestions.length === 0) {
            // Fetch more questions than requested to build a healthy cache and minimize future reads
            const q = query(collection(db, 'questions'), where('subjectId', '==', subjId), limit(80));
            const snapshot = await getDocs(q);
            subjQuestions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
            
            if (subjQuestions.length > 0) {
              safeLocalStorageSet(cacheKey, JSON.stringify(subjQuestions));
            }
          }
          
          if (filterUnanswered && userProgress) {
            const answeredIds = userProgress.answeredQuestionIds || [];
            subjQuestions = subjQuestions.filter(q => !answeredIds.includes(q.id));
          }
          
          // In AI Errors mode, we inherently prioritize error-prone questions in that subject
          if ((filterOnlyErrors || isAiMode) && userProgress?.attempts) {
            const filteredForErrors = subjQuestions.filter(q => {
              const attempt = userProgress.attempts?.[q.id];
              return attempt && !attempt.isCorrect;
            });
            // Only use filtered if we found actual recorded mistakes, otherwise use full subject questions
            if (filteredForErrors.length > 0) {
              subjQuestions = filteredForErrors;
            }
          }
          
          subjQuestions = subjQuestions.sort(() => Math.random() - 0.5);
          return subjQuestions.slice(0, qty);
        });
        
        const results = await Promise.all(promises);
        fetched = results.flat();
      } else if (simuladoMode === 'banca-year') {
        setGenerationStatus('Analisando matriz de bancas e anos solicitados...');
        setGenerationProgress(10);

        const activeSpecs: { banca: string; year: number; count: number }[] = [];
        Object.entries(bancaYearSelection).forEach(([key, val]) => {
          if (val && val > 0) {
            const parts = key.split('_');
            const banca = parts[0];
            const year = parseInt(parts[1], 10);
            if (banca && !isNaN(year)) {
              activeSpecs.push({ banca, year, count: val });
            }
          }
        });

        if (activeSpecs.length === 0) {
          alert('Por favor, selecione ao menos 1 questão de alguma banca e ano na matriz.');
          setLoading(false);
          return;
        }

        let candidatePool: Question[] = [];
        if (selectedTopicIds.length > 0) {
          for (let i = 0; i < selectedTopicIds.length; i += 10) {
            const chunk = selectedTopicIds.slice(i, i + 10);
            const q = query(collection(db, 'questions'), where('topicId', 'in', chunk), limit(200));
            const snap = await getDocs(q);
            candidatePool.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Question)));
          }
        } else if (selectedSubjectIds.length > 0) {
          for (let i = 0; i < selectedSubjectIds.length; i += 10) {
            const chunk = selectedSubjectIds.slice(i, i + 10);
            const q = query(collection(db, 'questions'), where('subjectId', 'in', chunk), limit(200));
            const snap = await getDocs(q);
            candidatePool.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Question)));
          }
        } else {
          const q = query(collection(db, 'questions'), limit(300));
          const snap = await getDocs(q);
          candidatePool = snap.docs.map(d => ({ id: d.id, ...d.data() } as Question));
        }

        let totalSpecs = activeSpecs.length;
        let currentSpecIdx = 0;

        for (const spec of activeSpecs) {
          currentSpecIdx++;
          const specPct = Math.round(10 + (currentSpecIdx / totalSpecs) * 85);
          setGenerationStatus(`Obtendo ${spec.count} questão(ões) de ${spec.banca} (${spec.year})...`);
          setGenerationProgress(specPct);

          const matched = candidatePool.filter(q => {
            const parsed = parseBancaAndYear(q.source);
            return parsed.banca.toUpperCase() === spec.banca.toUpperCase() && parsed.year === spec.year;
          });

          if (matched.length >= spec.count) {
            fetched.push(...matched.slice(0, spec.count));
          } else {
            fetched.push(...matched);
            const needed = spec.count - matched.length;

            let targetTid = selectedTopicIds[0] || (topics[0]?.id || '');
            let targetSid = selectedSubjectIds[0] || (subjects[0]?.id || '');
            const { topicTitle, subjectName, topicId, subjectId } = findTopicAndSubject(targetTid, topics, subjects);

            const existingTexts = fetched.map(q => q.text);
            try {
              const newQuestions = await generateQuestions(
                topicTitle || 'Concurso de Residência Médica',
                subjectName || 'Clínica Médica',
                needed,
                existingTexts,
                userId,
                spec.banca,
                spec.year
              );

              if (newQuestions && Array.isArray(newQuestions)) {
                for (const qData of newQuestions) {
                  const docRef = await addDoc(collection(db, 'questions'), {
                    ...qData,
                    topicId: topicId || targetTid,
                    subjectId: subjectId || targetSid,
                    source: qData.source || `${spec.banca} (${spec.year})`
                  });
                  fetched.push({
                    id: docRef.id,
                    ...qData,
                    topicId: topicId || targetTid,
                    subjectId: subjectId || targetSid,
                    source: qData.source || `${spec.banca} (${spec.year})`
                  } as Question);
                }
              }
            } catch (genErr) {
              console.warn(`Error generating questions for ${spec.banca} (${spec.year}):`, genErr);
            }
          }
        }
        setGenerationProgress(100);
      } else {
        // Fallback basic fetch with caching support
        const cached = safeLocalStorageGet('questions_fallback');
        if (cached) {
          try {
            fetched = JSON.parse(cached);
          } catch (e) {
            // fallback to fetch
          }
        }

        if (fetched.length === 0) {
          const q = query(collection(db, 'questions'), limit(100));
          const snapshot = await getDocs(q);
          fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
          safeLocalStorageSet('questions_fallback', JSON.stringify(fetched));
        }
        
        if (filterUnanswered && userProgress) {
          const answeredIds = userProgress.answeredQuestionIds || [];
          fetched = fetched.filter(q => !answeredIds.includes(q.id));
        }
        if (filterOnlyErrors && userProgress?.attempts) {
          fetched = fetched.filter(q => {
            const attempt = userProgress.attempts?.[q.id];
            return attempt && !attempt.isCorrect;
          });
        }
        fetched = fetched.sort(() => Math.random() - 0.5);
      }

      if (fetched.length === 0) {
        alert('Nenhuma questão encontrada com os filtros selecionados.');
        setLoading(false);
        return;
      }

      setQuestions(fetched);
      setIsActive(fetched.length > 0);
      setSeconds(0);
      setSecondsRemaining(countdownMinutes * 60);
      setExamAnswers({});
      setCurrentIndex(0);
      setIsAnswered(false);
      setSelectedOption(null);
      setAiExplanation(null);
      setShowResults(false);
      if (fetched.length > 0) {
        setIsSelecting(false);
      }
    } catch (err) {
      console.error('Error fetching questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const activeTids = initialTopicIds && initialTopicIds.length > 0 
        ? initialTopicIds 
        : initialTopicId 
          ? [initialTopicId] 
          : [];

      const currentInitKey = `${activeTids.join(',')}_${initialQuestionsCount || 5}_${initialMode || 'custom'}`;
      if (activeTids.length > 0 && lastInitKeyRef.current === currentInitKey) {
        return;
      }
      if (activeTids.length > 0) {
        lastInitKeyRef.current = currentInitKey;
      }

      if (activeTids.length > 0) {
        setSelectedTopicIds(activeTids);
        if (initialQuestionsCount) {
          setNumQuestionsPerTopic(initialQuestionsCount);
        }
        if (initialMode) {
          setQuizMode(initialMode);
        }

        setLoading(true);
        try {
          let fetched: Question[] = [];

          // Custom Mode with selectedTopicIds
          const neededTopicIds = [...activeTids];
          const cachedQuestions: Question[] = [];
          const missingTopicIds: string[] = [];

          neededTopicIds.forEach(tid => {
            const cached = safeLocalStorageGet(`questions_topic_${tid}`);
            if (cached) {
              try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  cachedQuestions.push(...parsed);
                } else {
                  missingTopicIds.push(tid);
                }
              } catch (e) {
                missingTopicIds.push(tid);
              }
            } else {
              missingTopicIds.push(tid);
            }
          });

          if (missingTopicIds.length > 0) {
            for (let i = 0; i < missingTopicIds.length; i += 10) {
              const chunk = missingTopicIds.slice(i, i + 10);
              const q = query(collection(db, 'questions'), where('topicId', 'in', chunk), limit(150));
              const snapshot = await getDocs(q);
              const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
              
              chunk.forEach(tid => {
                const topicDocs = docs.filter(q => q.topicId === tid);
                if (topicDocs.length > 0) {
                  safeLocalStorageSet(`questions_topic_${tid}`, JSON.stringify(topicDocs));
                }
              });
              cachedQuestions.push(...docs);
            }
          }

          fetched = cachedQuestions;
          fetched = fetched.sort(() => Math.random() - 0.5);

          // Redirect to custom topic preparation screen with the existing pool
          setTopicPrepQuestions(fetched);
          setIsTopicPreparing(true);
          setFilterUnanswered(false);
          setFilterOnlyErrors(false);
          setSelectedCountFromExisting(Math.min(10, fetched.length > 0 ? fetched.length : 10));
          setIsSelecting(true);
        } catch (err) {
          console.error("Error loading mock study session:", err);
          setIsSelecting(true);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    init();
  }, [initialTopicId, initialTopicIds, topics, subjects]);

  const handleAnswer = async (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    setAiExplanation(null);

    const currentQuestion = questions[currentIndex];
    const isCorrect = index === currentQuestion.correctOptionIndex;
    
    if (isCorrect) {
      setScore(s => s + 1);
    }

    // Save individualized attempt with full content for historical review
    const attempt: any = {
      questionId: currentQuestion.id,
      selectedOption: String.fromCharCode(65 + index),
      correctOption: String.fromCharCode(65 + currentQuestion.correctOptionIndex),
      isCorrect,
      timestamp: new Date().toISOString(),
      timeSpentSeconds: seconds,
      subjectId: currentQuestion.subjectId,
      content: currentQuestion.text,
      options: currentQuestion.options.reduce((acc: any, opt, idx) => {
        acc[String.fromCharCode(65 + idx)] = opt;
        return acc;
      }, {}),
      explanation: currentQuestion.explanation
    };

    setCurrentQuizResults(prev => [...prev, attempt]);

    if (onProgressUpdate && userProgress) {
      const localAttempts = { ...(userProgress.attempts || {}) };
      localAttempts[currentQuestion.id] = attempt;
      const localAnswered = Array.from(new Set([...(userProgress.answeredQuestionIds || []), currentQuestion.id]));
      const localCorrect = isCorrect
        ? Array.from(new Set([...(userProgress.correctQuestionIds || []), currentQuestion.id]))
        : (userProgress.correctQuestionIds || []);
      const localStats = { ...(userProgress.stats || {}) };
      const subQ = { ...(localStats.subjectQuestions || {}) };
      if (currentQuestion.subjectId) {
        subQ[currentQuestion.subjectId] = (subQ[currentQuestion.subjectId] || 0) + 1;
      }
      localStats.subjectQuestions = subQ;

      onProgressUpdate({
        attempts: localAttempts,
        answeredQuestionIds: localAnswered,
        correctQuestionIds: localCorrect,
        stats: localStats
      });
    }

    try {
      const progressRef = doc(db, 'userProgress', userId);
      await updateDoc(progressRef, {
        [`attempts.${currentQuestion.id}`]: attempt,
        answeredQuestionIds: arrayUnion(currentQuestion.id),
        ...(isCorrect ? { correctQuestionIds: arrayUnion(currentQuestion.id) } : {}),
        // Track counts per subject for quick access
        ...(currentQuestion.subjectId ? { [`stats.subjectQuestions.${currentQuestion.subjectId}`]: increment(1) } : {})
      });
    } catch (e) {
      console.warn('Firestore write failed, saved in local-first cache:', e);
    }
  };

  const nextQuestion = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedOption(null);
      setIsAnswered(false);
      setAiExplanation(null);
    } else {
      setShowResults(true);
      setIsActive(false);
      
      // Save Quiz Attempt summary
      const finalDuration = Math.max(15, seconds);
      const quizAttempt = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        subjectIds: selectedSubjectIds.length > 0 ? selectedSubjectIds : [...new Set(questions.map(q => q.subjectId).filter(Boolean) as string[])],
        topicIds: selectedTopicIds,
        questions: currentQuizResults,
        score,
        totalQuestions: questions.length,
        timeSpentSeconds: finalDuration,
        timestamp: new Date().toISOString(),
        type: selectedSubjectIds.length > 1 ? 'simulado' : 'individual' as any
      };

      const studySessionEntry = {
        id: Math.random().toString(36).substr(2, 9),
        subjectId: selectedSubjectIds[0] || questions[0]?.subjectId || 'geral',
        startTime: new Date(Date.now() - finalDuration * 1000).toISOString(),
        durationSeconds: finalDuration
      };
      
      if (onProgressUpdate && userProgress) {
        onProgressUpdate({
          totalStudyTimeSeconds: (userProgress.totalStudyTimeSeconds || 0) + finalDuration,
          quizHistory: [...(userProgress.quizHistory || []), quizAttempt],
          studySessions: [...(userProgress.studySessions || []), studySessionEntry]
        });
      }

      try {
        await addDoc(collection(db, 'quizAttempts'), quizAttempt);
        const progressRef = doc(db, 'userProgress', userId);
        await updateDoc(progressRef, {
          totalStudyTimeSeconds: increment(finalDuration),
          quizHistory: arrayUnion(quizAttempt),
          studySessions: arrayUnion(studySessionEntry)
        });

        // Sync tested/studied topics to MedRevise if automatic mode is enabled
        if (questionsSyncMode === 'auto') {
          await syncQuizResultToMedRevise(questions, score, finalDuration, undefined, currentQuizResults);
        }
      } catch (err) {
        console.warn('Firestore write failed, saved in local-first cache:', err);
      }
    }
  };

  const handleFinishEarly = async () => {
    if (questions.length === 0) return;

    const answeredCount = quizMode === 'exam' 
      ? Object.keys(examAnswers).length 
      : currentQuizResults.length;

    const confirmMsg = `Deseja encerrar o simulado agora?\n\n` +
      `Você respondeu ${answeredCount} de ${questions.length} questões.\n` +
      `O relatório de desempenho será gerado com o seu aproveitamento até este momento.`;

    if (!window.confirm(confirmMsg)) return;

    if (quizMode === 'exam') {
      await submitExam();
    } else {
      setShowResults(true);
      setIsActive(false);

      const finalDuration = Math.max(15, seconds);
      const totalAnsweredSoFar = Math.max(1, currentQuizResults.length);
      const quizAttempt = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        subjectIds: selectedSubjectIds.length > 0 ? selectedSubjectIds : [...new Set(questions.map(q => q.subjectId).filter(Boolean) as string[])],
        topicIds: selectedTopicIds,
        questions: currentQuizResults,
        score,
        totalQuestions: totalAnsweredSoFar,
        timeSpentSeconds: finalDuration,
        timestamp: new Date().toISOString(),
        type: selectedSubjectIds.length > 1 ? 'simulado' : 'individual' as any
      };

      const studySessionEntry = {
        id: Math.random().toString(36).substr(2, 9),
        subjectId: selectedSubjectIds[0] || questions[0]?.subjectId || 'geral',
        startTime: new Date(Date.now() - finalDuration * 1000).toISOString(),
        durationSeconds: finalDuration
      };

      if (onProgressUpdate && userProgress) {
        onProgressUpdate({
          totalStudyTimeSeconds: (userProgress.totalStudyTimeSeconds || 0) + finalDuration,
          quizHistory: [...(userProgress.quizHistory || []), quizAttempt],
          studySessions: [...(userProgress.studySessions || []), studySessionEntry]
        });
      }

      try {
        await addDoc(collection(db, 'quizAttempts'), quizAttempt);
        const progressRef = doc(db, 'userProgress', userId);
        await updateDoc(progressRef, {
          totalStudyTimeSeconds: increment(finalDuration),
          quizHistory: arrayUnion(quizAttempt),
          studySessions: arrayUnion(studySessionEntry)
        });

        if (questionsSyncMode === 'auto') {
          await syncQuizResultToMedRevise(questions.slice(0, totalAnsweredSoFar), score, finalDuration, undefined, currentQuizResults);
        }
      } catch (err) {
        console.warn('Firestore write failed on finish early:', err);
      }
    }
  };

  const handleExamOptionClick = (idx: number) => {
    setExamAnswers(prev => ({
      ...prev,
      [questions[currentIndex].id]: idx
    }));
  };

  const submitExam = async (overrideAnswers?: Record<string, number>) => {
    setLoading(true);
    try {
      const answersToUse = overrideAnswers || examAnswers;
      let finalScore = 0;
      const quizResults: QuestionAttempt[] = [];
      const progressRef = doc(db, 'userProgress', userId);
      const updates: Record<string, any> = {};
      
      for (const q of questions) {
        const chosenIdx = answersToUse[q.id];
        // Skip questions that were not answered when finishing early or submitting exam
        if (chosenIdx === undefined) continue;

        const isCorrect = chosenIdx === q.correctOptionIndex;
        if (isCorrect) finalScore++;
        
        const attempt: QuestionAttempt = {
          questionId: q.id,
          selectedOption: String.fromCharCode(65 + chosenIdx),
          correctOption: String.fromCharCode(65 + q.correctOptionIndex),
          isCorrect,
          timestamp: new Date().toISOString(),
          timeSpentSeconds: Math.round(seconds / Math.max(1, Object.keys(answersToUse).length)),
          subjectId: q.subjectId || '',
          content: q.text,
          options: q.options.reduce((acc: any, opt, idx) => {
            acc[String.fromCharCode(65 + idx)] = opt;
            return acc;
          }, {}),
          explanation: q.explanation || ''
        };
        
        quizResults.push(attempt);
        updates[`attempts.${q.id}`] = attempt;
      }
      
      const answeredIds = quizResults.map(r => r.questionId);
      const correctIds = quizResults.filter(r => r.isCorrect).map(r => r.questionId);
      
      updates.answeredQuestionIds = arrayUnion(...answeredIds);
      if (correctIds.length > 0) {
        updates.correctQuestionIds = arrayUnion(...correctIds);
      }
      
      const finalExamDuration = Math.max(15, seconds);
      const quizAttempt = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        subjectIds: selectedSubjectIds.length > 0 ? selectedSubjectIds : [...new Set(questions.map(q => q.subjectId).filter(Boolean) as string[])],
        topicIds: selectedTopicIds,
        questions: quizResults,
        score: finalScore,
        totalQuestions: quizResults.length,
        timeSpentSeconds: finalExamDuration,
        timestamp: new Date().toISOString(),
        type: 'simulado' as any
      };

      const studySessionEntry = {
        id: Math.random().toString(36).substr(2, 9),
        subjectId: selectedSubjectIds[0] || questions[0]?.subjectId || 'geral',
        startTime: new Date(Date.now() - finalExamDuration * 1000).toISOString(),
        durationSeconds: finalExamDuration
      };
      
      updates.totalStudyTimeSeconds = increment(finalExamDuration);
      updates.quizHistory = arrayUnion(quizAttempt);
      updates.studySessions = arrayUnion(studySessionEntry);
      
      quizResults.forEach(r => {
        if (r.subjectId) {
          updates[`stats.subjectQuestions.${r.subjectId}`] = increment(1);
        }
      });

      if (onProgressUpdate && userProgress) {
        const localAttempts = { ...(userProgress.attempts || {}) };
        quizResults.forEach(r => {
          localAttempts[r.questionId] = r;
        });
        const localAnswered = Array.from(new Set([...(userProgress.answeredQuestionIds || []), ...answeredIds]));
        const localCorrect = Array.from(new Set([...(userProgress.correctQuestionIds || []), ...correctIds]));
        const localStats = { ...(userProgress.stats || {}) };
        const subQ = { ...(localStats.subjectQuestions || {}) };
        quizResults.forEach(r => {
          if (r.subjectId) {
            subQ[r.subjectId] = (subQ[r.subjectId] || 0) + 1;
          }
        });
        localStats.subjectQuestions = subQ;

        onProgressUpdate({
          attempts: localAttempts,
          answeredQuestionIds: localAnswered,
          correctQuestionIds: localCorrect,
          totalStudyTimeSeconds: (userProgress.totalStudyTimeSeconds || 0) + finalExamDuration,
          quizHistory: [...(userProgress.quizHistory || []), quizAttempt],
          studySessions: [...(userProgress.studySessions || []), studySessionEntry],
          stats: localStats
        });
      }

      setCurrentQuizResults(quizResults);
      setScore(finalScore);
      
      try {
        await addDoc(collection(db, 'quizAttempts'), quizAttempt);
        await updateDoc(progressRef, updates);

        // Sync tested/studied topics to MedRevise if automatic mode is enabled
        if (questionsSyncMode === 'auto') {
          await syncQuizResultToMedRevise(questions, finalScore, finalExamDuration, undefined, quizResults);
        }
      } catch (err) {
        console.warn('Firestore write failed, saved in local-first cache:', err);
      }
      
      setScore(finalScore);
      setCurrentQuizResults(quizResults);
      setShowResults(true);
      setIsActive(false);
    } catch (err) {
      console.error('Error submitting exam:', err);
    } finally {
      setLoading(false);
    }
  };

  const redoQuestions = (selectedQuestions: Question[]) => {
    setQuestions(selectedQuestions.sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setScore(0);
    setShowResults(false);
    setIsAnswered(false);
    setSelectedOption(null);
    setAiExplanation(null);
    setIsActive(true);
    setSeconds(0);
    setSecondsRemaining(countdownMinutes * 60);
    setExamAnswers({});
    setIsSelecting(false);
    setShowAnswered(false);
    setShowHistory(false);
    setShowSaved(false);
  };

  const restart = () => redoQuestions(questions);

  const handleShowQuizDetail = async (quiz: QuizAttempt) => {
    setSelectedQuizForDetail(quiz);
    setLoadingDetail(true);
    setDetailQuestions([]);

    try {
      const qids = quiz.questions.map(q => q.questionId);
      const results: Question[] = [];
      
      // Fetch questions in chunks to avoid firestore 'in' limits
      for (let i = 0; i < qids.length; i += 10) {
        const chunk = qids.slice(i, i + 10);
        const q = query(collection(db, 'questions'), where('__name__', 'in', chunk));
        const snap = await getDocs(q);
        results.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Question)));
      }
      
      // Sort to match the order in the quiz attempt
      const sortedResults = qids.map(id => results.find(r => r.id === id)).filter(Boolean) as Question[];
      setDetailQuestions(sortedResults);
    } catch (error) {
      console.error('Error fetching quiz detail questions:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const [subjectSearch, setSubjectSearch] = useState('');

  const filteredSubjects = subjects.filter(s => 
    s.name.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  const toggleSubject = (sid: string) => {
    setSelectedSubjectIds(prev => 
      prev.includes(sid) ? prev.filter(i => i !== sid) : [...prev, sid]
    );
    // When changing subjects, we don't necessarily want to clear topics if they are from the selected subjects
    // But for simplicity of filtering, let's keep topics from the new valid set
  };

  const toggleTopic = (tid: string) => {
    setSelectedTopicIds(prev => 
      prev.includes(tid) ? prev.filter(i => i !== tid) : [...prev, tid]
    );
    // Don't clear subject selection anymore
  };

  const loadSelectedTopicsStats = async (tids: string[]) => {
    const uniqueTids = Array.from(new Set(tids)).filter(Boolean);
    if (uniqueTids.length === 0) {
      setTopicStatsMap({});
      return;
    }

    setTopicStatsMap(prev => {
      const next = { ...prev };
      uniqueTids.forEach(tid => {
        const { topicTitle, subjectName } = findTopicAndSubject(tid, topics, subjects);
        next[tid] = {
          topicId: tid,
          topicTitle,
          subjectName,
          questions: next[tid]?.questions || [],
          total: next[tid]?.total || 0,
          correct: next[tid]?.correct || 0,
          incorrect: next[tid]?.incorrect || 0,
          accuracy: next[tid]?.accuracy || 0,
          loading: true
        };
      });
      return next;
    });

    for (const tid of uniqueTids) {
      try {
        const q = query(collection(db, 'questions'), where('topicId', '==', tid), limit(150));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));

        let correct = 0;
        let incorrect = 0;
        docs.forEach(qDoc => {
          const attempt = userProgress?.attempts?.[qDoc.id];
          if (attempt) {
            if (attempt.isCorrect) correct++;
            else incorrect++;
          }
        });
        const answeredTotal = correct + incorrect;
        const accuracy = answeredTotal > 0 ? Math.round((correct / answeredTotal) * 100) : 0;
        const { topicTitle, subjectName } = findTopicAndSubject(tid, topics, subjects);

        setTopicStatsMap(prev => ({
          ...prev,
          [tid]: {
            topicId: tid,
            topicTitle,
            subjectName,
            questions: docs,
            total: docs.length,
            correct,
            incorrect,
            accuracy,
            loading: false
          }
        }));
      } catch (err) {
        console.error(`Error loading questions for topic ${tid}:`, err);
        setTopicStatsMap(prev => ({
          ...prev,
          [tid]: {
            ...(prev[tid] || {
              topicId: tid,
              topicTitle: tid,
              subjectName: 'Geral',
              questions: [],
              total: 0,
              correct: 0,
              incorrect: 0,
              accuracy: 0
            }),
            loading: false
          }
        }));
      }
    }
  };

  useEffect(() => {
    if (selectedTopicIds.length > 0) {
      loadSelectedTopicsStats(selectedTopicIds);
    } else {
      setTopicStatsMap({});
    }
  }, [selectedTopicIds, userProgress]);

  useEffect(() => {
    if (isTopicPreparing) {
      let filteredCount = topicPrepQuestions.length;
      if (filterUnanswered && userProgress) {
        const answeredIds = userProgress.answeredQuestionIds || [];
        filteredCount = topicPrepQuestions.filter(q => !answeredIds.includes(q.id)).length;
      }
      if (filterOnlyErrors && userProgress?.attempts) {
        filteredCount = topicPrepQuestions.filter(q => {
          const attempt = userProgress.attempts?.[q.id];
          return attempt && !attempt.isCorrect;
        }).length;
      }
      if (selectedCountFromExisting > filteredCount && filteredCount > 0) {
        setSelectedCountFromExisting(filteredCount);
      } else if (selectedCountFromExisting === 0 && filteredCount > 0) {
        setSelectedCountFromExisting(Math.min(10, filteredCount));
      }
    }
  }, [filterUnanswered, filterOnlyErrors, topicPrepQuestions, isTopicPreparing, userProgress, selectedCountFromExisting]);

  const handleGenerateTopicQuestions = async (countToGen: number, isAddingMore: boolean = false) => {
    const uniqueTids = Array.from(new Set(selectedTopicIds)).filter(Boolean);
    if (uniqueTids.length === 0) return;

    setIsGeneratingTopicQuestions(true);
    setGenerationProgress(5);
    setGenerationStatus("Conectando ao preceptor IA de residência...");

    const preset = EXAM_PRESETS.find(p => p.id === selectedPresetId);
    const targetExam = preset ? preset.name : undefined;
    const allAdded: Question[] = [];

    // Smooth progress simulation helper
    let progressInterval: NodeJS.Timeout | null = null;
    const simulateProgress = (start: number, end: number, durationMs: number) => {
      if (progressInterval) clearInterval(progressInterval);
      const steps = 20;
      const stepTime = durationMs / steps;
      const increment = (end - start) / steps;
      let current = start;
      progressInterval = setInterval(() => {
        current += increment;
        if (current >= end) {
          current = end;
          if (progressInterval) clearInterval(progressInterval);
        }
        setGenerationProgress(Math.min(98, Math.round(current)));
      }, stepTime);
    };

    try {
      // We will generate in batches of 5 questions to maintain progress updates
      const batchSize = 5;
      const batchesCount = Math.ceil(countToGen / batchSize);

      for (let b = 0; b < batchesCount; b++) {
        const currentBatchSize = Math.min(batchSize, countToGen - (b * batchSize));
        const batchStartPct = Math.round((b / batchesCount) * 80) + 5;
        const batchEndPct = Math.round(((b + 1) / batchesCount) * 80) + 5;

        setGenerationStatus(`Gerando questões: lote ${b + 1} de ${batchesCount}...`);
        simulateProgress(batchStartPct, batchEndPct - 10, 8000);

        for (const tid of uniqueTids) {
          const { topicTitle, subjectName, topicId, subjectId } = findTopicAndSubject(tid, topics, subjects);
          const existingTexts = [
            ...topicPrepQuestions.map(q => q.text),
            ...allAdded.map(q => q.text)
          ];

          const newQuestions = await generateQuestions(
            topicTitle, 
            subjectName, 
            currentBatchSize, 
            existingTexts, 
            userId, 
            targetExam
          );

          if (newQuestions && Array.isArray(newQuestions) && newQuestions.length > 0) {
            setGenerationStatus(`Gravando lote ${b + 1} de ${batchesCount} no banco de dados...`);
            setGenerationProgress(batchEndPct - 5);

            for (const qData of newQuestions) {
              const docRef = await addDoc(collection(db, 'questions'), {
                ...qData,
                topicId: topicId,
                subjectId: subjectId
              });
              allAdded.push({ id: docRef.id, ...qData, topicId: topicId, subjectId: subjectId } as Question);
            }
            safeLocalStorageRemove(`questions_topic_${topicId}`);
            if (subjectId) safeLocalStorageRemove(`questions_subject_${subjectId}`);
          }
        }
      }

      if (progressInterval) clearInterval(progressInterval);
      setGenerationProgress(95);
      setGenerationStatus("Sincronizando banco de dados local...");

      // Reload topic stats to update the dashboard counter
      await loadSelectedTopicsStats(uniqueTids);

      // Consolidate the entire pool of questions
      const finalQuestionsPool = isAddingMore 
        ? [...topicPrepQuestions, ...allAdded]
        : allAdded;

      if (finalQuestionsPool.length > 0) {
        setQuestions(finalQuestionsPool);
        setIsActive(true);
        setSeconds(0);
        setSecondsRemaining(Math.ceil(finalQuestionsPool.length * 1.5) * 60);
        setExamAnswers({});
        setCurrentIndex(0);
        setIsAnswered(false);
        setSelectedOption(null);
        setAiExplanation(null);
        setShowResults(false);
        
        setGenerationProgress(100);
        setGenerationStatus("Pronto! Iniciando simulado...");
        
        setTimeout(() => {
          setIsSelecting(false);
          setIsTopicPreparing(false);
          setIsGeneratingTopicQuestions(false);
        }, 1000);
      } else {
        throw new Error("Nenhuma questão pôde ser gerada.");
      }

    } catch (err: any) {
      if (progressInterval) clearInterval(progressInterval);
      console.error('Error generating questions:', err);
      alert(`Erro ao gerar novas questões: ${err?.message || 'Falha na comunicação com a IA.'}`);
      setIsGeneratingTopicQuestions(false);
    }
  };

  const handleStartWithExisting = async (countToUse: number) => {
    // Apply filters to topicPrepQuestions to get the actual list to slice
    let filteredList = [...topicPrepQuestions];
    if (filterUnanswered && userProgress) {
      const answeredIds = userProgress.answeredQuestionIds || [];
      filteredList = filteredList.filter(q => !answeredIds.includes(q.id));
    }
    if (filterOnlyErrors && userProgress?.attempts) {
      filteredList = filteredList.filter(q => {
        const attempt = userProgress.attempts?.[q.id];
        return attempt && !attempt.isCorrect;
      });
    }

    // If the available filtered questions are fewer than the user selected, auto-generate the missing ones!
    if (filteredList.length < countToUse) {
      const missingCount = countToUse - filteredList.length;
      const uniqueTids = Array.from(new Set(selectedTopicIds)).filter(Boolean);
      
      if (uniqueTids.length > 0) {
        setIsGeneratingTopicQuestions(true);
        setGenerationProgress(10);
        setGenerationStatus(`Identificado: faltam ${missingCount} questões para atingir a meta de ${countToUse}. Gerando com IA...`);

        const preset = EXAM_PRESETS.find(p => p.id === selectedPresetId);
        const targetExam = preset ? preset.name : undefined;
        const allAdded: Question[] = [];

        try {
          const batchSize = 5;
          const batchesCount = Math.ceil(missingCount / batchSize);

          for (let b = 0; b < batchesCount; b++) {
            const currentBatchSize = Math.min(batchSize, missingCount - (b * batchSize));
            setGenerationStatus(`Gerando lote de questões faltantes: ${b + 1} de ${batchesCount}...`);
            setGenerationProgress(Math.round(((b + 1) / (batchesCount + 1)) * 80) + 10);

            for (const tid of uniqueTids) {
              const { topicTitle, subjectName, topicId, subjectId } = findTopicAndSubject(tid, topics, subjects);
              const existingTexts = [
                ...topicPrepQuestions.map(q => q.text),
                ...allAdded.map(q => q.text)
              ];

              const newQuestions = await generateQuestions(
                topicTitle,
                subjectName,
                currentBatchSize,
                existingTexts,
                userId,
                targetExam
              );

              if (newQuestions && Array.isArray(newQuestions) && newQuestions.length > 0) {
                for (const qData of newQuestions) {
                  const docRef = await addDoc(collection(db, 'questions'), {
                    ...qData,
                    topicId: topicId,
                    subjectId: subjectId
                  });
                  const qObj = { id: docRef.id, ...qData, topicId: topicId, subjectId: subjectId } as Question;
                  allAdded.push(qObj);
                  filteredList.push(qObj);
                }
                safeLocalStorageRemove(`questions_topic_${topicId}`);
                if (subjectId) safeLocalStorageRemove(`questions_subject_${subjectId}`);
              }
            }
          }

          setGenerationProgress(95);
          setGenerationStatus("Sincronizando novas questões com seu simulado...");
          await loadSelectedTopicsStats(uniqueTids);

        } catch (err: any) {
          console.warn('Auto-generation of missing questions failed:', err);
          alert(`Aviso: não foi possível gerar todas as questões faltantes (${err.message || 'IA offline'}). Iniciando com as disponíveis.`);
        } finally {
          setIsGeneratingTopicQuestions(false);
        }
      }
    }

    const shuffled = filteredList.sort(() => Math.random() - 0.5);
    const finalSelection = shuffled.slice(0, countToUse);

    if (finalSelection.length === 0) {
      alert('Nenhuma questão encontrada ou gerada para os filtros selecionados.');
      return;
    }

    setQuestions(finalSelection);
    setIsActive(true);
    setSeconds(0);
    setSecondsRemaining(Math.ceil(finalSelection.length * 1.5) * 60);
    setExamAnswers({});
    setCurrentIndex(0);
    setIsAnswered(false);
    setSelectedOption(null);
    setAiExplanation(null);
    setShowResults(false);
    
    setIsSelecting(false);
    setIsTopicPreparing(false);
  };

  const handleGenerateMoreForTopic = async (tid: string, countToGen: number = 5) => {
    setGeneratingTopicId(tid);
    try {
      const { topicTitle, subjectName, topicId, subjectId } = findTopicAndSubject(tid, topics, subjects);
      const existing = topicStatsMap[tid]?.questions?.map(q => q.text) || [];
      const preset = EXAM_PRESETS.find(p => p.id === selectedPresetId);
      const targetExam = preset ? preset.name : undefined;

      const newQuestions = await generateQuestions(topicTitle, subjectName, countToGen, existing, userId, targetExam);
      if (newQuestions && Array.isArray(newQuestions) && newQuestions.length > 0) {
        const added: Question[] = [];
        for (const qData of newQuestions) {
          const docRef = await addDoc(collection(db, 'questions'), {
            ...qData,
            topicId: topicId,
            subjectId: subjectId
          });
          added.push({ id: docRef.id, ...qData, topicId: topicId, subjectId: subjectId } as Question);
        }
        safeLocalStorageRemove(`questions_topic_${topicId}`);
        if (subjectId) safeLocalStorageRemove(`questions_subject_${subjectId}`);
        
        await loadSelectedTopicsStats([topicId]);
        alert(`${added.length} novas questões foram geradas com sucesso para o tópico "${topicTitle}"!`);
      } else {
        alert('Não foi possível gerar mais questões para este tópico no momento.');
      }
    } catch (err: any) {
      console.error(`Error generating questions for topic ${tid}:`, err);
      alert(`Erro ao gerar questões: ${err?.message || 'Falha na comunicação com a IA.'}`);
    } finally {
      setGeneratingTopicId(null);
    }
  };

  const handleDeleteTopicQuestion = async (questionId: string, topicId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta questão do banco de dados?')) {
      return;
    }
    setDeletingQuestionId(questionId);
    try {
      await deleteDoc(doc(db, 'questions', questionId));
      safeLocalStorageRemove(`questions_topic_${topicId}`);

      setTopicStatsMap(prev => {
        const topicData = prev[topicId];
        if (!topicData) return prev;
        const updatedQs = topicData.questions.filter(q => q.id !== questionId);
        return {
          ...prev,
          [topicId]: {
            ...topicData,
            questions: updatedQs,
            total: updatedQs.length
          }
        };
      });

      setQuestions(prev => prev.filter(q => q.id !== questionId));
      alert('Questão excluída com sucesso!');
    } catch (err: any) {
      console.error('Error deleting question:', err);
      alert(`Erro ao excluir questão: ${err?.message || 'Erro desconhecido.'}`);
    } finally {
      setDeletingQuestionId(null);
    }
  };

  const handleDeleteAllTopicQuestions = async (topicId: string) => {
    const topicData = topicStatsMap[topicId];
    if (!topicData || topicData.questions.length === 0) return;
    
    if (!window.confirm(`Tem certeza que deseja excluir TODAS as ${topicData.questions.length} questões cadastradas para o tópico "${topicData.topicTitle}"?`)) {
      return;
    }
    
    try {
      for (const q of topicData.questions) {
        await deleteDoc(doc(db, 'questions', q.id));
      }
      safeLocalStorageRemove(`questions_topic_${topicId}`);
      
      setTopicStatsMap(prev => ({
        ...prev,
        [topicId]: {
          ...prev[topicId],
          questions: [],
          total: 0,
          correct: 0,
          incorrect: 0,
          accuracy: 0
        }
      }));

      alert(`Todas as questões do tópico "${topicData.topicTitle}" foram excluídas com sucesso.`);
    } catch (err: any) {
      console.error('Error deleting all questions for topic:', err);
      alert('Erro ao excluir questões: ' + (err?.message || 'Falha na operação.'));
    }
  };

  const handleLoadMore = async () => {
    const uniqueTids = Array.from(new Set(selectedTopicIds)).filter(Boolean);
    if (uniqueTids.length === 0) {
      alert('Selecione um ou mais temas específicos para gerar mais questões focadas.');
      return;
    }
    
    setIsGeneratingMore(true);
    const preset = EXAM_PRESETS.find(p => p.id === selectedPresetId);
    const targetExam = preset ? preset.name : undefined;
    const allAdded: Question[] = [];
    
    try {
      for (const tid of uniqueTids) {
        const { topicTitle, subjectName, topicId, subjectId } = findTopicAndSubject(tid, topics, subjects);
        const existingTexts = questions.map(q => q.text);
        
        try {
          const newQuestions = await generateQuestions(topicTitle, subjectName, numQuestionsPerTopic || 5, existingTexts, userId, targetExam);
          
          if (newQuestions && Array.isArray(newQuestions) && newQuestions.length > 0) {
            const addedQuestions: Question[] = [];
            for (const qData of newQuestions) {
              const docRef = await addDoc(collection(db, 'questions'), {
                ...qData,
                topicId: topicId,
                subjectId: subjectId
              });
              addedQuestions.push({ id: docRef.id, ...qData, topicId: topicId, subjectId: subjectId } as Question);
            }
            allAdded.push(...addedQuestions);
            safeLocalStorageRemove(`questions_topic_${topicId}`);
            if (subjectId) safeLocalStorageRemove(`questions_subject_${subjectId}`);
          }
        } catch (genErr) {
          console.warn(`Error generating questions for topic ${topicTitle}:`, genErr);
        }
      }
      safeLocalStorageRemove('questions_fallback');

      if (allAdded.length > 0) {
        await loadSelectedTopicsStats(uniqueTids);
        const updatedList = [...questions, ...allAdded];
        setQuestions(updatedList);
        setIsActive(true);
        setIsSelecting(false);
        setSeconds(0);
        setSecondsRemaining(countdownMinutes * 60);
        setExamAnswers({});
        setCurrentIndex(0);
        setIsAnswered(false);
        setSelectedOption(null);
        setAiExplanation(null);
        setShowResults(false);
        alert(`${allAdded.length} novas questões foram geradas com sucesso! Iniciando simulado...`);
      } else {
        alert('Não foi possível gerar novas questões no momento. Tente novamente.');
      }
    } catch (err: any) {
      console.error('Error generating questions:', err);
      alert(`Erro ao gerar novas questões: ${err?.message || 'Falha na comunicação com a IA.'}`);
    } finally {
      setIsGeneratingMore(false);
    }
  };

  const handleExplainWithAI = async () => {
    if (!isAnswered) return;
    setIsExplaining(true);
    const currentQuestion = questions[currentIndex];
    const explanation = await explainQuestion(
      currentQuestion.text,
      currentQuestion.options,
      currentQuestion.correctOptionIndex,
      userId
    );
    if (explanation) {
      setAiExplanation(explanation);
    }
    setIsExplaining(false);
  };

  if (loading) return <div className="text-center py-20">Carregando questões...</div>;

  if (isTopicPreparing) {
    const activeTid = selectedTopicIds[0];
    const topicObj = topics.find(t => t.id === activeTid);
    const subjectObj = subjects.find(s => s.id === topicObj?.subjectId);
    
    let filteredList = [...topicPrepQuestions];
    if (filterUnanswered && userProgress) {
      const answeredIds = userProgress.answeredQuestionIds || [];
      filteredList = filteredList.filter(q => !answeredIds.includes(q.id));
    }
    if (filterOnlyErrors && userProgress?.attempts) {
      filteredList = filteredList.filter(q => {
        const attempt = userProgress.attempts?.[q.id];
        return attempt && !attempt.isCorrect;
      });
    }
    const existingCount = filteredList.length;

    return (
      <div className="max-w-3xl mx-auto py-10 px-4">
        <div className="bg-white rounded-3xl border border-[#E2E0D9] p-8 space-y-8 shadow-sm">
          {/* Header with Back button */}
          <div className="flex items-center justify-between border-b border-[#E2E0D9] pb-6">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  setIsTopicPreparing(false);
                  setSelectedTopicIds([]);
                  setQuestions([]);
                  setIsSelecting(true);
                }}
                className="h-9 w-9 rounded-xl hover:bg-slate-100"
              >
                <ArrowLeft className="w-5 h-5 text-stone-600" />
              </Button>
              <div>
                <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase tracking-wider mb-1">
                  {subjectObj?.name || 'MedInternato'}
                </Badge>
                <h2 className="text-2xl font-display font-black leading-tight text-[#1A1A1A]">
                  {topicObj?.title || 'Preparando Simulado'}
                </h2>
              </div>
            </div>
            
            <Button 
              variant="outline"
              size="sm"
              onClick={() => {
                setIsTopicPreparing(false);
                setSelectedTopicIds([]);
                setQuestions([]);
                setIsSelecting(true);
              }}
              className="rounded-xl text-[10px] uppercase font-bold tracking-widest"
            >
              Cancelar
            </Button>
          </div>

          {/* If currently generating with IA, show the progressive status screen */}
          {isGeneratingTopicQuestions ? (
            <div className="py-12 space-y-8 text-center">
              <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                {/* Spinner & Percent circle */}
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                <div 
                  className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" 
                  style={{ animationDuration: '2s' }}
                />
                <span className="text-2xl font-display font-black text-primary">
                  {generationProgress}%
                </span>
              </div>
              
              <div className="space-y-3 max-w-md mx-auto">
                <h3 className="text-lg font-display font-bold text-[#1A1A1A]">
                  Buscando questões estruturadas...
                </h3>
                <p className="text-sm text-[#8E8A82] font-semibold">
                  {generationStatus}
                </p>
              </div>

              {/* Progress bar container */}
              <div className="w-full max-w-md mx-auto bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full rounded-full transition-all duration-300" 
                  style={{ width: `${generationProgress}%` }}
                />
              </div>

              <p className="text-[10px] text-[#8E8A82] uppercase tracking-widest font-black max-w-sm mx-auto leading-relaxed">
                Isso pode levar de 15 a 30 segundos. Buscando e organizando questões reais das bancas de residência médica.
              </p>
            </div>
          ) : (
            // The choice screens
            <div className="space-y-8">
              {existingCount === 0 ? (
                /* SCREEN 1: No existing questions */
                <div className="space-y-6">
                  <div className="p-6 bg-amber-50/50 border border-amber-200/60 rounded-2xl flex gap-4 items-start">
                    <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-900 text-sm">Banco de dados vazio para este tema</h4>
                      <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        Você ainda não possui nenhuma questão buscada para este tópico. Escolha abaixo a quantidade de questões que deseja buscar do acervo agora mesmo!
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <span className="text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">
                      Quantidade de questões a serem buscadas:
                    </span>
                    <div className="grid grid-cols-4 gap-3">
                      {[5, 10, 15, 20].map((qty) => (
                        <button
                          key={`qty-choice-${qty}`}
                          type="button"
                          onClick={() => setNumQuestionsPerTopic(qty)}
                          className={cn(
                            "py-4 rounded-xl border text-sm font-black transition-all flex flex-col items-center justify-center gap-1",
                            numQuestionsPerTopic === qty 
                              ? "bg-primary/5 border-primary text-primary shadow-sm" 
                              : "bg-white border-[#E2E0D9] text-[#1A1A1A] hover:bg-slate-50"
                          )}
                        >
                          <span className="text-lg font-display">{qty}</span>
                          <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#8E8A82]">Questões</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#E2E0D9] flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <p className="text-[10px] text-[#8E8A82] font-semibold max-w-md leading-normal uppercase">
                      Custo estimado: {Math.max(3, Math.ceil((numQuestionsPerTopic / 5) * 3))} créditos de busca no acervo.
                    </p>
                    <Button 
                      onClick={() => handleGenerateTopicQuestions(numQuestionsPerTopic)}
                      className="bg-primary text-white text-xs uppercase tracking-widest font-black px-8 h-12 rounded-xl gap-2 w-full sm:w-auto"
                    >
                      <Sparkles className="w-4 h-4" />
                      Buscar {numQuestionsPerTopic} Questões e Começar
                    </Button>
                  </div>
                </div>
              ) : (
                /* SCREEN 2: Existing questions found */
                <div className="space-y-8">
                  <div className="p-6 bg-emerald-50/50 border border-emerald-200/60 rounded-2xl flex gap-4 items-start">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-emerald-900 text-sm">Questões encontradas no seu banco de dados</h4>
                      <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                        Encontramos um total de <strong className="font-black">{existingCount}</strong> questões já prontas no acervo para o tópico <strong>"{topicObj?.title}"</strong>. Escolha como gostaria de prosseguir abaixo.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Block A: Solve Existing */}
                    <div className="border border-[#E2E0D9] rounded-2xl p-6 space-y-4 flex flex-col justify-between bg-[#FAF9F6]">
                      <div className="space-y-2">
                        <h4 className="font-display font-black text-sm text-[#1A1A1A] uppercase tracking-wider">
                          1. Usar Questões Existentes
                        </h4>
                        <p className="text-xs text-[#8E8A82] leading-normal font-semibold">
                          Inicie o simulado imediatamente utilizando as questões já disponíveis no seu banco de dados local.
                        </p>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-[#E2E0D9]/60">
                        {/* Custom visual filter toggles for Screen 2 */}
                        <div className="space-y-3 pb-3 border-b border-[#E2E0D9]/40">
                          <span className="text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">Filtros Rápidos</span>
                          <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div 
                                onClick={() => setFilterUnanswered(!filterUnanswered)}
                                className={cn(
                                  "w-8 h-5 rounded-full transition-colors relative shrink-0",
                                  filterUnanswered ? "bg-primary" : "bg-[#E2E0D9]"
                                )}
                              >
                                <div className={cn(
                                  "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform",
                                  filterUnanswered ? "translate-x-3" : ""
                                )} />
                              </div>
                              <span className="text-[10px] uppercase tracking-widest font-bold text-stone-600 group-hover:text-primary transition-colors">Apenas não respondidas</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer group">
                              <div 
                                onClick={() => setFilterOnlyErrors(!filterOnlyErrors)}
                                className={cn(
                                  "w-8 h-5 rounded-full transition-colors relative shrink-0",
                                  filterOnlyErrors ? "bg-primary" : "bg-[#E2E0D9]"
                                )}
                              >
                                <div className={cn(
                                  "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform",
                                  filterOnlyErrors ? "translate-x-3" : ""
                                )} />
                              </div>
                              <span className="text-[10px] uppercase tracking-widest font-bold text-stone-600 group-hover:text-primary transition-colors">Apenas erros anteriores</span>
                            </label>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">
                            Quantas questões deseja responder:
                          </label>
                          <select 
                            value={selectedCountFromExisting}
                            onChange={(e) => setSelectedCountFromExisting(Number(e.target.value))}
                            className="w-full bg-white border border-[#E2E0D9] rounded-xl px-3 py-2.5 text-xs font-bold text-[#1A1A1A] outline-none focus:border-primary cursor-pointer"
                          >
                            {[5, 10, 15, 20, 25, 30].map(qty => {
                              if (qty <= existingCount) {
                                return <option key={`existing-qty-${qty}`} value={qty}>{qty} questões (todas prontas)</option>;
                              } else {
                                const diff = qty - existingCount;
                                return <option key={`existing-qty-${qty}`} value={qty}>{qty} questões ({existingCount} prontas + {diff} buscadas via IA)</option>;
                              }
                            })}
                            {existingCount > 0 && ![5, 10, 15, 20, 25, 30].includes(existingCount) && (
                              <option value={existingCount}>Todas as {existingCount} questões prontas</option>
                            )}
                          </select>
                        </div>

                        <Button 
                          onClick={() => handleStartWithExisting(selectedCountFromExisting)}
                          disabled={selectedCountFromExisting <= 0}
                          className={cn(
                            "w-full text-white text-[10px] uppercase tracking-widest font-black h-12 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all",
                            selectedCountFromExisting <= existingCount
                              ? "bg-stone-900 hover:bg-black"
                              : "bg-primary hover:bg-primary/95 shadow-primary/20"
                          )}
                        >
                          {selectedCountFromExisting <= existingCount ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              Iniciar com {selectedCountFromExisting} Questões
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-amber-300" />
                              Iniciar {selectedCountFromExisting} ({existingCount} prontas + buscar {selectedCountFromExisting - existingCount} com IA)
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Block B: Generate More */}
                    <div className="border border-primary/20 rounded-2xl p-6 space-y-4 flex flex-col justify-between bg-primary/[0.01]">
                      <div className="space-y-2">
                        <h4 className="font-display font-black text-sm text-primary uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" />
                          2. Buscar mais com IA
                        </h4>
                        <p className="text-xs text-[#8E8A82] leading-normal font-semibold">
                          Deseja testar questões de bancas oficiais? Busque mais questões na íntegra palavra por palavra com nosso motor de IA.
                        </p>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-primary/10">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">
                            Buscar mais quantas questões:
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            {[5, 10, 15, 20].map((qty) => (
                              <button
                                key={`gen-more-${qty}`}
                                type="button"
                                onClick={() => setNumQuestionsPerTopic(qty)}
                                className={cn(
                                  "py-2 rounded-lg border text-xs font-black transition-all",
                                  numQuestionsPerTopic === qty 
                                    ? "bg-primary/5 border-primary text-primary" 
                                    : "bg-white border-[#E2E0D9] text-[#1A1A1A] hover:bg-slate-50"
                                )}
                              >
                                +{qty}
                              </button>
                            ))}
                          </div>
                        </div>

                        <Button 
                          onClick={() => handleGenerateTopicQuestions(numQuestionsPerTopic, true)}
                          className="w-full bg-primary text-white text-[10px] uppercase tracking-widest font-black h-11 rounded-xl gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Buscar +{numQuestionsPerTopic} e Iniciar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isSelecting || questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="flex flex-col lg:flex-row gap-4 items-center bg-white p-6 rounded-2xl border border-[#E2E0D9]">
          <h1 className="text-3xl font-display font-black flex-1">Questões & Simulados</h1>
          <div className="flex flex-wrap lg:flex-nowrap gap-3 w-full lg:w-auto">
            <Button 
              variant={showHistory ? "default" : "outline"} 
              onClick={() => { setShowHistory(!showHistory); setShowAnswered(false); setShowSaved(false); }}
              className="flex-1 lg:flex-initial rounded-xl text-[10px] uppercase font-bold tracking-widest gap-2"
            >
              <Clock className="w-4 h-4" />
              {showHistory ? 'Esconder Histórico' : 'Ver Histórico'}
            </Button>
            <Button 
              variant={showAnswered ? "default" : "outline"} 
              onClick={() => { setShowAnswered(!showAnswered); setShowHistory(false); setShowSaved(false); }}
              className="flex-1 lg:flex-initial rounded-xl text-[10px] uppercase font-bold tracking-widest gap-2"
            >
              <BookCheck className="w-4 h-4" />
              {showAnswered ? 'Esconder Resolvidas' : 'Minhas Resolvidas'}
            </Button>
            <Button 
              variant={showSaved ? "default" : "outline"} 
              onClick={() => { setShowSaved(!showSaved); setShowHistory(false); setShowAnswered(false); }}
              className="flex-1 lg:flex-initial rounded-xl text-[10px] uppercase font-bold tracking-widest gap-2 relative"
            >
              <Bookmark className="w-4 h-4" />
              {showSaved ? 'Esconder Marcadas' : 'Questões Salvas'}
              {userProgress?.flaggedQuestionIds?.length ? (
                <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[8px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center border border-white">
                  {userProgress.flaggedQuestionIds?.length || 0}
                </span>
              ) : null}
            </Button>
          </div>
        </div>

        {showHistory && (
          <div className="space-y-6">
            <h3 className="text-[11px] uppercase tracking-widest font-black text-[#8E8A82]">Histórico de Execuções</h3>
            {loadingHistory ? (
              <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : quizHistory.length === 0 ? (
              <p className="text-center py-10 text-[#8E8A82] italic">Nenhum simulado realizado ainda.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {quizHistory.map((quiz, qIdx) => {
                  const date = new Date(quiz.timestamp).toLocaleDateString();
                  const time = new Date(quiz.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const subjectNames = quiz.subjectIds.map(sid => subjects.find(s => s.id === sid)?.name).filter(Boolean).join(', ');
                  
                  return (
                    <Card 
                      key={`quiz-hist-${quiz.id}-${qIdx}`} 
                      className="border-[#E2E0D9] shadow-none rounded-xl overflow-hidden hover:border-primary transition-colors cursor-pointer"
                      onClick={() => handleShowQuizDetail(quiz)}
                    >
                      <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="space-y-2 text-center md:text-left">
                          <div className="flex items-center gap-2 justify-center md:justify-start">
                             <Badge className={cn("text-[9px] uppercase font-black", quiz.type === 'simulado' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700")}>
                               {quiz.type}
                             </Badge>
                             <span className="text-[10px] font-bold text-[#8E8A82]">{date} às {time}</span>
                          </div>
                          <h4 className="text-lg font-display font-bold leading-tight line-clamp-1">{subjectNames || 'Multidisciplinar'}</h4>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Array.from(new Set(quiz.subjectIds || [])).map(sid => {
                              const s = subjects.find(sub => sub.id === sid);
                              return (
                                <Badge key={sid} variant="outline" className="text-[8px] font-bold py-0 h-4 border-[#E2E0D9]">
                                  {s?.name || 'Geral'}
                                </Badge>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-[#8E8A82] uppercase tracking-widest font-bold pt-2">
                            {quiz.totalQuestions} Questões • {Math.round(quiz.timeSpentSeconds / 60)} min
                          </p>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-center">
                            <div className="text-3xl font-display font-black text-primary">{Math.round((quiz.score / quiz.totalQuestions) * 100)}%</div>
                            <div className="text-[9px] uppercase font-black text-[#8E8A82]">Desempenho</div>
                          </div>
                          <div className="w-px h-10 bg-[#E2E0D9]"></div>
                          <div className="text-center">
                            <div className="text-2xl font-display font-black text-green-600">{quiz.score}</div>
                            <div className="text-[9px] uppercase font-black text-[#8E8A82]">Acertos</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            <Separator className="bg-[#E2E0D9]" />
          </div>
        )}

        {showAnswered && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <h3 className="text-[11px] uppercase tracking-widest font-black text-[#8E8A82]">Banco de Questões Resolvidas</h3>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select 
                  className="flex-1 sm:flex-initial bg-white border border-[#E2E0D9] rounded-full px-4 h-8 text-[10px] font-bold outline-none"
                  value={selectedSubjectIds[0] || ''}
                  onChange={(e) => setSelectedSubjectIds(e.target.value ? [e.target.value] : [])}
                >
                  <option value="">Todas as Matérias</option>
                  {subjects.map((s, sIdx) => (
                    <option key={`q-subj-opt-${s.id}-${sIdx}`} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {answeredQuestions.length > 0 && (
                  <Button 
                    onClick={() => redoQuestions(answeredQuestions.filter(q => selectedSubjectIds.length === 0 || selectedSubjectIds.includes(q.subjectId || '')))}
                    className="bg-primary text-white text-[9px] uppercase font-black tracking-widest px-4 h-8 rounded-full gap-2 shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" /> Refazer Filtradas
                  </Button>
                )}
              </div>
            </div>
            
            {loadingAnswered ? (
              <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : answeredQuestions.length === 0 ? (
              <p className="text-center py-10 text-[#8E8A82] italic">Você ainda não respondeu nenhuma questão.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {answeredQuestions
                  .filter(q => selectedSubjectIds.length === 0 || selectedSubjectIds.includes(q.subjectId || ''))
                  .map((q, qIdx) => {
                  const subject = subjects.find(s => s.id === q.subjectId);
                  const attempt = userProgress?.attempts?.[q.id];
                  
                  return (
                    <Card key={`ans-q-${q.id}-${qIdx}`} className="border-[#E2E0D9] shadow-none rounded-xl overflow-hidden">
                      <CardContent className="p-5 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[8px] font-bold py-0 h-4 border-[#E2E0D9]">
                              {subject?.name || 'Geral'}
                            </Badge>
                            {attempt && (
                              <Badge className={cn("text-[8px] font-bold py-0 h-4", attempt.isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                                {attempt.isCorrect ? 'Acerto' : 'Erro'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium line-clamp-1">{q.text}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => redoQuestions([q])}
                          className="text-primary gap-2 hover:bg-primary/5 text-[9px] uppercase font-bold"
                        >
                          <RotateCcw className="w-3 h-3" /> Refazer
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            <Separator className="bg-[#E2E0D9]" />
          </div>
        )}

        {showSaved && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <h3 className="text-[11px] uppercase tracking-widest font-black text-[#8E8A82]">Banco de Questões Salvas</h3>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select 
                  className="flex-1 sm:flex-initial bg-white border border-[#E2E0D9] rounded-full px-4 h-8 text-[10px] font-bold outline-none cursor-pointer"
                  value={selectedSubjectIds[0] || ''}
                  onChange={(e) => setSelectedSubjectIds(e.target.value ? [e.target.value] : [])}
                >
                  <option value="">Todas as Matérias</option>
                  {subjects.map((s, sIdx) => (
                    <option key={`q-subj-${s.id}-${sIdx}`} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {savedQuestions.length > 0 && (
                  <Button 
                    onClick={() => redoQuestions(savedQuestions.filter(q => selectedSubjectIds.length === 0 || selectedSubjectIds.includes(q.subjectId || '')))}
                    className="bg-primary text-white text-[9px] uppercase font-black tracking-widest px-4 h-8 rounded-full gap-2 shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" /> Refazer Filtradas
                  </Button>
                )}
              </div>
            </div>
            
            {loadingSaved ? (
              <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : savedQuestions.length === 0 ? (
              <p className="text-center py-10 text-[#8E8A82] italic">Você ainda não possui questões salvas.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {savedQuestions
                  .filter(q => selectedSubjectIds.length === 0 || selectedSubjectIds.includes(q.subjectId || ''))
                  .map((q, qIdx) => {
                  const subject = subjects.find(s => s.id === q.subjectId);
                  
                  return (
                    <Card key={`saved-q-${q.id}-${qIdx}`} className="border-[#E2E0D9] shadow-none rounded-xl overflow-hidden">
                      <CardContent className="p-5 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-[8px] font-bold py-0 h-4 border-[#E2E0D9]">
                              {subject?.name || 'Geral'}
                            </Badge>
                            {q.source && (
                              <Badge variant="outline" className="text-[8px] font-bold py-0 h-4 bg-[#FFFBF0] text-amber-700 border-[#FFEAB6]">
                                {q.source}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium line-clamp-2 text-[#3D3A35] mt-1">{q.text}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => redoQuestions([q])}
                            className="text-primary gap-2 hover:bg-primary/5 text-[9px] uppercase font-black px-3 h-8 rounded-lg"
                          >
                            <RotateCcw className="w-3 h-3" /> Refazer
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleFlagForQuestion(q.id)}
                            className="text-amber-500 hover:bg-amber-50 h-8 w-8 rounded-lg shrink-0"
                            title="Remover das Salvas"
                          >
                            <Bookmark className="w-4 h-4 fill-amber-500" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            <Separator className="bg-[#E2E0D9]" />
          </div>
        )}

        <div className="bg-[#FBFBFA] p-8 rounded-2xl border border-[#E2E0D9] space-y-8">
          
          {/* BANNER DE RIGOR E ORIGEM DAS QUESTÕES */}
          <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-5 flex gap-4 items-start">
            <div className="p-2 bg-orange-100/80 rounded-xl text-orange-600 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-display font-bold text-orange-950">Rigor de Transcrição e Foco das Questões</h4>
              <p className="text-xs text-orange-900/80 leading-relaxed font-medium">
                As questões do nosso banco de simulados são transcritas <strong className="text-orange-950">integralmente e ipso litteris (ipsis litteris)</strong>, reproduzindo exatamente como caíram nas provas reais, sem qualquer abreviação, resumo ou simplificação didática.
              </p>
              <p className="text-xs text-orange-900/80 leading-relaxed font-medium">
                Por diretriz pedagógica rigorosa, priorizamos de forma estrita questões dos últimos 5 anos de: <strong className="text-orange-950">SUS-GO, SES-DF, SES-GO, Hospital de Base de Brasília (HBDF) e ENARE</strong>. Questões de outras instituições nacionais recentes só serão incorporadas caso não haja questões suficientes destas cinco bancas prioritárias para o tema selecionado.
              </p>
            </div>
          </div>

          {/* SELETOR DE METODOLOGIA DO SIMULADO */}
          <div className="space-y-4">
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82]">Metodologia do Simulado</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* 1. Custom / Personalizado */}
              <button
                type="button"
                onClick={() => setSimuladoMode('custom')}
                className={cn(
                  "p-5 text-left rounded-2xl border transition-all flex flex-col justify-between gap-4 h-32 bg-white",
                  simuladoMode === 'custom'
                    ? "border-primary ring-2 ring-primary/10 shadow-sm"
                    : "border-[#E2E0D9] hover:border-[#8E8A82]/50"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="p-1.5 rounded-xl bg-orange-50 border border-orange-100">
                    <SlidersHorizontal className="w-4 h-4 text-orange-600" />
                  </div>
                  {simuladoMode === 'custom' && <Badge className="bg-primary hover:bg-primary text-white text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0">Ativo</Badge>}
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-[11px] uppercase tracking-wider font-black text-[#1A1A1A]">Filtro Personalizado</h4>
                  <p className="text-[9px] text-[#8E8A82] leading-normal font-medium">Selecione matérias, temas específicos e pesos de questões livremente.</p>
                </div>
              </button>

              {/* 2. Seleção Granular por Banca & Ano */}
              <button
                type="button"
                onClick={() => setSimuladoMode('banca-year')}
                className={cn(
                  "p-5 text-left rounded-2xl border transition-all flex flex-col justify-between gap-4 h-32 bg-white relative overflow-hidden",
                  simuladoMode === 'banca-year'
                    ? "border-purple-600 ring-2 ring-purple-600/10 shadow-sm"
                    : "border-[#E2E0D9] hover:border-purple-500/40"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="p-1.5 rounded-xl bg-purple-50 border border-purple-100">
                    <Building2 className="w-4 h-4 text-purple-600" />
                  </div>
                  {simuladoMode === 'banca-year' ? (
                    <Badge className="bg-purple-600 hover:bg-purple-600 text-white text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0">Ativo</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full shrink-0 gap-0.5">
                      <Sparkles className="w-2.5 h-2.5 fill-amber-600 text-amber-600" />
                      Bancas Foco
                    </Badge>
                  )}
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-[11px] uppercase tracking-wider font-black text-[#1A1A1A]">Matriz por Banca & Ano</h4>
                  <p className="text-[9px] text-[#8E8A82] leading-normal font-medium">Veja disponibilidade e defina quantidades por ano com destaque para suas bancas preferidas.</p>
                </div>
              </button>

              {/* 3. Erros Históricos IA */}
              <button
                type="button"
                onClick={() => setSimuladoMode('ai-errors')}
                className={cn(
                  "p-5 text-left rounded-2xl border transition-all flex flex-col justify-between gap-4 h-32 bg-white",
                  simuladoMode === 'ai-errors'
                    ? "border-red-500 ring-2 ring-red-500/10 shadow-sm"
                    : "border-[#E2E0D9] hover:border-[#8E8A82]/50"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="p-1.5 rounded-xl bg-red-50 border border-red-100">
                    <Brain className="w-4 h-4 text-red-600" />
                  </div>
                  {simuladoMode === 'ai-errors' && <Badge className="bg-red-500 hover:bg-red-500 text-white text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0">Ativo</Badge>}
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-[11px] uppercase tracking-wider font-black text-[#1A1A1A]">Erros do Último Mês (IA)</h4>
                  <p className="text-[9px] text-[#8E8A82] leading-normal font-medium">Reúne de forma autônoma as matérias onde você mais cometeu erros recentemente.</p>
                </div>
              </button>

              {/* 4. Banca Real / Distribuição oficial */}
              <button
                type="button"
                onClick={() => setSimuladoMode('official-ratio')}
                className={cn(
                  "p-5 text-left rounded-2xl border transition-all flex flex-col justify-between gap-4 h-32 bg-white",
                  simuladoMode === 'official-ratio'
                    ? "border-amber-500 ring-2 ring-amber-500/10 shadow-sm"
                    : "border-[#E2E0D9] hover:border-[#8E8A82]/50"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="p-1.5 rounded-xl bg-amber-50 border border-amber-100">
                    <Trophy className="w-4 h-4 text-amber-600" />
                  </div>
                  {simuladoMode === 'official-ratio' && <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0">Ativo</Badge>}
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-[11px] uppercase tracking-wider font-black text-[#1A1A1A]">Distribuição de Banca</h4>
                  <p className="text-[9px] text-[#8E8A82] leading-normal font-medium">Cria provas com a exata equivalência e peso de editais reais como SES-DF e ENARE.</p>
                </div>
              </button>

            </div>
          </div>

          <Separator className="bg-[#E2E0D9]/65" />

          {/* RENDERING DE ACORDO COM O MODO DE SIMULADO ATIVO */}

          {/* MODO 1: FILTRO PERSONALIZADO */}
          {simuladoMode === 'custom' && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82]">Matérias</label>
                    <div className="relative">
                      <input
                        id="subject-search"
                        name="subjectSearch"
                        type="text"
                        placeholder="Pesquisar matéria..."
                        value={subjectSearch}
                        onChange={(e) => setSubjectSearch(e.target.value)}
                        className="h-8 text-[10px] pl-8 pr-4 border border-[#E2E0D9] rounded-full bg-white outline-none focus:border-primary/50 transition-colors w-40"
                      />
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[#8E8A82]" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto no-scrollbar pr-2">
                    {filteredSubjects.map((s, sIdx) => {
                      const isSubjectSelected = selectedSubjectIds.includes(s.id);
                      return (
                        <Button
                          key={`qmod-s-${s.id}-${sIdx}`}
                          variant="outline"
                          size="sm"
                          onClick={() => toggleSubject(s.id)}
                          className={cn(
                            "rounded-full text-[9px] uppercase tracking-widest font-extrabold h-8 flex-shrink-0 transition-all flex items-center gap-1 cursor-pointer",
                            isSubjectSelected
                              ? "bg-[#1A1A1A] hover:bg-black text-white border-[#1A1A1A] shadow-md ring-2 ring-slate-400 ring-offset-1 scale-[1.02]"
                              : "bg-white hover:bg-slate-50 text-[#1A1A1A] border-[#E2E0D9]"
                          )}
                        >
                          {isSubjectSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                          <span>{s.name}</span>
                        </Button>
                      );
                    })}
                    {filteredSubjects.length === 0 && (
                      <p className="text-[10px] italic text-[#8E8A82] py-2">Nenhuma matéria encontrada.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82]">Temas Específicos</label>
                    {selectedTopicIds.length > 0 && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                        {selectedTopicIds.length} selecionado{selectedTopicIds.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-[200px] overflow-auto">
                    {topics.filter(t => selectedSubjectIds.length === 0 || selectedSubjectIds.includes(t.subjectId)).map((t, tIdx) => {
                      const isTopicSelected = selectedTopicIds.includes(t.id);
                      return (
                        <Button
                          key={`qmod-t-${t.id}-${tIdx}`}
                          variant="outline"
                          size="sm"
                          onClick={() => toggleTopic(t.id)}
                          className={cn(
                            "rounded-full text-[9px] uppercase tracking-widest font-extrabold h-8 transition-all flex items-center gap-1.5 cursor-pointer",
                            isTopicSelected
                              ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300 ring-offset-1 scale-[1.02]"
                              : "bg-white hover:bg-slate-100 text-[#1A1A1A] border-[#E2E0D9] border-dashed hover:border-indigo-300"
                          )}
                        >
                          {isTopicSelected && <Check className="w-3 h-3 text-emerald-300 shrink-0" />}
                          <span>{t.title}</span>
                        </Button>
                      );
                    })}
                    {topics.length === 0 && <p className="text-[10px] italic text-[#8E8A82]">Nenhum tema encontrado.</p>}
                  </div>
                </div>
              </div>

              {/* Painel de Customização Avançada do Simulado */}
              {selectedSubjectIds.length > 0 && (
                <div className="bg-[#FAF9F5] p-6 sm:p-8 rounded-2xl border border-[#E2E0D9] space-y-6">
                  <div className="flex items-center gap-2.5 border-b border-[#E2E0D9]/80 pb-3">
                    <SlidersHorizontal className="w-4 h-4 text-primary" />
                    <h3 className="text-xs uppercase tracking-widest font-black text-[#1A1A1A]">Configuração do Simulado Personalizado</h3>
                  </div>
                  
                  {/* QUANTIDADES UNITÁRIAS POR MATÉRIA */}
                  <div className="space-y-4">
                    <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82]">Questões por Matéria Selecionada</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedSubjectIds.map(sid => {
                        const subject = subjects.find(s => s.id === sid);
                        const count = subjectQuestionCounts[sid] || 5;
                        
                        return (
                          <div key={sid} className="bg-white p-4 rounded-xl border border-[#E2E0D9] flex flex-col justify-between gap-3 shadow-sm">
                            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#1A1A1A] line-clamp-1">
                              {subject?.name || 'Geral'}
                            </span>
                            
                            <div className="flex items-center gap-3">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={count <= 1}
                                onClick={() => setSubjectQuestionCounts(prev => ({ ...prev, [sid]: Math.max(1, count - 1) }))}
                                className="h-8 w-8 rounded-lg p-0 font-bold border-[#E2E0D9] hover:bg-slate-50 shrink-0"
                              >
                                -
                              </Button>
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={count}
                                onChange={(e) => {
                                  const val = Math.min(50, Math.max(1, parseInt(e.target.value) || 1));
                                  setSubjectQuestionCounts(prev => ({ ...prev, [sid]: val }));
                                }}
                                className="w-12 h-8 text-center text-xs font-bold border border-[#E2E0D9] rounded-lg outline-none shrink-0"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={count >= 50}
                                onClick={() => setSubjectQuestionCounts(prev => ({ ...prev, [sid]: Math.min(50, count + 1) }))}
                                className="h-8 w-8 rounded-lg p-0 font-bold border-[#E2E0D9] hover:bg-slate-50 shrink-0"
                              >
                                +
                              </Button>
                              
                              {/* Presets */}
                              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                                {[5, 10, 15, 25].map(p => (
                                  <button
                                    key={p}
                                    onClick={() => setSubjectQuestionCounts(prev => ({ ...prev, [sid]: p }))}
                                    className={cn(
                                      "text-[9px] px-2 py-1 rounded font-bold border transition-all",
                                      count === p 
                                        ? "bg-primary border-primary text-white" 
                                        : "bg-[#FBFBFA] border-[#E2E0D9] text-[#8E8A82] hover:bg-white"
                                    )}
                                  >
                                    {p}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-xs py-2 px-4 bg-primary/5 rounded-xl border border-primary/10">
                      <span className="font-semibold text-stone-700">Total estimado do simulado:</span>
                      <span className="font-extrabold text-primary text-sm bg-white border border-[#E2E0D9] px-3 py-1 rounded-lg">
                        {selectedSubjectIds.reduce((sum, sid) => sum + (subjectQuestionCounts[sid] || 5), 0)} questões
                      </span>
                    </div>
                  </div>

                  {/* MODO DO GABARITO & TEMPO (SHARED PARAMS) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#E2E0D9]">
                    <div className="space-y-3">
                      <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82]">Modo de Feedback</span>
                      <div className="flex bg-white p-1 rounded-xl border border-[#E2E0D9] shadow-sm">
                        <button
                          onClick={() => setQuizMode('study')}
                          className={cn(
                            "flex-1 text-[10px] uppercase tracking-wider font-extrabold py-2 px-3 rounded-lg transition-all",
                            quizMode === 'study' 
                              ? "bg-primary text-white shadow" 
                              : "text-[#8E8A82] hover:text-[#1A1A1A]"
                          )}
                        >
                          Estudo (Imediato)
                        </button>
                        <button
                          onClick={() => setQuizMode('exam')}
                          className={cn(
                            "flex-1 text-[10px] uppercase tracking-wider font-extrabold py-2 px-3 rounded-lg transition-all",
                            quizMode === 'exam' 
                              ? "bg-primary text-white shadow" 
                              : "text-[#8E8A82] hover:text-[#1A1A1A]"
                          )}
                        >
                          Prova (Realista)
                        </button>
                      </div>
                      <p className="text-[10px] italic text-[#8E8A82] leading-relaxed">
                        {quizMode === 'study' 
                          ? "✓ Mostra se você acertou e o comentário do professor após responder cada questão." 
                          : "✓ Esconde resultados. Permite voltar e alterar alternativas. Gabarito completo apenas no final."}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82]">Controle de Tempo</span>
                      <div className="flex bg-white p-1 rounded-xl border border-[#E2E0D9] shadow-sm">
                        <button
                          onClick={() => setTimerType('up')}
                          className={cn(
                            "flex-1 text-[10px] uppercase tracking-wider font-extrabold py-2 px-3 rounded-lg transition-all",
                            timerType === 'up' 
                              ? "bg-[#1A1A1A] text-white shadow" 
                              : "text-[#8E8A82] hover:text-[#1A1A1A]"
                          )}
                        >
                          Cronômetro Livre
                        </button>
                        <button
                          onClick={() => setTimerType('down')}
                          className={cn(
                            "flex-1 text-[10px] uppercase tracking-wider font-extrabold py-2 px-3 rounded-lg transition-all",
                            timerType === 'down' 
                              ? "bg-[#1A1A1A] text-white shadow" 
                              : "text-[#8E8A82] hover:text-[#1A1A1A]"
                          )}
                        >
                          Tempo Limite
                        </button>
                      </div>
                      {timerType === 'down' && (
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-[#E2E0D9] shadow-sm">
                          <span className="text-[9px] font-bold text-[#8E8A82] uppercase">Duração:</span>
                          <div className="flex gap-1 shrink-0 overflow-x-auto no-scrollbar">
                            {[10, 20, 30, 45, 60, 120].map(m => (
                              <button
                                key={m}
                                onClick={() => setCountdownMinutes(m)}
                                className={cn(
                                  "text-[9px] px-2 py-0.5 rounded font-black border transition-all",
                                  countdownMinutes === m 
                                    ? "bg-primary border-primary text-white" 
                                    : "bg-stone-50 border-[#E2E0D9] text-[#8E8A82]"
                                )}
                              >
                                {m}m
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] italic text-[#8E8A82] leading-relaxed">
                        {timerType === 'up' 
                          ? "✓ O tempo começa em 0 e conta progressivamente." 
                          : `✓ O simulado será finalizado automaticamente se expirar em ${countdownMinutes} minutos.`}
                      </p>
                    </div>
                  </div>

                  {/* FILTRO DE PRIORIZAR ERROS PRÉVIOS */}
                  <div className="pt-4 border-t border-[#E2E0D9] flex flex-wrap gap-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div 
                        onClick={() => setFilterOnlyErrors(!filterOnlyErrors)}
                        className={cn(
                          "w-10 h-6 rounded-full transition-colors relative",
                          filterOnlyErrors ? "bg-red-500" : "bg-[#E2E0D9]"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                          filterOnlyErrors ? "translate-x-4" : ""
                        )} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#1a1a1a] group-hover:text-red-500 transition-colors">
                          Focar em Erros Anteriores
                        </span>
                        <span className="text-[9px] text-[#8E8A82]">Buscar apenas por questões que você já errou no passado</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}


          {/* MODO 2: ERROS HISTÓRICOS IA */}
          {simuladoMode === 'ai-errors' && (
            <div className="bg-[#FFF8F8] p-6 sm:p-8 rounded-2xl border border-red-100 space-y-6 animate-fade-in">
              <div className="flex items-center gap-2.5 border-b border-red-100 pb-3">
                <Brain className="w-5 h-5 text-red-600" />
                <div>
                  <h3 className="text-xs uppercase tracking-widest font-black text-red-950">Treino Inteligente de Erros IA</h3>
                  <p className="text-[10px] text-red-700/80 font-bold uppercase mt-0.5">Reciclagem de matérias e temas com menor taxa de acerto recente</p>
                </div>
              </div>

              {(() => {
                const { stats, isFallback, hasData } = computeAiErrorsStats();

                if (!hasData) {
                  return (
                    <div className="text-center py-6 space-y-3">
                      <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                      <div className="space-y-1">
                        <h4 className="text-xs uppercase tracking-wider font-extrabold text-red-900">Histórico de Resoluções Zerado</h4>
                        <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                          Você ainda não possui tentativas de questões salvas no último mês para calcular o aproveitamento. <br/>
                          Se você iniciar o simulado agora, geraremos um treino unificado de todas as matérias com 5 questões cada!
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <span className="text-[10px] uppercase tracking-widest font-extrabold text-red-800">Seu Rank de Desempenho Crítico do Mês:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {stats.slice(0, 3).map(item => (
                          <div key={item.subjectId} className="bg-white p-4 rounded-xl border border-red-100 shadow-sm space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#1A1A1A] line-clamp-1">{item.name}</span>
                              <Badge className="bg-red-50 text-red-600 text-[9px] border border-red-100 shrink-0 font-extrabold">
                                {item.percent}% acertos
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-red-500 h-full rounded-full transition-all duration-500" 
                                  style={{ width: `${item.percent}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-[#8E8A82] font-black">
                                <span>{item.correct} acertos</span>
                                <span>{item.total} respondidas</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-red-50/50 rounded-xl border border-red-100 text-xs text-red-800 leading-relaxed space-y-1.5 font-medium">
                      <p className="font-extrabold text-[#1A1A1A] uppercase tracking-wider text-[9px]">💡 Diretriz de geração do simulado:</p>
                      <p>O simulado extrairá dinamicamente as <strong>5 matérias mais fracas</strong> (foco crítico em {stats.slice(0, 3).map(s => s.name).join(', ')}), selecionando primordialmente as questões em que você errou ou deixou de responder recentemente.</p>
                      {isFallback && <p className="text-[10px] italic text-[#8E8A82]">Exibindo estatísticas históricas unificadas, pois não houve atividades registradas nos últimos 30 dias.</p>}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}


          {/* MODO 3: DISTRIBUIÇÃO DE BANCA OFICIAL */}
          {simuladoMode === 'official-ratio' && (
            <div className="bg-[#FFFDF4] p-6 sm:p-8 rounded-2xl border border-amber-200 space-y-8 animate-fade-in">
              <div className="flex items-center gap-2.5 border-b border-amber-200 pb-3">
                <Trophy className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-xs uppercase tracking-widest font-black text-[#1A1A1A]">Proporção e Peso de Bancas</h3>
                  <p className="text-[10px] text-amber-700/80 font-bold uppercase mt-0.5">Simulados calculados com a equivalência percentual de editais reais</p>
                </div>
              </div>

              {/* Grid de Seleção da Banca */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {EXAM_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={cn(
                      "p-5 text-left rounded-xl border transition-all space-y-2.5 bg-white",
                      selectedPresetId === preset.id
                        ? "border-amber-500 ring-2 ring-amber-500/10 shadow-sm"
                        : "border-[#E2E0D9] hover:border-amber-500/30"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "p-1 rounded-md text-[9px] font-black shrink-0",
                        selectedPresetId === preset.id ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-600"
                      )}>
                        {preset.id.toUpperCase()}
                      </div>
                      <h4 className="text-xs font-bold text-stone-900 leading-tight">{preset.name}</h4>
                    </div>
                    <p className="text-[9px] text-[#8E8A82] leading-normal font-medium">{preset.description}</p>
                  </button>
                ))}
              </div>

              {/* Slider / Preset de Questões */}
              <div className="space-y-4 pt-4 border-t border-amber-100">
                <span className="text-[10px] uppercase tracking-widest font-extrabold text-amber-800">Total de Questões da Prova</span>
                <div className="flex flex-wrap gap-2">
                  {[10, 20, 30, 50].map((num) => (
                    <button
                      key={num}
                      onClick={() => setTotalPresetQuestions(num)}
                      className={cn(
                        "h-10 px-5 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1.5",
                        totalPresetQuestions === num
                          ? "bg-amber-500 border-amber-500 text-white shadow"
                          : "bg-white border-[#E2E0D9] text-[#8E8A82] hover:bg-amber-50/20"
                      )}
                    >
                      {num} Questões
                      {num === 50 && <span className="bg-amber-200 text-amber-800 text-[8px] tracking-wider uppercase font-black px-1.5 py-0.5 rounded ml-1">Completa</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visualizador da Distribuição */}
              {(() => {
                const preset = EXAM_PRESETS.find(p => p.id === selectedPresetId) || EXAM_PRESETS[0];
                const calculatedCounts = getPresetSubjectCounts(preset, totalPresetQuestions);
                
                return (
                  <div className="p-5 bg-stone-50 rounded-xl border border-amber-100 space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#1A1A1A]">Divisão Estimada de Questões:</span>
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-700">{totalPresetQuestions} questões unificadas</span>
                    </div>
                    
                    <div className="space-y-3">
                      {Object.entries(preset.weights).map(([name, weight]) => {
                        const sub = subjects.find(s => s.name.toLowerCase() === name.toLowerCase());
                        const count = calculatedCounts[sub?.id || ''] || 0;
                        if (count === 0 && !sub) return null;
                        
                        return (
                          <div key={name} className="space-y-1">
                            <div className="flex justify-between text-[11px] font-semibold text-[#1A1A1A]">
                              <span className="truncate pr-4">{sub?.name || name}</span>
                              <span className="font-extrabold shrink-0 text-amber-800">{count} questões ({Math.round(weight * 100)}%)</span>
                            </div>
                            <div className="w-full bg-slate-200/50 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-amber-500 h-full rounded-full" 
                                style={{ width: `${weight * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* MODO: MATRIZ POR BANCA & ANO */}
          {simuladoMode === 'banca-year' && (
            <div className="bg-[#FAF8F5] p-6 sm:p-8 rounded-2xl border border-purple-200/80 space-y-8 animate-fade-in">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-100 pb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-100 border border-purple-200 text-purple-700 shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm uppercase tracking-widest font-black text-purple-950">Matriz Granular por Banca & Ano</h3>
                      <Badge className="bg-purple-600 text-white text-[8px] uppercase tracking-wider font-extrabold px-2 py-0.5">Fidelidade Verbatim 100%</Badge>
                    </div>
                    <p className="text-[10px] text-purple-800/80 font-medium mt-0.5">
                      Audite a quantidade exata de questões disponíveis por banca e ano e recupere questões reais idênticas às aplicadas nas provas oficiais.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyPreferredBancasPreset(2)}
                    className="h-9 text-xs font-bold border-amber-300 bg-amber-50/80 text-amber-900 hover:bg-amber-100/80 gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                    +2 de Cada Ano (Bancas Foco)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => selectAllAvailableGlobal(candidatePreferredBancas)}
                    className="h-9 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white gap-1.5 shadow-sm"
                  >
                    ➕ Adicionar Todas Disponíveis (Que Já Tenho / Acervo)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => selectUnansweredGlobal(candidatePreferredBancas)}
                    className="h-9 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 shadow-sm"
                  >
                    🎯 Selecionar Apenas Não Feitas (Que Não Fiz Ainda)
                  </Button>
                  {Object.keys(bancaYearSelection).length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setBancaYearSelection({})}
                      className="h-9 text-xs font-medium text-stone-500 hover:text-red-600 gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Limpar Seleção
                    </Button>
                  )}
                </div>
              </div>

              {/* CARD DE AUDITORIA DE DISPONIBILIDADE COM CUSTO DE CRÉDITOS */}
              <div className="p-5 rounded-xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-purple-700/50">
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-purple-500/30 text-purple-200">
                      <Search className="w-4 h-4 text-purple-300" />
                    </span>
                    <h4 className="text-xs font-black uppercase tracking-wider text-purple-100">
                      Auditoria de Disponibilidade do Acervo Oficial por Banca & Ano
                    </h4>
                    <Badge className="bg-amber-400 text-purple-950 font-black text-[9px] px-2 py-0.5 gap-1">
                      <Sparkles className="w-3 h-3 text-purple-950 fill-purple-950" />
                      Custo: 5 Créditos
                    </Badge>
                  </div>
                  <p className="text-[11px] text-purple-200/90 leading-relaxed">
                    Executa uma varredura profunda no acervo local e nos arquivos oficiais da IA para mapear o número exato de questões reais aplicadas entre 2021 e 2026 para os tópicos selecionados.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    onClick={handleRunAvailabilityAudit}
                    disabled={runningAudit}
                    className="h-10 px-5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-purple-950 font-black text-xs rounded-xl shadow-lg transition-all gap-2 disabled:opacity-50"
                  >
                    {runningAudit ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Auditando Acervo (5 cr)...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        {auditExecuted ? 'Refazer Auditoria de Disponibilidade (5 cr)' : 'Auditar Quantidade Disponível (5 cr)'}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* BANNER DE FIEL REPRODUÇÃO VERBATIM DESSAS QUESTÕES */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5">
                  <BookCheck className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                    📜 Garantia de Fidelidade Verbatim Exata às Provas Oficiais
                  </h5>
                  <p className="text-[11px] text-emerald-900/90 font-medium leading-relaxed mt-0.5">
                    Todas as questões obtidas neste modo são recuperadas na íntegra palavra por palavra exatamente como foram aplicadas na prova original da banca no ano selecionado (caso clínico, exames laboratoriais, valores de referência e alternativas A, B, C, D sem nenhum resumo ou alteração), permitindo conferência posterior com qualquer caderno de provas em PDF ou gabarito oficial.
                  </p>
                </div>
              </div>

              {/* Banner de Destaque das Bancas de Preferência do Candidato */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-300/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500 text-white shrink-0 shadow-sm">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-amber-950 tracking-wider">Suas Bancas de Preferência (Foco do Perfil)</span>
                      <Badge className="bg-amber-500 text-white text-[8px] font-extrabold">Prioridade Alta</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {candidatePreferredBancas.map(banca => (
                        <Badge key={banca} className="bg-amber-100 text-amber-950 border border-amber-300 font-extrabold text-[10px] px-2 py-0.5 gap-1 shadow-2xs">
                          <Sparkles className="w-3 h-3 text-amber-600 fill-amber-600" />
                          {banca}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => applyPreferredBancasPreset(5)}
                  className="h-9 px-4 text-xs font-black bg-amber-500 hover:bg-amber-600 text-white shadow shrink-0 gap-1.5"
                >
                  🎯 Selecionar 5 de Cada Ano (Bancas Foco)
                </Button>
              </div>

              {/* Filtro e busca de bancas */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Filtrar banca (ex: ENARE, SES-DF, USP)..."
                    value={bancaSearchTerm}
                    onChange={(e) => setBancaSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
                <div className="text-[10px] font-bold text-stone-500 flex items-center gap-2">
                  {runningAudit ? (
                    <span className="flex items-center gap-1 text-purple-600 font-extrabold">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Auditando acervo com IA...
                    </span>
                  ) : auditExecuted ? (
                    <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-1 rounded-md font-extrabold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Auditoria de acervo concluída (5 cr cobrados)
                    </span>
                  ) : (
                    <span className="bg-amber-100/80 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-md font-bold">
                      💡 Dica: Clique em "Auditar Quantidade Disponível (5 cr)" para visualizar o total exato por ano/banca
                    </span>
                  )}
                </div>
              </div>

              {/* GRUPO 1: BANCAS DE PREFERÊNCIA DO CANDIDATO */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <h4 className="text-xs uppercase tracking-wider font-black text-amber-950">
                      ⭐ Bancas de Sua Preferência (Evidenciadas do Perfil)
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                    {candidatePreferredBancas.length} bancas prioritárias
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {candidatePreferredBancas
                    .filter(banca => banca.toLowerCase().includes(bancaSearchTerm.toLowerCase()))
                    .map(banca => {
                      const years = [2026, 2025, 2024, 2023, 2022, 2021];
                      const bancaTotalSelected = years.reduce((acc, year) => {
                        const key = `${banca.toUpperCase()}_${year}`;
                        return acc + (bancaYearSelection[key] || 0);
                      }, 0);

                      return (
                        <div
                          key={banca}
                          className="p-4 rounded-xl border border-amber-300 ring-2 ring-amber-400/20 bg-gradient-to-br from-amber-50/50 to-white flex flex-col justify-between gap-3 shadow-sm"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-amber-100 pb-2.5 gap-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1 rounded-md bg-amber-500 text-white shrink-0">
                                <Sparkles className="w-3.5 h-3.5 fill-white" />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <h5 className="text-xs font-black text-stone-900">{banca}</h5>
                                <Badge className="bg-amber-500 text-white text-[8px] font-extrabold uppercase px-1.5 py-0.2">
                                  Banca Foco
                                </Badge>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => selectAllAvailableGlobal([banca])}
                                className="text-[9px] font-extrabold text-purple-700 hover:text-purple-900 bg-purple-100/80 hover:bg-purple-200 px-2 py-0.5 rounded border border-purple-300 transition-colors"
                              >
                                + Todas Disp.
                              </button>
                              <button
                                type="button"
                                onClick={() => selectUnansweredGlobal([banca])}
                                className="text-[9px] font-extrabold text-emerald-800 hover:text-emerald-950 bg-emerald-100/80 hover:bg-emerald-200 px-2 py-0.5 rounded border border-emerald-300 transition-colors"
                              >
                                🎯 Não Feitas
                              </button>
                              {bancaTotalSelected > 0 && (
                                <Badge className="bg-purple-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                                  {bancaTotalSelected} selecionada{bancaTotalSelected > 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Grid de anos */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {years.map(year => {
                              const key = `${banca.toUpperCase()}_${year}`;
                              const currentVal = bancaYearSelection[key] || 0;
                              const localAvail = bancaYearCounts[key] || 0;
                              const aiAvail = aiArchiveYearCounts[key] || 0;
                              const totalAvail = getBancaYearTotalAvailable(key);
                              const unansAvail = getBancaYearUnanswered(key);
                              const hasAudit = auditExecuted;

                              return (
                                <div
                                  key={year}
                                  className={cn(
                                    "p-2 rounded-lg border text-xs flex flex-col justify-between gap-1.5 transition-all",
                                    currentVal > 0
                                      ? "bg-purple-50/90 border-purple-400 ring-1 ring-purple-300"
                                      : "bg-white/80 border-stone-200"
                                  )}
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between">
                                      <span className="font-extrabold text-[11px] text-stone-800">{year}</span>
                                      {hasAudit ? (
                                        <span className="text-[8px] font-extrabold px-1 py-0.2 rounded bg-purple-100 text-purple-900 border border-purple-200">
                                          {totalAvail} disp.
                                        </span>
                                      ) : (
                                        <span className={cn(
                                          "text-[8px] font-bold px-1 py-0.2 rounded",
                                          localAvail > 0 ? "bg-emerald-100 text-emerald-800" : "bg-purple-100 text-purple-700"
                                        )}>
                                          {localAvail > 0 ? `${localAvail} local` : 'IA Verbatim'}
                                        </span>
                                      )}
                                    </div>
                                    {hasAudit && (
                                      <div className="flex items-center gap-1 justify-between mt-0.5">
                                        <button
                                          type="button"
                                          onClick={() => setBancaYearCount(banca, year, totalAvail)}
                                          className="text-[8px] font-black text-purple-800 hover:text-purple-950 bg-purple-50 hover:bg-purple-100 px-1 py-0.2 rounded border border-purple-200"
                                          title="Adicionar todas as disponíveis deste ano"
                                        >
                                          +Todas ({totalAvail})
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setBancaYearCount(banca, year, unansAvail)}
                                          className="text-[8px] font-black text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-1 py-0.2 rounded border border-emerald-300"
                                          title="Selecionar apenas as que não fiz ainda"
                                        >
                                          🎯 Não Feita ({unansAvail})
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-md p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => setBancaYearCount(banca, year, currentVal - 1)}
                                      disabled={currentVal <= 0}
                                      className="w-5 h-5 flex items-center justify-center rounded text-stone-700 hover:bg-stone-200 disabled:opacity-30 disabled:hover:bg-transparent font-black"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      max="50"
                                      value={currentVal || 0}
                                      onChange={(e) => setBancaYearCount(banca, year, parseInt(e.target.value, 10) || 0)}
                                      className="w-8 text-center text-[11px] font-black focus:outline-none bg-transparent"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setBancaYearCount(banca, year, currentVal + 1)}
                                      className="w-5 h-5 flex items-center justify-center rounded bg-purple-600 text-white hover:bg-purple-700 font-black text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* GRUPO 2: OUTRAS BANCAS NACIONAIS */}
              <div className="space-y-4 pt-4 border-t border-purple-100">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-stone-600" />
                  <h4 className="text-xs uppercase tracking-wider font-black text-stone-800">
                    🏛️ Outras Grandes Bancas Nacionais de Concurso
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ALL_NATIONAL_BANCAS
                    .filter(b => !candidatePreferredBancas.includes(b))
                    .filter(banca => banca.toLowerCase().includes(bancaSearchTerm.toLowerCase()))
                    .map(banca => {
                      const years = [2026, 2025, 2024, 2023, 2022, 2021];
                      const bancaTotalSelected = years.reduce((acc, year) => {
                        const key = `${banca.toUpperCase()}_${year}`;
                        return acc + (bancaYearSelection[key] || 0);
                      }, 0);

                      return (
                        <div
                          key={banca}
                          className="p-4 rounded-xl border border-stone-200 hover:border-purple-300 bg-white flex flex-col justify-between gap-3 shadow-sm transition-all"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-100 pb-2.5 gap-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1 rounded-md bg-stone-100 text-stone-600 shrink-0">
                                <Building2 className="w-3.5 h-3.5" />
                              </div>
                              <h5 className="text-xs font-black text-stone-900">{banca}</h5>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => selectAllAvailableGlobal([banca])}
                                className="text-[9px] font-extrabold text-purple-700 hover:text-purple-900 bg-purple-100/80 hover:bg-purple-200 px-2 py-0.5 rounded border border-purple-300 transition-colors"
                              >
                                + Todas Disp.
                              </button>
                              <button
                                type="button"
                                onClick={() => selectUnansweredGlobal([banca])}
                                className="text-[9px] font-extrabold text-emerald-800 hover:text-emerald-950 bg-emerald-100/80 hover:bg-emerald-200 px-2 py-0.5 rounded border border-emerald-300 transition-colors"
                              >
                                🎯 Não Feitas
                              </button>
                              {bancaTotalSelected > 0 && (
                                <Badge className="bg-purple-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                                  {bancaTotalSelected} selecionada{bancaTotalSelected > 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Grid de anos */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {years.map(year => {
                              const key = `${banca.toUpperCase()}_${year}`;
                              const currentVal = bancaYearSelection[key] || 0;
                              const localAvail = bancaYearCounts[key] || 0;
                              const aiAvail = aiArchiveYearCounts[key] || 0;
                              const totalAvail = getBancaYearTotalAvailable(key);
                              const unansAvail = getBancaYearUnanswered(key);
                              const hasAudit = auditExecuted;

                              return (
                                <div
                                  key={year}
                                  className={cn(
                                    "p-2 rounded-lg border text-xs flex flex-col justify-between gap-1.5 transition-all",
                                    currentVal > 0
                                      ? "bg-purple-50/90 border-purple-400 ring-1 ring-purple-300"
                                      : "bg-stone-50/50 border-stone-200"
                                  )}
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between">
                                      <span className="font-extrabold text-[11px] text-stone-800">{year}</span>
                                      {hasAudit ? (
                                        <span className="text-[8px] font-extrabold px-1 py-0.2 rounded bg-purple-100 text-purple-900 border border-purple-200">
                                          {totalAvail} disp.
                                        </span>
                                      ) : (
                                        <span className={cn(
                                          "text-[8px] font-bold px-1 py-0.2 rounded",
                                          localAvail > 0 ? "bg-emerald-100 text-emerald-800" : "bg-purple-100 text-purple-700"
                                        )}>
                                          {localAvail > 0 ? `${localAvail} local` : 'IA Verbatim'}
                                        </span>
                                      )}
                                    </div>
                                    {hasAudit && (
                                      <div className="flex items-center gap-1 justify-between mt-0.5">
                                        <button
                                          type="button"
                                          onClick={() => setBancaYearCount(banca, year, totalAvail)}
                                          className="text-[8px] font-black text-purple-800 hover:text-purple-950 bg-purple-50 hover:bg-purple-100 px-1 py-0.2 rounded border border-purple-200"
                                          title="Adicionar todas as disponíveis deste ano"
                                        >
                                          +Todas ({totalAvail})
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setBancaYearCount(banca, year, unansAvail)}
                                          className="text-[8px] font-black text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-1 py-0.2 rounded border border-emerald-300"
                                          title="Selecionar apenas as que não fiz ainda"
                                        >
                                          🎯 Não Feita ({unansAvail})
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between bg-white border border-stone-200 rounded-md p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => setBancaYearCount(banca, year, currentVal - 1)}
                                      disabled={currentVal <= 0}
                                      className="w-5 h-5 flex items-center justify-center rounded text-stone-700 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent font-black"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      max="50"
                                      value={currentVal || 0}
                                      onChange={(e) => setBancaYearCount(banca, year, parseInt(e.target.value, 10) || 0)}
                                      className="w-8 text-center text-[11px] font-black focus:outline-none bg-transparent"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setBancaYearCount(banca, year, currentVal + 1)}
                                      className="w-5 h-5 flex items-center justify-center rounded bg-purple-600 text-white hover:bg-purple-700 font-black text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[#E2E0D9]">
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div 
                  onClick={() => setFilterUnanswered(!filterUnanswered)}
                  className={cn(
                    "w-10 h-6 rounded-full transition-colors relative",
                    filterUnanswered ? "bg-primary" : "bg-[#E2E0D9]"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                    filterUnanswered ? "translate-x-4" : ""
                  )} />
                </div>
                <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82] group-hover:text-primary transition-colors">Apenas não respondidas</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div 
                  onClick={() => setFilterFlagged(!filterFlagged)}
                  className={cn(
                    "w-10 h-6 rounded-full transition-colors relative",
                    filterFlagged ? "bg-amber-500" : "bg-[#E2E0D9]"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                    filterFlagged ? "translate-x-4" : ""
                  )} />
                </div>
                <span className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82] group-hover:text-amber-500 transition-colors">Apenas marcadas</span>
              </label>
            </div>

            <Button onClick={fetchQuestions} className="bg-[#1A1A1A] text-white text-[11px] uppercase tracking-widest font-black px-10 h-12 rounded-xl gap-3">
              {simuladoMode === 'banca-year' && totalBancaYearSelectedCount > 0
                ? `Iniciar Simulado (${totalBancaYearSelectedCount} q.)`
                : 'Iniciar Simulado'}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* PAINEL DE QUESTÕES JÁ GERADAS E GERADOR IA POR TÓPICO */}
        {(() => {
          const uniqueTids = Array.from(new Set(selectedTopicIds)).filter(Boolean);
          const totalGenCount = uniqueTids.length * numQuestionsPerTopic;
          const costPerTopicBatch = Math.max(3, Math.ceil((numQuestionsPerTopic / 5) * 3));
          const totalCreditsCost = uniqueTids.length * costPerTopicBatch;

          return (
            <div className="bg-white rounded-2xl border border-[#E2E0D9] p-6 sm:p-8 space-y-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E0D9] pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <BookCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs uppercase tracking-widest font-black text-[#1A1A1A]">Banco de Questões dos Tópicos Selecionados</h3>
                    <p className="text-[10px] text-[#8E8A82] font-bold uppercase mt-0.5">
                      {uniqueTids.length > 0 
                        ? `${uniqueTids.length} ${uniqueTids.length === 1 ? 'tópico selecionado' : 'tópicos selecionados'}` 
                        : 'Selecione tópicos para visualizar e gerenciar questões'}
                    </p>
                  </div>
                </div>

                {uniqueTids.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewingTopicModal('all')}
                    className="h-9 px-4 rounded-xl text-[10px] uppercase tracking-wider font-extrabold gap-2 border-[#E2E0D9] hover:bg-slate-50"
                  >
                    <Eye className="w-3.5 h-3.5 text-primary" />
                    Visualizar Todas dos Tópicos
                  </Button>
                )}
              </div>

              {/* LISTA DE CARDS DE CADA TÓPICO SELECIONADO */}
              {uniqueTids.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {uniqueTids.map(tid => {
                    const stats = topicStatsMap[tid];
                    const { topicTitle, subjectName } = findTopicAndSubject(tid, topics, subjects);

                    return (
                      <div key={`topic-card-${tid}`} className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#E2E0D9] flex flex-col justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Badge className="bg-white text-stone-700 border border-[#E2E0D9] text-[8px] font-black uppercase tracking-wider">
                              {stats?.subjectName || subjectName}
                            </Badge>
                            {stats?.loading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />
                            ) : (
                              <Badge className={cn(
                                "text-[9px] font-black px-2 py-0.5 rounded-full border",
                                (stats?.total || 0) > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-stone-100 text-stone-500 border-stone-200"
                              )}>
                                {stats?.total || 0} {(stats?.total || 0) === 1 ? 'questão' : 'questões'}
                              </Badge>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-[#1A1A1A] line-clamp-2 leading-snug">{stats?.topicTitle || topicTitle}</h4>
                        </div>

                        {/* DESEMPENHO DO TÓPICO */}
                        <div className="flex items-center justify-between text-[10px] font-bold bg-white p-2.5 rounded-xl border border-[#E2E0D9]/80">
                          <div className="flex gap-3 text-stone-600">
                            <span className="text-emerald-600">{stats?.correct || 0} acertos</span>
                            <span className="text-stone-300">•</span>
                            <span className="text-rose-600">{stats?.incorrect || 0} erros</span>
                          </div>
                          <span className="text-primary font-black">
                            {stats?.accuracy || 0}% de precisão
                          </span>
                        </div>

                        {/* AÇÕES POR TÓPICO */}
                        <div className="flex items-center gap-2 pt-2 border-t border-[#E2E0D9]/60">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!stats || stats.total === 0}
                            onClick={() => setViewingTopicModal(tid)}
                            className="flex-1 h-8 text-[9px] font-extrabold uppercase tracking-wider rounded-lg gap-1.5 border-[#E2E0D9] hover:bg-white"
                          >
                            <Eye className="w-3 h-3 text-primary" />
                            Visualizar ({stats?.total || 0})
                          </Button>

                          <Button
                            variant="default"
                            size="sm"
                            disabled={generatingTopicId === tid}
                            onClick={() => handleGenerateMoreForTopic(tid, 5)}
                            className="h-8 text-[9px] font-extrabold uppercase tracking-wider rounded-lg gap-1.5 bg-primary text-white"
                          >
                            {generatingTopicId === tid ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            +5 IA
                          </Button>

                          {stats && stats.total > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAllTopicQuestions(tid)}
                              className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg shrink-0"
                              title="Excluir todas as questões deste tópico"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 space-y-2">
                  <HelpCircle className="w-10 h-10 text-stone-300 mx-auto" />
                  <p className="text-xs text-[#8E8A82] font-medium">Nenhum tópico selecionado no filtro acima.</p>
                  <p className="text-[10px] text-stone-400">Marque matérias ou tópicos específicos para ver estatísticas e buscar novas questões.</p>
                </div>
              )}

              {/* BANNER DE FIEL REPRODUÇÃO VERBATIM DESSAS QUESTÕES */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5">
                  <BookCheck className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                    📜 Garantia de Fidelidade Verbatim Exata às Provas Oficiais
                  </h5>
                  <p className="text-[11px] text-emerald-900/90 font-medium leading-relaxed mt-0.5">
                    Todas as questões obtidas neste modo são recuperadas na íntegra palavra por palavra exatamente como foram aplicadas na prova original da banca no ano selecionado (caso clínico, exames laboratoriais, valores de referência e alternativas A, B, C, D sem nenhum resumo ou alteração), permitindo conferência posterior com qualquer caderno de provas em PDF ou gabarito oficial.
                  </p>
                </div>
              </div>

              {/* SEÇÃO DE BUSCAR NOVAS QUESTÕES IA */}
              {uniqueTids.length > 0 && (
                <div className="space-y-6 pt-6 border-t border-[#E2E0D9] bg-[#FAF9F5] p-6 rounded-2xl border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">Quantidade de Novas Questões por Tópico</span>
                      <p className="text-[10px] text-stone-500 font-medium">Selecione quantas questões a IA deve buscar para cada um dos {uniqueTids.length} tópicos selecionados</p>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {[5, 10, 15].map(n => (
                        <Button
                          key={n}
                          variant={numQuestionsPerTopic === n ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNumQuestionsPerTopic(n)}
                          className={cn(
                            "h-9 px-4 rounded-xl text-[10px] font-black transition-all",
                            numQuestionsPerTopic === n ? "bg-primary text-white" : "bg-white border-[#E2E0D9] text-stone-600"
                          )}
                        >
                          {n} / tópico
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button 
                      onClick={handleLoadMore}
                      disabled={isGeneratingMore}
                      className="w-full bg-primary text-white text-[11px] uppercase tracking-widest font-black px-10 h-14 rounded-2xl gap-3 shadow-lg shadow-primary/20"
                    >
                      {isGeneratingMore ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      Buscar {totalGenCount} {totalGenCount === 1 ? 'Questão' : 'Questões'} {uniqueTids.length > 1 ? `(${numQuestionsPerTopic} por tópico)` : ''}
                    </Button>
                    
                    <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] uppercase tracking-wider font-extrabold text-[#8E8A82]">
                      <Brain className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>Custo estimado: <strong>{totalCreditsCost} Créditos de IA</strong></span>
                      <span className="text-stone-300">•</span>
                      <span className="text-[9px] font-semibold text-stone-500">
                        (3 créditos por bloco de até 5 questões completas)
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* TOPIC QUESTIONS VIEWER OVERLAY MODAL */}
        <AnimatePresence>
          {viewingTopicModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-[#FBFBFA] w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
              >
                {(() => {
                  const isAll = viewingTopicModal === 'all';
                  let modalQuestions: Question[] = [];
                  let modalTitle = 'Todas as Questões dos Tópicos Selecionados';

                  if (isAll) {
                    const uniqueTids = Array.from(new Set(selectedTopicIds)).filter(Boolean);
                    uniqueTids.forEach(tid => {
                      if (topicStatsMap[tid]?.questions) {
                        modalQuestions.push(...topicStatsMap[tid].questions);
                      }
                    });
                  } else {
                    const stats = topicStatsMap[viewingTopicModal];
                    modalQuestions = stats?.questions || [];
                    modalTitle = stats?.topicTitle || 'Questões do Tópico';
                  }

                  if (topicModalSearch.trim()) {
                    const term = topicModalSearch.toLowerCase();
                    modalQuestions = modalQuestions.filter(q => 
                      q.text.toLowerCase().includes(term) ||
                      (q.source && q.source.toLowerCase().includes(term)) ||
                      q.options.some(opt => opt.toLowerCase().includes(term))
                    );
                  }

                  return (
                    <>
                      <div className="p-6 md:p-8 border-b border-[#E2E0D9] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <Badge className="bg-primary/10 text-primary border border-primary/20 text-[9px] font-black uppercase tracking-wider mb-1">
                            {modalQuestions.length} {modalQuestions.length === 1 ? 'Questão Cadastrada' : 'Questões Cadastradas'}
                          </Badge>
                          <h2 className="text-xl md:text-2xl font-display font-black leading-tight text-[#1A1A1A]">
                            {modalTitle}
                          </h2>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Pesquisar questão..."
                              value={topicModalSearch}
                              onChange={(e) => setTopicModalSearch(e.target.value)}
                              className="h-9 text-xs pl-8 pr-4 border border-[#E2E0D9] rounded-xl bg-stone-50 outline-none focus:border-primary focus:bg-white transition-all w-48"
                            />
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                          </div>

                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setViewingTopicModal(null);
                              setTopicModalSearch('');
                            }}
                            className="rounded-full hover:bg-slate-100 h-9 w-9 p-0 shrink-0"
                          >
                            <XCircle className="w-6 h-6 text-[#8E8A82]" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 no-scrollbar">
                        {modalQuestions.length === 0 ? (
                          <div className="text-center py-16 space-y-3">
                            <HelpCircle className="w-12 h-12 text-stone-300 mx-auto" />
                            <p className="text-sm text-stone-600 font-bold">Nenhuma questão encontrada para este tópico.</p>
                            <p className="text-xs text-stone-400">Você pode usar o botão de gerar +5 questões para criar novos enunciados.</p>
                          </div>
                        ) : (
                          modalQuestions.map((q, idx) => {
                            const attempt = userProgress?.attempts?.[q.id];

                            return (
                              <div key={`view-q-${q.id}-${idx}`} className="bg-white border border-[#E2E0D9] rounded-2xl p-6 md:p-8 space-y-5 shadow-sm">
                                <div className="flex items-start justify-between gap-4 border-b border-[#E2E0D9]/60 pb-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-[9px] font-black py-0.5 h-5 border-[#E2E0D9] bg-stone-50">
                                        QUESTÃO {idx + 1}
                                      </Badge>
                                      {q.source && (
                                        <Badge className={cn(
                                          "text-[9px] font-bold border",
                                          q.source.includes('[Nota:') || q.source.includes('Banca Secundária')
                                            ? "bg-purple-50 text-purple-900 border-purple-200"
                                            : "bg-amber-50 text-amber-800 border-amber-200"
                                        )}>
                                          {q.source}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {!attempt && (
                                      <Badge variant="outline" className="text-[9px] font-bold text-stone-500 border-stone-200 bg-stone-50">
                                        NÃO RESPONDIDA
                                      </Badge>
                                    )}

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={deletingQuestionId === q.id}
                                      onClick={() => handleDeleteTopicQuestion(q.id, q.topicId || viewingTopicModal || '')}
                                      className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg gap-1.5 font-bold"
                                      title="Excluir questão"
                                    >
                                      {deletingQuestionId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                      Excluir
                                    </Button>
                                  </div>
                                </div>

                                <div className="text-sm text-stone-900 font-medium leading-relaxed font-display">
                                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                    {q.text}
                                  </ReactMarkdown>
                                </div>

                                <div className="space-y-2.5 pt-2">
                                  {q.options.map((opt, optIdx) => {
                                    const isCorrect = q.correctOptionIndex === optIdx;
                                    const wasChosen = attempt?.selectedOptionIndex === optIdx;

                                    return (
                                      <div 
                                        key={optIdx}
                                        className={cn(
                                          "p-3.5 rounded-xl text-xs border-2 flex items-center gap-3 transition-all",
                                          isCorrect ? "bg-emerald-500/20 border-emerald-600 text-emerald-950 dark:text-emerald-100 font-extrabold shadow-xs" :
                                          wasChosen && !isCorrect ? "bg-rose-500/20 border-rose-600 text-rose-950 dark:text-rose-100 font-extrabold shadow-xs" :
                                          "bg-stone-50/60 border-[#E2E0D9] text-stone-700"
                                        )}
                                      >
                                        <span className={cn(
                                          "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 shadow-2xs",
                                          isCorrect ? "bg-emerald-600 text-white" :
                                          wasChosen ? "bg-rose-600 text-white" :
                                          "bg-stone-200 text-stone-600"
                                        )}>
                                          {String.fromCharCode(65 + optIdx)}
                                        </span>
                                        <span className="flex-1">{opt}</span>
                                        {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 stroke-[2.5]" />}
                                        {wasChosen && !isCorrect && <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 stroke-[2.5]" />}
                                      </div>
                                    );
                                  })}
                                </div>

                                {q.explanation && (
                                  <div className="pt-3 border-t border-[#E2E0D9]/60">
                                    <span className="text-[9px] uppercase font-black text-[#8E8A82] mb-1.5 flex items-center gap-1.5">
                                      <Sparkles className="w-3 h-3 text-primary" /> Comentário do Gabarito
                                    </span>
                                    <div className="text-xs text-stone-700 leading-relaxed bg-stone-50 p-4 rounded-xl border border-stone-100">
                                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, rehypeKatex]}>
                                        {q.explanation}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QUIZ DETAIL OVERLAY */}
        <AnimatePresence>
          {selectedQuizForDetail && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-[#FBFBFA] w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="p-8 border-b border-[#E2E0D9] bg-white flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-display font-black leading-tight">Revisão do Simulado</h2>
                    <p className="text-xs text-[#8E8A82] uppercase tracking-widest font-bold mt-1">
                      {new Date(selectedQuizForDetail.timestamp).toLocaleDateString()} • {selectedQuizForDetail.score}/{selectedQuizForDetail.totalQuestions} Acertos
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    onClick={() => setSelectedQuizForDetail(null)}
                    className="rounded-full hover:bg-slate-100"
                  >
                    <XCircle className="w-6 h-6 text-[#8E8A82]" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                  {loadingDetail ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <Loader2 className="w-10 h-10 animate-spin text-primary" />
                      <p className="text-xs uppercase font-black tracking-widest text-[#8E8A82]">Carregando questões...</p>
                    </div>
                  ) : (
                    detailQuestions.map((q, idx) => {
                      const attempt = selectedQuizForDetail.questions.find(aq => aq.questionId === q.id);
                      if (!attempt) return null;

                      return (
                        <div key={`detail-q-${q.id}-${idx}`} className="bg-white border border-[#E2E0D9] rounded-2xl p-8 space-y-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2">
                              <Badge variant="outline" className="text-[8px] font-bold py-0 h-4 border-[#E2E0D9]">
                                QUESTÃO {idx + 1}
                              </Badge>
                              <h4 className="text-xl font-display font-bold leading-tight">{q.text}</h4>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {q.options.map((opt, optIdx) => {
                              const wasSelected = attempt.selectedOptionIndex === optIdx;
                              const isCorrect = q.correctOptionIndex === optIdx;
                              
                              return (
                                <div 
                                  key={optIdx}
                                  className={cn(
                                    "p-4 rounded-xl text-sm border-2 flex items-center gap-4 transition-all",
                                    isCorrect ? "bg-emerald-500/20 border-emerald-600 text-emerald-950 dark:text-emerald-100 font-extrabold shadow-xs" :
                                    wasSelected && !isCorrect ? "bg-rose-500/20 border-rose-600 text-rose-950 dark:text-rose-100 font-extrabold shadow-xs" :
                                    "bg-white border-[#E2E0D9] text-gray-500"
                                  )}
                                >
                                  <span className={cn(
                                    "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 shadow-2xs",
                                    isCorrect ? "bg-emerald-600 text-white" :
                                    wasSelected ? "bg-rose-600 text-white" :
                                    "bg-gray-100 text-[#8E8A82]"
                                  )}>
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  {opt}
                                  {isCorrect && <CheckCircle2 className="w-5 h-5 ml-auto text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />}
                                  {wasSelected && !isCorrect && <XCircle className="w-5 h-5 ml-auto text-rose-600 dark:text-rose-400 stroke-[2.5]" />}
                                </div>
                              );
                            })}
                          </div>

                          {q.explanation && (
                            <div className="pt-4 border-t border-[#E2E0D9]">
                              <div className="text-[10px] uppercase font-black text-[#8E8A82] mb-2 flex items-center gap-2">
                                <Sparkles className="w-3 h-3 text-primary" /> Comentário da Resolução
                              </div>
                              <div className="text-sm text-[#4B5563] leading-relaxed bg-[#F9F9F8] p-4 rounded-xl italic">
                                {q.explanation}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-8 border-t border-[#E2E0D9] bg-white flex justify-end">
                  <Button 
                    onClick={() => setSelectedQuizForDetail(null)}
                    className="bg-[#1A1A1A] hover:bg-black text-white px-8 h-12 text-[10px] uppercase font-black tracking-widest rounded-xl"
                  >
                    Fechar Revisão
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (showResults) {
    return (
      <Card className="max-w-3xl mx-auto border-[#E2E0D9] shadow-none rounded-3xl overflow-hidden">
        <div className="bg-[#1A1A1A] text-white p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent"></div>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative z-10"
          >
            <Trophy className="w-20 h-20 text-primary mx-auto mb-6" />
            <div className="text-[11px] uppercase tracking-widest text-primary font-black mb-2">Relatório de Desempenho</div>
            <h2 className="text-5xl font-display font-black mb-2">Simulado Finalizado</h2>
            <p className="text-lg text-white/60 font-display italic">Medicina Residência • {selectedTopicIds.length > 0 ? `${selectedTopicIds.length} Temas` : 'Multidisciplinar'}</p>
          </motion.div>
        </div>

        <CardContent className="p-12 space-y-12">
          {(() => {
            const evaluatedCount = currentQuizResults.length > 0 ? currentQuizResults.length : questions.length;
            const accuracyPct = evaluatedCount > 0 ? Math.round((score / evaluatedCount) * 100) : 0;
            const wrongCount = Math.max(0, evaluatedCount - score);
            const unattemptedCount = Math.max(0, questions.length - evaluatedCount);

            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  <div className="text-center space-y-2 p-6 bg-[#FBFBFA] rounded-3xl">
                    <p className="text-4xl font-display font-black text-primary">{accuracyPct}%</p>
                    <p className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Precisão</p>
                  </div>
                  <div className="text-center space-y-2 p-6 bg-[#FBFBFA] rounded-3xl">
                    <p className="text-4xl font-display font-black text-emerald-700">{score}</p>
                    <p className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Acertos</p>
                  </div>
                  <div className="text-center space-y-2 p-6 bg-[#FBFBFA] rounded-3xl">
                    <p className="text-4xl font-display font-black text-rose-700">{wrongCount}</p>
                    <p className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Erros</p>
                  </div>
                  <div className="text-center space-y-2 p-6 bg-[#FBFBFA] rounded-3xl">
                    <p className="text-4xl font-display font-black text-[#1A1A1A]">{formatTime(seconds)}</p>
                    <p className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Tempo Total</p>
                  </div>
                </div>

                {unattemptedCount > 0 && (
                  <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 font-medium">
                    📋 <strong>Encerrado antecipadamente:</strong> {evaluatedCount} de {questions.length} questões foram respondidas. As {unattemptedCount} questões não feitas foram desconsideradas e não contam como erro.
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex justify-between text-[11px] uppercase tracking-widest font-black text-[#1A1A1A]">
                    <span>Aproveitamento nas Respondidas</span>
                    <span>{accuracyPct}%</span>
                  </div>
                  <div className="h-4 bg-[#F0EEE9] rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${accuracyPct}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
                </div>
              </>
            );
          })()}

          {/* MedRevise Auto-Registration Card */}
          <div className="bg-[#FAF8F5] border-2 border-primary/20 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E2E0D9] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-display font-black text-[#1A1A1A]">
                    Sincronização com o MedRevise
                  </h3>
                  <p className="text-xs text-[#8E8A82]">
                    Envie seu desempenho para o algoritmo de repetição espaçada (SM-2)
                  </p>
                </div>
              </div>

              {/* Mode Selection Toggle */}
              <div className="flex items-center gap-1 bg-[#EAE8E3] p-1 rounded-2xl border border-[#D8D5CC]">
                <button
                  type="button"
                  onClick={() => updateQuestionsSyncMode('auto')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    questionsSyncMode === 'auto'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-stone-600 hover:text-black'
                  }`}
                >
                  ⚡ Automático
                </button>
                <button
                  type="button"
                  onClick={() => updateQuestionsSyncMode('manual')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    questionsSyncMode === 'manual'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-stone-600 hover:text-black'
                  }`}
                >
                  🖐️ Manual
                </button>
              </div>
            </div>

            {questionsSyncMode === 'manual' && !medReviseResult && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200/80 p-3 rounded-xl font-medium">
                💡 <strong>Modo Manual selecionado:</strong> O seu teste foi salvo no MedInternato. Ajuste o tempo abaixo e clique em <strong>"Registrar no MedRevise"</strong> quando desejar enviar os dados para o MedRevise.
              </p>
            )}

            {!medReviseResult ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82] block mb-2">
                    Métricas de Desempenho
                  </label>
                  <div className="p-3 bg-white rounded-xl border border-[#E2E0D9] text-xs font-bold text-[#1A1A1A]">
                    {score} de {currentQuizResults.length > 0 ? currentQuizResults.length : questions.length} acertos ({currentQuizResults.length > 0 ? Math.round((score / currentQuizResults.length) * 100) : Math.round((score / questions.length) * 100)}%)
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82] block mb-2">
                    Tempo de Estudo/Revisão (Minutos)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={medReviseMinutes}
                      onChange={(e) => setMedReviseMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full h-11 px-3 bg-white rounded-xl border border-[#E2E0D9] text-sm font-black focus:outline-none focus:border-primary"
                    />
                    <span className="text-xs font-bold text-[#8E8A82]">min</span>
                  </div>
                </div>

                <div>
                  <Button
                    onClick={handleRegisterMedRevise}
                    disabled={isSavingMedRevise}
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase tracking-widest rounded-xl gap-2 shadow-md shadow-primary/20 cursor-pointer"
                  >
                    {isSavingMedRevise ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <BookCheck className="w-4 h-4" />
                    )}
                    Registrar no MedRevise
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-950">
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-wider">
                    ✓ Tópico "{medReviseResult.topicTitle}" {medReviseResult.isFirst ? 'salvo como ESTUDO INICIAL' : 'salvo como REVISÃO'}!
                  </p>
                  <p className="text-xs font-medium text-emerald-800">
                    Próximo ciclo de repetição espaçada agendado para: <strong>{medReviseResult.nextDate}</strong>
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('switch-mode', { detail: 'revise' }));
                  }}
                  className="text-xs font-bold text-emerald-900 border-emerald-300 hover:bg-emerald-100/60 rounded-xl shrink-0 h-9"
                >
                  Ver no MedRevise →
                </Button>
              </div>
            )}
          </div>

          {/* Subject Breakdown */}
          {questions.some(q => q.subjectId) && [...new Set(questions.map(q => q.subjectId))].length > 1 && (
            <div className="space-y-6 pt-6 border-t border-[#E2E0D9]">
              <h3 className="text-[11px] uppercase tracking-widest font-black text-[#8E8A82]">Desempenho por Matéria</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...new Set(questions.map(q => q.subjectId))].filter(Boolean).map(sid => {
                  const subject = subjects.find(s => s.id === sid);
                  const subjectAnswered = currentQuizResults.filter(r => r.subjectId === sid);
                  const subjectTotal = subjectAnswered.length > 0 ? subjectAnswered.length : questions.filter(q => q.subjectId === sid).length;
                  const subjectScore = subjectAnswered.filter(r => r.isCorrect).length;
                  const percentage = subjectTotal > 0 ? Math.round((subjectScore / subjectTotal) * 100) : 0;
                  
                  return (
                    <div key={sid} className="p-4 bg-[#F9F7F2] rounded-2xl flex justify-between items-center">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-[#8E8A82] mb-1">{subject?.name || 'Geral'}</div>
                        <div className="text-sm font-bold">{subjectScore} / {subjectTotal} corretas</div>
                      </div>
                      <div className="text-right">
                        <div className={cn(
                          "text-lg font-black",
                          percentage >= 70 ? "text-emerald-700" : percentage >= 50 ? "text-amber-700" : "text-rose-700"
                        )}>
                          {percentage}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-12 pt-0 flex flex-col sm:flex-row gap-4">
          <Button onClick={restart} className="flex-1 gap-2 bg-[#1A1A1A] hover:bg-black text-white px-8 h-14 text-[11px] uppercase tracking-widest font-black rounded-2xl">
            <RefreshCcw className="w-5 h-5" /> Refazer Mesmas Questões
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()} className="flex-1 border-[#E2E0D9] text-[11px] uppercase tracking-widest font-black h-14 rounded-2xl">
            Sair do Simulado
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const currentQuestion = questions[currentIndex];
  // Check history
  const history = userProgress?.attempts && currentQuestion ? userProgress.attempts[currentQuestion.id] : null;
  const isFlagged = userProgress?.flaggedQuestionIds?.includes(currentQuestion?.id);

  const handleToggleFlag = async () => {
    if (!userId || !currentQuestion) return;
    const isCurrentlyFlagged = userProgress?.flaggedQuestionIds?.includes(currentQuestion.id) || false;
    const newFlags = isCurrentlyFlagged
      ? (userProgress?.flaggedQuestionIds || []).filter(id => id !== currentQuestion.id)
      : [...(userProgress?.flaggedQuestionIds || []), currentQuestion.id];

    if (onProgressUpdate && userProgress) {
      onProgressUpdate({ flaggedQuestionIds: newFlags });
    }

    try {
      const progressRef = doc(db, 'userProgress', userId);
      await updateDoc(progressRef, {
        flaggedQuestionIds: isCurrentlyFlagged
          ? arrayRemove(currentQuestion.id)
          : arrayUnion(currentQuestion.id)
      });
    } catch (e) {
      console.error('Error toggling flagged state:', e);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!currentQuestion) return;
    const confirmDelete = window.confirm("Questão Acadêmica:\n\nDeseja realmente excluir permanentemente esta questão do banco de dados?");
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, 'questions', currentQuestion.id));
      
      const updatedQuestions = questions.filter(q => q.id !== currentQuestion.id);
      
      if (updatedQuestions.length === 0) {
        setQuestions([]);
        setIsSelecting(true);
      } else {
        setQuestions(updatedQuestions);
        if (currentIndex >= updatedQuestions.length) {
          setCurrentIndex(updatedQuestions.length - 1);
        }
        setSelectedOption(null);
        setIsAnswered(false);
        setAiExplanation(null);
      }
    } catch (e) {
      console.error('Error deleting question:', e);
      alert('Erro ao excluir a questão. Verifique se o banco de dados tem permissão de exclusão.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="flex flex-col sm:flex-row gap-6 items-center justify-between bg-white p-8 rounded-3xl shadow-sm border border-[#E2E0D9]">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82] mb-1">
              {timerType === 'down' ? 'Tempo Restante' : 'Tempo de Prova'}
            </span>
            <div className={cn(
              "flex items-center gap-2 text-2xl font-display font-black transition-all",
              timerType === 'down' && secondsRemaining <= 120 ? "text-red-600 animate-pulse" : ""
            )}>
              <Clock className={cn("w-5 h-5", timerType === 'down' && secondsRemaining <= 120 ? "text-red-600 animate-pulse" : "text-primary")} />
              {timerType === 'down' ? formatTime(secondsRemaining) : formatTime(seconds)}
            </div>
          </div>
          <div className="w-px h-10 bg-[#E2E0D9] hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82] mb-1">Seu Progresso</span>
            <div className="text-xl font-display font-bold">
              {currentIndex + 1} <span className="text-[#8E8A82] text-sm">/ {questions.length}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button 
            variant="outline"
            className="h-11 border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-[10px] uppercase font-black tracking-widest px-4 rounded-xl flex items-center gap-2 cursor-pointer shadow-xs"
            onClick={handleFinishEarly}
            title="Finalizar agora e ver relatório de desempenho até o momento"
          >
            <CheckCircle2 className="w-4 h-4 text-rose-600" />
            Finalizar Teste Agora
          </Button>

          <Button 
            variant="ghost"
            className="h-11 text-stone-500 hover:text-stone-900 text-[10px] uppercase font-black tracking-widest px-3 rounded-xl cursor-pointer"
            onClick={() => {
              if (window.confirm('Deseja sair e configurar um novo teste? O progresso não finalizado será descartado.')) {
                setSelectedTopicIds([]);
                setSelectedSubjectIds([]);
                setQuestions([]);
                setIsSelecting(true);
              }
            }}
          >
            Sair
          </Button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-[#E2E0D9] shadow-none rounded-3xl overflow-hidden bg-white">
            <CardHeader className="p-12 pb-6 flex flex-row items-start justify-between gap-4">
              <div className="space-y-2">
                {(() => {
                  const q = currentQuestion as any;
                  const rawSource = q.source || 'Residência Médica';
                  const cleanedSource = rawSource.replace(/-\s*\[Nota:[\s\S]*?\]/gi, '').replace(/\[Nota:[\s\S]*?\]/gi, '').trim();
                  const yearMatch = cleanedSource.match(/\b(20\d{2}|19\d{2})\b/);
                  const yearStr = q.year ? String(q.year) : (yearMatch ? yearMatch[1] : null);
                  
                  let instMatch = cleanedSource
                    .replace(/\b(20\d{2}|19\d{2})\b/, '')
                    .replace(/\(\s*\)/g, '')
                    .replace(/\[\s*\]/g, '')
                    .replace(/^[-–—:\s]+|[-–—:\s]+$/g, '')
                    .trim();

                  const institutionStr = q.institution || q.exam || (instMatch || rawSource);

                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-900 border border-amber-300/80 text-[10px] font-black uppercase tracking-wider px-3 py-1 flex items-center gap-1.5 shadow-xs">
                        <Building2 className="w-3.5 h-3.5 text-amber-600" />
                        <span>Prova / Banca: <strong>{institutionStr}</strong></span>
                      </Badge>
                      {yearStr && (
                        <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-900 border border-indigo-300/80 text-[10px] font-black uppercase tracking-wider px-3 py-1 flex items-center gap-1.5 shadow-xs">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Ano de Cobrança: <strong>{yearStr}</strong></span>
                        </Badge>
                      )}
                    </div>
                  );
                })()}
                <div className="flex items-center gap-2">
                   <Layers className="w-3 h-3 text-[#8E8A82]" />
                   <span className="text-[9px] uppercase tracking-widest font-bold text-[#8E8A82]">
                     {userId === 'admin' ? 'Modo Admin' : quizMode === 'exam' ? 'Simulado Realista (Ao Final)' : 'Simulado Individual (Estudo)'}
                   </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {history && (
                  <div className={cn(
                    "px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border",
                    history.isCorrect ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"
                  )}>
                    Seu Último Intento: Alternative {String.fromCharCode(65 + history.selectedOptionIndex)}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-10 w-10 rounded-xl transition-all border-[#E2E0D9] shrink-0",
                    isFlagged 
                      ? "bg-amber-50 text-amber-500 border-amber-200 hover:bg-amber-100 hover:text-amber-600" 
                      : "text-[#8E8A82] hover:bg-slate-50 hover:text-primary"
                  )}
                  onClick={handleToggleFlag}
                  title={isFlagged ? "Remover marcação" : "Marcar questão"}
                >
                  <Bookmark className={cn("w-4 h-4", isFlagged ? "fill-amber-500" : "")} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl transition-all border-[#E2E0D9] shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                  onClick={handleDeleteQuestion}
                  title="Excluir questão permanentemente"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>

            {/* Estatísticas de Incidência Regional & Termômetro de Calor */}
            <div className="px-4 sm:px-6 md:px-8 lg:px-12 py-4 sm:py-5 border-b border-[#E2E0D9] bg-[#FBFCFB] flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">Termômetro de Interest:</span>
                <div className="flex items-center gap-1.5 bg-white border border-[#E2E0D9] px-3.5 py-1 rounded-full shadow-sm">
                  <span className={cn(
                    "inline-block w-2.5 h-2.5 rounded-full",
                    currentQuestion.heatLevel === 'extremo' ? "bg-purple-600 animate-ping" :
                    currentQuestion.heatLevel === 'alto' ? "bg-red-500 animate-pulse" :
                    currentQuestion.heatLevel === 'medio' ? "bg-amber-500" : "bg-green-500"
                  )} />
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#1A1A1A]">
                    {currentQuestion.heatLevel || 'alto'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-start md:justify-end items-center">
                <span className="text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">Incidência Regional Estimada:</span>
                {currentQuestion.regionalIncidenceStats ? (
                  Object.entries(currentQuestion.regionalIncidenceStats).map(([banca, count]) => (
                    <Badge key={banca} variant="outline" className="bg-white border-[#E2E0D9] text-[#1A1A1A] text-[9px] font-extrabold px-2 py-0.5 rounded-lg shadow-sm">
                      {banca}: <span className="text-primary font-black ml-1">+{count}x</span>
                    </Badge>
                  ))
                ) : (
                  <>
                    <Badge variant="outline" className="bg-white border-[#E2E0D9] text-[#1A1A1A] text-[9px] font-extrabold px-2 py-0.5 rounded-lg">SES-DF: <span className="text-[#E65100] font-black ml-1">+14x</span></Badge>
                    <Badge variant="outline" className="bg-white border-[#E2E0D9] text-[#1A1A1A] text-[9px] font-extrabold px-2 py-0.5 rounded-lg">SES-GO: <span className="text-[#E65100] font-black ml-1">+9x</span></Badge>
                    <Badge variant="outline" className="bg-white border-[#E2E0D9] text-[#1A1A1A] text-[9px] font-extrabold px-2 py-0.5 rounded-lg">ENARE: <span className="text-[#E65100] font-black ml-1">+15x</span></Badge>
                  </>
                )}
              </div>
            </div>

            {/* Mosaico Grid de Navegação de Questões */}
            {questions.length > 1 && (
              <div className="px-4 sm:px-6 md:px-8 lg:px-12 py-3 sm:py-4 bg-[#FBFBFA] border-b border-[#E2E0D9] flex flex-wrap gap-1.5 items-center justify-start">
                <span className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82] mr-2">Mapa da Prova:</span>
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const studyAnswered = isAnswered && quizMode === 'study';
                  const examAnsweredOption = examAnswers[q.id];
                  const hasAnswered = quizMode === 'study' ? studyAnswered : examAnsweredOption !== undefined;
                  
                  return (
                    <button
                      key={`q-nav-${q.id}-${idx}`}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setSelectedOption(null);
                        setIsAnswered(quizMode === 'study' ? false : false); // handled dynamically
                        setAiExplanation(null);
                      }}
                      className={cn(
                        "w-8 h-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center border",
                        isCurrent 
                          ? "bg-primary text-white border-primary ring-2 ring-primary/20 scale-105" 
                          : hasAnswered 
                            ? "bg-green-50 border-green-200 text-green-700 font-extrabold" 
                            : "bg-white border-[#E2E0D9] text-gray-500 hover:bg-stone-50"
                      )}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            )}

            <CardContent className="p-4 sm:p-6 md:p-8 lg:p-12 pt-6 sm:pt-8 space-y-6">
              <div className="prose prose-slate prose-headings:font-display prose-headings:font-bold max-w-none text-2xl font-display font-semibold leading-relaxed mb-6 select-text text-[#1a1a1a]">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm, remarkMath]} 
                  rehypePlugins={[rehypeRaw, [rehypeKatex, { strict: 'ignore' }]]}
                  components={markdownComponents}
                >
                  {parseMarkdownAlerts(currentQuestion.text)}
                </ReactMarkdown>
              </div>

              {/* Casos Especiais de Gabarito: Divergência, Discordância ou Recursos */}
              {currentQuestion.gabaritoConflict ? (
                <div className={cn(
                  "p-5 rounded-2xl text-xs border flex items-start gap-4 mb-6",
                  currentQuestion.gabaritoConflict.hasConflict
                    ? "bg-amber-50/90 border-amber-300 text-amber-900 animate-pulse"
                    : "bg-green-50/40 border-green-200 text-green-900"
                )}>
                  <Brain className={cn("w-5 h-5 shrink-0 mt-0.5", currentQuestion.gabaritoConflict.hasConflict ? "text-[#D84315]" : "text-green-600")} />
                  <div className="space-y-1">
                    <div className="font-black uppercase tracking-wider text-[9px]">
                      {currentQuestion.gabaritoConflict.hasConflict 
                        ? "⚠️ Alerta Acadêmico: Discordância, Recursos ou Gabarito Duplo" 
                        : "✓ Status de Gabarito: Consensual e Unânime na Banca"}
                    </div>
                    <p className="text-xs leading-relaxed opacity-90">
                      {currentQuestion.gabaritoConflict.description}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl text-xs border bg-green-50/30 border-green-100 text-green-900 flex items-start gap-3 mb-4">
                  <Brain className="w-4.5 h-4.5 shrink-0 mt-0.5 text-green-600" />
                  <div className="space-y-0.5">
                    <div className="font-black uppercase tracking-wider text-[8px] text-[#8E8A82]">GABARITO PRINCIPAL</div>
                    <p className="text-xs leading-relaxed text-[#5C5954]">Questão oficial consolidada, com gabarito oficial consensual e mantido na fase pós-recursos.</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {currentQuestion.options.map((option, idx) => {
                  const isSelected = quizMode === 'study' 
                    ? selectedOption === idx 
                    : examAnswers[currentQuestion.id] === idx;
                  const isCorrect = idx === currentQuestion.correctOptionIndex;
                  const wasMarkedPreviously = history?.selectedOptionIndex === idx;
                  
                  return (
                    <button
                      key={idx}
                      className={cn(
                        "w-full flex items-center gap-6 p-6 md:p-8 text-left transition-all border-2 rounded-2xl group relative overflow-hidden",
                        isAnswered && quizMode === 'study'
                          ? isCorrect 
                            ? "border-emerald-600 bg-emerald-500/20 text-emerald-950 dark:text-emerald-100 font-extrabold shadow-md ring-2 ring-emerald-500/30" 
                            : isSelected 
                              ? "border-rose-600 bg-rose-500/20 text-rose-950 dark:text-rose-100 font-extrabold shadow-md ring-2 ring-rose-500/30"
                              : "border-[#E2E0D9]/70 opacity-40 bg-[#FAF9F5]"
                          : isSelected
                            ? "border-primary bg-primary/5 font-semibold"
                            : "border-[#E2E0D9] hover:border-primary/40 hover:bg-[#FBFBFA]"
                      )}
                      onClick={() => {
                        if (quizMode === 'study') {
                          handleAnswer(idx);
                        } else {
                          handleExamOptionClick(idx);
                        }
                      }}
                      disabled={isAnswered && quizMode === 'study'}
                    >
                      <span className={cn(
                        "w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xs font-black shrink-0 transition-all",
                        isAnswered && quizMode === 'study' && isCorrect ? "bg-emerald-600 border-emerald-500 text-white shadow-sm" :
                        isAnswered && quizMode === 'study' && isSelected && !isCorrect ? "bg-rose-600 border-rose-500 text-white shadow-sm" :
                        isSelected ? "bg-primary border-primary text-white" : 
                        "border-[#E2E0D9] text-[#8E8A82]"
                      )}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="flex-1 text-lg font-medium leading-relaxed">{option}</span>
                      
                      {wasMarkedPreviously && !isAnswered && (
                        <div className="absolute right-4 top-4 flex items-center gap-1.5 bg-[#8E8A82]/10 px-2 py-1 rounded-full">
                          <Clock className="w-3 h-3 text-[#8E8A82]" />
                          <span className="text-[8px] font-black uppercase tracking-tighter text-[#8E8A82]">Visto Anteriormente</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
            
            {/* FOOTER CONTEXT: MODES RENDERING COEXISTENCE */}
            {quizMode === 'study' && isAnswered && (
              <CardFooter className="flex-col items-start bg-[#FBFBFA] p-12 gap-8 border-t border-[#E2E0D9]">
                {/* Erros Frequentes / A Pegadinha da Banca */}
                <div className="bg-[#FFFDE7]/80 border border-[#FFF59D] p-8 rounded-3xl space-y-3 w-full font-display">
                  <div className="flex items-center gap-2.5 text-amber-950 font-black uppercase tracking-widest text-[9px] flex-wrap">
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[8px] font-black">CUIDADO DE PROVA</span>
                    <span>🚨 Estatísticas de Erros & A Pegadinha de Banca</span>
                  </div>
                  <p className="text-sm text-amber-900 font-medium leading-relaxed italic">
                    {currentQuestion.frequentMistakesExplanation || "A maior taxa de erro neste tema reside no reconhecimento correto de variações clínicas e diretrizes exclusivas do SUS regional ou contradições sutilmente embutidas nas alternativas pelas grandes bancas do DF e de GO."}
                  </p>
                </div>

                <div className="space-y-6 w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-primary font-black uppercase tracking-widest text-[10px]">
                      <Sparkles className="w-4 h-4" />
                      Explicação do Professor
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={handleExplainWithAI}
                      disabled={isExplaining}
                      className="gap-2 border-primary/20 text-primary hover:bg-primary/5 text-[9px] font-black uppercase tracking-widest px-6 h-9 rounded-full"
                    >
                      {isExplaining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Comentário IA
                    </Button>
                  </div>
                  
                  <div className="bg-white p-8 rounded-3xl border border-[#E2E0D9] shadow-sm w-full font-display">
                    {aiExplanation ? (
                      <div className="prose prose-sm max-w-none prose-p:leading-relaxed">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkMath]} 
                          rehypePlugins={[rehypeRaw, [rehypeKatex, { strict: 'ignore' }]]}
                          components={markdownComponents}
                        >
                          {parseMarkdownAlerts(aiExplanation || '')}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-xl text-[#1A1A1A] leading-relaxed italic opacity-80">
                        "{currentQuestion.explanation}"
                      </p>
                    )}
                  </div>
                </div>
                
                <Button onClick={nextQuestion} className="w-full h-16 bg-[#1A1A1A] hover:bg-black text-white text-[11px] font-black uppercase tracking-widest gap-4 rounded-2xl shadow-xl shadow-black/10">
                  {currentIndex === questions.length - 1 ? 'Finalizar e Ver Relatório' : 'Avançar para Próxima Questão'}
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </CardFooter>
            )}

            {/* SEPARATE NAVIGATION FOOTER FOR EXAM MODE (GABARITO AO FINAL) */}
            {quizMode === 'exam' && (
              <CardFooter className="flex flex-col sm:flex-row justify-between items-center bg-[#FBFBFA] p-8 gap-4 border-t border-[#E2E0D9] w-full">
                <Button
                  variant="outline"
                  disabled={currentIndex === 0}
                  onClick={() => {
                    setCurrentIndex(prev => prev - 1);
                    setSelectedOption(null);
                    setIsAnswered(false);
                    setAiExplanation(null);
                  }}
                  className="rounded-xl border-[#E2E0D9] text-[10px] uppercase font-black tracking-widest px-6 h-12 w-full sm:w-auto shrink-0"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> Questão Anterior
                </Button>

                <div className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82] text-center hidden md:block">
                  Respondidas: {Object.keys(examAnswers).length} / {questions.length}
                </div>

                {currentIndex === questions.length - 1 ? (
                  <Button
                    onClick={() => {
                      const unansweredCount = questions.filter(q => examAnswers[q.id] === undefined).length;
                      if (unansweredCount > 0) {
                        const confirmSubmit = window.confirm(`⚠️ Você possui ${unansweredCount} questão(ões) sem resposta no simulado.\n\nDeseja realmente finalizar o simulado de todas as formas?`);
                        if (!confirmSubmit) return;
                      } else {
                        const confirmFinal = window.confirm('Deseja realmente finalizar o simulado e submeter todas as respostas para correção?');
                        if (!confirmFinal) return;
                      }
                      submitExam();
                    }}
                    className="bg-primary hover:bg-primary/95 text-white text-[10px] uppercase font-black tracking-widest px-8 h-12 rounded-xl gap-2 shadow-lg w-full sm:w-auto shrink-0"
                  >
                    Finalizar Simulado <CheckCircle2 className="w-4.5 h-4.5" />
                  </Button>
                ) : (
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={handleFinishEarly}
                      className="border-rose-200 text-rose-700 bg-rose-50/50 hover:bg-rose-100 text-[10px] uppercase font-black tracking-widest px-4 h-12 rounded-xl cursor-pointer"
                    >
                      Encerrar Agora
                    </Button>
                    <Button
                      onClick={() => {
                        setCurrentIndex(prev => prev + 1);
                        setSelectedOption(null);
                        setIsAnswered(false);
                        setAiExplanation(null);
                      }}
                      className="bg-[#1A1A1A] hover:bg-black text-white text-[10px] uppercase font-black tracking-widest px-8 h-12 rounded-xl gap-2 shadow-lg w-full sm:w-auto shrink-0 cursor-pointer"
                    >
                      Próxima Questão <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardFooter>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
