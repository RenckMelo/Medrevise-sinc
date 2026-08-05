import React, { useState, useEffect, useRef } from 'react';
import { Subject, Topic, Question, UserProgress, QuestionAttempt, QuizAttempt } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, ChevronRight, ChevronLeft, HelpCircle, Trophy, RefreshCcw, Sparkles, Loader2, Clock, Filter, Layers, Brain, BookCheck, RotateCcw, List, Bookmark, Trash2, SlidersHorizontal, AlertCircle, Building2, Calendar, Eye, Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

import { db, collection, query, getDocs, where, doc, updateDoc, arrayUnion, arrayRemove, addDoc, setDoc, getDoc, increment, orderBy, limit, deleteDoc } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { explainQuestion, generateQuestions } from '../services/geminiService';
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
  onProgressUpdate 
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

  useEffect(() => {
    if (showResults) {
      setMedReviseMinutes(Math.max(1, Math.round((seconds || 0) / 60)));
    }
  }, [showResults, seconds]);

  const handleRegisterMedRevise = async () => {
    if (!userId) {
      alert("Usuário não autenticado.");
      return;
    }
    setIsSavingMedRevise(true);
    try {
      let targetTopicObjs: Topic[] = [];
      if (selectedTopicIds.length > 0) {
        targetTopicObjs = topics.filter(t => selectedTopicIds.includes(t.id));
      }
      if (targetTopicObjs.length === 0) {
        const qTopicIds = [...new Set(questions.map(q => q.topicId).filter(Boolean) as string[])];
        targetTopicObjs = topics.filter(t => qTopicIds.includes(t.id));
      }

      if (targetTopicObjs.length === 0) {
        alert("Selecione ou vincule a um tema do MedRevise para registrar seu progresso.");
        setIsSavingMedRevise(false);
        return;
      }

      const totalQ = questions.length;
      const finalScore = score;
      const quality = accuracyToQuality(finalScore, totalQ);
      const dateIso = new Date().toISOString();

      let lastIsFirst = false;
      let lastNextDate = '';
      let lastTopicTitle = '';

      for (const tObj of targetTopicObjs) {
        lastTopicTitle = tObj.title || (tObj as any).name || 'Tópico';
        const topicRef = doc(db, 'users', userId, 'topics', tObj.id);
        const topicSnap = await getDoc(topicRef);

        let currentReps = 0;
        let prevInterval = 0;
        let prevEase = 2.5;

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

        const isFirstRegistration = currentReps === 0;
        lastIsFirst = isFirstRegistration;

        const srsUpdate = calculateNextReview(
          quality,
          currentReps,
          prevInterval,
          prevEase,
          new Date()
        );

        lastNextDate = srsUpdate.nextReviewDate;

        // Register studySession
        await addDoc(collection(db, 'users', userId, 'studySessions'), {
          topicId: tObj.id,
          subjectId: tObj.subjectId,
          date: dateIso,
          questionsCount: totalQ,
          correctCount: finalScore,
          studyTimeMinutes: medReviseMinutes || 15,
          description: isFirstRegistration
            ? `Estudo Inicial por Questões MedInternato (${finalScore}/${totalQ} acertos - ${Math.round((finalScore/totalQ)*100)}%)`
            : `Revisão por Questões MedInternato (${finalScore}/${totalQ} acertos - ${Math.round((finalScore/totalQ)*100)}%)`
        });

        // Update or Set topic state in MedRevise
        await setDoc(topicRef, {
          name: tObj.title || (tObj as any).name || '',
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

      setMedReviseResult({
        isFirst: lastIsFirst,
        nextDate: new Date(lastNextDate).toLocaleDateString('pt-BR'),
        topicTitle: lastTopicTitle
      });
    } catch (err) {
      console.error("Erro ao registrar no MedRevise:", err);
      alert("Ocorreu um erro ao salvar o registro no MedRevise.");
    } finally {
      setIsSavingMedRevise(false);
    }
  };

  // METODOLOGIAS DE SIMULADOS DE PESO OFICIAL E IA
  const [simuladoMode, setSimuladoMode] = useState<'custom' | 'ai-errors' | 'official-ratio'>('custom');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('ses-df');
  const [totalPresetQuestions, setTotalPresetQuestions] = useState<number>(20);

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
          setQuizHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizAttempt)));
        } catch (err) {
          console.error('Error fetching history:', err);
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [showHistory, userId]);

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

          if (initialQuestionsCount && initialQuestionsCount > 0) {
            fetched = fetched.slice(0, initialQuestionsCount);
          }

          // Resilient fallback if no questions or fewer questions exist in specified topics yet
          const targetCount = initialQuestionsCount || 5;
          if (fetched.length < targetCount && activeTids.length > 0) {
            const preset = EXAM_PRESETS.find(p => p.id === selectedPresetId);
            const targetExam = preset ? preset.name : undefined;
            
            for (const tid of activeTids) {
              const { topicTitle, subjectName, topicId, subjectId } = findTopicAndSubject(tid, topics, subjects);
              const existingTexts = fetched.map(q => q.text);
              const needed = Math.max(1, targetCount - fetched.length);
              try {
                const newQuestions = await generateQuestions(topicTitle, subjectName, needed, existingTexts, userId, targetExam);
                if (newQuestions && Array.isArray(newQuestions)) {
                  for (const qData of newQuestions) {
                    const docRef = await addDoc(collection(db, 'questions'), {
                      ...qData,
                      topicId: topicId,
                      subjectId: subjectId
                    });
                    const createdQ = { id: docRef.id, ...qData, topicId: topicId, subjectId: subjectId } as Question;
                    fetched.push(createdQ);
                  }
                  safeLocalStorageRemove(`questions_topic_${topicId}`);
                }
              } catch (genErr) {
                console.warn('Auto AI question generation fallback failed:', genErr);
              }
            }
          }

          if (fetched.length === 0) {
            const matchedSubjects = new Set<string>();
            activeTids.forEach(tid => {
              const { subjectId } = findTopicAndSubject(tid, topics, subjects);
              if (subjectId) {
                matchedSubjects.add(subjectId);
              }
            });

            if (matchedSubjects.size > 0) {
              const subIds = Array.from(matchedSubjects);
              const q = query(collection(db, 'questions'), where('subjectId', 'in', subIds), limit(targetCount * 3));
              const snapshot = await getDocs(q);
              fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
              fetched = fetched.sort(() => Math.random() - 0.5).slice(0, targetCount);
            }
          }

          if (fetched.length > 0) {
            setQuestions(fetched);
            setIsActive(true);
            setSeconds(0);
            setSecondsRemaining((initialQuestionsCount ? Math.ceil(initialQuestionsCount * 1.5) : 30) * 60);
            setExamAnswers({});
            setCurrentIndex(0);
            setIsAnswered(false);
            setSelectedOption(null);
            setAiExplanation(null);
            setShowResults(false);
            setIsSelecting(false);
          } else {
            setIsSelecting(true);
          }
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
      const quizAttempt = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        subjectIds: selectedSubjectIds.length > 0 ? selectedSubjectIds : [...new Set(questions.map(q => q.subjectId).filter(Boolean) as string[])],
        topicIds: selectedTopicIds,
        questions: currentQuizResults,
        score,
        totalQuestions: questions.length,
        timeSpentSeconds: seconds,
        timestamp: new Date().toISOString(),
        type: selectedSubjectIds.length > 1 ? 'simulado' : 'individual' as any
      };
      
      if (onProgressUpdate && userProgress) {
        onProgressUpdate({
          totalStudyTimeSeconds: (userProgress.totalStudyTimeSeconds || 0) + seconds,
          quizHistory: [...(userProgress.quizHistory || []), quizAttempt]
        });
      }

      try {
        await addDoc(collection(db, 'quizAttempts'), quizAttempt);
        const progressRef = doc(db, 'userProgress', userId);
        await updateDoc(progressRef, {
          totalStudyTimeSeconds: increment(seconds),
          quizHistory: arrayUnion(quizAttempt) // Store full object for recent display if needed, or just rely on collection
        });
      } catch (err) {
        console.warn('Firestore write failed, saved in local-first cache:', err);
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
        const isCorrect = chosenIdx !== undefined && chosenIdx === q.correctOptionIndex;
        if (isCorrect) finalScore++;
        
        const attempt: QuestionAttempt = {
          questionId: q.id,
          selectedOption: chosenIdx !== undefined ? String.fromCharCode(65 + chosenIdx) : '-',
          correctOption: String.fromCharCode(65 + q.correctOptionIndex),
          isCorrect,
          timestamp: new Date().toISOString(),
          timeSpentSeconds: Math.round(seconds / questions.length),
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
      
      const quizAttempt = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        subjectIds: selectedSubjectIds.length > 0 ? selectedSubjectIds : [...new Set(questions.map(q => q.subjectId).filter(Boolean) as string[])],
        topicIds: selectedTopicIds,
        questions: quizResults,
        score: finalScore,
        totalQuestions: questions.length,
        timeSpentSeconds: seconds,
        timestamp: new Date().toISOString(),
        type: 'simulado' as any
      };
      
      updates.totalStudyTimeSeconds = increment(seconds);
      updates.quizHistory = arrayUnion(quizAttempt);
      
      questions.forEach(q => {
        if (q.subjectId) {
          updates[`stats.subjectQuestions.${q.subjectId}`] = increment(1);
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
        questions.forEach(q => {
          if (q.subjectId) {
            subQ[q.subjectId] = (subQ[q.subjectId] || 0) + 1;
          }
        });
        localStats.subjectQuestions = subQ;

        onProgressUpdate({
          attempts: localAttempts,
          answeredQuestionIds: localAnswered,
          correctQuestionIds: localCorrect,
          totalStudyTimeSeconds: (userProgress.totalStudyTimeSeconds || 0) + seconds,
          quizHistory: [...(userProgress.quizHistory || []), quizAttempt],
          stats: localStats
        });
      }
      
      try {
        await addDoc(collection(db, 'quizAttempts'), quizAttempt);
        await updateDoc(progressRef, updates);
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
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

              {/* 2. Erros Históricos IA */}
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
                  <p className="text-[9px] text-[#8E8A82] leading-normal font-medium">Reúne de forma autônoma e inteligente as matérias onde você mais cometeu erros recentemente.</p>
                </div>
              </button>

              {/* 3. Banca Real / Distribuição oficial */}
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
                    {filteredSubjects.map((s, sIdx) => (
                      <Button
                        key={`qmod-s-${s.id}-${sIdx}`}
                        variant={selectedSubjectIds.includes(s.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleSubject(s.id)}
                        className="rounded-full text-[9px] uppercase tracking-widest font-bold h-8 flex-shrink-0"
                      >
                        {s.name}
                      </Button>
                    ))}
                    {filteredSubjects.length === 0 && (
                      <p className="text-[10px] italic text-[#8E8A82] py-2">Nenhuma matéria encontrada.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82]">Temas Específicos</label>
                  <div className="flex flex-wrap gap-2 max-h-[200px] overflow-auto">
                    {topics.filter(t => selectedSubjectIds.length === 0 || selectedSubjectIds.includes(t.subjectId)).map((t, tIdx) => (
                      <Button
                        key={`qmod-t-${t.id}-${tIdx}`}
                        variant={selectedTopicIds.includes(t.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleTopic(t.id)}
                        className="rounded-full text-[9px] uppercase tracking-widest font-bold h-8 border-dashed"
                      >
                        {t.title}
                      </Button>
                    ))}
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
              Iniciar Simulado
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
                  <p className="text-[10px] text-stone-400">Marque matérias ou tópicos específicos para ver estatísticas e gerar novas questões.</p>
                </div>
              )}

              {/* SEÇÃO DE GERAR NOVAS QUESTÕES IA */}
              {uniqueTids.length > 0 && (
                <div className="space-y-6 pt-6 border-t border-[#E2E0D9] bg-[#FAF9F5] p-6 rounded-2xl border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-widest font-black text-[#8E8A82]">Quantidade de Novas Questões por Tópico</span>
                      <p className="text-[10px] text-stone-500 font-medium">Selecione quantas questões a IA deve gerar para cada um dos {uniqueTids.length} tópicos selecionados</p>
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
                      Gerar {totalGenCount} {totalGenCount === 1 ? 'Questão Nova' : 'Questões Novas'} {uniqueTids.length > 1 ? `(${numQuestionsPerTopic} por tópico)` : ''}
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
                                    {attempt ? (
                                      <Badge className={cn(
                                        "text-[9px] font-black px-2.5 py-1 border",
                                        attempt.isCorrect ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
                                      )}>
                                        {attempt.isCorrect ? '✔ VOCÊ ACERTOU' : '✖ VOCÊ ERROU'}
                                      </Badge>
                                    ) : (
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
                                          "p-3.5 rounded-xl text-xs border flex items-center gap-3 font-medium",
                                          isCorrect ? "bg-emerald-50/90 border-emerald-500/50 text-emerald-950 font-bold" :
                                          wasChosen && !isCorrect ? "bg-rose-50/90 border-rose-500/50 text-rose-950" :
                                          "bg-stone-50/60 border-[#E2E0D9] text-stone-700"
                                        )}
                                      >
                                        <span className={cn(
                                          "w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0",
                                          isCorrect ? "bg-emerald-600 text-white" :
                                          wasChosen ? "bg-rose-600 text-white" :
                                          "bg-stone-200 text-stone-600"
                                        )}>
                                          {String.fromCharCode(65 + optIdx)}
                                        </span>
                                        <span className="flex-1">{opt}</span>
                                        {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                                        {wasChosen && !isCorrect && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
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
                            <Badge className={cn(
                              "text-[10px] font-bold px-3 py-1 shrink-0 border",
                              attempt.isCorrect ? "bg-emerald-100 text-emerald-900 border-emerald-200/80" : "bg-rose-100 text-rose-900 border-rose-200/80"
                            )}>
                              {attempt.isCorrect ? 'ACERTO' : 'ERRO'}
                            </Badge>
                          </div>

                          <div className="space-y-3">
                            {q.options.map((opt, optIdx) => {
                              const wasSelected = attempt.selectedOptionIndex === optIdx;
                              const isCorrect = q.correctOptionIndex === optIdx;
                              
                              return (
                                <div 
                                  key={optIdx}
                                  className={cn(
                                    "p-4 rounded-xl text-sm border flex items-center gap-4",
                                    isCorrect ? "bg-emerald-50/80 border-emerald-600/40 text-emerald-950 font-bold" :
                                    wasSelected && !isCorrect ? "bg-rose-50/80 border-rose-600/40 text-rose-950" :
                                    "bg-white border-[#E2E0D9] text-gray-500"
                                  )}
                                >
                                  <span className={cn(
                                    "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0",
                                    isCorrect ? "bg-emerald-700 text-white" :
                                    wasSelected ? "bg-rose-700 text-white" :
                                    "bg-gray-100 text-[#8E8A82]"
                                  )}>
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  {opt}
                                  {isCorrect && <CheckCircle2 className="w-4 h-4 ml-auto text-emerald-700" />}
                                  {wasSelected && !isCorrect && <XCircle className="w-4 h-4 ml-auto text-rose-700" />}
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center space-y-2 p-6 bg-[#FBFBFA] rounded-3xl">
              <p className="text-4xl font-display font-black text-primary">{Math.round((score / questions.length) * 100)}%</p>
              <p className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Precisão</p>
            </div>
            <div className="text-center space-y-2 p-6 bg-[#FBFBFA] rounded-3xl">
              <p className="text-4xl font-display font-black text-emerald-700">{score}</p>
              <p className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Acertos</p>
            </div>
            <div className="text-center space-y-2 p-6 bg-[#FBFBFA] rounded-3xl">
              <p className="text-4xl font-display font-black text-rose-700">{questions.length - score}</p>
              <p className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Erros</p>
            </div>
            <div className="text-center space-y-2 p-6 bg-[#FBFBFA] rounded-3xl">
              <p className="text-4xl font-display font-black text-[#1A1A1A]">{formatTime(seconds)}</p>
              <p className="text-[9px] uppercase tracking-widest font-black text-[#8E8A82]">Tempo Total</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-[11px] uppercase tracking-widest font-black text-[#1A1A1A]">
              <span>Progresso no Teste</span>
              <span>{Math.round((score / questions.length) * 100)}%</span>
            </div>
            <div className="h-4 bg-[#F0EEE9] rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(score / questions.length) * 100}%` }}
                className="h-full bg-primary"
              />
            </div>
          </div>

          {/* MedRevise Auto-Registration Card */}
          <div className="bg-[#FAF8F5] border-2 border-primary/20 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E2E0D9] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-display font-black text-[#1A1A1A]">
                    Registrar no MedRevise
                  </h3>
                  <p className="text-xs text-[#8E8A82]">
                    Sincronize seu desempenho com o algoritmo de repetição espaçada (SM-2)
                  </p>
                </div>
              </div>
              {medReviseResult && (
                <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1 text-xs font-bold gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  Registrado como {medReviseResult.isFirst ? 'ESTUDO' : 'REVISÃO'}
                </Badge>
              )}
            </div>

            {!medReviseResult ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-extrabold text-[#8E8A82] block mb-2">
                    Métricas de Desempenho
                  </label>
                  <div className="p-3 bg-white rounded-xl border border-[#E2E0D9] text-xs font-bold text-[#1A1A1A]">
                    {score} de {questions.length} acertos ({Math.round((score / questions.length) * 100)}%)
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
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase tracking-widest rounded-xl gap-2 shadow-md shadow-primary/20"
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
                  const subjectQuestions = questions.filter(q => q.subjectId === sid);
                  const subjectScore = currentQuizResults.filter(r => r.subjectId === sid && r.isCorrect).length;
                  const percentage = Math.round((subjectScore / subjectQuestions.length) * 100);
                  
                  return (
                    <div key={sid} className="p-4 bg-[#F9F7F2] rounded-2xl flex justify-between items-center">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-[#8E8A82] mb-1">{subject?.name || 'Geral'}</div>
                        <div className="text-sm font-bold">{subjectScore} / {subjectQuestions.length} corretas</div>
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
        
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Button 
            variant="outline"
            className="h-11 border-primary/20 text-primary text-[10px] uppercase font-black tracking-widest px-4 rounded-xl w-full"
            onClick={() => {
              setSelectedTopicIds([]);
              setSelectedSubjectIds([]);
              setQuestions([]);
              setIsSelecting(true);
            }}
          >
            Configurar Novo Teste
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
                  const yearMatch = rawSource.match(/\b(20\d{2}|19\d{2})\b/);
                  const yearStr = q.year ? String(q.year) : (yearMatch ? yearMatch[1] : null);
                  const instMatch = rawSource.replace(/\b(20\d{2}|19\d{2})\b/, '').replace(/[-–—]/g, ' ').trim();
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
            <div className="px-12 py-5 border-b border-[#E2E0D9] bg-[#FBFCFB] flex flex-col md:flex-row md:items-center justify-between gap-6">
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
              <div className="px-12 py-4 bg-[#FBFBFA] border-b border-[#E2E0D9] flex flex-wrap gap-1.5 items-center justify-start">
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

            <CardContent className="p-12 pt-8 space-y-6">
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
                            ? "border-emerald-700/30 bg-emerald-50/50 text-[#173827] font-semibold shadow-xs" 
                            : isSelected 
                              ? "border-rose-700/30 bg-rose-50/40 text-[#472222] font-semibold shadow-xs"
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
                        isAnswered && quizMode === 'study' && isCorrect ? "bg-[#2D5A43] border-[#2D5A43] text-white shadow-xs" :
                        isAnswered && quizMode === 'study' && isSelected && !isCorrect ? "bg-[#8C3A3A] border-[#8C3A3A] text-white shadow-xs" :
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
                  <Button
                    onClick={() => {
                      setCurrentIndex(prev => prev + 1);
                      setSelectedOption(null);
                      setIsAnswered(false);
                      setAiExplanation(null);
                    }}
                    className="bg-[#1A1A1A] hover:bg-black text-white text-[10px] uppercase font-black tracking-widest px-8 h-12 rounded-xl gap-2 shadow-lg w-full sm:w-auto shrink-0"
                  >
                    Próxima Questão <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </CardFooter>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
